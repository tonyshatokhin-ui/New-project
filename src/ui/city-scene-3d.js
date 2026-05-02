(function initCityScene3DGlobal() {
  const SLOT_LAYOUT_3D = [
    { id: "houses", x: -4.35, z: -1.9 },
    { id: "storehouse", x: -0.2, z: -2.55 },
    { id: "granary", x: 3.45, z: -2.05 },
    { id: "workshop", x: -4.25, z: 2.1 },
    { id: "market-square", x: 0.95, z: 3.7 },
    { id: "shrine", x: 4.3, z: 2.55 },
    { id: "dock", x: -8.22, z: 7.78 },
    { id: "training-ground", x: -1.9, z: 4.55 },
  ];

  const CITY_DECOR_LIMITS = {
    treeInstances: 90,
    rockInstances: 60,
  };
  /* Full static footprint: quarters + filler buildings + civic props + distant slots — must envelop fence. */
  const CITY_BOUNDARY_PADDING = {
    wall: 0.52,
    building: 1.05,
  };

  /** Постройки по слотам: ещё меньше площадок/деревьев (GLB + процедурные префабы). */
  const BUILT_SLOT_MODEL_SCALE = 0.68;
  const BUILT_SLOT_MODEL_SCALE_HIGHLIGHT = BUILT_SLOT_MODEL_SCALE * (1.2 / 1.02);

  /** Invisible volumetric proxies — только raycast/hover клики, модели ниже могут быть мельче. */
  const SLOT_HIT_BOX_XZ = 2.62;
  const SLOT_HIT_BOX_Y = 2.05;
  const CITY_CORE_HIT_BOX_XZ = 4.05;

  /** World-space axis rectangles [cx, cz, halfW, halfD] — floor tiles around core. */
  const STATIC_QUARTER_RECTS = [
    [-2.55, -1.22, 1.1, 0.85],
    [2.82, -1.12, 1.125, 0.85],
    [-2.58, 2.02, 1.1, 0.9],
    [2.62, 2.15, 1.15, 0.95],
  ];

  /** Filler prefabs (districtCluster mini-buildings): center + representative radius — keeps fence outside huts/docks visuals. */
  const STATIC_FILLER_RADIUS = [
    [0.08, 0.46, 1.2],
    [-2.9, -1.72, 0.95],
    [-2.74, -0.94, 0.9],
    [0.12, -2.06, 0.95],
    [2.86, -1.62, 0.92],
    [-2.96, 2.08, 0.94],
    [0.76, 2.92, 0.94],
    [-1.36, 3.42, 0.95],
    [-2.38, -0.86, 0.55],
    [2.46, -0.8, 0.55],
    [0.28, 3.26, 0.55],
    [2.28, 2.34, 0.35],
  ];

  function affectsCityBoundary(slotId) {
    // Harbor is intentionally outside walls, near river bank.
    return slotId !== "dock";
  }

  function computeStaticCityEnvelope() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const radial = (x, z, r) => {
      minX = Math.min(minX, x - r);
      maxX = Math.max(maxX, x + r);
      minZ = Math.min(minZ, z - r);
      maxZ = Math.max(maxZ, z + r);
    };

    STATIC_QUARTER_RECTS.forEach(([cx, cz, hw, hd]) => {
      radial(cx, cz, Math.hypot(hw, hd));
    });
    STATIC_FILLER_RADIUS.forEach(([x, z, r]) => radial(x, z, r));
    SLOT_LAYOUT_3D.forEach((slot) => {
      if (!affectsCityBoundary(slot.id)) return;
      radial(slot.x, slot.z, CITY_BOUNDARY_PADDING.building);
    });

    if (!Number.isFinite(minX)) {
      minX = -5;
      maxX = 8;
      minZ = -3.5;
      maxZ = 6;
    }

    return { minX, maxX, minZ, maxZ };
  }

  const runtimeByMount = new WeakMap();
  /** Reuse WebGL + clock across full UI re-renders (same city), keyed by {@link GameCity#nameKey}. */
  const runtimeByCityKey = new Map();
  const threeBootstrapState = {
    started: false,
    done: false,
    promise: null,
  };

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-three-src="${url}"]`);
      if (existing) {
        if (window.THREE) resolve(true);
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Script load failed: ${url}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.dataset.threeSrc = url;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error(`Script load failed: ${url}`));
      document.head.appendChild(script);
    });
  }

  async function loadThreeModule(url) {
    try {
      const mod = await import(url);
      if (mod) {
        window.THREE = mod;
        return true;
      }
    } catch (_) {
      return false;
    }
    return false;
  }

  async function ensureThreeLoaded() {
    if (typeof window.THREE !== "undefined") return true;
    if (threeBootstrapState.done) return typeof window.THREE !== "undefined";
    if (threeBootstrapState.promise) return threeBootstrapState.promise;
    threeBootstrapState.started = true;
    const isFileProtocol = (window.location?.protocol || "").startsWith("file");
    if (isFileProtocol) {
      threeBootstrapState.promise = new Promise((resolve) => {
        const onReady = () => {
          window.removeEventListener("three-ready", onReady);
          threeBootstrapState.done = true;
          if (typeof globalThis.render === "function") {
            setTimeout(() => globalThis.render(), 0);
          }
          resolve(typeof window.THREE !== "undefined");
        };
        window.addEventListener("three-ready", onReady, { once: true });
        setTimeout(() => {
          if (typeof window.THREE !== "undefined") {
            onReady();
            return;
          }
          threeBootstrapState.done = true;
          resolve(false);
        }, 1200);
      });
      return threeBootstrapState.promise;
    }

    const candidates = [
      "https://unpkg.com/three@0.164.1/build/three.min.js",
      "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r164/three.min.js",
    ];
    const moduleCandidates = [
      "./node_modules/three/build/three.module.js",
      "../node_modules/three/build/three.module.js",
      "node_modules/three/build/three.module.js",
      "https://unpkg.com/three@0.164.1/build/three.module.js",
      "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js",
    ];
    threeBootstrapState.promise = (async () => {
      for (const url of moduleCandidates) {
        const ok = await loadThreeModule(url);
        if (ok && typeof window.THREE !== "undefined") {
          threeBootstrapState.done = true;
          if (typeof globalThis.render === "function") {
            setTimeout(() => globalThis.render(), 0);
          }
          return true;
        }
      }
      for (const url of candidates) {
        try {
          await loadScript(url);
          if (typeof window.THREE !== "undefined") {
            threeBootstrapState.done = true;
            if (typeof globalThis.render === "function") {
              setTimeout(() => globalThis.render(), 0);
            }
            return true;
          }
        } catch (_) {
          // Try next candidate.
        }
      }
      threeBootstrapState.done = true;
      return false;
    })();
    return threeBootstrapState.promise;
  }

  function hasThree() {
    return typeof window.THREE !== "undefined" && typeof window.createCityAssetRegistry === "function";
  }

  function canUseWebGL() {
    if (!hasThree()) {
      ensureThreeLoaded();
      return false;
    }
    try {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch (_) {
      return false;
    }
  }

  function createRuntime(initialMount, runtimeCityKey) {
    const THREE = window.THREE;
    const scene = new THREE.Scene();
    /** Aegean / Mediterranean dust palette — parchment sky, dusty distance (not arcade-neon greens). */
    scene.background = new THREE.Color(0x5c6e4a);
    scene.fog = new THREE.Fog(0x9a9070, 12.5, 38);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    if (THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "city-three-canvas";
    let domMount = initialMount;
    domMount.prepend(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-9, 9, 6, -6, 0.1, 120);
    camera.position.set(9.8, 10.9, 9.8);
    camera.lookAt(0.22, 0, 1.02);

    const assets = window.createCityAssetRegistry(THREE);
    const cityRoot = new THREE.Group();
    scene.add(cityRoot);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 28),
      new THREE.MeshStandardMaterial({ color: 0xbda888, roughness: 0.94, metalness: 0.015 }),
    );
    ground.rotation.x = -Math.PI * 0.5;
    ground.receiveShadow = true;
    cityRoot.add(ground);

    /** Extend north (~+Z) to the river bank — otherwise base `ground` tan shows beyond the pasture and reads as giant “sand”. */
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 26, 16, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b814e, roughness: 0.96, metalness: 0.015 }),
    );
    grass.position.set(0, 0.02, -1.15);
    grass.rotation.x = -Math.PI * 0.5;
    grass.receiveShadow = true;
    {
      /** Per-vertex hue/lightness jitter so the pasture reads less plastic. */
      const gGeo = grass.geometry;
      const pos = gGeo.attributes.position;
      const n = pos.count;
      let seed = seedFromCity(runtimeCityKey) ^ 0x5bd1e995;
      const jitter = () => {
        seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
        return (((seed >>> 0) % 4096) / 4096) * 2 - 1;
      };
      const colors = new Float32Array(n * 3);
      const bc = new THREE.Color(0x697e4d);
      for (let i = 0; i < n; i += 1) {
        const v = clamp(1 + jitter() * 0.06, 0.88, 1.06);
        const c = bc.clone().multiplyScalar(v);
        c.offsetHSL(jitter() * 0.012, 0, jitter() * 0.024);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      gGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      grass.material.vertexColors = true;
      grass.material.color.setHex(0xffffff);
    }
    grass.userData.hasGrassVertexColors = true;
    cityRoot.add(grass);

    /** Shore boundary: curved line west↔south — eastern edge slopes so the mouth/dock sits closer to the village (positive X toward south-Z). Matches user draw (diagonal “red line”). */
    /** IMPORTANT: Grass sits at Y≈0.02 — water must clearly cover it in depth, and polygonOffset(+ ) must NOT push water behind grass (looks like lake vanished while ripples remain). */
    const WATER_Y = 0.0285;
    /**
     * Shore line math anchor (parallel east/west) — calibrated with EAST_AT/WEST + dock slot (~−8.2 along east bank at dock z).
     * Mesh spans use separate Z clip bounds so we can widen water north-east (fill NW dry wedge on grass) without moving the shoreline formula.
     * Grass spans z≈[−14.15,11.85] (center −1.15).
     */
    const SHORE_Z0 = 5.18;
    const WATER_Z_CLIP_MIN = -1.06;
    const WATER_Z_CLIP_MAX = 11.72;
    /** Westmost X on grass plane ~−18; keep water inside playable patch (north gets extra reach vs pure diagonal west(z)). */
    const WATER_CLIP_WEST_X_CAP = -17.92;
    /** Δx per +Δz — tuned with intercepts so `eastBankXZ(dock z)` meets gameplay dock slot (−8.22, 7.78). */
    const EAST_SLOPE_PER_Z = 0.186;
    const WEST_AT_REF = -16.73;
    const EAST_AT_Z0 = -8.68;
    /** Land/water divider — shoreline the sand ribbon sits just outside of (+inland normal). */
    const eastBankXZ = (z) => EAST_AT_Z0 + EAST_SLOPE_PER_Z * (z - SHORE_Z0);
    /** Deepest-water edge parallel to shoreline (same dz/dx) — avoids vertical west edge vs diagonal coast + grass wedges. */
    const westBankXZ = (z) => WEST_AT_REF + EAST_SLOPE_PER_Z * (z - SHORE_Z0);
    /** Unit normal into land (perpendicular to shoreline in XZ), water lies on the opposite side. */
    const shoreInlandDir = (() => {
      const tx = EAST_SLOPE_PER_Z;
      const tz = 1;
      const len = Math.hypot(tx, tz);
      return { x: tz / len, z: -tx / len };
    })();

    /** Narrow sand strip: offset along true inland normal so edges stay parallel to the shore (not a skewed +X block). */
    const buildShoreRibbon = (innerFromShore, outerFromShore) => {
      const bermGeo = new THREE.BufferGeometry();
      const segAlong = 48;
      const pos = [];
      const idx = [];
      const bermY = WATER_Y - 0.0035;
      for (let j = 0; j <= segAlong; j += 1) {
        const tz = WATER_Z_CLIP_MIN + ((WATER_Z_CLIP_MAX - WATER_Z_CLIP_MIN) * j) / segAlong;
        const xe = eastBankXZ(tz);
        pos.push(xe + shoreInlandDir.x * innerFromShore, bermY, tz + shoreInlandDir.z * innerFromShore);
        pos.push(xe + shoreInlandDir.x * outerFromShore, bermY, tz + shoreInlandDir.z * outerFromShore);
      }
      for (let j = 0; j < segAlong; j += 1) {
        const a = j * 2;
        idx.push(a, a + 2, a + 3, a, a + 3, a + 1);
      }
      bermGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      bermGeo.setIndex(idx);
      bermGeo.computeVertexNormals();
      return bermGeo;
    };
    const beachStrip = new THREE.Mesh(
      buildShoreRibbon(0.025, 0.34),
      new THREE.MeshStandardMaterial({ color: 0xb2926c, roughness: 0.96, metalness: 0.015 }),
    );
    beachStrip.receiveShadow = true;
    beachStrip.renderOrder = 1;
    cityRoot.add(beachStrip);

    const segAcross = 28;
    const segAlongShore = 36;
    const riverGeo = new THREE.BufferGeometry();
    {
      const pos = [];
      const uvArr = [];
      const colArr = [];
      const idx = [];
      const cDeep = new THREE.Color(0x3d6478);
      const cShallow = new THREE.Color(0x749da8);
      const tint = new THREE.Color();
      for (let j = 0; j <= segAlongShore; j += 1) {
        const z = WATER_Z_CLIP_MIN + ((WATER_Z_CLIP_MAX - WATER_Z_CLIP_MIN) * j) / segAlongShore;
        const xW = Math.min(westBankXZ(z), WATER_CLIP_WEST_X_CAP);
        const xE = eastBankXZ(z);
        for (let i = 0; i <= segAcross; i += 1) {
          const t = i / segAcross;
          const x = THREE.MathUtils.lerp(xW, xE, t);
          pos.push(x, WATER_Y, z);
          uvArr.push(t, j / segAlongShore);
          tint.copy(cDeep).lerp(cShallow, Math.pow(t, 1.03));
          colArr.push(tint.r, tint.g, tint.b);
        }
      }
      for (let j = 0; j < segAlongShore; j += 1) {
        for (let i = 0; i < segAcross; i += 1) {
          const a = j * (segAcross + 1) + i;
          idx.push(a, a + 1, a + segAcross + 2, a, a + segAcross + 2, a + segAcross + 1);
        }
      }
      riverGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      riverGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr, 2));
      riverGeo.setAttribute("color", new THREE.Float32BufferAttribute(colArr, 3));
      riverGeo.setIndex(idx);
      riverGeo.computeVertexNormals();
    }

    const river = new THREE.Mesh(
      riverGeo,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.26,
        metalness: 0.06,
        transparent: false,
        opacity: 1,
        depthWrite: true,
        side: THREE.DoubleSide,
      }),
    );
    river.position.set(0, 0, 0);
    river.rotation.set(0, 0, 0);
    river.renderOrder = 3;
    river.receiveShadow = true;
    river.userData.waterRippleZBase = SHORE_Z0;
    cityRoot.add(river);

    const ambient = new THREE.AmbientLight(0xeee3d5, 0.52);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff0dc, 1.14);
    sun.position.set(10, 18, 7);
    sun.castShadow = true;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.028;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xb8cce0, 0x39462c, 0.125);
    scene.add(hemi);

    const slotsRoot = new THREE.Group();
    const plannedRoot = new THREE.Group();
    const constructionRoot = new THREE.Group();
    const builtRoot = new THREE.Group();
    const workersRoot = new THREE.Group();
    const pickZonesRoot = new THREE.Group();

    const invisiblePickMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    SLOT_LAYOUT_3D.forEach((slot) => {
      const hitGeo = new THREE.BoxGeometry(SLOT_HIT_BOX_XZ, SLOT_HIT_BOX_Y, SLOT_HIT_BOX_XZ);
      const hitMesh = new THREE.Mesh(hitGeo, invisiblePickMat.clone());
      hitMesh.position.set(slot.x, SLOT_HIT_BOX_Y * 0.48, slot.z);
      hitMesh.renderOrder = -1;
      hitMesh.userData.pickSlotId = slot.id;
      pickZonesRoot.add(hitMesh);
    });

    const coreHitGeo = new THREE.BoxGeometry(CITY_CORE_HIT_BOX_XZ, SLOT_HIT_BOX_Y * 1.05, CITY_CORE_HIT_BOX_XZ);
    const coreHitMesh = new THREE.Mesh(coreHitGeo, invisiblePickMat.clone());
    coreHitMesh.position.set(0.08, SLOT_HIT_BOX_Y * 0.5, 0.46);
    coreHitMesh.renderOrder = -1;
    coreHitMesh.userData.pickSlotId = "shrine";
    pickZonesRoot.add(coreHitMesh);

    cityRoot.add(slotsRoot, pickZonesRoot, plannedRoot, constructionRoot, builtRoot, workersRoot);

    const slotMarkers = new Map();
    SLOT_LAYOUT_3D.forEach((slot) => {
      const marker = assets.createSlotMarker();
      marker.position.set(slot.x, 0.05, slot.z);
      marker.userData = { buildingId: slot.id, slotX: slot.x, slotZ: slot.z, pickSlotId: slot.id };
      slotsRoot.add(marker);
      slotMarkers.set(slot.id, marker);
    });

    const cityCore = assets.createBuilding("shrine");
    cityCore.position.set(0.08, 0, 0.46);
    cityCore.scale.set(0.56, 0.56, 0.56);
    cityCore.userData.pickSlotId = "shrine";
    builtRoot.add(cityCore);

    const civicProps = new THREE.Group();
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a43, roughness: 0.9, flatShading: true });
    const crateA = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.26), crateMat);
    crateA.position.set(0.92, 0.12, 1.48);
    const crateB = crateA.clone();
    crateB.position.set(1.2, 0.1, 1.34);
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.3), crateMat);
    cart.position.set(-0.96, 0.09, 1.64);
    const wheelGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x5f462b, roughness: 0.86 });
    const wheelA = new THREE.Mesh(wheelGeo, wheelMat);
    wheelA.rotation.z = Math.PI * 0.5;
    wheelA.position.set(-1.12, 0.09, 1.74);
    const wheelB = wheelA.clone();
    wheelB.position.z = 1.54;
    /* Packed earth / civic lanes — warmer ochre vs grass vertex colors. */
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xb89058, roughness: 0.96, metalness: 0.01 });
    /* Residential quarter slabs — dustier terracotta, distinct from paths. */
    const quarterMat = new THREE.MeshStandardMaterial({ color: 0x8b5e44, roughness: 0.95, metalness: 0.01 });
    const quarterA = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.7), quarterMat);
    quarterA.position.set(-2.55, 0.05, -1.22);
    const quarterB = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.08, 1.7), quarterMat);
    quarterB.position.set(2.82, 0.05, -1.12);
    const quarterC = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.8), quarterMat);
    quarterC.position.set(-2.58, 0.05, 2.02);
    const quarterD = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 1.9), quarterMat);
    quarterD.position.set(2.62, 0.05, 2.15);

    const mainRoadNS = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 5.8), pathMat);
    mainRoadNS.rotation.x = -Math.PI * 0.5;
    mainRoadNS.position.set(0.08, 0.021, 0.86);
    const mainRoadEW = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.46), pathMat);
    mainRoadEW.rotation.x = -Math.PI * 0.5;
    mainRoadEW.position.set(0.12, 0.021, 0.5);

    const laneToDock = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), pathMat);
    laneToDock.rotation.x = -Math.PI * 0.5;
    laneToDock.position.set(3.04, 0.021, 0.7);
    laneToDock.rotation.z = -0.07;
    const laneSouthWest = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.26), pathMat);
    laneSouthWest.rotation.x = -Math.PI * 0.5;
    laneSouthWest.position.set(-2.36, 0.021, 2.26);
    laneSouthWest.rotation.z = 0.27;
    const laneNorthWest = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.23), pathMat);
    laneNorthWest.rotation.x = -Math.PI * 0.5;
    laneNorthWest.position.set(-2.1, 0.021, -0.5);
    laneNorthWest.rotation.z = -0.22;
    const templeRingOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1.22, 32),
      new THREE.MeshStandardMaterial({ color: 0xb99a66, roughness: 0.93, metalness: 0.01 }),
    );
    templeRingOuter.rotation.x = -Math.PI * 0.5;
    templeRingOuter.position.set(0.08, 0.022, 0.46);
    const templeRingInner = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.82, 28),
      new THREE.MeshStandardMaterial({ color: 0xc4aa79, roughness: 0.92, metalness: 0.01 }),
    );
    templeRingInner.rotation.x = -Math.PI * 0.5;
    templeRingInner.position.set(0.08, 0.023, 0.46);
    const templePlaza = new THREE.Mesh(
      new THREE.CircleGeometry(0.56, 28),
      new THREE.MeshStandardMaterial({ color: 0xbda173, roughness: 0.94, metalness: 0.01 }),
    );
    templePlaza.rotation.x = -Math.PI * 0.5;
    templePlaza.position.set(0.08, 0.024, 0.46);

    const terraceMat = new THREE.MeshStandardMaterial({ color: 0xaa7c52, roughness: 0.95, metalness: 0.02 });
    const terraceA = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.72), terraceMat);
    terraceA.position.set(-1.62, 0.08, 0.12);
    const terraceB = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.72), terraceMat);
    terraceB.position.set(1.74, 0.08, 0.22);

    const hutMat = new THREE.MeshStandardMaterial({ color: 0xbe8f61, roughness: 0.88, flatShading: true });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b4e2f, roughness: 0.82, flatShading: true });
    const sideHouseA = new THREE.Group();
    const sideA = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.34), hutMat);
    sideA.position.y = 0.24;
    const sideARoof = new THREE.Mesh(new THREE.ConeGeometry(0.33, 0.2, 4), roofMat);
    sideARoof.rotation.y = Math.PI * 0.25;
    sideARoof.position.y = 0.49;
    sideHouseA.add(sideA, sideARoof);
    sideHouseA.position.set(-2.38, 0.15, -0.86);

    const sideHouseB = sideHouseA.clone();
    sideHouseB.position.set(2.46, 0.14, -0.8);
    sideHouseB.scale.set(0.92, 0.92, 0.92);

    const workshopShed = new THREE.Group();
    const shedBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.34), hutMat);
    shedBase.position.y = 0.2;
    const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.44), roofMat);
    shedRoof.position.y = 0.37;
    workshopShed.add(shedBase, shedRoof);
    workshopShed.position.set(0.28, 0.11, 3.26);

    const amphoraMat = new THREE.MeshStandardMaterial({ color: 0xb57d4b, roughness: 0.9, flatShading: true });
    const amphoraA = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 8), amphoraMat);
    amphoraA.position.set(2.28, 0.08, 2.34);
    const amphoraB = amphoraA.clone();
    amphoraB.position.set(2.44, 0.08, 2.22);

    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x6d5134, roughness: 0.9 });
    const fence = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.08, 0.05), fenceMat);
    fence.position.set(-2.28, 0.13, 1.82);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x886743, roughness: 0.9, flatShading: true });

    const districtCluster = new THREE.Group();
    const addMiniBuilding = (id, x, z, scale = 0.58, rot = 0) => {
      const b = assets.createBuilding(id);
      b.position.set(x, 0, z);
      b.scale.set(scale, scale, scale);
      b.rotation.y = rot;
      districtCluster.add(b);
    };
    addMiniBuilding("houses", -2.9, -1.72, 0.52, 0.2);
    addMiniBuilding("houses", -2.74, -0.94, 0.48, -0.1);
    // Move decorative storehouse away from real storehouse slot to avoid overlap/confusion.
    addMiniBuilding("storehouse", -3.45, -2.86, 0.46, 0.12);
    addMiniBuilding("granary", 2.86, -1.62, 0.52, -0.2);
    addMiniBuilding("workshop", -2.96, 2.08, 0.5, 0.45);
    addMiniBuilding("market-square", 0.76, 2.92, 0.5, -0.15);
    addMiniBuilding("training-ground", -1.36, 3.42, 0.46, 0.2);

    const shrubMat = new THREE.MeshStandardMaterial({ color: 0x5f7f44, roughness: 0.95, flatShading: true });
    const shrubA = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), shrubMat);
    shrubA.position.set(-2.25, 0.1, 1.15);
    const shrubB = shrubA.clone();
    shrubB.position.set(1.95, 0.1, 1.95);
    const shrubC = shrubA.clone();
    shrubC.position.set(2.14, 0.1, -0.9);

    const outerZone = new THREE.Group();
    const fieldMat = new THREE.MeshStandardMaterial({ color: 0x8f7a45, roughness: 0.96, metalness: 0.01 });
    const cropMat = new THREE.MeshStandardMaterial({ color: 0xb49a4f, roughness: 0.95, flatShading: true });
    const fieldA = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 1.9), fieldMat);
    fieldA.position.set(-9.1, 0.038, 2.5);
    const fieldB = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.5), fieldMat);
    fieldB.position.set(-8.2, 0.038, 4.15);
    const furrowA = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.02, 0.08), cropMat);
    furrowA.position.set(-9.1, 0.08, 2.17);
    const furrowB = furrowA.clone();
    furrowB.position.z = 3.8;
    const furrowC = furrowA.clone();
    furrowC.position.z = 4.18;

    const minePad = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 1.8), new THREE.MeshStandardMaterial({ color: 0x786e5b, roughness: 0.94 }));
    minePad.position.set(-9.45, 0.04, -1.9);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x4b3b2a, roughness: 0.92 }));
    shaft.position.set(-9.5, 0.11, -1.85);
    const mineRockA = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.9, flatShading: true }));
    mineRockA.position.set(-8.95, 0.16, -1.55);
    const mineRockB = mineRockA.clone();
    mineRockB.position.set(-9.85, 0.14, -2.35);
    const cranePost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.1), new THREE.MeshStandardMaterial({ color: 0x6f5438, roughness: 0.9 }));
    cranePost.position.set(-10.15, 0.39, -2.07);
    const craneBeam = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x6f5438, roughness: 0.9 }));
    craneBeam.position.set(-9.82, 0.7, -2.07);

    const portPier = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 0.34), new THREE.MeshStandardMaterial({ color: 0x705236, roughness: 0.9 }));
    /** Decorative pier — same Z as Dock slot (−8.22, 7.78): east edge sits ~at shoreline so planks meet water. */
    const pierZ = 7.78;
    const pierOnWaterX = eastBankXZ(pierZ) - 0.58;
    portPier.position.set(pierOnWaterX, WATER_Y + 0.038, pierZ);
    portPier.rotation.y = Math.atan2(1, EAST_SLOPE_PER_Z) - 0.22;

    outerZone.add(
      fieldA,
      fieldB,
      furrowA,
      furrowB,
      furrowC,
      minePad,
      shaft,
      mineRockA,
      mineRockB,
      cranePost,
      craneBeam,
      portPier,
    );
    outerZone.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    civicProps.add(
      quarterA,
      quarterB,
      quarterC,
      quarterD,
      mainRoadNS,
      mainRoadEW,
      laneToDock,
      laneSouthWest,
      laneNorthWest,
      templeRingOuter,
      templeRingInner,
      templePlaza,
      terraceA,
      terraceB,
      districtCluster,
      sideHouseA,
      sideHouseB,
      workshopShed,
      amphoraA,
      amphoraB,
      fence,
      shrubA,
      shrubB,
      shrubC,
      crateA,
      crateB,
      cart,
      wheelA,
      wheelB,
    );
    civicProps.add(outerZone);
    civicProps.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    cityRoot.add(civicProps);

    const contactShadowTpl = new THREE.MeshBasicMaterial({
      color: 0x141008,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const contactShadowRoot = new THREE.Group();
    contactShadowRoot.renderOrder = -3;
    const contactBlob = (x, z, r) => {
      const blob = new THREE.Mesh(new THREE.CircleGeometry(r, 18), contactShadowTpl.clone());
      blob.rotation.x = -Math.PI * 0.5;
      blob.position.set(x, 0.017, z);
      contactShadowRoot.add(blob);
    };
    contactBlob(0.08, 0.46, 0.72);
    contactBlob(-2.55, -1.22, 0.52);
    contactBlob(2.82, -1.12, 0.52);
    contactBlob(-2.58, 2.02, 0.52);
    contactBlob(2.62, 2.15, 0.52);
    contactBlob(-9.1, 2.48, 0.62);
    contactBlob(-9.45, -1.92, 0.48);
    contactBlob(portPier.position.x + 0.2, portPier.position.z + 0.05, 0.38);
    contactShadowTpl.dispose();
    cityRoot.add(contactShadowRoot);
    const boundaryRoot = new THREE.Group();
    cityRoot.add(boundaryRoot);

    const treeGeo = new THREE.ConeGeometry(0.26, 0.7, 6);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x678a47, roughness: 0.9, flatShading: true });
    const treeInstances = new THREE.InstancedMesh(treeGeo, treeMat, CITY_DECOR_LIMITS.treeInstances);
    treeInstances.castShadow = true;
    treeInstances.receiveShadow = true;
    cityRoot.add(treeInstances);

    const rockGeo = new THREE.DodecahedronGeometry(0.11, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b7f67, roughness: 0.88, flatShading: true });
    const rockInstances = new THREE.InstancedMesh(rockGeo, rockMat, CITY_DECOR_LIMITS.rockInstances);
    rockInstances.castShadow = true;
    cityRoot.add(rockInstances);

    const atmosphereRoot = new THREE.Group();
    cityRoot.add(atmosphereRoot);
    const windReedsRoot = new THREE.Group();
    const smokeRoot = new THREE.Group();
    const glowRoot = new THREE.Group();
    const waterRippleRoot = new THREE.Group();
    atmosphereRoot.add(windReedsRoot, smokeRoot, glowRoot, waterRippleRoot);

    const reedActors = [];
    const smokeActors = [];
    const glowActors = [];
    const waterRippleActors = [];

    const sceneState = {
      cityNameKey: null,
      inspectMode: false,
      panelHoverBuildingId: null,
      mapHoverSlotId: null,
      builtById: new Map(),
      plannedById: new Map(),
      pendingById: new Map(),
      workerActors: [],
      workerAssignmentsFingerprint: null,
    };

    const WORKER_JOB_ORDER = ["fields", "mines", "temples", "market", "ports", "barracks"];

    const WORKER_SPOTS = {
      fields: [
        [-9.5, 2.2],
        [-8.8, 3.0],
        [-8.1, 3.9],
        [-9.0, 4.55],
      ],
      mines: [
        [-9.95, -2.2],
        [-9.35, -1.6],
        [-8.75, -2.05],
      ],
      temples: [
        [-0.35, 0.92],
        [0.48, 0.92],
      ],
      market: [
        [0.94, 3.38],
        [0.34, 3.62],
      ],
      ports: [
        [-8.55, 7.64],
        [-7.92, 7.98],
      ],
      barracks: [
        [-2.18, 4.42],
        [-1.48, 4.72],
      ],
    };

    const WORKER_JOB_ANCHORS = Object.fromEntries(
      Object.entries(WORKER_SPOTS).map(([id, pts]) => {
        const sx = pts.reduce((a, p) => a + p[0], 0);
        const sz = pts.reduce((a, p) => a + p[1], 0);
        const n = pts.length;
        return [id, [sx / n, sz / n]];
      }),
    );

    function syncRendererToMountSize() {
      const width = domMount.clientWidth || 10;
      const height = domMount.clientHeight || 10;
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const zoomScale = 7.3;
      camera.left = -zoomScale * aspect;
      camera.right = zoomScale * aspect;
      camera.top = zoomScale;
      camera.bottom = -zoomScale;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(() => {
      syncRendererToMountSize();
      draw();
      emitWorkerChipLayout();
    });
    resizeObserver.observe(domMount);

    function reparentMountTo(nextMount) {
      if (domMount === nextMount) return;
      resizeObserver.disconnect();
      domMount = nextMount;
      nextMount.prepend(renderer.domElement);
      resizeObserver.observe(domMount);
      syncRendererToMountSize();
      draw();
      emitWorkerChipLayout();
    }

    function seededRandom(seed) {
      let t = seed >>> 0;
      return () => {
        t += 0x6d2b79f5;
        let n = Math.imul(t ^ (t >>> 15), 1 | t);
        n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
        return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
      };
    }

    function seedFromCity(cityNameKey) {
      const text = String(cityNameKey || "city");
      let hash = 2166136261;
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }

    function populateAtmosphere(seed) {
      clearGroup(windReedsRoot);
      clearGroup(smokeRoot);
      clearGroup(glowRoot);
      clearGroup(waterRippleRoot);
      reedActors.length = 0;
      smokeActors.length = 0;
      glowActors.length = 0;
      waterRippleActors.length = 0;

      const rnd = seededRandom(seed ^ 0x9e3779b9);
      const reedMat = new THREE.MeshStandardMaterial({ color: 0x6f8f49, roughness: 0.95, flatShading: true });
      for (let i = 0; i < 22; i += 1) {
        const stem = new THREE.Mesh(new THREE.ConeGeometry(0.04 + rnd() * 0.03, 0.45 + rnd() * 0.36, 5), reedMat);
        stem.position.set(-8.6 - rnd() * 2.2, 0.21, 6.7 + rnd() * 3.6);
        stem.rotation.z = (rnd() - 0.5) * 0.2;
        stem.castShadow = true;
        windReedsRoot.add(stem);
        reedActors.push({ mesh: stem, phase: rnd() * Math.PI * 2, amp: 0.04 + rnd() * 0.06 });
      }

      const smokeMat = new THREE.MeshStandardMaterial({
        color: 0xb8b0a0,
        transparent: true,
        opacity: 0.33,
        roughness: 1,
        depthWrite: false,
      });
      const smokeSources = [[-2.38, -0.86], [2.46, -0.8], [0.28, 3.26]];
      smokeSources.forEach(([x, z], i) => {
        for (let k = 0; k < 3; k += 1) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(0.08 + rnd() * 0.05, 6, 6), smokeMat.clone());
          puff.position.set(x + (rnd() - 0.5) * 0.18, 0.62 + k * 0.12, z + (rnd() - 0.5) * 0.14);
          smokeRoot.add(puff);
          smokeActors.push({
            mesh: puff,
            baseX: puff.position.x,
            baseY: puff.position.y,
            baseZ: puff.position.z,
            phase: rnd() * Math.PI * 2 + i,
            drift: 0.015 + rnd() * 0.025,
          });
        }
      });

      for (let i = 0; i < 11; i += 1) {
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(0.03 + rnd() * 0.015, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffdd99, transparent: true, opacity: 0.45 + rnd() * 0.35, depthWrite: false }),
        );
        glow.position.set(-5 + rnd() * 10, 0.35 + rnd() * 0.5, -0.2 + rnd() * 5.6);
        glowRoot.add(glow);
        glowActors.push({
          mesh: glow,
          baseX: glow.position.x,
          baseY: glow.position.y,
          baseZ: glow.position.z,
          phase: rnd() * Math.PI * 2,
          radius: 0.08 + rnd() * 0.18,
        });
      }

      const rippleMat = new THREE.MeshBasicMaterial({ color: 0xb8dae4, transparent: true, opacity: 0.2, depthWrite: false });
      for (let i = 0; i < 6; i += 1) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.21, 18), rippleMat.clone());
        ring.rotation.x = -Math.PI * 0.5;
        const rippleZSpan = Math.max(WATER_Z_CLIP_MAX - WATER_Z_CLIP_MIN - 4, 1);
        const rippleZ = WATER_Z_CLIP_MIN + 2.1 + rnd() * rippleZSpan;
        ring.position.set(-13.85 + rnd() * 3.05, WATER_Y + 0.0018, rippleZ);
        waterRippleRoot.add(ring);
        waterRippleActors.push({ mesh: ring, phase: rnd() * Math.PI * 2, speed: 0.55 + rnd() * 0.45 });
      }
    }

    function populateDecor(seed) {
      const rnd = seededRandom(seed);
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < CITY_DECOR_LIMITS.treeInstances; i += 1) {
        const x = -11 + rnd() * 22;
        const z = -8.4 + rnd() * 14;
        const avoidCityCore = Math.abs(x) < 2.3 && Math.abs(z) < 2.2;
        const y = 0.34;
        if (avoidCityCore || (x > 8.6 && z < 2)) {
          matrix.makeScale(0.001, 0.001, 0.001);
          treeInstances.setMatrixAt(i, matrix);
          continue;
        }
        const s = 0.8 + rnd() * 1.2;
        matrix.compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * Math.PI * 2, 0)),
          new THREE.Vector3(s, s, s),
        );
        treeInstances.setMatrixAt(i, matrix);
      }
      treeInstances.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < CITY_DECOR_LIMITS.rockInstances; i += 1) {
        const x = -9 + rnd() * 19;
        const z = -2 + rnd() * 8.5;
        const y = 0.08;
        const s = 0.6 + rnd() * 0.8;
        matrix.compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd(), rnd())),
          new THREE.Vector3(s, s * 0.8, s),
        );
        rockInstances.setMatrixAt(i, matrix);
      }
      rockInstances.instanceMatrix.needsUpdate = true;
    }

    function removeModel(model) {
      if (!model) return;
      model.parent?.remove(model);
      model.traverse((node) => {
        if (node.isMesh) {
          node.geometry?.dispose?.();
        }
      });
    }

    function clearGroup(group) {
      while (group.children.length) {
        const child = group.children.pop();
        child.traverse?.((node) => {
          if (node.isMesh) {
            node.geometry?.dispose?.();
            if (Array.isArray(node.material)) {
              node.material.forEach((m) => m?.dispose?.());
            } else {
              node.material?.dispose?.();
            }
          }
        });
      }
    }

    function createWorkerActor(jobId, x, z, variant = 0) {
      const skin = new THREE.MeshStandardMaterial({ color: 0xd4a272, roughness: 0.88, flatShading: true });
      const clothByJob = {
        fields: 0xb79a4f,
        mines: 0x7a766f,
        temples: 0xc4b191,
        market: 0xb65e3f,
        ports: 0x5f7693,
        barracks: 0x7b4f42,
      };
      const cloth = new THREE.MeshStandardMaterial({ color: clothByJob[jobId] || 0xa6764d, roughness: 0.9, flatShading: true });
      const toolMat = new THREE.MeshStandardMaterial({ color: 0x5f462b, roughness: 0.88, flatShading: true });

      const g = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.09), cloth);
      torso.position.y = 0.24;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), skin);
      head.position.y = 0.39;
      torso.userData._baseRot = { x: torso.rotation.x, y: torso.rotation.y, z: torso.rotation.z };
      head.userData._baseRot = { x: head.rotation.x, y: head.rotation.y, z: head.rotation.z };
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), skin);
      const armR = armL.clone();
      armL.position.set(-0.11, 0.25, 0);
      armR.position.set(0.11, 0.25, 0);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.06), cloth);
      const legR = legL.clone();
      legL.position.set(-0.04, 0.08, 0);
      legR.position.set(0.04, 0.08, 0);
      g.add(torso, head, armL, armR, legL, legR);

      const tool = new THREE.Group();
      if (jobId === "fields" || jobId === "ports") {
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04), toolMat);
        shaft.position.y = 0.2;
        const headTool = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.05), toolMat);
        headTool.position.set(0.04, 0.36, 0);
        tool.add(shaft, headTool);
      } else if (jobId === "mines") {
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.33, 0.04), toolMat);
        shaft.position.y = 0.2;
        const pick = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.05), toolMat);
        pick.position.y = 0.34;
        tool.add(shaft, pick);
      } else if (jobId === "barracks") {
        const spear = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.03), toolMat);
        spear.position.y = 0.24;
        tool.add(spear);
      } else {
        const scroll = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.06), toolMat);
        scroll.position.y = 0.23;
        tool.add(scroll);
      }
      tool.position.set(0.15, 0.14, 0.03);
      g.add(tool);

      g.position.set(x, 0.02, z);
      g.rotation.y = ((variant * 0.7) % 1) * Math.PI * 2;
      const baseRotationY = g.rotation.y;
      g.userData = {
        jobId,
        baseY: g.position.y,
        baseRotationY,
        phase: variant * 1.17 + x * 0.25 - z * 0.19,
        speed: jobId === "mines" ? 3.8 : jobId === "barracks" ? 2.7 : jobId === "temples" ? 1.4 : jobId === "market" ? 2.95 : jobId === "ports" ? 2.05 : 2.3,
        armL,
        armR,
        legL,
        legR,
        tool,
        torso,
        head,
      };
      return g;
    }

    function syncWorkers(assignments) {
      const fingerprint = WORKER_JOB_ORDER.map((id) =>
        String(Math.max(0, Math.floor(assignments?.[id] || 0))),
      ).join("|");
      if (sceneState.workerAssignmentsFingerprint === fingerprint) return;
      sceneState.workerAssignmentsFingerprint = fingerprint;
      clearGroup(workersRoot);
      sceneState.workerActors = [];
      WORKER_JOB_ORDER.forEach((jobId) => {
        const count = Math.max(0, Math.floor(assignments?.[jobId] || 0));
        if (!count) return;
        const spots = WORKER_SPOTS[jobId] || [[0, 0]];
        for (let i = 0; i < count; i += 1) {
          const base = spots[i % spots.length];
          const lane = Math.floor(i / spots.length);
          const jitterX = lane * 0.16 * ((i % 2) ? 1 : -1);
          const jitterZ = lane * 0.14 * ((i % 3) ? -1 : 1);
          const actor = createWorkerActor(jobId, base[0] + jitterX, base[1] + jitterZ, i);
          workersRoot.add(actor);
          sceneState.workerActors.push(actor);
        }
      });
    }

    const __chipProjVec = new THREE.Vector3();

    function clamp01ish(x, margin = 0.05) {
      return Math.min(1 + margin, Math.max(-margin, x));
    }

    function getWorkerChipLayout() {
      applyView();
      cityRoot.updateMatrixWorld(true);
      const out = {};
      Object.entries(WORKER_JOB_ANCHORS).forEach(([jobId, coords]) => {
        __chipProjVec.set(coords[0], 0.28, coords[1]);
        __chipProjVec.applyMatrix4(cityRoot.matrixWorld);
        __chipProjVec.project(camera);
        out[jobId] = {
          left: clamp01ish(__chipProjVec.x * 0.5 + 0.5) * 100,
          top: clamp01ish(-__chipProjVec.y * 0.5 + 0.5) * 100,
        };
      });
      return out;
    }

    let notifyWorkerChipLayout = null;

    function emitWorkerChipLayout() {
      if (!notifyWorkerChipLayout) return;
      requestAnimationFrame(() => notifyWorkerChipLayout?.(getWorkerChipLayout()));
    }

    function rb(node) {
      return node?.userData?._baseRot;
    }

    function resetWorkerPose(actor) {
      const u = actor.userData;
      actor.rotation.y = u.baseRotationY ?? 0;
      actor.position.y = u.baseY;
      u.armL.rotation.set(0, 0, 0);
      u.armR.rotation.set(0, 0, 0);
      const br = rb(u.head);
      if (br && u.head) {
        u.head.rotation.x = br.x;
        u.head.rotation.y = br.y;
        u.head.rotation.z = br.z;
      }
      const tr = rb(u.torso);
      if (tr && u.torso) {
        u.torso.rotation.x = tr.x;
        u.torso.rotation.y = tr.y;
        u.torso.rotation.z = tr.z;
      }
      u.legL.rotation.set(0, 0, 0);
      u.legR.rotation.set(0, 0, 0);
      u.tool.rotation.set(0, 0, 0);
    }

    function animateEnvironment(timeSec) {
      if (globalThis.uiState.reduceMotion) {
        treeInstances.rotation.y = 0;
        grass.material.color.setRGB(1, 1, 1);
        river.material.roughness = 0.2;
        {
          const bz = river.userData?.waterRippleZBase ?? river.position.z;
          river.position.z = bz;
        }
        sun.intensity = 1.14;
        ambient.intensity = 0.52;
        hemi.intensity = 0.125;
        return;
      }
      const wind = Math.sin(timeSec * 0.32);
      treeInstances.rotation.y = wind * 0.03;
      if (grass.userData.hasGrassVertexColors) {
        grass.material.color.setRGB(
          0.97 + Math.sin(timeSec * 0.1) * 0.022,
          0.995 + Math.sin(timeSec * 0.11) * 0.015,
          0.96 + Math.cos(timeSec * 0.12) * 0.022,
        );
      } else {
        grass.material.color.setHSL(0.272 + Math.sin(timeSec * 0.1) * 0.004, 0.3, 0.4);
      }

      river.material.roughness = 0.14 + Math.abs(Math.sin(timeSec * 1.3)) * 0.12;
      {
        const bz = river.userData?.waterRippleZBase ?? river.position.z;
        river.position.z = bz + Math.sin(timeSec * 0.85) * 0.038;
      }

      reedActors.forEach((a) => {
        a.mesh.rotation.x = Math.sin(timeSec * 1.9 + a.phase) * a.amp;
        a.mesh.rotation.z = Math.sin(timeSec * 1.4 + a.phase) * (a.amp * 0.8);
      });

      smokeActors.forEach((a) => {
        const w = timeSec * 0.9 + a.phase;
        a.mesh.position.y = a.baseY + (Math.sin(w) + 1) * 0.06;
        a.mesh.position.x = a.baseX + Math.sin(w * 0.5) * a.drift * 1.4;
        a.mesh.position.z = a.baseZ + Math.cos(w * 0.6) * a.drift * 0.9;
        a.mesh.material.opacity = 0.18 + Math.abs(Math.cos(w)) * 0.17;
      });

      glowActors.forEach((a) => {
        const w = timeSec * 1.7 + a.phase;
        a.mesh.position.y = a.baseY + Math.sin(w) * 0.07;
        a.mesh.position.x = a.baseX + Math.cos(w * 0.6) * a.radius;
        a.mesh.position.z = a.baseZ + Math.sin(w * 0.7) * a.radius * 0.75;
        a.mesh.material.opacity = 0.18 + Math.abs(Math.sin(w * 1.8)) * 0.42;
      });

      waterRippleActors.forEach((a) => {
        const w = timeSec * a.speed + a.phase;
        const sc = 0.8 + ((Math.sin(w) + 1) * 0.5) * 1.35;
        a.mesh.scale.set(sc, sc, sc);
        a.mesh.material.opacity = 0.06 + (1 - (sc - 0.8) / 1.35) * 0.14;
      });

      sun.intensity = 1.11 + Math.sin(timeSec * 0.22) * 0.07;
      ambient.intensity = 0.5 + Math.sin(timeSec * 0.27 + 0.8) * 0.04;
      hemi.intensity = 0.118 + Math.sin(timeSec * 0.18 + 0.4) * 0.028;
    }

    function animateWorkers(timeSec) {
      sceneState.workerActors.forEach((actor) => {
        const u = actor.userData;
        if (!u) return;
        const cycle = timeSec * u.speed + u.phase;
        resetWorkerPose(actor);
        switch (u.jobId) {
          case "fields": {
            const swing = Math.sin(cycle * 2) * 0.72;
            actor.position.y = u.baseY + Math.abs(Math.sin(cycle * 0.5)) * 0.028;
            u.armR.rotation.x = -swing;
            u.armL.rotation.x = swing * 0.55;
            u.legL.rotation.x = swing * 0.15;
            u.legR.rotation.x = -swing * 0.14;
            u.tool.rotation.z = swing * 0.5;
            u.tool.rotation.x = Math.sin(cycle * 2) * 0.25;
            break;
          }
          case "mines": {
            const strike = (Math.sin(cycle * 2.4 + 1.4) + 1) * 0.45;
            actor.position.y = u.baseY + strike * 0.05;
            u.armR.rotation.x = -0.92 - strike * 1.05;
            u.armL.rotation.x = strike * 0.42;
            u.torso.rotation.x = rb(u.torso) ? rb(u.torso).x - strike * 0.08 : -strike * 0.08;
            u.tool.rotation.z = strike * -0.5;
            u.legL.rotation.x = strike * 0.2;
            u.legR.rotation.x = -strike * 0.16;
            break;
          }
          case "temples": {
            const slow = cycle * 0.8;
            const sway = Math.sin(slow) * 0.12;
            u.torso.rotation.z = sway;
            const br = rb(u.head);
            if (u.head && br) {
              u.head.rotation.x = br.x + Math.sin(slow * 0.5) * 0.08;
              u.head.rotation.y = br.y + Math.sin(slow + 2) * 0.06;
            }
            u.armL.rotation.z = sway * -1.8;
            u.armR.rotation.z = sway * 1.55;
            u.armR.rotation.x = -0.06 - Math.abs(Math.cos(slow * 2)) * 0.06;
            u.armL.rotation.x = Math.abs(Math.cos(slow * 2 + 1)) * 0.06;
            break;
          }
          case "market": {
            const walk = cycle * 3.15;
            u.torso.rotation.y = Math.sin(walk * 2) * 0.06;
            u.legL.rotation.x = Math.sin(walk) * 0.35;
            u.legR.rotation.x = Math.sin(walk + Math.PI) * 0.35;
            actor.position.y = u.baseY + Math.abs(Math.cos(walk * 2)) * 0.012;
            u.armL.rotation.x = -Math.sin(walk) * 0.25;
            u.armR.rotation.x = Math.sin(walk + 0.3) * 0.2;
            u.armL.rotation.z = Math.sin(walk + 2) * 0.08;
            u.armR.rotation.z = Math.sin(walk + 1) * 0.06;
            break;
          }
          case "ports": {
            const pull = cycle * 1.5;
            const grunt = Math.sin(pull + u.phase * 3);
            u.torso.rotation.z = grunt * -0.1;
            u.torso.rotation.x = grunt * -0.04;
            u.armR.rotation.x = grunt * -0.6;
            u.armR.rotation.z = grunt * -0.25;
            u.armL.rotation.x = grunt * 0.72;
            u.armL.rotation.z = grunt * -0.1;
            u.legR.rotation.z = grunt * -0.12;
            u.legL.rotation.z = grunt * 0.1;
            u.tool.rotation.x = Math.sin(cycle * 2) * 0.42;
            u.tool.rotation.y = grunt * -0.2;
            break;
          }
          case "barracks": {
            const thrust = Math.sin(cycle * 3.2 + 0.55);
            const wide = thrust * 0.6;
            actor.position.y = u.baseY + (thrust > 0 ? thrust * 0.016 : 0);
            actor.rotation.y = (u.baseRotationY ?? 0) + wide * -0.04;
            u.armR.rotation.x = thrust > 0.2 ? thrust * -0.55 : 0.06;
            u.armL.rotation.x = thrust > 0.2 ? -thrust * 0.42 : -0.1;
            u.torso.rotation.y = thrust * 0.18;
            u.tool.rotation.x = thrust * -1.08;
            u.tool.rotation.z = thrust > 0.3 ? thrust * -0.28 : thrust * -0.1;
            const step = thrust * -0.2;
            u.legL.rotation.x = step;
            u.legR.rotation.x = -step * 1.07;
            break;
          }
          default: {
            const swing = Math.sin(cycle) * 0.6;
            u.armL.rotation.x = -swing;
            u.armR.rotation.x = swing;
          }
        }
      });
    }

    function rebuildDynamicBoundary(builtSet) {
      clearGroup(boundaryRoot);
      const envelope = computeStaticCityEnvelope();
      let minX = envelope.minX;
      let maxX = envelope.maxX;
      let minZ = envelope.minZ;
      let maxZ = envelope.maxZ;
      const buildingFootprint = CITY_BOUNDARY_PADDING.building;
      SLOT_LAYOUT_3D.forEach((slot) => {
        if (!builtSet.has(slot.id) || !affectsCityBoundary(slot.id)) return;
        minX = Math.min(minX, slot.x - buildingFootprint);
        maxX = Math.max(maxX, slot.x + buildingFootprint);
        minZ = Math.min(minZ, slot.z - buildingFootprint);
        maxZ = Math.max(maxZ, slot.z + buildingFootprint);
      });
      const growthInset = Math.min(1.05, builtSet.size * 0.1);
      const padEdge = CITY_BOUNDARY_PADDING.wall + growthInset;
      minX -= padEdge;
      maxX += padEdge;
      minZ -= padEdge;
      maxZ += padEdge;
      const width = maxX - minX;
      const depth = maxZ - minZ;
      const centerX = (minX + maxX) * 0.5;
      const centerZ = (minZ + maxZ) * 0.5;
      const wallH = 0.14;
      const wallT = 0.12;
      const gateWidth = Math.max(0.82, Math.min(1.34, 0.9 + builtSet.size * 0.06));

      const north = new THREE.Mesh(new THREE.BoxGeometry(width, wallH, wallT), wallMat);
      north.position.set(centerX, 0.13, minZ);
      const south = new THREE.Mesh(new THREE.BoxGeometry(width, wallH, wallT), wallMat);
      south.position.set(centerX, 0.13, maxZ);
      const west = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, depth), wallMat);
      west.position.set(minX, 0.13, centerZ);

      const eastTopDepth = Math.max(0.3, depth * 0.5 - gateWidth * 0.5);
      const eastBottomDepth = Math.max(0.3, depth * 0.5 - gateWidth * 0.5);
      const eastTop = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, eastTopDepth), wallMat);
      eastTop.position.set(maxX, 0.13, centerZ - (gateWidth + eastTopDepth) * 0.5);
      const eastBottom = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, eastBottomDepth), wallMat);
      eastBottom.position.set(maxX, 0.13, centerZ + (gateWidth + eastBottomDepth) * 0.5);
      const gate = new THREE.Mesh(new THREE.BoxGeometry(gateWidth, 0.18, 0.16), wallMat);
      gate.rotation.y = Math.PI * 0.5;
      gate.position.set(maxX, 0.14, centerZ);

      const postMat = new THREE.MeshStandardMaterial({ color: 0x785a39, roughness: 0.9, flatShading: true });
      const postGeo = new THREE.BoxGeometry(0.16, 0.22, 0.16);
      const corners = [
        [minX, minZ],
        [maxX, minZ],
        [minX, maxZ],
        [maxX, maxZ],
      ];
      corners.forEach(([x, z]) => {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0.16, z);
        boundaryRoot.add(post);
      });

      boundaryRoot.add(north, south, west, eastTop, eastBottom, gate);
      boundaryRoot.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
    }

    function createPlannedGhost(slotId, backlog) {
      const group = new THREE.Group();
      const ringMat = new THREE.MeshBasicMaterial({
        color: backlog ? 0xd4a068 : 0xe8c98e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: backlog ? 0.58 : 0.62,
        depthWrite: true,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.64, 20), ringMat);
      ring.rotation.x = -Math.PI * 0.5;
      ring.position.y = 0.03;
      group.add(ring);
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.48, 0.08, 10),
        new THREE.MeshStandardMaterial({
          color: 0x8d744c,
          roughness: 0.92,
          transparent: true,
          opacity: 0.33,
        }),
      );
      pad.position.y = 0.05;
      group.add(pad);
      group.scale.setScalar(BUILT_SLOT_MODEL_SCALE);
      group.userData.pickSlotId = slotId;
      return group;
    }

    function makeTurnsBadgeSprite(turnsLeft) {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 112;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(34, 22, 11, 0.88)";
      ctx.strokeStyle = "rgba(244, 210, 140, 0.95)";
      ctx.lineWidth = 4;
      const r = 20;
      ctx.beginPath();
      ctx.moveTo(r, 8);
      ctx.lineTo(canvas.width - r, 8);
      ctx.quadraticCurveTo(canvas.width - 8, 8, canvas.width - 8, r);
      ctx.lineTo(canvas.width - 8, canvas.height - r);
      ctx.quadraticCurveTo(canvas.width - 8, canvas.height - 8, canvas.width - r, canvas.height - 8);
      ctx.lineTo(r, canvas.height - 8);
      ctx.quadraticCurveTo(8, canvas.height - 8, 8, canvas.height - r);
      ctx.lineTo(8, r);
      ctx.quadraticCurveTo(8, 8, r, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fbe6b5";
      ctx.font = "700 42px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const turns = Math.max(1, Math.floor(Number(turnsLeft) || 0));
      ctx.fillText(`${turns}t`, canvas.width * 0.5, canvas.height * 0.54);

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.16, 0.42, 1);
      sprite.position.set(0, 1.2, 0);
      return sprite;
    }

    function addConstructionSite(slotId, slotX, slotZ, turnsLeft) {
      const g = new THREE.Group();
      g.userData.pickSlotId = slotId;
      const wood = new THREE.MeshStandardMaterial({ color: 0x8b6920, roughness: 0.9, flatShading: true });
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.1), wood);
      leg.position.set(-0.2, 0.38, 0);
      const leg2 = leg.clone();
      leg2.position.x = 0.2;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.09), wood);
      beam.position.set(0, 0.7, 0);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.62), wood);
      base.position.y = 0.04;
      g.add(base, leg, leg2, beam);
      const preview = assets.createBuilding(slotId);
      preview.position.y = 0.02;
      preview.scale.setScalar(BUILT_SLOT_MODEL_SCALE * 0.96);
      preview.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        node.material = node.material.clone();
        node.material.transparent = true;
        node.material.opacity = 0.52;
      });
      g.add(preview);
      const badge = makeTurnsBadgeSprite(turnsLeft);
      if (badge) g.add(badge);
      g.position.set(slotX, 0, slotZ);
      constructionRoot.add(g);
    }

    function addBuildingForSlot(slotId, slotX, slotZ) {
      if (sceneState.builtById.has(slotId) || sceneState.pendingById.has(slotId)) return;
      const token = Symbol(slotId);
      sceneState.pendingById.set(slotId, token);
      assets.createBuildingAsync(slotId).then((model) => {
        if (sceneState.pendingById.get(slotId) !== token) return;
        sceneState.pendingById.delete(slotId);
        if (sceneState.builtById.has(slotId)) return;
        model.position.set(slotX, 0, slotZ);
        model.scale.set(BUILT_SLOT_MODEL_SCALE, BUILT_SLOT_MODEL_SCALE, BUILT_SLOT_MODEL_SCALE);
        model.userData.pickSlotId = slotId;
        builtRoot.add(model);
        sceneState.builtById.set(slotId, model);
        draw();
      });
    }

    function syncCity(city) {
      if (!city) return;
      if (sceneState.cityNameKey !== city.nameKey) {
        sceneState.cityNameKey = city.nameKey;
        const citySeed = seedFromCity(city.nameKey);
        populateDecor(citySeed);
        populateAtmosphere(citySeed ^ 0xa51f9f);
      }

      const builtSet = new Set(city.buildings || []);
      const queue = Array.isArray(city.buildQueue) ? city.buildQueue : [];
      rebuildDynamicBoundary(builtSet);

      sceneState.builtById.forEach((model, id) => {
        if (!builtSet.has(id)) {
          removeModel(model);
          sceneState.builtById.delete(id);
        }
      });
      clearGroup(plannedRoot);
      clearGroup(constructionRoot);
      sceneState.plannedById.clear();
      sceneState.pendingById.forEach((_, id) => {
        if (!builtSet.has(id)) sceneState.pendingById.delete(id);
      });

      SLOT_LAYOUT_3D.forEach((slot) => {
        if (builtSet.has(slot.id) && !sceneState.builtById.has(slot.id) && !sceneState.pendingById.has(slot.id)) {
          addBuildingForSlot(slot.id, slot.x, slot.z);
        }

        if (builtSet.has(slot.id)) return;

        const queueIndex = queue.findIndex((job) => job.buildingId === slot.id);

        if (queueIndex === 0) {
          addConstructionSite(slot.id, slot.x, slot.z, queue[0]?.turnsLeft);
          return;
        }

        const plannedModel = createPlannedGhost(slot.id, queueIndex > 0);
        plannedModel.position.set(slot.x, 0, slot.z);
        plannedRoot.add(plannedModel);
        sceneState.plannedById.set(slot.id, plannedModel);
      });

      slotMarkers.forEach((marker, id) => {
        marker.visible = !builtSet.has(id);
      });
      syncWorkers(city.assignments || {});
    }

    const raycaster = new THREE.Raycaster();
    let slotPickHandler = null;
    let dragSession = null;
    let hoverRaf = null;
    let pendingHoverX = 0;
    let pendingHoverY = 0;

    function findPickSlotId(mesh) {
      let o = mesh;
      while (o) {
        if (o.userData?.pickSlotId) return o.userData.pickSlotId;
        o = o.parent;
      }
      return null;
    }

    function pickSlotFromXY(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      let hits = raycaster.intersectObjects([pickZonesRoot], true);
      if (!hits.length) {
        hits = raycaster.intersectObjects([cityRoot], true);
      }
      for (let i = 0; i < hits.length; i += 1) {
        const id = findPickSlotId(hits[i].object);
        if (id) return id;
      }
      return null;
    }

    function tryPickSlot(clientX, clientY) {
      if (typeof slotPickHandler !== "function") return;
      const id = pickSlotFromXY(clientX, clientY);
      if (id) slotPickHandler(id);
    }

    function effectiveAccentBuildingId() {
      return sceneState.panelHoverBuildingId || sceneState.mapHoverSlotId || null;
    }

    function refreshAccentSlotVisuals() {
      const accent = effectiveAccentBuildingId();

      slotMarkers.forEach((slotMesh, slotId) => {
        const isHot = slotId === accent;
        slotMesh.material.opacity = isHot ? 0.95 : 0.22;
        slotMesh.material.color.setHex(isHot ? 0xfff2c6 : 0xb89a62);
      });

      cityCore.scale.set(0.56, 0.56, 0.56);

      sceneState.builtById.forEach((mesh, slotId) => {
        const active = slotId === accent;
        mesh.scale.setScalar(active ? BUILT_SLOT_MODEL_SCALE_HIGHLIGHT : BUILT_SLOT_MODEL_SCALE);
      });
      sceneState.plannedById.forEach((mesh, slotId) => {
        const active = slotId === accent;
        mesh.scale.setScalar(active ? BUILT_SLOT_MODEL_SCALE * 1.12 : BUILT_SLOT_MODEL_SCALE);
      });
      constructionRoot.children.forEach((node) => {
        const id = node.userData?.pickSlotId;
        if (!id) return;
        const active = id === accent;
        node.scale.setScalar(active ? 1.08 : 1);
      });
      draw();
    }

    function setHighlightedBuilding(buildingId) {
      sceneState.panelHoverBuildingId = buildingId || null;
      refreshAccentSlotVisuals();
    }

    function flushMapHoverProbe() {
      hoverRaf = null;
      if (!sceneState.inspectMode) return;
      if (dragSession?.moved) return;
      const id = pickSlotFromXY(pendingHoverX, pendingHoverY);
      if (sceneState.mapHoverSlotId === id) {
        renderer.domElement.style.cursor = id ? "pointer" : "grab";
        return;
      }
      sceneState.mapHoverSlotId = id;
      renderer.domElement.style.cursor = id ? "pointer" : "grab";
      refreshAccentSlotVisuals();
    }

    function scheduleMapHoverProbe(clientX, clientY) {
      if (!sceneState.inspectMode) return;
      pendingHoverX = clientX;
      pendingHoverY = clientY;
      if (hoverRaf !== null) return;
      hoverRaf = requestAnimationFrame(flushMapHoverProbe);
    }

    function onCanvasPointerDown(event) {
      if (event.button !== 0 || !sceneState.inspectMode) return;
      dragSession = {
        x: event.clientX,
        y: event.clientY,
        panX: globalThis.uiState.cityScenePan?.x || 0,
        panY: globalThis.uiState.cityScenePan?.y || 0,
        moved: false,
      };
      renderer.domElement.setPointerCapture?.(event.pointerId);
    }

    function onCanvasPointerMove(event) {
      scheduleMapHoverProbe(event.clientX, event.clientY);
      if (!dragSession) return;
      const dx = event.clientX - dragSession.x;
      const dy = event.clientY - dragSession.y;
      if (!dragSession.moved && Math.hypot(dx, dy) > 6) {
        dragSession.moved = true;
        renderer.domElement.classList.add("dragging");
        if (sceneState.mapHoverSlotId) {
          sceneState.mapHoverSlotId = null;
          refreshAccentSlotVisuals();
        }
      }
      if (dragSession.moved) {
        const nextX = clamp(dragSession.panX + dx, -420, 420);
        const nextY = clamp(dragSession.panY + dy, -300, 300);
        globalThis.uiState.cityScenePan = { x: nextX, y: nextY };
        draw();
      }
    }

    function onCanvasPointerUp(event) {
      if (!dragSession) return;
      if (!dragSession.moved) {
        tryPickSlot(event.clientX, event.clientY);
      }
      dragSession = null;
      renderer.domElement.classList.remove("dragging");
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      refreshAccentSlotVisuals();
    }

    function onCanvasPointerLeave() {
      if (hoverRaf !== null) {
        cancelAnimationFrame(hoverRaf);
        hoverRaf = null;
      }
      if (sceneState.mapHoverSlotId) {
        sceneState.mapHoverSlotId = null;
        refreshAccentSlotVisuals();
      }
      if (sceneState.inspectMode) renderer.domElement.style.cursor = "grab";
    }

    renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown);
    renderer.domElement.addEventListener("pointermove", onCanvasPointerMove);
    renderer.domElement.addEventListener("pointerup", onCanvasPointerUp);
    renderer.domElement.addEventListener("pointercancel", onCanvasPointerUp);
    renderer.domElement.addEventListener("pointerleave", onCanvasPointerLeave);

    function applyView() {
      const panX = globalThis.uiState.cityScenePan?.x || 0;
      const panY = globalThis.uiState.cityScenePan?.y || 0;
      const zoom = globalThis.uiState.citySceneZoom || 1;
      cityRoot.position.x = panX * 0.018;
      cityRoot.position.z = panY * 0.018;
      camera.zoom = clamp(1 / zoom, 0.66, 1.9);
      camera.updateProjectionMatrix();
    }

    function draw() {
      applyView();
      renderer.render(scene, camera);
    }

    const animClock = new THREE.Clock();
    let animationFrameId = 0;
    function animateFrame() {
      animationFrameId = requestAnimationFrame(animateFrame);
      const t = animClock.getElapsedTime();
      animateEnvironment(t);
      animateWorkers(t);
      draw();
    }
    animateFrame();

    function sync(payload) {
      sceneState.inspectMode = Boolean(payload.inspectMode);
      slotPickHandler = typeof payload.onSlotPicked === "function" ? payload.onSlotPicked : null;
      sceneState.panelHoverBuildingId = payload.highlightedBuildingId || null;
      if ("onWorkerChipLayout" in payload) {
        notifyWorkerChipLayout =
          typeof payload.onWorkerChipLayout === "function" ? payload.onWorkerChipLayout : null;
      }
      if (!sceneState.inspectMode) {
        sceneState.mapHoverSlotId = null;
        renderer.domElement.style.cursor = "";
      } else {
        renderer.domElement.style.cursor = "grab";
      }
      syncCity(payload.city);
      refreshAccentSlotVisuals();
      emitWorkerChipLayout();
    }

    function destroy() {
      runtimeByCityKey.delete(runtimeCityKey);
      notifyWorkerChipLayout = null;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      if (hoverRaf !== null) {
        cancelAnimationFrame(hoverRaf);
        hoverRaf = null;
      }
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onCanvasPointerDown);
      renderer.domElement.removeEventListener("pointermove", onCanvasPointerMove);
      renderer.domElement.removeEventListener("pointerup", onCanvasPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onCanvasPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onCanvasPointerLeave);
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((node) => {
        if (node.isMesh) {
          node.geometry?.dispose?.();
          if (Array.isArray(node.material)) {
            node.material.forEach((m) => m?.dispose?.());
          } else {
            node.material?.dispose?.();
          }
        }
      });
    }

    return {
      sync,
      destroy,
      setHighlightedBuilding,
      getWorkerChipLayout,
      reparentMountTo,
      getDomMount: () => domMount,
      citySceneKey: runtimeCityKey,
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mountOrSync(mountNode, payload) {
    if (!canUseWebGL()) return false;
    const ck = payload?.city?.nameKey ?? "_";
    let runtime = runtimeByCityKey.get(ck);
    if (!runtime) {
      runtime = createRuntime(mountNode, ck);
      runtimeByCityKey.set(ck, runtime);
    } else if (runtime.getDomMount?.() !== mountNode) {
      runtime.reparentMountTo?.(mountNode);
    }
    runtime.sync(payload);
    mountNode.__cityScene3dRuntime = runtime;
    runtimeByMount.set(mountNode, runtime);
    return true;
  }

  function setHoveredBuilding(mountNode, buildingId) {
    const runtime = mountNode?.__cityScene3dRuntime || runtimeByMount.get(mountNode);
    runtime?.setHighlightedBuilding(buildingId);
  }

  function getWorkerChipLayoutForMount(mountNode) {
    const r = mountNode?.__cityScene3dRuntime || runtimeByMount.get(mountNode);
    return r?.getWorkerChipLayout?.() ?? null;
  }

  window.CityScene3D = {
    isSupported: canUseWebGL,
    mountOrSync,
    setHoveredBuilding,
    getWorkerChipLayout: getWorkerChipLayoutForMount,
    getDiagnostics: () => {
      const threePresent = typeof window.THREE !== "undefined";
      const registryPresent = typeof window.createCityAssetRegistry === "function";
      let webgl = false;
      try {
        const canvas = document.createElement("canvas");
        webgl = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
      } catch (_) {
        webgl = false;
      }
      return {
        threePresent,
        registryPresent,
        webgl,
        supported: canUseWebGL(),
        bootstrapStarted: threeBootstrapState.started,
        protocol: window.location?.protocol || "unknown",
      };
    },
  };
})();

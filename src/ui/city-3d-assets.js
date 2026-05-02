function createCityAssetRegistry(THREE) {
  const makeMaterial = (color) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: true,
    });

  const palette = {
    adobe: makeMaterial(0xc09162),
    straw: makeMaterial(0xb8955c),
    stone: makeMaterial(0x9f9687),
    roof: makeMaterial(0x9f5734),
    darkRoof: makeMaterial(0x72492f),
    wood: makeMaterial(0x705236),
    accent: makeMaterial(0xd6a45a),
    grass: makeMaterial(0x6f9350),
    cloth: makeMaterial(0xb65e3f),
  };

  const makePlinth = (w, h, d, material = makeMaterial(0xa58762)) => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMaterial(0xa58762));
    mesh.position.y = h * 0.5;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  };

  const addColumn = (group, x, z, h = 0.55) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, h, 8), palette.stone);
    col.position.set(x, h * 0.5 + 0.28, z);
    group.add(col);
  };

  const addTorch = (group, x, z) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), palette.wood);
    post.position.set(x, 0.45, z);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), palette.accent);
    flame.position.set(x, 0.71, z);
    group.add(post, flame);
  };

  const makeHut = () => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.72, 0.55, 8), palette.adobe);
    body.position.y = 0.74;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.5, 8), palette.straw);
    roof.position.y = 1.23;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.08), palette.wood);
    door.position.set(0, 0.7, 0.64);
    group.add(makePlinth(1.8, 0.2, 1.2), body, roof, door);
    return group;
  };

  const makeHall = (material, roofMaterial = palette.darkRoof) => {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.68, 1.2), material);
    base.position.y = 0.84;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.45, 4), roofMaterial);
    roof.rotation.y = Math.PI * 0.25;
    roof.position.y = 1.42;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.3), palette.stone);
    trim.position.y = 1.2;
    group.add(makePlinth(2.2, 0.2, 1.6), base, roof, trim);
    return group;
  };

  const makeStorehouse = () => {
    const group = makeHall(palette.adobe, palette.roof);
    const stackA = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.3), palette.wood);
    stackA.position.set(-0.48, 0.34, 0.66);
    const stackB = stackA.clone();
    stackB.position.x = -0.1;
    const stackC = stackA.clone();
    stackC.position.x = 0.28;
    group.add(stackA, stackB, stackC);
    return group;
  };

  const makeGranary = () => {
    const group = new THREE.Group();
    group.add(makePlinth(2.3, 0.2, 1.8));
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.9, 8), palette.straw);
    silo.position.y = 0.82;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.64, 0.42, 8), palette.roof);
    cap.position.y = 1.5;
    const sideSilo = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.64, 8), palette.straw);
    sideSilo.position.set(0.72, 0.67, -0.12);
    const sideCap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.32, 8), palette.roof);
    sideCap.position.set(0.72, 1.15, -0.12);
    group.add(silo, cap, sideSilo, sideCap);
    return group;
  };

  const makeWorkshop = () => {
    const group = makeHall(palette.stone);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), palette.stone);
    chimney.position.set(0.54, 1.6, -0.22);
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.22), palette.wood);
    anvil.position.set(-0.52, 0.33, 0.5);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.07, 0.48), palette.cloth);
    canopy.position.set(-0.52, 0.62, 0.5);
    group.add(chimney, anvil, canopy);
    return group;
  };

  const makeDock = () => {
    const group = new THREE.Group();
    const hut = makeHall(palette.wood, palette.straw);
    hut.scale.set(0.82, 0.9, 0.82);
    group.add(hut);
    const jetty = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.36), palette.wood);
    jetty.position.set(0.95, 0.26, 0);
    const postA = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), palette.wood);
    postA.position.set(0.2, 0.28, 0.14);
    const postB = postA.clone();
    postB.position.x = 1.8;
    group.add(jetty);
    group.add(postA, postB);
    return group;
  };

  const makeMarket = () => {
    const group = new THREE.Group();
    group.add(makePlinth(2.6, 0.2, 1.9, palette.stone));
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.46, 1.1), palette.adobe);
    base.position.y = 0.66;
    group.add(base);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.8), palette.accent);
    canopy.position.y = 1.15;
    group.add(canopy);
    addColumn(group, -0.42, 0.26, 0.72);
    addColumn(group, 0.42, 0.26, 0.72);
    const stallA = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.36), palette.cloth);
    stallA.position.set(-0.62, 0.34, 0.5);
    const stallB = stallA.clone();
    stallB.position.x = -0.22;
    const stallC = stallA.clone();
    stallC.position.x = 0.2;
    group.add(stallA, stallB, stallC);
    return group;
  };

  const makeShrine = () => {
    const group = new THREE.Group();
    group.add(makePlinth(2.5, 0.24, 1.9, palette.stone));
    const cella = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.62, 0.84), palette.stone);
    cella.position.y = 0.9;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.84, 0.46, 4), palette.darkRoof);
    roof.rotation.y = Math.PI * 0.25;
    roof.position.y = 1.46;
    const altar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26), palette.accent);
    altar.position.set(0, 0.48, 0.74);
    group.add(cella, roof, altar);
    addColumn(group, -0.35, 0.52, 0.62);
    addColumn(group, 0.35, 0.52, 0.62);
    addTorch(group, -0.74, 0.64);
    addTorch(group, 0.74, 0.64);
    return group;
  };

  const makeTrainingGround = () => {
    const group = new THREE.Group();
    group.add(makePlinth(2.8, 0.2, 2.1, palette.stone));
    const barracks = makeHall(palette.stone, palette.roof);
    barracks.scale.set(0.86, 0.92, 0.82);
    barracks.position.set(-0.3, 0, -0.22);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), palette.wood);
    rack.position.set(0.7, 0.52, 0.54);
    const rack2 = rack.clone();
    rack2.position.x = 0.92;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.08), palette.wood);
    beam.position.set(0.81, 0.78, 0.54);
    const dummy = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.46, 7), palette.straw);
    dummy.position.set(0.28, 0.44, 0.62);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 8), palette.accent);
    shield.rotation.x = Math.PI * 0.5;
    shield.position.set(-0.72, 0.55, 0.62);
    group.add(barracks, rack, rack2, beam, dummy, shield);
    return group;
  };

  const makeSlotMarker = () => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.54, 0.64, 24),
      new THREE.MeshBasicMaterial({ color: 0xb89a62, side: THREE.DoubleSide, transparent: true, opacity: 0.22 }),
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = 0.04;
    return ring;
  };

  const prefabByBuildingId = {
    houses: () => {
      const group = new THREE.Group();
      const a = makeHut();
      a.position.x = -0.48;
      const b = makeHut();
      b.position.x = 0.48;
      b.scale.set(0.92, 0.92, 0.92);
      group.add(a, b);
      return group;
    },
    storehouse: makeStorehouse,
    granary: makeGranary,
    workshop: makeWorkshop,
    "market-square": makeMarket,
    shrine: makeShrine,
    dock: makeDock,
    "training-ground": makeTrainingGround,
  };

  const modelUrlByBuildingId = {
    houses: "assets/models/city/houses.glb",
    storehouse: "assets/models/city/storehouse.glb",
    granary: "assets/models/city/granary.glb",
    workshop: "assets/models/city/workshop.glb",
    "market-square": "assets/models/city/market-square.glb",
    shrine: "assets/models/city/shrine.glb",
    dock: "assets/models/city/dock.glb",
    "training-ground": "assets/models/city/training-ground.glb",
  };

  const loader = typeof THREE.GLTFLoader === "function" ? new THREE.GLTFLoader() : null;
  const modelCache = new Map();

  function createBuilding(buildingId) {
    const builder = prefabByBuildingId[buildingId] || (() => makeHall(palette.adobe));
    const group = builder();
    group.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return group;
  }

  function tryLoadModel(buildingId) {
    if (!loader) return Promise.resolve(null);
    const url = modelUrlByBuildingId[buildingId];
    if (!url) return Promise.resolve(null);
    if (modelCache.has(url)) return modelCache.get(url);
    const loadPromise = new Promise((resolve) => {
      loader.load(
        url,
        (gltf) => resolve(gltf?.scene || null),
        undefined,
        () => resolve(null),
      );
    });
    modelCache.set(url, loadPromise);
    return loadPromise;
  }

  async function createBuildingAsync(buildingId) {
    const loaded = await tryLoadModel(buildingId);
    const group = loaded ? loaded.clone(true) : createBuilding(buildingId);
    group.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return group;
  }

  return {
    createBuilding,
    createBuildingAsync,
    createSlotMarker: makeSlotMarker,
    palette,
  };
}

Object.assign(globalThis, {
  createCityAssetRegistry,
});

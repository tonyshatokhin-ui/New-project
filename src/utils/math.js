function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampGoldBalance(value) {
  return clamp(value, -99, totalGoldCap());
}

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function mulberry32(seed) {
  return function next() {
    let current = (seed += 0x6D2B79F5);
    current = Math.imul(current ^ (current >>> 15), current | 1);
    current ^= current + Math.imul(current ^ (current >>> 7), current | 61);
    return ((current ^ (current >>> 14)) >>> 0) / 4294967296;
  };
}

function coordNoise(seed, q, r, salt = 0) {
  const mixed = seed + q * 374761393 + r * 668265263 + salt * 69069;
  return mulberry32(mixed)();
}

Object.assign(globalThis, {
  clamp,
  clampGoldBalance,
  signed,
  mulberry32,
  coordNoise,
});

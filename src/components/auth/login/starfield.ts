export type Star = { id: string; x: number; y: number; size: number; opacity: number };

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const createStarField = (
  seed: number,
  width: number,
  height: number,
  count = 40,
): Star[] => {
  const rand = mulberry32(seed);
  return Array.from({ length: count }).map((_, index) => {
    const size = 1 + rand() * 2;
    return {
      id: `s-${index}`,
      x: Math.floor(rand() * width),
      y: Math.floor(rand() * height),
      size,
      opacity: 0.05 + rand() * 0.14,
    };
  });
};


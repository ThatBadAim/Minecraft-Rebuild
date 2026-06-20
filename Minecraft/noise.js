// Perlin Noise implementation for procedural terrain generation
class PerlinNoise {
  constructor(seed = Math.floor(Math.random() * 1000000000)) {
    this.p = new Uint8Array(256);
    this.permutation = new Uint8Array(512);
    this.seed(seed);
  }

  seed(value) {
    // Generate permutation table based on seed
    const random = this.splitMix32(value);
    for (let i = 0; i < 256; i++) {
      this.p[i] = i;
    }
    // Shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = this.p[i];
      this.p[i] = this.p[j];
      this.p[j] = tmp;
    }
    // Duplicate the permutation array
    for (let i = 0; i < 512; i++) {
      this.permutation[i] = this.p[i & 255];
    }
  }

  // Seeded PRNG
  splitMix32(a) {
    return function() {
      a |= 0; a = a + 0x9e3779b9 | 0;
      let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aa7f);
      t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
      return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
    }
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }

  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x, y, z = 0) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const A = this.permutation[X] + Y;
    const AA = this.permutation[A] + Z;
    const AB = this.permutation[A + 1] + Z;
    const B = this.permutation[X + 1] + Y;
    const BA = this.permutation[B] + Z;
    const BB = this.permutation[B + 1] + Z;

    return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.permutation[AA], x, y, z),
                                                  this.grad(this.permutation[BA], x - 1, y, z)),
                                          this.lerp(u, this.grad(this.permutation[AB], x, y - 1, z),
                                                  this.grad(this.permutation[BB], x - 1, y - 1, z))),
                          this.lerp(v, this.lerp(u, this.grad(this.permutation[AA + 1], x, y, z - 1),
                                                  this.grad(this.permutation[BA + 1], x - 1, y, z - 1)),
                                          this.lerp(u, this.grad(this.permutation[AB + 1], x, y - 1, z - 1),
                                                  this.grad(this.permutation[BB + 1], x - 1, y - 1, z - 1))));
  }

  // Fractional Brownian Motion (FBm) for layered noise
  fbm2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0; // Used for normalizing the result

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return (total / maxValue + 1) / 2; // Normalize to [0, 1]
  }
}

export const noiseGen = new PerlinNoise(0.523456);

// Cache for pool enclosure checks to ensure we only run BFS once per pool peak.
const poolEnclosedCache = new Map();

function isPoolEnclosed(peakX, peakZ, peakHeight, waterLevel) {
  const cacheKey = `${peakX},${peakZ}`;
  if (poolEnclosedCache.has(cacheKey)) {
    return poolEnclosedCache.get(cacheKey);
  }

  const queue = [[peakX, peakZ]];
  const visited = new Set([cacheKey]);
  let count = 0;
  const maxCells = 1500;

  while (queue.length > 0) {
    if (count++ > maxCells) {
      // Too large, treat as open to be safe.
      poolEnclosedCache.set(cacheKey, false);
      return false;
    }

    const [x, z] = queue.shift();

    const neighbors = [
      [x + 1, z],
      [x - 1, z],
      [x, z + 1],
      [x, z - 1]
    ];

    for (const [nx, nz] of neighbors) {
      const nKey = `${nx},${nz}`;
      if (visited.has(nKey)) continue;
      visited.add(nKey);

      // Evaluate the pool noise function at the neighbor coordinate
      const nPoolNoise = noiseGen.fbm2D((nx + 1000) * 0.015, (nz + 1000) * 0.015, 2, 0.5, 2.0);
      if (nPoolNoise > 0.54) {
        queue.push([nx, nz]);
      } else {
        // This is a boundary block where the pool ends.
        // Get the normal, uncarved terrain height at this boundary block.
        const nBaseNoise = noiseGen.fbm2D(nx * 0.008, nz * 0.008, 4, 0.5, 2.0);
        const nDetailNoise = noiseGen.fbm2D(nx * 0.04, nz * 0.04, 2, 0.4, 2.0) - 0.5;
        let nHeightVal = nBaseNoise * 26 + 18 + nDetailNoise * 4.5;

        // Apply same flattening rim calculation that the boundary block experiences
        if (nPoolNoise > 0.50) {
          const tFlat = (nPoolNoise - 0.50) / (1.0 - 0.50);
          nHeightVal = nHeightVal + tFlat * (peakHeight - nHeightVal);
        }

        const nHeight = Math.floor(nHeightVal);

        // If the terrain height at the boundary is below the pool's water level,
        // water would spill out. So the pool is NOT enclosed.
        if (nHeight < waterLevel) {
          poolEnclosedCache.set(cacheKey, false);
          return false;
        }
      }
    }
  }

  poolEnclosedCache.set(cacheKey, true);
  return true;
}

export function getTerrainHeightAndWater(worldX, worldZ) {
  // Base low-frequency terrain (large hills / valleys)
  const baseNoise = noiseGen.fbm2D(worldX * 0.008, worldZ * 0.008, 4, 0.5, 2.0);

  // High-frequency detail (small hills and bumps)
  const detailNoise = noiseGen.fbm2D(worldX * 0.04, worldZ * 0.04, 2, 0.4, 2.0) - 0.5; // range [-0.5, 0.5]

  // Water pools/depressions (using a separate noise channel to carve out pools)
  const poolNoise = noiseGen.fbm2D((worldX + 1000) * 0.015, (worldZ + 1000) * 0.015, 2, 0.5, 2.0);

  const baseHeight = baseNoise * 26 + 18; // base height range ~ [18, 44]
  let height = baseHeight + detailNoise * 4.5;
  const uncarvedHeight = Math.floor(height);

  let waterLevel = 0;
  let isPool = false;
  let isProceduralPool = false;

  // Evaluate pool and rim flattening logic when we enter the outer rim zone (poolNoise > 0.50)
  if (poolNoise > 0.50) {
    // Climb to the local peak of the pool basin to ensure a perfectly flat water level
    let currX = worldX;
    let currZ = worldZ;
    let stepSize = 8.0;
    for (let i = 0; i < 6; i++) {
      const n = noiseGen.fbm2D((currX + 1000) * 0.015, (currZ + 1000) * 0.015, 2, 0.5, 2.0);
      const step = 1.0;
      const nX = noiseGen.fbm2D((currX + 1000 + step) * 0.015, (currZ + 1000) * 0.015, 2, 0.5, 2.0);
      const nZ = noiseGen.fbm2D((currX + 1000) * 0.015, (currZ + 1000 + step) * 0.015, 2, 0.5, 2.0);

      const gradX = nX - n;
      const gradZ = nZ - n;
      const len = Math.sqrt(gradX * gradX + gradZ * gradZ);
      if (len > 0.0001) {
        currX += (gradX / len) * stepSize;
        currZ += (gradZ / len) * stepSize;
      }
      stepSize *= 0.5; // Halve step size for high precision convergence
    }

    // Snap converged coordinates to the nearest integer to guarantee identical peak values
    const peakX = Math.round(currX);
    const peakZ = Math.round(currZ);

    // Compute uncarved terrain height at the pool peak
    const peakBaseNoise = noiseGen.fbm2D(peakX * 0.008, peakZ * 0.008, 4, 0.5, 2.0);
    const peakDetailNoise = noiseGen.fbm2D(peakX * 0.04, peakZ * 0.04, 2, 0.4, 2.0) - 0.5;
    const peakHeight = peakBaseNoise * 26 + 18 + peakDetailNoise * 4.5;

    const candidateWaterLevel = Math.floor(peakHeight - 1.0);

    // Check if the pool is fully enclosed at this candidate water level, accounting for the rim flattening
    if (isPoolEnclosed(peakX, peakZ, peakHeight, candidateWaterLevel)) {
      // Smoothly flatten the terrain lip towards the pool's peak height
      // This creates a flat plateau for the pool, eliminating stepped edges.
      const tFlat = (poolNoise - 0.50) / (1.0 - 0.50);
      height = height + tFlat * (peakHeight - height);

      // If we are within the water basin boundary (poolNoise > 0.54), carve the depth and fill with water
      if (poolNoise > 0.54) {
        isPool = true;
        isProceduralPool = true;
        const tCarve = (poolNoise - 0.54) / (1.0 - 0.54);
        const depthVal = Math.sin(tCarve * Math.PI / 2) * 5; // up to 5 blocks deep

        // Carve the basin and fill it with a perfectly flat water level
        height = height - depthVal;

        // Set water level precisely 1 block below the flattened pool lip
        waterLevel = candidateWaterLevel;
      }
    }
  }

  const finalHeight = Math.floor(height);

  // Global ocean level
  let finalWaterLevel = Math.max(waterLevel, 19);

  return {
    height: finalHeight,
    waterLevel: finalWaterLevel,
    isPool: isPool || (finalHeight < 20)
  };
}

export function getTerrainHeight(worldX, worldZ) {
  return getTerrainHeightAndWater(worldX, worldZ).height;
}

export default PerlinNoise;


export const BIOMES = {
  PLAINS: 0,
  FOREST: 1,
  DESERT: 2,
  EXTREME_HILLS: 3,
  SWAMPLAND: 4,
  JUNGLE: 5,
  TAIGA: 6,
  MUSHROOM_ISLAND: 7
};

export class BiomePipeline {
  constructor(seed) {
    this.seed = seed;
    // We use two separate noise generators for temperature and humidity to ensure chaotic, 1.6-style generation
    this.tempNoise = new PerlinNoise(seed + 1234);
    this.humidNoise = new PerlinNoise(seed + 5678);
  }

  getBiomeAt(worldX, worldZ) {
    // Large-scale noise evaluation for biomes
    const scale = 0.005;

    // Normalize noise from [-1, 1] to [0, 1]
    let temp = (this.tempNoise.fbm2D(worldX * scale, worldZ * scale, 3, 0.5, 2.0) + 1.0) * 0.5;
    let humid = (this.humidNoise.fbm2D(worldX * scale, worldZ * scale, 3, 0.5, 2.0) + 1.0) * 0.5;

    // Clamp values
    temp = Math.max(0, Math.min(1, temp));
    humid = Math.max(0, Math.min(1, humid));

    // Mushroom Island override (Rare, isolated)
    // Check a much lower frequency noise for rare mushroom islands
    let rareIsland = (this.tempNoise.fbm2D(worldX * 0.001, worldZ * 0.001, 1, 0.5, 2.0) + 1.0) * 0.5;
    // Only spawn in ocean-like temperature/humidity and if rareIsland > 0.95
    if (rareIsland > 0.98 && temp < 0.6 && humid > 0.6) {
        return BIOMES.MUSHROOM_ISLAND;
    }

    // 2D Biome Lookup Matrix (Temperature Y, Humidity X)
    if (temp < 0.3) {
      // Cold
      if (humid < 0.5) return BIOMES.TAIGA;
      return BIOMES.TAIGA; // 1.6 had less cold variety, taiga covers mostly everything cold
    } else if (temp < 0.7) {
      // Temperate
      if (humid < 0.3) return BIOMES.PLAINS;
      if (humid < 0.6) return BIOMES.FOREST;
      if (humid < 0.8) return BIOMES.SWAMPLAND;
      return BIOMES.EXTREME_HILLS;
    } else {
      // Hot
      if (humid < 0.4) return BIOMES.DESERT;
      if (humid < 0.7) return BIOMES.PLAINS;
      return BIOMES.JUNGLE;
    }
  }

  getBiomes(cx, cz) {
    const biomes = new Uint8Array(16 * 16);
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        biomes[x + z * 16] = this.getBiomeAt(cx * 16 + x, cz * 16 + z);
      }
    }
    return biomes;
  }
}


// 1.6 Biome Color Matrix (Temperature X, Humidity Y) -> Used for grass, leaves, and water
// Grass/Foliage base: 0x48B518
export class BiomeColorProvider {
  static getGrassColor(temp, humid) {
    // Very simplified tinting math for 1.6 style
    temp = Math.max(0, Math.min(1, temp));
    humid = Math.max(0, Math.min(1, humid));
    humid *= temp; // Humidity affects less in cold

    const r = Math.floor(this.lerp(temp, 120, 190) * (1 - humid * 0.5));
    const g = Math.floor(this.lerp(humid, 180, 255));
    const b = Math.floor(this.lerp(temp, 100, 60));

    // Specific overrides
    if (temp < 0.3) return 0x86B783; // Taiga
    if (temp > 0.7 && humid > 0.6) return 0x537B09; // Jungle
    if (temp > 0.7 && humid < 0.4) return 0xBFB755; // Desert

    return (r << 16) | (g << 8) | b;
  }

  static getSwampGrass() { return 0x4C763C; } // Dark swamp-green
  static getSwampWater() { return 0x4C482A; } // Murky brown-green

  static lerp(t, a, b) {
    return a + t * (b - a);
  }
}

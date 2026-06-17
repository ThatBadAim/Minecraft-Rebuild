
export class TerrainGenerator {
  constructor(seed) {
    this.seed = seed;
    this.noiseGen = new PerlinNoise(seed);
    this.biomePipeline = new BiomePipeline(seed);

    this.waterLevel = 62;
    this.chunkSize = 16;
    this.chunkHeight = 128;

    // Sparse grid setup
    this.hStep = 4;
    this.vStep = 8;
    this.hRes = this.chunkSize / this.hStep + 1; // 5
    this.vRes = this.chunkHeight / this.vStep + 1; // 17
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }

  getDensity(worldX, worldY, worldZ) {
    // Base 3D Noise (simulating overhangs and terrain shape)
    const base = this.noiseGen.fbm3D(worldX * 0.01, worldY * 0.01, worldZ * 0.01, 4, 0.5, 2.0);
    // Vertical gradient to force solid ground below and empty sky above
    const heightGradient = (64.0 - worldY) / 32.0;
    return base + heightGradient;
  }

  generateBaseTerrain(cx, cz) {
    const blocks = new Uint8Array(16 * 128 * 16);
    const densityMap = new Float32Array(this.hRes * this.vRes * this.hRes);
    const biomes = this.biomePipeline.getBiomes(cx, cz);

    // 1. Sample sparse density grid
    for (let x = 0; x < this.hRes; x++) {
      const worldX = cx * this.chunkSize + x * this.hStep;
      for (let z = 0; z < this.hRes; z++) {
        const worldZ = cz * this.chunkSize + z * this.hStep;
        for (let y = 0; y < this.vRes; y++) {
          const worldY = y * this.vStep;
          densityMap[x + z * this.hRes + y * this.hRes * this.hRes] = this.getDensity(worldX, worldY, worldZ);
        }
      }
    }

    // 2. Trilinear Interpolation into blocks
    for (let x = 0; x < this.hRes - 1; x++) {
      for (let z = 0; z < this.hRes - 1; z++) {
        for (let y = 0; y < this.vRes - 1; y++) {
          // Get the 8 corners of the sparse cube
          let d000 = densityMap[x + z * this.hRes + y * this.hRes * this.hRes];
          let d100 = densityMap[(x + 1) + z * this.hRes + y * this.hRes * this.hRes];
          let d010 = densityMap[x + (z + 1) * this.hRes + y * this.hRes * this.hRes];
          let d110 = densityMap[(x + 1) + (z + 1) * this.hRes + y * this.hRes * this.hRes];

          let d001 = densityMap[x + z * this.hRes + (y + 1) * this.hRes * this.hRes];
          let d101 = densityMap[(x + 1) + z * this.hRes + (y + 1) * this.hRes * this.hRes];
          let d011 = densityMap[x + (z + 1) * this.hRes + (y + 1) * this.hRes * this.hRes];
          let d111 = densityMap[(x + 1) + (z + 1) * this.hRes + (y + 1) * this.hRes * this.hRes];

          // Interpolation steps
          const stepX = 1.0 / this.hStep;
          const stepY = 1.0 / this.vStep;
          const stepZ = 1.0 / this.hStep;

          let v00 = d000, v10 = d100, v01 = d010, v11 = d110;
          const step00 = (d001 - d000) * stepY;
          const step10 = (d101 - d100) * stepY;
          const step01 = (d011 - d010) * stepY;
          const step11 = (d111 - d110) * stepY;

          for (let ly = 0; ly < this.vStep; ly++) {
            let val0 = v00, val1 = v01;
            const step0 = (v10 - v00) * stepX;
            const step1 = (v11 - v01) * stepX;

            for (let lx = 0; lx < this.hStep; lx++) {
              let val = val0;
              const step = (val1 - val0) * stepZ;

              for (let lz = 0; lz < this.hStep; lz++) {
                const blockX = x * this.hStep + lx;
                const blockY = y * this.vStep + ly;
                const blockZ = z * this.hStep + lz;
                const index = blockX + blockZ * 16 + blockY * 256;

                if (val > 0.0) {
                  blocks[index] = 3; // STONE
                } else if (blockY <= this.waterLevel) {
                  blocks[index] = 15; // WATER
                } else {
                  blocks[index] = 0; // AIR
                }

                val += step;
              }
              val0 += step0;
              val1 += step1;
            }
            v00 += step00; v10 += step10; v01 += step01; v11 += step11;
          }
        }
      }
    }

    // 3. Surface Dressing & Carving
    this.dressSurface(cx, cz, blocks, biomes);
    this.carveCaves(cx, cz, blocks);

    return blocks;
  }

  dressSurface(cx, cz, blocks, biomes) {
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        let depth = -1;
        const biome = biomes[x + z * 16];

        let topBlock = 1; // GRASS
        let fillerBlock = 2; // DIRT

        if (biome === 2) { // Desert
          topBlock = 6; // SAND
          fillerBlock = 6;
        }

        for (let y = 127; y >= 0; y--) {
          const index = x + z * 16 + y * 256;
          const block = blocks[index];

          if (block === 0) { // AIR
            depth = -1;
          } else if (block === 3) { // STONE
            if (depth === -1) {
              depth = 0;
              if (y >= this.waterLevel - 1) {
                blocks[index] = topBlock;
              } else {
                blocks[index] = fillerBlock;
              }
            } else if (depth < 3) {
              depth++;
              blocks[index] = fillerBlock;
            }
          }
        }

        // Bedrock
        blocks[x + z * 16 + 0 * 256] = 10;
      }
    }
  }

  carveCaves(cx, cz, blocks) {
    // Basic "worm" algorithm
    const prng = new XorShift128(this.seed + cx * 9187 + cz * 4581);
    const numCaves = prng.nextInt(15);

    for (let i = 0; i < numCaves; i++) {
      let x = cx * 16 + prng.nextInt(16);
      let y = prng.nextInt(120);
      let z = cz * 16 + prng.nextInt(16);

      let length = 50 + prng.nextInt(100);
      let heading = prng.next() * Math.PI * 2;
      let pitch = (prng.next() - 0.5) * Math.PI;

      for (let l = 0; l < length; l++) {
        x += Math.cos(heading) * Math.cos(pitch);
        y += Math.sin(pitch);
        z += Math.sin(heading) * Math.cos(pitch);

        heading += (prng.next() - 0.5) * 0.5;
        pitch += (prng.next() - 0.5) * 0.5;
        pitch *= 0.9; // flatten out

        const radius = 1.5 + prng.next() * 2.0;

        const bx = Math.floor(x) - cx * 16;
        const by = Math.floor(y);
        const bz = Math.floor(z) - cz * 16;

        // Safety check to abort if intersects water
        let hitsWater = false;
        for (let ix = bx - 2; ix <= bx + 2; ix++) {
          for (let iz = bz - 2; iz <= bz + 2; iz++) {
            for (let iy = by - 2; iy <= by + 2; iy++) {
              if (ix >= 0 && ix < 16 && iz >= 0 && iz < 16 && iy >= 0 && iy < 128) {
                if (blocks[ix + iz * 16 + iy * 256] === 15) { // WATER
                  hitsWater = true;
                }
              }
            }
          }
        }

        if (hitsWater) break; // Abort this worm

        // Carve
        for (let ix = Math.floor(bx - radius); ix <= Math.floor(bx + radius); ix++) {
          for (let iz = Math.floor(bz - radius); iz <= Math.floor(bz + radius); iz++) {
            for (let iy = Math.floor(by - radius); iy <= Math.floor(by + radius); iy++) {
              if (ix >= 0 && ix < 16 && iz >= 0 && iz < 16 && iy > 0 && iy < 128) {
                const dx = ix - bx;
                const dy = iy - by;
                const dz = iz - bz;
                if (dx*dx + dy*dy + dz*dz < radius*radius) {
                  if (blocks[ix + iz * 16 + iy * 256] === 3) { // Only carve stone
                    blocks[ix + iz * 16 + iy * 256] = 0;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // 4. Two-Pass Population
  populateChunk(world, cx, cz) {
    // Only execute if chunk and south/east neighbors are generated
    // Handled by WorldManager orchestrator. Offset by +8 for decoration.

    // Example tree population offset by +8
    const prng = new XorShift128(this.seed + cx * 9187 + cz * 4581);
    if (prng.next() < 0.5) {
      const x = cx * 16 + 8 + prng.nextInt(16);
      const z = cz * 16 + 8 + prng.nextInt(16);
      // find ground...
    }
  }
}

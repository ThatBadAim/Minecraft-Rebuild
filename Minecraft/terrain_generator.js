
import { BiomePipeline, BIOMES } from './noise.js';

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

  getDensity(worldX, worldY, worldZ, biome) {
    // Biome-specific height maps and density adjustments
    let baseHeight = 64.0;
    let heightVariation = 32.0;
    let frequency = 0.01;
    let amplitude = 1.0;

    // 1.6 Biome Terrain Signatures
    switch (biome) {
        case BIOMES.PLAINS:
            baseHeight = 64.0;
            heightVariation = 8.0;
            frequency = 0.005; // Low frequency, rolling hills
            break;
        case BIOMES.FOREST:
            baseHeight = 64.0;
            heightVariation = 16.0;
            frequency = 0.01; // Medium frequency
            break;
        case BIOMES.DESERT:
            baseHeight = 64.0;
            heightVariation = 4.0;
            frequency = 0.008; // Flat
            break;
        case BIOMES.EXTREME_HILLS:
            baseHeight = 80.0;
            heightVariation = 64.0;
            frequency = 0.02; // High frequency, high amplitude, jagged peaks
            amplitude = 1.5;
            break;
        case BIOMES.SWAMPLAND:
            baseHeight = 61.0; // Slightly below water level (62) to create shallow pools
            heightVariation = 2.0;
            frequency = 0.02;
            break;
        case BIOMES.JUNGLE:
            baseHeight = 68.0;
            heightVariation = 24.0;
            frequency = 0.03; // Chaotic micro-topography
            amplitude = 1.2;
            break;
        case BIOMES.TAIGA:
            baseHeight = 66.0;
            heightVariation = 16.0;
            frequency = 0.01;
            break;
        case BIOMES.MUSHROOM_ISLAND:
            baseHeight = 66.0;
            heightVariation = 10.0;
            frequency = 0.01;
            break;
    }

    const base = this.noiseGen.fbm3D(worldX * frequency, worldY * frequency, worldZ * frequency, 4, 0.5, 2.0) * amplitude;
    const heightGradient = (baseHeight - worldY) / heightVariation;
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
                    const biome = this.biomePipeline.getBiomeAt(worldX, worldZ);
          densityMap[x + z * this.hRes + y * this.hRes * this.hRes] = this.getDensity(worldX, worldY, worldZ, biome);
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
    this.decorateChunk(cx, cz, blocks, biomes);

    return blocks;
  }

  dressSurface(cx, cz, blocks, biomes) {
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        let depth = -1;
        const biome = biomes[x + z * 16];

        let topBlock = 1; // GRASS
        let fillerBlock = 2; // DIRT

        if (biome === BIOMES.DESERT) {
          topBlock = 6; // SAND
          fillerBlock = 6; // SAND
        } else if (biome === BIOMES.MUSHROOM_ISLAND) {
          topBlock = 29; // MYCELIUM (assuming block ID 29, will need to add to world.js)
          fillerBlock = 2; // DIRT
        } else if (biome === BIOMES.TAIGA) {
          topBlock = 1; // GRASS
          fillerBlock = 2; // DIRT
          // Snow layer will be added as decoration
        } else if (biome === BIOMES.EXTREME_HILLS) {
           // Extreme hills often expose stone
           if (this.noiseGen.fbm2D(cx * 16 + x, cz * 16 + z, 2, 0.5, 2.0) > 0.4) {
               topBlock = 3; // STONE
               fillerBlock = 3; // STONE
           }
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
            } else if (depth < 4) {
              depth++;
              if (biome === BIOMES.DESERT && depth >= 1 && depth <= 3) {
                  blocks[index] = 30; // SANDSTONE
              } else {
                  blocks[index] = fillerBlock;
              }
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

    const prng = new XorShift128(this.seed + cx * 9187 + cz * 4581);

    // Evaluate biome for the center of the chunk
    const centerBiome = this.biomePipeline.getBiomeAt(cx * 16 + 8, cz * 16 + 8);

    // Spawn passive mobs based on 1.6 rules
    // Spawn rate: 10% chance per chunk
    if (prng.next() < 0.1) {
        const x = cx * 16 + prng.nextInt(16);
        const z = cz * 16 + prng.nextInt(16);
        let y = 127;
        // Find ground...
        // ... (mocked for now, assumes y is passed correctly to entity creation)

        let mobType = null;
        let count = 1;

        switch (centerBiome) {
            case BIOMES.PLAINS:
                if (prng.next() < 0.2) { mobType = 8; /* HORSE */ count = prng.nextInt(4) + 2; }
                else if (prng.next() < 0.1) { mobType = 9; /* DONKEY */ count = prng.nextInt(2) + 1; }
                else {
                    const r = prng.next();
                    if (r < 0.3) mobType = 3; /* COW */
                    else if (r < 0.6) mobType = 1; /* PIG */
                    else mobType = 2; /* SHEEP */
                    count = prng.nextInt(4) + 2;
                }
                break;
            case BIOMES.FOREST:
            case BIOMES.TAIGA:
                if (prng.next() < 0.1) { mobType = 10; /* WOLF */ count = 4; } // Pack of 4
                break;
            case BIOMES.JUNGLE:
                if (prng.next() < 0.3) { mobType = 13; /* OCELOT */ count = prng.nextInt(2) + 1; }
                break;
            case BIOMES.MUSHROOM_ISLAND:
                mobType = 15; /* MOOSHROOM */
                count = prng.nextInt(4) + 2;
                break;
            // Desert/Extreme Hills/Swampland have no specific passive spawns or different logic handled elsewhere
        }

        // Pass entity data to main thread...
    }
  }

  decorateChunk(cx, cz, blocks, biomes) {
      const prng = new XorShift128(this.seed + cx * 9187 + cz * 4581);
      const centerBiome = biomes[8 + 8 * 16];

      const getGroundY = (x, z) => {
          for(let y=127; y>=0; y--) {
              if (blocks[x + z * 16 + y * 256] !== 0 && blocks[x + z * 16 + y * 256] !== 15) return y;
          }
          return -1;
      };

      if (centerBiome === BIOMES.FOREST || centerBiome === BIOMES.PLAINS) {
          const numTrees = centerBiome === BIOMES.FOREST ? 10 : 1;
          for(let i=0; i<numTrees; i++) {
              if(prng.next() < 0.8) {
                  const tx = prng.nextInt(12) + 2;
                  const tz = prng.nextInt(12) + 2;
                  const ty = getGroundY(tx, tz);
                  if (ty > 0 && blocks[tx + tz*16 + ty*256] === 1) { // Grass
                      this.generateTree(tx, ty, tz, blocks, 4, 5); // Oak
                  }
              }
          }
      } else if (centerBiome === BIOMES.TAIGA) {
          for(let i=0; i<8; i++) {
              const tx = prng.nextInt(12) + 2;
              const tz = prng.nextInt(12) + 2;
              const ty = getGroundY(tx, tz);
              if (ty > 0 && blocks[tx + tz*16 + ty*256] === 1) {
                  this.generateTree(tx, ty, tz, blocks, 11, 12); // Pine
              }
          }
          // Add snow layer
          for(let x=0; x<16; x++) {
              for(let z=0; z<16; z++) {
                  const ty = getGroundY(x, z);
                  if (ty > 0 && ty < 127 && blocks[x + z*16 + ty*256] !== 15) {
                      blocks[x + z*16 + (ty+1)*256] = 31; // SNOW_LAYER
                  }
              }
          }
      } else if (centerBiome === BIOMES.DESERT) {
          for(let i=0; i<2; i++) {
              if(prng.next() < 0.5) {
                  const tx = prng.nextInt(16);
                  const tz = prng.nextInt(16);
                  const ty = getGroundY(tx, tz);
                  if (ty > 0 && ty < 125 && blocks[tx + tz*16 + ty*256] === 6) { // Sand
                      blocks[tx + tz*16 + (ty+1)*256] = 34; // CACTUS
                      blocks[tx + tz*16 + (ty+2)*256] = 34;
                      blocks[tx + tz*16 + (ty+3)*256] = 34;
                  }
              }
          }
      } else if (centerBiome === BIOMES.MUSHROOM_ISLAND) {
          for(let i=0; i<2; i++) {
              if (prng.next() < 0.3) {
                  const tx = prng.nextInt(12) + 2;
                  const tz = prng.nextInt(12) + 2;
                  const ty = getGroundY(tx, tz);
                  if (ty > 0 && blocks[tx + tz*16 + ty*256] === 29) { // Mycelium
                      this.generateTree(tx, ty, tz, blocks, 19, 19); // Meat block placeholder for giant mushroom stem/cap
                  }
              }
          }
      } else if (centerBiome === BIOMES.SWAMPLAND) {
          for(let i=0; i<5; i++) {
              const tx = prng.nextInt(12) + 2;
              const tz = prng.nextInt(12) + 2;
              const ty = getGroundY(tx, tz);
              if (ty > 0 && blocks[tx + tz*16 + ty*256] === 1) {
                  this.generateTree(tx, ty, tz, blocks, 4, 5); // Oak
              }
          }
      }
  }

  generateTree(x, y, z, blocks, logType, leafType) {
      const height = 4 + Math.floor(Math.random() * 3);
      for(let iy=0; iy<height; iy++) {
          if (y + 1 + iy < 128) blocks[x + z*16 + (y+1+iy)*256] = logType;
      }
      for(let ix=-2; ix<=2; ix++) {
          for(let iz=-2; iz<=2; iz++) {
              for(let iy=height-2; iy<=height+1; iy++) {
                  if (Math.abs(ix) === 2 && Math.abs(iz) === 2 && (iy === height || iy === height+1)) continue;
                  if (ix === 0 && iz === 0 && iy < height) continue;

                  const nx = x + ix;
                  const nz = z + iz;
                  const ny = y + 1 + iy;
                  if (nx >= 0 && nx < 16 && nz >= 0 && nz < 16 && ny < 128) {
                      if (blocks[nx + nz*16 + ny*256] === 0) {
                          blocks[nx + nz*16 + ny*256] = leafType;
                      }
                  }
              }
          }
      }
  }
}

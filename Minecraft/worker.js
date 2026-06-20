// Web Worker for offloading chunk terrain generation and geometry construction.
// This runs on a separate CPU core to prevent main thread stutters.

import { noiseGen, getTerrainHeight, getTerrainHeightAndWater } from './noise.js';

// Block definition mappings (must match world.js)
const BLOCKS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  GLASS: 7,
  BRICK: 8,
  PLANKS: 9,
  BEDROCK: 10,
  PINE_WOOD: 11,
  PINE_LEAVES: 12,
  BIRCH_WOOD: 13,
  BIRCH_LEAVES: 14,
  WATER: 15,
  STICK: 16,
  STONE_PICKAXE: 17,
  CRAFTING_TABLE: 18,
  MEAT: 19,
  WOOL: 20,
  TORCH: 21,
  TNT: 22,
  COAL: 23,

  NETHERRACK: 29,
  GLOWSTONE: 30,
  CRIMSON_NYLIUM: 31,
  CRIMSON_STALK: 32,
  NETHER_WART: 33,
  WEEPING_VINES: 34,
  WARPED_NYLIUM: 35,
  WARPED_STALK: 36,
  SHROOMLIGHT: 37,
  SOUL_SOIL: 38,
  BONE_BLOCK: 39,
  SOUL_FIRE: 40,
  BASALT: 41,
  BLACKSTONE: 42,
  LAVA: 43,
  END_STONE: 44,
  OBSIDIAN: 45,
  END_CRYSTAL: 46,
  CHORUS_STEM: 47,
  CHORUS_FLOWER: 48,
  PURPUR_BLOCK: 49,
  END_STONE_BRICKS: 50
};

const BLOCK_INFO = {
  [BLOCKS.AIR]: { name: 'Air', solid: false, transparent: true },
  [BLOCKS.GRASS]: { name: 'Grass Block', solid: true, transparent: false, uvs: { top: [0, 0], side: [1, 0], bottom: [2, 0] } },
  [BLOCKS.DIRT]: { name: 'Dirt', solid: true, transparent: false, uvs: { top: [2, 0], side: [2, 0], bottom: [2, 0] } },
  [BLOCKS.STONE]: { name: 'Stone', solid: true, transparent: false, uvs: { top: [3, 0], side: [3, 0], bottom: [3, 0] } },
  [BLOCKS.WOOD]: { name: 'Oak Log', solid: true, transparent: false, uvs: { top: [4, 0], side: [5, 0], bottom: [4, 0] } },
  [BLOCKS.LEAVES]: { name: 'Oak Leaves', solid: true, transparent: true, uvs: { top: [6, 0], side: [6, 0], bottom: [6, 0] } },
  [BLOCKS.SAND]: { name: 'Sand', solid: true, transparent: false, uvs: { top: [7, 0], side: [7, 0], bottom: [7, 0] } },
  [BLOCKS.GLASS]: { name: 'Glass', solid: true, transparent: true, uvs: { top: [0, 1], side: [0, 1], bottom: [0, 1] } },
  [BLOCKS.BRICK]: { name: 'Brick', solid: true, transparent: false, uvs: { top: [1, 1], side: [1, 1], bottom: [1, 1] } },
  [BLOCKS.PLANKS]: { name: 'Oak Planks', solid: true, transparent: false, uvs: { top: [2, 1], side: [2, 1], bottom: [2, 1] } },
  [BLOCKS.BEDROCK]: { name: 'Bedrock', solid: true, transparent: false, uvs: { top: [3, 1], side: [3, 1], bottom: [3, 1] } },
  [BLOCKS.PINE_WOOD]: { name: 'Pine Log', solid: true, transparent: false, uvs: { top: [4, 1], side: [5, 1], bottom: [4, 1] } },
  [BLOCKS.PINE_LEAVES]: { name: 'Pine Leaves', solid: true, transparent: true, uvs: { top: [6, 1], side: [6, 1], bottom: [6, 1] } },
  [BLOCKS.BIRCH_WOOD]: { name: 'Birch Log', solid: true, transparent: false, uvs: { top: [7, 1], side: [0, 2], bottom: [7, 1] } },
  [BLOCKS.BIRCH_LEAVES]: { name: 'Birch Leaves', solid: true, transparent: true, uvs: { top: [1, 2], side: [1, 2], bottom: [1, 2] } },
  [BLOCKS.WATER]: { name: 'Water', solid: false, transparent: true, alphaTest: 0.1, uvs: { top: [2, 2], side: [2, 2], bottom: [2, 2] } },
  [BLOCKS.STICK]: { name: 'Stick', solid: false, transparent: true, uvs: { top: [3, 2], side: [3, 2], bottom: [3, 2] } },
  [BLOCKS.STONE_PICKAXE]: { name: 'Stone Pickaxe', solid: false, transparent: true, uvs: { top: [4, 2], side: [4, 2], bottom: [4, 2] } },
  [BLOCKS.CRAFTING_TABLE]: { name: 'Crafting Table', solid: true, transparent: false, uvs: { top: [5, 2], side: [6, 2], bottom: [2, 1] } },
  [BLOCKS.MEAT]: { name: 'Meat', solid: false, transparent: true, uvs: { top: [7, 2], side: [7, 2], bottom: [7, 2] } },
  [BLOCKS.WOOL]: { name: 'Wool', solid: false, transparent: true, uvs: { top: [0, 3], side: [0, 3], bottom: [0, 3] } },
  [BLOCKS.TORCH]: { name: 'Torch', solid: false, transparent: true, uvs: { top: [1, 3], side: [1, 3], bottom: [1, 3] } },
  [BLOCKS.TNT]: { name: 'TNT', solid: true, transparent: false, uvs: { top: [2, 3], side: [3, 3], bottom: [2, 3] } },
  [BLOCKS.COAL]: { name: 'Coal Ore', solid: true, transparent: false, uvs: { top: [4, 3], side: [4, 3], bottom: [4, 3] } },

  [BLOCKS.NETHERRACK]: { name: 'Netherrack', solid: true, transparent: false, uvs: { top: [0, 4], side: [0, 4], bottom: [0, 4] } },
  [BLOCKS.GLOWSTONE]: { name: 'Glowstone', solid: true, transparent: false, uvs: { top: [1, 4], side: [1, 4], bottom: [1, 4] } },
  [BLOCKS.CRIMSON_NYLIUM]: { name: 'Crimson Nylium', solid: true, transparent: false, uvs: { top: [2, 4], side: [3, 4], bottom: [0, 4] } },
  [BLOCKS.CRIMSON_STALK]: { name: 'Crimson Stalk', solid: true, transparent: false, uvs: { top: [4, 4], side: [5, 4], bottom: [4, 4] } },
  [BLOCKS.NETHER_WART]: { name: 'Nether Wart Block', solid: true, transparent: false, uvs: { top: [6, 4], side: [6, 4], bottom: [6, 4] } },
  [BLOCKS.WEEPING_VINES]: { name: 'Weeping Vines', solid: false, transparent: true, uvs: { top: [7, 4], side: [7, 4], bottom: [7, 4] } },
  [BLOCKS.WARPED_NYLIUM]: { name: 'Warped Nylium', solid: true, transparent: false, uvs: { top: [0, 5], side: [1, 5], bottom: [0, 4] } },
  [BLOCKS.WARPED_STALK]: { name: 'Warped Stalk', solid: true, transparent: false, uvs: { top: [2, 5], side: [3, 5], bottom: [2, 5] } },
  [BLOCKS.SHROOMLIGHT]: { name: 'Shroomlight', solid: true, transparent: false, uvs: { top: [4, 5], side: [4, 5], bottom: [4, 5] } },
  [BLOCKS.SOUL_SOIL]: { name: 'Soul Soil', solid: true, transparent: false, uvs: { top: [5, 5], side: [5, 5], bottom: [5, 5] } },
  [BLOCKS.BONE_BLOCK]: { name: 'Bone Block', solid: true, transparent: false, uvs: { top: [6, 5], side: [7, 5], bottom: [6, 5] } },
  [BLOCKS.SOUL_FIRE]: { name: 'Soul Fire', solid: false, transparent: true, uvs: { top: [0, 6], side: [0, 6], bottom: [0, 6] } },
  [BLOCKS.BASALT]: { name: 'Basalt', solid: true, transparent: false, uvs: { top: [1, 6], side: [2, 6], bottom: [1, 6] } },
  [BLOCKS.BLACKSTONE]: { name: 'Blackstone', solid: true, transparent: false, uvs: { top: [3, 6], side: [3, 6], bottom: [3, 6] } },
  [BLOCKS.LAVA]: { name: 'Lava', solid: false, transparent: true, alphaTest: 0.1, uvs: { top: [4, 6], side: [4, 6], bottom: [4, 6] } },
  [BLOCKS.END_STONE]: { name: 'End Stone', solid: true, transparent: false, uvs: { top: [5, 6], side: [5, 6], bottom: [5, 6] } },
  [BLOCKS.OBSIDIAN]: { name: 'Obsidian', solid: true, transparent: false, uvs: { top: [6, 6], side: [6, 6], bottom: [6, 6] } },
  [BLOCKS.END_CRYSTAL]: { name: 'End Crystal', solid: false, transparent: true, uvs: { top: [7, 6], side: [7, 6], bottom: [7, 6] } },
  [BLOCKS.CHORUS_STEM]: { name: 'Chorus Stem', solid: true, transparent: false, uvs: { top: [0, 7], side: [0, 7], bottom: [0, 7] } },
  [BLOCKS.CHORUS_FLOWER]: { name: 'Chorus Flower', solid: true, transparent: false, uvs: { top: [1, 7], side: [1, 7], bottom: [1, 7] } },
  [BLOCKS.PURPUR_BLOCK]: { name: 'Purpur Block', solid: true, transparent: false, uvs: { top: [2, 7], side: [2, 7], bottom: [2, 7] } },
  [BLOCKS.END_STONE_BRICKS]: { name: 'End Stone Bricks', solid: true, transparent: false, uvs: { top: [3, 7], side: [3, 7], bottom: [3, 7] } }
};

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 128;

// Cache of chunk blocks on the worker
const chunks = {};
let activeDimension = 0;

function getChunkKey(cx, cz) {
  return `${cx},${cz}`;
}

// Get block from cached chunks or generate deterministically on the fly

function getBlock(x, y, z) {
  if (y < 0) return { type: BLOCKS.BEDROCK, solid: true, transparent: false };
  if (y >= CHUNK_HEIGHT) return { type: BLOCKS.AIR, solid: false, transparent: true };

  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  const key = getChunkKey(cx, cz);

  let chunk = chunks[key];
  if (!chunk) {
    // Generate just block data on the fly (no mesh)
    chunk = generateChunkData(cx, cz);
    chunks[key] = chunk;
  }

  const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

  const type = chunk[lx][y][lz];
  return {
    type: type,
    solid: BLOCK_INFO[type].solid,
    transparent: BLOCK_INFO[type].transparent
  };
}


function generateOverworld(cx, cz, blocks) {
    const chunkWorldX = cx * CHUNK_SIZE;
    const chunkWorldZ = cz * CHUNK_SIZE;

    // Pass 1: Base Terrain
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const worldX = chunkWorldX + lx;
        const worldZ = chunkWorldZ + lz;

        const info = getTerrainHeightAndWater(worldX, worldZ);
        const height = info.height;
        const waterLevel = info.waterLevel;
        const isPool = info.isPool;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          if (y === 0) {
            blocks[lx][y][lz] = BLOCKS.BEDROCK;
          } else if (y < height - 4) {
            blocks[lx][y][lz] = BLOCKS.STONE;
            // Coal ore generation
            if (y > 2 && y < 25 && Math.random() < 0.03) {
              blocks[lx][y][lz] = BLOCKS.COAL;
            }
          } else if (y < height) {
            blocks[lx][y][lz] = BLOCKS.DIRT;
          } else if (y === height) {
            if (isPool) {
              blocks[lx][y][lz] = BLOCKS.SAND;
            } else {
              blocks[lx][y][lz] = BLOCKS.GRASS;
            }
          } else if (y > height && y <= waterLevel) {
            blocks[lx][y][lz] = BLOCKS.WATER;
          } else {
            blocks[lx][y][lz] = BLOCKS.AIR;
          }
        }
      }
    }

    // Pass 2: Tree generation (after all base terrain columns are defined to prevent leaf overwrites)
    for (let lx = 3; lx < CHUNK_SIZE - 3; lx++) {
      for (let lz = 3; lz < CHUNK_SIZE - 3; lz++) {
        const worldX = chunkWorldX + lx;
        const worldZ = chunkWorldZ + lz;
        const height = getTerrainHeight(worldX, worldZ);

        // Only grow trees on Grass blocks (not sand, water or stone)
        if (blocks[lx][height][lz] === BLOCKS.GRASS) {
          const treeNoise = noiseGen.noise(worldX * 0.5, worldZ * 0.5);
          if (treeNoise > 0.42 && Math.random() > 0.78) {
            const r = Math.random();
            if (r < 0.4) {
              // Classic Minecraft Oak Tree (5x5 bottom layers, 3x3 top layer, cross on top)
              const treeHeight = 5 + Math.floor(Math.random() * 2);
              for (let ty = 1; ty <= treeHeight; ty++) {
                blocks[lx][height + ty][lz] = BLOCKS.WOOD;
              }
              const trunkY = height + treeHeight;

              // Bottom foliage layer (y = trunkY - 2 and trunkY - 1)
              for (let oy = -2; oy <= -1; oy++) {
                for (let ox = -2; ox <= 2; ox++) {
                  for (let oz = -2; oz <= 2; oz++) {
                    // Skip corners for rounder canopy
                    if (Math.abs(ox) === 2 && Math.abs(oz) === 2) continue;
                    blocks[lx + ox][trunkY + oy][lz + oz] = BLOCKS.LEAVES;
                  }
                }
              }
              // Middle foliage layer (y = trunkY)
              for (let ox = -1; ox <= 1; ox++) {
                for (let oz = -1; oz <= 1; oz++) {
                  blocks[lx + ox][trunkY][lz + oz] = BLOCKS.LEAVES;
                }
              }
              // Top foliage layer (y = trunkY + 1)
              blocks[lx][trunkY + 1][lz] = BLOCKS.LEAVES;
              blocks[lx + 1][trunkY + 1][lz] = BLOCKS.LEAVES;
              blocks[lx - 1][trunkY + 1][lz] = BLOCKS.LEAVES;
              blocks[lx][trunkY + 1][lz + 1] = BLOCKS.LEAVES;
              blocks[lx][trunkY + 1][lz - 1] = BLOCKS.LEAVES;

            } else if (r < 0.7) {
              // Classic Minecraft Pine/Spruce Tree (Conical segmented layers)
              const treeHeight = 7 + Math.floor(Math.random() * 3);
              for (let ty = 1; ty <= treeHeight; ty++) {
                blocks[lx][height + ty][lz] = BLOCKS.PINE_WOOD;
              }
              const trunkY = height + treeHeight;

              // Cone foliage generation
              for (let oy = -4; oy <= 1; oy++) {
                const currentY = trunkY + oy;
                const distFromTop = 1 - oy;
                let radius = 0;

                if (distFromTop === 0) {
                  radius = 0; // Single block top
                } else if (distFromTop === 1 || distFromTop === 3) {
                  radius = 1; // 3x3 cross
                } else {
                  radius = 2; // 5x5 cross
                }

                for (let ox = -radius; ox <= radius; ox++) {
                  for (let oz = -radius; oz <= radius; oz++) {
                    if (radius === 2 && Math.abs(ox) === 2 && Math.abs(oz) === 2) continue; // Cut corners
                    if (radius === 1 && Math.abs(ox) === 1 && Math.abs(oz) === 1 && distFromTop === 1) continue; // Taper top
                    blocks[lx + ox][currentY][lz + oz] = BLOCKS.PINE_LEAVES;
                  }
                }
              }
            } else {
              // Classic Minecraft Birch Tree (Tall trunk, light green dense canopy)
              const treeHeight = 6 + Math.floor(Math.random() * 2);
              for (let ty = 1; ty <= treeHeight; ty++) {
                blocks[lx][height + ty][lz] = BLOCKS.BIRCH_WOOD;
              }
              const trunkY = height + treeHeight;

              // Birch foliage is standard but slightly more vertical
              for (let oy = -2; oy <= 0; oy++) {
                for (let ox = -2; ox <= 2; ox++) {
                  for (let oz = -2; oz <= 2; oz++) {
                    if (Math.abs(ox) === 2 && Math.abs(oz) === 2 && oy === 0) continue;
                    blocks[lx + ox][trunkY + oy][lz + oz] = BLOCKS.BIRCH_LEAVES;
                  }
                }
              }
              // Top cap
              for (let ox = -1; ox <= 1; ox++) {
                for (let oz = -1; oz <= 1; oz++) {
                  if (Math.abs(ox) === 1 && Math.abs(oz) === 1) continue;
                  blocks[lx + ox][trunkY + 1][lz + oz] = BLOCKS.BIRCH_LEAVES;
                }
              }
              blocks[lx][trunkY + 2][lz] = BLOCKS.BIRCH_LEAVES;
            }
          }
        }
      }
    }
}


function getNetherDensity(worldX, worldY, worldZ) {
    // 3D fbm to create swiss cheese caves
    const density = noiseGen.fbm3D(worldX * 0.02, worldY * 0.03, worldZ * 0.02, 4, 0.5, 2.0);

    // Smooth boundary gradients
    let gradient = 0;
    if (worldY < 15) {
        // Solid bottom
        gradient = (15 - worldY) / 15.0;
    } else if (worldY > 113) {
        // Solid ceiling
        gradient = (worldY - 113) / 15.0;
    }

    return density + gradient - 0.5; // Bias threshold
}


function generateNether(cx, cz, blocks) {
    const chunkWorldX = cx * CHUNK_SIZE;
    const chunkWorldZ = cz * CHUNK_SIZE;

    // Biomes: 0=Wastes, 1=Crimson, 2=Warped, 3=SoulSand, 4=Basalt
    const biomeMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
         const temp = noiseGen.fbm2D((chunkWorldX + lx) * 0.005, (chunkWorldZ + lz) * 0.005, 3);
         const humid = noiseGen.fbm2D((chunkWorldX + lx + 1000) * 0.005, (chunkWorldZ + lz + 1000) * 0.005, 3);

         let biome = 0; // Wastes
         if (temp > 0.6) biome = 4; // Basalt
         else if (temp < 0.4 && humid > 0.5) biome = 3; // Soul Sand
         else if (humid > 0.6) biome = 1; // Crimson
         else if (humid < 0.4) biome = 2; // Warped

         biomeMap[lx + lz * CHUNK_SIZE] = biome;
      }
    }

    // Pass 1: Base Terrain (3D Noise Caverns)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const worldX = chunkWorldX + lx;
        const worldZ = chunkWorldZ + lz;
        const biome = biomeMap[lx + lz * CHUNK_SIZE];

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          // Unbreakable Bedrock boundaries
          if (y >= 0 && y <= 4) {
            if (y === 0 || Math.random() < (5 - y) / 5) {
               blocks[lx][y][lz] = BLOCKS.BEDROCK;
               continue;
            }
          }
          if (y >= 124 && y <= 128) {
            if (y === 128 || Math.random() < (y - 123) / 5) {
               blocks[lx][y][lz] = BLOCKS.BEDROCK;
               continue;
            }
          }

          const density = getNetherDensity(worldX, y, worldZ);

          if (density > 0) {
            if (biome === 4) { // Basalt Deltas
               blocks[lx][y][lz] = (noiseGen.noise(worldX*0.1, y*0.1, worldZ*0.1) > 0) ? BLOCKS.BASALT : BLOCKS.BLACKSTONE;
            } else if (biome === 3 && y > 30) { // Soul Sand Valley
               blocks[lx][y][lz] = (Math.random() > 0.5) ? BLOCKS.SOUL_SAND : BLOCKS.SOUL_SOIL;
            } else {
               blocks[lx][y][lz] = BLOCKS.NETHERRACK;
            }
          } else if (y < 31) {
            blocks[lx][y][lz] = BLOCKS.LAVA;
          } else {
            blocks[lx][y][lz] = BLOCKS.AIR;
          }
        }
      }
    }

    // Pass 2: Surface Dressing & Structures
    for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
         const biome = biomeMap[lx + lz * CHUNK_SIZE];

         for (let y = 31; y < CHUNK_HEIGHT - 5; y++) {
            const block = blocks[lx][y][lz];
            const above = blocks[lx][y+1][lz];
            const below = blocks[lx][y-1][lz];

            // Floor dressing
            if (block !== BLOCKS.AIR && above === BLOCKS.AIR) {
               if (biome === 1) blocks[lx][y][lz] = BLOCKS.CRIMSON_NYLIUM;
               if (biome === 2) blocks[lx][y][lz] = BLOCKS.WARPED_NYLIUM;

               // Fungal Trees
               if ((biome === 1 || biome === 2) && Math.random() < 0.02) {
                   const isCrimson = biome === 1;
                   const stalk = isCrimson ? BLOCKS.CRIMSON_STALK : BLOCKS.WARPED_STALK;
                   const wart = isCrimson ? BLOCKS.NETHER_WART : BLOCKS.WARPED_WART_BLOCK; // Wait, we don't have warped wart block? Let's use leaves/wart
                   const cap = isCrimson ? BLOCKS.NETHER_WART : BLOCKS.LEAVES; // Will fallback for Warped

                   const height = 4 + Math.floor(Math.random() * 5);
                   if (y + height + 2 < CHUNK_HEIGHT) {
                       // Stem
                       for (let ty = 1; ty <= height; ty++) {
                          if (blocks[lx][y+ty][lz] === BLOCKS.AIR) blocks[lx][y+ty][lz] = stalk;
                       }
                       // Cap
                       for (let ox = -2; ox <= 2; ox++) {
                         for (let oz = -2; oz <= 2; oz++) {
                           if (Math.abs(ox)===2 && Math.abs(oz)===2) continue;
                           if (blocks[lx+ox][y+height][lz+oz] === BLOCKS.AIR) blocks[lx+ox][y+height][lz+oz] = cap;
                           if (blocks[lx+ox][y+height+1][lz+oz] === BLOCKS.AIR && Math.abs(ox)<=1 && Math.abs(oz)<=1) blocks[lx+ox][y+height+1][lz+oz] = cap;
                         }
                       }
                       // Shroomlight
                       if (blocks[lx][y+height][lz] === cap) blocks[lx][y+height][lz] = BLOCKS.SHROOMLIGHT;
                   }
               }

               // Bone ribs
               if (biome === 3 && Math.random() < 0.01) {
                  const height = 3 + Math.floor(Math.random()*4);
                  if (y + height < CHUNK_HEIGHT) {
                      for(let ty=1; ty<=height; ty++) if (blocks[lx][y+ty][lz] === BLOCKS.AIR) blocks[lx][y+ty][lz] = BLOCKS.BONE_BLOCK;
                  }
               }
            }

            // Ceiling dressing
            if (block === BLOCKS.AIR && above !== BLOCKS.AIR) {
               // Glowstone clusters
               if (biome === 0 && Math.random() < 0.03) {
                   blocks[lx][y][lz] = BLOCKS.GLOWSTONE;
                   if (blocks[lx+1][y][lz] === BLOCKS.AIR && Math.random()<0.5) blocks[lx+1][y][lz] = BLOCKS.GLOWSTONE;
                   if (blocks[lx][y][lz+1] === BLOCKS.AIR && Math.random()<0.5) blocks[lx][y][lz+1] = BLOCKS.GLOWSTONE;
                   if (blocks[lx][y-1][lz] === BLOCKS.AIR && Math.random()<0.5) blocks[lx][y-1][lz] = BLOCKS.GLOWSTONE;
               }
               // Weeping vines
               if (biome === 1 && blocks[lx][y][lz] === BLOCKS.AIR && Math.random() < 0.1) {
                   const len = 2 + Math.floor(Math.random()*6);
                   for(let ty=0; ty<len; ty++) {
                      if (y-ty > 0 && blocks[lx][y-ty][lz] === BLOCKS.AIR) blocks[lx][y-ty][lz] = BLOCKS.WEEPING_VINES;
                      else break;
                   }
               }
            }
         }
      }
    }
}




function generateEnd(cx, cz, blocks) {
    const chunkWorldX = cx * CHUNK_SIZE;
    const chunkWorldZ = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const worldX = chunkWorldX + lx;
        const worldZ = chunkWorldZ + lz;
        const distSq = worldX*worldX + worldZ*worldZ;
        const dist = Math.sqrt(distSq);

        // Pre-fill air
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
           blocks[lx][y][lz] = BLOCKS.AIR;
        }

        // Central Island (R <= 100)
        if (dist <= 100) {
            // Flattened top at Y=64, tapers down procedurally
            const distFactor = dist / 100.0;
            const depth = 20 * (1.0 - Math.pow(distFactor, 2)) + noiseGen.noise(worldX*0.05, worldZ*0.05) * 5;

            for (let y = 64; y >= Math.max(0, 64 - depth); y--) {
                blocks[lx][y][lz] = BLOCKS.END_STONE;
            }

            // Obsidian Pillars
            // 10 pillars arranged circularly at roughly R=75
            // Determine if current block is within a pillar
            const angle = Math.atan2(worldZ, worldX);
            const pillarAngleStep = (Math.PI * 2) / 10;
            let onPillar = false;
            let pillarHeight = 0;

            for (let i = 0; i < 10; i++) {
                const targetAngle = i * pillarAngleStep;
                const px = Math.cos(targetAngle) * 75;
                const pz = Math.sin(targetAngle) * 75;
                const dx = worldX - px;
                const dz = worldZ - pz;
                if (dx*dx + dz*dz <= 16) { // Radius 4
                    onPillar = true;
                    // Seeded random height based on pillar index
                    const prng = (Math.sin(i * 12.9898) * 43758.5453) - Math.floor(Math.sin(i * 12.9898) * 43758.5453);
                    pillarHeight = 15 + Math.floor(prng * 25); // 15 to 40
                    break;
                }
            }

            if (onPillar) {
                for (let y = 65; y <= 64 + pillarHeight; y++) {
                    if (y < CHUNK_HEIGHT) blocks[lx][y][lz] = BLOCKS.OBSIDIAN;
                }
                // End Crystal at peak (placed at center of pillar roughly, simplify by placing on top if near center)
                // Actually, placing EndCrystal requires an entity or specific block state. We'll use the block for now at the absolute top center
                // Wait, it's easier to place in Pass 2.
            }

            // Center Portal (Bedrock structure at origin)
            if (Math.abs(worldX) <= 2 && Math.abs(worldZ) <= 2) {
               if (worldX === 0 && worldZ === 0) {
                   for (let y = 65; y <= 68; y++) blocks[lx][y][lz] = BLOCKS.BEDROCK;
               } else if (Math.abs(worldX) === 2 || Math.abs(worldZ) === 2) {
                   blocks[lx][65][lz] = BLOCKS.BEDROCK;
               }
            }
        }
        // Void Gap (R > 100 && R < 1000)
        else if (dist > 100 && dist < 1000) {
            // Do nothing, already air
        }
        // Outer Islands (R >= 1000)
        else {
            // Procedural floating islands
            const baseDensity = noiseGen.fbm3D(worldX * 0.01, 64 * 0.01, worldZ * 0.01, 3);
            if (baseDensity > 0.6) {
                const heightVar = noiseGen.noise(worldX * 0.05, worldZ * 0.05) * 10;
                const topY = Math.floor(64 + heightVar);
                const bottomY = Math.floor(50 + noiseGen.noise(worldX * 0.1, worldZ * 0.1) * 10);

                for (let y = topY; y >= bottomY; y--) {
                   if (y >= 0 && y < CHUNK_HEIGHT) blocks[lx][y][lz] = BLOCKS.END_STONE;
                }
            }
        }
      }
    }

    // Pass 2: Outer Decor (End Cities & Chorus Plants) & Crystals
    for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
        const worldX = chunkWorldX + lx;
        const worldZ = chunkWorldZ + lz;
        const distSq = worldX*worldX + worldZ*worldZ;
        const dist = Math.sqrt(distSq);

        if (dist <= 100) {
            // Check for End Crystal placement on Obsidian pillars
            for (let y = 65; y < CHUNK_HEIGHT - 1; y++) {
               if (blocks[lx][y][lz] === BLOCKS.OBSIDIAN && blocks[lx][y+1][lz] === BLOCKS.AIR) {
                   // Simplified: place End Crystal on top of any obsidian that is the peak.
                   // Since pillar tops are flat, this puts crystals all over the top.
                   // To constrain, only if local coordinate matches center of a pillar approximately.
                   // Given radius 4, if dx=0,dz=0.
                   blocks[lx][y+1][lz] = BLOCKS.END_CRYSTAL;
                   // We actually just want one per pillar. Doing a simple modulo trick based on world coords:
                   if (Math.abs(worldX) % 5 !== 0 || Math.abs(worldZ) % 5 !== 0) {
                       blocks[lx][y+1][lz] = BLOCKS.AIR;
                   }
               }
            }
        } else if (dist >= 1000) {
            for (let y = 50; y < CHUNK_HEIGHT - 20; y++) {
               if (blocks[lx][y][lz] === BLOCKS.END_STONE && blocks[lx][y+1][lz] === BLOCKS.AIR) {
                   // Chorus Plant
                   if (Math.random() < 0.01) {
                       const height = 5 + Math.floor(Math.random() * 10);
                       for (let ty = 1; ty <= height; ty++) {
                           blocks[lx][y+ty][lz] = BLOCKS.CHORUS_STEM;
                       }
                       blocks[lx][y+height][lz] = BLOCKS.CHORUS_FLOWER;
                   }

                   // End City Tower
                   if (Math.random() < 0.001) {
                       const towerHeight = 10 + Math.floor(Math.random() * 15);
                       for (let ty = 1; ty <= towerHeight; ty++) {
                           for (let ox = -2; ox <= 2; ox++) {
                               for (let oz = -2; oz <= 2; oz++) {
                                   if (Math.abs(ox)===2 && Math.abs(oz)===2) continue; // round corners
                                   if (blocks[lx+ox][y+ty][lz+oz] === BLOCKS.AIR) {
                                       blocks[lx+ox][y+ty][lz+oz] = (Math.random()>0.2) ? BLOCKS.PURPUR_BLOCK : BLOCKS.END_STONE_BRICKS;
                                   }
                               }
                           }
                       }
                   }
               }
            }
        }
      }
    }
}


function generateChunkData(cx, cz, savedBlocks = null) {
  const blocks = Array(CHUNK_SIZE).fill(null).map(() =>
    Array(CHUNK_HEIGHT).fill(null).map(() =>
      new Uint8Array(CHUNK_SIZE)
    )
  );

  if (activeDimension === 0) {
    generateOverworld(cx, cz, blocks);
  } else if (activeDimension === 1) {
    generateNether(cx, cz, blocks);
  } else if (activeDimension === 2) {
    generateEnd(cx, cz, blocks);
  }

  if (savedBlocks) {
    savedBlocks.forEach(b => {
      blocks[b.x][b.y][b.z] = b.type;
    });
  }

  return blocks;
}

function buildChunkGeometry(cx, cz) {
  const key = getChunkKey(cx, cz);
  const chunk = chunks[key];
  if (!chunk) return null;

  const positionsSolid = [];
  const normalsSolid = [];
  const uvsSolid = [];

  const positionsTrans = [];
  const normalsTrans = [];
  const uvsTrans = [];

  const faces = [
    { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 0], [1, 1, 1], [1, 0, 1]], uvKey: 'side' },
    { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 1], [0, 1, 0], [0, 0, 0]], uvKey: 'side' },
    { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 1], [1, 1, 0], [0, 1, 0]], uvKey: 'top' },
    { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 0], [1, 0, 1], [0, 0, 1]], uvKey: 'bottom' },
    { dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 1, 1], [0, 0, 1]], uvKey: 'side' },
    { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 0], [1, 1, 0], [1, 0, 0]], uvKey: 'side' }
  ];

  const ATLAS_COLS = 8;
  const ATLAS_ROWS = 8;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const blockType = chunk[lx][y][lz];
        if (blockType === BLOCKS.AIR) continue;

        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const isTransparentBlock = BLOCK_INFO[blockType].transparent;

        for (const face of faces) {
          const nx = wx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = wz + face.dir[2];

          const neighbor = getBlock(nx, ny, nz);

          let drawFace = !neighbor || neighbor.transparent;
          if (drawFace && isTransparentBlock && neighbor) {
            if (neighbor.type === blockType) {
              drawFace = false;
            }
          }

          if (drawFace) {
            const targetPos = isTransparentBlock ? positionsTrans : positionsSolid;
            const targetNorm = isTransparentBlock ? normalsTrans : normalsSolid;
            const targetUv = isTransparentBlock ? uvsTrans : uvsSolid;

            for (const c of face.corners) {
              targetPos.push(wx + c[0], y + c[1], wz + c[2]);
              targetNorm.push(face.dir[0], face.dir[1], face.dir[2]);
            }

            const uvCoord = BLOCK_INFO[blockType].uvs[face.uvKey] || BLOCK_INFO[blockType].uvs['side'];
            const eps = 0.008; // 1-pixel safety margin (1/128) to prevent texture atlas bleeding at flat camera angles
            const uMin = uvCoord[0] / ATLAS_COLS + eps;
            const uMax = (uvCoord[0] + 1) / ATLAS_COLS - eps;
            const vMin = (ATLAS_ROWS - 1 - uvCoord[1]) / ATLAS_ROWS + eps;
            const vMax = (ATLAS_ROWS - uvCoord[1]) / ATLAS_ROWS - eps;

            targetUv.push(
              uMin, vMax,
              uMin, vMin,
              uMax, vMin,
              uMin, vMax,
              uMax, vMin,
              uMax, vMax
            );
          }
        }
      }
    }
  }

  return {
    solid: {
      position: new Float32Array(positionsSolid),
      normal: new Float32Array(normalsSolid),
      uv: new Float32Array(uvsSolid)
    },
    transparent: {
      position: new Float32Array(positionsTrans),
      normal: new Float32Array(normalsTrans),
      uv: new Float32Array(uvsTrans)
    }
  };
}

// Listen to requests from the main game thread
self.onmessage = function(e) {
  const data = e.data;

  if (data.type === 'initChunk') {
    const { cx, cz, savedBlocks } = data;
    const key = getChunkKey(cx, cz);

    // Generate block array in worker thread
    const blocks = generateChunkData(cx, cz, savedBlocks);
    chunks[key] = blocks;

    // Build meshes and return them
    const geometry = buildChunkGeometry(cx, cz);

    // Transfer typed array buffers back with zero overhead serialization (transferables)
    const transfers = [];
    if (geometry) {
      if (geometry.solid.position.length > 0) {
        transfers.push(geometry.solid.position.buffer, geometry.solid.normal.buffer, geometry.solid.uv.buffer);
      }
      if (geometry.transparent.position.length > 0) {
        transfers.push(geometry.transparent.position.buffer, geometry.transparent.normal.buffer, geometry.transparent.uv.buffer);
      }
    }

    self.postMessage({
      type: 'chunkBuilt',
      cx, cz,
      geometry,
      blocks // Return blocks array to let main thread update local cache
    }, transfers);
  }

  else if (data.type === 'rebuildGeometry') {
    const { cx, cz } = data;
    const geometry = buildChunkGeometry(cx, cz);
    const transfers = [];
    if (geometry) {
      if (geometry.solid.position.length > 0) {
        transfers.push(geometry.solid.position.buffer, geometry.solid.normal.buffer, geometry.solid.uv.buffer);
      }
      if (geometry.transparent.position.length > 0) {
        transfers.push(geometry.transparent.position.buffer, geometry.transparent.normal.buffer, geometry.transparent.uv.buffer);
      }
    }
    self.postMessage({
      type: 'geometryRebuilt',
      cx, cz,
      geometry
    }, transfers);
  }

  else if (data.type === 'setBlock') {
    const { x, y, z, blockType } = data;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = getChunkKey(cx, cz);

    let chunk = chunks[key];
    if (chunk) {
      const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      chunk[lx][y][lz] = blockType;
    }
  }

  else if (data.type === 'setDimension') {
    activeDimension = data.dimension;
    // Clear chunks cache in worker when dimension changes
    for (const key in chunks) delete chunks[key];
  }
  else if (data.type === 'setSeed') {
    noiseGen.seed(data.seed);
  }
};

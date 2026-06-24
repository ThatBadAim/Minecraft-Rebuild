// Web Worker for offloading chunk terrain generation and geometry construction.
// This runs on a separate CPU core to prevent main thread stutters.

import { noiseGen, getTerrainHeight, getTerrainHeightAndWater, BiomePipeline, BIOMES, BiomeColorProvider } from './noise.js';
import { TerrainGenerator } from './terrain_generator.js';

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
  ICE: 24,
  SLIME: 25,
  COBWEB: 26,
  SOUL_SAND: 27,
  MAGMA_BLOCK: 28,
  MYCELIUM: 29,
  SANDSTONE: 30,
  SNOW_LAYER: 31,
  EMERALD_ORE: 32,
  MONSTER_EGG: 33,
  CACTUS: 34
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
  [BLOCKS.COAL]: { name: 'Coal Ore', solid: true, transparent: false, uvs: { top: [4, 3], side: [4, 3], bottom: [4, 3] } }
};

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;

// Cache of chunk blocks on the worker
const chunks = {};

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


let generatorInstance = null;

function generateChunkData(cx, cz, savedBlocks = null) {
  const blocks = Array(CHUNK_SIZE).fill(null).map(() =>
    Array(CHUNK_HEIGHT).fill(null).map(() =>
      new Uint8Array(CHUNK_SIZE)
    )
  );

  if (!generatorInstance) {
      generatorInstance = new TerrainGenerator(1337);
  }

  const flatBlocks = generatorInstance.generateBaseTerrain(cx, cz);

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
              blocks[lx][ly][lz] = flatBlocks[lx + lz * 16 + ly * 256];
          }
      }
  }

  if (savedBlocks && savedBlocks.length > 0) {
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

  else if (data.type === 'setSeed') {
    noiseGen.seed(data.seed);
  }
};

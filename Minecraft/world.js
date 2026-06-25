import { noiseGen, getTerrainHeight, getTerrainHeightAndWater } from './noise.js';

// Block definition mappings
export const BLOCKS = {
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

// Metadata for blocks
export const BLOCK_INFO = {
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
  [BLOCKS.ICE]: { name: 'Ice', solid: true, transparent: true, uvs: { top: [5, 3], side: [5, 3], bottom: [5, 3] } },
  [BLOCKS.SLIME]: { name: 'Slime Block', solid: true, transparent: true, uvs: { top: [6, 3], side: [6, 3], bottom: [6, 3] } },
  [BLOCKS.COBWEB]: { name: 'Cobweb', solid: false, transparent: true, uvs: { top: [7, 3], side: [7, 3], bottom: [7, 3] } },
  [BLOCKS.SOUL_SAND]: { name: 'Soul Sand', solid: true, transparent: false, uvs: { top: [2, 0], side: [2, 0], bottom: [2, 0] } },
  [BLOCKS.MAGMA_BLOCK]: { name: 'Magma Block', solid: true, transparent: false, uvs: { top: [1, 1], side: [1, 1], bottom: [1, 1] } }
};

// Add type explicitly to BLOCK_INFO objects
for (const key in BLOCK_INFO) {
  BLOCK_INFO[key].type = parseInt(key, 10);

  // Storage Quantities & Stacking Limits
  const type = BLOCK_INFO[key].type;
  // Unstackable (Max 1): Tools, weapons, armor, potions, boats, and items holding unique internal data (e.g., Shulker Boxes, filled Buckets).
  const unstackables = [BLOCKS.STONE_PICKAXE, BLOCKS.WATER];

  // Limited Stacking (Max 16): Specific utility/throwable items (e.g., Ender Pearls, Eggs, Snowballs, Signs).
  const limitedStackables = [BLOCKS.MEAT, BLOCKS.WOOL, BLOCKS.SLIME, BLOCKS.COBWEB, BLOCKS.TNT, BLOCKS.ICE, BLOCKS.STICK, BLOCKS.TORCH, BLOCKS.MONSTER_EGG];

  if (unstackables.includes(type)) {
    BLOCK_INFO[key].maxStack = 1;
  } else if (limitedStackables.includes(type)) {
    BLOCK_INFO[key].maxStack = 16;
  } else {
    // Standard Stacking (Max 64): Standard blocks and materials (e.g., building blocks, raw resources).
    BLOCK_INFO[key].maxStack = 64;
  }
}

const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;
const TEXTURE_SIZE = 16;

function generateTextureAtlas(onCanvasCreated) {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TEXTURE_SIZE;
  canvas.height = ATLAS_ROWS * TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < ATLAS_ROWS; row++) {
    for (let col = 0; col < ATLAS_COLS; col++) {
      const tx = col * TEXTURE_SIZE;
      const ty = row * TEXTURE_SIZE;
      const id = row * ATLAS_COLS + col;
      ctx.clearRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);

      if (id === 0) { // Grass top
        ctx.fillStyle = '#557a2b';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Create organic grass blade clusters
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            const r = Math.random();
            if (r > 0.85) {
              ctx.fillStyle = '#3c5a1e'; // Shadow grass
            } else if (r > 0.6) {
              ctx.fillStyle = '#679436'; // Highlight grass
            } else {
              ctx.fillStyle = '#557a2b'; // Base grass
            }
            ctx.fillRect(tx + i, ty + j, 1, 1);
          }
        }
      }
      else if (id === 1) { // Grass side
        // Base dirt color
        ctx.fillStyle = '#5c402c';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Dirt noise/rocks
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            if (Math.random() > 0.8) {
              ctx.fillStyle = Math.random() > 0.5 ? '#422e20' : '#735138';
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
        // Dripping grass blades from top
        ctx.fillStyle = '#557a2b';
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          const depth = 3 + Math.floor(Math.sin(i * 1.5) * 2 + Math.random() * 2);
          ctx.fillRect(tx + i, ty, 1, depth);
          // Highlight tips of dripping grass
          ctx.fillStyle = '#679436';
          ctx.fillRect(tx + i, ty + depth - 1, 1, 1);
          ctx.fillStyle = '#557a2b';
        }
      }
      else if (id === 2) { // Dirt
        ctx.fillStyle = '#5c402c';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Texture dirt with pebbles and pockets
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            const r = Math.random();
            if (r > 0.88) {
              ctx.fillStyle = '#3d2719'; // Pebble shadow
              ctx.fillRect(tx + i, ty + j, 1, 1);
            } else if (r > 0.76) {
              ctx.fillStyle = '#7a573e'; // Pebble highlight
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
      }
      else if (id === 3) { // Stone
        ctx.fillStyle = '#737373';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Render detailed cracked stone tile look
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            const r = Math.random();
            if (r > 0.9) {
              ctx.fillStyle = '#4d4d4d'; // Dark cracks
              ctx.fillRect(tx + i, ty + j, 1, 1);
            } else if (r > 0.8) {
              ctx.fillStyle = '#8c8c8c'; // Light highlights
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
        // Subtle rock borders
        ctx.strokeStyle = '#5c5c5c';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
      }
      else if (id === 4) { // Wood top
        ctx.fillStyle = '#d3a36a';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Circular tree rings
        ctx.strokeStyle = '#7c512d';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 2, ty + 2, TEXTURE_SIZE - 4, TEXTURE_SIZE - 4);
        ctx.strokeRect(tx + 5, ty + 5, TEXTURE_SIZE - 10, TEXTURE_SIZE - 10);
        ctx.fillStyle = '#7c512d';
        ctx.fillRect(tx + 7, ty + 7, 2, 2); // Center core
      }
      else if (id === 5) { // Wood side (Bark)
        ctx.fillStyle = '#5c3d24';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Vertical bark grooves
        ctx.fillStyle = '#3c2514';
        for (let i = 0; i < TEXTURE_SIZE; i += 4) {
          const shift = Math.floor(Math.sin(i) * 2);
          ctx.fillRect(tx + i + 1, ty, 1.5, TEXTURE_SIZE);
        }
        // Highlighted ridges
        ctx.fillStyle = '#7c5434';
        for (let i = 2; i < TEXTURE_SIZE; i += 4) {
          ctx.fillRect(tx + i, ty, 1, TEXTURE_SIZE);
        }
      }
      else if (id === 6) { // Leaves
        ctx.fillStyle = '#1c4d1c';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Detailed leaf clustering
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            const r = Math.random();
            if (r > 0.8) {
              ctx.fillStyle = '#0f2b0f'; // Dark foliage gaps
              ctx.fillRect(tx + i, ty + j, 1, 1);
            } else if (r > 0.5) {
              ctx.fillStyle = '#2e7d2e'; // Bright green leaves
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
      }
      else if (id === 7) { // Sand
        ctx.fillStyle = '#dbb883';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Sand ripples
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            const r = Math.sin(i * 0.8 + j * 0.4);
            if (r > 0.7) {
              ctx.fillStyle = '#cfa76e';
              ctx.fillRect(tx + i, ty + j, 1, 1);
            } else if (r < -0.7) {
              ctx.fillStyle = '#e6c89c';
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
      }
      else if (id === 8) { // Glass
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Glare lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(tx + 3, ty + 13);
        ctx.lineTo(tx + 13, ty + 3);
        ctx.moveTo(tx + 6, ty + 13);
        ctx.lineTo(tx + 13, ty + 6);
        ctx.stroke();
      }
      else if (id === 9) { // Brick
        ctx.fillStyle = '#8a3324';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Mortar lines
        ctx.fillStyle = '#ccc2b3';
        ctx.fillRect(tx, ty + 4, TEXTURE_SIZE, 1);
        ctx.fillRect(tx, ty + 9, TEXTURE_SIZE, 1);
        ctx.fillRect(tx, ty + 14, TEXTURE_SIZE, 1);
        ctx.fillRect(tx + 4, ty, 1, 4);
        ctx.fillRect(tx + 12, ty, 1, 4);
        ctx.fillRect(tx + 8, ty + 5, 1, 4);
        ctx.fillRect(tx + 2, ty + 10, 1, 4);
        ctx.fillRect(tx + 10, ty + 10, 1, 4);
        // Brick texture shading
        ctx.fillStyle = '#592016';
        ctx.fillRect(tx + 1, ty + 1, 2, 2);
        ctx.fillRect(tx + 9, ty + 6, 2, 2);
        ctx.fillStyle = '#aa4c3b';
        ctx.fillRect(tx + 5, ty + 1, 2, 2);
        ctx.fillRect(tx + 1, ty + 6, 2, 2);
      }
      else if (id === 10) { // Planks
        ctx.fillStyle = '#bf9b68';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Horizontal plank cuts
        ctx.fillStyle = '#7a5f39';
        ctx.fillRect(tx, ty + 4, TEXTURE_SIZE, 1);
        ctx.fillRect(tx, ty + 9, TEXTURE_SIZE, 1);
        ctx.fillRect(tx, ty + 14, TEXTURE_SIZE, 1);
        // Vertical seams
        ctx.fillRect(tx + 5, ty, 1, 4);
        ctx.fillRect(tx + 11, ty + 5, 1, 4);
        ctx.fillRect(tx + 3, ty + 10, 1, 4);
        // Grain noise
        ctx.fillStyle = '#a68251';
        ctx.fillRect(tx + 1, ty + 2, 3, 1);
        ctx.fillRect(tx + 7, ty + 7, 3, 1);
      }
      else if (id === 11) { // Bedrock
        ctx.fillStyle = '#1c1124';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Dark rugged volcanic styling
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            const r = Math.random();
            if (r > 0.8) {
              ctx.fillStyle = '#0a050e';
              ctx.fillRect(tx + i, ty + j, 1, 1);
            } else if (r > 0.6) {
              ctx.fillStyle = '#301d3d';
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
      }
      else if (id === 12) { // Pine Wood top
        ctx.fillStyle = '#7a5839';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        ctx.strokeStyle = '#3c2514';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 2, ty + 2, TEXTURE_SIZE - 4, TEXTURE_SIZE - 4);
        ctx.strokeRect(tx + 5, ty + 5, TEXTURE_SIZE - 10, TEXTURE_SIZE - 10);
      }
      else if (id === 13) { // Pine Wood side
        ctx.fillStyle = '#3c2918';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Heavy, dark pine bark lines
        ctx.fillStyle = '#1c1208';
        for (let i = 0; i < TEXTURE_SIZE; i += 3) {
          ctx.fillRect(tx + i, ty, 1.2, TEXTURE_SIZE);
        }
        ctx.fillStyle = '#4c3520';
        for (let i = 1; i < TEXTURE_SIZE; i += 3) {
          ctx.fillRect(tx + i, ty, 0.8, TEXTURE_SIZE);
        }
      }
      else if (id === 14) { // Pine Leaves
        ctx.fillStyle = '#0c2b18';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            const r = Math.random();
            if (r > 0.75) {
              ctx.fillStyle = '#1c4a2c'; // Leaf highlight
              ctx.fillRect(tx + i, ty + j, 1, 1);
            } else if (r < 0.2) {
              ctx.fillStyle = '#051a0e'; // Shadow
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
      }
      else if (id === 15) { // Birch Wood top
        ctx.fillStyle = '#ebd5ba';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        ctx.strokeStyle = '#7c6145';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 2, ty + 2, TEXTURE_SIZE - 4, TEXTURE_SIZE - 4);
        ctx.strokeRect(tx + 5, ty + 5, TEXTURE_SIZE - 10, TEXTURE_SIZE - 10);
      }
      else if (id === 16) { // Birch Wood side (White bark with black stripes)
        ctx.fillStyle = '#eaeaea';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        ctx.fillStyle = '#c7c7c7';
        // Bark shading
        for (let i = 0; i < TEXTURE_SIZE; i += 4) {
          ctx.fillRect(tx + i, ty, 1, TEXTURE_SIZE);
        }
        // Black notches
        ctx.fillStyle = '#222222';
        for (let j = 2; j < TEXTURE_SIZE; j += 4) {
          const len = 4 + Math.floor(Math.random() * 5);
          const start = Math.floor(Math.random() * (TEXTURE_SIZE - len));
          ctx.fillRect(tx + start, ty + j, len, 1.2);
        }
      }
      else if (id === 17) { // Birch Leaves
        ctx.fillStyle = '#5c9e31';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            const r = Math.random();
            if (r > 0.8) {
              ctx.fillStyle = '#7fd44d'; // Spring highlights
              ctx.fillRect(tx + i, ty + j, 1, 1);
            } else if (r < 0.25) {
              ctx.fillStyle = '#3f701f'; // Deeper shade
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
      }
      else if (id === 18) { // Water
        ctx.fillStyle = 'rgba(35, 137, 218, 0.65)';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        ctx.fillStyle = 'rgba(77, 166, 255, 0.75)';
        // Ripple patterns
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            if ((i + j) % 6 === 0 || (i - j) % 6 === 0) {
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
      }
      else if (id === 19) { // Stick
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx + 2, ty + 14);
        ctx.lineTo(tx + 14, ty + 2);
        ctx.stroke();
        // Stick lighting highlight
        ctx.strokeStyle = '#b57a42';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx + 3, ty + 13);
        ctx.lineTo(tx + 13, ty + 3);
        ctx.stroke();
      }
      else if (id === 20) { // Stone Pickaxe
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Wooden handle
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx + 3, ty + 13);
        ctx.lineTo(tx + 11, ty + 5);
        ctx.stroke();
        // Pickaxe head
        ctx.strokeStyle = '#7a7a7a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(tx + 5, ty + 2);
        ctx.lineTo(tx + 14, ty + 11);
        ctx.stroke();
        // Steel tip highlight
        ctx.strokeStyle = '#b0b0b0';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tx + 5, ty + 2);
        ctx.lineTo(tx + 6, ty + 3);
        ctx.moveTo(tx + 13, ty + 10);
        ctx.lineTo(tx + 14, ty + 11);
        ctx.stroke();
      }
      else if (id === 21) { // Crafting Table top (col 5, row 2)
        ctx.fillStyle = '#bfa37a';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Outer dark wood border
        ctx.strokeStyle = '#5a3d24';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tx + 1, ty + 1, TEXTURE_SIZE - 2, TEXTURE_SIZE - 2);
        // 3x3 Grid pattern lines
        ctx.strokeStyle = '#7c512d';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 4, ty + 4, 8, 8);
        ctx.beginPath();
        ctx.moveTo(tx + 8, ty + 4); ctx.lineTo(tx + 8, ty + 12);
        ctx.moveTo(tx + 4, ty + 8); ctx.lineTo(tx + 12, ty + 8);
        ctx.stroke();
      }
      else if (id === 22) { // Crafting Table side (col 6, row 2)
        ctx.fillStyle = '#bf9b68';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Planks side borders
        ctx.fillStyle = '#7a5f39';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, 1);
        ctx.fillRect(tx, ty + 15, TEXTURE_SIZE, 1);
        ctx.fillRect(tx, ty + 8, TEXTURE_SIZE, 1);
        // Stylized small hammer hanging on side
        ctx.fillStyle = '#8b5a2b'; // handle
        ctx.fillRect(tx + 4, ty + 4, 1, 9);
        ctx.fillStyle = '#7a7a7a'; // head
        ctx.fillRect(tx + 2, ty + 3, 5, 2);
        // Shading/pegs
        ctx.fillStyle = '#3c2514';
        ctx.fillRect(tx + 9, ty + 5, 1, 1);
        ctx.fillRect(tx + 12, ty + 7, 1, 1);
      }
      else if (id === 25) { // Torch (col 1, row 3)
        // Dark background
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Brown stick
        ctx.fillStyle = '#6b4226';
        ctx.fillRect(tx + 7, ty + 6, 2, 10);
        // Stick highlight
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(tx + 7, ty + 7, 1, 8);
        // Flame base (orange)
        ctx.fillStyle = '#e67300';
        ctx.fillRect(tx + 6, ty + 4, 4, 3);
        // Flame core (yellow)
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(tx + 7, ty + 3, 2, 3);
        // Flame tip (bright yellow)
        ctx.fillStyle = '#ffee55';
        ctx.fillRect(tx + 7, ty + 2, 2, 2);
        // Flame top point
        ctx.fillStyle = '#fff4aa';
        ctx.fillRect(tx + 7, ty + 1, 1, 1);
      }
      else if (id === 26) { // TNT top (col 2, row 3)
        // Tan/beige base
        ctx.fillStyle = '#d4a574';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Subtle texture
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            if (Math.random() > 0.85) {
              ctx.fillStyle = '#c49464';
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
        // Cross pattern
        ctx.fillStyle = '#8b6040';
        ctx.fillRect(tx + 7, ty, 2, TEXTURE_SIZE);
        ctx.fillRect(tx, ty + 7, TEXTURE_SIZE, 2);
        // Dark center circle (fuse hole)
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(tx + 6, ty + 6, 4, 4);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(tx + 7, ty + 7, 2, 2);
      }
      else if (id === 27) { // TNT side (col 3, row 3)
        // Red base
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Red texture variation
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            if (Math.random() > 0.85) {
              ctx.fillStyle = '#a93226';
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
        // Horizontal tan band across middle
        ctx.fillStyle = '#f5deb3';
        ctx.fillRect(tx, ty + 6, TEXTURE_SIZE, 4);
        // TNT text approximation with dark red rectangles
        ctx.fillStyle = '#6b1a0f';
        // T
        ctx.fillRect(tx + 2, ty + 7, 3, 1);
        ctx.fillRect(tx + 3, ty + 7, 1, 3);
        // N
        ctx.fillRect(tx + 6, ty + 7, 1, 3);
        ctx.fillRect(tx + 7, ty + 8, 1, 1);
        ctx.fillRect(tx + 8, ty + 7, 1, 3);
        // T
        ctx.fillRect(tx + 10, ty + 7, 3, 1);
        ctx.fillRect(tx + 11, ty + 7, 1, 3);
      }
      else if (id === 28) { // Coal Ore (col 4, row 3)
        // Stone base
        ctx.fillStyle = '#737373';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        // Stone texture noise
        for (let i = 0; i < TEXTURE_SIZE; i++) {
          for (let j = 0; j < TEXTURE_SIZE; j++) {
            const r = Math.random();
            if (r > 0.9) {
              ctx.fillStyle = '#4d4d4d';
              ctx.fillRect(tx + i, ty + j, 1, 1);
            } else if (r > 0.8) {
              ctx.fillStyle = '#8c8c8c';
              ctx.fillRect(tx + i, ty + j, 1, 1);
            }
          }
        }
        // Coal spots - irregular dark patches
        const coalSpots = [
          { x: 2, y: 2, w: 3, h: 2 },
          { x: 10, y: 1, w: 2, h: 3 },
          { x: 5, y: 6, w: 4, h: 3 },
          { x: 12, y: 7, w: 3, h: 2 },
          { x: 1, y: 10, w: 2, h: 3 },
          { x: 8, y: 11, w: 3, h: 3 },
          { x: 13, y: 12, w: 2, h: 2 },
          { x: 4, y: 13, w: 3, h: 2 }
        ];
        for (const spot of coalSpots) {
          ctx.fillStyle = Math.random() > 0.5 ? '#1a1a1a' : '#2d2d2d';
          ctx.fillRect(tx + spot.x, ty + spot.y, spot.w, spot.h);
          // Dark edge highlight
          ctx.fillStyle = '#111111';
          ctx.fillRect(tx + spot.x, ty + spot.y, spot.w, 1);
        }
      }

      else if (id === 29) { // Ice
        ctx.fillStyle = 'rgba(153, 204, 255, 0.7)';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(tx + 2, ty + 2, 4, 1);
        ctx.fillRect(tx + 10, ty + 8, 3, 1);
      }
      else if (id === 30) { // Slime
        ctx.fillStyle = 'rgba(110, 200, 100, 0.8)';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        ctx.fillStyle = 'rgba(150, 230, 140, 0.9)';
        ctx.fillRect(tx + 4, ty + 4, 8, 8);
      }
      else if (id === 31) { // Cobweb
        ctx.fillStyle = 'rgba(255, 255, 255, 0.0)';
        ctx.fillRect(tx, ty, TEXTURE_SIZE, TEXTURE_SIZE);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(tx, ty); ctx.lineTo(tx + TEXTURE_SIZE, ty + TEXTURE_SIZE);
        ctx.moveTo(tx + TEXTURE_SIZE, ty); ctx.lineTo(tx, ty + TEXTURE_SIZE);
        ctx.moveTo(tx + 8, ty); ctx.lineTo(tx + 8, ty + TEXTURE_SIZE);
        ctx.moveTo(tx, ty + 8); ctx.lineTo(tx + TEXTURE_SIZE, ty + 8);
        ctx.stroke();
      }

    }
  }

  if (onCanvasCreated) onCanvasCreated(canvas);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export class WorldManager {
  constructor(scene, onChunkBuilt = null, onBlockBroken = null) {
    this.scene = scene;
    this.onChunkBuilt = onChunkBuilt;
    this.onBlockBroken = onBlockBroken;
    this.chunkSize = 16;
    this.chunkHeight = 64;

    this.chunks = {};
    this.renderRadius = 6;

    // Load modifications from localStorage
    const saved = localStorage.getItem('minecraft_clone_save');
    if (saved && saved !== 'null' && saved !== 'undefined') {
      try {
        this.modifiedBlocks = JSON.parse(saved) || {};
        this.savedWorldData = this.modifiedBlocks;
      } catch (e) {
        this.modifiedBlocks = {};
        this.savedWorldData = null;
      }
    } else {
      this.modifiedBlocks = {};
      this.savedWorldData = null;
    }

    // Load saved seed or generate a new one
    let seedVal = localStorage.getItem('minecraft_clone_seed');
    if (seedVal && saved && saved !== 'null' && saved !== 'undefined') {
      this.seed = parseInt(seedVal, 10);
    } else {
      this.seed = Math.floor(Math.random() * 1000000000);
      localStorage.setItem('minecraft_clone_seed', this.seed);
    }
    noiseGen.seed(this.seed);

    this.lastPlayerChunkX = null;
    this.lastPlayerChunkZ = null;
    this.meshList = []; // Cached flat array of meshes for lightning-fast raycasting

    this.atlasCanvas = null;
    this.textureAtlas = generateTextureAtlas(canvas => { this.atlasCanvas = canvas; });
    this.materialSolid = new THREE.MeshStandardMaterial({
      map: this.textureAtlas,
      side: THREE.FrontSide,
      transparent: false,
      roughness: 0.8,
      metalness: 0.15
    });

    this.materialTransparent = new THREE.MeshStandardMaterial({
      map: this.textureAtlas,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.1,
      roughness: 0.1,
      metalness: 0.6
    });

    // Initialize Multithreading Web Worker
    this.worker = new Worker('worker.js', { type: 'module' });
    this.setupWorkerListeners();

    // Send the seed to the background worker to ensure matching terrain generation
    this.worker.postMessage({
      type: 'setSeed',
      seed: this.seed
    });

    // Water simulation properties
    this.waterQueue = [];
    this.waterTimer = 0;
    this.waterTickInterval = 0.2; // 200ms ticks
  }

  setupWorkerListeners() {
    this.worker.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'chunkBuilt') {
        const { cx, cz, geometry, blocks } = data;
        const key = this.getChunkKey(cx, cz);

        let chunk = this.chunks[key];
        if (!chunk || !chunk.placeholder) {
          chunk = {
            cx, cz,
            blocks,
            meshSolid: null,
            meshTransparent: null,
            placeholder: false
          };
          this.chunks[key] = chunk;
        } else {
          chunk.blocks = blocks;
          chunk.placeholder = false;
        }

        this.applyChunkGeometry(chunk, geometry);
        if (this.onChunkBuilt) {
          this.onChunkBuilt(cx, cz);
        }
      }

      else if (data.type === 'geometryRebuilt') {
        const { cx, cz, geometry } = data;
        const key = this.getChunkKey(cx, cz);
        const chunk = this.chunks[key];

        if (chunk && !chunk.placeholder) {
          this.applyChunkGeometry(chunk, geometry);
        }
      }
    };
  }

  applyChunkGeometry(chunk, geometry) {
    // Clear old meshes and dispose their GPU buffers
    if (chunk.meshSolid) {
      this.scene.remove(chunk.meshSolid);
      chunk.meshSolid.geometry.dispose();
      const idx = this.meshList.indexOf(chunk.meshSolid);
      if (idx !== -1) this.meshList.splice(idx, 1);
      chunk.meshSolid = null;
    }
    if (chunk.meshTransparent) {
      this.scene.remove(chunk.meshTransparent);
      chunk.meshTransparent.geometry.dispose();
      const idx = this.meshList.indexOf(chunk.meshTransparent);
      if (idx !== -1) this.meshList.splice(idx, 1);
      chunk.meshTransparent = null;
    }

    if (!geometry) return;

    // 1. Build Solid Mesh
    if (geometry.solid.position.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(geometry.solid.position, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(geometry.solid.normal, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(geometry.solid.uv, 2));

      chunk.meshSolid = new THREE.Mesh(geo, this.materialSolid);
      chunk.meshSolid.castShadow = true;
      chunk.meshSolid.receiveShadow = true;
      this.scene.add(chunk.meshSolid);
      this.meshList.push(chunk.meshSolid);
    }

    // 2. Build Transparent Mesh
    if (geometry.transparent.position.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(geometry.transparent.position, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(geometry.transparent.normal, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(geometry.transparent.uv, 2));

      chunk.meshTransparent = new THREE.Mesh(geo, this.materialTransparent);
      chunk.meshTransparent.castShadow = true;
      chunk.meshTransparent.receiveShadow = true;
      chunk.meshTransparent.layers.set(1); // OIT Translucent Layer
      this.scene.add(chunk.meshTransparent);
      this.meshList.push(chunk.meshTransparent);
    }
  }

  getChunkCoords(x, z) {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    return { cx, cz };
  }

  getChunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  getBlock(x, y, z) {
    if (y < 0) return BLOCK_INFO[BLOCKS.BEDROCK];
    if (y >= this.chunkHeight) return null;

    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    const key = this.getChunkKey(cx, cz);
    const chunk = this.chunks[key];

    // Fall back to noise calculation if chunk isn't loaded on main thread yet
    if (!chunk || chunk.placeholder || !chunk.blocks) {
      const info = getTerrainHeightAndWater(x, z);
      const height = info.height;
      const waterLevel = info.waterLevel;
      const isPool = info.isPool;

      let type = BLOCKS.AIR;
      if (y === 0) type = BLOCKS.BEDROCK;
      else if (y < height - 4) type = BLOCKS.STONE;
      else if (y < height) type = BLOCKS.DIRT;
      else if (y === height) type = isPool ? BLOCKS.SAND : BLOCKS.GRASS;
      else if (y > height && y <= waterLevel) type = BLOCKS.WATER;

      return BLOCK_INFO[type];
    }

    const lx = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const lz = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;

    // Apply bitmask 0x7FFF to get base block type (ignoring waterlogged bit 0x8000)
    const rawType = chunk.blocks[lx][y][lz];
    const type = rawType & 0x7FFF;
    const blockInfo = Object.assign({}, BLOCK_INFO[type]);
    if (rawType & 0x8000) {
      blockInfo.waterlogged = true;
    }
    return blockInfo;
  }

  setBlock(x, y, z, type) {
    if (y < 1 || y >= this.chunkHeight) return;

    const { cx, cz } = this.getChunkCoords(x, z);
    const key = this.getChunkKey(cx, cz);
    let chunk = this.chunks[key];

    if (!chunk || chunk.placeholder) return;

    const lx = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const lz = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;

    // Update local main thread cache
    chunk.blocks[lx][y][lz] = type;

    // Track modification
    if (!this.modifiedBlocks[key]) {
      this.modifiedBlocks[key] = [];
    }
    const existing = this.modifiedBlocks[key].find(b => b.x === lx && b.y === y && b.z === lz);
    if (existing) {
      existing.type = type;
    } else {
      this.modifiedBlocks[key].push({ x: lx, y, z: lz, type });
    }

    // Dispatch update to background Web Worker thread
    this.worker.postMessage({
      type: 'setBlock',
      x, y, z,
      blockType: type
    });

    // Rebuild affected chunk
    this.worker.postMessage({ type: 'rebuildGeometry', cx, cz });

    // Handle borders
    if (lx === 0) this.worker.postMessage({ type: 'rebuildGeometry', cx: cx - 1, cz });
    if (lx === this.chunkSize - 1) this.worker.postMessage({ type: 'rebuildGeometry', cx: cx + 1, cz });
    if (lz === 0) this.worker.postMessage({ type: 'rebuildGeometry', cx, cz: cz - 1 });
    if (lz === this.chunkSize - 1) this.worker.postMessage({ type: 'rebuildGeometry', cx, cz: cz + 1 });

    // Water flow queueing logic
    if (type === BLOCKS.WATER) {
      if (!this.waterQueue.some(w => w.x === x && w.y === y && w.z === z)) {
        this.waterQueue.push({ x, y, z, life: 7 }); // N-1 strength max 7
      }
    } else if (type === BLOCKS.AIR) {
      const neighbors = [
        { x: x, y: y + 1, z: z, isAbove: true },
        { x: x + 1, y: y, z: z },
        { x: x - 1, y: y, z: z },
        { x: x, y: y, z: z + 1 },
        { x: x, y: y, z: z - 1 }
      ];
      for (const n of neighbors) {
        const nb = this.getBlock(n.x, n.y, n.z);
        if (nb && nb.type === BLOCKS.WATER) {
          const life = n.isAbove ? 7 : 6;
          if (!this.waterQueue.some(w => w.x === n.x && w.y === n.y && w.z === n.z)) {
            this.waterQueue.push({ x: n.x, y: n.y, z: n.z, life });
          }
        }
      }
    }
  }

  updateWater(deltaTime) {
    this.waterTimer += deltaTime;
    if (this.waterTimer >= this.waterTickInterval) {
      this.waterTimer = 0;
      this.tickWater();
    }
  }

  tickWater() {
    if (this.waterQueue.length === 0) return;

    const nextQueue = [];
    const visited = new Set();

    for (const src of this.waterQueue) {
      const currentBlock = this.getBlock(src.x, src.y, src.z);
      if (!currentBlock || currentBlock.type !== BLOCKS.WATER) continue;

      // 1. Flow down
      const downBlock = this.getBlock(src.x, src.y - 1, src.z);
      // Redstone logic: allow breaking specific blocks (e.g. TORCH, COBWEB)
      const isWaterloggable = downBlock && (downBlock.type === BLOCKS.TORCH || downBlock.type === BLOCKS.COBWEB);
      const canFlowDown = downBlock && (downBlock.type === BLOCKS.AIR || isWaterloggable);

      if (canFlowDown) {
        if (isWaterloggable) {
          if (this.onBlockBroken) this.onBlockBroken(downBlock.type, src.x, src.y - 1, src.z);
          this.setBlock(src.x, src.y - 1, src.z, BLOCKS.WATER); // Redstone rule: break it
        } else {
          this.setBlock(src.x, src.y - 1, src.z, BLOCKS.WATER);
        }
        const key = `${src.x},${src.y - 1},${src.z}`;
        if (!visited.has(key)) {
          visited.add(key);
          nextQueue.push({ x: src.x, y: src.y - 1, z: src.z, life: 7 }); // Downward flow resets to max strength
        }
      }

      // 2. Spread horizontally
      // Only spread horizontally if we cannot flow down or if we are already a source/strong flowing block
      if (!canFlowDown && src.life > 1) {
        const neighbors = [
          { x: src.x + 1, y: src.y, z: src.z },
          { x: src.x - 1, y: src.y, z: src.z },
          { x: src.x, y: src.y, z: src.z + 1 },
          { x: src.x, y: src.y, z: src.z - 1 }
        ];
        for (const n of neighbors) {
          const nb = this.getBlock(n.x, n.y, n.z);
          const isNbWaterloggable = nb && (nb.type === BLOCKS.TORCH || nb.type === BLOCKS.COBWEB);

          if (nb && (nb.type === BLOCKS.AIR || isNbWaterloggable)) {
            if (isNbWaterloggable) {
              if (this.onBlockBroken) this.onBlockBroken(nb.type, n.x, n.y, n.z);
              this.setBlock(n.x, n.y, n.z, BLOCKS.WATER); // Redstone rule: break it
            } else {
              this.setBlock(n.x, n.y, n.z, BLOCKS.WATER);
            }
            const key = `${n.x},${n.y},${n.z}`;
            if (!visited.has(key)) {
              visited.add(key);
              nextQueue.push({ x: n.x, y: n.y, z: n.z, life: src.life - 1 });
            }
          }
        }
      }
    }
    this.waterQueue = nextQueue;
  }

  saveWorld() {
    localStorage.setItem('minecraft_clone_save', JSON.stringify(this.modifiedBlocks));
    this.savedWorldData = this.modifiedBlocks; // update cache

    const ind = document.getElementById('save-indicator');
    if (ind) {
      ind.classList.remove('hidden');
      ind.classList.remove('fade-out');
      void ind.offsetWidth;
      ind.classList.add('fade-out');
    }
  }

  loadWorld() {
    const saved = localStorage.getItem('minecraft_clone_save');
    if (!saved) return false;
    try {
      return JSON.parse(saved);
    } catch(e) {
      return false;
    }
  }

  generateWorldAroundPlayer(playerX, playerZ) {
    const { cx: centerCx, cz: centerCz } = this.getChunkCoords(playerX, playerZ);

    // Boundary check optimization
    if (centerCx === this.lastPlayerChunkX && centerCz === this.lastPlayerChunkZ) {
      return;
    }
    this.lastPlayerChunkX = centerCx;
    this.lastPlayerChunkZ = centerCz;

    // Unload out-of-range chunks to prevent massive memory and draw call leaks
    for (const key in this.chunks) {
      const chunk = this.chunks[key];
      const dx = chunk.cx - centerCx;
      const dz = chunk.cz - centerCz;

      if (Math.abs(dx) > this.renderRadius || Math.abs(dz) > this.renderRadius) {
        // Remove meshes from Three.js scene and dispose their geometry GPU buffers
        if (chunk.meshSolid) {
          this.scene.remove(chunk.meshSolid);
          chunk.meshSolid.geometry.dispose();
          const idx = this.meshList.indexOf(chunk.meshSolid);
          if (idx !== -1) this.meshList.splice(idx, 1);
        }
        if (chunk.meshTransparent) {
          this.scene.remove(chunk.meshTransparent);
          chunk.meshTransparent.geometry.dispose();
          const idx = this.meshList.indexOf(chunk.meshTransparent);
          if (idx !== -1) this.meshList.splice(idx, 1);
        }
        // Delete from main thread cache
        delete this.chunks[key];
      }
    }

    const savedData = this.savedWorldData;

    const chunksToLoad = [];
    for (let x = -this.renderRadius; x <= this.renderRadius; x++) {
      for (let z = -this.renderRadius; z <= this.renderRadius; z++) {
        const cx = centerCx + x;
        const cz = centerCz + z;
        const key = this.getChunkKey(cx, cz);

        if (!this.chunks[key]) {
          const distSq = x * x + z * z;
          chunksToLoad.push({ cx, cz, key, distSq });
        }
      }
    }

    // Sort chunks by distance (closest first) to prioritize nearby chunks
    chunksToLoad.sort((a, b) => a.distSq - b.distSq);

    for (const chunk of chunksToLoad) {
      // Set placeholder to mark chunk is loading asynchronously
      this.chunks[chunk.key] = {
        cx: chunk.cx,
        cz: chunk.cz,
        blocks: null,
        meshSolid: null,
        meshTransparent: null,
        placeholder: true
      };

      // Send chunk generation request to the Web Worker thread
      this.worker.postMessage({
        type: 'initChunk',
        cx: chunk.cx,
        cz: chunk.cz,
        savedBlocks: savedData ? savedData[chunk.key] : null
      });
    }
  }
}

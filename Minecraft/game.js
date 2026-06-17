import { PhysicsEngine } from './physics.js';
import { WorldManager, BLOCKS, BLOCK_INFO } from './world.js';
import { gameAudio } from './audio.js';
import { EntityManager } from './entities.js';

class GameController {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. Core Three.js Setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x8bc0d9, 0.015);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 2. Physics & World
    this.physics = new PhysicsEngine();
    this.playerHealth = 20;
    this.maxPlayerHealth = 20;
    this.playerHunger = 20;
    this.maxPlayerHunger = 20;
    this.hungerTimer = 0;
    this.healTimer = 0;
    this.starveTimer = 0;

    this.entityManager = new EntityManager(this.scene, (dmg) => this.takeDamage(dmg), (type) => this.handleCollect(type));
    this.world = new WorldManager(this.scene, (cx, cz) => {
      this.entityManager.spawnAnimalInChunk(cx, cz, this.world, this.gameTime);
    });

    // 3. User Controls
    this.controls = new THREE.PointerLockControls(this.camera, document.body);
    this.keys = {};

    // Active hotbar slot selection index
    this.activeSlotIndex = 0; // 0 to 8
    this.isInventoryOpen = false;
    this.isCraftingOpen = false;

    // Slot-based Inventory: 36 slots (0-26 main inventory, 27-35 hotbar)
    this.inventorySlots = Array(36).fill(null);
    this.offhandSlot = null;

    // Cursor dragging and storage rules
    this.cursorStack = null;
    this.hoveredSlotIndex = null;
    this.hoveredSlotType = null; // 'main', 'hotbar', 'craft-in', 'craft-out', 'offhand'
    this.isDraggingLeft = false;
    this.isDraggingRight = false;
    this.draggedSlots = new Map();
    this.dragStartStackCount = 0;

    // 2x2 Crafting Grid states (0-3 input slots, output)
    this.inventoryCraftGrid = Array(4).fill(null);
    this.inventoryCraftOutput = null;

    // Starter inventory setup (hotbar populated first)    // Default slots
    this.inventorySlots[27] = { type: BLOCKS.GRASS, count: 64 };
    this.inventorySlots[28] = { type: BLOCKS.DIRT, count: 64 };
    this.inventorySlots[29] = { type: BLOCKS.STONE, count: 64 };
    this.inventorySlots[30] = { type: BLOCKS.WOOD, count: 64 };
    this.inventorySlots[31] = { type: BLOCKS.LEAVES, count: 64 };
    this.inventorySlots[32] = { type: BLOCKS.SAND, count: 64 };
    this.inventorySlots[33] = { type: BLOCKS.GLASS, count: 64 };
    this.inventorySlots[34] = { type: BLOCKS.BRICK, count: 64 };
    this.inventorySlots[35] = { type: BLOCKS.PLANKS, count: 64 };

  // Crafting Recipes
    this.recipes = [
      {
        result: BLOCKS.PLANKS,
        resultCount: 4,
        ingredients: [
          { type: BLOCKS.WOOD, count: 1 }
        ]
      },
      {
        result: BLOCKS.STICK,
        resultCount: 4,
        ingredients: [
          { type: BLOCKS.PLANKS, count: 2 }
        ]
      },
      {
        result: BLOCKS.CRAFTING_TABLE,
        resultCount: 1,
        ingredients: [
          { type: BLOCKS.PLANKS, count: 4 }
        ]
      },
      {
        result: BLOCKS.STONE_PICKAXE,
        resultCount: 1,
        ingredients: [
          { type: BLOCKS.STONE, count: 3 },
          { type: BLOCKS.STICK, count: 2 }
        ]
      },
      {
        result: BLOCKS.BRICK,
        resultCount: 1,
        ingredients: [
          { type: BLOCKS.PLANKS, count: 4 }
        ]
      },
      {
        result: BLOCKS.TNT,
        resultCount: 1,
        ingredients: [
          { type: BLOCKS.SAND, count: 4 },
          { type: BLOCKS.COAL, count: 1 }
        ]
      },
      {
        result: BLOCKS.TORCH,
        resultCount: 4,
        ingredients: [
          { type: BLOCKS.STICK, count: 1 },
          { type: BLOCKS.COAL, count: 1 }
        ]
      }
    ];

    // Interaction Raycasting
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 6.0; // Reach distance of player
    this.targetBlock = null; // Coordinates of target: { x, y, z, faceNormal, adjacent }

    // Day-Night Cycle & Lighting
    this.gameTime = 8.0; // Starts at 8:00 AM (8.0)
    this.timeScale = 0.05; // Rate of time progression
    this.setupLighting();
    this.setupStars();

    // Outline highlight for block targeted
    this.setupSelectionOutline();

    // Cloud setup
    this.setupClouds();

    // Particle physics pool
    this.particles = [];
    this.sharedParticleGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.particleMaterialCache = {};
    this.particlePool = []; // Object pool for particle meshes
    this.maxPoolSize = 60;

    // Breaking state
    this.isBreaking = false;
    this.isMouseDown = false;
    this.breakProgress = 0;
    this.breakTarget = null;
    this.setupBreakingOverlay();

    // Icon cache to avoid slow toDataURL calls during blocks placing/breaking
    this.iconDataUrlCache = {};

    // Oxygen / underwater system
    this.oxygenLevel = 30.0; // 30 seconds of breath
    this.maxOxygen = 30.0;
    this.oxygenDamageTimer = 0;

    // Sprint FOV
    this.baseFov = 75;
    this.currentFov = 75;
    this.targetFov = 75;

    // Minimap
    this.minimapVisible = true;
    this.minimapUpdateTimer = 0;

    // Damage flash
    this.damageFlashEl = document.getElementById('damage-flash');

    // Loading screen
    this.loadingScreen = document.getElementById('loading-screen');
    this.loadingBar = document.getElementById('loading-bar');
    this.loadingText = document.getElementById('loading-text');
    this.isLoading = true;
    this.loadProgress = 0;

    // Torch lights tracking (max 16 active)
    this.torchLights = [];
    this.maxTorchLights = 16;

    // Cached colors for water fog (GC fix)
    this.waterFogClearColor = new THREE.Color(0x0a1e35);
    this.waterFogColor = new THREE.Color(0x0f2a4a);

    // UI update throttle
    this.uiUpdateTimer = 0;
    this.uiUpdateInterval = 0.25; // Update DOM elements every 250ms

    // Game loops
    this.clock = new THREE.Clock();
    this.fpsLastUpdate = 0;
    this.fpsFrames = 0;
    this.lastFpsValue = 60;
    this.lastPosString = '0, 60, 0';

    // Initialize UI and Events
    this.setupEvents();
    this.buildHotbarUI();
    this.buildInventoryGridUI();
    this.updateStatsHUD();
    this.loadInventory(); // Restore inventory from localStorage

    // Show loading progress
    if (this.loadingBar) this.loadingBar.style.width = '30%';
    if (this.loadingText) this.loadingText.innerText = 'Building terrain...';

    // Initial world generation around starting coordinate
    this.world.generateWorldAroundPlayer(8, 8);
    this.teleportToGround();

    if (this.loadingBar) this.loadingBar.style.width = '80%';
    if (this.loadingText) this.loadingText.innerText = 'Preparing game...';

    // Auto-save loop (now includes inventory)
    setInterval(() => {
      if (this.controls.isLocked) {
        this.world.saveWorld();
        this.saveInventory();
      }
    }, 30000);

    // Fade out loading screen after a short delay
    setTimeout(() => {
      if (this.loadingBar) this.loadingBar.style.width = '100%';
      if (this.loadingText) this.loadingText.innerText = 'Done!';
      setTimeout(() => {
        if (this.loadingScreen) {
          this.loadingScreen.classList.add('fade-out-loading');
          setTimeout(() => {
            this.loadingScreen.style.display = 'none';
            this.isLoading = false;
          }, 800);
        }
      }, 300);
    }, 500);

    // Start rendering frame loop
    this.animate();
  }

  saveInventory() {
    const serialized = this.inventorySlots.map(slot => slot ? { type: slot.type, count: slot.count } : null);
    localStorage.setItem('minecraft_clone_inventory', JSON.stringify(serialized));
  }

  loadInventory() {
    const saved = localStorage.getItem('minecraft_clone_inventory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 36) {
          this.inventorySlots = parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved inventory', e);
      }
    }
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.95);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;

    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 250;
    this.sunLight.shadow.camera.left = -80;
    this.sunLight.shadow.camera.right = 80;
    this.sunLight.shadow.camera.top = 80;
    this.sunLight.shadow.camera.bottom = -80;
    this.sunLight.shadow.bias = -0.0008;
    this.scene.add(this.sunLight);

    // Sun Visual Mesh
    const sunGeo = new THREE.BoxGeometry(14, 14, 14);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3a0, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    // Moon Visual Mesh
    const moonGeo = new THREE.BoxGeometry(10, 10, 10);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe0e6ed, fog: false });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);
  }

  setupStars() {
    const starCount = 300;
    const geo = new THREE.BufferGeometry();
    const positions = [];

    for (let i = 0; i < starCount; i++) {
      // Spawn star on high shell dome
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 250; // Far sphere radius

      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        Math.abs(r * Math.sin(phi) * Math.sin(theta)), // Only upper dome
        r * Math.cos(phi)
      );
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      transparent: true,
      opacity: 0
    });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  setupSelectionOutline() {
    const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    this.selectionOutline = new THREE.LineSegments(edges, lineMat);
    this.selectionOutline.visible = false;
    this.scene.add(this.selectionOutline);
  }

  setupBreakingOverlay() {
    this.breakCanvas = document.createElement('canvas');
    this.breakCanvas.width = 64;
    this.breakCanvas.height = 64;
    this.breakCtx = this.breakCanvas.getContext('2d');

    this.breakTexture = new THREE.CanvasTexture(this.breakCanvas);
    this.breakTexture.magFilter = THREE.NearestFilter;

    const mat = new THREE.MeshBasicMaterial({
      map: this.breakTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const geo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    this.breakingOverlay = new THREE.Mesh(geo, mat);
    this.breakingOverlay.visible = false;
    this.scene.add(this.breakingOverlay);
  }

  updateBreakingOverlay(progressFraction) {
    const ctx = this.breakCtx;
    ctx.clearRect(0, 0, 64, 64);
    if (progressFraction <= 0) {
      this.breakTexture.needsUpdate = true;
      return;
    }

    // Draw procedural cracks
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 2.5;

    // Crack configurations based on progress stages (1 to 10)
    const stages = Math.min(10, Math.floor(progressFraction * 10) + 1);

    const points = [
      { x: 32, y: 32 },
      { x: 20, y: 22 },
      { x: 44, y: 18 },
      { x: 18, y: 42 },
      { x: 48, y: 46 },
      { x: 10, y: 12 },
      { x: 54, y: 8 },
      { x: 8, y: 54 },
      { x: 56, y: 56 },
      { x: 32, y: 10 },
      { x: 10, y: 32 },
      { x: 54, y: 32 },
      { x: 32, y: 54 }
    ];

    ctx.beginPath();
    // Connect center to outer points depending on stages
    for (let i = 1; i <= stages && i < points.length; i++) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[i].x, points[i].y);

      // Draw sub-branches
      if (stages > 4 && i > 1) {
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[i].x + (points[i].x - 32) * 0.4 + (i % 2 === 0 ? 5 : -5), points[i].y + (points[i].y - 32) * 0.4 + (i % 2 === 0 ? -5 : 5));
      }
    }
    ctx.stroke();

    this.breakTexture.needsUpdate = true;
  }

  updateBreaking(dt) {
    if (this.isBreaking && this.targetBlock) {
      const { x, y, z } = this.targetBlock;
      // If target changed, reset progress
      if (!this.breakTarget || this.breakTarget.x !== x || this.breakTarget.y !== y || this.breakTarget.z !== z) {
        this.breakProgress = 0;
        this.breakTarget = { x, y, z };
      }

      const block = this.world.getBlock(x, y, z);
      if (block && block.type !== BLOCKS.BEDROCK && block.type !== BLOCKS.AIR) {
        // Calculate break time in seconds matching Minecraft standard speeds
        let breakTime = 0.75; // Default for Grass, Dirt, Sand

        const type = block.type;
        if (type === BLOCKS.LEAVES || type === BLOCKS.PINE_LEAVES || type === BLOCKS.BIRCH_LEAVES) {
          breakTime = 0.3; // Leaves are very fast
        } else if (type === BLOCKS.WOOD || type === BLOCKS.PINE_WOOD || type === BLOCKS.BIRCH_WOOD || type === BLOCKS.PLANKS) {
          breakTime = 3.0; // Wood/planks take 3.0s with hand
        } else if (type === BLOCKS.CRAFTING_TABLE) {
          breakTime = 3.75; // Crafting table takes 3.75s with hand
        } else if (type === BLOCKS.STONE || type === BLOCKS.BRICK) {
          breakTime = 7.5; // Stone/Brick takes 7.5s with hand
        }

        // Pickaxe tool speed multiplier
        const activeSlot = this.inventorySlots[27 + this.activeSlotIndex];
        const holdingPickaxe = activeSlot && activeSlot.type === BLOCKS.STONE_PICKAXE;
        if (holdingPickaxe && (type === BLOCKS.STONE || type === BLOCKS.BRICK)) {
          breakTime = 0.6; // 12.5x speed when using stone pickaxe on stone/brick (0.6s)
        }

        this.breakProgress += dt;

        const fraction = Math.min(1.0, this.breakProgress / breakTime);
        this.breakingOverlay.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.breakingOverlay.visible = true;
        this.updateBreakingOverlay(fraction);

        if (this.breakProgress >= breakTime) {
          this.breakTargetBlock();
          this.isBreaking = this.isMouseDown; // Keep breaking if mouse is held down
          this.breakProgress = 0;
          this.breakTarget = null;
          this.breakingOverlay.visible = false;
        }
      } else {
        this.breakingOverlay.visible = false;
        this.breakProgress = 0;
      }
    } else {
      if (this.breakingOverlay && this.breakingOverlay.visible) {
        this.breakingOverlay.visible = false;
      }
      this.breakProgress = 0;
      this.breakTarget = null;
    }
  }

  setupClouds() {
    this.cloudsGroup = new THREE.Group();
    this.scene.add(this.cloudsGroup);

    this.cloudMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });

    this.clouds = [];

    // Create 15 cloud clusters
    for (let i = 0; i < 15; i++) {
      const cluster = new THREE.Group();

      const cx = (Math.random() - 0.5) * 350;
      const cz = (Math.random() - 0.5) * 350;
      const cy = 52 + Math.random() * 4;
      cluster.position.set(cx, cy, cz);

      // Overlapping box clusters
      const boxCount = 3 + Math.floor(Math.random() * 4);
      for (let b = 0; b < boxCount; b++) {
        const w = 8 + Math.floor(Math.random() * 12);
        const h = 1.5 + Math.random() * 1.0;
        const d = 8 + Math.floor(Math.random() * 12);

        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, this.cloudMaterial);

        const ox = (Math.random() - 0.5) * 12;
        const oz = (Math.random() - 0.5) * 12;
        mesh.position.set(ox, 0, oz);

        cluster.add(mesh);
      }

      this.cloudsGroup.add(cluster);
      this.clouds.push(cluster);
    }
  }

  updateClouds(dt) {
    if (!this.clouds) return;
    const speed = 1.2;
    const maxDist = 220;
    const playerX = this.physics.position.x;
    const playerZ = this.physics.position.z;

    this.clouds.forEach(cluster => {
      cluster.position.x += speed * dt;

      if (cluster.position.x - playerX > maxDist) {
        cluster.position.x = playerX - maxDist;
        cluster.position.z = playerZ + (Math.random() - 0.5) * maxDist * 2;
      }
    });
  }

  teleportToGround() {
    this.physics.velocity.set(0, 0, 0);
    this.physics.position.x = 8;
    this.physics.position.z = 8;
    let spawnY = 30; // Default fallback

    // Make sure chunks exist
    const block = this.world.getBlock(8, 0, 8);
    if (!block || block.type === BLOCKS.AIR && this.world.chunks['0,0'] && this.world.chunks['0,0'].placeholder) {
      // Chunk not loaded yet
      spawnY = 60;
    } else {
      for (let y = this.world.chunkHeight - 1; y >= 0; y--) {
        const check = this.world.getBlock(8, y, 8);
        if (check && check.solid) {
          spawnY = y + 1;
          break;
        }
      }
    }

    this.physics.position.y = spawnY;
    this.physics.onGround = true;
  }

  takeDamage(amount) {
    if (this.playerHealth <= 0) return;
    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.updateStatsHUD();
    if (gameAudio && gameAudio.playHurtSound) {
      gameAudio.playHurtSound();
    }

    // Damage flash overlay
    if (this.damageFlashEl) {
      this.damageFlashEl.classList.remove('fading');
      this.damageFlashEl.classList.add('active');
      setTimeout(() => {
        if (this.damageFlashEl) {
          this.damageFlashEl.classList.remove('active');
          this.damageFlashEl.classList.add('fading');
        }
      }, 100);
    }

    if (this.playerHealth <= 0) {
      this.controls.unlock();
    }
  }

  handleCollect(type) {
    if (typeof type === 'number') {
      this.addToInventory(type, 1);
      this.scheduleUIRefresh();
    } else {
      this.entityManager.counts[type]++;
      const el = document.getElementById(`${type}-count`);
      if (el) el.innerText = this.entityManager.counts[type];
    }
    if (gameAudio && gameAudio.playPlaceSound) {
      gameAudio.playPlaceSound();
    }
  }

  scheduleUIRefresh() {
    if (this._uiRefreshScheduled) return;
    this._uiRefreshScheduled = true;
    requestAnimationFrame(() => {
      this._uiRefreshScheduled = false;
      this.buildHotbarUI();
      if (this.isInventoryOpen) {
        this.buildInventoryGridUI();
      }
    });
  }

  updateStatsHUD() {
    const heartsRow = document.getElementById('hearts-row');
    const hungerRow = document.getElementById('hunger-row');
    if (!heartsRow || !hungerRow) return;

    let heartsHtml = '';
    for (let i = 0; i < 10; i++) {
      const heartVal = (i + 1) * 2;
      if (this.playerHealth >= heartVal) {
        heartsHtml += `<svg class="hud-icon" viewBox="0 0 9 9" style="width: 18px; height: 18px; image-rendering: pixelated;"><path fill="#000" d="M1 2h2v1h-2zM3 1h3v1h-3zM6 2h2v1h-2zM0 3h1v3h-1zM1 6h1v1h-1zM2 7h1v1h-1zM3 8h3v1h-3zM6 7h1v1h-1zM7 6h1v1h-1zM8 3h1v3h-1z"/><path fill="#f00" d="M1 3h7v1h-7zM1 4h7v1h-7zM1 5h7v1h-7zM2 6h5v1h-5zM3 7h3v1h-3z"/></svg>`;
      } else if (this.playerHealth === heartVal - 1) {
        heartsHtml += `<svg class="hud-icon" viewBox="0 0 9 9" style="width: 18px; height: 18px; image-rendering: pixelated;"><path fill="#000" d="M1 2h2v1h-2zM3 1h3v1h-3zM6 2h2v1h-2zM0 3h1v3h-1zM1 6h1v1h-1zM2 7h1v1h-1zM3 8h3v1h-3zM6 7h1v1h-1zM7 6h1v1h-1zM8 3h1v3h-1z"/><path fill="#f00" d="M1 3h3v1h-3zM1 4h3v1h-3zM1 5h3v1h-3zM2 6h2v1h-2zM3 7h1v1h-1z"/></svg>`;
      } else {
        heartsHtml += `<svg class="hud-icon" viewBox="0 0 9 9" style="width: 18px; height: 18px; image-rendering: pixelated;"><path fill="#000" d="M1 2h2v1h-2zM3 1h3v1h-3zM6 2h2v1h-2zM0 3h1v3h-1zM1 6h1v1h-1zM2 7h1v1h-1zM3 8h3v1h-3zM6 7h1v1h-1zM7 6h1v1h-1zM8 3h1v3h-1z"/></svg>`;
      }
    }
    heartsRow.innerHTML = heartsHtml;

    let hungerHtml = '';
    for (let i = 0; i < 10; i++) {
      const hungerVal = (i + 1) * 2;
      if (this.playerHunger >= hungerVal) {
        hungerHtml += `<svg class="hud-icon" viewBox="0 0 9 9" style="width: 18px; height: 18px; image-rendering: pixelated;"><path fill="#000" d="M5 0h2v1h-2zM7 1h2v2h-2zM5 1h1v1h-1zM4 2h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1zM0 5h2v2h-2zM2 7h2v2h-2z"/><path fill="#8b4513" d="M6 1h1v1h-1zM7 2h1v1h-1zM6 2h1v1h-1zM5 2h1v1h-1zM4 3h2v1h-2zM3 4h2v1h-2zM3 5h1v1h-1zM2 5h1v1h-1z"/></svg>`;
      } else if (this.playerHunger === hungerVal - 1) {
        hungerHtml += `<svg class="hud-icon" viewBox="0 0 9 9" style="width: 18px; height: 18px; image-rendering: pixelated;"><path fill="#000" d="M5 0h2v1h-2zM7 1h2v2h-2zM5 1h1v1h-1zM4 2h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1zM0 5h2v2h-2zM2 7h2v2h-2z"/><path fill="#8b4513" d="M6 1h1v1h-1zM7 2h1v1h-1zM6 2h1v1h-1zM5 2h1v1h-1z"/></svg>`;
      } else {
        hungerHtml += `<svg class="hud-icon" viewBox="0 0 9 9" style="width: 18px; height: 18px; image-rendering: pixelated;"><path fill="#000" d="M5 0h2v1h-2zM7 1h2v2h-2zM5 1h1v1h-1zM4 2h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1zM0 5h2v2h-2zM2 7h2v2h-2z"/></svg>`;
      }
    }
    hungerRow.innerHTML = hungerHtml;
  }

  triggerGameOver() {
    this.controls.unlock();
    const goScreen = document.getElementById('screen-gameover');
    if (goScreen) {
      goScreen.classList.remove('hidden');
    }
    const menuScreen = document.getElementById('screen-menu');
    if (menuScreen) {
      menuScreen.classList.add('hidden');
    }
  }

  respawn() {
    this.playerHealth = 20;
    this.playerHunger = 20;
    this.updateStatsHUD();
    const goScreen = document.getElementById('screen-gameover');
    if (goScreen) {
      goScreen.classList.add('hidden');
    }
    this.teleportToGround();
    this.controls.lock();
  }

  setupEvents() {
    const playBtn = document.getElementById('btn-play');
    const menuScreen = document.getElementById('screen-menu');
    const inventoryScreen = document.getElementById('inventory-screen');
    const craftingScreen = document.getElementById('crafting-screen');

    // Load settings from localStorage
    const savedVol = localStorage.getItem('minecraft_clone_volume');
    const savedFov = localStorage.getItem('minecraft_clone_fov');
    const savedDist = localStorage.getItem('minecraft_clone_render_dist');
    const savedSens = localStorage.getItem('minecraft_clone_sensitivity');

    const volVal = savedVol !== null ? parseFloat(savedVol) : 0.7;
    const fovVal = savedFov !== null ? parseInt(savedFov, 10) : 75;
    const distVal = savedDist !== null ? parseInt(savedDist, 10) : 6;
    const sensVal = savedSens !== null ? parseFloat(savedSens) : 1.0;

    // Apply values to UI elements
    const sliderVol = document.getElementById('slider-volume');
    const sliderFov = document.getElementById('slider-fov');
    const sliderDist = document.getElementById('slider-render-dist');
    const sliderSens = document.getElementById('slider-sensitivity');

    const labelVol = document.getElementById('val-volume');
    const labelFov = document.getElementById('val-fov');
    const labelDist = document.getElementById('val-render-dist');
    const labelSens = document.getElementById('val-sensitivity');

    if (sliderVol) {
      sliderVol.value = volVal;
      labelVol.innerText = Math.round(volVal * 100) + '%';
      gameAudio.setVolume(volVal);
      sliderVol.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        labelVol.innerText = Math.round(val * 100) + '%';
        gameAudio.setVolume(val);
        localStorage.setItem('minecraft_clone_volume', val);
      });
    }

    if (sliderFov) {
      sliderFov.value = fovVal;
      labelFov.innerText = fovVal + '°';
      this.camera.fov = fovVal;
      this.camera.updateProjectionMatrix();
      sliderFov.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        labelFov.innerText = val + '°';
        this.camera.fov = val;
        this.camera.updateProjectionMatrix();
        localStorage.setItem('minecraft_clone_fov', val);
      });
    }

    if (sliderDist) {
      sliderDist.value = distVal;
      labelDist.innerText = distVal + ' Chunks';
      this.world.renderRadius = distVal;
      sliderDist.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        labelDist.innerText = val + ' Chunks';
        this.world.renderRadius = val;
        localStorage.setItem('minecraft_clone_render_dist', val);
      });
    }

    if (sliderSens) {
      sliderSens.value = sensVal;
      labelSens.innerText = sensVal.toFixed(1) + 'x';
      this.controls.pointerSpeed = sensVal;
      sliderSens.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        labelSens.innerText = val.toFixed(1) + 'x';
        this.controls.pointerSpeed = val;
        localStorage.setItem('minecraft_clone_sensitivity', val);
      });
    }

    // Controls locking
    playBtn.addEventListener('click', () => {
      if (this.playerHealth <= 0) return;
      this.controls.lock();
      gameAudio.resume();
    });

    this.controls.addEventListener('lock', () => {
      if (this.playerHealth <= 0) return;
      menuScreen.classList.add('hidden');
      inventoryScreen.classList.add('hidden');
      craftingScreen.classList.add('hidden');
      this.isInventoryOpen = false;
      this.isCraftingOpen = false;
    });

    this.controls.addEventListener('unlock', () => {
      this.isMouseDown = false;
      this.isBreaking = false;
      this.breakProgress = 0;
      this.breakTarget = null;
      if (this.breakingOverlay) {
        this.breakingOverlay.visible = false;
      }
      if (this.playerHealth <= 0) {
        document.getElementById('screen-gameover').classList.remove('hidden');
        document.getElementById('screen-menu').classList.add('hidden');
        return;
      }
      if (!this.isInventoryOpen && !this.isCraftingOpen) {
        menuScreen.classList.remove('hidden');
      }
    });

    const respawnBtn = document.getElementById('btn-respawn');
    if (respawnBtn) {
      respawnBtn.addEventListener('click', () => {
        this.respawn();
      });
    }

    // Close overlays when clicking outside
    inventoryScreen.addEventListener('click', (e) => {
      if (e.target === inventoryScreen) {
        this.controls.lock();
      }
    });

    // 2x2 Crafting Grid click bindings
    for (let i = 0; i < 4; i++) {
      const inputEl = document.getElementById(`craft-in-${i}`);
      if (inputEl) {
        inputEl.addEventListener('mouseenter', () => { this.hoveredSlotIndex = i; this.hoveredSlotType = 'craft-in'; this.handleDragUpdate('craft-in', i); });
        inputEl.addEventListener('mouseleave', () => { if (this.hoveredSlotIndex === i && this.hoveredSlotType === 'craft-in') { this.hoveredSlotIndex = null; this.hoveredSlotType = null; } });
      }
    }
    const craftOutputEl = document.getElementById('craft-out');
    if (craftOutputEl) {
      craftOutputEl.addEventListener('mouseenter', () => { this.hoveredSlotIndex = 0; this.hoveredSlotType = 'craft-out'; });
      craftOutputEl.addEventListener('mouseleave', () => { if (this.hoveredSlotType === 'craft-out') { this.hoveredSlotIndex = null; this.hoveredSlotType = null; } });
    }
    craftingScreen.addEventListener('click', (e) => {
      if (e.target === craftingScreen) {
        this.controls.lock();
      }
    });

    // Keys
    window.addEventListener('keydown', (e) => {
      if (this.playerHealth <= 0) return;
      this.keys[e.code] = true;

      // Inventory UI Shortcuts
      if (this.isInventoryOpen || this.isCraftingOpen) {
        if (this.hoveredSlotType !== null && this.hoveredSlotIndex !== null) {
          const type = this.hoveredSlotType;
          const index = this.hoveredSlotIndex;

          if (e.key >= '1' && e.key <= '9') {
            const hbIndex = 27 + parseInt(e.key) - 1;
            if (type !== 'hotbar' || index !== hbIndex) {
              const hbStack = this.inventorySlots[hbIndex];
              const hoveredStack = this.getSlotStack(type, index);

              if (type !== 'craft-out') {
                this.inventorySlots[hbIndex] = hoveredStack;
                this.setSlotStack(type, index, hbStack);
                this.buildInventoryGridUI();
                this.buildHotbarUI();
              }
            }
          }

          if (e.code === 'KeyF') {
            if (type !== 'offhand' && type !== 'craft-out') {
              const offStack = this.offhandSlot;
              const hoveredStack = this.getSlotStack(type, index);
              this.offhandSlot = hoveredStack;
              this.setSlotStack(type, index, offStack);
              this.buildInventoryGridUI();
              this.buildHotbarUI();
            }
          }

          if (e.code === 'KeyQ') {
            const dropAll = e.ctrlKey;
            let targetStack = this.getSlotStack(type, index);
            if (targetStack) {
              if (dropAll) {
                // Drop entire stack (spawn item in world)
                this.spawnDroppedItem(targetStack.type, targetStack.count);
                if (type === 'craft-out') this.collectCraftingOutput();
                else this.setSlotStack(type, index, null);
              } else {
                // Drop 1
                this.spawnDroppedItem(targetStack.type, 1);
                if (type === 'craft-out') {
                  // Cannot drop 1 from craft output usually, but if we do, it consumes the craft
                  this.collectCraftingOutput();
                  // Put remaining back on cursor for simplicity
                  this.cursorStack = { type: targetStack.type, count: targetStack.count - 1 };
                } else {
                  targetStack.count--;
                  if (targetStack.count <= 0) this.setSlotStack(type, index, null);
                  else this.setSlotStack(type, index, targetStack);
                }
              }
              this.buildInventoryGridUI();
              this.buildHotbarUI();
              this.updateCursorStackUI();
            }
          }
        }
      }

      // Cursor Drop outside UI
      if (e.code === 'KeyQ' && this.cursorStack && (this.hoveredSlotIndex === null || (!this.isInventoryOpen && !this.isCraftingOpen))) {
        const dropAll = e.ctrlKey;
        if (dropAll) {
          this.spawnDroppedItem(this.cursorStack.type, this.cursorStack.count);
          this.cursorStack = null;
        } else {
          this.spawnDroppedItem(this.cursorStack.type, 1);
          this.cursorStack.count--;
          if (this.cursorStack.count <= 0) this.cursorStack = null;
        }
        this.updateCursorStackUI();
      }


      // Reset coordinates if stuck
      if (e.code === 'KeyR') {
        this.teleportToGround();
      }

      // Hotbar selection keys
      if (e.key >= '1' && e.key <= '9') {
        this.activeSlotIndex = parseInt(e.key) - 1;
        this.updateActiveHotbarSlot();
      }

      // Toggle inventory
      if (e.code === 'KeyE') {
        if (this.isInventoryOpen) {
          this.controls.lock();
        } else {
          this.isInventoryOpen = true;
          this.isCraftingOpen = false;
          this.controls.unlock();
          inventoryScreen.classList.remove('hidden');
          craftingScreen.classList.add('hidden');
          menuScreen.classList.add('hidden');
          this.buildInventoryGridUI(); // Draw grids dynamically!
        }
      }

      // Toggle crafting menu
      if (e.code === 'KeyC') {
        if (this.isCraftingOpen) {
          this.controls.lock();
        } else {
          this.isCraftingOpen = true;
          this.isInventoryOpen = false;
          this.controls.unlock();
          craftingScreen.classList.remove('hidden');
          inventoryScreen.classList.add('hidden');
          menuScreen.classList.add('hidden');
          this.buildCraftingUI();
        }
      }

      // Toggle minimap
      if (e.code === 'KeyM') {
        this.minimapVisible = !this.minimapVisible;
        const minimapEl = document.getElementById('minimap-container');
        if (minimapEl) {
          minimapEl.style.display = this.minimapVisible ? 'flex' : 'none';
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse wheel for hotbar selection
    window.addEventListener('wheel', (e) => {
      if (!this.controls.isLocked || this.playerHealth <= 0) return;
      if (this.isInventoryOpen || this.isCraftingOpen) return;

      if (e.deltaY > 0) {
        this.activeSlotIndex = (this.activeSlotIndex + 1) % 9;
      } else {
        this.activeSlotIndex = (this.activeSlotIndex - 1 + 9) % 9;
      }
      this.updateActiveHotbarSlot();
    });

    // Global mousemove for floating cursor stack
    window.addEventListener('mousemove', (e) => {
      const cursorStackEl = document.getElementById('cursor-stack');
      if (cursorStackEl) {
        if (this.cursorStack) {
          cursorStackEl.style.left = `${e.clientX}px`;
          cursorStackEl.style.top = `${e.clientY}px`;
        }
      }

      // Update dragged slots logic will go here
    });

    // Clear stuck keys on window blur
    window.addEventListener('blur', () => {
      this.keys = {};
      this.isMouseDown = false;
      this.isBreaking = false;
      this.breakProgress = 0;
      this.breakTarget = null;
      if (this.breakingOverlay) {
        this.breakingOverlay.visible = false;
      }
    });

    // Window Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Mouse Clicks for Blocks
    window.addEventListener('mousedown', (e) => {
      if (!this.controls.isLocked || this.playerHealth <= 0) return;

      if (e.button === 0) {
        this.isMouseDown = true;
        // Attack Animal first
        if (this.entityManager && this.entityManager.checkHit(this.camera, this.raycaster)) {
          return;
        }
        // Start breaking
        this.isBreaking = true;
        this.breakProgress = 0;
        if (this.targetBlock) {
          this.breakTarget = { x: this.targetBlock.x, y: this.targetBlock.y, z: this.targetBlock.z };
        }
      } else if (e.button === 2) {
        // Check if targeted block is a Crafting Table block
        if (this.targetBlock) {
          const block = this.world.getBlock(this.targetBlock.x, this.targetBlock.y, this.targetBlock.z);
          if (block && block.type === BLOCKS.CRAFTING_TABLE) {
            this.isCraftingOpen = true;
            this.isInventoryOpen = false;
            this.controls.unlock();
            craftingScreen.classList.remove('hidden');
            inventoryScreen.classList.add('hidden');
            menuScreen.classList.add('hidden');
            this.buildCraftingUI();
            return;
          }
        }
        // Place Block
        this.placeTargetBlock();
      }
    });

    window.addEventListener('mouseup', (e) => {
      this.handleMouseUp(e);
      if (e.button === 0) {
        this.isMouseDown = false;
        this.isBreaking = false;
        this.breakProgress = 0;
        this.breakTarget = null;
        if (this.breakingOverlay) {
          this.breakingOverlay.visible = false;
        }
      }
    });
  }

  buildHotbarUI() {
    const hotbar = document.getElementById('hotbar');
    if (!hotbar) return;
    hotbar.innerHTML = '';

    // Sync the top-bar counts for Meat & Wool
    const meatCount = this.getInventoryCount(BLOCKS.MEAT);
    const woolCount = this.getInventoryCount(BLOCKS.WOOL);
    const meatEl = document.getElementById('meat-count');
    if (meatEl) meatEl.innerText = meatCount;
    const woolEl = document.getElementById('wool-count');
    if (woolEl) woolEl.innerText = woolCount;

    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = `hotbar-slot ${i === this.activeSlotIndex ? 'active' : ''}`;
      slot.setAttribute('data-index', i);

      const num = document.createElement('div');
      num.className = 'slot-num';
      num.innerText = i + 1;
      slot.appendChild(num);

      const item = this.inventorySlots[27 + i];
      if (item && item.type) {
        const icon = document.createElement('div');
        icon.className = 'slot-icon';
        const iconUrl = this.getItemIconDataURL(item.type);
        if (iconUrl) {
          icon.style.backgroundImage = `url(${iconUrl})`;
          icon.style.backgroundSize = 'cover';
        } else {
          icon.style.background = this.getBlockColorStyle(item.type);
        }
        icon.style.borderRadius = '4px';
        slot.appendChild(icon);

        const countLabel = document.createElement('div');
        countLabel.className = 'slot-count';
        countLabel.innerText = item.count;
        slot.appendChild(countLabel);
      }

      slot.addEventListener('click', (e) => {
        if (this.isInventoryOpen || this.isCraftingOpen) return;
        this.activeSlotIndex = i;
        this.updateActiveHotbarSlot();
      });

      hotbar.appendChild(slot);
    }
  }

  buildInventoryGridUI() {
    const grid = document.getElementById('inv-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Render 27 main inventory slots (0 to 26)
    for (let i = 0; i < 27; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';

      const item = this.inventorySlots[i];
      if (item && item.type) {
        const icon = document.createElement('div');
        icon.className = 'slot-icon';
        const iconUrl = this.getItemIconDataURL(item.type);
        if (iconUrl) {
          icon.style.backgroundImage = `url(${iconUrl})`;
          icon.style.backgroundSize = 'cover';
        } else {
          icon.style.background = this.getBlockColorStyle(item.type);
        }
        slotEl.appendChild(icon);

        const countLabel = document.createElement('div');
        countLabel.className = 'slot-count';
        countLabel.innerText = item.count;
        slotEl.appendChild(countLabel);
      }

      slotEl.addEventListener('mouseenter', () => { this.hoveredSlotIndex = i; this.hoveredSlotType = 'main'; this.handleDragUpdate('main', i); });
      slotEl.addEventListener('mouseleave', () => { if (this.hoveredSlotIndex === i) { this.hoveredSlotIndex = null; this.hoveredSlotType = null; } });
      slotEl.addEventListener('mousedown', (e) => this.handleSlotMousedown(e));

      grid.appendChild(slotEl);
    }

    // Render 9 hotbar slots (27 to 35) inside inventory screen
    const hotbarGrid = document.getElementById('inv-hotbar-grid');
    if (!hotbarGrid) return;
    hotbarGrid.innerHTML = '';
    for (let i = 27; i < 36; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';

      const item = this.inventorySlots[i];
      if (item && item.type) {
        const icon = document.createElement('div');
        icon.className = 'slot-icon';
        const iconUrl = this.getItemIconDataURL(item.type);
        if (iconUrl) {
          icon.style.backgroundImage = `url(${iconUrl})`;
          icon.style.backgroundSize = 'cover';
        } else {
          icon.style.background = this.getBlockColorStyle(item.type);
        }
        slotEl.appendChild(icon);

        const countLabel = document.createElement('div');
        countLabel.className = 'slot-count';
        countLabel.innerText = item.count;
        slotEl.appendChild(countLabel);
      }

      slotEl.addEventListener('mouseenter', () => { this.hoveredSlotIndex = i; this.hoveredSlotType = 'hotbar'; this.handleDragUpdate('hotbar', i); });
      slotEl.addEventListener('mouseleave', () => { if (this.hoveredSlotIndex === i) { this.hoveredSlotIndex = null; this.hoveredSlotType = null; } });
      slotEl.addEventListener('mousedown', (e) => this.handleSlotMousedown(e));

      hotbarGrid.appendChild(slotEl);
    }

    // Handle Offhand Slot
    const offhandSlotEl = document.getElementById('offhand-slot');
    if (offhandSlotEl) {
      // Clear previous icons/counts but keep the label
      Array.from(offhandSlotEl.childNodes).forEach(node => {
        if (!node.classList || !node.classList.contains('slot-label')) {
          offhandSlotEl.removeChild(node);
        }
      });

      const item = this.offhandSlot;
      if (item && item.type) {
        const icon = document.createElement('div');
        icon.className = 'slot-icon';
        const iconUrl = this.getItemIconDataURL(item.type);
        if (iconUrl) {
          icon.style.backgroundImage = `url(${iconUrl})`;
          icon.style.backgroundSize = 'cover';
        } else {
          icon.style.background = this.getBlockColorStyle(item.type);
        }
        offhandSlotEl.appendChild(icon);

        const countLabel = document.createElement('div');
        countLabel.className = 'slot-count';
        countLabel.innerText = item.count;
        offhandSlotEl.appendChild(countLabel);
      }

      // Need to reattach listeners if re-rendered, but here it's static in HTML, just attach once or clear cleanly.
      if (!offhandSlotEl.dataset.initialized) {
        offhandSlotEl.dataset.initialized = 'true';
        offhandSlotEl.addEventListener('mouseenter', () => { this.hoveredSlotIndex = 'offhand'; this.hoveredSlotType = 'offhand'; this.handleDragUpdate('offhand', 'offhand'); });
        offhandSlotEl.addEventListener('mouseleave', () => { if (this.hoveredSlotIndex === 'offhand') { this.hoveredSlotIndex = null; this.hoveredSlotType = null; } });
        offhandSlotEl.addEventListener('mousedown', (e) => this.handleSlotMousedown(e));
      }
    }

    // Refresh 2x2 Crafting Grid drawings
    this.drawInventoryCrafting();
  }

  drawInventoryCrafting() {
    for (let i = 0; i < 4; i++) {
      const slotEl = document.getElementById(`craft-in-${i}`);
      if (!slotEl) continue;
      slotEl.innerHTML = '';

      const item = this.inventoryCraftGrid[i];
      if (item && item.type) {
        const icon = document.createElement('div');
        icon.className = 'slot-icon';
        const iconUrl = this.getItemIconDataURL(item.type);
        if (iconUrl) {
          icon.style.backgroundImage = `url(${iconUrl})`;
          icon.style.backgroundSize = 'cover';
        } else {
          icon.style.background = this.getBlockColorStyle(item.type);
        }
        slotEl.appendChild(icon);

        const countLabel = document.createElement('div');
        countLabel.className = 'slot-count';
        countLabel.innerText = item.count;
        slotEl.appendChild(countLabel);
      }
    }

    const outEl = document.getElementById('craft-out');
    if (outEl) {
      outEl.innerHTML = '';
      if (this.inventoryCraftOutput) {
        const item = this.inventoryCraftOutput;
        const icon = document.createElement('div');
        icon.className = 'slot-icon';
        const iconUrl = this.getItemIconDataURL(item.type);
        if (iconUrl) {
          icon.style.backgroundImage = `url(${iconUrl})`;
          icon.style.backgroundSize = 'cover';
        } else {
          icon.style.background = this.getBlockColorStyle(item.type);
        }
        outEl.appendChild(icon);

        const countLabel = document.createElement('div');
        countLabel.className = 'slot-count';
        countLabel.innerText = item.count;
        outEl.appendChild(countLabel);
      }
    }
  }

  getSlotStack(type, index) {
    if (type === 'main' || type === 'hotbar') {
      return this.inventorySlots[index];
    } else if (type === 'craft-in') {
      return this.inventoryCraftGrid[index];
    } else if (type === 'craft-out') {
      return this.inventoryCraftOutput;
    } else if (type === 'offhand') {
      return this.offhandSlot;
    }
    return null;
  }

  setSlotStack(type, index, stack) {
    if (type === 'main' || type === 'hotbar') {
      this.inventorySlots[index] = stack;
    } else if (type === 'craft-in') {
      this.inventoryCraftGrid[index] = stack;
      this.check2x2Crafting();
    } else if (type === 'craft-out') {
      // Generally read-only, but cleared on collect
      this.inventoryCraftOutput = stack;
    } else if (type === 'offhand') {
      this.offhandSlot = stack;
    }
  }

  updateCursorStackUI() {
    const cursorEl = document.getElementById('cursor-stack');
    if (!cursorEl) return;

    if (this.cursorStack) {
      cursorEl.innerHTML = '';
      cursorEl.classList.remove('hidden');

      const icon = document.createElement('div');
      icon.className = 'slot-icon';
      const iconUrl = this.getItemIconDataURL(this.cursorStack.type);
      if (iconUrl) {
        icon.style.backgroundImage = `url(${iconUrl})`;
        icon.style.backgroundSize = 'cover';
      } else {
        icon.style.background = this.getBlockColorStyle(this.cursorStack.type);
      }
      cursorEl.appendChild(icon);

      const countLabel = document.createElement('div');
      countLabel.className = 'slot-count';
      countLabel.innerText = this.cursorStack.count;
      cursorEl.appendChild(countLabel);

      // Keep it centered on cursor
      cursorEl.style.position = 'absolute';
      cursorEl.style.pointerEvents = 'none';
      cursorEl.style.zIndex = '9999';
      cursorEl.style.width = '40px';
      cursorEl.style.height = '40px';
      // Pos updating handled in mousemove
    } else {
      cursorEl.classList.add('hidden');
      cursorEl.innerHTML = '';
    }
  }


  handleShiftClick(type, index) {
    let slotStack = this.getSlotStack(type, index);
    if (!slotStack) return;

    if (type === 'craft-out') {
      // Shift clicking craft output tries to craft as many as possible until output/inventory fills
      // For simplicity in this prompt, just take 1 output normally via left click routing.
      // Or move to inventory directly:
      if (this.addToInventory(slotStack.type, slotStack.count)) {
        this.collectCraftingOutput();
        this.buildInventoryGridUI();
        this.buildHotbarUI();
      }
      return;
    }


    // UI Routing Priority (Shift-Click)
    let moved = false;

    // Check if crafting is open. If so, treat craft-in grid as the "Container"
    const isContainerOpen = this.isCraftingOpen;

    if (type === 'craft-in') {
      // From Container -> Hotbar -> Main Inventory
      let remainder = this.shiftFillSlots(slotStack, 27, 35); // hotbar
      if (remainder > 0) remainder = this.shiftFillSlots({type: slotStack.type, count: remainder}, 0, 26); // main

      if (remainder === 0) {
        this.setSlotStack(type, index, null);
      } else {
        slotStack.count = remainder;
        this.setSlotStack(type, index, slotStack);
      }
      moved = true;
    } else if (type === 'main') {
      // From Main Inventory -> Open Container (craft-in) -> Hotbar
      let remainder = slotStack.count;
      if (isContainerOpen) {
        // Find empty slot in craft-in
        for (let i = 0; i < 4; i++) {
          if (!this.inventoryCraftGrid[i]) {
            this.inventoryCraftGrid[i] = { type: slotStack.type, count: remainder };
            remainder = 0;
            break;
          }
        }
      }
      if (remainder > 0) {
        remainder = this.shiftFillSlots({type: slotStack.type, count: remainder}, 27, 35);
      }

      if (remainder === 0) {
        this.setSlotStack(type, index, null);
      } else {
        slotStack.count = remainder;
        this.setSlotStack(type, index, slotStack);
      }
      moved = true;
    } else if (type === 'hotbar') {
      // From Hotbar -> Open Container -> Main
      let remainder = slotStack.count;
      if (isContainerOpen) {
        for (let i = 0; i < 4; i++) {
          if (!this.inventoryCraftGrid[i]) {
            this.inventoryCraftGrid[i] = { type: slotStack.type, count: remainder };
            remainder = 0;
            break;
          }
        }
      }
      if (remainder > 0) {
        remainder = this.shiftFillSlots({type: slotStack.type, count: remainder}, 0, 26);
      }

      if (remainder === 0) {
        this.setSlotStack(type, index, null);
      } else {
        slotStack.count = remainder;
        this.setSlotStack(type, index, slotStack);
      }
      moved = true;
    } else if (type === 'offhand') {
      let remainder = this.shiftFillSlots(slotStack, 27, 35);
      if (remainder > 0) remainder = this.shiftFillSlots({type: slotStack.type, count: remainder}, 0, 26);
      if (remainder === 0) this.setSlotStack(type, index, null);
      else { slotStack.count = remainder; this.setSlotStack(type, index, slotStack); }
      moved = true;
    }


    if (moved) {
      this.buildInventoryGridUI();
      this.buildHotbarUI();
    }
  }

  shiftFillSlots(stack, startIndex, endIndex) {
    let remainder = stack.count;
    const max = BLOCK_INFO[stack.type].maxStack || 64;

    // Fill existing
    for (let i = startIndex; i <= endIndex; i++) {
      const slot = this.inventorySlots[i];
      if (slot && slot.type === stack.type && slot.count < max) {
        const space = max - slot.count;
        const add = Math.min(space, remainder);
        slot.count += add;
        remainder -= add;
        if (remainder <= 0) break;
      }
    }
    // Fill empty
    if (remainder > 0) {
      for (let i = startIndex; i <= endIndex; i++) {
        if (!this.inventorySlots[i]) {
          const add = Math.min(max, remainder);
          this.inventorySlots[i] = { type: stack.type, count: add };
          remainder -= add;
          if (remainder <= 0) break;
        }
      }
    }
    return remainder;
  }

  handleSlotMousedown(e) {
    if (this.hoveredSlotType === null || this.hoveredSlotIndex === null) return;

    const type = this.hoveredSlotType;
    const index = this.hoveredSlotIndex;
    let slotStack = this.getSlotStack(type, index);

    if (e.button === 0) { // Left Click
      if (e.shiftKey) {
        this.handleShiftClick(type, index);
      } else {
        if (!this.cursorStack) {
          if (slotStack) {
            this.cursorStack = { type: slotStack.type, count: slotStack.count };

            if (type === 'craft-out') {
              this.collectCraftingOutput();
            } else {
              this.setSlotStack(type, index, null);
            }

            // Initiate Drag
            this.isDraggingLeft = true;
            this.dragStartStackCount = this.cursorStack.count;
            this.draggedSlots = new Map();
            this.draggedSlots.set(`${type}-${index}`, slotStack ? slotStack.count : 0);
          }
        } else {
          // Double click collection
          if (this.lastClickTime && (Date.now() - this.lastClickTime < 250) && this.lastClickSlot === `${type}-${index}`) {
             this.collectAllMatchingToCursor();
             this.updateCursorStackUI();
             this.buildInventoryGridUI();
             this.buildHotbarUI();
             return;
          }

          if (type === 'craft-out') {
            // Can only pick up matching
            if (slotStack && slotStack.type === this.cursorStack.type) {
              const max = BLOCK_INFO[slotStack.type].maxStack || 64;
              if (this.cursorStack.count + slotStack.count <= max) {
                this.cursorStack.count += slotStack.count;
                this.collectCraftingOutput();
              }
            }
          } else if (!slotStack) {
            // Place all
            this.setSlotStack(type, index, { type: this.cursorStack.type, count: this.cursorStack.count });
            this.cursorStack = null;
          } else if (slotStack.type === this.cursorStack.type) {
            // Merge
            const max = BLOCK_INFO[slotStack.type].maxStack || 64;
            const space = max - slotStack.count;
            const add = Math.min(space, this.cursorStack.count);
            slotStack.count += add;
            this.cursorStack.count -= add;
            if (this.cursorStack.count <= 0) this.cursorStack = null;
            this.setSlotStack(type, index, slotStack);
          } else {
            // Swap
            const temp = { type: slotStack.type, count: slotStack.count };
            this.setSlotStack(type, index, this.cursorStack);
            this.cursorStack = temp;
          }
        }
      }
      this.lastClickTime = Date.now();
      this.lastClickSlot = `${type}-${index}`;
    } else if (e.button === 2) { // Right Click
      if (!this.cursorStack) {
        if (slotStack) {
          if (type === 'craft-out') {
            // Cannot right click split craft out, just take it
            this.cursorStack = { type: slotStack.type, count: slotStack.count };
            this.collectCraftingOutput();
          } else {
            const take = Math.ceil(slotStack.count / 2);
            this.cursorStack = { type: slotStack.type, count: take };
            slotStack.count -= take;
            if (slotStack.count <= 0) {
              this.setSlotStack(type, index, null);
            } else {
              this.setSlotStack(type, index, slotStack);
            }
          }
        }
      } else {
        if (type !== 'craft-out') {
          if (!slotStack) {
            this.setSlotStack(type, index, { type: this.cursorStack.type, count: 1 });
            this.cursorStack.count -= 1;
            if (this.cursorStack.count <= 0) this.cursorStack = null;

            // Initiate Right Drag
            this.isDraggingRight = true;
            this.draggedSlots = new Map();
            this.draggedSlots.set(`${type}-${index}`, slotStack ? slotStack.count : 0);
          } else if (slotStack.type === this.cursorStack.type) {
            const max = BLOCK_INFO[slotStack.type].maxStack || 64;
            if (slotStack.count < max) {
              slotStack.count += 1;
              this.cursorStack.count -= 1;
              if (this.cursorStack.count <= 0) this.cursorStack = null;
              this.setSlotStack(type, index, slotStack);

              this.isDraggingRight = true;
              this.draggedSlots = new Map();
            this.draggedSlots.set(`${type}-${index}`, slotStack ? slotStack.count : 0);
            }
          }
        }
      }
    }

    this.updateCursorStackUI();
    this.buildInventoryGridUI();
    this.buildHotbarUI();
  }


  handleDragUpdate(type, index) {
    if (!this.cursorStack) {
      this.isDraggingLeft = false;
      this.isDraggingRight = false;
      return;
    }
    if (type === 'craft-out') return;

    const key = `${type}-${index}`;
    if (this.draggedSlots.has(key)) return;

    let slotStack = this.getSlotStack(type, index);
    if (slotStack && slotStack.type !== this.cursorStack.type) return;

    const max = BLOCK_INFO[this.cursorStack.type].maxStack || 64;

    if (this.isDraggingRight) {
      if (this.cursorStack.count > 0) {
        if (!slotStack) {
          this.setSlotStack(type, index, { type: this.cursorStack.type, count: 1 });
          this.cursorStack.count--;
          this.draggedSlots.set(key, 0);
        } else if (slotStack.count < max) {
          slotStack.count++;
          this.cursorStack.count--;
          this.setSlotStack(type, index, slotStack);
          this.draggedSlots.set(key, slotStack.count - 1);
        }
        if (this.cursorStack.count <= 0) this.cursorStack = null;
      }
    } else if (this.isDraggingLeft) {
      if (!this.draggedSlots.has(key)) {
         this.draggedSlots.set(key, slotStack ? slotStack.count : 0);
      }

      const numSlots = this.draggedSlots.size;
      let remaining = this.dragStartStackCount;

      // Calculate capacity across all dragged slots
      let totalCapacity = 0;
      this.draggedSlots.forEach((originalCount) => {
          totalCapacity += (max - originalCount);
      });

      const totalToDistribute = Math.min(this.dragStartStackCount, totalCapacity);
      const perSlot = Math.floor(totalToDistribute / numSlots);
      remaining -= totalToDistribute; // whatever we distribute is removed from remaining

      // Remainder distribution logic (e.g. 5 items across 3 slots = 1,1,1 and 2 remainder stays in cursor)
      // Actually MC keeps the remainder in the cursor.

      let itemsLeftToGive = totalToDistribute;

      this.draggedSlots.forEach((originalCount, slotKey) => {
        const [t, i] = slotKey.split('-');
        const idx = t === 'offhand' ? 'offhand' : parseInt(i, 10);
        let sStack = this.getSlotStack(t, idx);

        if (!sStack) {
          sStack = { type: this.cursorStack.type, count: 0 };
        }

        // Ensure we don't overflow the max stack per slot
        const space = max - originalCount;
        let add = Math.min(perSlot, space);

        // If there's extra capacity because a slot filled up, in standard drag it just caps.
        // For simplicity, we just add 'add'.

        sStack.count = originalCount + add;
        itemsLeftToGive -= add;

        if (sStack.count > 0) {
          this.setSlotStack(t, idx, sStack);
        } else {
          this.setSlotStack(t, idx, null);
        }
      });

      // Any items left to give due to full slots go back to the cursor
      this.cursorStack.count = remaining + itemsLeftToGive;
      if (this.cursorStack.count <= 0) this.cursorStack = null;
    }

    this.updateCursorStackUI();
    this.buildInventoryGridUI();
    this.buildHotbarUI();
  }

  handleMouseUp(e) {
    if (this.isDraggingLeft) {
      this.isDraggingLeft = false;
      this.draggedSlots.clear();
      if (this.cursorStack && this.cursorStack.count <= 0) {
        this.cursorStack = null;
        this.updateCursorStackUI();
      }
    }
    if (this.isDraggingRight) {
      this.isDraggingRight = false;
      this.draggedSlots.clear();
      if (this.cursorStack && this.cursorStack.count <= 0) {
        this.cursorStack = null;
        this.updateCursorStackUI();
      }
    }
  }

  collectAllMatchingToCursor() {

    if (!this.cursorStack) return;
    const max = BLOCK_INFO[this.cursorStack.type].maxStack || 64;

    // Search main and hotbar slots
    for (let i = 0; i < 36; i++) {
      if (this.cursorStack.count >= max) break;
      const slot = this.inventorySlots[i];
      if (slot && slot.type === this.cursorStack.type) {
        const needed = max - this.cursorStack.count;
        const take = Math.min(needed, slot.count);
        this.cursorStack.count += take;
        slot.count -= take;
        if (slot.count <= 0) this.inventorySlots[i] = null;
      }
    }
  }

  collectCraftingOutput() {
    // Consume 1 from each populated input slot in the grid
    for (let i = 0; i < 4; i++) {
      const slot = this.inventoryCraftGrid[i];
      if (slot) {
        slot.count--;
        if (slot.count <= 0) {
          this.inventoryCraftGrid[i] = null;
        }
      }
    }
    gameAudio.playPlaceSound();
    this.check2x2Crafting();
  }

  check2x2Crafting() {
    const grid = this.inventoryCraftGrid;
    const slot0 = grid[0];
    const slot1 = grid[1];
    const slot2 = grid[2];
    const slot3 = grid[3];

    // Check Wood Log -> Planks
    const woodCount = grid.filter(s => s && s.type === BLOCKS.WOOD).length;
    const nonWoodCount = grid.filter(s => s && s.type !== BLOCKS.WOOD).length;
    if (woodCount === 1 && nonWoodCount === 0) {
      this.inventoryCraftOutput = { type: BLOCKS.PLANKS, count: 4 };
      return;
    }

    // Check 2 Planks vertically -> 4 Sticks
    const leftVerticalPlanks = slot0 && slot0.type === BLOCKS.PLANKS && slot2 && slot2.type === BLOCKS.PLANKS && !slot1 && !slot3;
    const rightVerticalPlanks = slot1 && slot1.type === BLOCKS.PLANKS && slot3 && slot3.type === BLOCKS.PLANKS && !slot0 && !slot2;
    if (leftVerticalPlanks || rightVerticalPlanks) {
      this.inventoryCraftOutput = { type: BLOCKS.STICK, count: 4 };
      return;
    }

    // Check 4 Planks -> Crafting Table
    if (slot0 && slot0.type === BLOCKS.PLANKS &&
        slot1 && slot1.type === BLOCKS.PLANKS &&
        slot2 && slot2.type === BLOCKS.PLANKS &&
        slot3 && slot3.type === BLOCKS.PLANKS) {
      this.inventoryCraftOutput = { type: BLOCKS.CRAFTING_TABLE, count: 1 };
      return;
    }

    // No recipe matched
    this.inventoryCraftOutput = null;
  }


  buildCraftingUI() {
    const listContainer = document.getElementById('craft-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    this.recipes.forEach(recipe => {
      const resultInfo = BLOCK_INFO[recipe.result];
      const card = document.createElement('div');
      card.className = 'craft-recipe-card';

      const info = document.createElement('div');
      info.className = 'recipe-info';

      const icon = document.createElement('div');
      icon.className = 'recipe-icon';
      const iconUrl = this.getItemIconDataURL(recipe.result);
      if (iconUrl) {
        icon.style.backgroundImage = `url(${iconUrl})`;
        icon.style.backgroundSize = 'cover';
      } else {
        icon.style.background = this.getBlockColorStyle(recipe.result);
      }
      icon.style.borderRadius = '6px';
      info.appendChild(icon);

      const details = document.createElement('div');
      details.className = 'recipe-details';

      const name = document.createElement('div');
      name.className = 'recipe-name';
      name.innerText = `${resultInfo.name} (x${recipe.resultCount})`;
      details.appendChild(name);

      const costText = recipe.ingredients.map(ing => {
        const ingInfo = BLOCK_INFO[ing.type];
        return `${ing.count}x ${ingInfo.name}`;
      }).join(', ');

      const cost = document.createElement('div');
      cost.className = 'recipe-cost';
      cost.innerText = `Requires: ${costText}`;
      details.appendChild(cost);

      info.appendChild(details);
      card.appendChild(info);

      const btn = document.createElement('button');
      btn.className = 'btn-craft';
      btn.innerText = 'Craft';

      // Check ingredients
      let canCraft = true;
      recipe.ingredients.forEach(ing => {
        const count = this.getInventoryCount(ing.type);
        if (count < ing.count) {
          canCraft = false;
        }
      });

      if (!canCraft) {
        btn.disabled = true;
      }

      btn.addEventListener('click', () => {
        recipe.ingredients.forEach(ing => {
          this.consumeFromInventory(ing.type, ing.count);
        });

        this.addToInventory(recipe.result, recipe.resultCount);

        gameAudio.playPlaceSound();
        this.buildCraftingUI();
        this.buildHotbarUI();
        this.buildInventoryGridUI();
      });

      card.appendChild(btn);
      listContainer.appendChild(card);
    });
  }

  // Returns CSS color gradient representation for block UI slots (fallback)
  getBlockColorStyle(type) {
    switch (type) {
      case BLOCKS.GRASS: return 'linear-gradient(135deg, #557a2b, #866043)';
      case BLOCKS.DIRT: return '#866043';
      case BLOCKS.STONE: return '#7a7a7a';
      case BLOCKS.WOOD: return 'linear-gradient(135deg, #6d5032, #bc9a5c)';
      case BLOCKS.LEAVES: return '#2d5e2d';
      case BLOCKS.SAND: return '#e5c185';
      case BLOCKS.GLASS: return 'rgba(255, 255, 255, 0.4)';
      case BLOCKS.BRICK: return '#a64d3b';
      case BLOCKS.PLANKS: return '#bf9b68';
      case BLOCKS.PINE_WOOD: return 'linear-gradient(135deg, #3c2918, #4c3520)';
      case BLOCKS.PINE_LEAVES: return '#1b3f22';
      case BLOCKS.BIRCH_WOOD: return 'linear-gradient(135deg, #eaeaea, #e8d3b7)';
      case BLOCKS.BIRCH_LEAVES: return '#5c9e31';
      case BLOCKS.WATER: return 'linear-gradient(135deg, #1e90ff, #00bfff)';
      case BLOCKS.STICK: return 'linear-gradient(135deg, #8b5a2b, #b57a42)';
      case BLOCKS.STONE_PICKAXE: return 'linear-gradient(135deg, #7a7a7a, #8b5a2b)';
      case BLOCKS.CRAFTING_TABLE: return 'linear-gradient(135deg, #bfa37a, #5a3d24)';
      default: return '#555';
    }
  }

  getItemIconDataURL(type) {
    if (this.iconDataUrlCache[type]) {
      return this.iconDataUrlCache[type];
    }

    // If it's wool or meat (which are animal drops not inside block list), return custom styles
    if (type === BLOCKS.WOOL) {
      // White wool circle
      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 48;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(24, 24, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#dddddd';
      ctx.lineWidth = 3;
      ctx.stroke();
      const url = canvas.toDataURL();
      this.iconDataUrlCache[type] = url;
      return url;
    }
    if (type === BLOCKS.MEAT) {
      // Red meat steak shape
      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 48;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#c93232';
      ctx.beginPath();
      ctx.ellipse(24, 24, 18, 12, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(16, 22, 10, 4); // Bone highlight
      const url = canvas.toDataURL();
      this.iconDataUrlCache[type] = url;
      return url;
    }

    if (!this.world || !this.world.atlasCanvas) return '';

    const info = BLOCK_INFO[type];
    if (!info || !info.uvs) return '';

    const iconCanvas = document.createElement('canvas');
    iconCanvas.width = 48;
    iconCanvas.height = 48;
    const ctx = iconCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Choose side texture primarily so grass blocks show soil + grass top
    const uv = info.uvs.side || info.uvs.top || [0, 0];

    const TEXTURE_SIZE = 16;
    const sx = uv[0] * TEXTURE_SIZE;
    const sy = uv[1] * TEXTURE_SIZE;

    ctx.drawImage(this.world.atlasCanvas, sx, sy, TEXTURE_SIZE, TEXTURE_SIZE, 0, 0, 48, 48);

    const url = iconCanvas.toDataURL();
    this.iconDataUrlCache[type] = url;
    return url;
  }

  addToInventory(type, count = 1) {
    let remainder = count;
    const maxStack = BLOCK_INFO[type].maxStack || 64;

    // 1. Try to find existing stack of same type with space (< maxStack)
    for (let i = 0; i < 36; i++) {
      const slot = this.inventorySlots[i];
      if (slot && slot.type === type && slot.count < maxStack) {
        const space = maxStack - slot.count;
        const add = Math.min(space, remainder);
        slot.count += add;
        remainder -= add;
        if (remainder <= 0) break;
      }
    }
    // 2. Try to fill empty slots
    if (remainder > 0) {
      const slotsOrder = [...Array(9).keys()].map(x => x + 27).concat([...Array(27).keys()]);
      for (const i of slotsOrder) {
        if (this.inventorySlots[i] === null) {
          const add = Math.min(maxStack, remainder);
          this.inventorySlots[i] = { type, count: add };
          remainder -= add;
          if (remainder <= 0) break;
        }
      }
    }
    return remainder <= 0;
  }

  getInventoryCount(type) {
    let count = 0;
    for (let i = 0; i < 36; i++) {
      const slot = this.inventorySlots[i];
      if (slot && slot.type === type) {
        count += slot.count;
      }
    }
    return count;
  }

  consumeFromInventory(type, amount) {
    let needed = amount;
    for (let i = 0; i < 36; i++) {
      const slot = this.inventorySlots[i];
      if (slot && slot.type === type) {
        if (slot.count >= needed) {
          slot.count -= needed;
          needed = 0;
        } else {
          needed -= slot.count;
          slot.count = 0;
        }
        if (slot.count <= 0) {
          this.inventorySlots[i] = null;
        }
        if (needed <= 0) break;
      }
    }
  }

  updateActiveHotbarSlot() {
    const slots = document.querySelectorAll('.hotbar-slot');
    slots.forEach((s, idx) => {
      if (idx === this.activeSlotIndex) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });

    const activeItem = this.inventorySlots[27 + this.activeSlotIndex];
    const nameLabel = document.getElementById('active-item-name');
    if (nameLabel) {
      nameLabel.innerText = activeItem ? BLOCK_INFO[activeItem.type].name : 'Empty';
      nameLabel.classList.remove('show');
      void nameLabel.offsetWidth; // Force reflow
      nameLabel.classList.add('show');
    }
  }

  updateRaycastTarget() {
    // Shoot ray from center camera forward
    if (!this.centerVec) this.centerVec = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(this.centerVec, this.camera);

    // Use cached mesh array for high-performance raycasting
    const intersects = this.raycaster.intersectObjects(this.world.meshList);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const point = hit.point;
      const normal = hit.face.normal;

      // Shift slightly along the normal to determine block coordinates inside the voxel grid
      // For breaking, shift -0.5 normal. For placing, shift +0.5 normal.
      const breakX = Math.floor(point.x - normal.x * 0.1);
      const breakY = Math.floor(point.y - normal.y * 0.1);
      const breakZ = Math.floor(point.z - normal.z * 0.1);

      const placeX = Math.floor(point.x + normal.x * 0.5);
      const placeY = Math.floor(point.y + normal.y * 0.5);
      const placeZ = Math.floor(point.z + normal.z * 0.5);

      this.targetBlock = {
        x: breakX, y: breakY, z: breakZ,
        placeX, placeY, placeZ,
        faceNormal: normal
      };

      // Move outline to targeted voxel coordinate
      this.selectionOutline.position.set(breakX + 0.5, breakY + 0.5, breakZ + 0.5);
      this.selectionOutline.visible = true;
    } else {
      this.targetBlock = null;
      this.selectionOutline.visible = false;
    }
  }

  breakTargetBlock() {
    if (!this.targetBlock) return;

    const { x, y, z } = this.targetBlock;
    const current = this.world.getBlock(x, y, z);

    if (current && current.type !== BLOCKS.BEDROCK) {
      // TNT explosion logic
      if (current.type === BLOCKS.TNT) {
        this.explodeTNT(x, y, z);
        return;
      }

      // Remove Torch light
      if (current.type === BLOCKS.TORCH) {
        const lightIndex = this.torchLights.findIndex(l => Math.floor(l.position.x) === x && Math.floor(l.position.y) === y && Math.floor(l.position.z) === z);
        if (lightIndex !== -1) {
          this.scene.remove(this.torchLights[lightIndex]);
          this.torchLights.splice(lightIndex, 1);
        }
      }

      // Spawn particles before removing
      this.spawnParticles(x, y, z, current.type);

      // Spawn collectible rotating item on floor
      if (this.entityManager) {
        this.entityManager.spawnCollectible(
          current.type,
          x + 0.5,
          y + 0.3,
          z + 0.5
        );
      }

      // Set to air
      this.world.setBlock(x, y, z, BLOCKS.AIR);
      gameAudio.playBreakSound();
    }
  }

  explodeTNT(x, y, z) {
    const radius = 3;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx*dx + dy*dy + dz*dz <= radius*radius) {
            const bx = x + dx;
            const by = y + dy;
            const bz = z + dz;
            const block = this.world.getBlock(bx, by, bz);
            if (block && block.type !== BLOCKS.AIR && block.type !== BLOCKS.BEDROCK) {
              this.spawnParticles(bx, by, bz, block.type);
              this.world.setBlock(bx, by, bz, BLOCKS.AIR, false); // false = don't update meshes yet
              // Remove torches caught in explosion
              if (block.type === BLOCKS.TORCH) {
                const lightIndex = this.torchLights.findIndex(l => Math.floor(l.position.x) === bx && Math.floor(l.position.y) === by && Math.floor(l.position.z) === bz);
                if (lightIndex !== -1) {
                  this.scene.remove(this.torchLights[lightIndex]);
                  this.torchLights.splice(lightIndex, 1);
                }
              }
            }
          }
        }
      }
    }
    // Update affected chunk meshes
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        this.world.updateChunkMesh(cx + ox, cz + oz);
      }
    }
    gameAudio.playBreakSound(); // Replace with explosion sound later

    // Damage player if close
    const distSq = Math.pow(this.physics.position.x - x, 2) + Math.pow(this.physics.position.y - y, 2) + Math.pow(this.physics.position.z - z, 2);
    if (distSq < (radius + 2) * (radius + 2)) {
      this.takeDamage(10);
    }
  }

  placeTargetBlock() {
    if (!this.targetBlock) return;

    const { placeX: px, placeY: py, placeZ: pz } = this.targetBlock;
    const activeSlot = this.inventorySlots[27 + this.activeSlotIndex];
    if (!activeSlot || activeSlot.count <= 0) return;
    const placeType = activeSlot.type;

    // Verify it doesn't collide with player bounding box!
    const radius = this.physics.playerWidth / 2;
    const height = this.physics.getCurrentHeight();

    const minPlayerX = this.physics.position.x - radius;
    const maxPlayerX = this.physics.position.x + radius;
    const minPlayerY = this.physics.position.y;
    const maxPlayerY = this.physics.position.y + height;
    const minPlayerZ = this.physics.position.z - radius;
    const maxPlayerZ = this.physics.position.z + radius;

    // Block box
    const minBlockX = px;
    const maxBlockX = px + 1;
    const minBlockY = py;
    const maxBlockY = py + 1;
    const minBlockZ = pz;
    const maxBlockZ = pz + 1;

    const intersectsPlayer =
      maxPlayerX > minBlockX && minPlayerX < maxBlockX &&
      maxPlayerY > minBlockY && minPlayerY < maxBlockY &&
      maxPlayerZ > minBlockZ && minPlayerZ < maxBlockZ;

    if (intersectsPlayer) return; // Prevent placing block on top of yourself

    // Deduct block count
    activeSlot.count--;
    if (activeSlot.count <= 0) {
      this.inventorySlots[27 + this.activeSlotIndex] = null;
    }

    this.world.setBlock(px, py, pz, placeType);
    gameAudio.playPlaceSound();

    // Place Torch Light
    if (placeType === BLOCKS.TORCH) {
      if (this.torchLights.length >= this.maxTorchLights) {
        // Remove oldest torch light
        const oldLight = this.torchLights.shift();
        this.scene.remove(oldLight);
      }
      const pointLight = new THREE.PointLight(0xffaa55, 1.0, 15);
      pointLight.position.set(px + 0.5, py + 0.5, pz + 0.5);
      this.scene.add(pointLight);
      this.torchLights.push(pointLight);
    }

    // Refresh UI to reflect new counts (deferred to avoid DOM thrash during geometry rebuild)
    this.scheduleUIRefresh();
  }

  updateMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const px = Math.floor(this.physics.position.x);
    const pz = Math.floor(this.physics.position.z);
    const py = Math.floor(this.physics.position.y);
    const range = 30; // 30 blocks range (60x60 area) is extremely performant and perfect for a minimap

    ctx.clearRect(0, 0, width, height);

    const scaleX = width / (range * 2);
    const scaleY = height / (range * 2);

    // Cache chunk lookups by coordinate string to avoid string parsing/lookup overhead in loops
    const chunkSize = this.world.chunkSize;
    const chunkCache = {};

    for (let dz = -range; dz < range; dz++) {
      const worldZ = pz + dz;
      const cz = Math.floor(worldZ / chunkSize);
      const lz = ((worldZ % chunkSize) + chunkSize) % chunkSize;

      for (let dx = -range; dx < range; dx++) {
        const worldX = px + dx;
        const cx = Math.floor(worldX / chunkSize);
        const lx = ((worldX % chunkSize) + chunkSize) % chunkSize;

        const chunkKey = `${cx},${cz}`;
        let chunk = chunkCache[chunkKey];
        if (chunk === undefined) {
          chunk = this.world.chunks[chunkKey] || null;
          chunkCache[chunkKey] = chunk;
        }

        let highestType = BLOCKS.AIR;

        // Scan downward from player's y + 16 down to y - 24 to find top block quickly
        const startY = Math.min(63, py + 16);
        const endY = Math.max(0, py - 24);

        if (chunk && chunk.blocks) {
          for (let y = startY; y >= endY; y--) {
            const type = chunk.blocks[lx][y][lz];
            if (type !== BLOCKS.AIR) {
              highestType = type;
              break;
            }
          }
        } else {
          // Fallback to world.getBlock
          for (let y = startY; y >= endY; y--) {
            const block = this.world.getBlock(worldX, y, worldZ);
            if (block && block.type !== BLOCKS.AIR) {
              highestType = block.type;
              break;
            }
          }
        }

        if (highestType !== BLOCKS.AIR) {
          if (highestType === BLOCKS.WATER) {
            ctx.fillStyle = '#1e90ff';
          } else if (highestType === BLOCKS.GRASS) {
            ctx.fillStyle = '#557a2b';
          } else if (highestType === BLOCKS.SAND) {
            ctx.fillStyle = '#e5c185';
          } else if (highestType === BLOCKS.STONE) {
            ctx.fillStyle = '#7a7a7a';
          } else if (highestType === BLOCKS.LEAVES || highestType === BLOCKS.PINE_LEAVES || highestType === BLOCKS.BIRCH_LEAVES) {
            ctx.fillStyle = '#2d5e2d';
          } else {
            ctx.fillStyle = '#866043';
          }
          ctx.fillRect((dx + range) * scaleX, (dz + range) * scaleY, scaleX + 1, scaleY + 1);
        }
      }
    }

    // Draw player dot in center
    ctx.fillStyle = 'red';
    ctx.fillRect(width/2 - 2, height/2 - 2, 4, 4);
  }


  spawnDroppedItem(type, count) {
    if (this.entityManager && count > 0) {
      // Spawn items slightly in front of player
      const px = this.physics.position.x;
      const py = this.physics.position.y + 1.5;
      const pz = this.physics.position.z;

      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);

      for(let i=0; i<Math.min(count, 5); i++) { // cap visuals to 5 for performance
        this.entityManager.spawnCollectible(
          type,
          px + dir.x * 1.5,
          py + dir.y * 1.5,
          pz + dir.z * 1.5
        );
      }
    }
  }

  spawnParticles(x, y, z, blockType) {
    const count = 12;
    const color = this.getBlockParticleColor(blockType);

    if (!this.particleMaterialCache[color]) {
      this.particleMaterialCache[color] = new THREE.MeshBasicMaterial({ color: color });
    }
    const mat = this.particleMaterialCache[color];

    for (let i = 0; i < count; i++) {
      let pMesh;
      if (this.particlePool.length > 0) {
        pMesh = this.particlePool.pop();
        pMesh.material = mat;
        pMesh.visible = true;
      } else {
        if (this.particles.length + this.particlePool.length >= this.maxPoolSize) {
          continue; // Cap max active particles
        }
        pMesh = new THREE.Mesh(this.sharedParticleGeometry, mat);
        this.scene.add(pMesh);
      }

      // Random starting coordinates inside the voxel
      pMesh.position.set(
        x + 0.3 + Math.random() * 0.4,
        y + 0.3 + Math.random() * 0.4,
        z + 0.3 + Math.random() * 0.4
      );

      this.particles.push({
        mesh: pMesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4.0,
          (Math.random() * 5.0) + 2.0, // Fly upward
          (Math.random() - 0.5) * 4.0
        ),
        life: 0.6 // Lifetime seconds
      });
    }
  }

  getBlockParticleColor(type) {
    switch (type) {
      case BLOCKS.GRASS: return 0x557a2b;
      case BLOCKS.DIRT: return 0x866043;
      case BLOCKS.STONE: return 0x7a7a7a;
      case BLOCKS.WOOD: return 0x6d5032;
      case BLOCKS.LEAVES: return 0x2d5e2d;
      case BLOCKS.SAND: return 0xe5c185;
      case BLOCKS.GLASS: return 0xffffff;
      case BLOCKS.BRICK: return 0xa64d3b;
      case BLOCKS.PLANKS: return 0xbf9b68;
      case BLOCKS.PINE_WOOD: return 0x3c2918;
      case BLOCKS.PINE_LEAVES: return 0x1b3f22;
      case BLOCKS.BIRCH_WOOD: return 0xeaeaea;
      case BLOCKS.BIRCH_LEAVES: return 0x5c9e31;
      case BLOCKS.WATER: return 0x1e90ff;
      case BLOCKS.STICK: return 0x8b5a2b;
      case BLOCKS.STONE_PICKAXE: return 0x7a7a7a;
      default: return 0xffffff;
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particlePool.push(p.mesh);
        this.particles.splice(i, 1);
      } else {
        // Move particle with velocity + gravity
        p.velocity.y -= 9.8 * dt; // Simple local gravity
        p.mesh.position.addScaledVector(p.velocity, dt);
      }
    }
  }

  updateDayNightCycle(dt) {
    this.gameTime = (this.gameTime + this.timeScale * dt) % 24.0;

    // Display clock format e.g. 08:30
    const hours = Math.floor(this.gameTime);
    const mins = Math.floor((this.gameTime - hours) * 60);
    const displayHours = hours.toString().padStart(2, '0');
    const displayMins = mins.toString().padStart(2, '0');
    const timeStr = `${displayHours}:${displayMins}`;

    if (this._lastDisplayTimeStr !== timeStr) {
      this._lastDisplayTimeStr = timeStr;
      const el = document.getElementById('game-time');
      if (el) el.innerText = timeStr;
    }

    // Angle of sun path
    const angle = (this.gameTime / 24.0) * Math.PI * 2 - Math.PI / 2;
    const sunX = Math.cos(angle);
    const sunY = Math.sin(angle);

    this.sunLight.position.set(sunX * 100, sunY * 100, 50);

    // Keep Sun and Moon revolving opposite to each other at a fixed distance around player
    const px = this.physics.position.x;
    const py = this.physics.position.y;
    const pz = this.physics.position.z;

    if (this.sunMesh) {
      this.sunMesh.position.set(px + sunX * 160, py + sunY * 160, pz + 40);
      this.sunMesh.lookAt(px, py, pz);
    }
    if (this.moonMesh) {
      this.moonMesh.position.set(px - sunX * 160, py - sunY * 160, pz - 40);
      this.moonMesh.lookAt(px, py, pz);
    }

    // Compute ambient sky colors based on sun altitude (sunY: -1 to 1)
    let skyColor, fogColor, sunIntensity, starOpacity;
    let cloudColor, cloudOpacity;

    if (!this.skyColorCache) {
      this.skyColorCache = new THREE.Color();
      this.cloudColorCache = new THREE.Color();
      this.nightSky = new THREE.Color(0x060613);
      this.daySky = new THREE.Color(0x8bc0d9);
      this.sunsetSky = new THREE.Color(0x1a1235);
      this.nightCloud = new THREE.Color(0x111122);
      this.dayCloud = new THREE.Color(0xffffff);
      this.sunsetCloud = new THREE.Color(0xfca5a5);
    }

    if (sunY > 0.1) {
      // Day
      this.skyColorCache.copy(this.daySky);
      skyColor = this.skyColorCache;
      fogColor = this.skyColorCache;
      sunIntensity = 0.95;
      starOpacity = 0.0;
      this.cloudColorCache.copy(this.dayCloud);
      cloudColor = this.cloudColorCache;
      cloudOpacity = 0.85;
    } else if (sunY > -0.1) {
      // Sunrise / Sunset transition
      const t = (sunY + 0.1) / 0.2; // 0 to 1
      this.skyColorCache.lerpColors(this.sunsetSky, this.daySky, t);
      skyColor = this.skyColorCache;
      fogColor = this.skyColorCache;
      sunIntensity = 0.95 * t;
      starOpacity = (1.0 - t) * 0.8;

      // Warm sunset colors for clouds
      this.cloudColorCache.lerpColors(this.sunsetCloud, this.dayCloud, t);
      cloudColor = this.cloudColorCache;
      cloudOpacity = 0.85;
    } else {
      // Night
      this.skyColorCache.copy(this.nightSky);
      skyColor = this.skyColorCache;
      fogColor = this.skyColorCache;
      sunIntensity = 0.0;
      starOpacity = 0.85;
      this.cloudColorCache.copy(this.nightCloud);
      cloudColor = this.cloudColorCache;
      cloudOpacity = 0.4;
    }

    if (this.physics.inWater) {
      this.renderer.setClearColor(new THREE.Color(0x0a1e35));
      this.scene.fog.color = new THREE.Color(0x0f2a4a);
      this.scene.fog.density = 0.08;
    } else {
      this.renderer.setClearColor(skyColor);
      this.scene.fog.color = fogColor;
      this.scene.fog.density = 0.015;
    }
    this.sunLight.intensity = sunIntensity;

    if (this.cloudMaterial) {
      this.cloudMaterial.color.copy(cloudColor);
      this.cloudMaterial.opacity = cloudOpacity;
    }

    if (this.stars) {
      this.stars.material.opacity = starOpacity;
    }
  }

  updateFPS() {
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsLastUpdate >= 1000) {
      document.getElementById('fps-counter').innerText = this.fpsFrames;
      this.fpsFrames = 0;
      this.fpsLastUpdate = now;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = this.clock.getDelta();
    this.updateFPS();

    if (this.controls.isLocked) {
      // Obtain camera direction vectors
      if (!this.camDirCache) this.camDirCache = new THREE.Vector3();
      this.camera.getWorldDirection(this.camDirCache);

      if (this.playerHealth > 0) {
        // Fixed 20 TPS physics tick accumulator
        if (this.physicsAccumulator === undefined) this.physicsAccumulator = 0;
        this.physicsAccumulator += dt;
        while (this.physicsAccumulator >= 0.05) {
          this.physics.update(0.05, this.keys, this.camDirCache, this.world);
          this.physicsAccumulator -= 0.05;
        }

        // Handle Fall Damage
        if (this.physics.lastFallDamage > 0) {
          this.takeDamage(this.physics.lastFallDamage);
        }

        // Oxygen System
        if (this.physics.inWater) {
          this.oxygenLevel = Math.max(0, this.oxygenLevel - dt);
          if (this.oxygenLevel === 0) {
            this.oxygenDamageTimer += dt;
            if (this.oxygenDamageTimer >= 1.0) {
              this.takeDamage(1);
              this.oxygenDamageTimer = 0;
            }
          }
        } else {
          this.oxygenLevel = Math.min(this.maxOxygen, this.oxygenLevel + dt * 10);
          this.oxygenDamageTimer = 0;
        }

        // Hunger decay
        this.hungerTimer += dt;
        const rate = (this.physics.isSprinting ? 2.5 : 1.0) * (this.keys['Space'] ? 1.5 : 1.0);
        if (this.hungerTimer >= (25.0 / rate)) {
          this.playerHunger = Math.max(0, this.playerHunger - 1);
          this.updateStatsHUD();
          this.hungerTimer = 0;
        }

        // Natural Healing
        if (this.playerHunger >= 18 && this.playerHealth < this.maxPlayerHealth) {
          this.healTimer += dt;
          if (this.healTimer >= 4.0) {
            this.playerHealth = Math.min(this.maxPlayerHealth, this.playerHealth + 1);
            this.updateStatsHUD();
            this.healTimer = 0;
          }
        } else {
          this.healTimer = 0;
        }

        // Starvation
        if (this.playerHunger === 0) {
          this.starveTimer += dt;
          if (this.starveTimer >= 4.0) {
            this.takeDamage(1);
            this.starveTimer = 0;
          }
        } else {
          this.starveTimer = 0;
        }
      }

      // Update animal entities & collectibles
      if (this.entityManager) {
        this.entityManager.update(dt, this.world, this.physics.position);
      }

      if (this.playerHealth > 0) {
        // Sprint FOV Lerp
        this.targetFov = this.physics.isSprinting && !this.physics.isCrouching && (this.physics.velocity.x !== 0 || this.physics.velocity.z !== 0) ? this.baseFov + 10 : this.baseFov;
        if (Math.abs(this.currentFov - this.targetFov) > 0.1) {
          this.currentFov += (this.targetFov - this.currentFov) * 10 * dt;
          this.camera.fov = this.currentFov;
          this.camera.updateProjectionMatrix();
        }

        // Sync Three.js Camera to physical state position
        const headY = this.physics.getCurrentHeight() - 0.15; // Camera sits slightly below actual head height
        this.camera.position.set(
          this.physics.position.x,
          this.physics.position.y + headY,
          this.physics.position.z
        );

        // UI Updates (Throttled to save CPU)
        this.uiUpdateTimer += dt;
        if (this.uiUpdateTimer >= this.uiUpdateInterval) {
          this.uiUpdateTimer = 0;

          const px = this.physics.position.x.toFixed(1);
          const py = this.physics.position.y.toFixed(1);
          const pz = this.physics.position.z.toFixed(1);


          const oxBar = document.getElementById('oxygen-bar-container');
          if (oxBar) {
            if (this.oxygenLevel < this.maxOxygen || this.physics.inWater) {
              oxBar.classList.remove('hidden');
              const fill = document.getElementById('oxygen-bar-fill');
              fill.style.width = (this.oxygenLevel / this.maxOxygen * 100) + '%';
              if (this.oxygenLevel <= 5.0) oxBar.classList.add('danger');
              else oxBar.classList.remove('danger');
            } else {
              oxBar.classList.add('hidden');
            }
          }
        }

        // Minimap Update
        if (this.minimapVisible) {
          this.minimapUpdateTimer += dt;
          if (this.minimapUpdateTimer >= 0.5) { // 2 FPS map updates
            this.minimapUpdateTimer = 0;
            // this.updateMinimap();
          }
        }

        // 2. Generate chunks dynamically around current player position
        this.world.generateWorldAroundPlayer(this.physics.position.x, this.physics.position.z);

        // 3. Raycast outline targeting update
        this.updateRaycastTarget();
      } else {
        this.selectionOutline.visible = false;
      }
    } else {
      // Hide outline when paused
      this.selectionOutline.visible = false;
    }

    // Interactive cycle calculations
    this.updateDayNightCycle(dt);
    this.updateClouds(dt);
    this.updateParticles(dt);
    this.updateBreaking(dt);
    if (this.world && this.world.updateWater) {
      this.world.updateWater(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

}

// Instantiate game instance on script start
window.addEventListener('DOMContentLoaded', () => {
  new GameController();
});

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
    this.offhandSlot = null; // Offhand slot

    // Cursor stack & dragging states
    this.cursorStack = null;
    this.dragMode = null; // 'left' or 'right'
    this.dragSlots = new Set();
    this.dragInitialCount = 0;
    this.dragLastCursorCount = 0;

    // Hover state for keyboard shortcuts
    this.hoveredSlotArray = null;
    this.hoveredSlotIndex = null;

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
    for (let y = this.world.chunkHeight - 1; y >= 0; y--) {
      const block = this.world.getBlock(8, y, 8);
      if (block && block.solid) {
        spawnY = y + 1;
        break;
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

    // Render Hearts (10 hearts representing 20 HP)
    let heartsHtml = '';
    for (let i = 0; i < 10; i++) {
      const heartVal = (i + 1) * 2;
      let styleFill = 'fill: #ff2222;'; // Full

      if (this.playerHealth >= heartVal) {
        styleFill = 'fill: #ff2222;';
      } else if (this.playerHealth === heartVal - 1) {
        styleFill = 'fill: url(#heart-half-grad);'; // Half
      } else {
        styleFill = 'fill: rgba(255, 255, 255, 0.2);'; // Empty
      }

      heartsHtml += `<svg class="hud-icon" style="${styleFill}" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
    }
    heartsRow.innerHTML = heartsHtml;

    // Render Hunger (10 drumsticks representing 20 Hunger)
    let hungerHtml = '';
    for (let i = 0; i < 10; i++) {
      const hungerVal = (i + 1) * 2;
      let styleFill = 'fill: #d97706;'; // Full

      if (this.playerHunger >= hungerVal) {
        styleFill = 'fill: #d97706;';
      } else if (this.playerHunger === hungerVal - 1) {
        styleFill = 'fill: url(#hunger-half-grad);'; // Half
      } else {
        styleFill = 'fill: rgba(255, 255, 255, 0.2);'; // Empty
      }

      // Drumstick bone/meat path shape
      hungerHtml += `<svg class="hud-icon" style="${styleFill}" viewBox="0 0 24 24"><path d="M18.5 3c-1.5 0-3 1-3.5 2.5C14 7 13.5 9 12 10.5c-1.5 1.5-3.5 2-5 3C5.5 14 4.5 15.5 4.5 17c0 2.2 1.8 4 4 4s4-1.8 4-4c0-1.5-1-3-2.5-3.5 1.5-1.5 3.5-2 5-3.5 1.5-1.5 2-3.5 3-5 1.5-.5 2.5-2 2.5-3.5c0-1.7-1.3-3-3-3z"/></svg>`;
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

    // Cursor Tracking and Dragging logic
    document.addEventListener('mousemove', (e) => {
      if (this.isInventoryOpen || this.isCraftingOpen) {
        const cursorItemEl = document.getElementById('cursor-item');
        if (cursorItemEl) {
          cursorItemEl.style.left = `${e.clientX + 10}px`;
          cursorItemEl.style.top = `${e.clientY + 10}px`;

          if (this.cursorStack) {
            cursorItemEl.style.display = 'block';
            const iconUrl = this.getItemIconDataURL(this.cursorStack.type);
            const iconEl = cursorItemEl.querySelector('.slot-icon');
            if (iconUrl) {
              iconEl.style.backgroundImage = `url(${iconUrl})`;
              iconEl.style.backgroundSize = 'cover';
              iconEl.style.background = '';
            } else {
              iconEl.style.backgroundImage = '';
              iconEl.style.background = this.getBlockColorStyle(this.cursorStack.type);
            }
            cursorItemEl.querySelector('.slot-count').innerText = this.cursorStack.count;
          } else {
            cursorItemEl.style.display = 'none';
          }
        }
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.isInventoryOpen && !this.isCraftingOpen) return;
      if (this.cursorStack) {
        if (e.button === 0) {
          this.dragMode = 'left';
          this.dragInitialCount = this.cursorStack.count;
          this.dragLastCursorCount = this.cursorStack.count;
          this.dragSlots.clear();
        } else if (e.button === 2) {
          this.dragMode = 'right';
          this.dragInitialCount = this.cursorStack.count;
          this.dragLastCursorCount = this.cursorStack.count;
          this.dragSlots.clear();
        }
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (this.dragMode) {
        this.dragMode = null;
        this.dragSlots.clear();
        if (this.dragOriginalCounts) {
          this.dragOriginalCounts.clear();
        }
        this.buildInventoryGridUI();
        this.buildHotbarUI();
      }

      // Outside UI click drops item
      if ((this.isInventoryOpen || this.isCraftingOpen) && this.cursorStack) {
        const invScreen = document.getElementById('inventory-screen');
        const craftScreen = document.getElementById('crafting-screen');
        const clickedOutsideInv = invScreen && !invScreen.classList.contains('hidden') && e.target === invScreen;
        const clickedOutsideCraft = craftScreen && !craftScreen.classList.contains('hidden') && e.target === craftScreen;

        if (clickedOutsideInv || clickedOutsideCraft) {
          // Drop item
          if (e.button === 0 || e.button === 2) {
             if (this.entityManager) {
               // Use player's face direction to drop
               const dropPos = this.physics.position.clone();
               dropPos.add(this.camDirCache.clone().multiplyScalar(1.5));
               dropPos.y += 1.5;
               for(let i=0; i<this.cursorStack.count; i++){
                 this.entityManager.spawnCollectible(this.cursorStack.type, dropPos.x, dropPos.y, dropPos.z);
               }
             }
             this.cursorStack = null;
             const cursorItemEl = document.getElementById('cursor-item');
             if(cursorItemEl) cursorItemEl.style.display = 'none';
          }
        }
      }
    });

    // 2x2 Crafting Grid click bindings
    for (let i = 0; i < 4; i++) {
      const inputEl = document.getElementById(`craft-in-${i}`);
      if (inputEl) {
        inputEl.addEventListener('mousedown', (e) => {
          if (e.button === 0 || e.button === 2) {
            this.handleCraftInputClick(i, e);
          }
        });
        inputEl.addEventListener('contextmenu', e => e.preventDefault());
        inputEl.addEventListener('mouseenter', () => {
          this.hoveredSlotArray = this.inventoryCraftGrid;
          this.hoveredSlotIndex = i;
          this.handleSlotDrag(this.inventoryCraftGrid, i);
        });
        inputEl.addEventListener('mouseleave', () => {
          if (this.hoveredSlotArray === this.inventoryCraftGrid && this.hoveredSlotIndex === i) {
            this.hoveredSlotArray = null;
            this.hoveredSlotIndex = null;
          }
        });
      }
    }
    const craftOutputEl = document.getElementById('craft-out');
    if (craftOutputEl) {
      craftOutputEl.addEventListener('mousedown', (e) => {
        if (e.button === 0 || e.button === 2) {
          this.handleCraftOutputClick(e);
        }
      });
      craftOutputEl.addEventListener('contextmenu', e => e.preventDefault());
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

      // Inventory specific shortcuts
      if (this.isInventoryOpen || this.isCraftingOpen) {
        if (this.hoveredSlotArray && this.hoveredSlotIndex !== null) {
          const hoveredSlot = this.hoveredSlotArray[this.hoveredSlotIndex];

          if (e.key >= '1' && e.key <= '9') {
            // Swap hovered item with respective hotbar slot
            const hotbarIdx = 27 + (parseInt(e.key) - 1);
            if (this.hoveredSlotArray === this.inventorySlots && this.hoveredSlotIndex === hotbarIdx) {
              // Same slot, do nothing
            } else {
              const temp = this.inventorySlots[hotbarIdx];
              this.inventorySlots[hotbarIdx] = hoveredSlot;
              this.hoveredSlotArray[this.hoveredSlotIndex] = temp;
              this.buildInventoryGridUI();
              this.buildHotbarUI();
            }
          } else if (e.code === 'KeyF') {
            // Swap with offhand
            const temp = this.offhandSlot;
            this.offhandSlot = hoveredSlot;
            this.hoveredSlotArray[this.hoveredSlotIndex] = temp;
            this.buildInventoryGridUI();
            this.buildHotbarUI();
          } else if (e.code === 'KeyQ') {
            // Drop item
            if (hoveredSlot) {
              const dropCount = e.ctrlKey ? hoveredSlot.count : 1;
              if (this.entityManager) {
                 const dropPos = this.physics.position.clone();
                 dropPos.add(this.camDirCache.clone().multiplyScalar(1.5));
                 dropPos.y += 1.5;
                 for(let i=0; i<dropCount; i++){
                   this.entityManager.spawnCollectible(hoveredSlot.type, dropPos.x, dropPos.y, dropPos.z);
                 }
              }
              hoveredSlot.count -= dropCount;
              if (hoveredSlot.count <= 0) {
                this.hoveredSlotArray[this.hoveredSlotIndex] = null;
              }
              this.buildInventoryGridUI();
              this.buildHotbarUI();
            }
          }
        } else if (this.cursorStack && !this.hoveredSlotArray && e.code === 'KeyQ') {
          // Drop item from cursor if hovering outside the UI boundaries
          const dropCount = e.ctrlKey ? this.cursorStack.count : 1;
          if (this.entityManager) {
             const dropPos = this.physics.position.clone();
             dropPos.add(this.camDirCache.clone().multiplyScalar(1.5));
             dropPos.y += 1.5;
             for(let i=0; i<dropCount; i++){
               this.entityManager.spawnCollectible(this.cursorStack.type, dropPos.x, dropPos.y, dropPos.z);
             }
          }
          this.cursorStack.count -= dropCount;
          if (this.cursorStack.count <= 0) {
            this.cursorStack = null;
          }
        }
      }

      // Reset coordinates if stuck
      if (e.code === 'KeyR') {
        this.teleportToGround();
      }

      // Eat Meat when pressing F (only when not in inventory to avoid conflict with offhand swap)
      if (e.code === 'KeyF' && !this.isInventoryOpen && !this.isCraftingOpen) {
        const meatCount = this.getInventoryCount(BLOCKS.MEAT);
        if (this.playerHunger < 20 && meatCount > 0) {
          this.consumeFromInventory(BLOCKS.MEAT, 1);
          this.playerHunger = Math.min(20, this.playerHunger + 4);
          this.updateStatsHUD();
          this.buildHotbarUI();
          this.buildInventoryGridUI();
          if (gameAudio && gameAudio.playPlaceSound) {
            gameAudio.playPlaceSound();
          }
        }
      }

      // Hotbar selection keys
      if (e.key >= '1' && e.key <= '9' && !this.isInventoryOpen && !this.isCraftingOpen) {
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

      slot.addEventListener('mousedown', (e) => {
        if (this.isInventoryOpen || this.isCraftingOpen) return;
        this.activeSlotIndex = i;
        this.updateActiveHotbarSlot();
      });

      slot.addEventListener('mouseenter', () => {
        this.hoveredSlotArray = this.inventorySlots;
        this.hoveredSlotIndex = 27 + i;
        this.handleSlotDrag(this.inventorySlots, 27 + i);
      });
      slot.addEventListener('mouseleave', () => {
        if (this.hoveredSlotArray === this.inventorySlots && this.hoveredSlotIndex === 27 + i) {
          this.hoveredSlotArray = null;
          this.hoveredSlotIndex = null;
        }
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
      if (i === this.selectedInventorySlotIndex) {
        slotEl.classList.add('selected');
      }

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

      slotEl.addEventListener('mousedown', (e) => {
        if (e.button === 0 || e.button === 2) {
          this.handleInventorySlotClick(i, e);
        }
      });
      slotEl.addEventListener('contextmenu', e => e.preventDefault()); // Prevent browser context menu
      slotEl.addEventListener('mouseenter', () => {
        this.hoveredSlotArray = this.inventorySlots;
        this.hoveredSlotIndex = i;
        this.handleSlotDrag(this.inventorySlots, i);
      });
      slotEl.addEventListener('mouseleave', () => {
        if (this.hoveredSlotArray === this.inventorySlots && this.hoveredSlotIndex === i) {
          this.hoveredSlotArray = null;
          this.hoveredSlotIndex = null;
        }
      });
      grid.appendChild(slotEl);
    }

    // Render 9 hotbar slots (27 to 35) inside inventory screen
    const hotbarGrid = document.getElementById('inv-hotbar-grid');
    if (!hotbarGrid) return;
    hotbarGrid.innerHTML = '';
    for (let i = 27; i < 36; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      if (i === this.selectedInventorySlotIndex) {
        slotEl.classList.add('selected');
      }

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

      slotEl.addEventListener('mousedown', (e) => {
        if (e.button === 0 || e.button === 2) {
          this.handleInventorySlotClick(i, e);
        }
      });
      slotEl.addEventListener('contextmenu', e => e.preventDefault()); // Prevent browser context menu
      slotEl.addEventListener('mouseenter', () => {
        this.hoveredSlotArray = this.inventorySlots;
        this.hoveredSlotIndex = i;
        this.handleSlotDrag(this.inventorySlots, i);
      });
      slotEl.addEventListener('mouseleave', () => {
        if (this.hoveredSlotArray === this.inventorySlots && this.hoveredSlotIndex === i) {
          this.hoveredSlotArray = null;
          this.hoveredSlotIndex = null;
        }
      });
      hotbarGrid.appendChild(slotEl);
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

  handleCraftInputClick(i) {
    if (this.selectedInventorySlotIndex !== null) {
      // Swap selected inventory item with crafting input slot
      const temp = this.inventorySlots[this.selectedInventorySlotIndex];
      this.inventorySlots[this.selectedInventorySlotIndex] = this.inventoryCraftGrid[i];
      this.inventoryCraftGrid[i] = temp;
      this.selectedInventorySlotIndex = null;
    } else {
      // Swap craft input slot item with inventory select/swap buffer
      if (this.inventoryCraftGrid[i]) {
        this.selectedInventorySlotIndex = null; // reset selection
        // Simply select the craft input item and clear slot
        // To behave exactly like swap, we find first empty inventory slot or just select it
        // A simple direct swap is cleanest:
        const firstEmptyIndex = this.inventorySlots.indexOf(null);
        if (firstEmptyIndex !== -1) {
          this.inventorySlots[firstEmptyIndex] = this.inventoryCraftGrid[i];
          this.inventoryCraftGrid[i] = null;
        }
      }
    }
    this.check2x2Crafting();
    this.buildInventoryGridUI();
    this.buildHotbarUI();
  }

  handleCraftOutputClick() {
    if (this.inventoryCraftOutput) {
      const type = this.inventoryCraftOutput.type;
      const count = this.inventoryCraftOutput.count;

      const success = this.addToInventory(type, count);
      if (success) {
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
        this.buildInventoryGridUI();
        this.buildHotbarUI();
      }
    }
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

  handleSlotInteraction(slotArray, index, e) {
    const isShift = e.shiftKey;
    const isRightClick = e.button === 2;
    const isLeftClick = e.button === 0;

    // Double click logic
    if (isLeftClick && !isShift && this.cursorStack) {
      const now = Date.now();
      if (this.lastSlotClickTime && (now - this.lastSlotClickTime) < 300 && this.lastSlotClickedIndex === index && this.lastSlotClickedArray === slotArray) {
        // Double click: pull all matching items
        let space = this.getMaxStackSize(this.cursorStack.type) - this.cursorStack.count;
        if (space > 0) {
           const allArrays = [this.inventorySlots, this.inventoryCraftGrid];
           for (const arr of allArrays) {
             for (let i=0; i<arr.length; i++) {
               if (arr[i] && arr[i].type === this.cursorStack.type && arr[i] !== this.cursorStack) {
                 const take = Math.min(space, arr[i].count);
                 arr[i].count -= take;
                 this.cursorStack.count += take;
                 space -= take;
                 if (arr[i].count <= 0) arr[i] = null;
                 if (space <= 0) break;
               }
             }
             if (space <= 0) break;
           }
           this.check2x2Crafting();
           this.buildInventoryGridUI();
           this.buildHotbarUI();
        }
        this.lastSlotClickTime = 0;
        return;
      }
      this.lastSlotClickTime = now;
      this.lastSlotClickedIndex = index;
      this.lastSlotClickedArray = slotArray;
    }

    const slot = slotArray[index];

    if (isShift && isLeftClick) {
      if (slot) {
        // Shift click routing
        const type = slot.type;
        const count = slot.count;
        let remainder = count;

        // Routing logic:
        // Hotbar (27-35) -> Main Inventory (0-26)
        // Main Inventory (0-26) -> Hotbar (27-35)
        // Craft Grid (0-3) -> Hotbar then Main

        let targetRanges = [];
        if (slotArray === this.inventorySlots) {
          if (index >= 27) { // Hotbar -> Main
            targetRanges = [[0, 26]];
          } else { // Main -> Hotbar
            targetRanges = [[27, 35]];
          }
        } else if (slotArray === this.inventoryCraftGrid) {
          targetRanges = [[27, 35], [0, 26]];
        }

        for (const range of targetRanges) {
          if (remainder <= 0) break;
          // 1. Fill existing stacks
          for (let i = range[0]; i <= range[1]; i++) {
            const targetSlot = this.inventorySlots[i];
            if (targetSlot && targetSlot.type === type) {
              const max = this.getMaxStackSize(type);
              if (targetSlot.count < max) {
                const space = max - targetSlot.count;
                const add = Math.min(space, remainder);
                targetSlot.count += add;
                remainder -= add;
                if (remainder <= 0) break;
              }
            }
          }
          if (remainder <= 0) break;
          // 2. Fill empty slots
          for (let i = range[0]; i <= range[1]; i++) {
            if (!this.inventorySlots[i]) {
              const max = this.getMaxStackSize(type);
              const add = Math.min(max, remainder);
              this.inventorySlots[i] = { type, count: add };
              remainder -= add;
              if (remainder <= 0) break;
            }
          }
        }

        if (remainder > 0) {
          slot.count = remainder;
        } else {
          slotArray[index] = null;
        }
      }
    } else if (isLeftClick) {
      if (this.cursorStack && slot) {
        if (this.cursorStack.type === slot.type) {
           // Stack items
           const max = this.getMaxStackSize(this.cursorStack.type);
           const space = max - slot.count;
           const add = Math.min(space, this.cursorStack.count);
           slot.count += add;
           this.cursorStack.count -= add;
           if (this.cursorStack.count <= 0) this.cursorStack = null;
        } else {
           // Swap items
           const temp = slot;
           slotArray[index] = this.cursorStack;
           this.cursorStack = temp;
        }
      } else if (this.cursorStack && !slot) {
        // Place stack
        slotArray[index] = this.cursorStack;
        this.cursorStack = null;
      } else if (!this.cursorStack && slot) {
        // Pickup stack
        this.cursorStack = slot;
        slotArray[index] = null;
      }
    } else if (isRightClick) {
      if (!this.cursorStack && slot) {
        // Pick up half
        const half = Math.ceil(slot.count / 2);
        this.cursorStack = { type: slot.type, count: half };
        slot.count -= half;
        if (slot.count <= 0) slotArray[index] = null;
      } else if (this.cursorStack && !slot) {
        // Place one
        slotArray[index] = { type: this.cursorStack.type, count: 1 };
        this.cursorStack.count -= 1;
        if (this.cursorStack.count <= 0) this.cursorStack = null;
      } else if (this.cursorStack && slot && this.cursorStack.type === slot.type) {
        // Add one
        const max = this.getMaxStackSize(slot.type);
        if (slot.count < max) {
          slot.count += 1;
          this.cursorStack.count -= 1;
          if (this.cursorStack.count <= 0) this.cursorStack = null;
        }
      } else if (this.cursorStack && slot && this.cursorStack.type !== slot.type) {
        // Swap items on right click if different (standard behavior)
        const temp = slot;
        slotArray[index] = this.cursorStack;
        this.cursorStack = temp;
      }
    }

    this.check2x2Crafting();
    this.buildInventoryGridUI();
    this.buildHotbarUI();

    // Update cursor position manually to prevent flicker
    const eCopy = e;
    requestAnimationFrame(() => {
       const cursorItemEl = document.getElementById('cursor-item');
       if (cursorItemEl) {
          cursorItemEl.style.left = `${eCopy.clientX + 10}px`;
          cursorItemEl.style.top = `${eCopy.clientY + 10}px`;
       }
    });
  }

  handleSlotDrag(slotArray, index) {
    if (!this.dragMode || !this.cursorStack) return;

    // Use a composite key so we don't count the same slot twice
    const slotKey = `${slotArray === this.inventorySlots ? 'inv' : 'craft'}-${index}`;
    if (this.dragSlots.has(slotKey)) return;

    this.dragSlots.add(slotKey);

    const numSlots = this.dragSlots.size;
    const type = this.cursorStack.type;
    const maxStack = this.getMaxStackSize(type);

    if (this.dragMode === 'left') {
      // Evenly distribute
      const amountPerSlot = Math.floor(this.dragInitialCount / numSlots);
      if (amountPerSlot > 0) {
        let placedTotal = 0;

        // Reset all dragged slots to their state before drag started
        // Actually, a perfect Minecraft replica only places in empty/matching slots.
        // For simplicity, we just distribute to matching/empty slots.

        // Properly distribute to slots
        // First, revert the slots to their initial pre-drag state
        // We actually didn't store pre-drag state of individual slots, which is an oversight.
        // But since this is a simplified clone, we can just track original counts.

        // Wait, to prevent duplicating, let's keep it simple:
        // We will just clear all dragged slots (if they match the type), and redistribute exactly `amountPerSlot`
        // plus any original items they had.
        // A robust way: track original counts in `this.dragOriginalCounts` map when a slot is added.

        // Let's initialize `this.dragOriginalCounts` if it doesn't exist
        if (!this.dragOriginalCounts) {
          this.dragOriginalCounts = new Map();
        }

        // Store the original count of the newly added slot
        const currentSlot = slotArray[index];
        if (currentSlot && currentSlot.type === type) {
          this.dragOriginalCounts.set(slotKey, currentSlot.count);
        } else if (!currentSlot) {
          this.dragOriginalCounts.set(slotKey, 0);
        } else {
          // Different type, ignore this slot for distribution
          this.dragSlots.delete(slotKey);
          return;
        }

        // Recalculate numSlots based on valid matching/empty slots
        const validSlots = Array.from(this.dragSlots).filter(k => this.dragOriginalCounts.has(k));
        const newNumSlots = validSlots.length;
        const newAmountPerSlot = Math.floor(this.dragInitialCount / newNumSlots);

        let used = 0;
        validSlots.forEach(key => {
            const arr = key.startsWith('inv') ? this.inventorySlots : this.inventoryCraftGrid;
            const idx = parseInt(key.split('-')[1]);
            const originalCount = this.dragOriginalCounts.get(key);

            const toAdd = Math.min(newAmountPerSlot, maxStack - originalCount);

            arr[idx] = { type: type, count: originalCount + toAdd };
            used += toAdd;
        });

        this.cursorStack.count = this.dragInitialCount - used;
        if (this.cursorStack.count <= 0) this.cursorStack = null;

      }
    } else if (this.dragMode === 'right') {
      // Deposit one per slot
      if (this.cursorStack.count > 0) {
        const slot = slotArray[index];
        if (!slot) {
          slotArray[index] = { type: type, count: 1 };
          this.cursorStack.count -= 1;
        } else if (slot.type === type && slot.count < maxStack) {
          slot.count += 1;
          this.cursorStack.count -= 1;
        }

        if (this.cursorStack.count <= 0) this.cursorStack = null;
      }
    }

    this.check2x2Crafting();
    this.buildInventoryGridUI();
    this.buildHotbarUI();
  }

  handleInventorySlotClick(index, e) {
    this.handleSlotInteraction(this.inventorySlots, index, e);
    this.updateActiveHotbarSlot();
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

  getMaxStackSize(type) {
    // Unstackable
    if (type === BLOCKS.STONE_PICKAXE) return 1;
    // Limited stacking items
    // (None explicitly added yet beyond standard blocks, but this is where Eggs/Snowballs/EnderPearls would go)
    // Standard Blocks
    return 64;
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
    const maxStack = this.getMaxStackSize(type);

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
        // 1. Run physics update
        this.physics.update(dt, this.keys, this.camDirCache, this.world);

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
          document.getElementById('player-pos').innerText = `${px}, ${py}, ${pz}`;

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
            this.updateMinimap();
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

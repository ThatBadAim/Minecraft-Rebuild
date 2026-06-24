import { gameAudio } from './audio.js';
import { BLOCKS } from './world.js';

export class PhysicsEngine {
  constructor() {
    this.gravity = -32.0; // Gravity acceleration
    this.terminalVelocity = -50.0;
    this.jumpForce = 9.0;
    this.walkSpeed = 6.0;
    this.sprintSpeed = 10.0;
    this.crouchSpeed = 3.0;
    this.playerHeight = 1.8;
    this.playerCrouchHeight = 1.25;
    this.playerWidth = 0.6; // Width & Depth from center (0.3 radius)

    // Player physical state
    this.position = new THREE.Vector3(8, 60, 8); // Spawns safely high, falls down onto terrain
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.inWater = false;

    // Caches for GC optimization
    this.forwardCache = new THREE.Vector3();
    this.rightCache = new THREE.Vector3();
    this.upCache = new THREE.Vector3(0, 1, 0);
    this.targetHorizVelocityCache = new THREE.Vector3();

    // Fall damage tracking
    this.fallStartY = 0;
    this.isFalling = false;
    this.lastFallDamage = 0; // Read by GameController each frame

    // Footstep timer
    this.stepTimer = 0;
    this.stepInterval = 0.35; // Seconds per step sound
  }

  getCurrentHeight() {
    return this.isCrouching ? this.playerCrouchHeight : this.playerHeight;
  }

  // Check if a point is colliding with a solid block in the world helper
  // We check bounds of the block
  getBlocksIntersecting(world, pos, width, height) {
    // Expand the search bounding box by 0.5 blocks to ensure adjacent blocks are checked for collisions
    const minX = Math.floor(pos.x - width / 2 - 0.5);
    const maxX = Math.floor(pos.x + width / 2 + 0.5);
    const minY = Math.floor(pos.y - 0.5);
    const maxY = Math.floor(pos.y + height + 0.5);
    const minZ = Math.floor(pos.z - width / 2 - 0.5);
    const maxZ = Math.floor(pos.z + width / 2 + 0.5);

    const collidingBlocks = [];

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = world.getBlock(x, y, z);
          if (block === null) {
            // Treat unloaded/out-of-bounds chunks as solid barriers to prevent falling into the void
            collidingBlocks.push({
              x: x, y: y, z: z,
              minX: x, maxX: x + 1,
              minY: y, maxY: y + 1,
              minZ: z, maxZ: z + 1
            });
          } else if (block && block.solid) {
            collidingBlocks.push({
              x: x, y: y, z: z,
              minX: x, maxX: x + 1,
              minY: y, maxY: y + 1,
              minZ: z, maxZ: z + 1
            });
          }
        }
      }
    }
    return collidingBlocks;
  }

  update(deltaTime, keys, cameraDirection, world) {
    if (deltaTime > 0.1) deltaTime = 0.1; // Cap delta to prevent huge jumps/falls

    const height = this.getCurrentHeight();
    const radius = this.playerWidth / 2;

    // Check if player is currently in water
    const px = Math.floor(this.position.x);
    const pz = Math.floor(this.position.z);
    const feetY = Math.floor(this.position.y);
    const bodyY = Math.floor(this.position.y + 1);

    const feetBlock = world.getBlock(px, feetY, pz);
    const bodyBlock = world.getBlock(px, bodyY, pz);

    const isFeetWater = feetBlock && feetBlock.type === BLOCKS.WATER;
    const isBodyWater = bodyBlock && bodyBlock.type === BLOCKS.WATER;
    this.inWater = isFeetWater || isBodyWater;

    // 1. Calculate target horizontal movement based on inputs
    this.forwardCache.set(cameraDirection.x, 0, cameraDirection.z).normalize();
    this.rightCache.crossVectors(this.forwardCache, this.upCache).normalize();

    let forwardInput = 0;
    if (keys['KeyW'] || keys['ArrowUp']) forwardInput += 1;
    if (keys['KeyS'] || keys['ArrowDown']) forwardInput -= 1;

    let sideInput = 0;
    if (keys['KeyD'] || keys['ArrowRight']) sideInput += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) sideInput -= 1;

    // Normalize inputs diagonally to prevent speed boosts
    const inputLength = Math.sqrt(forwardInput * forwardInput + sideInput * sideInput);
    this.targetHorizVelocityCache.set(0, 0, 0);

    // Crouching logic (Control key)
    const wasCrouching = this.isCrouching;
    this.isCrouching = keys['ControlLeft'] || keys['ControlRight'];

    // Sprinting logic (Shift key)
    const isMovingForward = keys['KeyW'] || keys['ArrowUp'];
    this.isSprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && isMovingForward && !this.isCrouching;

    // Prevent standing up if blocked above
    if (wasCrouching && !this.isCrouching) {
      const topBlocks = this.getBlocksIntersecting(world, this.position, this.playerWidth, this.playerHeight);
      if (topBlocks.length > 0) {
        this.isCrouching = true; // Keep crouching
      }
    }

    let currentSpeed = this.walkSpeed;
    if (this.isCrouching) {
      currentSpeed = this.crouchSpeed;
    } else if (this.isSprinting) {
      currentSpeed = this.sprintSpeed;
    }

    // Massively slow down horizontal movement in water
    if (this.inWater) {
      currentSpeed *= 0.35;
    }

    if (inputLength > 0) {
      const normForward = forwardInput / inputLength;
      const normSide = sideInput / inputLength;

      this.targetHorizVelocityCache.copy(this.forwardCache).multiplyScalar(normForward * currentSpeed);
      // Side-to-side (strafing) is 1/2 of forward capability
      this.targetHorizVelocityCache.addScaledVector(this.rightCache, normSide * currentSpeed * 0.5);
    }

    // Apply linear interpolation for inertia/momentum
    // When jumping, direction change rate is 1/3 of the ground control (6.0 vs 18.0)
    const lerpFactor = this.onGround ? 18.0 : 6.0;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, this.targetHorizVelocityCache.x, lerpFactor * deltaTime);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, this.targetHorizVelocityCache.z, lerpFactor * deltaTime);

    // 2. Apply gravity / water buoyancy
    if (!this.onGround) {
      let currentGravity = this.gravity;
      let currentTerminalVelocity = this.terminalVelocity;

      if (this.inWater) {
        currentGravity = -8.0; // Reduced gravity in water
        currentTerminalVelocity = -5.0; // Slower sinking terminal velocity
      }

      this.velocity.y += currentGravity * deltaTime;
      if (this.velocity.y < currentTerminalVelocity) {
        this.velocity.y = currentTerminalVelocity;
      }
    }

    // 3. Apply jumping / swimming
    if (this.inWater) {
      if (keys['Space']) {
        this.velocity.y = 3.0; // Swim upward speed
        this.onGround = false;
      }
    } else if (this.onGround && keys['Space']) {
      this.velocity.y = this.jumpForce;
      this.onGround = false;
      gameAudio.playJumpSound();
    }

    // 4. Update position & resolve collisions sequentially for precision (X, then Z, then Y)

    // --- X Axis ---
    this.position.x += this.velocity.x * deltaTime;
    let collisions = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);
    for (const block of collisions) {
      const overlapsX = (this.position.x + radius > block.minX) && (this.position.x - radius < block.maxX);
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      const overlapsZ = (this.position.z + radius > block.minZ) && (this.position.z - radius < block.maxZ);
      if (overlapsX && overlapsY && overlapsZ) {
        // Resolve based on player center relative to block center
        const blockCenterX = block.minX + 0.5;
        if (this.position.x < blockCenterX) {
          this.position.x = block.minX - radius; // Snap to left side
        } else {
          this.position.x = block.maxX + radius; // Snap to right side
        }
        this.velocity.x = 0;
      }
    }

    // --- Z Axis ---
    this.position.z += this.velocity.z * deltaTime;
    collisions = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);
    for (const block of collisions) {
      const overlapsX = (this.position.x + radius > block.minX) && (this.position.x - radius < block.maxX);
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      const overlapsZ = (this.position.z + radius > block.minZ) && (this.position.z - radius < block.maxZ);
      if (overlapsX && overlapsY && overlapsZ) {
        const blockCenterZ = block.minZ + 0.5;
        if (this.position.z < blockCenterZ) {
          this.position.z = block.minZ - radius; // Snap to back
        } else {
          this.position.z = block.maxZ + radius; // Snap to front
        }
        this.velocity.z = 0;
      }
    }

    // --- Y Axis (Vertical) ---
    const oldOnGround = this.onGround;
    this.onGround = false;

    this.position.y += this.velocity.y * deltaTime;
    collisions = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);

    for (const block of collisions) {
      // Add safety margin epsilon to prevent wall contacts from incorrectly registering as vertical head/foot collisions due to float rounding
      const overlapsX = (this.position.x + radius - 0.05 > block.minX) && (this.position.x - radius + 0.05 < block.maxX);
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      const overlapsZ = (this.position.z + radius - 0.05 > block.minZ) && (this.position.z - radius + 0.05 < block.maxZ);
      if (overlapsX && overlapsY && overlapsZ) {
        if (this.velocity.y < 0) {
          // Collided with ground below
          const overlapY = block.maxY - this.position.y;
          if (overlapY > 0) {
            this.position.y += overlapY;
            this.velocity.y = 0;
            this.onGround = true;
          }
        } else if (this.velocity.y > 0) {
          // Head collision with ceiling block
          const overlapY = (this.position.y + height) - block.minY;
          if (overlapY > 0) {
            this.position.y -= overlapY;
            this.velocity.y = 0;
          }
        }
      }
    }

    // Snaps to bedrock level if player somehow falls below the map
    if (this.position.y < 1.001) {
      this.position.y = 1.0;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Fall damage calculation & landing sound
    this.lastFallDamage = 0;
    if (!this.onGround && !this.isFalling && this.velocity.y < -1.0) {
      // Started falling — record starting height
      this.isFalling = true;
      this.fallStartY = this.position.y;
    }
    if (this.onGround && !oldOnGround) {
      gameAudio.playLandSound();
      if (this.isFalling) {
        const fallDistance = this.fallStartY - this.position.y;
        // Falls > 3 blocks deal damage (1 damage per block beyond 3)
        // Water negates fall damage
        if (fallDistance > 3.0 && !this.inWater) {
          this.lastFallDamage = Math.floor(fallDistance - 3);
        }
        this.isFalling = false;
      }
    }
    // Track highest point during fall
    if (this.isFalling && this.position.y > this.fallStartY) {
      this.fallStartY = this.position.y;
    }
    // Reset fall tracking when on ground
    if (this.onGround) {
      this.isFalling = false;
    }

    // Footstep sounds
    if (this.onGround && (this.velocity.x !== 0 || this.velocity.z !== 0)) {
      this.stepTimer += deltaTime;
      const threshold = this.isCrouching ? this.stepInterval * 1.5 : (this.isSprinting ? this.stepInterval * 0.6 : this.stepInterval);
      if (this.stepTimer >= threshold) {
        gameAudio.playFootstepSound();
        this.stepTimer = 0;
      }
    } else {
      this.stepTimer = 0;
    }
  }
}

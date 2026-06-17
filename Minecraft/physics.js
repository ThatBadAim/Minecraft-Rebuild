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
            // Unloaded chunk - act as solid wall/floor
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
    const tickRate = 0.05;

    const height = this.getCurrentHeight();
    const radius = this.playerWidth / 2;

    const px = Math.floor(this.position.x);
    const pz = Math.floor(this.position.z);
    const feetY = Math.floor(this.position.y);
    const bodyY = Math.floor(this.position.y + 1);

    const feetBlock = world.getBlock(px, feetY, pz);
    const bodyBlock = world.getBlock(px, bodyY, pz);

    this.inWater = (feetBlock && feetBlock.type === BLOCKS.WATER) || (bodyBlock && bodyBlock.type === BLOCKS.WATER);

    const blockBelow = world.getBlock(px, feetY - 1, pz);
    const isOnIce = blockBelow && blockBelow.type === BLOCKS.ICE;
    const isOnSlime = blockBelow && blockBelow.type === BLOCKS.SLIME;
    const inCobweb = (feetBlock && feetBlock.type === BLOCKS.COBWEB) || (bodyBlock && bodyBlock.type === BLOCKS.COBWEB);

    if (inCobweb) {
      this.velocity.x *= 0.25;
      this.velocity.z *= 0.25;
    } else if (this.onGround) {
      const friction = isOnIce ? 0.98 : 0.546;
      this.velocity.x *= friction;
      this.velocity.z *= friction;
    } else {
      this.velocity.x *= 0.91;
      this.velocity.z *= 0.91;
    }

    this.forwardCache.set(cameraDirection.x, 0, cameraDirection.z).normalize();
    this.rightCache.crossVectors(this.forwardCache, this.upCache).normalize();

    let forwardInput = 0;
    if (keys['KeyW'] || keys['ArrowUp']) forwardInput += 1;
    if (keys['KeyS'] || keys['ArrowDown']) forwardInput -= 1;

    let sideInput = 0;
    if (keys['KeyD'] || keys['ArrowRight']) sideInput += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) sideInput -= 1;

    const inputLength = Math.sqrt(forwardInput * forwardInput + sideInput * sideInput);

    const wasCrouching = this.isCrouching;
    this.isCrouching = keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC'];

    let hitWallAhead = false;
    if (this.isSprinting) {
        const testPos = this.position.clone().addScaledVector(this.forwardCache, 0.2);
        const aheadCols = this.getBlocksIntersecting(world, testPos, this.playerWidth, height);
        if (aheadCols.length > 0) hitWallAhead = true;
    }

    const isMovingForward = forwardInput > 0;
    this.isSprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && isMovingForward && !this.isCrouching && !hitWallAhead;
    if (forwardInput < 0) this.isSprinting = false;

    if (wasCrouching && !this.isCrouching) {
      const topBlocks = this.getBlocksIntersecting(world, this.position, this.playerWidth, this.playerHeight);
      if (topBlocks.length > 0) {
        this.isCrouching = true;
      }
    }

    // Walking: 4.317 m/s, Sprinting: 5.612 m/s, Sneaking: 1.31 m/s. Converted to m/tick by multiplying by 0.05
    let targetSpeed = 4.317 * tickRate;
    this.playerCrouchHeight = 1.5; // Update sneak height constraint

    if (this.isCrouching) {
      targetSpeed = 1.31 * tickRate;
    } else if (this.isSprinting) {
      targetSpeed = 5.612 * tickRate;
    }

    if (this.inWater) {
      targetSpeed *= 0.35;
    }

    if (inputLength > 0 && !inCobweb) {
      const normForward = forwardInput / inputLength;
      const normSide = sideInput / inputLength;
      this.velocity.addScaledVector(this.forwardCache, normForward * targetSpeed);
      this.velocity.addScaledVector(this.rightCache, normSide * targetSpeed * 0.5);
    }

    // Sneaking Edge Guardrail
    if (this.isCrouching && this.onGround) {
        const testX = new THREE.Vector3(this.position.x + this.velocity.x, this.position.y - 0.1, this.position.z);
        const colX = this.getBlocksIntersecting(world, testX, this.playerWidth, height);
        if (colX.length === 0) this.velocity.x = 0;

        const testZ = new THREE.Vector3(this.position.x, this.position.y - 0.1, this.position.z + this.velocity.z);
        const colZ = this.getBlocksIntersecting(world, testZ, this.playerWidth, height);
        if (colZ.length === 0) this.velocity.z = 0;
    }

    let currentGravity = -32.0;
    let currentTerminalVelocity = -50.0;

    if (this.inWater) {
      currentGravity = -8.0;
      currentTerminalVelocity = -5.0;
    }

    if (inCobweb) {
        this.velocity.y = -0.05;
    } else if (!this.onGround) {
      this.velocity.y += currentGravity * tickRate;
      if (this.velocity.y < currentTerminalVelocity) {
        this.velocity.y = currentTerminalVelocity;
      }
    }

    if (this.inWater) {
      if (keys['Space']) {
        this.velocity.y = 0.15;
        this.onGround = false;
      }
    } else if (this.onGround && keys['Space']) {
      this.velocity.y = 0.42;
      this.onGround = false;

      if (this.isSprinting) {
          this.velocity.addScaledVector(this.forwardCache, 0.2);
      }
      gameAudio.playJumpSound();
    }

    this.position.x += this.velocity.x;
    let collisions = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);
    for (const block of collisions) {
      const overlapsX = (this.position.x + radius > block.minX) && (this.position.x - radius < block.maxX);
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      const overlapsZ = (this.position.z + radius > block.minZ) && (this.position.z - radius < block.maxZ);
      if (overlapsX && overlapsY && overlapsZ) {
        const blockCenterX = block.minX + 0.5;
        if (this.position.x < blockCenterX) {
          this.position.x = block.minX - radius;
        } else {
          this.position.x = block.maxX + radius;
        }
        this.velocity.x = 0;
      }
    }

    this.position.z += this.velocity.z;
    collisions = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);
    for (const block of collisions) {
      const overlapsX = (this.position.x + radius > block.minX) && (this.position.x - radius < block.maxX);
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      const overlapsZ = (this.position.z + radius > block.minZ) && (this.position.z - radius < block.maxZ);
      if (overlapsX && overlapsY && overlapsZ) {
        const blockCenterZ = block.minZ + 0.5;
        if (this.position.z < blockCenterZ) {
          this.position.z = block.minZ - radius;
        } else {
          this.position.z = block.maxZ + radius;
        }
        this.velocity.z = 0;
      }
    }


    const oldOnGround = this.onGround;
    this.onGround = false;
    let hitSlime = false;

    this.position.y += this.velocity.y;
    collisions = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);

    for (const block of collisions) {
      // If block.minY is undefined (it's an unloaded chunk boundary), treat it as solid floor at y=0 or just stop player
      if (block.minY === undefined) {
         // It's a void/unloaded chunk. Stop falling.
         this.velocity.y = 0;
         this.onGround = true;
         continue;
      }

      const overlapsX = (this.position.x + radius - 0.05 > block.minX) && (this.position.x - radius + 0.05 < block.maxX);
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      const overlapsZ = (this.position.z + radius - 0.05 > block.minZ) && (this.position.z - radius + 0.05 < block.maxZ);
      if (overlapsX && overlapsY && overlapsZ) {
        if (this.velocity.y < 0) {
          const overlapY = block.maxY - this.position.y;
          if (overlapY > 0) {
            this.position.y += overlapY;
            const b = world.getBlock(block.x, block.y, block.z);
            if (b && b.type === BLOCKS.SLIME) {
                hitSlime = true;
            } else {
                this.velocity.y = 0;
            }
            this.onGround = true;
          }
        } else if (this.velocity.y > 0) {
          const overlapY = (this.position.y + height) - block.minY;
          if (overlapY > 0) {
            this.position.y -= overlapY;
            this.velocity.y = 0;
          }
        }
      }
    }

    if (hitSlime && this.velocity.y < -0.1) {
       this.velocity.y = Math.abs(this.velocity.y) * 0.8;
       this.onGround = false;
       this.lastFallDamage = 0;
       this.isFalling = false;
    }

    if (this.position.y < 1.001) {
      this.position.y = 1.0;
      this.velocity.y = 0;
      this.onGround = true;
    }

    if (!hitSlime) {
      this.lastFallDamage = 0;
      if (!this.onGround && !this.isFalling && this.velocity.y < -0.1) {
        this.isFalling = true;
        this.fallStartY = this.position.y;
      }
      if (this.onGround && !oldOnGround) {
        gameAudio.playLandSound();
        if (this.isFalling) {
          const fallDistance = this.fallStartY - this.position.y;
          if (fallDistance > 3.0 && !this.inWater) {
            this.lastFallDamage = Math.floor(fallDistance - 3);
          }
          this.isFalling = false;
        }
      }
      if (this.isFalling && this.position.y > this.fallStartY) {
        this.fallStartY = this.position.y;
      }
      if (this.onGround) {
        this.isFalling = false;
      }
    }

    if (this.onGround && (this.velocity.x !== 0 || this.velocity.z !== 0)) {
      this.stepTimer += tickRate;
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
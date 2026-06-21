import { gameAudio } from './audio.js';
import { BLOCKS } from './world.js';

export class PhysicsEngine {
  constructor() {
    this.playerHeight = 1.8;
    this.playerCrouchHeight = 1.5;
    this.playerWidth = 0.6; // Width & Depth from center (0.3 radius)

    // Player physical state
    this.position = new THREE.Vector3(8, 60, 8); // Spawns safely high
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.isCrouching = false;
    this.isSprinting = false;

    // Caches for GC optimization
    this.forwardCache = new THREE.Vector3();
    this.rightCache = new THREE.Vector3();
    this.upCache = new THREE.Vector3(0, 1, 0);

    // Fall damage tracking
    this.fallStartY = 0;
    this.isFalling = false;
    this.lastFallDamage = 0;

    // Footstep tracking
    this.stepTimer = 0;
    this.stepInterval = 0.5; // seconds
  }

  getBlocksIntersecting(world, pos, width, height) {
    const minX = Math.floor(pos.x - width / 2);
    const maxX = Math.floor(pos.x + width / 2);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + height);
    const minZ = Math.floor(pos.z - width / 2);
    const maxZ = Math.floor(pos.z + width / 2);

    const blocks = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = world.getBlock(x, y, z);
          if (block) {
            blocks.push({
              x, y, z, type: block.type,
              minX: x, maxX: x + 1,
              minY: y, maxY: y + 1,
              minZ: z, maxZ: z + 1,
              isLoaded: true
            });
          } else if (block === null) {
              blocks.push({
                  x, y, z, type: null,
                  minX: x, maxX: x + 1,
                  minY: y, maxY: y + 1,
                  minZ: z, maxZ: z + 1,
                  isLoaded: false
              });
          }
        }
      }
    }
    return blocks;
  }

  update(tickRate, keys, cameraDirection, world) {
    // Exact Minecraft Java Edition tick-based movement and player physics system
    // 1 tick = 0.05 seconds

    const height = this.isCrouching ? this.playerCrouchHeight : this.playerHeight;
    const radius = this.playerWidth / 2;

    const px = Math.floor(this.position.x);
    const py = Math.floor(this.position.y);
    const pz = Math.floor(this.position.z);

    // Environmental conditions
    const feetBlock = world.getBlock(px, py, pz);
    const bodyBlock = world.getBlock(px, py + 1, pz);
    const blockBelow = world.getBlock(px, py - 1, pz);

    const isWater = (feetBlock && feetBlock.type === BLOCKS.WATER) || (bodyBlock && bodyBlock.type === BLOCKS.WATER);
    const isLava = (feetBlock && feetBlock.type === BLOCKS.LAVA) || (bodyBlock && bodyBlock.type === BLOCKS.LAVA);
    const inCobweb = (feetBlock && feetBlock.type === BLOCKS.COBWEB) || (bodyBlock && bodyBlock.type === BLOCKS.COBWEB);
    const onLadder = (feetBlock && feetBlock.type === BLOCKS.LADDER) || (bodyBlock && bodyBlock.type === BLOCKS.LADDER) ||
                     (feetBlock && feetBlock.type === BLOCKS.VINES) || (bodyBlock && bodyBlock.type === BLOCKS.VINES);

    // 1. Calculate Acceleration & Slipperiness
    let S = 1.0; // Air
    if (this.onGround && blockBelow) {
        if (blockBelow.type === BLOCKS.SLIME) S = 0.8;
        else if (blockBelow.type === BLOCKS.ICE || blockBelow.type === BLOCKS.PACKED_ICE || blockBelow.type === BLOCKS.BLUE_ICE) S = 0.98;
        else S = 0.6; // Default blocks
    } else if (this.onGround) {
        S = 0.6; // Fallback
    }

    this.forwardCache.set(cameraDirection.x, 0, cameraDirection.z).normalize();
    this.rightCache.crossVectors(this.forwardCache, this.upCache).normalize();

    let forwardInput = 0;
    if (keys['KeyW'] || keys['ArrowUp']) forwardInput += 1;
    if (keys['KeyS'] || keys['ArrowDown']) forwardInput -= 1;

    let sideInput = 0;
    if (keys['KeyD'] || keys['ArrowRight']) sideInput -= 1; // Negative for right in ThreeJS right vector cross product logic
    if (keys['KeyA'] || keys['ArrowLeft']) sideInput += 1;

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
    if (forwardInput <= 0) this.isSprinting = false;

    if (wasCrouching && !this.isCrouching) {
      const topBlocks = this.getBlocksIntersecting(world, this.position, this.playerWidth, this.playerHeight);
      if (topBlocks.length > 0) {
        this.isCrouching = true;
      }
    }

    let M = 1.0; // Walking
    if (this.isCrouching) M = 0.3;
    else if (this.isSprinting) M = 1.3;

    // Wait! The rules state "Crawling / Swimming: 0.0600 blocks/tick". Swimming changes M effectively or limits input.
    // In water, acceleration changes, but wait! The formula says: 0.1 * M * E * (0.6/S)^3
    // But there are environmental block overrides. Let's stick to the prompt's explicit formulas.

    let E = 1.0; // Status effects

    // Calculate Horizontal Velocity
    if (inputLength > 0 && !inCobweb) {
        let normForward = forwardInput / inputLength;
        let normSide = sideInput / inputLength;

        let inputVecX = normForward * this.forwardCache.x + normSide * this.rightCache.x;
        let inputVecZ = normForward * this.forwardCache.z + normSide * this.rightCache.z;

        const baseAccel = 0.1 * M * E * Math.pow(0.6 / S, 3);

        let accelMag = baseAccel * 0.98; // Base multiplier to align close to Java
        if (this.isCrouching) {
            accelMag = baseAccel * 0.9912; // Precise modifier for Sneaking
        }

        this.velocity.x = (this.velocity.x * S * 0.91) + (inputVecX * accelMag);
        this.velocity.z = (this.velocity.z * S * 0.91) + (inputVecZ * accelMag);
    } else {
        this.velocity.x = (this.velocity.x * S * 0.91);
        this.velocity.z = (this.velocity.z * S * 0.91);
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

    // Vertical Velocity & Gravity
    let gravityReduction = 0.08;
    let dragModifier = 0.98;
    let terminalDesc = -3.9200;

    if (isWater) {
        gravityReduction = 0.02;
        dragModifier = 0.80;
        terminalDesc = -0.1332;
    } else if (isLava) {
        gravityReduction = 0.02;
        dragModifier = 0.50;
        terminalDesc = -0.0400;
    }

    if (inCobweb) {
        this.velocity.x *= 0.25;
        this.velocity.z *= 0.25;
        this.velocity.y = -0.05;
    } else {
        if (this.onGround && keys['Space']) {
            this.velocity.y = 0.42;
            this.onGround = false;
            if (this.isSprinting) {
                // Sprint-Jump Vector Boost
                this.velocity.x += this.forwardCache.x * 0.2;
                this.velocity.z += this.forwardCache.z * 0.2;
            }
            gameAudio.playJumpSound();
        } else if (!this.onGround || isWater || isLava) {
            if (isWater && keys['Space']) {
                this.velocity.y += 0.04;
            }
            this.velocity.y = (this.velocity.y - gravityReduction) * dragModifier;
            if (this.velocity.y < terminalDesc) {
                this.velocity.y = terminalDesc;
            }
        }
    }

    // Float Truncation Rule
    if (this.onGround && Math.abs(this.velocity.y) < 0.003) {
        this.velocity.y = 0.0;
    }

    // AABB Resolution Setup
    // Resolve Y, then X, then Z
    const oldOnGround = this.onGround;
    this.onGround = false;
    let hitSlime = false;

    this.position.y += this.velocity.y;
    let collisionsY = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);
    if (this.velocity.y > 0) collisionsY.sort((a,b) => a.minY - b.minY);
    else if (this.velocity.y < 0) collisionsY.sort((a,b) => b.maxY - a.maxY);

    for (const block of collisionsY) {
      if (!block.isLoaded && this.velocity.y < 0) {
           this.position.y = block.maxY;
           this.velocity.y = 0;
           this.onGround = true;
           continue;
      }
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

    // Resolve X
    this.position.x += this.velocity.x;
    let collisionsX = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);
    if (this.velocity.x > 0) collisionsX.sort((a,b) => a.minX - b.minX);
    else if (this.velocity.x < 0) collisionsX.sort((a,b) => b.maxX - a.maxX);

    let horizColX = false;
    for (const block of collisionsX) {
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      const overlapsZ = (this.position.z + radius > block.minZ) && (this.position.z - radius < block.maxZ);
      if (overlapsY && overlapsZ) {
          if (this.velocity.x > 0) {
            this.position.x = block.minX - radius;
            horizColX = true;
          } else if (this.velocity.x < 0) {
            this.position.x = block.maxX + radius;
            horizColX = true;
          }
          this.velocity.x = 0;
      }
    }

    // Resolve Z
    this.position.z += this.velocity.z;
    let collisionsZ = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);
    if (this.velocity.z > 0) collisionsZ.sort((a,b) => a.minZ - b.minZ);
    else if (this.velocity.z < 0) collisionsZ.sort((a,b) => b.maxZ - a.maxZ);

    let horizColZ = false;
    for (const block of collisionsZ) {
      const overlapsX = (this.position.x + radius > block.minX) && (this.position.x - radius < block.maxX);
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      if (overlapsX && overlapsY) {
          if (this.velocity.z > 0) {
            this.position.z = block.minZ - radius;
            horizColZ = true;
          } else if (this.velocity.z < 0) {
            this.position.z = block.maxZ + radius;
            horizColZ = true;
          }
          this.velocity.z = 0;
      }
    }

    // Ladders / Vines logic
    if (onLadder) {
        if ((horizColX || horizColZ) && inputLength > 0) {
            this.velocity.y = 0.1176;
        } else if (forwardInput === 0 && sideInput === 0 && this.velocity.y < -0.1500) {
            this.velocity.y = -0.1500;
        }
    }

    // World floor failsafe
    if (this.position.y < 1.001) {
      this.position.y = 1.0;
      this.velocity.y = 0;
      this.onGround = true;
    }

    if (hitSlime && this.velocity.y < -0.1) {
       this.velocity.y = Math.abs(this.velocity.y) * 0.8;
       this.onGround = false;
       this.lastFallDamage = 0;
       this.isFalling = false;
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
          if (fallDistance > 3.0 && !isWater) {
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

    // Footsteps
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

const fs = require('fs');
let code = fs.readFileSync('Minecraft/physics.js', 'utf8');

const updatedCollisionCheck = `
  // Get blocks intersecting AABB
  getBlocksIntersecting(world, pos, width, height) {
    const radius = width / 2;
    const minX = Math.floor(pos.x - radius);
    const maxX = Math.floor(pos.x + radius);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + height);
    const minZ = Math.floor(pos.z - radius);
    const maxZ = Math.floor(pos.z + radius);

    const collidingBlocks = [];

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = world.getBlock(x, y, z);
          // If chunk not loaded or bedrock boundary, block might be null
          if (!block || block.solid) {
            collidingBlocks.push({
              x: x, y: y, z: z,
              minX: x, maxX: x + 1,
              minY: y, maxY: y + 1,
              minZ: z, maxZ: z + 1,
              isLoaded: block !== null
            });
          }
        }
      }
    }
    return collidingBlocks;
  }
`;

const updatedPhysicsUpdate = `
    this.position.x += this.velocity.x;
    let collisionsX = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);
    if (this.velocity.x > 0) collisionsX.sort((a,b) => a.minX - b.minX);
    else if (this.velocity.x < 0) collisionsX.sort((a,b) => b.maxX - a.maxX);

    for (const block of collisionsX) {
      const overlapsX = (this.position.x + radius > block.minX) && (this.position.x - radius < block.maxX);
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      const overlapsZ = (this.position.z + radius > block.minZ) && (this.position.z - radius < block.maxZ);
      if (overlapsX && overlapsY && overlapsZ) {
        if (this.velocity.x > 0) {
          this.position.x = block.minX - radius;
        } else if (this.velocity.x < 0) {
          this.position.x = block.maxX + radius;
        }
        this.velocity.x = 0;
      }
    }

    this.position.z += this.velocity.z;
    let collisionsZ = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);
    if (this.velocity.z > 0) collisionsZ.sort((a,b) => a.minZ - b.minZ);
    else if (this.velocity.z < 0) collisionsZ.sort((a,b) => b.maxZ - a.maxZ);

    for (const block of collisionsZ) {
      const overlapsX = (this.position.x + radius > block.minX) && (this.position.x - radius < block.maxX);
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      const overlapsZ = (this.position.z + radius > block.minZ) && (this.position.z - radius < block.maxZ);
      if (overlapsX && overlapsY && overlapsZ) {
        if (this.velocity.z > 0) {
          this.position.z = block.minZ - radius;
        } else if (this.velocity.z < 0) {
          this.position.z = block.maxZ + radius;
        }
        this.velocity.z = 0;
      }
    }

    const oldOnGround = this.onGround;
    this.onGround = false;
    let hitSlime = false;

    this.position.y += this.velocity.y;
    let collisionsY = this.getBlocksIntersecting(world, this.position, this.playerWidth, height);
    if (this.velocity.y > 0) collisionsY.sort((a,b) => a.minY - b.minY);
    else if (this.velocity.y < 0) collisionsY.sort((a,b) => b.maxY - a.maxY);

    for (const block of collisionsY) {
      const overlapsX = (this.position.x + radius > block.minX) && (this.position.x - radius < block.maxX);
      const overlapsY = (this.position.y + height > block.minY) && (this.position.y < block.maxY);
      const overlapsZ = (this.position.z + radius > block.minZ) && (this.position.z - radius < block.maxZ);
      if (overlapsX && overlapsY && overlapsZ) {
        if (!block.isLoaded && this.velocity.y < 0) {
           // We are falling into an unloaded chunk. Freeze vertical movement to prevent falling through world
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
    }
`;

code = code.replace(/getBlocksIntersecting\(world, pos, width, height\) \{[\s\S]*?return collidingBlocks;\s+\}/, updatedCollisionCheck.trim());
code = code.replace(/this\.position\.x \+= this\.velocity\.x;[\s\S]*?if \(hitSlime && this\.velocity\.y < -0\.1\)/, updatedPhysicsUpdate.trim() + '\n\n    if (hitSlime && this.velocity.y < -0.1)');

fs.writeFileSync('Minecraft/physics.js', code);

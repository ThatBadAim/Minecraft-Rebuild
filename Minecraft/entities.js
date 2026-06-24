import { gameAudio } from './audio.js';
import { BLOCKS } from './world.js';

class Animal {
  constructor(x, y, z, scene, type) {
    this.type = type;
    this.scene = scene;
    this.health = 3;
    this.maxHealth = 3;
    this.hurtTimer = 0;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.scene.add(this.group);
    this.originalMaterials = new Map();

    this.velocity = new THREE.Vector3();
    this.speed = 1.0;
    this.angle = Math.random() * Math.PI * 2;
    this.state = 'wander';
    this.stateTimer = Math.random() * 3 + 2;
    this.grazeTimer = 0;
    this.walkAnimTime = 0;
  }

  takeDamage(amount) {
    if (this.health <= 0) return;
    this.health -= amount;
    this.flashRed();

    if (gameAudio && gameAudio.playHurtSound) {
      gameAudio.playHurtSound();
    }

    // Jump/run when hit
    this.velocity.y = 3.5;
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 2.5; // Run faster
    this.state = 'wander';
    this.stateTimer = 1.5;
  }

  flashRed() {
    this.hurtTimer = 0.2;
    if (!Animal.redFlashMat) {
      Animal.redFlashMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    }
    this.group.traverse(child => {
      if (child.isMesh) {
        if (!this.originalMaterials.has(child)) {
          this.originalMaterials.set(child, child.material);
        }
        child.material = Animal.redFlashMat;
      }
    });
  }

  resetMaterials() {
    this.group.traverse(child => {
      if (child.isMesh && this.originalMaterials.has(child)) {
        child.material = this.originalMaterials.get(child);
      }
    });
  }

  update(dt, world, playerPos, onPlayerDamage) {
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) {
        this.resetMaterials();
      }
    }

    if (this.health <= 0) return;

    if (this.type === 'zombie') {
      if (this.damageCooldown > 0) {
        this.damageCooldown -= dt;
      }
      if (playerPos) {
        const dist = this.group.position.distanceTo(playerPos);
        if (dist < 15.0) {
          this.state = 'chase';
          const dx = playerPos.x - this.group.position.x;
          const dz = playerPos.z - this.group.position.z;
          this.angle = Math.atan2(dz, dx);
          this.speed = 1.6;

          if (dist < 1.4 && this.damageCooldown <= 0) {
            if (onPlayerDamage) {
              onPlayerDamage(1);
              this.damageCooldown = 1.0;
            }
          }
        } else {
          if (this.state === 'chase') {
            this.state = 'wander';
            this.stateTimer = 1.0;
          }
        }
      }
    }

    if (this.state !== 'chase') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        if (this.state === 'wander') {
          if (Math.random() < 0.25) {
            this.state = 'graze';
            this.stateTimer = 1.5 + Math.random() * 1.5;
            this.velocity.set(0, this.velocity.y, 0);
          } else {
            this.angle = Math.random() * Math.PI * 2;
            this.stateTimer = 2.0 + Math.random() * 3.0;
            this.speed = 1.0;
          }
        } else {
          this.state = 'wander';
          this.angle = Math.random() * Math.PI * 2;
          this.stateTimer = 2.0 + Math.random() * 3.0;
          this.speed = 1.0;
        }
      }
    }

    if (this.state === 'wander' || this.state === 'chase') {
      const vx = Math.cos(this.angle) * this.speed;
      const vz = Math.sin(this.angle) * this.speed;
      this.velocity.x = vx;
      this.velocity.z = vz;

      this.walkAnimTime += dt * this.speed * 5;
      if (this.legs) {
        this.legs.forEach((leg, idx) => {
          const mult = idx % 2 === 0 ? 1 : -1;
          leg.rotation.x = Math.sin(this.walkAnimTime) * 0.5 * mult;
        });
      }

      const targetRotation = -this.angle + Math.PI / 2;
      let diff = targetRotation - this.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.group.rotation.y += diff * dt * 5;

      if (this.headPivot) {
        this.headPivot.rotation.x = THREE.MathUtils.lerp(this.headPivot.rotation.x, 0, dt * 5);
      }
    } else if (this.state === 'graze') {
      this.velocity.x = 0;
      this.velocity.z = 0;
      if (this.legs) {
        this.legs.forEach(leg => {
          leg.rotation.x = 0;
        });
      }
      if (this.headPivot) {
        this.headPivot.rotation.x = THREE.MathUtils.lerp(this.headPivot.rotation.x, 0.6, dt * 5);
      }
    }

    this.velocity.y -= 9.8 * dt;
    this.group.position.y += this.velocity.y * dt;

    const px = this.group.position.x;
    const py = this.group.position.y;
    const pz = this.group.position.z;

    const blockBelow = world.getBlock(Math.floor(px), Math.floor(py), Math.floor(pz));
    if (blockBelow && blockBelow.solid) {
      this.group.position.y = Math.floor(py) + 1.0;
      this.velocity.y = 0;

      const forwardX = px + Math.cos(this.angle) * 0.5;
      const forwardZ = pz + Math.sin(this.angle) * 0.5;
      const blockAhead = world.getBlock(Math.floor(forwardX), Math.floor(py + 0.5), Math.floor(forwardZ));
      if (blockAhead && blockAhead.solid) {
        this.velocity.y = 4.0;
      }

      const nextX = px + Math.cos(this.angle) * 0.8;
      const nextZ = pz + Math.sin(this.angle) * 0.8;
      const blockNextBelow = world.getBlock(Math.floor(nextX), Math.floor(py - 0.5), Math.floor(nextZ));
      if (!blockNextBelow || !blockNextBelow.solid) {
        this.angle += Math.PI;
        this.stateTimer = 1.0;
      }
    }

    this.group.position.x += this.velocity.x * dt;
    this.group.position.z += this.velocity.z * dt;

    if (this.group.position.y < 0) {
      this.group.position.y = 40;
      this.velocity.set(0, 0, 0);
    }
  }

  destroy() {
    this.scene.remove(this.group);
    this.group.traverse(child => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}

export class Sheep extends Animal {
  constructor(x, y, z, scene) {
    super(x, y, z, scene, 'sheep');
    this.woolMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.skinMaterial = new THREE.MeshLambertMaterial({ color: 0xeedcbd });
    this.legMaterial = new THREE.MeshLambertMaterial({ color: 0xddccaa });
    this.buildModel();
  }

  buildModel() {
    const bodyGeo = new THREE.BoxGeometry(0.9, 0.6, 0.6);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.woolMaterial);
    bodyMesh.position.set(0, 0.5, 0);
    this.group.add(bodyMesh);

    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.7, 0.45);
    this.group.add(this.headPivot);

    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const headMesh = new THREE.Mesh(headGeo, this.woolMaterial);
    headMesh.position.set(0, 0, 0);
    this.headPivot.add(headMesh);

    const faceGeo = new THREE.BoxGeometry(0.25, 0.2, 0.2);
    const faceMesh = new THREE.Mesh(faceGeo, this.skinMaterial);
    faceMesh.position.set(0, -0.05, 0.15);
    this.headPivot.add(faceMesh);

    this.legs = [];
    const legGeo = new THREE.BoxGeometry(0.16, 0.5, 0.16);
    const legPositions = [
      [-0.3, 0.25, 0.2],
      [0.3, 0.25, 0.2],
      [-0.3, 0.25, -0.2],
      [0.3, 0.25, -0.2]
    ];

    legPositions.forEach(pos => {
      const legMesh = new THREE.Mesh(legGeo, this.legMaterial);
      legMesh.position.set(pos[0], pos[1], pos[2]);
      this.group.add(legMesh);
      this.legs.push(legMesh);
    });
  }
}

export class Cow extends Animal {
  constructor(x, y, z, scene) {
    super(x, y, z, scene, 'cow');
    this.cowMaterial = new THREE.MeshLambertMaterial({ color: 0x3d2712 });
    this.snoutMaterial = new THREE.MeshLambertMaterial({ color: 0xeebfa1 });
    this.hornMaterial = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    this.legMaterial = new THREE.MeshLambertMaterial({ color: 0x24160a });
    this.buildModel();
  }

  buildModel() {
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.8, 0.8);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.cowMaterial);
    bodyMesh.position.set(0, 0.7, 0);
    this.group.add(bodyMesh);

    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.9, 0.6);
    this.group.add(this.headPivot);

    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const headMesh = new THREE.Mesh(headGeo, this.cowMaterial);
    headMesh.position.set(0, 0, 0);
    this.headPivot.add(headMesh);

    const snoutGeo = new THREE.BoxGeometry(0.3, 0.2, 0.15);
    const snoutMesh = new THREE.Mesh(snoutGeo, this.snoutMaterial);
    snoutMesh.position.set(0, -0.1, 0.25);
    this.headPivot.add(snoutMesh);

    const hornGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
    const leftHorn = new THREE.Mesh(hornGeo, this.hornMaterial);
    leftHorn.position.set(-0.25, 0.25, 0);
    const rightHorn = new THREE.Mesh(hornGeo, this.hornMaterial);
    rightHorn.position.set(0.25, 0.25, 0);
    this.headPivot.add(leftHorn);
    this.headPivot.add(rightHorn);

    this.legs = [];
    const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const legPositions = [
      [-0.4, 0.3, 0.35],
      [0.4, 0.3, 0.35],
      [-0.4, 0.3, -0.35],
      [0.4, 0.3, -0.35]
    ];

    legPositions.forEach(pos => {
      const legMesh = new THREE.Mesh(legGeo, this.legMaterial);
      legMesh.position.set(pos[0], pos[1], pos[2]);
      this.group.add(legMesh);
      this.legs.push(legMesh);
    });
  }
}

export class Zombie extends Animal {
  constructor(x, y, z, scene) {
    super(x, y, z, scene, 'zombie');
    this.health = 4;
    this.maxHealth = 4;
    this.greenMat = new THREE.MeshLambertMaterial({ color: 0x147a14 });
    this.blueMat = new THREE.MeshLambertMaterial({ color: 0x2244aa });
    this.damageCooldown = 0;
    this.buildModel();
  }

  buildModel() {
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.greenMat);
    bodyMesh.position.set(0, 0.65, 0);
    this.group.add(bodyMesh);

    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.0, 0);
    this.group.add(this.headPivot);

    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const headMesh = new THREE.Mesh(headGeo, this.greenMat);
    headMesh.position.set(0, 0.18, 0);
    this.headPivot.add(headMesh);

    const armGeo = new THREE.BoxGeometry(0.12, 0.12, 0.45);
    const leftArm = new THREE.Mesh(armGeo, this.greenMat);
    leftArm.position.set(-0.22, 0.7, 0.2);
    const rightArm = new THREE.Mesh(armGeo, this.greenMat);
    rightArm.position.set(0.22, 0.7, 0.2);
    this.group.add(leftArm);
    this.group.add(rightArm);

    this.legs = [];
    const legGeo = new THREE.BoxGeometry(0.16, 0.5, 0.16);
    const leftLeg = new THREE.Mesh(legGeo, this.blueMat);
    leftLeg.position.set(-0.12, 0.25, 0);
    const rightLeg = new THREE.Mesh(legGeo, this.blueMat);
    rightLeg.position.set(0.12, 0.25, 0);
    this.group.add(leftLeg);
    this.group.add(rightLeg);
    this.legs.push(leftLeg, rightLeg);
  }
}

// Shared static resources for Collectibles to prevent dynamic heap allocation spikes and GC freezes
const sharedCollectibleGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
const collectibleMaterialCache = {};

export class Collectible {
  constructor(x, y, z, type, scene) {
    this.type = type;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);

    let matColor = 0xc93232; // Default meat color
    if (type === 'wool') {
      matColor = 0xf0f0f0;
    } else if (type === 'meat') {
      matColor = 0xc93232;
    } else {
      matColor = this.getBlockColor(type);
    }

    // Retrieve from cache or allocate once
    let mat = collectibleMaterialCache[matColor];
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ color: matColor });
      collectibleMaterialCache[matColor] = mat;
    }

    const mesh = new THREE.Mesh(sharedCollectibleGeometry, mat);
    this.group.add(mesh);
    this.scene.add(this.group);

    this.time = 0;
    this.lifetime = 30.0; // Auto-despawn after 30 seconds
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      2.0, // initial pop up velocity
      (Math.random() - 0.5) * 1.5
    );
    this.onGround = false;
    this.baseY = y;
  }

  getBlockColor(type) {
    switch (type) {
      case 1: return 0x557a2b; // GRASS
      case 2: return 0x866043; // DIRT
      case 3: return 0x7a7a7a; // STONE
      case 4: return 0x6d5032; // WOOD
      case 5: return 0x2d5e2d; // LEAVES
      case 6: return 0xe5c185; // SAND
      case 7: return 0xffffff; // GLASS
      case 8: return 0xa64d3b; // BRICK
      case 9: return 0xbf9b68; // PLANKS
      case 11: return 0x3c2918; // PINE_WOOD
      case 12: return 0x1b3f22; // PINE_LEAVES
      case 13: return 0xeaeaea; // BIRCH_WOOD
      case 14: return 0x5c9e31; // BIRCH_LEAVES
      case 15: return 0x1e90ff; // WATER
      case 16: return 0x8b5a2b; // STICK
      case 17: return 0x7a7a7a; // STONE_PICKAXE
      default: return 0x888888;
    }
  }

  update(dt, world, playerPos, onCollect) {
    this.time += dt;
    this.group.rotation.y += dt * 2.5;

    // Auto-despawn after lifetime expires
    if (this.time >= this.lifetime) {
      return 'despawn';
    }

    if (!this.onGround) {
      this.velocity.y -= 9.8 * dt;
      this.group.position.x += this.velocity.x * dt;
      this.group.position.y += this.velocity.y * dt;
      this.group.position.z += this.velocity.z * dt;

      const px = Math.floor(this.group.position.x);
      const py = Math.floor(this.group.position.y);
      const pz = Math.floor(this.group.position.z);
      const block = world.getBlock(px, py, pz);
      if (block && block.solid) {
        this.group.position.y = py + 1.0;
        this.baseY = this.group.position.y;
        this.onGround = true;
        this.velocity.set(0, 0, 0);
      }
    } else {
      this.group.position.y = this.baseY + Math.sin(this.time * 4.0) * 0.1;
    }

    const dx = this.group.position.x - playerPos.x;
    const dy = this.group.position.y - playerPos.y;
    const dz = this.group.position.z - playerPos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < 2.25) { // 1.5^2
      onCollect(this.type);
      return true;
    }
    return false;
  }

  destroy() {
    this.scene.remove(this.group);
  }
}

export class EntityManager {
  constructor(scene, onPlayerDamage = null, onCollect = null) {
    this.scene = scene;
    this.onPlayerDamage = onPlayerDamage;
    this.onCollect = onCollect;
    this.animals = [];
    this.collectibles = [];

    this.counts = {
      meat: 0,
      wool: 0
    };
  }

  spawnCollectible(type, x, y, z) {
    const coll = new Collectible(x, y, z, type, this.scene);
    this.collectibles.push(coll);
    return coll;
  }

  spawnAnimal(type, x, y, z) {
    let animal;
    if (type === 'sheep') {
      animal = new Sheep(x, y, z, this.scene);
    } else {
      animal = new Cow(x, y, z, this.scene);
    }
    this.animals.push(animal);
    return animal;
  }

  spawnZombie(x, y, z) {
    const zombie = new Zombie(x, y, z, this.scene);
    this.animals.push(zombie);
    return zombie;
  }

  spawnAnimalInChunk(cx, cz, world, gameTime) {
    if (Math.random() > 0.6) return;

    const lx = 2 + Math.floor(Math.random() * 12);
    const lz = 2 + Math.floor(Math.random() * 12);
    const wx = cx * 16 + lx;
    const wz = cz * 16 + lz;

    // Scan down from the very top to find the highest non-air block
    let topBlockY = -1;
    for (let y = 63; y >= 0; y--) {
      const block = world.getBlock(wx, y, wz);
      if (block && block.type !== 0) { // Not air
        topBlockY = y;
        break;
      }
    }

    if (topBlockY !== -1) {
      const topBlock = world.getBlock(wx, topBlockY, wz);
      // Only spawn if the highest block is Grass (1) or Sand (6)
      if (topBlock && (topBlock.type === 1 || topBlock.type === 6)) {
        const blockAbove1 = world.getBlock(wx, topBlockY + 1, wz);
        const blockAbove2 = world.getBlock(wx, topBlockY + 2, wz);
        const hasClearance = (!blockAbove1 || blockAbove1.type === 0) && (!blockAbove2 || blockAbove2.type === 0);

        if (hasClearance) {
          const isNight = gameTime !== undefined && (gameTime >= 18.0 || gameTime < 6.0);
          if (isNight && Math.random() > 0.4) {
            this.spawnZombie(wx + 0.5, topBlockY + 1.0, wz + 0.5);
          } else {
            const type = Math.random() > 0.5 ? 'sheep' : 'cow';
            this.spawnAnimal(type, wx + 0.5, topBlockY + 1.0, wz + 0.5);
          }
        }
      }
    }
  }

  getAnimalMeshes() {
    const meshes = [];
    this.animals.forEach(animal => {
      if (animal.health > 0) {
        animal.group.traverse(child => {
          if (child.isMesh) {
            meshes.push(child);
          }
        });
      }
    });
    return meshes;
  }

  checkHit(camera, raycaster) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const meshes = this.getAnimalMeshes();
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const hit = intersects[0];
      if (hit.distance <= 6.0) {
        let parent = hit.object.parent;
        while (parent && parent !== this.scene) {
          const animal = this.animals.find(a => a.group === parent);
          if (animal) {
            animal.takeDamage(1);
            return true;
          }
          parent = parent.parent;
        }
      }
    }
    return false;
  }

  update(dt, world, playerPos) {
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const animal = this.animals[i];
      animal.update(dt, world, playerPos, this.onPlayerDamage);

      // Despawn animal if it is too far from the player (e.g. 48 blocks / 3 chunks away)
      const dx = animal.group.position.x - playerPos.x;
      const dz = animal.group.position.z - playerPos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 2304) { // 48^2
        animal.destroy();
        this.animals.splice(i, 1);
        continue;
      }

      if (animal.health <= 0) {
        const dropType = animal.type === 'sheep' ? BLOCKS.WOOL : BLOCKS.MEAT;
        this.spawnCollectible(
          dropType,
          animal.group.position.x,
          animal.group.position.y + 0.2,
          animal.group.position.z
        );

        animal.destroy();
        this.animals.splice(i, 1);
      }
    }

    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const coll = this.collectibles[i];
      const result = coll.update(dt, world, playerPos, (type) => {
        if (this.onCollect) {
          this.onCollect(type);
        } else {
          this.counts[type]++;
          const el = document.getElementById(`${type}-count`);
          if (el) el.innerText = this.counts[type];

          if (gameAudio && gameAudio.playPlaceSound) {
            gameAudio.playPlaceSound();
          }
        }
      });

      if (result) {
        coll.destroy();
        this.collectibles.splice(i, 1);
      }
    }
  }
}

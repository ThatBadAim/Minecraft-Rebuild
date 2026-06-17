const fs = require('fs');
let code = fs.readFileSync('Minecraft/game.js', 'utf8');

const shiftLogic = `
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
    // We treat 'main' as Main Inventory and 'hotbar' as Hotbar. Container isn't fully implemented in base code, but if we assume 'craft-in'/'craft-out' as "container" for now:
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
      // We don't have chests, so we skip container if it's not open or we don't treat crafting as container for shift-fill.
      // Let's just do Main -> Hotbar
      let remainder = this.shiftFillSlots(slotStack, 27, 35);
      if (remainder === 0) {
        this.setSlotStack(type, index, null);
      } else {
        slotStack.count = remainder;
        this.setSlotStack(type, index, slotStack);
      }
      moved = true;
    } else if (type === 'hotbar') {
      // From Hotbar -> Open Container -> Main
      // Let's just do Hotbar -> Main
      let remainder = this.shiftFillSlots(slotStack, 0, 26);
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
`;

code = code.replace(/handleSlotMousedown\(e\) \{/, shiftLogic + '\n  handleSlotMousedown(e) {');

const keyboardLogic = `
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
`;

code = code.replace(/if \(this\.playerHealth <= 0\) return;\s+this\.keys\[e\.code\] = true;/g, `if (this.playerHealth <= 0) return;\n      this.keys[e.code] = true;\n` + keyboardLogic);

const spawnLogic = `
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
`;

code = code.replace(/spawnParticles\(x, y, z, blockType\) \{/, spawnLogic + '\n  spawnParticles(x, y, z, blockType) {');

fs.writeFileSync('Minecraft/game.js', code);

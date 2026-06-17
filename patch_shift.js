const fs = require('fs');
let code = fs.readFileSync('Minecraft/game.js', 'utf8');

const updatedShift = `
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
`;

code = code.replace(/\/\/ UI Routing Priority \(Shift-Click\)[\s\S]*?if \(moved\) \{/g, updatedShift + '\n\n    if (moved) {');
fs.writeFileSync('Minecraft/game.js', code);

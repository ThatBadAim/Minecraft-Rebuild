const fs = require('fs');
let code = fs.readFileSync('Minecraft/game.js', 'utf8');

const dragLogic = `
  handleDragUpdate(type, index) {
    if (!this.cursorStack) {
      this.isDraggingLeft = false;
      this.isDraggingRight = false;
      return;
    }
    if (type === 'craft-out') return;

    const key = \`\${type}-\${index}\`;
    if (this.draggedSlots.has(key)) return;

    let slotStack = this.getSlotStack(type, index);
    if (slotStack && slotStack.type !== this.cursorStack.type) return;

    const max = BLOCK_INFO[this.cursorStack.type].maxStack || 64;

    if (this.isDraggingRight) {
      if (this.cursorStack.count > 0) {
        if (!slotStack) {
          this.setSlotStack(type, index, { type: this.cursorStack.type, count: 1 });
          this.cursorStack.count--;
          this.draggedSlots.add(key);
        } else if (slotStack.count < max) {
          slotStack.count++;
          this.cursorStack.count--;
          this.setSlotStack(type, index, slotStack);
          this.draggedSlots.add(key);
        }
        if (this.cursorStack.count <= 0) this.cursorStack = null;
      }
    } else if (this.isDraggingLeft) {
      this.draggedSlots.add(key);
      const numSlots = this.draggedSlots.size;
      const perSlot = Math.floor(this.dragStartStackCount / numSlots);
      let remaining = this.dragStartStackCount;

      this.draggedSlots.forEach(slotKey => {
        const [t, i] = slotKey.split('-');
        const idx = t === 'offhand' ? 'offhand' : parseInt(i, 10);
        let sStack = this.getSlotStack(t, idx);

        if (!sStack) {
          sStack = { type: this.cursorStack.type, count: 0 };
        }

        const amt = Math.min(perSlot, max);
        sStack.count = amt;
        remaining -= amt;

        if (sStack.count > 0) {
          this.setSlotStack(t, idx, sStack);
        } else {
          this.setSlotStack(t, idx, null);
        }
      });

      this.cursorStack.count = remaining;
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
    }
    if (this.isDraggingRight) {
      this.isDraggingRight = false;
      this.draggedSlots.clear();
    }
  }
`;

code = code.replace(/handleMouseUp\\(e\\) \\{[\\s\\S]*?\\}\\s*\\s*collectAllMatchingToCursor\\(\\) \\{/g, dragLogic + '\\n\\n  collectAllMatchingToCursor() {');

fs.writeFileSync('Minecraft/game.js', code);

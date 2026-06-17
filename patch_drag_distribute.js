const fs = require('fs');
let code = fs.readFileSync('Minecraft/game.js', 'utf8');

const updatedDrag = `
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
          this.draggedSlots.set(key, 0); // using map to store original count
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
      const perSlot = Math.floor(this.dragStartStackCount / numSlots);
      let remaining = this.dragStartStackCount;

      this.draggedSlots.forEach((originalCount, slotKey) => {
        const [t, i] = slotKey.split('-');
        const idx = t === 'offhand' ? 'offhand' : parseInt(i, 10);
        let sStack = this.getSlotStack(t, idx);

        if (!sStack) {
          sStack = { type: this.cursorStack.type, count: 0 };
        }

        const space = max - originalCount;
        const add = Math.min(perSlot, space);

        sStack.count = originalCount + add;
        remaining -= add;

        if (sStack.count > 0) {
          this.setSlotStack(t, idx, sStack);
        } else {
          this.setSlotStack(t, idx, null);
        }
      });

      this.cursorStack.count = remaining;
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
`;

code = code.replace(/handleDragUpdate\(type, index\) \{[\s\S]*?collectAllMatchingToCursor\(\) \{/g, updatedDrag.trim() + '\n\n  collectAllMatchingToCursor() {');

// Fix the draggedSlots initialization in mousedown
code = code.replace(/this\.draggedSlots\.clear\(\);\s+this\.draggedSlots\.add\(`\$\{type\}-\$\{index\}`\);/g, `this.draggedSlots = new Map();\n            this.draggedSlots.set(\`\${type}-\${index}\`, slotStack ? slotStack.count : 0);`);
code = code.replace(/this\.draggedSlots = new Set\(\);/g, `this.draggedSlots = new Map();`);

fs.writeFileSync('Minecraft/game.js', code);

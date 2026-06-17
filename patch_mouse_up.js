const fs = require('fs');
let code = fs.readFileSync('Minecraft/game.js', 'utf8');

const updatedMouseUp = `
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

code = code.replace(/handleMouseUp\(e\) \{[\s\S]*?collectAllMatchingToCursor\(\) \{/g, updatedMouseUp.trim() + '\n\n  collectAllMatchingToCursor() {');
fs.writeFileSync('Minecraft/game.js', code);

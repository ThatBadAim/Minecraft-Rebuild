const fs = require('fs');
let code = fs.readFileSync('Minecraft/game.js', 'utf8');

// Add dragging mouseenter logic
code = code.replace(/slotEl.addEventListener\('mouseenter', \(\) => \{ this.hoveredSlotIndex = i; this.hoveredSlotType = 'main'; \}\);/g, `slotEl.addEventListener('mouseenter', () => { this.hoveredSlotIndex = i; this.hoveredSlotType = 'main'; this.handleDragUpdate('main', i); });`);
code = code.replace(/slotEl.addEventListener\('mouseenter', \(\) => \{ this.hoveredSlotIndex = i; this.hoveredSlotType = 'hotbar'; \}\);/g, `slotEl.addEventListener('mouseenter', () => { this.hoveredSlotIndex = i; this.hoveredSlotType = 'hotbar'; this.handleDragUpdate('hotbar', i); });`);
code = code.replace(/inputEl.addEventListener\('mouseenter', \(\) => \{ this.hoveredSlotIndex = i; this.hoveredSlotType = 'craft-in'; \}\);/g, `inputEl.addEventListener('mouseenter', () => { this.hoveredSlotIndex = i; this.hoveredSlotType = 'craft-in'; this.handleDragUpdate('craft-in', i); });`);

// Update mousedown for slots
code = code.replace(/slotEl.addEventListener\('mousedown',/g, `slotEl.addEventListener('mousedown',`); // noop
// We'll replace mousedown for index in build UI

fs.writeFileSync('Minecraft/game.js', code);

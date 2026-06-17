const fs = require('fs');
let code = fs.readFileSync('Minecraft/game.js', 'utf8');

// Replace handleCraftInputClick with updated listeners binding
code = code.replace(/for \(let i = 0; i < 4; i\+\+\) \{\s+const inputEl = document.getElementById\(`craft-in-\$\{i\}`\);\s+if \(inputEl\) \{\s+inputEl.addEventListener\('click', \(\) => this.handleCraftInputClick\(i\)\);\s+\}\s+\}/g, `for (let i = 0; i < 4; i++) {
      const inputEl = document.getElementById(\`craft-in-\${i}\`);
      if (inputEl) {
        inputEl.addEventListener('mouseenter', () => { this.hoveredSlotIndex = i; this.hoveredSlotType = 'craft-in'; });
        inputEl.addEventListener('mouseleave', () => { if (this.hoveredSlotIndex === i && this.hoveredSlotType === 'craft-in') { this.hoveredSlotIndex = null; this.hoveredSlotType = null; } });
      }
    }`);

code = code.replace(/craftOutputEl.addEventListener\('click', \(\) => this.handleCraftOutputClick\(\)\);/g, `craftOutputEl.addEventListener('mouseenter', () => { this.hoveredSlotIndex = 0; this.hoveredSlotType = 'craft-out'; });
      craftOutputEl.addEventListener('mouseleave', () => { if (this.hoveredSlotType === 'craft-out') { this.hoveredSlotIndex = null; this.hoveredSlotType = null; } });`);

fs.writeFileSync('Minecraft/game.js', code);

import { gameAudio } from './audio.js';

export class UIEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = canvasId;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '100'; // Make sure it's above Three.js canvas
        document.body.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext('2d');

    this.GuiScale = 2; // Default scale
    this.width = 0; // In scaled pixels
    this.height = 0; // In scaled pixels

    this.activeScreen = null;

    this.mouseX = 0;
    this.mouseY = 0;
    this.isMouseDown = false;

    this.textures = {
      dirt: new Image(),
      panorama: new Image() // We might use procedural or shader instead
    };
    this.textures.dirt.src = 'options_background.png'; // Need to make sure this exists or gracefully fallback

    this.setupEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.lastTime = performance.now();
    this.requestAnimationFrame();
  }

  setupEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      // Mouse coordinates in scaled pixels
      this.mouseX = (e.clientX - rect.left) / this.GuiScale;
      this.mouseY = (e.clientY - rect.top) / this.GuiScale;

      if (this.activeScreen) {
        this.activeScreen.onMouseMove(this.mouseX, this.mouseY);
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      if (this.activeScreen) {
        this.activeScreen.onMouseDown(this.mouseX, this.mouseY);
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      this.isMouseDown = false;
      if (this.activeScreen) {
        this.activeScreen.onMouseUp(this.mouseX, this.mouseY);
      }
    });
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Calculate GuiScale based on viewport size
    // Minecraft scale calculation:
    // Scale 1: < 640x480
    // Scale 2: >= 640x480
    // Scale 3: >= 960x720
    // Scale 4: >= 1280x960

    let scale = 1;
    while (scale < 4 && window.innerWidth >= (scale + 1) * 320 && window.innerHeight >= (scale + 1) * 240) {
      scale++;
    }
    this.GuiScale = scale; // Max scale logic, we can allow options to override later

    this.width = this.canvas.width / this.GuiScale;
    this.height = this.canvas.height / this.GuiScale;

    if (this.activeScreen) {
      this.activeScreen.onResize(this.width, this.height);
    }
  }

  setScreen(screen) {
    if (this.activeScreen) {
        this.activeScreen.onClose();
    }
    this.activeScreen = screen;
    if (this.activeScreen) {
      this.activeScreen.engine = this;
      this.activeScreen.onResize(this.width, this.height);
      this.activeScreen.onInit();
    }
  }

  requestAnimationFrame() {
    requestAnimationFrame(() => this.render());
  }

  render() {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000.0;
    this.lastTime = now;

    // Clear whole canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.activeScreen) {
      this.ctx.save();
      this.ctx.scale(this.GuiScale, this.GuiScale);

      this.activeScreen.update(dt);
      this.activeScreen.render(this.ctx, dt);

      this.ctx.restore();
    }

    this.requestAnimationFrame();
  }

  // Helpers
  drawTextWithShadow(ctx, text, x, y, color, shadowColor, align = 'left', font = '10px "Press Start 2P", monospace') {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';

    ctx.fillStyle = shadowColor;
    ctx.fillText(text, x + 1, y + 1);

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}

export class UIComponent {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
    this.isHovered = false;
  }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.width && py >= this.y && py <= this.y + this.height;
  }

  onMouseMove(px, py) {
    this.isHovered = this.contains(px, py);
  }
  onMouseDown(px, py) {}
  onMouseUp(px, py) {}
  update(dt) {}
  render(ctx) {}
}

export class Button extends UIComponent {
  constructor(x, y, width, height, text, onClick) {
    super(x, y, width, height);
    this.text = text;
    this.onClick = onClick;
    this.disabled = false;
    this.textColor = '#E0E0E0';
    this.hoverTextColor = '#FFFF55';
    this.disabledTextColor = '#707070';
  }

  onMouseDown(px, py) {
    if (this.disabled) return;
    if (this.contains(px, py)) {
      this.isDown = true;
    }
  }

  onMouseUp(px, py) {
    if (this.disabled) return;
    if (this.isDown && this.contains(px, py)) {
      if (this.onClick) this.onClick();
    }
    this.isDown = false;
  }

  render(ctx) {
    // Border
    ctx.fillStyle = this.isHovered && !this.disabled ? '#FFFFFF' : '#121212';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Gradient Background
    const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
    if (this.disabled) {
      grad.addColorStop(0, '#555555');
      grad.addColorStop(1, '#333333');
    } else if (this.isHovered) {
      grad.addColorStop(0, '#888888');
      grad.addColorStop(1, '#666666');
    } else {
      grad.addColorStop(0, '#777777');
      grad.addColorStop(1, '#555555');
    }

    // Fill inner rect (1px border)
    ctx.fillStyle = grad;
    ctx.fillRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);

    // Highlight top border
    ctx.fillStyle = this.disabled ? '#666666' : (this.isHovered ? '#AAAAAA' : '#999999');
    ctx.fillRect(this.x + 1, this.y + 1, this.width - 2, 1);
    // Dark bottom border
    ctx.fillStyle = this.disabled ? '#222222' : (this.isHovered ? '#444444' : '#333333');
    ctx.fillRect(this.x + 1, this.y + this.height - 2, this.width - 2, 1);

    let textColor = this.disabled ? this.disabledTextColor : (this.isHovered ? this.hoverTextColor : this.textColor);
    let shadowColor = '#242424'; // 25% of brightness, roughly

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text Shadow
    ctx.fillStyle = shadowColor;
    ctx.fillText(this.text, this.x + this.width / 2 + 1, this.y + this.height / 2 + 1);

    // Text
    ctx.fillStyle = textColor;
    ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2);
  }
}

function calculateShadowColor(hexStr) {
    if (hexStr === '#FFFF55') return '#3F3F15';
    if (hexStr === '#FFFFFF') return '#3F3F3F';
    if (hexStr === '#707070') return '#1C1C1C';
    if (hexStr === '#E0E0E0') return '#383838';

    // Parse hex
    let r = parseInt(hexStr.slice(1, 3), 16);
    let g = parseInt(hexStr.slice(3, 5), 16);
    let b = parseInt(hexStr.slice(5, 7), 16);

    r = Math.floor(r * 0.25);
    g = Math.floor(g * 0.25);
    b = Math.floor(b * 0.25);

    const toHex = (c) => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}


export class Slider extends UIComponent {
  constructor(x, y, width, height, labelFn, min, max, initialValue, onValueChanged) {
    super(x, y, width, height);
    this.labelFn = labelFn;
    this.min = min;
    this.max = max;
    this.value = initialValue;
    this.onValueChanged = onValueChanged;
    this.isDragging = false;
    this.text = this.labelFn(this.value);
  }

  get normalizedValue() {
    return (this.value - this.min) / (this.max - this.min);
  }

  set normalizedValue(n) {
    n = Math.max(0, Math.min(1, n));
    this.value = this.min + n * (this.max - this.min);
    this.text = this.labelFn(this.value);
    if (this.onValueChanged) {
        this.onValueChanged(this.value);
    }
  }

  onMouseDown(px, py) {
    if (this.contains(px, py)) {
      this.isDragging = true;
      this.updateFromMouse(px);
    }
  }

  onMouseUp(px, py) {
    this.isDragging = false;
  }

  onMouseMove(px, py) {
    if (this.isDragging) {
      this.updateFromMouse(px);
    }
  }

  updateFromMouse(px) {
    const handleWidth = 8;
    const trackWidth = this.width - handleWidth;
    let n = (px - (this.x + handleWidth/2)) / trackWidth;
    this.normalizedValue = n;
  }

  render(ctx, dt) {
    const isHovered = this.contains(window.gameController.uiEngine.mouseX, window.gameController.uiEngine.mouseY);

    // Draw background/border
    ctx.fillStyle = '#121212';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Track gradient
    const trackGrad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
    trackGrad.addColorStop(0, '#555555');
    trackGrad.addColorStop(1, '#888888');
    ctx.fillStyle = trackGrad;
    ctx.fillRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);

    // Handle
    const handleWidth = 8;
    const handleX = this.x + 1 + (this.width - 2 - handleWidth) * this.normalizedValue;

    const handleGrad = ctx.createLinearGradient(0, this.y, 0, this.y + this.height);
    if (isHovered || this.isDragging) {
        handleGrad.addColorStop(0, '#FFFFFF');
        handleGrad.addColorStop(1, '#AAAAAA');
    } else {
        handleGrad.addColorStop(0, '#AAAAAA');
        handleGrad.addColorStop(1, '#555555');
    }

    ctx.fillStyle = handleGrad;
    ctx.fillRect(handleX, this.y + 1, handleWidth, this.height - 2);

    ctx.strokeStyle = '#121212';
    ctx.lineWidth = 1;
    ctx.strokeRect(handleX, this.y + 1, handleWidth, this.height - 2);

    // Draw text
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = this.x + (this.width / 2);
    const textY = this.y + (this.height / 2);

    const textColor = (isHovered || this.isDragging) ? '#FFFF55' : '#E0E0E0';

    // Dynamic shadow calculation
    const shadowColor = calculateShadowColor(textColor);
    ctx.fillStyle = shadowColor;
    ctx.fillText(this.text, textX + 1, textY + 1);

    ctx.fillStyle = textColor;
    ctx.fillText(this.text, textX, textY);
  }
}


export class UtilityButton extends Button {
  constructor(x, y, text, onClick) {
    super(x, y, 20, 20, text, onClick);
  }
}

export class Label extends UIComponent {
  constructor(x, y, text, color = '#FFFFFF', shadowColor = '#3F3F3F', align = 'center') {
    super(x, y, 0, 0); // width/height don't matter as much for basic label
    this.text = text;
    this.color = color;
    this.shadowColor = shadowColor;
    this.align = align;
  }

  render(ctx) {
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = this.align;
    ctx.textBaseline = 'top';

    ctx.fillStyle = calculateShadowColor(this.color);
    ctx.fillText(this.text, this.x + 1, this.y + 1);

    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
  }
}

export class Screen {
  constructor() {
    this.engine = null;
    this.components = [];
  }

  onInit() {}
  onClose() {}

  onResize(width, height) {}

  onMouseMove(px, py) {
    for (let c of this.components) {
      c.onMouseMove(px, py);
    }
  }

  onMouseDown(px, py) {
    for (let c of this.components) {
      c.onMouseDown(px, py);
    }
  }

  onMouseUp(px, py) {
    for (let c of this.components) {
      c.onMouseUp(px, py);
    }
  }

  update(dt) {
    for (let c of this.components) {
      c.update(dt);
    }
  }

  render(ctx, dt) {
    for (let c of this.components) {
      c.render(ctx);
    }
  }
}

export class TitleScreen extends Screen {

  drawGradientBackground(ctx, width, height) {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#5C84BB');
    bgGrad.addColorStop(1, '#2F4F82');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  constructor() {
    super();
    this.time = 0;
  }

  onInit() {
    this.rebuild();
    this.panoramaTime = 0;
  }

  onResize(width, height) {
    this.rebuild();
  }

  rebuild() {
    this.components = [];
    const width = this.engine.width;
    const height = this.engine.height;

    // Central Button Stack Anchors
    const btnWidth = 200;
    const btnHeight = 20;
    const gap = 4;
    const centerX = width / 2;
    const startX = centerX - (btnWidth / 2);
    let startY = (height / 4) + 48;

    // Row 1
    this.components.push(new Button(startX, startY, btnWidth, btnHeight, "Singleplayer", () => {
      this.engine.setScreen(new SelectWorldScreen());
    }));

    // Row 2
    startY += btnHeight + gap;
    this.components.push(new Button(startX, startY, btnWidth, btnHeight, "Multiplayer", () => {
      // Not implemented
    }));

    // Row 3
    startY += btnHeight + gap;
    this.components.push(new Button(startX, startY, btnWidth, btnHeight, "Minecraft Realms", () => {
      // Not implemented
    }));

    // Row 4: Split
    startY += btnHeight + gap;
    const splitWidth = 98;
    this.components.push(new Button(startX, startY, splitWidth, btnHeight, "Options...", () => {
      this.engine.setScreen(new OptionsScreen());
    }));
    this.components.push(new Button(centerX + 2, startY, splitWidth, btnHeight, "Quit Game", () => {
      // Assuming web context, maybe show a message or do nothing
    }));

    // Utility Row (Language & Accessibility)
    // Left-hand margin / base layer (let's say X=2, and vertically aligned with Row 4)
    this.components.push(new UtilityButton(2, startY, "L", () => {})); // Language icon placeholder
    this.components.push(new UtilityButton(2 + 20 + gap, startY, "A", () => {})); // Access icon placeholder

    // Footer Text Left
    this.components.push(new Label(2, height - 10, "Minecraft [Version]", "#FFFFFF", "#3F3F3F", "left"));
    // Footer Text Right (we approximate width for right align by setting X to right edge and using right align)
    this.components.push(new Label(width - 2, height - 10, "Copyright Mojang Studios. Do not distribute!", "#FFFFFF", "#3F3F3F", "right"));
  }

  update(dt) {
    super.update(dt);
    this.time += dt;
  }

  render(ctx, dt) {
    const width = this.engine.width;
    const height = this.engine.height;

    // Background: Simple procedural sky/panorama fallback
    ctx.fillStyle = "#4B331D"; // Fallback dirt color
    ctx.fillRect(0, 0, width, height);

    // Draw Panorama (Placeholder: simple gradient)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#7392c6");
    bgGrad.addColorStop(1, "#36598c");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Main Logo: Center X = (width / 2) - 137, Y = 30
    const logoX = (width / 2) - 137;
    const logoY = 30;

    ctx.font = 'bold 32px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000000';
    ctx.fillText("MINECRAFT", width / 2 + 4, logoY + 4);
    ctx.fillStyle = '#A8A8A8';
    ctx.fillText("MINECRAFT", width / 2, logoY);

    // Splash Text Element
    const splashText = "Pixel Perfect!";
    const baseScale = 1.0;
    const scale = baseScale + Math.sin(this.time * 5) * 0.1; // Pulsate dynamically

    ctx.save();
    // Anchor precisely near the bottom-right boundary quadrant of the main logo.
    // Logo width ~ 274, height ~ 44. Bottom right is roughly logoX + 274, logoY + 44
    ctx.translate(logoX + 260, logoY + 40);
    ctx.rotate(-20 * Math.PI / 180);
    ctx.scale(scale, scale);

    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#3F3F00'; // Shadow
    ctx.fillText(splashText, 1, 1);
    ctx.fillStyle = '#FFFF55';
    ctx.fillText(splashText, 0, 0);

    ctx.restore();

    // Draw components
    super.render(ctx, dt);
  }
}

export class SelectWorldScreen extends Screen {
  constructor() {
    super();
    this.scrollY = 0;
    this.maxScrollY = 0;
    this.worlds = [
      { name: "New World", folder: "New World", time: "12/25/23 10:00 AM", mode: "Survival mode", version: "Version: 1.0.0" },
      { name: "Creative Test", folder: "Creative Test", time: "12/20/23 02:30 PM", mode: "Creative mode", version: "Version: 1.0.0" },
      { name: "Hardcore Run", folder: "Hardcore Run", time: "11/15/23 08:15 PM", mode: "Hardcore mode", version: "Version: 1.0.0" }
    ];
    this.selectedIndex = -1;
  }

  onInit() {
    this.rebuild();
  }

  onResize(width, height) {
    this.rebuild();
  }

  rebuild() {
    this.components = [];
    const width = this.engine.width;
    const height = this.engine.height;

    // Header Area: Y = 0 to 48. Has "Select World" label at Y=20.
    this.components.push(new Label(width / 2, 20, "Select World", "#FFFFFF", "#3F3F3F", "center"));

    // Footer Action Zone: Y = height - 64 to absolute bottom.
    // Top Button Row (Y = height - 52): Play Selected (150px) and Create New (150px)
    const playBtnX = (width / 2) - 152;
    const createBtnX = (width / 2) + 2;
    const topRowY = height - 52;

    const playBtn = new Button(playBtnX, topRowY, 150, 20, "Play Selected World", () => {
      // Transition to actual game!
      if (window.gameController) {
          window.gameController.controls.lock(); // This assumes game.js exposes gameController
      }
      this.engine.canvas.style.display = 'none'; // Hide UI
    });
    playBtn.disabled = true; // disabled by default until selected
    this.playBtn = playBtn;
    this.components.push(playBtn);

    this.components.push(new Button(createBtnX, topRowY, 150, 20, "Create New World", () => {
      // Not implemented
    }));

    // Bottom Button Row (Y = height - 28): Edit (64), Delete (64), Cancel (64)
    // Distributed evenly across 200px width approximately? No, the spec says "Three evenly distributed split utility buttons".
    // Let's center them with a 4px gap.
    const bottomRowY = height - 28;
    let currX = (width / 2) - 100;

    this.components.push(new Button(currX, bottomRowY, 64, 20, "Edit", () => {}));
    currX += 64 + 4;
    this.components.push(new Button(currX, bottomRowY, 64, 20, "Delete", () => {}));
    currX += 64 + 4;
    this.components.push(new Button(currX, bottomRowY, 64, 20, "Cancel", () => {
      this.engine.setScreen(new TitleScreen());
    }));
  }

  onMouseWheel(deltaY) {
    // Scroll the list
    const maxScroll = Math.max(0, (this.worlds.length * 40) - (this.engine.height - 64 - 48));
    this.scrollY += Math.sign(deltaY) * 15; // Scroll speed
    this.scrollY = Math.max(0, Math.min(this.scrollY, maxScroll));
  }

  onMouseDown(px, py) {
    const height = this.engine.height;
    const width = this.engine.width;

    // Check if clicking in the scrollable list container (Y = 48 to Y = height - 64)
    if (py >= 48 && py <= height - 64) {
      const listWidth = 220;
      const listX = (width / 2) - (listWidth / 2);

      if (px >= listX && px <= listX + listWidth) {
        // Calculate which item was clicked
        const listY = py - 48 + this.scrollY;
        const itemSpacing = 40;

        const clickedIndex = Math.floor(listY / itemSpacing);

        if (clickedIndex >= 0 && clickedIndex < this.worlds.length) {
            this.selectedIndex = clickedIndex;
            if (this.playBtn) this.playBtn.disabled = false;
        } else {
            this.selectedIndex = -1;
            if (this.playBtn) this.playBtn.disabled = true;
        }
      }
    }

    super.onMouseDown(px, py);
  }

  render(ctx, dt) {
    const width = this.engine.width;
    const height = this.engine.height;

    // Draw Background
    if (this.engine.textures.dirt.complete) {
        this.drawTiledBackground(ctx, 0, 0, width, height, 0.25);
    } else {
        ctx.fillStyle = '#2E1F14';
        ctx.fillRect(0, 0, width, height);
    }

    // Scrollable Container List Window (Y = 48 to Y = height - 64)
    const listStartY = 48;
    const listEndY = height - 64;
    const listHeight = listEndY - listStartY;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listStartY, width, listHeight);
    ctx.clip();

    // Draw List Items
    const itemHeight = 36;
    const itemSpacing = 40;
    const listWidth = 220;
    const listX = (width / 2) - (listWidth / 2);

    for (let i = 0; i < this.worlds.length; i++) {
        const itemY = listStartY + (i * itemSpacing) - this.scrollY;

        if (itemY + itemHeight < listStartY || itemY > listEndY) continue; // Culling

        // Draw Selection Background
        if (i === this.selectedIndex) {
            ctx.fillStyle = '#808080';
            ctx.fillRect(listX - 2, itemY - 2, listWidth + 4, itemHeight + 4);
            ctx.fillStyle = '#000000';
            ctx.fillRect(listX - 1, itemY - 1, listWidth + 2, itemHeight + 2);
        }

        // Left slot: 32x32 Thumbnail (X=32 from listX)
        ctx.fillStyle = '#808080';
        ctx.fillRect(listX + 32, itemY + 2, 32, 32);

        // Right slot: Text rows
        const textX = listX + 32 + 32 + 4;
        const world = this.worlds[i];

        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Top row: World Name
        ctx.fillStyle = '#3F3F3F';
        ctx.fillText(world.name, textX + 1, itemY + 4 + 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(world.name, textX, itemY + 4);

        // Bottom row
        const bottomText = `${world.folder} (${world.time})`;
        const modeText = `${world.mode}, ${world.version}`;

        // Use a smaller font or standard sans-serif for bottom row if retro font is too large, but specs ask for A0A0A0
        ctx.font = '6px "Press Start 2P", monospace';

        ctx.fillStyle = '#242424';
        ctx.fillText(bottomText, textX + 1, itemY + 18 + 1);
        ctx.fillText(modeText, textX + 1, itemY + 28 + 1);

        ctx.fillStyle = '#A0A0A0';
        ctx.fillText(bottomText, textX, itemY + 18);
        ctx.fillText(modeText, textX, itemY + 28);
    }

    ctx.restore();

    // Darker Header & Footer shadow gradients
    // Header shadow (Top down)
    const headerShadow = ctx.createLinearGradient(0, listStartY, 0, listStartY + 4);
    headerShadow.addColorStop(0, 'rgba(0,0,0,0.8)');
    headerShadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = headerShadow;
    ctx.fillRect(0, listStartY, width, 4);

    // Footer shadow (Bottom up)
    const footerShadow = ctx.createLinearGradient(0, listEndY, 0, listEndY - 4);
    footerShadow.addColorStop(0, 'rgba(0,0,0,0.8)');
    footerShadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = footerShadow;
    ctx.fillRect(0, listEndY - 4, width, 4);

    // Draw header and footer backgrounds to ensure they overlap list items cleanly
    // (We handled this by clipping the list area above)

    // Render Buttons and Labels
    super.render(ctx, dt);

    // DEBUG: Draw bounding boxes for footer buttons to verify no overlap
    /*
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    for (let c of this.components) {
      if (c instanceof Button && c.y >= height - 64) {
        ctx.strokeRect(c.x, c.y, c.width, c.height);
      }
    }
    */
  }

  drawTiledBackground(ctx, x, y, w, h, opacity) {
    const tex = this.engine.textures.dirt;
    if (!tex.complete || tex.naturalWidth === 0) {
        ctx.fillStyle = '#2E1F14';
        ctx.fillRect(x, y, w, h);
        return;
    }
    const tileSize = 32;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    for (let ty = y; ty < y + h; ty += tileSize) {
        for (let tx = x; tx < x + w; tx += tileSize) {
            ctx.drawImage(tex, tx, ty, tileSize, tileSize);
        }
    }

    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.fillRect(x, y, w, h);
    // Tint to charcoal-brown
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#2E1F14';
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();
  }
}

export class OptionsScreen extends Screen {
  constructor() {
    super();
  }

  onInit() {
    this.rebuild();
  }

  onResize(width, height) {
    this.rebuild();
  }

  rebuild() {
    this.components = [];
    const width = this.engine.width;
    const height = this.engine.height;

    // Header Area: Y = 15
    this.components.push(new Label(width / 2, 15, "Options", "#FFFFFF", "#3F3F3F", "center"));

    // The Settings Grid System
    // Rigid dual-column layout pattern centered around main axis.
    // Setting components must be exactly 150 scaled pixels wide.
    const leftAnchorX = (width / 2) - 155;
    const rightAnchorX = (width / 2) + 5;
    const settingWidth = 150;
    const btnHeight = 20;
    const gapY = 24; // Vertical spacing


    let currentY = 48; // Starting Y for grid

    const getGC = () => window.gameController;

    // Load initial values from localStorage if available, or fallback to sensible defaults
    const initialFov = parseFloat(localStorage.getItem('minecraft_clone_fov')) || 75;
    const initialRenderDist = parseInt(localStorage.getItem('minecraft_clone_render_dist')) || 6;
    const initialVolume = parseFloat(localStorage.getItem('minecraft_clone_volume')) || 0.5;
    const initialSens = parseFloat(localStorage.getItem('minecraft_clone_sensitivity')) || 0.002;

    this.components.push(new Slider(leftAnchorX, currentY, settingWidth, btnHeight,
        (v) => `FOV: ${Math.round(v)}`,
        30, 110, initialFov,
        (v) => {
            const gc = getGC();
            if (gc && gc.camera) {
                gc.camera.fov = Math.round(v);
                gc.camera.updateProjectionMatrix();
                localStorage.setItem('minecraft_clone_fov', Math.round(v));
            }
        }));

    this.components.push(new Slider(rightAnchorX, currentY, settingWidth, btnHeight,
        (v) => `Render Distance: ${Math.round(v)}`,
        2, 16, initialRenderDist,
        (v) => {
            const gc = getGC();
            if (gc) {
                gc.renderDistance = Math.round(v);
                gc.world.renderRadius = Math.round(v);
                localStorage.setItem('minecraft_clone_render_dist', Math.round(v));
            }
        }));

    currentY += gapY;

    this.components.push(new Slider(leftAnchorX, currentY, settingWidth, btnHeight,
        (v) => `Master Volume: ${Math.round(v * 100)}%`,
        0, 1, initialVolume,
        (v) => {
            gameAudio.setVolume(v);
            localStorage.setItem('minecraft_clone_volume', v);
        }));

    this.components.push(new Slider(rightAnchorX, currentY, settingWidth, btnHeight,
        (v) => `Sensitivity: ${(v * 500).toFixed(1)}x`,
        0.0001, 0.01, initialSens,
        (v) => {
            const gc = getGC();
            if (gc && gc.controls) {
                // Approximate multiplier
                gc.controls.pointerSpeed = v;
                localStorage.setItem('minecraft_clone_sensitivity', v);
            }
        }));

    currentY += gapY;


    this.components.push(new Button(leftAnchorX, currentY, settingWidth, btnHeight, "Controls...", () => {}));
    this.components.push(new Button(rightAnchorX, currentY, settingWidth, btnHeight, "Video Settings...", () => {}));

    currentY += gapY;
    this.components.push(new Button(leftAnchorX, currentY, settingWidth, btnHeight, "Language...", () => {}));
    this.components.push(new Button(rightAnchorX, currentY, settingWidth, btnHeight, "Music & Sounds...", () => {}));

    // Commit/Exit Anchor (Done Button)
    const doneBtnX = (width / 2) - 100;
    const doneBtnY = height - 30;
    this.components.push(new Button(doneBtnX, doneBtnY, 200, btnHeight, "Done", () => {
      this.engine.setScreen(new TitleScreen());
    }));
  }

  render(ctx, dt) {
    const width = this.engine.width;
    const height = this.engine.height;

    // Background: Uniform dark repeating dirt block matrix
    if (this.engine.textures.dirt.complete) {
        const tex = this.engine.textures.dirt;
        const tileSize = 32;
        ctx.save();
        for (let ty = 0; ty < height; ty += tileSize) {
            for (let tx = 0; tx < width; tx += tileSize) {
                ctx.drawImage(tex, tx, ty, tileSize, tileSize);
            }
        }
        ctx.fillStyle = `rgba(0, 0, 0, 0.25)`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#2E1F14';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    } else {
        ctx.fillStyle = '#2E1F14';
        ctx.fillRect(0, 0, width, height);
    }

    super.render(ctx, dt);
  }
}

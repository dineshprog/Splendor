/**
 * Splendor 3D & 2D Gem Token Visualizer
 * - Large, tactile, beveled ceramic chips with jewel inlays and edge notches.
 * - Ultra-clear, vibrant gem colors (Diamond, Sapphire, Emerald, Ruby, Onyx, Gold).
 * - Visibly stacked bank tokens that dynamically reduce chip-by-chip as they are taken.
 * - Smooth physics-based pickup flight animations and sparkle particle bursts.
 */

import { GEM_METADATA } from './cards-data.js';

export class GemTokenVisualizer {
  constructor(containerElement, onTokenClick) {
    this.container = containerElement;
    this.onTokenClick = onTokenClick;
    this.tokenCounts = { diamond: 7, sapphire: 7, emerald: 7, ruby: 7, onyx: 7, gold: 5 };
    this.selectedCounts = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 };
    this.prevSelectedCounts = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 };
    this.disabledColors = [];
    this.isThree = false;

    // Animation states
    this.flyingChips = []; // Chips flying from bank to staged or back
    this.sparkles = [];    // Burst particles
    this.hoveredColor = null;
    this.animFrameId = null;

    this.floatingCrystals = {};
    this.init();
  }

  init() {
    if (typeof window.THREE !== 'undefined') {
      try {
        this.initThree();
        this.isThree = true;
        return;
      } catch (e) {
        console.warn('Three.js initialization failed, falling back to enhanced 2D Canvas:', e);
      }
    }
    this.init2DCanvas();

    // Deferred upgrade: check if Three.js script finishes loading later
    if (typeof window !== 'undefined') {
      const upgradeCheck = setInterval(() => {
        if (typeof window.THREE !== 'undefined' && !this.isThree) {
          clearInterval(upgradeCheck);
          try {
            if (this.animFrameId) {
              cancelAnimationFrame(this.animFrameId);
              this.animFrameId = null;
            }
            this.initThree();
            this.isThree = true;
            this.update(this.tokenCounts, this.selectedCounts, this.disabledColors);
          } catch (err) {
            console.warn('Deferred Three.js upgrade failed:', err);
          }
        }
      }, 250);
      setTimeout(() => clearInterval(upgradeCheck), 8000);
    }
  }

  // =========================================================================
  // ENHANCED 2D CANVAS RENDERING WITH 3D DEPTH & FLIGHT ANIMATIONS
  // =========================================================================
  init2DCanvas() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.resize2D();

    window.addEventListener('resize', () => this.resize2D());

    // Pointer move for hover effect
    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const colors = ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx', 'gold'];
      const slotWidth = rect.width / colors.length;
      const idx = Math.floor(x / slotWidth);
      if (idx >= 0 && idx < colors.length) {
        const col = colors[idx];
        if (this.hoveredColor !== col) {
          this.hoveredColor = col;
          this.canvas.style.cursor = col === 'gold' ? 'not-allowed' : 'pointer';
        }
      } else {
        this.hoveredColor = null;
      }
    });

    this.canvas.addEventListener('pointerleave', () => {
      this.hoveredColor = null;
    });

    // Click handler
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const colors = ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx', 'gold'];
      const slotWidth = rect.width / colors.length;
      const index = Math.floor(x / slotWidth);

      if (index >= 0 && index < colors.length) {
        const color = colors[index];
        if (this.onTokenClick && !this.disabledColors.includes(color)) {
          this.onTokenClick(color);
        }
      }
    });

    this.start2DLoop();
  }

  resize2D() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.container.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 185;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  start2DLoop() {
    const loop = (timestamp) => {
      this.render2DFrame(timestamp);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  render2DFrame(timestamp) {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.ctx.clearRect(0, 0, w, h);

    const colors = ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx', 'gold'];
    const slotWidth = w / colors.length;

    // Slot centers and parameters
    const chipRadiusX = Math.min(slotWidth * 0.38, 44); // Large prominent width
    const chipRadiusY = chipRadiusX * 0.52;             // 3D perspective depth
    const chipThickness = Math.min(6.5, Math.max(3.8, (h - 45) / 8)); // Adaptive ceramic chip thickness
    const baseCy = h - 28;                              // Bottom anchor for stacks

    // Draw Central Table Velvet Slots & Stacks
    colors.forEach((color, idx) => {
      const meta = GEM_METADATA[color];
      const countInBank = this.tokenCounts[color] || 0;
      const stagedCount = this.selectedCounts[color] || 0;

      // STACK REDUCTION: bank stack visibly decreases when token is taken!
      const visibleCount = Math.max(0, countInBank - stagedCount);

      const cx = idx * slotWidth + slotWidth / 2;
      const isHovered = this.hoveredColor === color;
      const isDisabled = this.disabledColors.includes(color);

      this.ctx.save();
      if (isDisabled) this.ctx.globalAlpha = 0.35;

      // 1. Velvet Felt Recessed Indent (Table Slot)
      this.ctx.beginPath();
      this.ctx.ellipse(cx, baseCy, chipRadiusX + 4, chipRadiusY + 3, 0, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(10, 8, 16, 0.7)';
      this.ctx.fill();
      this.ctx.strokeStyle = stagedCount > 0 ? '#fbbf24' : (isHovered ? meta.borderHex : 'rgba(212, 175, 55, 0.2)');
      this.ctx.lineWidth = stagedCount > 0 ? 2.5 : (isHovered ? 2 : 1);
      this.ctx.stroke();

      // 2. Render Stack of Remaining Chips
      const stackHeight = Math.min(visibleCount, 7);

      for (let s = 0; s < stackHeight; s++) {
        const chipY = baseCy - s * chipThickness;
        const isTop = (s === stackHeight - 1);
        this.drawCeramicChip2D(cx, chipY, chipRadiusX, chipRadiusY, chipThickness, color, meta, isTop, isHovered && isTop);
      }

      // If stack is completely empty, draw subtle dashed warning
      if (visibleCount === 0) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('DEPLETED', cx, baseCy);
      }

      // 3. Staged / Picked Tokens Hovering Indicator (floating above stack)
      if (stagedCount > 0) {
        const hoverBob = Math.sin(timestamp * 0.005 + idx) * 4;
        const floatY = baseCy - (stackHeight * chipThickness) - 30 + hoverBob;

        // Glowing golden halo beneath floating token
        this.ctx.beginPath();
        this.ctx.ellipse(cx, floatY + 12, chipRadiusX * 0.7, chipRadiusY * 0.6, 0, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
        this.ctx.fill();

        // Draw the staged token hovering in the air
        for (let sc = 0; sc < stagedCount; sc++) {
          this.drawCeramicChip2D(
            cx,
            floatY - sc * chipThickness,
            chipRadiusX * 0.95,
            chipRadiusY * 0.95,
            chipThickness,
            color,
            meta,
            true,
            true
          );
        }

        // Staged tag
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.font = '900 13px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`+${stagedCount} PICKED`, cx, floatY - stagedCount * chipThickness - 10);
      }

      // 4. Color Name & Count Badge Below Stack
      const labelY = baseCy + chipRadiusY + 22;
      this.ctx.fillStyle = meta.borderHex || meta.colorHex;
      this.ctx.font = '800 12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`${meta.symbol} ${meta.name.toUpperCase()}`, cx, labelY);

      this.ctx.fillStyle = visibleCount === 0 ? '#94a3b8' : '#ffffff';
      this.ctx.font = 'bold 13px sans-serif';
      this.ctx.fillText(`× ${visibleCount}`, cx, labelY + 16);

      this.ctx.restore();
    });

    // 5. Render Active Flying Chip Animations
    this.updateAndRenderFlyingChips(timestamp, chipRadiusX, chipRadiusY, chipThickness);

    // 6. Render Sparkle Particles
    this.updateAndRenderSparkles();
  }

  /**
   * Draws a rich, authentic 3D faceted cut gemstone with facet reflections and crystalline depth
   */
  drawCeramicChip2D(cx, cy, rx, ry, thickness, color, meta, isTop = false, isGlow = false) {
    const ctx = this.ctx;
    const time = performance.now() * 0.002;

    // 1. Soft contact shadow underneath
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + thickness + 2, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fill();
    ctx.restore();

    // 2. 3D Beveled Pavilion / Lower Rim (Thickness extrusion)
    if (thickness > 0) {
      if (color === 'diamond') {
        ctx.fillStyle = '#bae6fd';
      } else if (color === 'onyx') {
        ctx.fillStyle = '#1c1c1f';
      } else if (color === 'gold') {
        ctx.fillStyle = '#d97706';
      } else {
        ctx.fillStyle = meta.accentHex || '#333';
      }

      ctx.beginPath();
      ctx.ellipse(cx, cy + thickness, rx, ry, 0, 0, Math.PI);
      ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
      ctx.fill();

      // Side facet vertical lines to give faceted crystal cylinder effect
      const sideSegments = color === 'onyx' ? 6 : (color === 'gold' ? 16 : 8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1;
      for (let s = 0; s < sideSegments; s++) {
        const ang = (s * Math.PI * 2) / sideSegments;
        if (Math.sin(ang) > 0) {
          const sx = cx + Math.cos(ang) * rx;
          const sy1 = cy + Math.sin(ang) * ry;
          const sy2 = sy1 + thickness;
          ctx.beginPath();
          ctx.moveTo(sx, sy1);
          ctx.lineTo(sx, sy2);
          ctx.stroke();
        }
      }
    }

    // 3. Faceted Crown Contour
    const numVerts = color === 'onyx' ? 6 : (color === 'gold' ? 16 : 8);
    const outerVerts = [];
    const tableVerts = [];

    const tableScaleX = 0.52;
    const tableScaleY = 0.50;
    const tableOffsetX = -rx * 0.12;
    const tableOffsetY = -ry * 0.15;

    for (let i = 0; i < numVerts; i++) {
      const angle = (i * Math.PI * 2) / numVerts - Math.PI / numVerts;
      const ox = cx + Math.cos(angle) * rx;
      const oy = cy + Math.sin(angle) * ry;
      outerVerts.push({ x: ox, y: oy });

      const tx = cx + tableOffsetX + Math.cos(angle) * (rx * tableScaleX);
      const ty = cy + tableOffsetY + Math.sin(angle) * (ry * tableScaleY);
      tableVerts.push({ x: tx, y: ty });
    }

    // 4. Draw Crown Kite / Star Facets with 3D Light Physics
    for (let i = 0; i < numVerts; i++) {
      const next = (i + 1) % numVerts;
      ctx.beginPath();
      ctx.moveTo(outerVerts[i].x, outerVerts[i].y);
      ctx.lineTo(outerVerts[next].x, outerVerts[next].y);
      ctx.lineTo(tableVerts[next].x, tableVerts[next].y);
      ctx.lineTo(tableVerts[i].x, tableVerts[i].y);
      ctx.closePath();

      const midAngle = (i + 0.5) * (Math.PI * 2 / numVerts) - Math.PI / numVerts;
      const dot = -Math.cos(midAngle) * 0.707 - Math.sin(midAngle) * 0.707;
      const lightFactor = Math.max(0, Math.min(1, (dot + 1) / 2));

      let facetColor;
      if (color === 'diamond') {
        const lightness = 65 + Math.round(lightFactor * 32);
        facetColor = `hsl(204, 85%, ${lightness}%)`;
      } else if (color === 'onyx') {
        const lightness = 10 + Math.round(lightFactor * 22); // Charcoal black range: 10% to 32%
        facetColor = `hsl(240, 4%, ${lightness}%)`;
      } else if (color === 'gold') {
        const lightness = 40 + Math.round(lightFactor * 38);
        facetColor = `hsl(43, 96%, ${lightness}%)`;
      } else if (color === 'ruby') {
        const lightness = 28 + Math.round(lightFactor * 36);
        facetColor = `hsl(354, 85%, ${lightness}%)`;
      } else if (color === 'emerald') {
        const lightness = 22 + Math.round(lightFactor * 36);
        facetColor = `hsl(158, 80%, ${lightness}%)`;
      } else {
        const lightness = 25 + Math.round(lightFactor * 38);
        facetColor = `hsl(221, 85%, ${lightness}%)`;
      }

      ctx.fillStyle = facetColor;
      ctx.fill();

      ctx.strokeStyle = lightFactor > 0.5 ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 5. Draw Table Facet (Top Flat Polygon)
    ctx.beginPath();
    ctx.moveTo(tableVerts[0].x, tableVerts[0].y);
    for (let i = 1; i < numVerts; i++) {
      ctx.lineTo(tableVerts[i].x, tableVerts[i].y);
    }
    ctx.closePath();

    if (color === 'diamond') {
      ctx.fillStyle = '#ffffff';
    } else if (color === 'onyx') {
      ctx.fillStyle = '#232326';
    } else if (color === 'gold') {
      ctx.fillStyle = '#fbbf24';
    } else if (color === 'ruby') {
      ctx.fillStyle = '#ef4444';
    } else if (color === 'emerald') {
      ctx.fillStyle = '#0bb27a';
    } else {
      ctx.fillStyle = '#2563eb';
    }

    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 6. Embossed 3D Symbol on Table
    ctx.save();
    ctx.fillStyle = (color === 'diamond') ? '#0284c7' : '#ffffff';
    ctx.font = `900 ${Math.round(rx * 0.44)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = (color === 'diamond') ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 4;
    ctx.fillText(meta.symbol, cx + tableOffsetX, cy + tableOffsetY);
    ctx.restore();

    // 7. Specular Lens Flare / Star Glint (✦) on highlight corner
    if (isTop) {
      const glintX = tableVerts[0].x;
      const glintY = tableVerts[0].y;
      const glintSize = Math.max(5, rx * 0.24);

      ctx.save();
      ctx.translate(glintX, glintY);
      ctx.rotate(time * 0.5);

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(-glintSize, 0);
      ctx.quadraticCurveTo(0, 0, 0, -glintSize);
      ctx.quadraticCurveTo(0, 0, glintSize, 0);
      ctx.quadraticCurveTo(0, 0, 0, glintSize);
      ctx.quadraticCurveTo(0, 0, -glintSize, 0);
      ctx.fill();

      ctx.restore();
    }

    // 8. Glow Halo if selected or hovered
    if (isGlow) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      ctx.stroke();
    }
  }

  triggerPickAnimation(color, isAdding = true) {
    if (this.isThree) {
      this.pulseStack(color);
      return;
    }
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const colors = ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx', 'gold'];
    const idx = colors.indexOf(color);
    if (idx === -1) return;

    const slotWidth = rect.width / colors.length;
    const cx = idx * slotWidth + slotWidth / 2;
    const baseCy = rect.height - 50;

    const countInBank = this.tokenCounts[color] || 0;
    const currentStackY = baseCy - Math.min(countInBank, 7) * 7.5;
    const floatY = currentStackY - 45;

    // Spawn Flying Chip
    this.flyingChips.push({
      color,
      meta: GEM_METADATA[color],
      startX: isAdding ? cx : cx,
      startY: isAdding ? currentStackY : floatY,
      targetX: isAdding ? cx : cx,
      targetY: isAdding ? floatY : currentStackY,
      progress: 0,
      duration: 280, // ms
      startTime: performance.now(),
      isAdding
    });

    // Spawn Sparkle Particles
    for (let p = 0; p < 12; p++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      this.sparkles.push({
        x: cx,
        y: currentStackY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.0,
        color: GEM_METADATA[color].colorHex,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.03,
        size: 3 + Math.random() * 3
      });
    }
  }

  updateAndRenderFlyingChips(timestamp, rx, ry, thickness) {
    const active = [];

    for (const chip of this.flyingChips) {
      const elapsed = timestamp - chip.startTime;
      chip.progress = Math.min(1.0, elapsed / chip.duration);

      // Ease-out Quad curve
      const t = chip.progress;
      const ease = t * (2 - t);

      const currX = chip.startX + (chip.targetX - chip.startX) * ease;
      // Parabolic arc trajectory
      const arc = Math.sin(ease * Math.PI) * (chip.isAdding ? -25 : 15);
      const currY = chip.startY + (chip.targetY - chip.startY) * ease + arc;

      const scale = 1.0 + Math.sin(ease * Math.PI) * 0.18;

      this.drawCeramicChip2D(
        currX,
        currY,
        rx * scale,
        ry * scale,
        thickness,
        chip.color,
        chip.meta,
        true,
        true
      );

      if (chip.progress < 1.0) {
        active.push(chip);
      }
    }

    this.flyingChips = active;
  }

  updateAndRenderSparkles() {
    const active = [];
    const ctx = this.ctx;

    for (const s of this.sparkles) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.12; // Gravity
      s.life -= s.decay;

      if (s.life > 0) {
        ctx.save();
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        active.push(s);
      }
    }

    this.sparkles = active;
  }

  // =========================================================================
  // THREE.JS 3D WEBGL RENDERING PATH
  // =========================================================================
  initThree() {
    const THREE = window.THREE;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 185;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(0, 5.5, 9.5);
    this.camera.lookAt(0, -0.4, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Warm Renaissance Candlelight & Specular Spotlights
    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7e6, 2.4);
    dirLight.position.set(4, 14, 8);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xd4af37, 2.2, 22);
    pointLight.position.set(-4, 6, 3);
    this.scene.add(pointLight);

    // Cool specular rim light for gem facet highlights
    const rimLight = new THREE.DirectionalLight(0xbae6fd, 1.5);
    rimLight.position.set(-6, -2, -4);
    this.scene.add(rimLight);

    const colors = ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx', 'gold'];
    const xOffsets = [-4.6, -2.75, -0.9, 0.9, 2.75, 4.6];

    this.stacks = {};
    this.chipMeshes = {};
    this.floatingCrystals = {};
    this.raycastMeshes = [];

    colors.forEach((color, idx) => {
      const stackGroup = new THREE.Group();
      stackGroup.position.set(xOffsets[idx], 0, 0);
      this.scene.add(stackGroup);

      // Hitbox for raycasting
      const hitGeo = new THREE.CylinderGeometry(1.0, 1.0, 4.2, 16);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.y = 1.2;
      hitMesh.userData = { color, idx };
      stackGroup.add(hitMesh);
      this.raycastMeshes.push(hitMesh);

      this.stacks[color] = stackGroup;
      this.chipMeshes[color] = [];

      this.buildChipMeshes(color);
    });

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.bindThreeEvents();
    this.animateThree();
  }

  buildChipMeshes(color) {
    const THREE = window.THREE;
    const meta = GEM_METADATA[color];
    const group = this.stacks[color];
    const chips = this.chipMeshes[color];

    while (chips.length > 0) {
      const c = chips.pop();
      group.remove(c);
    }

    if (this.floatingCrystals[color]) {
      group.remove(this.floatingCrystals[color]);
      delete this.floatingCrystals[color];
    }

    // REDUCE STACK IN 3D AS TOKENS ARE TAKEN
    const countInBank = this.tokenCounts[color] || 0;
    const stagedCount = this.selectedCounts[color] || 0;
    const visibleCount = Math.max(0, countInBank - stagedCount);

    const chipThickness = 0.22;
    const radius = 0.90;
    const coinSegments = (color === 'onyx') ? 6 : ((color === 'gold') ? 16 : 12);

    // Faceted coin rim material — colored per gem type
    const rimColorHex = color === 'gold'     ? 0xb45309 :
                        color === 'diamond'  ? 0x8baabb :
                        color === 'sapphire' ? 0x1a3a8a :
                        color === 'emerald'  ? 0x065f3c :
                        color === 'ruby'     ? 0x991b1b :
                        /* onyx */            0x1c1c20;
    const rimMat = new THREE.MeshStandardMaterial({
      color: rimColorHex,
      roughness: color === 'onyx' ? 0.3 : 0.25,
      metalness: color === 'gold' ? 0.85 : (color === 'diamond' ? 0.55 : 0.5),
      flatShading: true
    });

    // Crystalline gemstone material with flat shading for sparkling facets
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: meta.colorHex,
      emissive: color === 'onyx' ? 0x121214 : meta.colorHex,
      emissiveIntensity: color === 'onyx' ? 0.08 : 0.18,
      roughness: color === 'onyx' ? 0.08 : 0.08,
      metalness: color === 'gold' ? 0.8 : (color === 'onyx' ? 0.15 : 0.15),
      transmission: (color === 'diamond') ? 0.92 : ((color === 'onyx' || color === 'gold') ? 0.0 : 0.65),
      ior: 1.85,
      flatShading: true
    });

    for (let i = 0; i < visibleCount; i++) {
      const chipObj = new THREE.Group();
      chipObj.position.y = i * chipThickness + 0.1;

      // 1. Faceted outer coin body
      const outerGeo = new THREE.CylinderGeometry(radius, radius, chipThickness, coinSegments);
      const outerMesh = new THREE.Mesh(outerGeo, rimMat);
      outerMesh.castShadow = true;
      outerMesh.receiveShadow = true;
      chipObj.add(outerMesh);

      // 2. Faceted gem table inlay (raised crystal dome with flat facets)
      const gemGeo = new THREE.CylinderGeometry(radius * 0.68, radius * 0.76, chipThickness * 1.15, coinSegments);
      const gemMesh = new THREE.Mesh(gemGeo, gemMat);
      gemMesh.castShadow = true;
      chipObj.add(gemMesh);

      group.add(chipObj);
      chips.push(chipObj);
    }

    // 3. Floating Signature 3D Cut Gemstone Crystal above stack
    let crystalGeo;
    if (color === 'diamond') {
      // Octahedron brilliant diamond
      crystalGeo = new THREE.OctahedronGeometry(0.70, 0);
    } else if (color === 'ruby') {
      // Dodecahedron faceted ruby
      crystalGeo = new THREE.DodecahedronGeometry(0.66, 0);
    } else if (color === 'sapphire') {
      // Icosahedron faceted royal sapphire
      crystalGeo = new THREE.IcosahedronGeometry(0.66, 0);
    } else if (color === 'emerald') {
      // Step-cut 8-sided emerald crystal prism
      crystalGeo = new THREE.CylinderGeometry(0.60, 0.60, 0.82, 8);
    } else if (color === 'onyx') {
      // Hexagonal bipyramid / faceted black onyx obelisk
      crystalGeo = new THREE.CylinderGeometry(0.01, 0.66, 0.85, 6);
    } else {
      // Gold wild token: 16-sided beveled medallion
      crystalGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.32, 16);
    }

    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: meta.colorHex,
      emissive: color === 'onyx' ? 0x141418 : (meta.accentHex || meta.colorHex),
      emissiveIntensity: color === 'onyx' ? 0.10 : (stagedCount > 0 ? 0.45 : 0.22),
      roughness: color === 'onyx' ? 0.06 : (color === 'gold' ? 0.15 : 0.04),
      metalness: color === 'gold' ? 0.90 : (color === 'onyx' ? 0.22 : 0.18),
      transmission: (color === 'diamond') ? 0.95 : ((color === 'onyx' || color === 'gold') ? 0.0 : 0.70),
      ior: 2.1,
      flatShading: true
    });

    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    crystalMesh.castShadow = true;

    // Anchor crystal position above current stack height
    const baseY = Math.max(0.6, visibleCount * chipThickness + 0.95);
    crystalMesh.position.y = baseY;
    crystalMesh.userData = {
      baseY,
      color,
      isHovered: (this.hoveredColor === color),
      isStaged: (stagedCount > 0)
    };

    if (stagedCount > 0) {
      crystalMesh.scale.set(1.22, 1.22, 1.22);
    }

    group.add(crystalMesh);
    this.floatingCrystals[color] = crystalMesh;
  }

  bindThreeEvents() {
    const el = this.renderer.domElement;

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.raycastMeshes);

      if (intersects.length > 0) {
        const col = intersects[0].object.userData.color;
        if (this.hoveredColor !== col) {
          this.hoveredColor = col;
          el.style.cursor = col === 'gold' ? 'not-allowed' : 'pointer';
        }
      } else {
        if (this.hoveredColor !== null) {
          this.hoveredColor = null;
          el.style.cursor = 'default';
        }
      }
    });

    el.addEventListener('pointerleave', () => {
      this.hoveredColor = null;
      el.style.cursor = 'default';
    });

    el.addEventListener('pointerdown', (e) => {
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.raycastMeshes);

      if (intersects.length > 0) {
        const color = intersects[0].object.userData.color;
        if (this.onTokenClick && !this.disabledColors.includes(color)) {
          this.pulseStack(color);
          this.onTokenClick(color);
        }
      }
    });

    window.addEventListener('resize', () => {
      if (!this.renderer) return;
      const width = this.container.clientWidth || 800;
      const height = this.container.clientHeight || 185;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
  }

  pulseStack(color) {
    const stack = this.stacks[color];
    const crystal = this.floatingCrystals[color];
    if (!stack) return;
    let frame = 0;
    const lift = () => {
      frame++;
      const liftY = Math.sin((frame / 12) * Math.PI) * 0.35;
      stack.position.y = liftY;
      if (crystal) {
        crystal.scale.set(1.35, 1.35, 1.35);
      }
      if (frame < 12) {
        requestAnimationFrame(lift);
      } else {
        stack.position.y = 0;
      }
    };
    lift();
  }

  animateThree() {
    if (!this.renderer) return;
    requestAnimationFrame(() => this.animateThree());
    const time = performance.now() * 0.001;

    const colors = ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx', 'gold'];

    colors.forEach((color, idx) => {
      const isSelected = (this.selectedCounts[color] || 0) > 0;
      const isHovered = (this.hoveredColor === color);
      const stack = this.stacks[color];
      const crystal = this.floatingCrystals[color];

      if (stack) {
        if (isSelected) {
          stack.rotation.y = Math.sin(time * 3 + idx) * 0.15;
        } else {
          stack.rotation.y = 0;
        }
      }

      if (crystal) {
        // Continuous 3D faceted crystal rotation
        const spinSpeed = isSelected ? 2.5 : (isHovered ? 1.8 : 0.85);
        crystal.rotation.y = time * spinSpeed + idx;
        crystal.rotation.x = Math.sin(time * 1.6 + idx) * 0.22;
        crystal.rotation.z = Math.cos(time * 1.2 + idx) * 0.14;

        // Floating levitation bobbing
        const bob = Math.sin(time * 2.4 + idx) * 0.12;
        crystal.position.y = crystal.userData.baseY + bob;

        // Scale pulse if staged
        const targetScale = isSelected ? 1.25 + Math.sin(time * 4) * 0.06 : (isHovered ? 1.12 : 1.0);
        crystal.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  // =========================================================================
  // PUBLIC UPDATE API
  // =========================================================================
  update(tokenCounts, selectedCounts = {}, disabledColors = []) {
    // Detect changes in selected tokens to trigger flight pickup animations
    for (const color of ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx', 'gold']) {
      const prev = this.prevSelectedCounts[color] || 0;
      const curr = selectedCounts[color] || 0;
      if (curr > prev) {
        this.triggerPickAnimation(color, true);
      } else if (curr < prev) {
        this.triggerPickAnimation(color, false);
      }
    }

    this.prevSelectedCounts = { ...selectedCounts };
    this.tokenCounts = { ...tokenCounts };
    this.selectedCounts = { ...selectedCounts };
    this.disabledColors = [...disabledColors];

    if (this.isThree) {
      for (const color of ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx', 'gold']) {
        this.buildChipMeshes(color);
      }
    }
  }
}

/**
 * Splendor 3D Card Animation Visualizer via Three.js
 * Renders physically-based 3D development cards that lift off the table,
 * flip and rotate in full 3D perspective space, emit gem sparkle particles,
 * and fly gracefully to the player's dashboard gem holdings or reserved tray.
 */

import { GEM_METADATA, getCardArtPath } from './cards-data.js';

export class Card3DVisualizer {
  constructor() {
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.isThreeReady = false;
    this.animatingCards = [];
    this.activeSparkles = [];
    this.animFrameId = null;
    this.textureCache = new Map();

    this.init();
  }

  init() {
    // Create overlay canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'card-3d-overlay';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1200';
    document.body.appendChild(this.canvas);

    if (typeof window.THREE !== 'undefined') {
      this.initThree();
    } else {
      // Check if Three.js finishes loading shortly
      const checkInterval = setInterval(() => {
        if (typeof window.THREE !== 'undefined') {
          clearInterval(checkInterval);
          this.initThree();
        }
      }, 100);
      setTimeout(() => clearInterval(checkInterval), 6000);
    }

    window.addEventListener('resize', () => this.handleResize());
  }

  initThree() {
    if (this.isThreeReady || typeof window.THREE === 'undefined') return;
    const THREE = window.THREE;

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new THREE.Scene();

    // Perspective Camera setup mapped 1:1 to screen pixel coordinates at z=0
    const fov = 45;
    this.camera = new THREE.PerspectiveCamera(fov, w / h, 1, 4000);
    const cameraDist = (h / 2) / Math.tan((fov * Math.PI) / 360);
    this.camera.position.set(w / 2, h / 2, cameraDist);
    this.camera.lookAt(w / 2, h / 2, 0);

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true
      });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      // Lighting setup
      const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.8);
      this.scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
      dirLight.position.set(w / 2, h + 200, 400);
      this.scene.add(dirLight);

      const goldRim = new THREE.DirectionalLight(0xd4af37, 1.4);
      goldRim.position.set(w / 2 - 300, -200, 250);
      this.scene.add(goldRim);

      this.isThreeReady = true;
    } catch (e) {
      console.warn('Three.js WebGLRenderer init failed for cards, using DOM fallback:', e);
    }
  }

  handleResize() {
    if (!this.isThreeReady || !this.renderer || !this.camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const fov = 45;
    this.camera.aspect = w / h;
    const cameraDist = (h / 2) / Math.tan((fov * Math.PI) / 360);
    this.camera.position.set(w / 2, h / 2, cameraDist);
    this.camera.lookAt(w / 2, h / 2, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /**
   * Generates or retrieves a high-res front texture for a card
   */
  getCardFrontTexture(card) {
    if (!this.isThreeReady) return null;
    const THREE = window.THREE;
    const cacheKey = `card_front_${card.id}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 336;
    const ctx = canvas.getContext('2d');

    const meta = GEM_METADATA[card.gemBonus] || { colorHex: '#475569', name: 'Gem', symbol: '●' };

    // Card Base Gradient
    const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    baseGrad.addColorStop(0, '#1c182a');
    baseGrad.addColorStop(0.5, '#130f1e');
    baseGrad.addColorStop(1, '#0c0a14');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gem colored ornate header & border
    ctx.lineWidth = 6;
    ctx.strokeStyle = meta.borderHex || meta.colorHex || '#fbbf24';
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // Top Bar: Prestige points + Gem Bonus icon
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(10, 10, canvas.width - 20, 52);

    if (card.prestigePoints > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 36px "Cinzel", Georgia, serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(card.prestigePoints), 22, 36);
    }

    // Gem Bonus Pill
    ctx.fillStyle = meta.colorHex || '#fbbf24';
    ctx.beginPath();
    ctx.arc(canvas.width - 36, 36, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.symbol || '●', canvas.width - 36, 36);

    // Center Artwork Area
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(14, 68, canvas.width - 28, 170);

    // Tier indicator in center
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIER ${card.tier || 1}`, canvas.width / 2, 155);

    // Card Costs at bottom
    if (card.cost) {
      const costs = Object.entries(card.cost).filter(([_, n]) => n > 0);
      const startX = 20;
      let curX = startX;
      costs.forEach(([gem, n]) => {
        const gMeta = GEM_METADATA[gem] || { colorHex: '#475569', symbol: '●' };
        ctx.fillStyle = gMeta.colorHex || '#666';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(curX, canvas.height - 54, 38, 38, 6) : ctx.rect(curX, canvas.height - 54, 38, 38);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(n), curX + 19, canvas.height - 35);
        curX += 44;
      });
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    this.textureCache.set(cacheKey, texture);

    // Asynchronously draw the real artwork image onto canvas when loaded
    const artImg = new Image();
    artImg.crossOrigin = 'anonymous';
    artImg.onload = () => {
      ctx.drawImage(artImg, 14, 68, canvas.width - 28, 170);
      // Redraw inner border over artwork
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(14, 68, canvas.width - 28, 170);
      texture.needsUpdate = true;
    };
    artImg.src = getCardArtPath(card);

    return texture;
  }

  /**
   * Generates or retrieves a card back texture
   */
  getCardBackTexture(tier = 1) {
    if (!this.isThreeReady) return null;
    const THREE = window.THREE;
    const cacheKey = `card_back_t${tier}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 336;
    const ctx = canvas.getContext('2d');

    // Renaissance card back
    const bgGrad = ctx.createRadialGradient(120, 168, 20, 120, 168, 180);
    if (tier === 3) {
      bgGrad.addColorStop(0, '#2e1065');
      bgGrad.addColorStop(1, '#090514');
    } else if (tier === 2) {
      bgGrad.addColorStop(0, '#064e3b');
      bgGrad.addColorStop(1, '#021811');
    } else {
      bgGrad.addColorStop(0, '#1e3a8a');
      bgGrad.addColorStop(1, '#050c1e');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gilded Frame
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    // Center Gold Seal & Tier Dots
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('●'.repeat(tier), canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  /**
   * Generates or retrieves a high-res front texture for a Super Power card
   */
  getSuperPowerFrontTexture(powerDef) {
    if (!this.isThreeReady) return null;
    const THREE = window.THREE;
    const cacheKey = `power_front_${powerDef.id}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 336;
    const ctx = canvas.getContext('2d');

    const tierColor = powerDef.colorHex || '#fbbf24';

    // Arcane background gradient
    const bgGrad = ctx.createRadialGradient(120, 140, 20, 120, 168, 180);
    if (powerDef.tier === 'mythic') {
      bgGrad.addColorStop(0, '#581c87');
      bgGrad.addColorStop(0.5, '#2e1065');
      bgGrad.addColorStop(1, '#090314');
    } else if (powerDef.tier === 'rare') {
      bgGrad.addColorStop(0, '#3b0764');
      bgGrad.addColorStop(0.5, '#1e1035');
      bgGrad.addColorStop(1, '#07030d');
    } else {
      bgGrad.addColorStop(0, '#075985');
      bgGrad.addColorStop(0.5, '#0c2340');
      bgGrad.addColorStop(1, '#030a14');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer Gilded Arcane Frame
    ctx.strokeStyle = tierColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // Corner arcane embellishments
    ctx.fillStyle = '#fbbf24';
    [[8, 8], [canvas.width - 8, 8], [8, canvas.height - 8], [canvas.width - 8, canvas.height - 8]].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Top Header: Tier Badge & Type
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(12, 12, canvas.width - 24, 28);

    ctx.fillStyle = tierColor;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText((powerDef.tierName || powerDef.tier || 'POWER').toUpperCase(), 18, 26);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((powerDef.type || 'BOON').toUpperCase(), canvas.width - 18, 26);

    // Center Medallion Disc with Icon
    const centerX = canvas.width / 2;
    const centerY = 110;

    // Outer glowing ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, 46, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = tierColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 41, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon (Emoji)
    ctx.font = '46px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerDef.icon || '⚡', centerX, centerY + 2);

    // Power Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(powerDef.name || 'Super Power', centerX, 178);
    ctx.shadowBlur = 0;

    // Divider line
    ctx.strokeStyle = tierColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(35, 192);
    ctx.lineTo(canvas.width - 35, 192);
    ctx.stroke();

    // Short Description Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(16, 202, canvas.width - 32, 80);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 202, canvas.width - 32, 80);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const text = powerDef.shortDesc || powerDef.description || '';
    const words = text.split(' ');
    let line = '';
    let lineY = 210;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > canvas.width - 48 && n > 0) {
        ctx.fillText(line.trim(), centerX, lineY);
        line = words[n] + ' ';
        lineY += 16;
        if (lineY > 260) break;
      } else {
        line = testLine;
      }
    }
    if (line.trim() && lineY <= 265) {
      ctx.fillText(line.trim(), centerX, lineY);
    }

    // Feat tag at bottom
    ctx.fillStyle = '#fcd34d';
    ctx.font = 'italic 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦ Arcane Feat Accomplished ✦', centerX, 305);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  /**
   * Generates or retrieves a card back texture for Super Powers
   */
  getSuperPowerBackTexture() {
    if (!this.isThreeReady) return null;
    const THREE = window.THREE;
    const cacheKey = 'super_power_back';
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 336;
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createRadialGradient(120, 168, 20, 120, 168, 180);
    bgGrad.addColorStop(0, '#311042');
    bgGrad.addColorStop(0.6, '#15061e');
    bgGrad.addColorStop(1, '#05010a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fbbf24';
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = '40px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  /**
   * Continuous sparkling animation around the Super Power celebration dialog
   */
  startPowerDialogSparks(cardRect, tierColorHex = '#fbbf24') {
    this.stopPowerDialogSparks();
    if (!cardRect) return;

    this.isDialogSparksActive = true;
    this.dialogSparkColors = [tierColorHex, '#fbbf24', '#ffffff', '#e0e7ff', '#fef08a'];

    const spawnSparks = () => {
      if (!this.isDialogSparksActive) return;
      if (this.isThreeReady && this.activeSparkles.length < 80) {
        const THREE = window.THREE;
        const h = window.innerHeight;
        const cardX = cardRect.left + cardRect.width / 2;
        const cardY = h - (cardRect.top + cardRect.height / 2);

        for (let i = 0; i < 3; i++) {
          const color = this.dialogSparkColors[Math.floor(Math.random() * this.dialogSparkColors.length)];
          const angle = Math.random() * Math.PI * 2;
          const radius = (cardRect.width / 2) * (0.8 + Math.random() * 0.5);
          const px = cardX + Math.cos(angle) * radius;
          const py = cardY + Math.sin(angle) * radius;
          const pz = (Math.random() - 0.3) * 60;

          const geo = Math.random() > 0.5
            ? new THREE.OctahedronGeometry(Math.random() * 5 + 3, 0)
            : new THREE.TetrahedronGeometry(Math.random() * 5 + 3, 0);

          const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.95
          });

          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(px, py, pz);
          this.scene.add(mesh);

          const speed = Math.random() * 2.2 + 1.2;
          this.activeSparkles.push({
            mesh,
            vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 1.0,
            vy: Math.sin(angle) * speed + Math.random() * 0.8,
            vz: (Math.random() - 0.5) * 2.0,
            scale: 1,
            startTime: performance.now(),
            lifespan: Math.random() * 500 + 650
          });
        }
        this.startLoop();
      }
    };

    spawnSparks();
    spawnSparks();
    this.dialogSparkInterval = setInterval(spawnSparks, 75);
  }

  stopPowerDialogSparks() {
    this.isDialogSparksActive = false;
    if (this.dialogSparkInterval) {
      clearInterval(this.dialogSparkInterval);
      this.dialogSparkInterval = null;
    }
  }

  /**
   * Fly a Super Power Card in full 3D from celebration dialog to user dashboard
   */
  flySuperPowerCard({ powerDef, fromEl, toEl, onComplete = null, duration = 1250 }) {
    if (!powerDef || !toEl) {
      onComplete?.();
      return;
    }

    const fromRect = fromEl ? fromEl.getBoundingClientRect() : null;
    const toRect = toEl.getBoundingClientRect();

    if (!toRect || toRect.width === 0) {
      onComplete?.();
      return;
    }

    if (!this.isThreeReady) {
      this.flyPowerCardDOM({ powerDef, fromRect, toRect, onComplete, duration });
      return;
    }

    const THREE = window.THREE;
    const h = window.innerHeight;

    const cardWidth = fromRect ? Math.max(90, Math.min(160, fromRect.width)) : 140;
    const cardHeight = fromRect ? Math.max(120, Math.min(220, fromRect.height)) : 196;

    const startX = fromRect ? (fromRect.left + fromRect.width / 2) : (window.innerWidth / 2);
    const startY = fromRect ? (h - (fromRect.top + fromRect.height / 2)) : (h / 2);

    const endX = toRect.left + toRect.width / 2;
    const endY = h - (toRect.top + toRect.height / 2);

    const cardGeo = new THREE.BoxGeometry(cardWidth, cardHeight, 3.8);

    const frontTex = this.getSuperPowerFrontTexture(powerDef);
    const backTex = this.getSuperPowerBackTexture();

    const edgeMat = new THREE.MeshStandardMaterial({
      color: powerDef.colorHex ? new THREE.Color(powerDef.colorHex) : 0xd4af37,
      metalness: 0.9,
      roughness: 0.2
    });

    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      metalness: 0.25,
      roughness: 0.35
    });

    const backMat = new THREE.MeshStandardMaterial({
      map: backTex,
      metalness: 0.35,
      roughness: 0.45
    });

    const materials = [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat];
    const cardMesh = new THREE.Mesh(cardGeo, materials);
    cardMesh.position.set(startX, startY, 40);

    const cardLight = new THREE.PointLight(powerDef.colorHex || 0xfbbf24, 2.8, 350);
    cardLight.position.set(0, 0, 30);
    cardMesh.add(cardLight);

    this.scene.add(cardMesh);

    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.hypot(dx, dy) || 1;
    const arcHeight = Math.min(220, Math.max(80, dist * 0.3));

    const midX = (startX + endX) / 2 + (dx > 0 ? -40 : 40);
    const midY = (startY + endY) / 2 + arcHeight;

    const startTime = performance.now();

    const animItem = {
      mesh: cardMesh,
      startX, startY,
      midX, midY,
      endX, endY,
      startTime,
      duration,
      gemColor: powerDef.colorHex || '#fbbf24',
      toEl,
      isPower: true,
      onComplete
    };

    this.animatingCards.push(animItem);
    this.startLoop();
  }

  flyPowerCardDOM({ powerDef, fromRect, toRect, onComplete, duration = 1250 }) {
    const chip = document.createElement('div');
    chip.className = `power-card revealed tier-${powerDef.tier || 'common'} flying-token-dom`;
    chip.style.position = 'fixed';
    chip.style.width = '120px';
    chip.style.height = '165px';
    chip.style.zIndex = '1100';
    chip.style.boxShadow = `0 16px 40px rgba(0,0,0,0.85), 0 0 30px ${powerDef.colorHex || '#fbbf24'}`;
    chip.style.transform = 'perspective(900px) rotateY(0deg) scale(1.1)';
    chip.style.transition = `all ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;

    chip.innerHTML = `
      <div style="font-size:36px; text-align:center; margin-top:20px;">${powerDef.icon || '⚡'}</div>
      <div style="font-size:13px; font-weight:bold; color:#fff; text-align:center; margin-top:10px;">${powerDef.name || 'Power'}</div>
    `;

    const startX = fromRect ? fromRect.left : window.innerWidth / 2 - 60;
    const startY = fromRect ? fromRect.top : window.innerHeight / 2 - 80;
    const endX = toRect ? (toRect.left + (toRect.width / 2) - 60) : window.innerWidth / 2;
    const endY = toRect ? (toRect.top + (toRect.height / 2) - 80) : window.innerHeight - 100;

    chip.style.left = `${startX}px`;
    chip.style.top = `${startY}px`;

    document.body.appendChild(chip);

    requestAnimationFrame(() => {
      chip.style.left = `${endX}px`;
      chip.style.top = `${endY}px`;
      chip.style.transform = 'perspective(900px) rotateY(360deg) scale(0.65)';
    });

    setTimeout(() => {
      chip.remove();
      if (toRect && toEl && toEl.classList) {
        toEl.classList.add('pulse-pill');
        setTimeout(() => toEl.classList.remove('pulse-pill'), 400);
      }
      onComplete?.();
    }, duration);
  }

  /**
   * Main API: Fly a card in full 3D from origin DOM element to destination DOM element.
   */
  flyCard({ card, fromEl, toEl, isReserve = false, fromDeck = false, onComplete = null, duration = 1150 }) {
    if (!card || !toEl) {
      onComplete?.();
      return;
    }

    const fromRect = fromEl ? fromEl.getBoundingClientRect() : null;
    const toRect = toEl.getBoundingClientRect();

    if (!toRect || toRect.width === 0) {
      onComplete?.();
      return;
    }

    if (!this.isThreeReady) {
      // Graceful DOM fallback
      this.flyCardDOM({ card, fromRect, toRect, isReserve, fromDeck, onComplete, duration });
      return;
    }

    const THREE = window.THREE;
    const h = window.innerHeight;

    // Calculate screen-space coordinates (Three.js Y is inverted relative to DOM clientY)
    const cardWidth = fromRect ? Math.max(70, Math.min(130, fromRect.width)) : 100;
    const cardHeight = fromRect ? Math.max(90, Math.min(170, fromRect.height)) : 140;

    const startX = fromRect ? (fromRect.left + fromRect.width / 2) : (window.innerWidth / 2);
    const startY = fromRect ? (h - (fromRect.top + fromRect.height / 2)) : (h / 2);

    const endX = toRect.left + toRect.width / 2;
    const endY = h - (toRect.top + toRect.height / 2);

    // Create 3D Card Box Mesh
    const cardGeo = new THREE.BoxGeometry(cardWidth, cardHeight, 3.2);

    const frontTex = this.getCardFrontTexture(card);
    const backTex = this.getCardBackTexture(card.tier || 1);

    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.25
    });

    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      metalness: 0.2,
      roughness: 0.4
    });

    const backMat = new THREE.MeshStandardMaterial({
      map: backTex,
      metalness: 0.3,
      roughness: 0.5
    });

    // Mesh face order in Three.js BoxGeometry: [right, left, top, bottom, front (+Z), back (-Z)]
    const materials = [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat];
    const cardMesh = new THREE.Mesh(cardGeo, materials);
    cardMesh.position.set(startX, startY, 0);

    // Initial rotation: if fromDeck, starts showing back (180 deg on Y)
    if (fromDeck) {
      cardMesh.rotation.y = Math.PI;
    } else {
      cardMesh.rotation.y = 0;
    }

    // Dynamic point light that travels with the card
    const meta = GEM_METADATA[card.gemBonus] || { colorHex: '#fbbf24' };
    const cardLight = new THREE.PointLight(meta.colorHex || 0xfbbf24, 2.2, 280);
    cardLight.position.set(0, 0, 20);
    cardMesh.add(cardLight);

    this.scene.add(cardMesh);

    // Midpoint for parabolic 3D arc flight
    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.hypot(dx, dy) || 1;
    const arcHeight = Math.min(180, Math.max(60, dist * 0.25));

    const midX = (startX + endX) / 2 + (dx > 0 ? -30 : 30);
    const midY = (startY + endY) / 2 + arcHeight;

    const startTime = performance.now();

    const animItem = {
      mesh: cardMesh,
      startX, startY,
      midX, midY,
      endX, endY,
      fromDeck,
      startTime,
      duration,
      gemColor: meta.colorHex || '#fbbf24',
      toEl,
      onComplete
    };

    this.animatingCards.push(animItem);
    this.startLoop();
  }

  /**
   * Slide a replacement card from Tier Deck to Table Slot in 3D
   */
  flyDeckToSlot({ tier, slotEl, card, onComplete = null }) {
    if (!slotEl) {
      onComplete?.();
      return;
    }
    const deckEl = document.querySelector(`.deck-pile.tier-${tier}`);
    this.flyCard({
      card: card || { id: `refill_t${tier}`, tier, gemBonus: 'gold', prestigePoints: 0 },
      fromEl: deckEl,
      toEl: slotEl,
      fromDeck: true,
      duration: 950,
      onComplete
    });
  }

  startLoop() {
    if (this.animFrameId) return;
    const loop = (now) => {
      this.renderFrame(now);
      if (this.animatingCards.length > 0 || this.activeSparkles.length > 0) {
        this.animFrameId = requestAnimationFrame(loop);
      } else {
        this.animFrameId = null;
        if (this.renderer && this.scene && this.camera) {
          this.renderer.clear();
        }
      }
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  renderFrame(now) {
    if (!this.isThreeReady || !this.renderer || !this.scene || !this.camera) return;

    // Update active flying cards
    for (let i = this.animatingCards.length - 1; i >= 0; i--) {
      const item = this.animatingCards[i];
      const elapsed = now - item.startTime;
      const progress = Math.min(1, Math.max(0, elapsed / item.duration));

      // Ease in-out cubic
      const t = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Quadratic Bezier in screen space
      const oneMinusT = 1 - t;
      const curX = oneMinusT * oneMinusT * item.startX + 2 * oneMinusT * t * item.midX + t * t * item.endX;
      const curY = oneMinusT * oneMinusT * item.startY + 2 * oneMinusT * t * item.midY + t * t * item.endY;

      // Lift card in Z towards camera (peaks at midpoint)
      const liftZ = Math.sin(progress * Math.PI) * 220;

      item.mesh.position.set(curX, curY, liftZ);

      // 3D Rotations
      if (item.fromDeck) {
        // Flips from back (PI) to front (0)
        item.mesh.rotation.y = Math.PI * (1 - t);
      } else {
        // Full graceful spin on Y
        item.mesh.rotation.y = t * Math.PI * 2;
      }

      // Bank into curve & tilt slightly
      const bankAngle = (item.endX < item.startX ? 0.3 : -0.3) * Math.sin(progress * Math.PI);
      item.mesh.rotation.z = bankAngle;
      item.mesh.rotation.x = Math.sin(progress * Math.PI) * 0.2;

      // Scale and sparkles for power cards vs normal cards
      if (item.isPower) {
        const scale = 1.0 - t * 0.45;
        item.mesh.scale.set(scale, scale, scale);
        if (Math.random() < 0.8) {
          this.spawn3DSparkle(curX, curY, liftZ + 12, item.gemColor);
        }
      } else {
        // Spawn 3D sparkle particle along flight path
        if (Math.random() < 0.6) {
          this.spawn3DSparkle(curX, curY, liftZ + 10, item.gemColor);
        }
      }

      // Landing complete
      if (progress >= 1) {
        this.scene.remove(item.mesh);
        if (item.mesh.geometry) item.mesh.geometry.dispose();

        // Target pulse feedback
        if (item.toEl && item.toEl.classList) {
          item.toEl.classList.add('pulse-pill');
          setTimeout(() => item.toEl.classList.remove('pulse-pill'), 400);
        }

        item.onComplete?.();
        this.animatingCards.splice(i, 1);
      }
    }

    // Update active sparkles
    for (let s = this.activeSparkles.length - 1; s >= 0; s--) {
      const sp = this.activeSparkles[s];
      const spElapsed = now - sp.startTime;
      const spProgress = spElapsed / sp.lifespan;

      if (spProgress >= 1) {
        this.scene.remove(sp.mesh);
        if (sp.mesh.geometry) sp.mesh.geometry.dispose();
        if (sp.mesh.material) sp.mesh.material.dispose();
        this.activeSparkles.splice(s, 1);
      } else {
        sp.mesh.position.x += sp.vx;
        sp.mesh.position.y += sp.vy;
        sp.mesh.position.z += sp.vz;
        sp.mesh.scale.setScalar(Math.max(0.01, (1 - spProgress) * sp.scale));
        sp.mesh.material.opacity = (1 - spProgress) * 0.9;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  spawn3DSparkle(x, y, z, colorHex) {
    if (!this.isThreeReady || this.activeSparkles.length > 40) return;
    const THREE = window.THREE;

    const geo = new THREE.OctahedronGeometry(Math.random() * 4 + 3, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.9
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 30,
      y + (Math.random() - 0.5) * 30,
      z + (Math.random() - 0.5) * 20
    );

    this.scene.add(mesh);
    this.activeSparkles.push({
      mesh,
      vx: (Math.random() - 0.5) * 2.5,
      vy: (Math.random() - 0.5) * 2.5 - 0.5,
      vz: (Math.random() - 0.5) * 2.0,
      scale: 1,
      startTime: performance.now(),
      lifespan: Math.random() * 400 + 550
    });
  }

  /**
   * CSS/DOM 3D Fallback when WebGL is unavailable
   */
  flyCardDOM({ card, fromRect, toRect, isReserve, fromDeck, onComplete, duration = 1150 }) {
    const chip = document.createElement('div');
    chip.className = `reserved-mini-card card-gem-${card.gemBonus || 'gold'} flying-token-dom`;
    chip.style.position = 'fixed';
    chip.style.width = '90px';
    chip.style.height = '125px';
    chip.style.zIndex = '999';
    chip.style.boxShadow = '0 12px 30px rgba(0,0,0,0.8), 0 0 20px rgba(212,175,55,0.6)';
    chip.style.transform = 'perspective(800px) rotateY(0deg) scale(1)';
    chip.style.transition = `all ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;

    const startX = fromRect ? fromRect.left : window.innerWidth / 2;
    const startY = fromRect ? fromRect.top : window.innerHeight / 2;
    const endX = toRect.left;
    const endY = toRect.top;

    chip.style.left = `${startX}px`;
    chip.style.top = `${startY}px`;

    document.body.appendChild(chip);

    requestAnimationFrame(() => {
      chip.style.left = `${endX}px`;
      chip.style.top = `${endY}px`;
      chip.style.transform = 'perspective(800px) rotateY(360deg) scale(0.9)';
    });

    setTimeout(() => {
      chip.remove();
      if (toEl && toEl.classList) {
        toEl.classList.add('pulse-pill');
        setTimeout(() => toEl.classList.remove('pulse-pill'), 400);
      }
      onComplete?.();
    }, duration);
  }
}


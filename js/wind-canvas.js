/**
 * Windy Style Wind Particle Streamline Engine
 * High-performance full-viewport Canvas 2D rendering particle streamlines
 * supporting map panning, zooming, and layer velocity fields.
 */

class WindyParticleEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`找不到 Canvas: #${canvasId}`);
      return;
    }
    this.ctx = this.canvas.getContext('2d');

    // 地圖變換狀態 (平移與縮放)
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;

    // 全域風場風向與風速
    this.globalDeg = 55;      // 東北風
    this.globalSpeed = 4.2;   // 預設風速 (m/s)
    this.targetDeg = 55;
    this.targetSpeed = 4.2;

    this.particles = [];
    this.numParticles = 550;
    this.isRunning = true;
    this.particlesEnabled = true;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.initSize();
    this.initParticles();
    this.bindEvents();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initSize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    const area = this.width * this.height;
    this.numParticles = Math.min(800, Math.max(300, Math.floor(area / 2400)));
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  createParticle(randomAge = false) {
    const life = Math.floor(Math.random() * 80) + 40;
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      prevX: null,
      prevY: null,
      age: randomAge ? Math.floor(Math.random() * life) : 0,
      maxLife: life,
      speedFactor: 0.85 + Math.random() * 0.4,
      width: Math.random() < 0.2 ? 1.8 : 1.1
    };
  }

  setWind(deg, speed) {
    this.targetDeg = deg;
    this.targetSpeed = Math.max(speed, 0.8);
  }

  setTransform(panX, panY, zoom) {
    this.panX = panX;
    this.panY = panY;
    this.zoom = zoom;
  }

  setParticlesEnabled(enabled) {
    this.particlesEnabled = enabled;
    if (!enabled) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  bindEvents() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.initSize();
        this.initParticles();
      }, 150);
    });
  }

  interpolateAngle(curr, target, factor) {
    let diff = (target - curr) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return curr + diff * factor;
  }

  animate() {
    if (!this.isRunning) return;

    if (!this.particlesEnabled) {
      this.ctx.clearRect(0, 0, this.width, this.height);
      requestAnimationFrame(this.animate);
      return;
    }

    // 平滑插值風向與速度
    this.globalDeg = this.interpolateAngle(this.globalDeg, this.targetDeg, 0.05);
    this.globalSpeed += (this.targetSpeed - this.globalSpeed) * 0.05;

    // 半透明背景重繪營造 Windy 經典白流線殘影
    this.ctx.fillStyle = 'rgba(10, 18, 35, 0.22)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.lineCap = 'round';

    // 氣象前進方位向量
    const baseRad = (this.globalDeg + 90) * (Math.PI / 180);
    const baseSpeed = this.globalSpeed * 1.35 * Math.sqrt(this.zoom);

    // 模擬氣旋旋渦中心 (模擬琉球/日本南方海域氣旋，如截圖所示)
    const cycloneX = this.width * 0.75 + this.panX * 0.5;
    const cycloneY = this.height * 0.25 + this.panY * 0.5;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.prevX === null) {
        p.prevX = p.x;
        p.prevY = p.y;
      }

      // 計算與氣旋中心的距離與切向引力
      const dx = p.x - cycloneX;
      const dy = p.y - cycloneY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let vx = Math.cos(baseRad) * baseSpeed;
      let vy = Math.sin(baseRad) * baseSpeed;

      // 如果靠近氣旋中心，疊加逆時針旋轉氣流 (Northern Hemisphere Cyclone)
      if (dist < 450) {
        const swirlStrength = (1 - dist / 450) * 1.8;
        const angle = Math.atan2(dy, dx) - Math.PI / 2; // 逆時針切線
        vx = vx * (1 - swirlStrength * 0.5) + Math.cos(angle) * (baseSpeed * 2.2) * swirlStrength;
        vy = vy * (1 - swirlStrength * 0.5) + Math.sin(angle) * (baseSpeed * 2.2) * swirlStrength;
      }

      // 微氣流擾動
      const turbulence = Math.sin(p.age * 0.08) * 0.6;
      p.x += (vx + turbulence) * p.speedFactor;
      p.y += (vy - turbulence) * p.speedFactor;

      // 透明度漸層
      const lifeRatio = p.age / p.maxLife;
      let alpha = 1.0;
      if (lifeRatio < 0.2) {
        alpha = lifeRatio / 0.2;
      } else if (lifeRatio > 0.75) {
        alpha = (1 - lifeRatio) / 0.25;
      }
      alpha = Math.max(0, Math.min(0.9, alpha * 0.85));

      // 繪製白色氣流線
      this.ctx.beginPath();
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.globalAlpha = alpha;
      this.ctx.lineWidth = p.width;
      this.ctx.moveTo(p.prevX, p.prevY);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();

      p.prevX = p.x;
      p.prevY = p.y;
      p.age++;

      if (p.age >= p.maxLife || p.x < -40 || p.x > this.width + 40 || p.y < -40 || p.y > this.height + 40) {
        this.resetParticle(p);
      }
    }

    this.ctx.globalAlpha = 1.0;
    requestAnimationFrame(this.animate);
  }

  resetParticle(p) {
    p.age = 0;
    p.prevX = null;
    p.prevY = null;
    p.speedFactor = 0.85 + Math.random() * 0.4;
    p.x = Math.random() * this.width;
    p.y = Math.random() * this.height;
  }
}

window.WindyParticleEngine = WindyParticleEngine;

/**
 * Windy Style Wind Particle Streamline Engine
 * Renders smooth flowing airflow streamlines over the 70% map viewport.
 * Dynamically reacts to real-time wind speed, wind angle, zoom, and layer selection.
 */

class WindyParticleEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`找不到 Canvas: #${canvasId}`);
      return;
    }
    this.ctx = this.canvas.getContext('2d');

    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;

    // 即時風向與風速
    this.targetDeg = 65;      // 預設東北風
    this.currentDeg = 65;
    this.targetSpeed = 3.5;   // 預設風速 (m/s)
    this.currentSpeed = 3.5;

    this.particles = [];
    this.numParticles = 380;
    this.isRunning = true;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.initSize();
    this.initParticles();
    this.bindEvents();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initSize() {
    const parent = this.canvas.parentElement;
    this.width = parent ? parent.clientWidth : window.innerWidth;
    this.height = parent ? parent.clientHeight : window.innerHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    const area = this.width * this.height;
    this.numParticles = Math.min(600, Math.max(220, Math.floor(area / 2200)));
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  createParticle(randomAge = false) {
    const life = Math.floor(Math.random() * 75) + 45;
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      prevX: null,
      prevY: null,
      age: randomAge ? Math.floor(Math.random() * life) : 0,
      maxLife: life,
      speedFactor: 0.85 + Math.random() * 0.45,
      width: Math.random() < 0.25 ? 1.8 : 1.1
    };
  }

  setWind(deg, speed) {
    this.targetDeg = deg;
    this.targetSpeed = Math.max(speed, 0.6);
  }

  setTransform(panX, panY, zoom) {
    this.panX = panX;
    this.panY = panY;
    this.zoom = zoom;
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

    this.currentDeg = this.interpolateAngle(this.currentDeg, this.targetDeg, 0.05);
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.05;

    // 半透明背景淡出以產生流暢尾跡 (Windy 流線殘影，同時保持底層 Leaflet 地圖清晰可見)
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.globalCompositeOperation = 'source-over';

    this.ctx.lineCap = 'round';

    const moveAngleRad = (this.currentDeg + 90) * (Math.PI / 180);
    const vx = Math.cos(moveAngleRad) * this.currentSpeed * 1.35 * Math.sqrt(this.zoom);
    const vy = Math.sin(moveAngleRad) * this.currentSpeed * 1.35 * Math.sqrt(this.zoom);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.prevX === null) {
        p.prevX = p.x;
        p.prevY = p.y;
      }

      const turbulence = Math.sin(p.age * 0.08) * 0.55;
      p.x += (vx + turbulence) * p.speedFactor;
      p.y += (vy - turbulence) * p.speedFactor;

      const lifeRatio = p.age / p.maxLife;
      let alpha = 1.0;
      if (lifeRatio < 0.2) {
        alpha = lifeRatio / 0.2;
      } else if (lifeRatio > 0.8) {
        alpha = (1 - lifeRatio) / 0.2;
      }
      alpha = Math.max(0, Math.min(0.95, alpha * 0.9));

      // 繪製白色氣流流線 (Windy 經典風條)
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

      if (p.age >= p.maxLife || p.x < -30 || p.x > this.width + 30 || p.y < -30 || p.y > this.height + 30) {
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
    p.speedFactor = 0.85 + Math.random() * 0.45;
    p.x = Math.random() * this.width;
    p.y = Math.random() * this.height;
  }
}

window.WindyParticleEngine = WindyParticleEngine;

/**
 * Google Maps / Earth Style Wind Flow Particle Simulation Engine
 * Lightweight, translucent streamline particles flowing across the map.
 * Dynamic angle interpolation and real-time velocity adaptation.
 */

class WindCanvasEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`找不到 Canvas 元素: #${canvasId}`);
      return;
    }
    this.ctx = this.canvas.getContext('2d');

    this.targetDeg = 45;
    this.currentDeg = 45;
    this.targetSpeed = 3.2;
    this.currentSpeed = 3.2;

    this.numParticles = 200;
    this.particles = [];
    this.isRunning = true;
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
    this.numParticles = Math.min(280, Math.max(100, Math.floor(area / 5000)));
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  createParticle(randomAge = false) {
    const life = Math.floor(Math.random() * 100) + 60;
    // Google Maps 風格氣流粒子：清澈白、柔和藍、微帶翠綠
    const palette = [
      'rgba(255, 255, 255, 0.65)',  // 明亮氣流白
      'rgba(66, 133, 244, 0.40)',   // Google 藍
      'rgba(24, 150, 90, 0.35)',    // 自然綠
      'rgba(180, 220, 255, 0.50)'   // 水域淺藍
    ];
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      prevX: null,
      prevY: null,
      age: randomAge ? Math.floor(Math.random() * life) : 0,
      maxLife: life,
      speedFactor: 0.8 + Math.random() * 0.5,
      width: Math.random() < 0.3 ? 1.8 : 1.1,
      color: palette[Math.floor(Math.random() * palette.length)]
    };
  }

  setWind(deg, speed) {
    this.targetDeg = deg;
    this.targetSpeed = Math.max(speed, 0.5);
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

    const moveAngleRad = (this.currentDeg + 90) * (Math.PI / 180);
    const vx = Math.cos(moveAngleRad) * this.currentSpeed * 1.25;
    const vy = Math.sin(moveAngleRad) * this.currentSpeed * 1.25;

    // 清透半透明重繪，保留柔和流線殘影
    this.ctx.fillStyle = 'rgba(170, 218, 255, 0.18)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.lineCap = 'round';

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.prevX === null) {
        p.prevX = p.x;
        p.prevY = p.y;
      }

      const turbulence = Math.sin(p.age * 0.07) * 0.5;
      p.x += (vx + turbulence) * p.speedFactor;
      p.y += (vy - turbulence) * p.speedFactor;

      const lifeRatio = p.age / p.maxLife;
      let alpha = 1;
      if (lifeRatio < 0.2) {
        alpha = lifeRatio / 0.2;
      } else if (lifeRatio > 0.8) {
        alpha = (1 - lifeRatio) / 0.2;
      }
      alpha = Math.max(0, Math.min(1, alpha * 0.85));

      this.ctx.beginPath();
      this.ctx.strokeStyle = p.color;
      this.ctx.globalAlpha = alpha;
      this.ctx.lineWidth = p.width;
      this.ctx.moveTo(p.prevX, p.prevY);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();

      p.prevX = p.x;
      p.prevY = p.y;
      p.age++;

      if (p.age >= p.maxLife || p.x < -30 || p.x > this.width + 30 || p.y < -30 || p.y > this.height + 30) {
        this.resetParticle(p, vx, vy);
      }
    }

    this.ctx.globalAlpha = 1.0;
    requestAnimationFrame(this.animate);
  }

  resetParticle(p, vx, vy) {
    p.age = 0;
    p.prevX = null;
    p.prevY = null;
    p.speedFactor = 0.8 + Math.random() * 0.5;

    const margin = 20;
    if (Math.abs(vx) > Math.abs(vy)) {
      p.x = vx > 0 ? -margin : this.width + margin;
      p.y = Math.random() * this.height;
    } else {
      p.x = Math.random() * this.width;
      p.y = vy > 0 ? -margin : this.height + margin;
    }

    if (Math.random() < 0.2) {
      p.x = Math.random() * this.width;
      p.y = Math.random() * this.height;
    }
  }
}

window.WindCanvasEngine = WindCanvasEngine;

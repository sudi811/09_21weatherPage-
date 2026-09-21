/**
 * MUJI Style Wind Canvas Particle Simulation Engine
 * Soft, organic airflow particles resembling brush strokes on unbleached paper.
 * Smoothly interpolates wind direction and velocity in response to live data.
 */

class WindCanvasEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`找不到 Canvas 元素: #${canvasId}`);
      return;
    }
    this.ctx = this.canvas.getContext('2d');

    // 當前風向與風速（目標值與渲染平滑內插值）
    this.targetDeg = 45;      // 目標風向角 (0-360)
    this.currentDeg = 45;     // 當前渲染角度
    this.targetSpeed = 3.2;   // 目標風速 (m/s)
    this.currentSpeed = 3.2;  // 當前渲染風速

    // 粒子系統參數
    this.numParticles = 180;
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
    this.numParticles = Math.min(260, Math.max(90, Math.floor(area / 5500)));
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  createParticle(randomAge = false) {
    const life = Math.floor(Math.random() * 110) + 70;
    // MUJI 色系：若隱若現的水墨灰、青灰與極少數沉紅微粒
    const palette = [
      'rgba(80, 85, 95, 0.22)',   // 淡墨灰
      'rgba(120, 125, 135, 0.18)', // 煙嵐灰
      'rgba(90, 110, 100, 0.20)',  // 淡竹青
      'rgba(140, 38, 38, 0.16)'    // 無印紅微粒
    ];
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      prevX: null,
      prevY: null,
      age: randomAge ? Math.floor(Math.random() * life) : 0,
      maxLife: life,
      speedFactor: 0.75 + Math.random() * 0.5,
      width: Math.random() < 0.25 ? 1.6 : 1.0,
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

    // 平滑漸變風向與風速
    this.currentDeg = this.interpolateAngle(this.currentDeg, this.targetDeg, 0.04);
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.04;

    // 氣象前進方向（北風由北吹向南）
    const moveAngleRad = (this.currentDeg + 90) * (Math.PI / 180);
    const vx = Math.cos(moveAngleRad) * this.currentSpeed * 1.15;
    const vy = Math.sin(moveAngleRad) * this.currentSpeed * 1.15;

    // 溫和淺色背景淡出（和紙質感）
    this.ctx.fillStyle = 'rgba(247, 245, 240, 0.22)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.lineCap = 'round';

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.prevX === null) {
        p.prevX = p.x;
        p.prevY = p.y;
      }

      // 自然和緩擾動
      const turbulence = Math.sin(p.age * 0.06) * 0.45;
      p.x += (vx + turbulence) * p.speedFactor;
      p.y += (vy - turbulence) * p.speedFactor;

      const lifeRatio = p.age / p.maxLife;
      let alpha = 1;
      if (lifeRatio < 0.25) {
        alpha = lifeRatio / 0.25;
      } else if (lifeRatio > 0.75) {
        alpha = (1 - lifeRatio) / 0.25;
      }
      alpha = Math.max(0, Math.min(1, alpha * 0.75));

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
    p.speedFactor = 0.75 + Math.random() * 0.5;

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

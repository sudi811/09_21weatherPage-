/**
 * Wind Canvas Particle Simulation Engine
 * High-performance 2D Canvas rendering glowing airflow particles
 * with physical damping, smooth angle interpolation, and live speed control.
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
    this.targetSpeed = 3.5;   // 目標風速 (m/s)
    this.currentSpeed = 3.5;  // 當前渲染風速

    // 粒子系統參數
    this.numParticles = 220;
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

    // 依螢幕尺寸彈性調節粒子數量
    const area = this.width * this.height;
    this.numParticles = Math.min(350, Math.max(120, Math.floor(area / 4500)));
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  createParticle(randomAge = false) {
    const life = Math.floor(Math.random() * 90) + 60;
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      prevX: null,
      prevY: null,
      age: randomAge ? Math.floor(Math.random() * life) : 0,
      maxLife: life,
      speedFactor: 0.8 + Math.random() * 0.5,
      width: Math.random() < 0.2 ? 2.0 : 1.2,
      color: Math.random() < 0.25 ? '#38bdf8' : (Math.random() < 0.5 ? '#22d3ee' : '#67e8f9')
    };
  }

  setWind(deg, speed) {
    this.targetDeg = deg;
    this.targetSpeed = Math.max(speed, 0.4); // 即使無風也保留極輕微微動以維持美感
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

  /**
   * 角度最短路徑平滑插值 (Shortest path lerp for degrees)
   */
  interpolateAngle(curr, target, factor) {
    let diff = (target - curr) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return curr + diff * factor;
  }

  animate() {
    if (!this.isRunning) return;

    // 平滑漸變風向與風速
    this.currentDeg = this.interpolateAngle(this.currentDeg, this.targetDeg, 0.05);
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.05;

    // 氣流前進方向（氣象定義：北風從北方來，流向南方）
    // Canvas: +X 為向右, +Y 為向下
    const moveAngleRad = (this.currentDeg + 90) * (Math.PI / 180);
    const vx = Math.cos(moveAngleRad) * this.currentSpeed * 1.35;
    const vy = Math.sin(moveAngleRad) * this.currentSpeed * 1.35;

    // 半透明背景重繪以營造流動殘影 (Wind Streak Fade)
    this.ctx.fillStyle = 'rgba(7, 11, 22, 0.16)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.lineCap = 'round';

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.prevX === null) {
        p.prevX = p.x;
        p.prevY = p.y;
      }

      // 微幅隨機擾動營造真實空氣亂流
      const turbulence = (Math.sin(p.age * 0.08) * 0.6);
      p.x += (vx + turbulence) * p.speedFactor;
      p.y += (vy - turbulence) * p.speedFactor;

      // 粒子淡入淡出透明度
      const lifeRatio = p.age / p.maxLife;
      let alpha = 1;
      if (lifeRatio < 0.2) {
        alpha = lifeRatio / 0.2;
      } else if (lifeRatio > 0.8) {
        alpha = (1 - lifeRatio) / 0.2;
      }
      alpha = Math.max(0, Math.min(1, alpha * 0.85));

      // 繪製風場流線
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

      // 邊界穿透或壽命結束重置
      if (p.age >= p.maxLife || p.x < -40 || p.x > this.width + 40 || p.y < -40 || p.y > this.height + 40) {
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

    // 從迎風面邊界隨機生成，確保全畫面均勻流動
    const margin = 20;
    if (Math.abs(vx) > Math.abs(vy)) {
      p.x = vx > 0 ? -margin : this.width + margin;
      p.y = Math.random() * this.height;
    } else {
      p.x = Math.random() * this.width;
      p.y = vy > 0 ? -margin : this.height + margin;
    }

    // 偶爾隨機散佈於螢幕內部以防止空檔
    if (Math.random() < 0.25) {
      p.x = Math.random() * this.width;
      p.y = Math.random() * this.height;
    }
  }
}

window.WindCanvasEngine = WindCanvasEngine;

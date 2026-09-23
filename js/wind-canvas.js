/**
 * Windy Style Wind Particle Streamline Engine - Vector Field Edition
 * Features:
 * 1. Accurate Meteorological Vector Math:
 *    Wind direction (deg) defines WHERE WIND COMES FROM.
 *    Flow vector (vx, vy) points to WHERE AIR BLOWS TOWARDS (deg + 180).
 * 2. Multi-Station Spatial Vector Field (IDW):
 *    Computes local wind vectors across Taiwan based on CWA station coordinates,
 *    simulating authentic regional flow patterns like CWA wifi.cwa.gov.tw.
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

    // 預設全域風向風速 (備用)
    this.targetDeg = 65;
    this.currentDeg = 65;
    this.targetSpeed = 3.5;
    this.currentSpeed = 3.5;

    // 二維向量網格 (Vector Grid)
    this.gridCols = 22;
    this.gridRows = 22;
    this.vectorGrid = [];

    this.particles = [];
    this.numParticles = 420;
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
    this.numParticles = Math.min(650, Math.max(260, Math.floor(area / 2000)));

    this.rebuildVectorGrid();
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
      width: Math.random() < 0.25 ? 1.7 : 1.15
    };
  }

  setWind(deg, speed) {
    this.targetDeg = deg;
    this.targetSpeed = Math.max(speed, 0.6);
    this.rebuildVectorGrid();
  }

  setTransform(panX, panY, zoom) {
    this.panX = panX;
    this.panY = panY;
    this.zoom = zoom;
    this.rebuildVectorGrid();
  }

  /**
   * 重建全島空間風場向量網格 (Spatial Vector Grid)
   * 根據全臺各測站真實經緯度與風向風速進行逆距離加權 (IDW) 內插
   */
  rebuildVectorGrid() {
    this.vectorGrid = [];
    const cellW = this.width / this.gridCols;
    const cellH = this.height / this.gridRows;

    let stations = [];
    if (window.weatherService && window.weatherService.stations) {
      stations = window.weatherService.stations;
    }

    // 若有 Leaflet 地圖，先取得各測站當前在畫布上的像素坐標
    const stationPts = [];
    if (stations.length > 0 && window.leafletMap) {
      stations.forEach(st => {
        try {
          const pt = window.leafletMap.latLngToContainerPoint([st.lat, st.lon]);
          stationPts.push({
            pt,
            deg: st.windDeg,
            speed: st.windSpeed
          });
        } catch (e) {}
      });
    }

    for (let c = 0; c < this.gridCols; c++) {
      this.vectorGrid[c] = [];
      const px = (c + 0.5) * cellW;

      for (let r = 0; r < this.gridRows; r++) {
        const py = (r + 0.5) * cellH;

        let vx = 0;
        let vy = 0;

        if (stationPts.length > 0) {
          let totalWeight = 0;
          let sumVx = 0;
          let sumVy = 0;

          for (let i = 0; i < stationPts.length; i++) {
            const st = stationPts[i];
            const dx = px - st.pt.x;
            const dy = py - st.pt.y;
            const distSq = dx * dx + dy * dy + 900; // 避免除以 0
            const weight = 1 / distSq;

            // 氣象學風向轉換為粒子移動速度向量：
            // 風向 deg 為來向，粒子流向為 (deg + 180)
            // 在螢幕座標中 (北 -Y, 東 +X):
            // vx = -sin(deg) * speed
            // vy = cos(deg) * speed
            const degRad = st.deg * (Math.PI / 180);
            const svx = -Math.sin(degRad) * st.speed;
            const svy = Math.cos(degRad) * st.speed;

            sumVx += svx * weight;
            sumVy += svy * weight;
            totalWeight += weight;
          }

          if (totalWeight > 0) {
            vx = (sumVx / totalWeight) * 1.35 * Math.sqrt(this.zoom);
            vy = (sumVy / totalWeight) * 1.35 * Math.sqrt(this.zoom);
          }
        } else {
          // 單一風向備用方案
          const degRad = this.currentDeg * (Math.PI / 180);
          vx = -Math.sin(degRad) * this.currentSpeed * 1.35 * Math.sqrt(this.zoom);
          vy = Math.cos(degRad) * this.currentSpeed * 1.35 * Math.sqrt(this.zoom);
        }

        this.vectorGrid[c][r] = { vx, vy };
      }
    }
  }

  /**
   * 取得指定座標點的風速向量
   */
  getVector(x, y) {
    if (!this.vectorGrid || this.vectorGrid.length === 0) {
      const degRad = this.currentDeg * (Math.PI / 180);
      return {
        vx: -Math.sin(degRad) * this.currentSpeed * 1.35 * Math.sqrt(this.zoom),
        vy: Math.cos(degRad) * this.currentSpeed * 1.35 * Math.sqrt(this.zoom)
      };
    }

    const c = Math.max(0, Math.min(this.gridCols - 1, Math.floor((x / this.width) * this.gridCols)));
    const r = Math.max(0, Math.min(this.gridRows - 1, Math.floor((y / this.height) * this.gridRows)));

    return this.vectorGrid[c][r] || { vx: 0, vy: 0 };
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

  animate() {
    if (!this.isRunning) return;

    // 半透明背景淡出以產生流暢氣流流線殘影 (Windy 特效)
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.lineCap = 'round';

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.prevX === null) {
        p.prevX = p.x;
        p.prevY = p.y;
      }

      // 取得粒子當前所在位置的空間風場向量
      const vec = this.getVector(p.x, p.y);
      const turbulence = Math.sin(p.age * 0.08) * 0.45;

      p.x += (vec.vx + turbulence) * p.speedFactor;
      p.y += (vec.vy - turbulence) * p.speedFactor;

      const lifeRatio = p.age / p.maxLife;
      let alpha = 1.0;
      if (lifeRatio < 0.2) {
        alpha = lifeRatio / 0.2;
      } else if (lifeRatio > 0.8) {
        alpha = (1 - lifeRatio) / 0.2;
      }
      alpha = Math.max(0, Math.min(0.95, alpha * 0.9));

      // 繪製動態風流線
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
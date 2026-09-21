/**
 * Main Controller - Windy Real-Scale Dynamic Weather
 * Coordinates the pan-zoom map stage, 9 layer gradient overlays,
 * full-screen wind particle engine, CWA live data, and timeline player.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化全域風場粒子引擎
  const windEngine = new WindyParticleEngine('windCanvas');
  window.windEngine = windEngine;

  // 2. 狀態管理
  let currentLayer = 'wind';
  let activeStationId = '466920'; // 預設臺北
  let isPlayingTimeline = false;
  let timelineInterval = null;
  let currentTimelineDay = 0;

  // 地圖平移縮放變換 (以臺灣海峽為中心)
  let zoom = 1.0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  // 3. 快取 DOM 節點
  const dom = {
    viewport: document.getElementById('windyViewport'),
    mapStage: document.getElementById('mapStage'),
    thermalOverlay: document.getElementById('thermalOverlay'),
    stationsLayer: document.getElementById('stationsLayer'),
    isobarGroup: document.getElementById('isobarGroup'),

    // 頂部
    windySearchInput: document.getElementById('windySearchInput'),
    btnSearch: document.getElementById('btnSearch'),

    // 右側圖層選單
    layerNav: document.getElementById('layerNav'),
    btnMainMenu: document.getElementById('btnMainMenu'),

    // 右下控制項
    togglePressure: document.getElementById('togglePressure'),
    toggleParticles: document.getElementById('toggleParticles'),
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnResetView: document.getElementById('btnResetView'),
    btnFullscreen: document.getElementById('btnFullscreen'),

    // 氣候選擇氣泡卡
    pickerCard: document.getElementById('windyPickerCard'),
    pickerPlace: document.getElementById('pickerPlace'),
    pickerTemp: document.getElementById('pickerTemp'),
    pickerWeather: document.getElementById('pickerWeather'),
    pickerWind: document.getElementById('pickerWind'),
    pickerRain: document.getElementById('pickerRain'),
    pickerHum: document.getElementById('pickerHum'),
    pickerPres: document.getElementById('pickerPres'),
    pickerCloseBtn: document.getElementById('pickerCloseBtn'),

    // 底部工具列
    btnPlayTimeline: document.getElementById('btnPlayTimeline'),
    timelineTrack: document.getElementById('timelineTrack'),
    scaleUnit: document.getElementById('scaleUnit'),
    scaleBlocksWrap: document.getElementById('scaleBlocksWrap')
  };

  /**
   * 經緯度投影至 SVG 地圖像素座標 (臺灣島投影轉換)
   */
  function projectGisCoordinates(lat, lon) {
    // 基準點: 臺灣中心經度約 120.95°E, 緯度約 23.8°N
    // SVG 中臺灣群組 translate(620, 380)
    const baseMapX = 620;
    const baseMapY = 380;

    // 臺灣島寬度約 170px, 高度約 440px
    const lonScale = 160 / 2.4; // 每度經度像素
    const latScale = 430 / 3.5; // 每度緯度像素

    const px = baseMapX + (lon - 119.5) * lonScale;
    const py = baseMapY + (25.5 - lat) * latScale;

    return { x: px, y: py };
  }

  /**
   * 更新地圖與粒子變換矩陣
   */
  function applyMapTransform() {
    dom.mapStage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    windEngine.setTransform(panX, panY, zoom);
  }

  /**
   * 切換 Windy 圖層 (風速、雷達、衛星、溫度、降雨、颱風等)
   */
  function switchLayer(layerId) {
    const config = window.WINDY_LAYERS[layerId] || window.WINDY_LAYERS.wind;
    currentLayer = config.id;

    // 1. 更新右側選單 active 狀態
    dom.layerNav.querySelectorAll('.layer-item').forEach(item => {
      if (item.dataset.layer === config.id) item.classList.add('active');
      else item.classList.remove('active');
    });

    // 2. 更新底層大氣熱力疊加漸層
    dom.thermalOverlay.style.background = config.overlayGradient;

    // 3. 更新底部色彩刻度標尺 (Legend Scale Bar)
    renderColorScale(config);

    // 4. 更新測站數值標籤
    renderStations();
  }

  /**
   * 渲染右下角數值色階條
   */
  function renderColorScale(config) {
    dom.scaleUnit.textContent = config.unit;
    dom.scaleBlocksWrap.innerHTML = '';

    config.stops.forEach((val, i) => {
      const block = document.createElement('div');
      block.className = 'scale-block';
      block.style.backgroundColor = config.colors[i] || '#555';
      block.textContent = val;
      dom.scaleBlocksWrap.appendChild(block);
    });
  }

  /**
   * 依圖層取得測站顯示文字
   */
  function getStationValueForLayer(st, layerId) {
    switch (layerId) {
      case 'temp':
        return `${st.temp.toFixed(1)}°`;
      case 'wind':
        // 換算節 (knots: 1 m/s ≈ 1.94384 kt)
        return `${Math.round(st.windSpeed * 1.94)}kt`;
      case 'rain':
      case 'accumRain':
        return `${st.rain.toFixed(1)}mm`;
      case 'radar':
        return st.rain > 0 ? '35dBZ' : '15dBZ';
      default:
        return `${st.temp.toFixed(1)}°`;
    }
  }

  /**
   * 渲染全臺灣測站標記
   */
  function renderStations() {
    dom.stationsLayer.innerHTML = '';
    const stations = window.weatherService.stations;

    stations.forEach(st => {
      const pos = projectGisCoordinates(st.lat, st.lon);
      const valText = getStationValueForLayer(st, currentLayer);

      const pin = document.createElement('div');
      pin.className = `windy-station-pin ${st.id === activeStationId ? 'active' : ''}`;
      pin.id = `st-pin-${st.id}`;
      pin.style.left = `${pos.x}px`;
      pin.style.top = `${pos.y}px`;

      pin.innerHTML = `
        <span class="station-pulse-dot"></span>
        <div class="station-value-badge">
          <span class="badge-station">${st.name}</span>
          <span class="badge-arrow" style="transform: rotate(${st.windDeg}deg);">↗</span>
          <span class="badge-val">${valText}</span>
        </div>
      `;

      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        selectStation(st, pos.x, pos.y);
      });

      dom.stationsLayer.appendChild(pin);
    });
  }

  /**
   * 選擇測站並展開 Windy 預報選擇卡
   */
  function selectStation(st, x, y) {
    activeStationId = st.id;

    // 活躍樣式切換
    dom.stationsLayer.querySelectorAll('.windy-station-pin').forEach(p => p.classList.remove('active'));
    document.getElementById(`st-pin-${st.id}`)?.classList.add('active');

    // 連動風向粒子引擎
    windEngine.setWind(st.windDeg, st.windSpeed);

    // 填充選擇卡資訊
    const dirInfo = window.getWindDirectionText(st.windDeg);
    const knots = Math.round(st.windSpeed * 1.94);

    dom.pickerPlace.textContent = `${st.county} · ${st.name}測站`;
    dom.pickerTemp.textContent = `${st.temp.toFixed(1)}°C`;
    dom.pickerWeather.textContent = `${st.weather}`;
    dom.pickerWind.textContent = `${dirInfo.name} ${st.windSpeed.toFixed(1)}m/s (${knots} kt)`;
    dom.pickerRain.textContent = `${st.rain.toFixed(1)} mm`;
    dom.pickerHum.textContent = `${st.hum}%`;
    dom.pickerPres.textContent = `${st.pres.toFixed(1)} hPa`;

    dom.pickerCard.style.left = `${x}px`;
    dom.pickerCard.style.top = `${y}px`;
    dom.pickerCard.style.display = 'block';
  }

  function hidePicker() {
    dom.pickerCard.style.display = 'none';
  }

  /**
   * 時間軸播放控制
   */
  function toggleTimeline() {
    isPlayingTimeline = !isPlayingTimeline;
    if (isPlayingTimeline) {
      dom.btnPlayTimeline.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
      `;
      timelineInterval = setInterval(() => {
        currentTimelineDay = (currentTimelineDay + 1) % 10;
        setActiveTimelineDay(currentTimelineDay);
      }, 1200);
    } else {
      dom.btnPlayTimeline.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="6 4 20 12 6 20 6 4"/>
        </svg>
      `;
      clearInterval(timelineInterval);
    }
  }

  function setActiveTimelineDay(dayIdx) {
    currentTimelineDay = dayIdx;
    dom.timelineTrack.querySelectorAll('.timeline-day').forEach((item, idx) => {
      if (idx === dayIdx) item.classList.add('active');
      else item.classList.remove('active');
    });

    // 模擬氣溫與風向隨日期微幅演變
    const st = window.weatherService.getStationById(activeStationId);
    if (st) {
      const simulatedDeg = (st.windDeg + dayIdx * 12) % 360;
      const simulatedSpeed = Math.max(1.5, st.windSpeed + (dayIdx % 3) * 0.8);
      windEngine.setWind(simulatedDeg, simulatedSpeed);
    }
  }

  /**
   * 搜尋測站或縣市
   */
  function searchLocation() {
    const query = dom.windySearchInput.value.trim().toLowerCase();
    if (!query) return;

    const matched = window.weatherService.stations.find(s => 
      s.name.toLowerCase().includes(query) || 
      s.county.toLowerCase().includes(query)
    );

    if (matched) {
      const pos = projectGisCoordinates(matched.lat, matched.lon);
      // 移動視角居中於該測站
      zoom = 1.6;
      panX = (window.innerWidth / 2) - (pos.x * zoom);
      panY = (window.innerHeight / 2) - (pos.y * zoom);
      applyMapTransform();
      selectStation(matched, pos.x, pos.y);
    } else {
      alert(`找不到名稱包含「${query}」的地點，請搜尋臺北、臺中、高雄等縣市。`);
    }
  }

  // =========================================================================
  // 平移與縮放互動 (Mouse & Touch Pan-Zoom)
  // =========================================================================
  dom.viewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.windy-right-menu') || 
        e.target.closest('.windy-top-bar') || 
        e.target.closest('.windy-floating-controls') || 
        e.target.closest('.windy-bottom-dock') ||
        e.target.closest('.windy-picker-card') ||
        e.target.closest('.windy-station-pin')) {
      return;
    }
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    dom.viewport.classList.add('grabbing');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyMapTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      dom.viewport.classList.remove('grabbing');
    }
  });

  // 滑鼠滾輪平滑縮放 (Scroll to Zoom)
  dom.viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    const newZoom = Math.min(3.8, Math.max(0.7, zoom * zoomFactor));

    // 以滑鼠指針為中心縮放
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    panX = mouseX - (mouseX - panX) * (newZoom / zoom);
    panY = mouseY - (mouseY - panY) * (newZoom / zoom);
    zoom = newZoom;

    applyMapTransform();
  }, { passive: false });

  // 縮放按鈕
  dom.btnZoomIn.addEventListener('click', () => {
    zoom = Math.min(3.8, zoom + 0.3);
    applyMapTransform();
  });

  dom.btnZoomOut.addEventListener('click', () => {
    zoom = Math.max(0.7, zoom - 0.3);
    applyMapTransform();
  });

  dom.btnResetView.addEventListener('click', () => {
    zoom = 1.0;
    panX = 0;
    panY = 0;
    applyMapTransform();
  });

  // 全螢幕切換
  dom.btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // =========================================================================
  // 事件綁定
  // =========================================================================
  // 1. 右側圖層切換
  dom.layerNav.addEventListener('click', (e) => {
    const item = e.target.closest('.layer-item');
    if (!item) return;
    switchLayer(item.dataset.layer);
  });

  // 2. 開關切換 (氣壓等壓線 & 粒子動畫)
  dom.togglePressure.addEventListener('change', (e) => {
    dom.isobarGroup.style.display = e.target.checked ? 'block' : 'none';
  });

  dom.toggleParticles.addEventListener('change', (e) => {
    windEngine.setParticlesEnabled(e.target.checked);
  });

  // 3. 搜尋
  dom.btnSearch.addEventListener('click', searchLocation);
  dom.windySearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchLocation();
  });

  // 4. 氣候卡關閉
  dom.pickerCloseBtn.addEventListener('click', hidePicker);

  // 5. 點擊地圖任意處顯示氣候資訊
  dom.mapStage.addEventListener('click', (e) => {
    if (e.target.closest('.windy-station-pin')) return;
    // 取得點擊相對座標
    const rect = dom.mapStage.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom;
    const clickY = (e.clientY - rect.top) / zoom;

    // 尋找最近的測站
    let nearestSt = window.weatherService.stations[0];
    let minDistance = Infinity;

    window.weatherService.stations.forEach(st => {
      const pos = projectGisCoordinates(st.lat, st.lon);
      const d = Math.hypot(pos.x - clickX, pos.y - clickY);
      if (d < minDistance) {
        minDistance = d;
        nearestSt = st;
      }
    });

    selectStation(nearestSt, clickX, clickY);
  });

  // 6. 時間軸互動
  dom.btnPlayTimeline.addEventListener('click', toggleTimeline);
  dom.timelineTrack.addEventListener('click', (e) => {
    const dayItem = e.target.closest('.timeline-day');
    if (!dayItem) return;
    setActiveTimelineDay(parseInt(dayItem.dataset.day, 10));
  });

  // 7. 模型切換按鈕
  document.querySelectorAll('.model-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // =========================================================================
  // 初始啟動
  // =========================================================================
  switchLayer('wind');
  applyMapTransform();
  renderStations();

  // 預設開啟臺北測站氣象選擇卡
  const defaultPos = projectGisCoordinates(25.037, 121.514);
  selectStation(window.weatherService.stations[0], defaultPos.x, defaultPos.y);

  // 背景自動擷取 CWA 最新即時資料
  window.weatherService.fetchLiveStations().then(() => {
    renderStations();
  });
});

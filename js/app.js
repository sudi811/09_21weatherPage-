/**
 * Main Application Controller - MUJI Weather Journal
 * Coordinates the centered Taiwan interactive map, layer switcher,
 * live wind flow canvas, 360° compass, and CWA open data API.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化和紙質感的風場粒子模擬引擎
  const windEngine = new WindCanvasEngine('windCanvas');
  window.windEngine = windEngine;

  // 2. 應用程式核心狀態
  let activeStationId = '466920'; // 預設：臺北
  let activeLayer = 'temp';       // 'temp' | 'wind' | 'rain' | 'humidity'
  let activeRegion = 'all';       // 'all' | 'north' | 'central' | 'south' | 'east' | 'islands'

  // 3. 快取 DOM 節點
  const dom = {
    // 頂部導航
    statusDot: document.getElementById('statusDot'),
    statusLabel: document.getElementById('statusLabel'),
    lastUpdatedText: document.getElementById('lastUpdatedText'),
    btnRefresh: document.getElementById('btnRefresh'),

    // 地圖與標記層
    mapLayerHint: document.getElementById('mapLayerHint'),
    regionFilters: document.getElementById('regionFilters'),
    markersLayer: document.getElementById('markersLayer'),

    // 圖層切換 Tabs
    layerTabs: document.getElementById('layerTabs'),

    // 選定測站主卡片
    currentCountyName: document.getElementById('currentCountyName'),
    currentStationName: document.getElementById('currentStationName'),
    weatherIcon: document.getElementById('weatherIcon'),
    weatherDesc: document.getElementById('weatherDesc'),
    primaryMetricValue: document.getElementById('primaryMetricValue'),
    primaryMetricUnit: document.getElementById('primaryMetricUnit'),
    primaryMetricSub: document.getElementById('primaryMetricSub'),
    mujiTipText: document.getElementById('mujiTipText'),

    // 360° 羅盤與風杯
    windScaleBadge: document.getElementById('windScaleBadge'),
    compassNeedle: document.getElementById('compassNeedle'),
    anemometerRotor: document.getElementById('anemometerRotor'),
    readoutDirection: document.getElementById('readoutDirection'),
    readoutSpeedText: document.getElementById('readoutSpeedText'),

    // 詳細指標清單
    stationCoords: document.getElementById('stationCoords'),
    metricWindSpeed: document.getElementById('metricWindSpeed'),
    metricGustSpeed: document.getElementById('metricGustSpeed'),
    metricHumidity: document.getElementById('metricHumidity'),
    metricPressure: document.getElementById('metricPressure'),
    metricRain: document.getElementById('metricRain'),
    metricBeaufort: document.getElementById('metricBeaufort')
  };

  /**
   * 計算體感溫度
   */
  function calculateFeelsLike(temp, hum, windSpeed) {
    const e = (hum / 100) * 6.105 * Math.exp((17.27 * temp) / (237.7 + temp));
    const feelsLike = temp + 0.33 * e - 0.7 * windSpeed - 4.0;
    return Math.round(feelsLike * 10) / 10;
  }

  function getWeatherIcon(weather) {
    if (!weather) return '🌤️';
    if (weather.includes('雷')) return '⛈️';
    if (weather.includes('雨')) return '🌧️';
    if (weather.includes('陰')) return '☁️';
    if (weather.includes('多雲')) return '⛅';
    if (weather.includes('晴')) return '☀️';
    if (weather.includes('霧') || weather.includes('靄')) return '🌫️';
    return '🌤️';
  }

  function formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * 根據當前圖層格式化地圖標籤文字
   */
  function getLayerValueForStation(st, layer) {
    switch (layer) {
      case 'temp':
        return `${st.temp.toFixed(1)}°`;
      case 'wind':
        return `${st.windSpeed.toFixed(1)}m`;
      case 'rain':
        return `${st.rain.toFixed(1)}mm`;
      case 'humidity':
        return `${st.hum}%`;
      default:
        return `${st.temp.toFixed(1)}°`;
    }
  }

  /**
   * 渲染地圖上的測站互動標記節點
   */
  function renderMapMarkers() {
    dom.markersLayer.innerHTML = '';
    const stations = window.weatherService.stations;

    stations.forEach(st => {
      // 若有分區篩選，非目標分區淡出或隱藏
      const isVisible = activeRegion === 'all' || st.region === activeRegion;

      const node = document.createElement('div');
      node.className = `station-node ${st.id === activeStationId ? 'active' : ''}`;
      node.style.left = `${st.mapX}%`;
      node.style.top = `${st.mapY}%`;
      node.style.display = isVisible ? 'flex' : 'none';
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('title', `${st.county} · ${st.name}`);

      const layerValText = getLayerValueForStation(st, activeLayer);

      node.innerHTML = `
        <span class="node-dot"></span>
        <div class="node-pill">
          <span class="node-name">${st.name}</span>
          <span class="node-arrow" style="transform: rotate(${st.windDeg}deg);">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </span>
          <span class="node-val">${layerValText}</span>
        </div>
      `;

      node.addEventListener('click', () => {
        if (activeStationId !== st.id) {
          activeStationId = st.id;
          updateActiveMarker();
          renderSidebarDetails();
        }
      });

      dom.markersLayer.appendChild(node);
    });
  }

  function updateActiveMarker() {
    const allNodes = dom.markersLayer.querySelectorAll('.station-node');
    const stations = window.weatherService.stations;
    allNodes.forEach((node, idx) => {
      if (stations[idx] && stations[idx].id === activeStationId) {
        node.classList.add('active');
      } else {
        node.classList.remove('active');
      }
    });
  }

  /**
   * 渲染右側詳細資料面板
   */
  function renderSidebarDetails() {
    const st = window.weatherService.getStationById(activeStationId);
    if (!st) return;

    // 1. 測站抬頭與天氣
    dom.currentCountyName.textContent = st.county;
    dom.currentStationName.textContent = `${st.name}站`;
    dom.weatherIcon.textContent = getWeatherIcon(st.weather);
    dom.weatherDesc.textContent = st.weather;

    // 2. 依當前選定圖層更新主指標數值與說明
    const dirInfo = window.getWindDirectionText(st.windDeg);
    const beaufort = window.getBeaufortScale(st.windSpeed);
    const feelsLike = calculateFeelsLike(st.temp, st.hum, st.windSpeed);

    switch (activeLayer) {
      case 'temp':
        dom.primaryMetricValue.textContent = st.temp.toFixed(1);
        dom.primaryMetricUnit.textContent = '°C';
        dom.primaryMetricSub.textContent = `體感溫度 ${feelsLike.toFixed(1)}°C · ${st.weather}`;
        dom.mapLayerHint.textContent = '目前顯示：即時氣溫圖層 (°C)';
        break;
      case 'wind':
        dom.primaryMetricValue.textContent = st.windSpeed.toFixed(1);
        dom.primaryMetricUnit.textContent = 'm/s';
        dom.primaryMetricSub.textContent = `${dirInfo.name} (${st.windDeg}°) · 蒲福氏 ${beaufort.scale}級 ${beaufort.level}`;
        dom.mapLayerHint.textContent = '目前顯示：風向與風速圖層 (m/s)';
        break;
      case 'rain':
        dom.primaryMetricValue.textContent = st.rain.toFixed(1);
        dom.primaryMetricUnit.textContent = 'mm';
        dom.primaryMetricSub.textContent = st.rain > 0 ? `本日降雨 ${st.rain}mm` : '本日尚無降雨記錄，天空舒適';
        dom.mapLayerHint.textContent = '目前顯示：本日累積降雨量 (mm)';
        break;
      case 'humidity':
        dom.primaryMetricValue.textContent = st.hum;
        dom.primaryMetricUnit.textContent = '%';
        dom.primaryMetricSub.textContent = `相對濕度 ${st.hum}% · 大氣壓力 ${st.pres.toFixed(1)} hPa`;
        dom.mapLayerHint.textContent = '目前顯示：相對濕度圖層 (%)';
        break;
    }

    // 3. 無印生活小籤
    dom.mujiTipText.textContent = window.getMujiLifestyleTip(st.temp, st.windSpeed, st.rain, st.hum);

    // 4. 360° 羅盤與風杯即時動態
    dom.compassNeedle.style.transform = `rotate(${st.windDeg}deg)`;
    const spinDuration = Math.max(0.3, 5.5 / Math.max(st.windSpeed, 0.5));
    dom.anemometerRotor.style.animationDuration = `${spinDuration.toFixed(2)}s`;

    dom.windScaleBadge.textContent = `${beaufort.scale}級 ${beaufort.level}`;
    dom.windScaleBadge.style.color = beaufort.color;
    dom.windScaleBadge.style.borderColor = `${beaufort.color}44`;

    dom.readoutDirection.textContent = `${dirInfo.name} ${st.windDeg}°`;
    dom.readoutSpeedText.textContent = `${st.windSpeed.toFixed(1)} m/s`;

    // 5. 連動背景 Canvas 2D 粒子風向與流速
    windEngine.setWind(st.windDeg, st.windSpeed);

    // 6. 詳細指標清單
    dom.stationCoords.textContent = `${st.lat.toFixed(2)}°N, ${st.lon.toFixed(2)}°E`;
    dom.metricWindSpeed.innerHTML = `${st.windSpeed.toFixed(1)} m/s <small>(${(st.windSpeed * 3.6).toFixed(1)} km/h)</small>`;
    dom.metricGustSpeed.innerHTML = `${st.gust.toFixed(1)} m/s <small>(${window.getBeaufortScale(st.gust).scale}級)</small>`;
    dom.metricHumidity.textContent = `${st.hum}%`;
    dom.metricPressure.textContent = `${st.pres.toFixed(1)} hPa`;
    dom.metricRain.textContent = `${st.rain.toFixed(1)} mm`;
    dom.metricBeaufort.textContent = `${beaufort.scale} 級 (${beaufort.level})`;
  }

  /**
   * 從氣象署 API 重新取得即時數據
   */
  async function refreshData() {
    dom.btnRefresh.classList.add('spinning');
    dom.btnRefresh.disabled = true;

    try {
      const res = await window.weatherService.fetchLiveStations();
      if (res.isLive) {
        dom.statusDot.style.backgroundColor = 'var(--muji-sage)';
        dom.statusLabel.textContent = '即時連線 (CWA)';
      } else {
        dom.statusDot.style.backgroundColor = 'var(--muji-ochre)';
        dom.statusLabel.textContent = '快取備用模式';
      }

      dom.lastUpdatedText.textContent = `更新: ${formatTime(window.weatherService.lastUpdated)}`;
      renderMapMarkers();
      renderSidebarDetails();
    } catch (err) {
      console.error('更新失敗:', err);
    } finally {
      setTimeout(() => {
        dom.btnRefresh.classList.remove('spinning');
        dom.btnRefresh.disabled = false;
      }, 500);
    }
  }

  // =========================================================================
  // 事件監聽
  // =========================================================================
  // 1. 圖層切換 (Layer Tabs)
  dom.layerTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.layer-tab');
    if (!tab) return;
    dom.layerTabs.querySelectorAll('.layer-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeLayer = tab.dataset.layer;
    renderMapMarkers();
    renderSidebarDetails();
  });

  // 2. 地圖分區快篩
  dom.regionFilters.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    dom.regionFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeRegion = chip.dataset.region;
    renderMapMarkers();
  });

  // 3. 手動更新按鈕
  dom.btnRefresh.addEventListener('click', () => {
    refreshData();
  });

  // =========================================================================
  // 初始掛載
  // =========================================================================
  dom.lastUpdatedText.textContent = `更新: ${formatTime(new Date())}`;
  renderMapMarkers();
  renderSidebarDetails();

  // 背景嘗試非同步抓取中央氣象署最新測站資料
  refreshData();

  // 每 5 分鐘自動刷新
  setInterval(refreshData, 5 * 60 * 1000);
});

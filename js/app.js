/**
 * Main Application Controller - Google Maps Weather Edition
 * Features: Google Red Drop-Pins with bounce animation, InfoWindow popups,
 * interactive zoom & pan, layer switcher, 360° compass, and live CWA API.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化底層動態氣流粒子模擬引擎
  const windEngine = new WindCanvasEngine('windCanvas');
  window.windEngine = windEngine;

  // 2. 應用狀態管理
  let activeStationId = '466920'; // 預設：臺北
  let activeLayer = 'temp';       // 'temp' | 'wind' | 'rain' | 'humidity'
  let activeRegion = 'all';       // 'all' | 'north' | 'central' | 'south' | 'east' | 'islands'

  // 地圖平移與縮放狀態
  let zoomLevel = 1.0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  // 3. 快取 DOM 節點
  const dom = {
    // 頂部搜尋與狀態
    gmapSearchInput: document.getElementById('gmapSearchInput'),
    btnSearchSubmit: document.getElementById('btnSearchSubmit'),
    btnRefresh: document.getElementById('btnRefresh'),
    liveDot: document.getElementById('liveDot'),
    liveStatusText: document.getElementById('liveStatusText'),
    lastUpdatedText: document.getElementById('lastUpdatedText'),

    // 地圖與視圖
    mapFrame: document.getElementById('mapFrame'),
    mapStage: document.getElementById('mapStage'),
    layerChips: document.getElementById('layerChips'),
    regionChips: document.getElementById('regionChips'),
    pinsLayer: document.getElementById('pinsLayer'),

    // Google InfoWindow 氣泡窗
    googleInfoWindow: document.getElementById('googleInfoWindow'),
    infoCounty: document.getElementById('infoCounty'),
    infoTitle: document.getElementById('infoTitle'),
    infoTemp: document.getElementById('infoTemp'),
    infoWeather: document.getElementById('infoWeather'),
    infoWind: document.getElementById('infoWind'),
    infoRain: document.getElementById('infoRain'),
    infoHum: document.getElementById('infoHum'),
    infoComfort: document.getElementById('infoComfort'),
    infoCloseBtn: document.getElementById('infoCloseBtn'),

    // 地圖縮放控制器
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnRecenter: document.getElementById('btnRecenter'),

    // 右側 Place Sheet 資訊卡
    sidebarWeatherIcon: document.getElementById('sidebarWeatherIcon'),
    sidebarStationName: document.getElementById('sidebarStationName'),
    sidebarCountyName: document.getElementById('sidebarCountyName'),
    sidebarMainVal: document.getElementById('sidebarMainVal'),
    sidebarMainUnit: document.getElementById('sidebarMainUnit'),
    sidebarWeatherText: document.getElementById('sidebarWeatherText'),
    sidebarSubText: document.getElementById('sidebarSubText'),
    btnQuickRefresh: document.getElementById('btnQuickRefresh'),
    btnCopyData: document.getElementById('btnCopyData'),

    // 360° 羅盤與風杯
    sidebarBeaufortBadge: document.getElementById('sidebarBeaufortBadge'),
    compassNeedle: document.getElementById('compassNeedle'),
    anemometerRotor: document.getElementById('anemometerRotor'),
    sidebarWindDir: document.getElementById('sidebarWindDir'),
    sidebarWindSpeed: document.getElementById('sidebarWindSpeed'),

    // 詳細資訊清單
    sidebarAddress: document.getElementById('sidebarAddress'),
    sidebarGustSpeed: document.getElementById('sidebarGustSpeed'),
    sidebarHumidity: document.getElementById('sidebarHumidity'),
    sidebarPressure: document.getElementById('sidebarPressure'),
    sidebarRain: document.getElementById('sidebarRain')
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
   * 取得不同圖層下的測站標籤數值
   */
  function getLayerValueForStation(st, layer) {
    switch (layer) {
      case 'temp':
        return `${st.temp.toFixed(1)}°C`;
      case 'wind':
        return `${st.windSpeed.toFixed(1)}m/s`;
      case 'rain':
        return `${st.rain.toFixed(1)}mm`;
      case 'humidity':
        return `${st.hum}%`;
      default:
        return `${st.temp.toFixed(1)}°C`;
    }
  }

  /**
   * 渲染地圖上的 Google 水滴 Pin 標記
   */
  function renderMapPins() {
    dom.pinsLayer.innerHTML = '';
    const stations = window.weatherService.stations;

    stations.forEach(st => {
      const isVisible = activeRegion === 'all' || st.region === activeRegion;
      const isActive = st.id === activeStationId;

      const pinNode = document.createElement('div');
      pinNode.className = `g-pin-node ${isActive ? 'active' : ''}`;
      pinNode.id = `pin-${st.id}`;
      pinNode.style.left = `${st.mapX}%`;
      pinNode.style.top = `${st.mapY}%`;
      pinNode.style.display = isVisible ? 'flex' : 'none';
      pinNode.setAttribute('title', `${st.county} · ${st.name}氣象站`);

      const layerText = getLayerValueForStation(st, activeLayer);

      // 經典 Google 水滴 Pin SVG 結構
      pinNode.innerHTML = `
        <div class="g-pin-label">
          <span class="label-station">${st.name}</span>
          <span class="label-wind-arrow" style="transform: rotate(${st.windDeg}deg);">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </span>
          <span class="label-val">${layerText}</span>
        </div>
        <svg class="g-drop-pin" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 14 38 14 38C14 38 28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="#EA4335"/>
          <circle cx="14" cy="14" r="5.5" fill="#FFFFFF"/>
        </svg>
        <div class="pin-shadow"></div>
      `;

      pinNode.addEventListener('click', (e) => {
        e.stopPropagation();
        selectStation(st.id);
      });

      dom.pinsLayer.appendChild(pinNode);
    });

    // 若有選取測站，更新 InfoWindow 位置
    positionInfoWindow();
  }

  function selectStation(stationId) {
    activeStationId = stationId;

    // 更新 Pin 活躍狀態
    const allPins = dom.pinsLayer.querySelectorAll('.g-pin-node');
    const stations = window.weatherService.stations;
    allPins.forEach((node, idx) => {
      if (stations[idx] && stations[idx].id === activeStationId) {
        node.classList.add('active');
      } else {
        node.classList.remove('active');
      }
    });

    renderSidebarPlaceDetails();
    showInfoWindow();
  }

  /**
   * 顯示並定位 Google Maps InfoWindow 氣泡窗
   */
  function showInfoWindow() {
    const st = window.weatherService.getStationById(activeStationId);
    if (!st) return;

    const dirInfo = window.getWindDirectionText(st.windDeg);
    const feelsLike = calculateFeelsLike(st.temp, st.hum, st.windSpeed);

    dom.infoCounty.textContent = st.county;
    dom.infoTitle.textContent = `${st.name}氣象站`;
    dom.infoTemp.textContent = `${st.temp.toFixed(1)}°C`;
    dom.infoWeather.textContent = `${getWeatherIcon(st.weather)} ${st.weather}`;
    dom.infoWind.textContent = `${dirInfo.name} ${st.windSpeed.toFixed(1)}m/s`;
    dom.infoRain.textContent = `${st.rain.toFixed(1)} mm`;
    dom.infoHum.textContent = `${st.hum}%`;
    dom.infoComfort.textContent = `體感 ${feelsLike.toFixed(1)}°C`;

    positionInfoWindow();
    dom.googleInfoWindow.style.display = 'block';
  }

  function positionInfoWindow() {
    const st = window.weatherService.getStationById(activeStationId);
    if (!st) return;
    dom.googleInfoWindow.style.left = `${st.mapX}%`;
    dom.googleInfoWindow.style.top = `${st.mapY}%`;
  }

  function hideInfoWindow() {
    dom.googleInfoWindow.style.display = 'none';
  }

  /**
   * 渲染右側 Google Place Sheet 詳細數據
   */
  function renderSidebarPlaceDetails() {
    const st = window.weatherService.getStationById(activeStationId);
    if (!st) return;

    const dirInfo = window.getWindDirectionText(st.windDeg);
    const beaufort = window.getBeaufortScale(st.windSpeed);
    const feelsLike = calculateFeelsLike(st.temp, st.hum, st.windSpeed);

    // 1. 測站地標抬頭
    dom.sidebarStationName.textContent = `${st.name}氣象站`;
    dom.sidebarCountyName.textContent = `${st.county} · 即時觀測`;
    dom.sidebarWeatherIcon.textContent = getWeatherIcon(st.weather);
    dom.sidebarWeatherText.textContent = st.weather;

    // 2. 依當前圖層顯示巨幅主數值
    switch (activeLayer) {
      case 'temp':
        dom.sidebarMainVal.textContent = st.temp.toFixed(1);
        dom.sidebarMainUnit.textContent = '°C';
        dom.sidebarSubText.textContent = `體感溫度 ${feelsLike.toFixed(1)}°C • ${st.weather}`;
        break;
      case 'wind':
        dom.sidebarMainVal.textContent = st.windSpeed.toFixed(1);
        dom.sidebarMainUnit.textContent = 'm/s';
        dom.sidebarSubText.textContent = `${dirInfo.name} (${st.windDeg}°) • 蒲福氏 ${beaufort.scale}級 ${beaufort.level}`;
        break;
      case 'rain':
        dom.sidebarMainVal.textContent = st.rain.toFixed(1);
        dom.sidebarMainUnit.textContent = 'mm';
        dom.sidebarSubText.textContent = st.rain > 0 ? `本日累積降雨量 ${st.rain}mm` : '本日尚無降雨記錄，天空乾爽';
        break;
      case 'humidity':
        dom.sidebarMainVal.textContent = st.hum;
        dom.sidebarMainUnit.textContent = '%';
        dom.sidebarSubText.textContent = `相對濕度 ${st.hum}% • 大氣壓力 ${st.pres.toFixed(1)} hPa`;
        break;
    }

    // 3. 羅盤指針與旋轉風杯即時連動
    dom.compassNeedle.style.transform = `rotate(${st.windDeg}deg)`;
    const spinDuration = Math.max(0.25, 5.0 / Math.max(st.windSpeed, 0.5));
    dom.anemometerRotor.style.animationDuration = `${spinDuration.toFixed(2)}s`;

    dom.sidebarBeaufortBadge.textContent = `${beaufort.scale}級 ${beaufort.level}`;
    dom.sidebarBeaufortBadge.style.backgroundColor = `${beaufort.color}18`;
    dom.sidebarBeaufortBadge.style.color = beaufort.color;

    dom.sidebarWindDir.textContent = `${dirInfo.name} (${st.windDeg}°)`;
    dom.sidebarWindSpeed.textContent = `${st.windSpeed.toFixed(1)} m/s (${(st.windSpeed * 3.6).toFixed(1)} km/h)`;

    // 4. 同步更新底層 Canvas 2D 風場粒子流向與速度
    windEngine.setWind(st.windDeg, st.windSpeed);

    // 5. 詳細項目清單
    dom.sidebarAddress.textContent = `${st.lat.toFixed(2)}°N, ${st.lon.toFixed(2)}°E • ${st.address || st.county}`;
    dom.sidebarGustSpeed.textContent = `${st.windSpeed.toFixed(1)} m/s (${(st.windSpeed * 3.6).toFixed(1)} km/h) • 瞬間最大陣風 ${st.gust.toFixed(1)} m/s`;
    dom.sidebarHumidity.textContent = `${st.hum}% (${st.hum > 75 ? '微潮濕' : '舒適乾燥'})`;
    dom.sidebarPressure.textContent = `${st.pres.toFixed(1)} hPa`;
    dom.sidebarRain.textContent = `${st.rain.toFixed(1)} mm (${st.rain > 0 ? '有降雨' : '目前無降雨'})`;
  }

  /**
   * 地圖縮放與平移變換
   */
  function applyTransform() {
    dom.mapStage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  }

  function zoomIn() {
    zoomLevel = Math.min(2.2, zoomLevel + 0.25);
    applyTransform();
  }

  function zoomOut() {
    zoomLevel = Math.max(0.9, zoomLevel - 0.25);
    applyTransform();
  }

  function resetView() {
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  /**
   * CWA API 重新擷取
   */
  async function refreshData() {
    dom.btnRefresh.classList.add('spinning');
    dom.btnRefresh.disabled = true;

    try {
      const res = await window.weatherService.fetchLiveStations();
      if (res.isLive) {
        dom.liveDot.style.backgroundColor = 'var(--g-green)';
        dom.liveStatusText.textContent = '即時連線 (CWA)';
      } else {
        dom.liveDot.style.backgroundColor = 'var(--g-yellow)';
        dom.liveStatusText.textContent = '快取備用模式';
      }

      dom.lastUpdatedText.textContent = `更新: ${formatTime(window.weatherService.lastUpdated)}`;
      renderMapPins();
      renderSidebarPlaceDetails();
    } catch (err) {
      console.error('更新失敗:', err);
    } finally {
      setTimeout(() => {
        dom.btnRefresh.classList.remove('spinning');
        dom.btnRefresh.disabled = false;
      }, 600);
    }
  }

  /**
   * 搜尋縣市或測站
   */
  function executeSearch() {
    const query = dom.gmapSearchInput.value.trim().toLowerCase();
    if (!query) return;

    const matched = window.weatherService.stations.find(s => 
      s.name.toLowerCase().includes(query) || 
      s.county.toLowerCase().includes(query)
    );

    if (matched) {
      selectStation(matched.id);
      // 自動切換至對應分區
      activeRegion = 'all';
      dom.regionChips.querySelectorAll('.region-chip').forEach(c => c.classList.remove('active'));
      dom.regionChips.querySelector('[data-region="all"]')?.classList.add('active');
      renderMapPins();
    } else {
      alert(`找不到與「${query}」相符的測站，請嘗試搜尋其他縣市名稱。`);
    }
  }

  // =========================================================================
  // 事件監聽綁定
  // =========================================================================

  // 1. 圖層切換 (Layer Chips)
  dom.layerChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-item');
    if (!chip) return;
    dom.layerChips.querySelectorAll('.chip-item').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeLayer = chip.dataset.layer;
    renderMapPins();
    renderSidebarPlaceDetails();
  });

  // 2. 分區快篩 (Region Chips)
  dom.regionChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.region-chip');
    if (!chip) return;
    dom.regionChips.querySelectorAll('.region-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeRegion = chip.dataset.region;
    renderMapPins();
  });

  // 3. 搜尋相關
  dom.btnSearchSubmit.addEventListener('click', executeSearch);
  dom.gmapSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeSearch();
  });

  // 4. 地圖縮放與復位
  dom.btnZoomIn.addEventListener('click', zoomIn);
  dom.btnZoomOut.addEventListener('click', zoomOut);
  dom.btnRecenter.addEventListener('click', resetView);

  // 5. InfoWindow 關閉
  dom.infoCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideInfoWindow();
  });

  // 6. 手動刷新按鈕
  dom.btnRefresh.addEventListener('click', refreshData);
  dom.btnQuickRefresh.addEventListener('click', refreshData);

  // 7. 複製分享數據
  dom.btnCopyData.addEventListener('click', () => {
    const st = window.weatherService.getStationById(activeStationId);
    if (!st) return;
    const text = `【臺灣即時氣候】${st.county} · ${st.name}氣象站：氣溫 ${st.temp}°C，${st.weather}，風向 ${window.getWindDirectionText(st.windDeg).name} ${st.windSpeed}m/s，降雨量 ${st.rain}mm。`;
    navigator.clipboard.writeText(text).then(() => {
      alert('已成功複製測站氣象資訊至剪貼簿！');
    }).catch(() => {
      prompt('請複製以下文字：', text);
    });
  });

  // 8. 滑鼠拖曳地圖平移 (Drag to Pan)
  dom.mapFrame.addEventListener('mousedown', (e) => {
    if (e.target.closest('.g-pin-node') || e.target.closest('.gmap-infowindow') || e.target.closest('.gmap-controls') || e.target.closest('.floating-layer-chips') || e.target.closest('.floating-region-chips')) {
      return;
    }
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    dom.mapFrame.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      dom.mapFrame.style.cursor = 'default';
    }
  });

  // =========================================================================
  // 初始啟動
  // =========================================================================
  dom.lastUpdatedText.textContent = `更新: ${formatTime(new Date())}`;
  renderMapPins();
  renderSidebarPlaceDetails();
  showInfoWindow();

  // 背景自動與 CWA API 同步
  refreshData();
  setInterval(refreshData, 5 * 60 * 1000);
});

/**
 * Main Application Controller - Google Maps & CWA Weather Edition
 * Features: CWA Wind Streamline Flow Map (Windy-style particles),
 * Default pins for Taipei, Taichung, Kaohsiung (click to show others),
 * 7-Day Weekly Weather Forecast, 4 meteorological layers, and 360° compass.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化底層動態氣流粒子模擬引擎 (Windy.com style)
  const windEngine = new WindyParticleEngine('windCanvas');
  window.windEngine = windEngine;

  // 2. 應用狀態管理
  let activeStationId = '466920'; // 預設：臺北
  let activeLayer = 'wind';        // 預設為使用者要求的風速 'wind' | 'radar' | 'temp' | 'accumRain'
  
  // 使用者需求：地圖上的紅色水滴標籤預設只顯示台北、台中、高雄，其他點選再顯示
  const BASE_STATION_IDS = ['466920', '467490', '467440']; // 臺北, 臺中, 高雄
  let visibleStationIds = new Set(BASE_STATION_IDS);

  // 3. 初始化開源 GIS 框架 Leaflet 地圖 (臺灣真實地理比例居中)
  const leafletMap = L.map('leafletMap', {
    center: [23.7, 120.95],
    zoom: 8,
    minZoom: 6,
    maxZoom: 14,
    zoomControl: false,
    attributionControl: true
  });
  window.leafletMap = leafletMap;

  // 採用 Google Maps / CartoDB 向量地圖瓦片
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(leafletMap);

  // 快取 Leaflet Markers 標記物件
  const markersMap = new Map();

  // Leaflet 地圖平移縮放時，同步告知 Windy 粒子引擎更新
  leafletMap.on('zoom move', () => {
    const center = leafletMap.getCenter();
    const zoom = leafletMap.getZoom();
    windEngine.setTransform(center.lng, center.lat, zoom); if (windEngine.rebuildVectorGrid) windEngine.rebuildVectorGrid();
  });

  // 4. 快取 DOM 節點
  const dom = {
    // 頂部狀態與重新整理
    btnRefresh: document.getElementById('btnRefresh'),
    liveDot: document.getElementById('liveDot'),
    liveStatusText: document.getElementById('liveStatusText'),
    lastUpdatedText: document.getElementById('lastUpdatedText'),

    // CWA 風場圖控制列與測站標籤
    mapWindSummary: document.getElementById('mapWindSummary'),
    btnPinTaipei: document.getElementById('btnPinTaipei'),
    btnPinTaichung: document.getElementById('btnPinTaichung'),
    btnPinKaohsiung: document.getElementById('btnPinKaohsiung'),
    btnMoreStationToggle: document.getElementById('btnMoreStationToggle'),
    moreStationDropdownMenu: document.getElementById('moreStationDropdownMenu'),
    btnResetToThree: document.getElementById('btnResetToThree'),

    // 地圖與視圖
    mapFrame: document.getElementById('mapFrame'),
    weatherOverlay: document.getElementById('weatherOverlay'),
    layerSelectorGrid: document.getElementById('layerSelectorGrid'),
    currentLayerHint: document.getElementById('currentLayerHint'),
    scaleUnit: document.getElementById('scaleUnit'),
    scaleBlocksWrap: document.getElementById('scaleBlocksWrap'),

    // 一週天氣預報
    forecastStationName: document.getElementById('forecastStationName'),
    forecastDaysGrid: document.getElementById('forecastDaysGrid'),

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
    sidebarTemp: document.getElementById('sidebarTemp'),
    sidebarGustSpeed: document.getElementById('sidebarGustSpeed'),
    sidebarHumidity: document.getElementById('sidebarHumidity'),
    sidebarPressure: document.getElementById('sidebarPressure'),
    sidebarRain: document.getElementById('sidebarRain')
  };

  /**
   * 渲染色階圖例標尺
   */
  function renderColorScale(layerId) {
    const layer = window.WEATHER_LAYERS[layerId] || window.WEATHER_LAYERS.wind;
    if (!dom.scaleBlocksWrap) return;

    dom.scaleUnit.textContent = layer.unit;
    if (dom.currentLayerHint) {
      dom.currentLayerHint.textContent = `目前：${layer.name}`;
    }

    let html = '';
    for (let i = 0; i < layer.stops.length; i++) {
      const stopVal = layer.stops[i];
      const color = layer.colors[i];
      html += `
        <div class="scale-block" style="background-color: ${color};">
          <span class="scale-stop-label">${stopVal}</span>
        </div>
      `;
    }
    dom.scaleBlocksWrap.innerHTML = html;

    if (dom.weatherOverlay) {
      dom.weatherOverlay.style.background = layer.overlayGradient || 'transparent';
      dom.weatherOverlay.style.opacity = layerId === 'wind' ? '0.35' : '0.65';
    }
  }

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
      case 'radar':
        return st.rain > 0 ? `${Math.min(55, Math.round(st.rain * 12 + 25))} dBZ` : '15 dBZ';
      case 'temp':
        return `${st.temp.toFixed(1)}°C`;
      case 'wind':
        return `${st.windSpeed.toFixed(1)}m/s`;
      case 'accumRain':
        return `${st.rain.toFixed(1)}mm`;
      default:
        return `${st.windSpeed.toFixed(1)}m/s`;
    }
  }

  /**
   * 建立 Google 經典紅色水滴 Drop-Pin HTML
   */
  function createPinHtml(st, isActive) {
    const layerText = getLayerValueForStation(st, activeLayer);
    return `
      <div class="g-pin-node ${isActive ? 'active' : ''}">
        <div class="g-pin-label">
          <span class="label-station">${st.name}</span>
          <span class="label-wind-arrow" style="transform: rotate(${(st.windDeg + 180) % 360}deg);">
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
      </div>
    `;
  }

  /**
   * 建立 Google Maps InfoWindow 氣泡窗 HTML
   */
  function createPopupHtml(st) {
    const dirInfo = window.getWindDirectionText(st.windDeg);
    const feelsLike = calculateFeelsLike(st.temp, st.hum, st.windSpeed);

    return `
      <div class="leaflet-custom-popup">
        <div class="info-header">
          <div>
            <span class="info-county">${st.county}</span>
            <h4 class="info-title">${st.name}氣象站</h4>
          </div>
        </div>
        <div class="info-body">
          <div class="info-temp-row">
            <span class="info-temp">${st.temp.toFixed(1)}°C</span>
            <span class="info-weather">${getWeatherIcon(st.weather)} ${st.weather}</span>
          </div>
          <div class="info-stats-grid">
            <div class="info-stat">
              <span>風向風速</span>
              <strong>${dirInfo.name} ${st.windSpeed.toFixed(1)}m/s</strong>
            </div>
            <div class="info-stat">
              <span>降雨量</span>
              <strong>${st.rain.toFixed(1)} mm</strong>
            </div>
            <div class="info-stat">
              <span>相對濕度</span>
              <strong>${st.hum}%</strong>
            </div>
            <div class="info-stat">
              <span>體感溫度</span>
              <strong>${feelsLike.toFixed(1)}°C</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染 Leaflet 地圖上的測站標記
   * 依使用者需求：預設只顯示臺北、臺中、高雄，其他點選時動態加入顯示
   */
  function renderMapPins() {
    const stations = window.weatherService.stations;

    stations.forEach(st => {
      const isVisible = visibleStationIds.has(st.id) || st.id === activeStationId;

      if (isVisible) {
        const isActive = st.id === activeStationId;
        const html = createPinHtml(st, isActive);

        const customIcon = L.divIcon({
          html: html,
          className: 'leaflet-custom-marker',
          iconSize: [60, 48],
          iconAnchor: [30, 48],
          popupAnchor: [0, -48]
        });

        if (markersMap.has(st.id)) {
          const marker = markersMap.get(st.id);
          marker.setIcon(customIcon);
          marker.setPopupContent(createPopupHtml(st));
          if (!leafletMap.hasLayer(marker)) {
            marker.addTo(leafletMap);
          }
        } else {
          const marker = L.marker([st.lat, st.lon], { icon: customIcon }).addTo(leafletMap);
          marker.bindPopup(createPopupHtml(st));

          marker.on('click', () => {
            selectStation(st.id, false);
          });

          markersMap.set(st.id, marker);
        }
      } else {
        // 若不屬於顯示名單，從地圖移除圖層
        if (markersMap.has(st.id)) {
          const marker = markersMap.get(st.id);
          if (leafletMap.hasLayer(marker)) {
            leafletMap.removeLayer(marker);
          }
        }
      }
    });

    // 預設若有活躍測站，開啟彈窗
    const activeMarker = markersMap.get(activeStationId);
    if (activeMarker && leafletMap.hasLayer(activeMarker) && !activeMarker.isPopupOpen()) {
      activeMarker.openPopup();
    }
  }

  /**
   * 選取特定測站
   */
  function selectStation(stationId, panTo = true) {
    activeStationId = stationId;
    visibleStationIds.add(stationId); // 確保選中的測站顯示水滴標籤

    const st = window.weatherService.getStationById(stationId);

    if (panTo && st && leafletMap) {
      leafletMap.flyTo([st.lat, st.lon], Math.max(leafletMap.getZoom(), 8.5), { duration: 0.8 });
    }

    // 更新風場引擎動態參數
    if (st && windEngine) {
      windEngine.setWind(st.windDeg, st.windSpeed);
    }

    renderMapPins();
    renderSidebarPlaceDetails();
    renderWeeklyForecast(stationId);
    updateStationFilterUI();

    const marker = markersMap.get(stationId);
    if (marker && leafletMap.hasLayer(marker)) {
      marker.openPopup();
    }
  }

  /**
   * 渲染地圖正下方的一週天氣預報 (7-Day Forecast)
   */
  function renderWeeklyForecast(stationId) {
    if (!dom.forecastDaysGrid) return;
    const st = window.weatherService.getStationById(stationId);
    if (!st) return;

    if (dom.forecastStationName) {
      dom.forecastStationName.textContent = `${st.name}氣象站`;
    }

    const forecastList = window.weatherService.getWeeklyForecast(stationId);

    let html = '';
    forecastList.forEach(day => {
      const todayClass = day.isToday ? 'today' : '';
      html += `
        <div class="forecast-day-card ${todayClass}" title="${day.dateStr} (${day.dayLabel}) ${day.weather}，降雨機率 ${day.rainProb}%">
          <div class="f-day-label">${day.dayLabel}</div>
          <div class="f-day-date">${day.dateStr}</div>
          <div class="f-weather-icon">${day.icon}</div>
          <div class="f-weather-condition">${day.weather}</div>
          <div class="f-temp-row">
            <span class="f-temp-max">${day.maxT}°</span>
            <span class="f-temp-min">${day.minT}°</span>
          </div>
          <div class="f-temp-bar-container">
            <div class="f-temp-bar-fill"></div>
          </div>
          <div class="f-pop-badge">
            <span>💧</span>
            <span>${day.rainProb}%</span>
          </div>
          <div class="f-wind-text">💨 ${day.windSpeed}m/s</div>
        </div>
      `;
    });

    dom.forecastDaysGrid.innerHTML = html;
  }

  /**
   * 更新測站選擇標籤列的選取狀態
   */
  function updateStationFilterUI() {
    // 1. 北中高按鈕選取樣式
    if (dom.btnPinTaipei) dom.btnPinTaipei.classList.toggle('active', activeStationId === '466920');
    if (dom.btnPinTaichung) dom.btnPinTaichung.classList.toggle('active', activeStationId === '467490');
    if (dom.btnPinKaohsiung) dom.btnPinKaohsiung.classList.toggle('active', activeStationId === '467440');

    // 2. 下拉選單項目的選取樣式
    if (dom.moreStationDropdownMenu) {
      dom.moreStationDropdownMenu.querySelectorAll('.more-station-item').forEach(item => {
        const id = item.dataset.id;
        const isSelected = activeStationId === id;
        item.classList.toggle('active', isSelected);
      });
    }

    // 3. 若有顯示除了臺北、臺中、高雄以外的測站，顯示「僅保留北中高」按鈕
    const hasExtraStations = Array.from(visibleStationIds).some(id => !BASE_STATION_IDS.includes(id));
    if (dom.btnResetToThree) {
      dom.btnResetToThree.style.display = hasExtraStations ? 'inline-block' : 'none';
    }

    // 4. 更新地圖標題列風場摘要
    const st = window.weatherService.getStationById(activeStationId);
    if (st && dom.mapWindSummary) {
      const dir = window.getWindDirectionText(st.windDeg);
      dom.mapWindSummary.textContent = `${st.name}即時風場：${dir.name} (${st.windDeg}°) • 風速 ${st.windSpeed.toFixed(1)} m/s`;
    }
  }

  /**
   * 初始化測站標籤列與下拉選單
   */
  function initStationFilterUI() {
    // 綁定臺北、臺中、高雄按鈕
    if (dom.btnPinTaipei) {
      dom.btnPinTaipei.addEventListener('click', () => selectStation('466920', true));
    }
    if (dom.btnPinTaichung) {
      dom.btnPinTaichung.addEventListener('click', () => selectStation('467490', true));
    }
    if (dom.btnPinKaohsiung) {
      dom.btnPinKaohsiung.addEventListener('click', () => selectStation('467440', true));
    }

    // 生成其他 19 個縣市測站標籤按鈕
    if (dom.moreStationDropdownMenu) {
      const otherStations = window.weatherService.stations.filter(s => !BASE_STATION_IDS.includes(s.id));
      let menuHtml = '';
      otherStations.forEach(st => {
        menuHtml += `<div class="more-station-item" data-id="${st.id}">📍 ${st.name}</div>`;
      });
      dom.moreStationDropdownMenu.innerHTML = menuHtml;

      // 監聽其他測站點擊
      dom.moreStationDropdownMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.more-station-item');
        if (!item) return;
        const stationId = item.dataset.id;
        visibleStationIds.add(stationId); // 點選加入地圖標籤顯示
        selectStation(stationId, true);
        dom.moreStationDropdownMenu.classList.remove('show');
      });
    }

    // 更多測站按鈕開關
    if (dom.btnMoreStationToggle && dom.moreStationDropdownMenu) {
      dom.btnMoreStationToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.moreStationDropdownMenu.classList.toggle('show');
      });

      document.addEventListener('click', () => {
        dom.moreStationDropdownMenu.classList.remove('show');
      });
    }

    // 點擊「僅保留北中高」按鈕
    if (dom.btnResetToThree) {
      dom.btnResetToThree.addEventListener('click', () => {
        visibleStationIds = new Set(BASE_STATION_IDS);
        if (!BASE_STATION_IDS.includes(activeStationId)) {
          activeStationId = '466920'; // 預設回臺北
        }
        selectStation(activeStationId, false);
      });
    }
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
    if (dom.sidebarStationName) dom.sidebarStationName.textContent = `${st.name}氣象站`;
    if (dom.sidebarCountyName) dom.sidebarCountyName.textContent = `${st.county} · CWA 即時觀測`;
    if (dom.sidebarWeatherIcon) dom.sidebarWeatherIcon.textContent = getWeatherIcon(st.weather);
    if (dom.sidebarWeatherText) dom.sidebarWeatherText.textContent = st.weather;

    // 2. 依當前圖層顯示巨幅主數值
    switch (activeLayer) {
      case 'radar':
        const radarVal = st.rain > 0 ? Math.min(55, Math.round(st.rain * 12 + 25)) : 15;
        if (dom.sidebarMainVal) dom.sidebarMainVal.textContent = radarVal;
        if (dom.sidebarMainUnit) dom.sidebarMainUnit.textContent = 'dBZ';
        if (dom.sidebarSubText) dom.sidebarSubText.textContent = radarVal > 30 ? '雷達回波增強，鄰近空域有較強降雨對流胞' : '雷達回波弱，海峽與陸地空域乾淨良好';
        break;
      case 'temp':
        if (dom.sidebarMainVal) dom.sidebarMainVal.textContent = st.temp.toFixed(1);
        if (dom.sidebarMainUnit) dom.sidebarMainUnit.textContent = '°C';
        if (dom.sidebarSubText) dom.sidebarSubText.textContent = `體感溫度 ${feelsLike.toFixed(1)}°C • 相對濕度 ${st.hum}%`;
        break;
      case 'wind':
        if (dom.sidebarMainVal) dom.sidebarMainVal.textContent = st.windSpeed.toFixed(1);
        if (dom.sidebarMainUnit) dom.sidebarMainUnit.textContent = 'm/s';
        if (dom.sidebarSubText) dom.sidebarSubText.textContent = `${beaufort.scale} • ${dirInfo.name} (${st.windDeg}°)`;
        break;
      case 'accumRain':
        if (dom.sidebarMainVal) dom.sidebarMainVal.textContent = st.rain.toFixed(1);
        if (dom.sidebarMainUnit) dom.sidebarMainUnit.textContent = 'mm';
        if (dom.sidebarSubText) dom.sidebarSubText.textContent = st.rain > 0 ? `目前有降雨 (${st.weather})` : '本日累積雨量為零，氣候乾燥穩定';
        break;
    }

    // 3. 360° 羅盤與風杯連動
    if (dom.sidebarBeaufortBadge) dom.sidebarBeaufortBadge.textContent = beaufort.scale;
    if (dom.sidebarWindDir) dom.sidebarWindDir.textContent = `${dirInfo.name} (${st.windDeg}°)`;
    if (dom.sidebarWindSpeed) dom.sidebarWindSpeed.textContent = `${st.windSpeed.toFixed(1)} m/s`;

    if (dom.compassNeedle) {
      dom.compassNeedle.style.transform = `translate(-50%, -50%) rotate(${st.windDeg}deg)`;
    }

    if (dom.anemometerRotor) {
      const duration = Math.max(0.3, Math.min(2.5, 4.0 / (st.windSpeed + 0.5)));
      dom.anemometerRotor.style.animationDuration = `${duration.toFixed(2)}s`;
    }

    // 4. 詳細清單數值
    if (dom.sidebarAddress) dom.sidebarAddress.textContent = `${st.lat.toFixed(2)}°N, ${st.lon.toFixed(2)}°E • ${st.address || st.county}`;
    if (dom.sidebarTemp) dom.sidebarTemp.textContent = `${st.temp.toFixed(1)}°C (體感 ${feelsLike.toFixed(1)}°C)`;
    if (dom.sidebarGustSpeed) dom.sidebarGustSpeed.textContent = `${st.windSpeed.toFixed(1)} m/s (${(st.windSpeed * 3.6).toFixed(1)} km/h) • 瞬間陣風 ${st.gust.toFixed(1)} m/s`;
    if (dom.sidebarHumidity) dom.sidebarHumidity.textContent = `${st.hum}% (${st.hum > 75 ? '偏潮濕' : '舒適乾燥'})`;
    if (dom.sidebarPressure) dom.sidebarPressure.textContent = `${st.pres.toFixed(1)} hPa`;
    if (dom.sidebarRain) dom.sidebarRain.textContent = `${st.rain.toFixed(1)} mm ${st.rain > 0 ? '(有降雨)' : '(無降雨)'}`;
  }

  /**
   * 地圖縮放與平移變換
   */
  function zoomIn() {
    if (leafletMap) leafletMap.zoomIn();
  }

  function zoomOut() {
    if (leafletMap) leafletMap.zoomOut();
  }

  function resetView() {
    if (leafletMap) {
      leafletMap.flyTo([23.7, 120.95], 8, { duration: 1.0 });
    }
  }

  /**
   * CWA API 重新擷取
   */
  async function refreshData() {
    if (dom.btnRefresh) {
      dom.btnRefresh.classList.add('spinning');
      dom.btnRefresh.disabled = true;
    }

    try {
      const res = await window.weatherService.fetchLiveStations();
      if (res.isLive) {
        if (dom.liveDot) dom.liveDot.style.backgroundColor = 'var(--g-green)';
        if (dom.liveStatusText) dom.liveStatusText.textContent = '即時連線 (CWA)';
      } else {
        if (dom.liveDot) dom.liveDot.style.backgroundColor = 'var(--g-yellow)';
        if (dom.liveStatusText) dom.liveStatusText.textContent = '快取備用模式';
      }

      if (dom.lastUpdatedText) {
        dom.lastUpdatedText.textContent = `更新: ${formatTime(window.weatherService.lastUpdated)}`;
      }

      renderMapPins();
      renderSidebarPlaceDetails();
      renderWeeklyForecast(activeStationId);
      updateStationFilterUI();
    } catch (err) {
      console.error('更新失敗:', err);
    } finally {
      setTimeout(() => {
        if (dom.btnRefresh) {
          dom.btnRefresh.classList.remove('spinning');
          dom.btnRefresh.disabled = false;
        }
      }, 600);
    }
  }

  // =========================================================================
  // 事件監聽綁定
  // =========================================================================

  // 1. 4 大圖層切換 (氣象雷達, 溫度, 風速, 累積雨量)
  if (dom.layerSelectorGrid) {
    dom.layerSelectorGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.layer-btn-item');
      if (!btn) return;
      dom.layerSelectorGrid.querySelectorAll('.layer-btn-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLayer = btn.dataset.layer;
      renderColorScale(activeLayer);
      renderMapPins();
      renderSidebarPlaceDetails();
    });
  }

  // 2. 地圖縮放與復位
  if (dom.btnZoomIn) dom.btnZoomIn.addEventListener('click', zoomIn);
  if (dom.btnZoomOut) dom.btnZoomOut.addEventListener('click', zoomOut);
  if (dom.btnRecenter) dom.btnRecenter.addEventListener('click', resetView);

  // 3. 手動刷新按鈕
  if (dom.btnRefresh) dom.btnRefresh.addEventListener('click', refreshData);
  if (dom.btnQuickRefresh) dom.btnQuickRefresh.addEventListener('click', refreshData);

  // 4. 複製分享數據
  if (dom.btnCopyData) {
    dom.btnCopyData.addEventListener('click', () => {
      const st = window.weatherService.getStationById(activeStationId);
      if (!st) return;
      const text = `【臺灣即時氣象】${st.county} · ${st.name}氣象站：氣溫 ${st.temp}°C，${st.weather}，風向 ${window.getWindDirectionText(st.windDeg).name} ${st.windSpeed}m/s，降雨量 ${st.rain}mm。`;
      navigator.clipboard.writeText(text).then(() => {
        alert('已成功複製測站氣象資訊至剪貼簿！');
      }).catch(() => {
        prompt('請複製以下文字：', text);
      });
    });
  }

  // =========================================================================
  // 初始啟動
  // =========================================================================
  if (dom.lastUpdatedText) {
    dom.lastUpdatedText.textContent = `更新: ${formatTime(new Date())}`;
  }
  
  initStationFilterUI();
  renderColorScale(activeLayer);
  renderMapPins();
  renderSidebarPlaceDetails();
  renderWeeklyForecast(activeStationId);
  updateStationFilterUI();

  // 確保 Leaflet 容器尺寸正確運算
  setTimeout(() => {
    if (leafletMap) {
      leafletMap.invalidateSize();
    }
  }, 250);

  // 背景自動與 CWA API 同步
  refreshData();
  setInterval(refreshData, 5 * 60 * 1000);
});
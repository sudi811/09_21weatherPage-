/**
 * Main Application Controller - Google Maps Weather Edition
 * Features: 70% real-scale Taiwan map, Windy particle animation,
 * 4 core layers (氣象雷達, 溫度, 風速, 累積雨量), mouse wheel & drag zoom/pan,
 * InfoWindows, and 360° compass.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化底層動態氣流粒子模擬引擎 (Windy.com style)
  const windEngine = new WindyParticleEngine('windCanvas');
  window.windEngine = windEngine;

  // 2. 應用狀態管理
  let activeStationId = '466920'; // 預設：臺北
  let activeLayer = 'wind';        // 預設為使用者要求的風速 'wind' | 'radar' | 'temp' | 'accumRain'
  let activeRegion = 'all';

  // 3. 初始化開源 GIS 框架 Leaflet 地圖 (臺灣真實地理比例居中)
  // 臺灣中心大約 [23.7, 120.95]，縮放層級 7.8 ~ 8.0 完美填滿 70% 視圖
  const leafletMap = L.map('leafletMap', {
    center: [23.7, 120.95],
    zoom: 8,
    minZoom: 6,
    maxZoom: 14,
    zoomControl: false, // 使用自訂 Google 風格浮動按鈕
    attributionControl: true
  });
  window.leafletMap = leafletMap;

  // 採用 Google Maps / CartoDB 高質感大地灰與清新海洋底圖 (亦可切換 OpenStreetMap)
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
    windEngine.setTransform(center.lng, center.lat, zoom);
  });

  // 4. 快取 DOM 節點
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
    weatherOverlay: document.getElementById('weatherOverlay'),
    layerSelectorGrid: document.getElementById('layerSelectorGrid'),
    currentLayerHint: document.getElementById('currentLayerHint'),
    scaleUnit: document.getElementById('scaleUnit'),
    scaleBlocksWrap: document.getElementById('scaleBlocksWrap'),

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
   * 渲染色階圖例標尺
   */
  function renderColorScale(layerId) {
    const layer = window.WEATHER_LAYERS[layerId] || window.WEATHER_LAYERS.wind;
    dom.scaleUnit.textContent = layer.unit;
    dom.currentLayerHint.textContent = `目前：${layer.name}`;

    dom.scaleBlocksWrap.innerHTML = '';
    layer.stops.forEach((stop, idx) => {
      const seg = document.createElement('div');
      seg.className = 'scale-block-seg';
      seg.style.backgroundColor = layer.colors[idx];
      seg.innerHTML = `<span class="scale-block-label">${stop}</span>`;
      dom.scaleBlocksWrap.appendChild(seg);
    });

    // 更新大氣疊層色彩
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
   * 渲染 Leaflet 地圖上的所有測站標記
   */
  function renderMapPins() {
    const stations = window.weatherService.stations;

    stations.forEach(st => {
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
      } else {
        const marker = L.marker([st.lat, st.lon], { icon: customIcon }).addTo(leafletMap);
        marker.bindPopup(createPopupHtml(st));

        marker.on('click', () => {
          selectStation(st.id, false);
        });

        markersMap.set(st.id, marker);
      }
    });

    // 預設若有活躍測站，開啟彈窗
    const activeMarker = markersMap.get(activeStationId);
    if (activeMarker && !activeMarker.isPopupOpen()) {
      activeMarker.openPopup();
    }
  }

  function selectStation(stationId, panTo = true) {
    activeStationId = stationId;
    const st = window.weatherService.getStationById(stationId);

    if (panTo && st && leafletMap) {
      leafletMap.flyTo([st.lat, st.lon], Math.max(leafletMap.getZoom(), 9), { duration: 0.8 });
    }

    renderMapPins();
    renderSidebarPlaceDetails();

    const marker = markersMap.get(stationId);
    if (marker) {
      marker.openPopup();
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
    dom.sidebarStationName.textContent = `${st.name}氣象站`;
    dom.sidebarCountyName.textContent = `${st.county} · 即時觀測`;
    dom.sidebarWeatherIcon.textContent = getWeatherIcon(st.weather);
    dom.sidebarWeatherText.textContent = st.weather;

    // 2. 依當前圖層顯示巨幅主數值
    switch (activeLayer) {
      case 'radar':
        const radarVal = st.rain > 0 ? Math.min(55, Math.round(st.rain * 12 + 25)) : 15;
        dom.sidebarMainVal.textContent = radarVal;
        dom.sidebarMainUnit.textContent = 'dBZ';
        dom.sidebarSubText.textContent = radarVal > 30 ? '雷達回波增強，鄰近空域有較強降雨對流胞' : '雷達回波弱，海峽與陸地空域乾淨良好';
        break;
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
      case 'accumRain':
        dom.sidebarMainVal.textContent = st.rain.toFixed(1);
        dom.sidebarMainUnit.textContent = 'mm';
        dom.sidebarSubText.textContent = st.rain > 0 ? `本日累積降雨量 ${st.rain}mm` : '本日尚無降雨記錄，天空乾爽';
        break;
      default:
        dom.sidebarMainVal.textContent = st.windSpeed.toFixed(1);
        dom.sidebarMainUnit.textContent = 'm/s';
        dom.sidebarSubText.textContent = `${dirInfo.name} (${st.windDeg}°)`;
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

    // 4. 同步更新底層 Windy 動態風場流線粒子流向與速度
    windEngine.setWind(st.windDeg, st.windSpeed);

    // 5. 詳細項目清單
    dom.sidebarAddress.textContent = `${st.lat ? st.lat.toFixed(2) : '25.04'}°N, ${st.lon ? st.lon.toFixed(2) : '121.51'}°E • ${st.address || st.county}`;
    dom.sidebarGustSpeed.textContent = `${st.windSpeed.toFixed(1)} m/s (${(st.windSpeed * 3.6).toFixed(1)} km/h) • 瞬間最大陣風 ${st.gust.toFixed(1)} m/s`;
    dom.sidebarHumidity.textContent = `${st.hum}% (${st.hum > 75 ? '微潮濕' : '舒適乾燥'})`;
    dom.sidebarPressure.textContent = `${st.pres.toFixed(1)} hPa`;
    dom.sidebarRain.textContent = `${st.rain.toFixed(1)} mm (${st.rain > 0 ? '有降雨' : '目前無降雨'})`;
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
      selectStation(matched.id, true);
    } else {
      alert(`找不到與「${query}」相符的測站，請嘗試搜尋其他縣市名稱。`);
    }
  }

  // =========================================================================
  // 事件監聽綁定
  // =========================================================================

  // 1. 使用者指定的 4 大圖層切換 (氣象雷達, 溫度, 風速, 累積雨量)
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

  // 2. 搜尋相關
  dom.btnSearchSubmit.addEventListener('click', executeSearch);
  dom.gmapSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeSearch();
  });

  // 3. 地圖縮放與復位
  dom.btnZoomIn.addEventListener('click', zoomIn);
  dom.btnZoomOut.addEventListener('click', zoomOut);
  dom.btnRecenter.addEventListener('click', resetView);

  // 4. 手動刷新按鈕
  dom.btnRefresh.addEventListener('click', refreshData);
  dom.btnQuickRefresh.addEventListener('click', refreshData);

  // 5. 複製分享數據
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

  // =========================================================================
  // 初始啟動
  // =========================================================================
  dom.lastUpdatedText.textContent = `更新: ${formatTime(new Date())}`;
  renderColorScale(activeLayer);
  renderMapPins();
  renderSidebarPlaceDetails();

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

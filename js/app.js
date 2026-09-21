/**
 * Main Application Logic
 * Integrates WeatherService, WindCanvasEngine, UI bindings,
 * interactive station switching, search filtering, and live refresh.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化風場粒子繪圖引擎
  const windEngine = new WindCanvasEngine('windCanvas');
  window.windEngine = windEngine;

  // 2. 狀態管理
  let activeStationId = '466920'; // 預設：臺北
  let currentRegion = 'all';
  let searchQuery = '';

  // 3. 快取常用 DOM 節點
  const dom = {
    // 頂部狀態與操作
    apiStatusBadge: document.getElementById('apiStatusBadge'),
    apiStatusText: document.getElementById('apiStatusText'),
    lastUpdatedText: document.getElementById('lastUpdatedText'),
    btnRefresh: document.getElementById('btnRefresh'),

    // 焦點測站氣候卡片
    currentStationName: document.getElementById('currentStationName'),
    currentCountyName: document.getElementById('currentCountyName'),
    weatherIcon: document.getElementById('weatherIcon'),
    weatherDesc: document.getElementById('weatherDesc'),
    currentTemp: document.getElementById('currentTemp'),
    feelsLikeTemp: document.getElementById('feelsLikeTemp'),
    windChillDesc: document.getElementById('windChillDesc'),
    stationCoords: document.getElementById('stationCoords'),

    // 次要指標
    metricWindSpeed: document.getElementById('metricWindSpeed'),
    metricWindSpeedKmh: document.getElementById('metricWindSpeedKmh'),
    metricGustSpeed: document.getElementById('metricGustSpeed'),
    metricGustLevel: document.getElementById('metricGustLevel'),
    metricHumidity: document.getElementById('metricHumidity'),
    metricPressure: document.getElementById('metricPressure'),
    metricRain: document.getElementById('metricRain'),
    metricRainDesc: document.getElementById('metricRainDesc'),
    metricBeaufort: document.getElementById('metricBeaufort'),
    metricBeaufortName: document.getElementById('metricBeaufortName'),

    // 風向羅盤與旋轉風杯
    compassNeedle: document.getElementById('compassNeedle'),
    anemometerRotor: document.getElementById('anemometerRotor'),
    compassCenterSpeed: document.getElementById('compassCenterSpeed'),
    windScaleBadge: document.getElementById('windScaleBadge'),
    readoutDirection: document.getElementById('readoutDirection'),
    readoutSpeedText: document.getElementById('readoutSpeedText'),
    readoutFlowStatus: document.getElementById('readoutFlowStatus'),

    // 測站列表與篩選
    regionTabs: document.getElementById('regionTabs'),
    searchInput: document.getElementById('searchInput'),
    stationsGrid: document.getElementById('stationsGrid')
  };

  /**
   * 計算體感溫度 (Apparent Temperature, 澳洲氣象局簡化公式)
   */
  function calculateFeelsLike(temp, hum, windSpeed) {
    const e = (hum / 100) * 6.105 * Math.exp((17.27 * temp) / (237.7 + temp));
    const feelsLike = temp + 0.33 * e - 0.7 * windSpeed - 4.0;
    return Math.round(feelsLike * 10) / 10;
  }

  /**
   * 依天氣描述對應 Emoji 圖示
   */
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

  /**
   * 格式化更新時間
   */
  function formatUpdateTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  }

  /**
   * 渲染焦點測站詳細資料與羅盤動態
   */
  function renderActiveStation() {
    const station = window.weatherService.getStationById(activeStationId);
    if (!station) return;

    // 基本資訊
    dom.currentStationName.textContent = station.name;
    dom.currentCountyName.textContent = station.county;
    dom.currentTemp.textContent = station.temp.toFixed(1);
    dom.weatherIcon.textContent = getWeatherIcon(station.weather);
    dom.weatherDesc.textContent = station.weather;
    dom.stationCoords.textContent = `${station.lat.toFixed(2)}°N, ${station.lon.toFixed(2)}°E`;

    // 體感溫度
    const feelsLike = calculateFeelsLike(station.temp, station.hum, station.windSpeed);
    dom.feelsLikeTemp.textContent = `${feelsLike.toFixed(1)}°C`;

    // 風力等級與描述
    const dirInfo = window.getWindDirectionText(station.windDeg);
    const beaufort = window.getBeaufortScale(station.windSpeed);
    const gustBeaufort = window.getBeaufortScale(station.gust);

    dom.windChillDesc.textContent = `${beaufort.level} · ${beaufort.desc.split('，')[0]}`;

    // 6 大指標
    dom.metricWindSpeed.innerHTML = `${station.windSpeed.toFixed(1)} <small style="font-size: 0.8rem; font-weight: normal;">m/s</small>`;
    dom.metricWindSpeedKmh.textContent = `${(station.windSpeed * 3.6).toFixed(1)} km/h`;

    dom.metricGustSpeed.innerHTML = `${station.gust.toFixed(1)} <small style="font-size: 0.8rem; font-weight: normal;">m/s</small>`;
    dom.metricGustLevel.textContent = `${gustBeaufort.scale}級陣風 (${gustBeaufort.level})`;

    dom.metricHumidity.textContent = `${station.hum}%`;
    dom.metricPressure.innerHTML = `${station.pres.toFixed(1)} <small style="font-size: 0.75rem; font-weight: normal;">hPa</small>`;
    dom.metricRain.innerHTML = `${station.rain.toFixed(1)} <small style="font-size: 0.8rem; font-weight: normal;">mm</small>`;
    dom.metricRainDesc.textContent = station.rain > 0 ? `累積雨量 ${station.rain}mm` : '目前無降雨';

    dom.metricBeaufort.textContent = `${beaufort.scale} 級`;
    dom.metricBeaufortName.textContent = `${beaufort.level} (${beaufort.desc.split('，')[0]})`;

    // =========================================================================
    // 羅盤與風杯即時動態更新
    // =========================================================================
    // 1. 旋轉羅盤指針至真實風向角
    dom.compassNeedle.style.transform = `rotate(${station.windDeg}deg)`;

    // 2. 羅盤風杯旋轉速度與真實風速動態綁定 (風速愈快，旋轉週期愈短)
    // 週期公式：baseDuration = 6 / max(0.4, speed) 秒
    const spinDuration = Math.max(0.2, 5.0 / Math.max(station.windSpeed, 0.5));
    dom.anemometerRotor.style.animationDuration = `${spinDuration.toFixed(2)}s`;
    dom.compassCenterSpeed.textContent = station.windSpeed.toFixed(1);

    // 3. 羅盤徽章與文字
    dom.windScaleBadge.textContent = `${beaufort.scale}級 ${beaufort.level}`;
    dom.windScaleBadge.style.backgroundColor = beaufort.color;
    dom.windScaleBadge.style.boxShadow = `0 0 14px ${beaufort.color}66`;

    dom.readoutDirection.textContent = `${dirInfo.name} (${station.windDeg}°)`;
    dom.readoutSpeedText.textContent = `${station.windSpeed.toFixed(1)} m/s (${(station.windSpeed * 3.6).toFixed(1)} km/h)`;

    if (station.windSpeed < 2.0) {
      dom.readoutFlowStatus.textContent = '微弱微風';
      dom.readoutFlowStatus.style.color = '#38bdf8';
    } else if (station.windSpeed < 8.0) {
      dom.readoutFlowStatus.textContent = '氣流順暢';
      dom.readoutFlowStatus.style.color = '#10b981';
    } else {
      dom.readoutFlowStatus.textContent = '強勁氣流';
      dom.readoutFlowStatus.style.color = '#f59e0b';
    }

    // 4. 同步更新背景 Canvas 2D 風場粒子流向與流速
    windEngine.setWind(station.windDeg, station.windSpeed);
  }

  /**
   * 渲染下方全臺觀測站卡片網格
   */
  function renderStationsGrid() {
    dom.stationsGrid.innerHTML = '';

    // 取得符合當前分區的測站
    let filtered = window.weatherService.getStationsByRegion(currentRegion);

    // 搜尋關鍵字過濾
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.county.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      dom.stationsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          找不到名稱符合「${searchQuery}」的觀測站
        </div>
      `;
      return;
    }

    filtered.forEach(st => {
      const card = document.createElement('div');
      card.className = `station-card ${st.id === activeStationId ? 'active' : ''}`;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `選擇 ${st.county} ${st.name} 觀測站`);

      const dirInfo = window.getWindDirectionText(st.windDeg);

      card.innerHTML = `
        <div class="card-top">
          <span class="card-station-name">${st.name}</span>
          <span class="card-county">${st.county}</span>
        </div>
        <div class="card-middle">
          <span class="card-temp">${st.temp.toFixed(1)}<small style="font-size: 1rem; color: var(--accent-cyan);">°C</small></span>
          <span class="card-weather">${getWeatherIcon(st.weather)} ${st.weather}</span>
        </div>
        <div class="card-bottom">
          <div class="card-wind-info">
            <span class="card-wind-arrow" style="transform: rotate(${st.windDeg}deg);" title="風向: ${st.windDeg}°">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
              </svg>
            </span>
            <span>${dirInfo.name}</span>
          </div>
          <span style="font-weight: 600; color: var(--text-primary);">${st.windSpeed.toFixed(1)} m/s</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (activeStationId !== st.id) {
          activeStationId = st.id;
          renderActiveStation();
          updateCardSelection();
        }
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activeStationId = st.id;
          renderActiveStation();
          updateCardSelection();
        }
      });

      dom.stationsGrid.appendChild(card);
    });
  }

  function updateCardSelection() {
    const allCards = dom.stationsGrid.querySelectorAll('.station-card');
    const filtered = window.weatherService.getStationsByRegion(currentRegion);
    allCards.forEach((c, idx) => {
      if (filtered[idx] && filtered[idx].id === activeStationId) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  /**
   * 執行數據更新 (呼叫 CWA API)
   */
  async function refreshData() {
    dom.btnRefresh.classList.add('spinning');
    dom.btnRefresh.disabled = true;

    try {
      const res = await window.weatherService.fetchLiveStations();
      
      if (res.isLive) {
        dom.apiStatusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
        dom.apiStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        dom.apiStatusBadge.querySelector('.pulse-dot').style.backgroundColor = '#34d399';
        dom.apiStatusText.textContent = '即時同步中 (CWA)';
      } else {
        dom.apiStatusBadge.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
        dom.apiStatusBadge.style.borderColor = 'rgba(56, 189, 248, 0.3)';
        dom.apiStatusBadge.querySelector('.pulse-dot').style.backgroundColor = '#38bdf8';
        dom.apiStatusText.textContent = '快取備用模式';
      }

      dom.lastUpdatedText.textContent = `更新時間: ${formatUpdateTime(window.weatherService.lastUpdated)}`;
      renderActiveStation();
      renderStationsGrid();
    } catch (err) {
      console.error('更新失敗:', err);
    } finally {
      setTimeout(() => {
        dom.btnRefresh.classList.remove('spinning');
        dom.btnRefresh.disabled = false;
      }, 600);
    }
  }

  // =========================================================================
  // 事件監聽與綁定
  // =========================================================================
  // 手動點擊刷新按鈕
  dom.btnRefresh.addEventListener('click', () => {
    refreshData();
  });

  // 分區切換
  dom.regionTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.region-tab');
    if (!tab) return;
    dom.regionTabs.querySelectorAll('.region-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentRegion = tab.dataset.region;
    renderStationsGrid();
  });

  // 搜尋框即時過濾
  dom.searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderStationsGrid();
  });

  // =========================================================================
  // 初始啟動
  // =========================================================================
  dom.lastUpdatedText.textContent = `更新時間: ${formatUpdateTime(new Date())}`;
  renderActiveStation();
  renderStationsGrid();

  // 自動在背景嘗試連接氣象署 API
  refreshData();

  // 每 5 分鐘自動刷新一次數據
  setInterval(refreshData, 5 * 60 * 1000);
});

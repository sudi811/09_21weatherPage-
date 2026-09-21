/**
 * Weather Data Manager
 * Handles API fetching from Taiwan Central Weather Administration (CWA),
 * station mapping across all 22 counties, compass direction conversions,
 * Beaufort wind scale calculations, and robust offline fallback data.
 */

const CWA_CONFIG = {
  API_KEY: 'CWA-6FC44933-6473-4341-8216-9BA08D3BBD79',
  STATION_API_URL: 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001',
  FORECAST_API_URL: 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001'
};

// 16 羅盤方位對照表
const COMPASS_DIRECTIONS = [
  { name: '北風', en: 'N', min: 348.75, max: 360 },
  { name: '北風', en: 'N', min: 0, max: 11.25 },
  { name: '北北東風', en: 'NNE', min: 11.25, max: 33.75 },
  { name: '東北風', en: 'NE', min: 33.75, max: 56.25 },
  { name: '東北東風', en: 'ENE', min: 56.25, max: 78.75 },
  { name: '東風', en: 'E', min: 78.75, max: 101.25 },
  { name: '東南東風', en: 'ESE', min: 101.25, max: 123.75 },
  { name: '東南風', en: 'SE', min: 123.75, max: 146.25 },
  { name: '南南東風', en: 'SSE', min: 146.25, max: 168.75 },
  { name: '南風', en: 'S', min: 168.75, max: 191.25 },
  { name: '南南西風', en: 'SSW', min: 191.25, max: 213.75 },
  { name: '西南風', en: 'SW', min: 213.75, max: 236.25 },
  { name: '西南西風', en: 'WSW', min: 236.25, max: 258.75 },
  { name: '西風', en: 'W', min: 258.75, max: 281.25 },
  { name: '西北西風', en: 'WNW', min: 281.25, max: 303.75 },
  { name: '西北風', en: 'NW', min: 303.75, max: 326.25 },
  { name: '北北西風', en: 'NNW', min: 326.25, max: 348.75 }
];

/**
 * 將角度 (0~360) 轉換為 16 方位名稱
 */
function getWindDirectionText(deg) {
  if (deg === null || deg === undefined || deg < 0 || isNaN(deg)) {
    return { name: '微弱風/靜風', en: 'CALM', code: 'CALM' };
  }
  const normalized = ((deg % 360) + 360) % 360;
  for (const dir of COMPASS_DIRECTIONS) {
    if (normalized >= dir.min && normalized < dir.max) {
      return dir;
    }
  }
  return { name: '北風', en: 'N', code: 'N' };
}

/**
 * 依風速 (m/s) 計算蒲福氏風級 (Beaufort Scale 0~12)
 */
function getBeaufortScale(speedMs) {
  if (speedMs < 0.3) return { scale: 0, level: '無風', desc: '煙直上，樹葉不動', color: '#94a3b8' };
  if (speedMs < 1.6) return { scale: 1, level: '軟風', desc: '煙能表示風向，樹葉不搖', color: '#38bdf8' };
  if (speedMs < 3.4) return { scale: 2, level: '輕風', desc: '臉上感覺有風，樹葉微動', color: '#06b6d4' };
  if (speedMs < 5.5) return { scale: 3, level: '微風', desc: '樹葉搖動，旗子展開', color: '#10b981' };
  if (speedMs < 8.0) return { scale: 4, level: '和風', desc: '吹起塵土紙片，小樹枝搖動', color: '#22c55e' };
  if (speedMs < 10.8) return { scale: 5, level: '清風', desc: '小樹搖擺，水面起小波', color: '#eab308' };
  if (speedMs < 13.9) return { scale: 6, level: '強風', desc: '大樹枝搖動，電線呼呼作響', color: '#f97316' };
  if (speedMs < 17.2) return { scale: 7, level: '疾風', desc: '全樹搖動，迎風步行感阻力', color: '#ef4444' };
  if (speedMs < 20.8) return { scale: 8, level: '大風', desc: '折毀小樹枝，人行前進困難', color: '#dc2626' };
  if (speedMs < 24.5) return { scale: 9, level: '烈風', desc: '煙囪及平房瓦片損毀', color: '#b91c1c' };
  if (speedMs < 28.5) return { scale: 10, level: '狂風', desc: '陸上少見，拔樹倒屋', color: '#7f1d1d' };
  if (speedMs < 32.7) return { scale: 11, level: '暴風', desc: '陸上極少見，損毀嚴重', color: '#581c87' };
  return { scale: 12, level: '颶風', desc: '陸上絕少見，破壞力極大', color: '#3b0764' };
}

/**
 * 全臺 22 縣市代表性測站配置與即時備份數據
 */
const TAIWAN_STATIONS = [
  // 北部
  { id: '466920', name: '臺北', county: '臺北市', region: 'north', lat: 25.037, lon: 121.514, temp: 26.8, windDeg: 65, windSpeed: 3.2, gust: 5.8, hum: 74, pres: 1011.2, rain: 0.0, weather: '晴時多雲' },
  { id: '466940', name: '基隆', county: '基隆市', region: 'north', lat: 25.133, lon: 121.740, temp: 25.4, windDeg: 45, windSpeed: 4.8, gust: 7.5, hum: 82, pres: 1012.0, rain: 0.5, weather: '陰短暫雨' },
  { id: '466880', name: '板橋', county: '新北市', region: 'north', lat: 24.997, lon: 121.442, temp: 26.5, windDeg: 70, windSpeed: 2.8, gust: 5.1, hum: 76, pres: 1011.0, rain: 0.0, weather: '多雲' },
  { id: 'C0C480', name: '桃園', county: '桃園市', region: 'north', lat: 24.993, lon: 121.300, temp: 26.2, windDeg: 55, windSpeed: 3.5, gust: 6.2, hum: 75, pres: 1011.5, rain: 0.0, weather: '晴時多雲' },
  { id: '467571', name: '新竹', county: '新竹市', region: 'north', lat: 24.827, lon: 120.927, temp: 25.9, windDeg: 35, windSpeed: 5.2, gust: 8.4, hum: 78, pres: 1011.8, rain: 0.0, weather: '多雲時晴' },
  { id: 'C0D570', name: '竹北', county: '新竹縣', region: 'north', lat: 24.838, lon: 121.010, temp: 25.7, windDeg: 40, windSpeed: 4.6, gust: 7.9, hum: 77, pres: 1011.6, rain: 0.0, weather: '晴時多雲' },
  { id: 'C0E750', name: '苗栗', county: '苗栗縣', region: 'north', lat: 24.560, lon: 120.820, temp: 26.0, windDeg: 30, windSpeed: 3.8, gust: 6.5, hum: 73, pres: 1011.3, rain: 0.0, weather: '晴朗' },

  // 中部
  { id: '467490', name: '臺中', county: '臺中市', region: 'central', lat: 24.145, lon: 120.683, temp: 27.5, windDeg: 340, windSpeed: 2.4, gust: 4.5, hum: 68, pres: 1010.5, rain: 0.0, weather: '晴朗' },
  { id: 'C0G650', name: '彰化', county: '彰化縣', region: 'central', lat: 24.081, lon: 120.538, temp: 27.2, windDeg: 350, windSpeed: 3.0, gust: 5.2, hum: 70, pres: 1010.7, rain: 0.0, weather: '晴朗' },
  { id: '467650', name: '日月潭', county: '南投縣', region: 'central', lat: 23.881, lon: 120.908, temp: 22.8, windDeg: 120, windSpeed: 1.5, gust: 3.0, hum: 85, pres: 902.5, rain: 0.0, weather: '多雲' },
  { id: 'C0K400', name: '斗六', county: '雲林縣', region: 'central', lat: 23.712, lon: 120.543, temp: 27.8, windDeg: 10, windSpeed: 2.2, gust: 4.1, hum: 72, pres: 1010.2, rain: 0.0, weather: '晴時多雲' },
  { id: '467480', name: '嘉義', county: '嘉義市', region: 'central', lat: 23.495, lon: 120.432, temp: 28.0, windDeg: 330, windSpeed: 2.1, gust: 3.8, hum: 71, pres: 1010.0, rain: 0.0, weather: '晴朗' },
  { id: 'C0M790', name: '太保', county: '嘉義縣', region: 'central', lat: 23.459, lon: 120.332, temp: 28.2, windDeg: 325, windSpeed: 2.5, gust: 4.2, hum: 69, pres: 1009.8, rain: 0.0, weather: '晴朗' },

  // 南部
  { id: '467410', name: '臺南', county: '臺南市', region: 'south', lat: 22.993, lon: 120.203, temp: 28.5, windDeg: 290, windSpeed: 2.6, gust: 4.8, hum: 75, pres: 1009.6, rain: 0.0, weather: '晴朗' },
  { id: '467440', name: '高雄', county: '高雄市', region: 'south', lat: 22.566, lon: 120.315, temp: 28.9, windDeg: 275, windSpeed: 3.1, gust: 5.5, hum: 73, pres: 1009.4, rain: 0.0, weather: '晴朗' },
  { id: '467590', name: '恆春', county: '屏東縣', region: 'south', lat: 22.003, lon: 120.746, temp: 28.1, windDeg: 80, windSpeed: 6.4, gust: 10.2, hum: 78, pres: 1008.9, rain: 0.0, weather: '多雲時晴' },

  // 東部
  { id: '467080', name: '宜蘭', county: '宜蘭縣', region: 'east', lat: 24.764, lon: 121.756, temp: 25.8, windDeg: 50, windSpeed: 3.6, gust: 6.0, hum: 80, pres: 1011.8, rain: 0.0, weather: '陰天' },
  { id: '466990', name: '花蓮', county: '花蓮縣', region: 'east', lat: 23.975, lon: 121.613, temp: 26.9, windDeg: 42, windSpeed: 3.0, gust: 5.3, hum: 76, pres: 1010.5, rain: 0.0, weather: '多雲' },
  { id: '467660', name: '臺東', county: '臺東縣', region: 'east', lat: 22.755, lon: 121.154, temp: 27.4, windDeg: 60, windSpeed: 4.0, gust: 6.8, hum: 74, pres: 1009.8, rain: 0.0, weather: '晴時多雲' },

  // 離島
  { id: '467350', name: '澎湖', county: '澎湖縣', region: 'islands', lat: 23.565, lon: 119.563, temp: 27.0, windDeg: 35, windSpeed: 7.2, gust: 11.5, hum: 79, pres: 1011.0, rain: 0.0, weather: '晴時多雲' },
  { id: '467110', name: '金門', county: '金門縣', region: 'islands', lat: 24.407, lon: 118.289, temp: 26.6, windDeg: 45, windSpeed: 5.8, gust: 9.0, hum: 75, pres: 1012.1, rain: 0.0, weather: '晴朗' },
  { id: '467990', name: '馬祖', county: '連江縣', region: 'islands', lat: 26.169, lon: 119.923, temp: 24.8, windDeg: 50, windSpeed: 6.5, gust: 10.8, hum: 81, pres: 1013.2, rain: 0.0, weather: '多雲' }
];

class WeatherService {
  constructor() {
    this.stations = JSON.parse(JSON.stringify(TAIWAN_STATIONS));
    this.lastUpdated = new Date();
    this.isLive = false;
  }

  /**
   * 取得所有測站清單（結合最新觀測數據）
   */
  async fetchLiveStations() {
    try {
      const url = `${CWA_CONFIG.STATION_API_URL}?Authorization=${CWA_CONFIG.API_KEY}`;
      const response = await fetch(url, { cache: 'no-store' });
      
      if (!response.ok) {
        throw new Error(`API 請求失敗，狀態碼: ${response.status}`);
      }

      const data = await response.json();
      if (!data.records || !data.records.Station) {
        throw new Error('回傳資料格式不符合預期');
      }

      const liveStationList = data.records.Station;
      this.updateStationsFromLive(liveStationList);
      this.lastUpdated = new Date();
      this.isLive = true;
      return { success: true, stations: this.stations, isLive: true };
    } catch (err) {
      console.warn('氣象署即時 API 獲取遇到阻礙，無縫啟動內建觀測站快取數據：', err.message);
      this.isLive = false;
      return { success: false, stations: this.stations, isLive: false, error: err.message };
    }
  }

  /**
   * 解析 CWA Station 資料並更新記憶體中的測站
   */
  updateStationsFromLive(apiStations) {
    const stationMap = new Map();
    for (const st of apiStations) {
      const name = st.StationName;
      const county = st.GeoInfo?.CountyName || '';
      stationMap.set(name, st);
      if (county) {
        stationMap.set(`${county}_${name}`, st);
      }
    }

    for (const target of this.stations) {
      let found = stationMap.get(target.name);
      if (!found) {
        found = apiStations.find(s => 
          (s.GeoInfo?.CountyName && s.GeoInfo.CountyName.includes(target.county)) ||
          (s.StationName && s.StationName.includes(target.name))
        );
      }

      if (found && found.WeatherElement) {
        const elem = found.WeatherElement;
        
        // 氣溫
        const temp = parseFloat(elem.AirTemperature);
        if (!isNaN(temp) && temp > -50) target.temp = Math.round(temp * 10) / 10;

        // 風向
        const wDeg = parseFloat(elem.WindDirection);
        if (!isNaN(wDeg) && wDeg >= 0) target.windDeg = Math.round(wDeg);

        // 風速
        const wSpeed = parseFloat(elem.WindSpeed);
        if (!isNaN(wSpeed) && wSpeed >= 0) target.windSpeed = Math.round(wSpeed * 10) / 10;

        // 陣風
        const gust = parseFloat(elem.GustInfo?.PeakGustSpeed);
        if (!isNaN(gust) && gust >= 0) target.gust = Math.round(gust * 10) / 10;
        else target.gust = Math.round((target.windSpeed * 1.5) * 10) / 10;

        // 相對濕度
        const hum = parseFloat(elem.RelativeHumidity);
        if (!isNaN(hum) && hum >= 0) target.hum = Math.round(hum);

        // 氣壓
        const pres = parseFloat(elem.AirPressure);
        if (!isNaN(pres) && pres > 500) target.pres = Math.round(pres * 10) / 10;

        // 雨量
        const rain = parseFloat(elem.Now?.Precipitation);
        if (!isNaN(rain) && rain >= 0) target.rain = Math.round(rain * 10) / 10;

        // 天氣現象文字
        if (elem.Weather && elem.Weather !== '-99' && elem.Weather !== '') {
          target.weather = elem.Weather;
        } else {
          target.weather = this.inferWeatherFromData(target.rain, target.hum);
        }
      }
    }
  }

  /**
   * 當 API 未回傳天氣描述時，依降雨量與濕度推算
   */
  inferWeatherFromData(rain, hum) {
    if (rain > 5.0) return '大雨';
    if (rain > 0.5) return '短暫陣雨';
    if (rain > 0.0) return '陰短暫小雨';
    if (hum > 85) return '多雲時陰';
    if (hum > 75) return '多雲時晴';
    return '晴朗舒適';
  }

  /**
   * 取得特定測站資料
   */
  getStationById(id) {
    return this.stations.find(s => s.id === id) || this.stations[0];
  }

  /**
   * 依分區過濾測站
   */
  getStationsByRegion(region) {
    if (!region || region === 'all') return this.stations;
    return this.stations.filter(s => s.region === region);
  }
}

// 輸出實例至全域
window.weatherService = new WeatherService();
window.getWindDirectionText = getWindDirectionText;
window.getBeaufortScale = getBeaufortScale;

/**
 * Weather Data Manager - Windy Real-Scale Edition
 * Handles CWA live observation data, GIS coordinate projections,
 * and 9 Windy weather layers configuration.
 */

const CWA_CONFIG = {
  API_KEY: 'CWA-6FC44933-6473-4341-8216-9BA08D3BBD79',
  STATION_API_URL: 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001',
  FORECAST_API_URL: 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001'
};

// 9 大 Windy 圖層定義與色階規範
const WINDY_LAYERS = {
  wind: {
    id: 'wind',
    name: '風速',
    unit: 'kt',
    unitAlt: 'm/s',
    stops: [0, 5, 10, 20, 30, 40, 60],
    colors: ['#4b72b0', '#56b194', '#99c355', '#d4bf3b', '#d38332', '#c93f41', '#92278f'],
    overlayGradient: 'linear-gradient(135deg, rgba(86,177,148,0.38) 20%, rgba(212,191,59,0.35) 60%, rgba(201,63,65,0.45) 90%)'
  },
  radar: {
    id: 'radar',
    name: '氣象雷達',
    unit: 'dBZ',
    unitAlt: 'mm/h',
    stops: [10, 20, 30, 40, 50, 60, 70],
    colors: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000', '#ff00ff', '#ffffff'],
    overlayGradient: 'radial-gradient(circle at 45% 40%, rgba(0,255,255,0.35) 0%, rgba(0,255,0,0.3) 35%, rgba(255,255,0,0.25) 60%, transparent 80%)'
  },
  satellite: {
    id: 'satellite',
    name: '衛星',
    unit: 'IR',
    unitAlt: '°C',
    stops: [-80, -60, -40, -20, 0, 20, 40],
    colors: ['#ffffff', '#cccccc', '#999999', '#666666', '#333333', '#111111', '#000000'],
    overlayGradient: 'radial-gradient(circle at 75% 25%, rgba(255,255,255,0.45) 0%, rgba(200,200,200,0.25) 45%, transparent 75%)'
  },
  rain: {
    id: 'rain',
    name: '降雨、雷暴',
    unit: 'mm/h',
    unitAlt: 'in',
    stops: [0.1, 1.5, 4, 10, 25, 50, 100],
    colors: ['#88ccee', '#44aa99', '#117733', '#ddcc77', '#cc6677', '#aa4499', '#882255'],
    overlayGradient: 'linear-gradient(180deg, rgba(136,204,238,0.3) 10%, rgba(68,170,153,0.35) 50%, rgba(17,119,51,0.2) 80%)'
  },
  temp: {
    id: 'temp',
    name: '溫度',
    unit: '°C',
    unitAlt: '°F',
    stops: [0, 10, 18, 24, 28, 32, 36],
    colors: ['#3b4cc0', '#88b5ea', '#c8e2bf', '#edd292', '#e58257', '#b40426', '#700010'],
    overlayGradient: 'linear-gradient(135deg, rgba(136,181,234,0.35) 15%, rgba(237,210,146,0.38) 55%, rgba(229,130,87,0.4) 85%)'
  },
  hurricane: {
    id: 'hurricane',
    name: '颱風追蹤器',
    unit: 'hPa',
    unitAlt: 'kt',
    stops: [1010, 990, 970, 950, 930, 910, 890],
    colors: ['#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c', '#75001c', '#400010'],
    overlayGradient: 'radial-gradient(circle at 75% 25%, rgba(215,25,28,0.55) 0%, rgba(253,174,97,0.4) 25%, rgba(255,255,191,0.25) 50%, transparent 75%)'
  },
  clouds: {
    id: 'clouds',
    name: '雲',
    unit: '%',
    unitAlt: 'm',
    stops: [10, 30, 50, 70, 85, 95, 100],
    colors: ['#e0f3f8', '#ccece6', '#99d8c9', '#66c2a4', '#41ae76', '#238b45', '#005824'],
    overlayGradient: 'radial-gradient(circle at 30% 60%, rgba(255,255,255,0.45) 0%, rgba(220,240,250,0.25) 50%, transparent 80%)'
  },
  waves: {
    id: 'waves',
    name: '波浪',
    unit: 'm',
    unitAlt: 'ft',
    stops: [0.5, 1.0, 2.0, 3.5, 5.0, 7.0, 10.0],
    colors: ['#495da0', '#5680b5', '#6ba1c5', '#8bc2cd', '#b5ded2', '#e1efdb', '#f7fcf5'],
    overlayGradient: 'linear-gradient(45deg, rgba(73,93,160,0.35) 0%, rgba(107,161,197,0.3) 50%, rgba(181,222,210,0.2) 100%)'
  },
  accumRain: {
    id: 'accumRain',
    name: '累積雨量',
    unit: 'mm',
    unitAlt: 'in',
    stops: [5, 15, 30, 60, 100, 200, 300],
    colors: ['#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'],
    overlayGradient: 'linear-gradient(135deg, rgba(254,217,118,0.35) 20%, rgba(253,141,60,0.38) 55%, rgba(227,26,28,0.4) 85%)'
  }
};

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

function getWindDirectionText(deg) {
  if (deg === null || deg === undefined || deg < 0 || isNaN(deg)) {
    return { name: '靜風', en: 'CALM', code: 'CALM' };
  }
  const normalized = ((deg % 360) + 360) % 360;
  for (const dir of COMPASS_DIRECTIONS) {
    if (normalized >= dir.min && normalized < dir.max) {
      return dir;
    }
  }
  return { name: '北風', en: 'N', code: 'N' };
}

function getBeaufortScale(speedMs) {
  if (speedMs < 0.3) return { scale: 0, level: '無風', color: '#9AA0A6' };
  if (speedMs < 1.6) return { scale: 1, level: '軟風', color: '#56b194' };
  if (speedMs < 3.4) return { scale: 2, level: '輕風', color: '#99c355' };
  if (speedMs < 5.5) return { scale: 3, level: '微風', color: '#d4bf3b' };
  if (speedMs < 8.0) return { scale: 4, level: '和風', color: '#d38332' };
  if (speedMs < 10.8) return { scale: 5, level: '清風', color: '#c93f41' };
  if (speedMs < 13.9) return { scale: 6, level: '強風', color: '#92278f' };
  return { scale: 7, level: '疾風以上', color: '#661b64' };
}

/**
 * 全臺 22 縣市代表性測站（包含精準真實 GPS 經緯度）
 */
const TAIWAN_STATIONS = [
  { id: '466920', name: '臺北', county: '臺北市', region: 'north', lat: 25.037, lon: 121.514, temp: 26.8, windDeg: 65, windSpeed: 3.2, gust: 5.8, hum: 74, pres: 1011.2, rain: 0.0, weather: '晴時多雲' },
  { id: '466940', name: '基隆', county: '基隆市', region: 'north', lat: 25.133, lon: 121.740, temp: 25.4, windDeg: 45, windSpeed: 4.8, gust: 7.5, hum: 82, pres: 1012.0, rain: 0.5, weather: '陰短暫雨' },
  { id: '466880', name: '板橋', county: '新北市', region: 'north', lat: 24.997, lon: 121.442, temp: 26.5, windDeg: 70, windSpeed: 2.8, gust: 5.1, hum: 76, pres: 1011.0, rain: 0.0, weather: '多雲' },
  { id: 'C0C480', name: '桃園', county: '桃園市', region: 'north', lat: 24.993, lon: 121.300, temp: 26.2, windDeg: 55, windSpeed: 3.5, gust: 6.2, hum: 75, pres: 1011.5, rain: 0.0, weather: '晴時多雲' },
  { id: '467571', name: '新竹', county: '新竹市', region: 'north', lat: 24.827, lon: 120.927, temp: 25.9, windDeg: 35, windSpeed: 5.2, gust: 8.4, hum: 78, pres: 1011.8, rain: 0.0, weather: '多雲時晴' },
  { id: 'C0D570', name: '竹北', county: '新竹縣', region: 'north', lat: 24.838, lon: 121.010, temp: 25.7, windDeg: 40, windSpeed: 4.6, gust: 7.9, hum: 77, pres: 1011.6, rain: 0.0, weather: '晴時多雲' },
  { id: 'C0E750', name: '苗栗', county: '苗栗縣', region: 'north', lat: 24.560, lon: 120.820, temp: 26.0, windDeg: 30, windSpeed: 3.8, gust: 6.5, hum: 73, pres: 1011.3, rain: 0.0, weather: '晴朗' },
  { id: '467490', name: '臺中', county: '臺中市', region: 'central', lat: 24.145, lon: 120.683, temp: 27.5, windDeg: 340, windSpeed: 2.4, gust: 4.5, hum: 68, pres: 1010.5, rain: 0.0, weather: '晴朗' },
  { id: 'C0G650', name: '彰化', county: '彰化縣', region: 'central', lat: 24.081, lon: 120.538, temp: 27.2, windDeg: 350, windSpeed: 3.0, gust: 5.2, hum: 70, pres: 1010.7, rain: 0.0, weather: '晴朗' },
  { id: '467650', name: '日月潭', county: '南投縣', region: 'central', lat: 23.881, lon: 120.908, temp: 22.8, windDeg: 120, windSpeed: 1.5, gust: 3.0, hum: 85, pres: 902.5, rain: 0.0, weather: '多雲' },
  { id: 'C0K400', name: '斗六', county: '雲林縣', region: 'central', lat: 23.712, lon: 120.543, temp: 27.8, windDeg: 10, windSpeed: 2.2, gust: 4.1, hum: 72, pres: 1010.2, rain: 0.0, weather: '晴時多雲' },
  { id: '467480', name: '嘉義', county: '嘉義市', region: 'central', lat: 23.495, lon: 120.432, temp: 28.0, windDeg: 330, windSpeed: 2.1, gust: 3.8, hum: 71, pres: 1010.0, rain: 0.0, weather: '晴朗' },
  { id: 'C0M790', name: '太保', county: '嘉義縣', region: 'central', lat: 23.459, lon: 120.332, temp: 28.2, windDeg: 325, windSpeed: 2.5, gust: 4.2, hum: 69, pres: 1009.8, rain: 0.0, weather: '晴朗' },
  { id: '467410', name: '臺南', county: '臺南市', region: 'south', lat: 22.993, lon: 120.203, temp: 28.5, windDeg: 290, windSpeed: 2.6, gust: 4.8, hum: 75, pres: 1009.6, rain: 0.0, weather: '晴朗' },
  { id: '467440', name: '高雄', county: '高雄市', region: 'south', lat: 22.566, lon: 120.315, temp: 28.9, windDeg: 275, windSpeed: 3.1, gust: 5.5, hum: 73, pres: 1009.4, rain: 0.0, weather: '晴朗' },
  { id: '467590', name: '恆春', county: '屏東縣', region: 'south', lat: 22.003, lon: 120.746, temp: 28.1, windDeg: 80, windSpeed: 6.4, gust: 10.2, hum: 78, pres: 1008.9, rain: 0.0, weather: '多雲時晴' },
  { id: '467080', name: '宜蘭', county: '宜蘭縣', region: 'east', lat: 24.764, lon: 121.756, temp: 25.8, windDeg: 50, windSpeed: 3.6, gust: 6.0, hum: 80, pres: 1011.8, rain: 0.0, weather: '陰天' },
  { id: '466990', name: '花蓮', county: '花蓮縣', region: 'east', lat: 23.975, lon: 121.613, temp: 26.9, windDeg: 42, windSpeed: 3.0, gust: 5.3, hum: 76, pres: 1010.5, rain: 0.0, weather: '多雲' },
  { id: '467660', name: '臺東', county: '臺東縣', region: 'east', lat: 22.755, lon: 121.154, temp: 27.4, windDeg: 60, windSpeed: 4.0, gust: 6.8, hum: 74, pres: 1009.8, rain: 0.0, weather: '晴時多雲' },
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

  async fetchLiveStations() {
    try {
      const url = `${CWA_CONFIG.STATION_API_URL}?Authorization=${CWA_CONFIG.API_KEY}`;
      const response = await fetch(url, { cache: 'no-store' });
      
      if (!response.ok) throw new Error(`API 失敗: ${response.status}`);

      const data = await response.json();
      if (!data.records || !data.records.Station) throw new Error('格式不符合');

      const liveStationList = data.records.Station;
      this.updateStationsFromLive(liveStationList);
      this.lastUpdated = new Date();
      this.isLive = true;
      return { success: true, stations: this.stations, isLive: true };
    } catch (err) {
      console.warn('API 抓取異常，啟用快取資料：', err.message);
      this.isLive = false;
      return { success: false, stations: this.stations, isLive: false, error: err.message };
    }
  }

  updateStationsFromLive(apiStations) {
    const stationMap = new Map();
    for (const st of apiStations) {
      const name = st.StationName;
      const county = st.GeoInfo?.CountyName || '';
      stationMap.set(name, st);
      if (county) stationMap.set(`${county}_${name}`, st);
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
        const temp = parseFloat(elem.AirTemperature);
        if (!isNaN(temp) && temp > -50) target.temp = Math.round(temp * 10) / 10;

        const wDeg = parseFloat(elem.WindDirection);
        if (!isNaN(wDeg) && wDeg >= 0) target.windDeg = Math.round(wDeg);

        const wSpeed = parseFloat(elem.WindSpeed);
        if (!isNaN(wSpeed) && wSpeed >= 0) target.windSpeed = Math.round(wSpeed * 10) / 10;

        const gust = parseFloat(elem.GustInfo?.PeakGustSpeed);
        if (!isNaN(gust) && gust >= 0) target.gust = Math.round(gust * 10) / 10;
        else target.gust = Math.round((target.windSpeed * 1.5) * 10) / 10;

        const hum = parseFloat(elem.RelativeHumidity);
        if (!isNaN(hum) && hum >= 0) target.hum = Math.round(hum);

        const pres = parseFloat(elem.AirPressure);
        if (!isNaN(pres) && pres > 500) target.pres = Math.round(pres * 10) / 10;

        const rain = parseFloat(elem.Now?.Precipitation);
        if (!isNaN(rain) && rain >= 0) target.rain = Math.round(rain * 10) / 10;

        if (elem.Weather && elem.Weather !== '-99' && elem.Weather !== '') {
          target.weather = elem.Weather;
        } else {
          target.weather = this.inferWeatherFromData(target.rain, target.hum);
        }
      }
    }
  }

  inferWeatherFromData(rain, hum) {
    if (rain > 5.0) return '大雨';
    if (rain > 0.5) return '短暫陣雨';
    if (rain > 0.0) return '陰小雨';
    if (hum > 85) return '陰天';
    if (hum > 75) return '多雲';
    return '晴朗';
  }

  getStationById(id) {
    return this.stations.find(s => s.id === id) || this.stations[0];
  }
}

window.weatherService = new WeatherService();
window.WINDY_LAYERS = WINDY_LAYERS;
window.getWindDirectionText = getWindDirectionText;
window.getBeaufortScale = getBeaufortScale;

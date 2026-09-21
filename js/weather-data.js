/**
 * Weather Data Manager - MUJI Edition
 * Handles API fetching from Taiwan Central Weather Administration (CWA),
 * station coordinate projections for the interactive Taiwan map,
 * Beaufort wind scale conversions, and MUJI minimalist lifestyle climate tips.
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
  if (speedMs < 0.3) return { scale: 0, level: '無風', desc: '靜煙直上', color: '#9E9A93' };
  if (speedMs < 1.6) return { scale: 1, level: '軟風', desc: '煙示風向', color: '#7E8B92' };
  if (speedMs < 3.4) return { scale: 2, level: '輕風', desc: '微感拂面', color: '#668078' };
  if (speedMs < 5.5) return { scale: 3, level: '微風', desc: '枝葉微晃', color: '#5A7562' };
  if (speedMs < 8.0) return { scale: 4, level: '和風', desc: '揚塵搖枝', color: '#A08250' };
  if (speedMs < 10.8) return { scale: 5, level: '清風', desc: '池波搖擺', color: '#B27339' };
  if (speedMs < 13.9) return { scale: 6, level: '強風', desc: '枝動電鳴', color: '#8C2626' };
  if (speedMs < 17.2) return { scale: 7, level: '疾風', desc: '迎風阻力', color: '#8C2626' };
  return { scale: 8, level: '大風以上', desc: '折枝艱行', color: '#701D1D' };
}

/**
 * 產生 MUJI 質感的自然生活小語
 */
function getMujiLifestyleTip(temp, windSpeed, rain, hum) {
  if (rain > 5.0) {
    return '窗外雨勢豐沛，適合室內沖煮溫熱番茶，靜聽雨聲撫平心緒。';
  }
  if (rain > 0.2) {
    return '微雨濛濛，出門宜備輕巧摺疊傘，享受洗滌後的純淨草木香氣。';
  }
  if (windSpeed > 8.0) {
    return '風勢清朗強勁，陽台織物請妥善收整，外出宜穿防風棉風衣。';
  }
  if (temp >= 31) {
    return '日光溫熱，宜著亞麻透氣襯衫，隨身攜帶冷水瓶隨時補水。';
  }
  if (temp >= 26) {
    return '微風和煦，空氣溫潤宜人，適合換上一席純棉便服散步透氣。';
  }
  if (temp >= 20) {
    return '溫度清新怡人，適合開窗通風換氣，室內點一盞淡淡檀香。';
  }
  if (temp >= 15) {
    return '空氣稍具涼意，宜披一件薄羊毛開衫，感受時序溫柔更迭。';
  }
  return '微寒侵襲，宜添厚織羊毛衣裳，捧一杯溫熱麥茶取暖。';
}

/**
 * 全臺 22 縣市代表性測站配置與地圖相對座標 (mapX%, mapY%)
 */
const TAIWAN_STATIONS = [
  // 北部
  { id: '466920', name: '臺北', county: '臺北市', region: 'north', mapX: 68, mapY: 18, temp: 26.8, windDeg: 65, windSpeed: 3.2, gust: 5.8, hum: 74, pres: 1011.2, rain: 0.0, weather: '晴時多雲' },
  { id: '466940', name: '基隆', county: '基隆市', region: 'north', mapX: 77, mapY: 13, temp: 25.4, windDeg: 45, windSpeed: 4.8, gust: 7.5, hum: 82, pres: 1012.0, rain: 0.5, weather: '陰短暫雨' },
  { id: '466880', name: '板橋', county: '新北市', region: 'north', mapX: 63, mapY: 20, temp: 26.5, windDeg: 70, windSpeed: 2.8, gust: 5.1, hum: 76, pres: 1011.0, rain: 0.0, weather: '多雲' },
  { id: 'C0C480', name: '桃園', county: '桃園市', region: 'north', mapX: 56, mapY: 21, temp: 26.2, windDeg: 55, windSpeed: 3.5, gust: 6.2, hum: 75, pres: 1011.5, rain: 0.0, weather: '晴時多雲' },
  { id: '467571', name: '新竹', county: '新竹市', region: 'north', mapX: 50, mapY: 26, temp: 25.9, windDeg: 35, windSpeed: 5.2, gust: 8.4, hum: 78, pres: 1011.8, rain: 0.0, weather: '多雲時晴' },
  { id: 'C0D570', name: '竹北', county: '新竹縣', region: 'north', mapX: 54, mapY: 26, temp: 25.7, windDeg: 40, windSpeed: 4.6, gust: 7.9, hum: 77, pres: 1011.6, rain: 0.0, weather: '晴時多雲' },
  { id: 'C0E750', name: '苗栗', county: '苗栗縣', region: 'north', mapX: 47, mapY: 33, temp: 26.0, windDeg: 30, windSpeed: 3.8, gust: 6.5, hum: 73, pres: 1011.3, rain: 0.0, weather: '晴朗' },

  // 中部
  { id: '467490', name: '臺中', county: '臺中市', region: 'central', mapX: 47, mapY: 41, temp: 27.5, windDeg: 340, windSpeed: 2.4, gust: 4.5, hum: 68, pres: 1010.5, rain: 0.0, weather: '晴朗' },
  { id: 'C0G650', name: '彰化', county: '彰化縣', region: 'central', mapX: 40, mapY: 44, temp: 27.2, windDeg: 350, windSpeed: 3.0, gust: 5.2, hum: 70, pres: 1010.7, rain: 0.0, weather: '晴朗' },
  { id: '467650', name: '日月潭', county: '南投縣', region: 'central', mapX: 57, mapY: 49, temp: 22.8, windDeg: 120, windSpeed: 1.5, gust: 3.0, hum: 85, pres: 902.5, rain: 0.0, weather: '多雲' },
  { id: 'C0K400', name: '斗六', county: '雲林縣', region: 'central', mapX: 42, mapY: 52, temp: 27.8, windDeg: 10, windSpeed: 2.2, gust: 4.1, hum: 72, pres: 1010.2, rain: 0.0, weather: '晴時多雲' },
  { id: '467480', name: '嘉義', county: '嘉義市', region: 'central', mapX: 41, mapY: 58, temp: 28.0, windDeg: 330, windSpeed: 2.1, gust: 3.8, hum: 71, pres: 1010.0, rain: 0.0, weather: '晴朗' },
  { id: 'C0M790', name: '太保', county: '嘉義縣', region: 'central', mapX: 37, mapY: 57, temp: 28.2, windDeg: 325, windSpeed: 2.5, gust: 4.2, hum: 69, pres: 1009.8, rain: 0.0, weather: '晴朗' },

  // 南部
  { id: '467410', name: '臺南', county: '臺南市', region: 'south', mapX: 38, mapY: 67, temp: 28.5, windDeg: 290, windSpeed: 2.6, gust: 4.8, hum: 75, pres: 1009.6, rain: 0.0, weather: '晴朗' },
  { id: '467440', name: '高雄', county: '高雄市', region: 'south', mapX: 39, mapY: 76, temp: 28.9, windDeg: 275, windSpeed: 3.1, gust: 5.5, hum: 73, pres: 1009.4, rain: 0.0, weather: '晴朗' },
  { id: '467590', name: '恆春', county: '屏東縣', region: 'south', mapX: 46, mapY: 89, temp: 28.1, windDeg: 80, windSpeed: 6.4, gust: 10.2, hum: 78, pres: 1008.9, rain: 0.0, weather: '多雲時晴' },

  // 東部
  { id: '467080', name: '宜蘭', county: '宜蘭縣', region: 'east', mapX: 74, mapY: 26, temp: 25.8, windDeg: 50, windSpeed: 3.6, gust: 6.0, hum: 80, pres: 1011.8, rain: 0.0, weather: '陰天' },
  { id: '466990', name: '花蓮', county: '花蓮縣', region: 'east', mapX: 70, mapY: 46, temp: 26.9, windDeg: 42, windSpeed: 3.0, gust: 5.3, hum: 76, pres: 1010.5, rain: 0.0, weather: '多雲' },
  { id: '467660', name: '臺東', county: '臺東縣', region: 'east', mapX: 62, mapY: 73, temp: 27.4, windDeg: 60, windSpeed: 4.0, gust: 6.8, hum: 74, pres: 1009.8, rain: 0.0, weather: '晴時多雲' },

  // 離島
  { id: '467350', name: '澎湖', county: '澎湖縣', region: 'islands', mapX: 18, mapY: 53, temp: 27.0, windDeg: 35, windSpeed: 7.2, gust: 11.5, hum: 79, pres: 1011.0, rain: 0.0, weather: '晴時多雲' },
  { id: '467110', name: '金門', county: '金門縣', region: 'islands', mapX: 12, mapY: 28, temp: 26.6, windDeg: 45, windSpeed: 5.8, gust: 9.0, hum: 75, pres: 1012.1, rain: 0.0, weather: '晴朗' },
  { id: '467990', name: '馬祖', county: '連江縣', region: 'islands', mapX: 16, mapY: 10, temp: 24.8, windDeg: 50, windSpeed: 6.5, gust: 10.8, hum: 81, pres: 1013.2, rain: 0.0, weather: '多雲' }
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
      
      if (!response.ok) {
        throw new Error(`API 請求失敗: ${response.status}`);
      }

      const data = await response.json();
      if (!data.records || !data.records.Station) {
        throw new Error('資料格式不符');
      }

      const liveStationList = data.records.Station;
      this.updateStationsFromLive(liveStationList);
      this.lastUpdated = new Date();
      this.isLive = true;
      return { success: true, stations: this.stations, isLive: true };
    } catch (err) {
      console.warn('CWA 即時 API 讀取異常，啟動內建觀測快取：', err.message);
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
    if (rain > 0.0) return '小雨';
    if (hum > 85) return '陰天';
    if (hum > 75) return '多雲';
    return '晴朗';
  }

  getStationById(id) {
    return this.stations.find(s => s.id === id) || this.stations[0];
  }

  getStationsByRegion(region) {
    if (!region || region === 'all') return this.stations;
    return this.stations.filter(s => s.region === region);
  }
}

window.weatherService = new WeatherService();
window.getWindDirectionText = getWindDirectionText;
window.getBeaufortScale = getBeaufortScale;
window.getMujiLifestyleTip = getMujiLifestyleTip;

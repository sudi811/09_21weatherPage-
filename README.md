# 臺灣即時氣象與動態風向可視化儀表盤 (Taiwan Real-time Wind & Weather)

一個高質感、具備流體氣流動畫與 360° 羅盤的即時氣象觀測網站。整合交通部中央氣象署（CWA）即時開放資料，提供全臺 22 縣市即時溫度、風向、風速、陣風、濕度與氣壓等全方位氣象數據。

![Dynamic Weather](https://img.shields.io/badge/CWA%20API-O--A0001--001-blue?style=flat-square)
![Canvas 2D](https://img.shields.io/badge/Render-60FPS%20Canvas%202D-cyan?style=flat-square)
![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-success?style=flat-square&logo=github)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

> 🚀 **線上展示網址 (Live Demo)**：[https://sudi811.github.io/09_21weatherPage-/](https://sudi811.github.io/09_21weatherPage-/)
>
> *(若剛開啟 Pages 設定，GitHub 約需 1~2 分鐘進行初次部署建置)*

---

## 🌟 核心功能特色

### 1. 💨 類似 Windy 的全螢幕 2D 粒子風場動畫
- **即時流動模擬**：背景採用 Canvas 2D 渲染技術，粒子移動方向**嚴格對應當前測站真實風向角（0° ~ 360°）**。
- **流速連動**：粒子流動速度與軌跡長度（trail）動態對應當前測站真實風速（m/s）；強風時奔馳、微風時輕拂。
- **平滑過渡**：切換測站時，風向角度與速度採用最短路徑內插（Shortest Path Lerp）漸變，視覺絲滑無突變。

### 2. 🧭 360° 科技感風向羅盤與旋轉風速計
- **16 方位刻度盤**：動態霓虹指針準確指向來風方位。
- **中央旋轉風杯（Anemometer）**：風杯旋轉週期直接綁定即時風速，轉速隨風力大小即時變化。
- **蒲福氏風級評級**：自動計算 0~12 級風級（如：微風、和風、強風）與動態發光徽章。

### 3. 🌡️ 全方位氣候指標儀表盤
- **巨幅溫感顯示**：當前即時氣溫（°C）、體感溫度計算、體感舒適度描述。
- **6 大維度監測**：
  - 平均風速（m/s 及 km/h）
  - 瞬間最大陣風（m/s 及陣風級別）
  - 相對濕度（%）
  - 大氣壓力（hPa）
  - 本日累積降雨量（mm）
  - 蒲福氏風級與對應自然現象

### 4. 🗺️ 全臺 22 縣市測站一鍵切換與搜尋
- **分區過濾**：快速按「全臺灣、北部、中部、南部、東部、離島」分類檢視。
- **即時搜尋**：輸入縣市或測站名稱即時篩選。
- **測站卡片**：各卡片獨立顯示即時氣溫與獨立旋轉的微型風向箭頭。

### 5. 🌐 離線快取與即時連線雙重機制
- 內建全臺 22 縣市代表性測站初始離線快取，確保任何無網路或 API 限制環境下頁面皆能完整運行。
- 自動在背景與氣象署 API（`O-A0001-001`）同步最新觀測數值。

---

## 🚀 如何開啟與使用

本專案採用純原生前端技術（HTML5 + CSS3 + Vanilla JavaScript），**無需安裝 Node.js 或任何套件**：

### 方式 A：直接在瀏覽器開啟
1. 進入專案資料夾。
2. 雙擊直接開啟 `index.html` 即可在 Chrome、Edge、Safari 或 Firefox 中暢快體驗。

### 方式 B：使用任意本地 HTTP 伺服器（可選）
例如在終端機中執行：
```bash
# Python 3
python -m http.server 8080

# 或使用 VS Code 的 Live Server 擴充套件
```
瀏覽器開啟 `http://localhost:8080`。

### 方式 C：部署至 GitHub Pages
1. 前往 GitHub 該專案儲存庫的 **Settings** -> **Pages**。
2. 在 **Branch** 選擇 `main` 分支並儲存。
3. 數分鐘後即可獲得專屬線上氣象觀測站網址！

---

## 📁 檔案結構

```
09_21weatherPage-/
├── index.html           # 主網頁架構（語意化 HTML5、儀表盤、羅盤視圖）
├── style.css            # 現代深色玻璃擬態風格、動態羅盤、風杯旋轉動畫
├── js/
│   ├── weather-data.js  # 氣象署 CWA API 串接、全臺測站資料庫、方位角與風級換算
│   ├── wind-canvas.js   # 獨立高效 Canvas 2D 風場粒子流動引擎
│   └── app.js           # 核心控制器、UI 互動綁定、測站切換與平滑過渡
└── README.md            # 專案詳細說明文件
```

---

## 📡 API 資料來源

- **資料供應機關**：交通部中央氣象署（CWA）
- **資料集代碼**：`O-A0001-001`（自動氣象站 - 即時氣象觀測資料）
- **官方平臺**：[中央氣象署開放資料平臺](https://opendata.cwa.gov.tw/)
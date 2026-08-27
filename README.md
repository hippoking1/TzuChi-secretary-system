# 慈濟小祕書系統 2.0 (Tzu Chi Secretary System)

本系統為專為慈濟志工與組隊幹部打造的現代化全方位作業平台，涵蓋**活動報名與名冊分頁匯出、現場簽到點名、會議出席管理、道場值班排程、LINE 官方帳號定時推播、組織與志工名冊維護、細粒度 RBAC 權限管理**及 **Google Sheets 雙向備份中心**。

系統架構採用 **Vue 3 SPA (託管於 GitHub Pages) + Cloud Firestore + Firebase Cloud Functions v2 (Node.js 22) + LINE Messaging API**。

---

## 🌟 核心功能模組

### 1. 📅 活動管理與智慧報名系統
* **多分類與多場次發佈**：支援共修精進、法親聯誼、環保志業、慈善訪視、醫療服務、教育人文等多元分類，自訂報名起訖與名額限制（預設不限人數）。
* **志工核身與報名人數自訂**：
  * 志工依「和氣 / 互愛 / 協力」階層與姓名快速核身。
  * 報名表單可填寫「**報名人數**」（預設 1 位，可包含同行志工或家人大德）。
* **高併發防超額與自動遞補機制**：
  * 採用 Cloud Firestore Transaction 交易鎖定，精準計算剩餘名額。
  * 名額額滿自動轉為「**候補中**」；正取成員取消報名時，系統自動將第一順位候補成員依序遞補為「**已確認 (正取)**」。
* **一鍵分享功能**：
  * 點擊「📤 分享」自動產生活動專屬報名 QR Code、支援手機長按存圖。
  * 提供一鍵複製報名連結與一鍵轉傳至 LINE 聊天室/群組。
* **各活動專屬 Excel 名冊匯出 (依「各協力」獨立分頁)**：
  * 採用 `xlsx` 引擎，後台一鍵匯出該活動報名成功（已確認正取）之名單。
  * **第一頁【全部正取總表】**：彙整全體正取成員。
  * **第二頁至第 N 頁【各協力獨立工作頁】**：系統自動依志工所屬「協力」（如宜蘭協力一、宜蘭協力二、羅東協力一等）分組建立獨立分頁與人數小計，方便幹部直接發送名冊。
* **報名查詢與自助手動取消**：
  * 前台「查詢報名紀錄」支援以姓名查詢（電話末 4 碼改為選填），並可直接在線上取消報名。
* **LINE 活動行前提醒推播**：
  * 後台支援一鍵推播行前提醒給該活動已確認且綁定 LINE 的志工。
  * 每日上午 **08:30** 由 Cloud Scheduler 自動檢查隔天舉辦的活動並發送提醒訊息。

---

### 2. ✅ 現場點名簽到終端 (Check-In)
* **純淨報名成功名單**：嚴格過濾「已取消」與「候補中」紀錄，僅呈現報名成功的應到志工。
* **實時統計看板**：頂部指標與狀態標籤分別呈現「應到人數與表單數 / 已簽到 / 未簽到」。
* **極速點名與反向取消簽到**：大按鈕點名體驗，支援關鍵字即時搜尋，點錯可隨時取消簽到。
* **PWA & 離線持久化**：支援 IndexedDB 離線快取，無網路環境亦可順暢點名，連網自動同步。

---

### 3. 👥 組隊會議與出席點名
* **會議發佈與指定名單**：建立會議並自訂各協力預計出席之志工名單。
* **會議現場點名**：現場快速勾選出席狀況，掌握會議出席率。
* **LINE 開會通知推播**：一鍵向與會成員發送會議時間、地點與議程通知。

---

### 4. 🗓️ 道場值班排班系統
* **雙道場排班矩陣**：支援宜蘭園區與東港聯絡處排班矩陣管理。
* **眾別智能過濾**：自動依男眾/女眾別過濾志工名單，快速完成每月輪值排班。
* **每日 08:00 LINE 值班推播提醒**：Cloud Scheduler 每日定時向當日值班志工發送提醒推播。
* **個人值班查詢**：前台提供志工輸入姓名或手機快速查詢自己未來的排班日期與場次。

---

### 5. 📒 組織架構與志工名冊維護
* **三層組織架構**：維護「和氣 ➔ 互愛 ➔ 協力」樹狀層級，支援無限延伸。
* **志工名冊管理**：支援個別建檔與 **Excel / CSV 批次複製貼上快速匯入**。
* **雙向電話號碼自動同步**：
  * 志工在報名活動時若填寫了電話，系統會**自動同步更新至志工名冊**（補齊空白或更新變更後的號碼）。
  * 進入志工名冊維護時亦會自動在背景追溯同步歷史活動報名之最新電話。
* **LINE 官方帳號綁定系統**：志工掃碼或輸入身分後透過 LINE Bot 完成安全綁定，支援推播測試。

---

### 6. 🛡️ 細粒度 RBAC 權限管理系統 (5 大功能模組自由授權)
* **多角色支援**：超級管理員 (`super_admin`)、一般管理員 (`admin`)、會議召集人 (`convener`)。
* **超級管理員自由指派權限**：
  * 超級管理員可自由指派其他管理員之 5 大功能模組權限：
    1. 📅 **活動管理** (`events`)
    2. 👥 **會議管理** (`meetings`)
    3. 🗓️ **道場值班管理** (`duty`)
    4. 📒 **組織與志工管理** (`members`)
    5. 📊 **報表與系統管理** (`export`)
* **動態選單與嚴格路由守衛**：
  * 後台導覽側邊欄與行動端捷徑按鈕依使用者被授予之模組動態呈現。
  * Vue Router `beforeEach` 嚴格把關路由權限，無權限存取時自動導向儀表板並提示。
* **視覺化編輯彈窗**：超級管理員可於「管理員權限設定」中點擊「✏️ 編輯權限」勾選模組並即時持久化至 Firestore。

---

### 7. 📊 報表與 Google Sheets 備份中心
* **多格式名冊匯出**：
  * 各活動專屬依協力分頁 Excel 試算表 (`.xlsx`)。
  * 活動報名總表 CSV。
  * 道場值班表 CSV。
* **Google Sheets 雙向備份**：保留原有 Google Sheets 作為永久外部備份，後台一鍵調用 Cloud Functions 將 Firestore 最新資料同步寫回指定試算表。

---

### 8. 📱 極致行動體驗與無感快取更新 (Anti-Cache Update)
* **手機完整後台操作**：
  * 手機瀏覽後台具備完整功能（非精簡版），配備側滑抽屜選單、橫向滑動快捷標籤與卡片化自適應表格。
* **自動無感版本更新**：
  * Vite PWA 配置 `autoUpdate`、`skipWaiting` 與 `NetworkFirst` 快取策略。
  * 每次系統發佈新版本時，使用者重新整理或切換分頁即可**自動載入最新版本，無需手動清除瀏覽器 Cookie 或快取**。

---

## 🛠️ 技術棧一覽

| 領域 | 技術 / 工具 | 說明 |
| :--- | :--- | :--- |
| **前端框架** | Vue 3 (Composition API / `<script setup>`) | 現代化響應式 UI 架構 |
| **建置工具** | Vite 5 | 極速 HMR 與代碼打包優化 |
| **狀態管理** | Pinia | 模組化全域狀態管理 (Auth, Events, Members, Regs 等) |
| **前端路由** | Vue Router 4 (Hash Mode) | 支援 RBAC 路由守衛與動態權限比對 |
| **樣式系統** | 慈濟品牌 CSS 規範 + Tailwind CSS 實用類 | 琉璃藍、環保綠、智慧紫、莊嚴金 |
| **離線支援** | Vite PWA (Workbox) + IndexedDB | 離線點名與無感自動更新 |
| **試算表處理** | SheetJS (`xlsx`) | 瀏覽器端多工作頁 Excel 試算表生成與匯出 |
| **雲端資料庫** | Google Cloud Firestore | NoSQL 雲端資料庫，支援 Transaction 防超額 |
| **雲端函式** | Firebase Cloud Functions v2 (Node.js 22) | LINE Webhook、定時排程推播與 Sheets 備份 |
| **定時排程** | Google Cloud Scheduler | 每日 08:00 值班提醒 / 08:30 活動前一天提醒 |
| **通訊服務** | LINE Messaging API (`@line/bot-sdk`) | Push / Multicast 訊息推播與 HMAC 簽名驗證 |
| **版本控制** | Git + GitHub Actions | 代碼推送自動建置並發佈至 GitHub Pages |

---

## 📁 專案目錄架構

```
tzuchi-secretary-system/
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions 自動建置與 Pages 部署工作流
├── functions/                  # Firebase Cloud Functions 後端
│   ├── index.js                # Functions 進入點 (含 sendEventRemindersForDate 等 Callable)
│   ├── lineWebhook.js          # LINE Webhook (含 HMAC-SHA256 簽名驗證)
│   ├── scheduledTasks.js       # Cloud Scheduler 定時推播 (每日 08:00 值班 / 08:30 活動提醒)
│   ├── googleSheetsBackup.js   # Google Sheets 雙向備份同步
│   └── package.json
├── src/
│   ├── components/
│   │   ├── layout/             # Header, Footer, AdminSidebar, AdminLayout
│   │   ├── shared/             # ShareModal (QR Code / LINE 轉傳彈窗)
│   │   └── ui/                 # OrgCascader (三層組織連動選單)
│   ├── composables/            # useToast, useExport 等
│   ├── firebase/
│   │   ├── config.js           # Firebase App, Auth, Firestore 初始化 (含離線快取)
│   │   ├── auth.js             # 登入、註冊、密碼重設
│   │   └── db.js               # Firestore CRUD、Transaction 報名遞補與電話同步
│   ├── router/                 # 路由定義與 RBAC 權限攔截守衛
│   ├── stores/                 # Pinia Stores (auth, events, registrations, members, orgs, duty, meetings)
│   ├── styles/                 # 全域樣式與色彩變數
│   ├── utils/
│   │   └── excelExport.js      # 多工作頁 (依協力分頁) Excel 匯出核心邏輯
│   ├── views/
│   │   ├── public/             # 前台頁面 (活動列表、詳情、報名、個人報名查詢、值班查詢、LINE綁定)
│   │   └── admin/              # 後台頁面 (儀表板、活動、名單、簽到、值班、會議、志工、組織、權限、匯出)
│   ├── App.vue
│   └── main.js                 # PWA Service Worker 更新監聽與 App 掛載
├── firestore.rules             # Cloud Firestore 安全性規則 (嚴格 RBAC 與防竄改)
├── firestore.indexes.json      # Firestore 複合查詢索引
├── vite.config.js              # Vite 建置配置、PWA Workbox 快取規則
└── README.md
```

---

## 🚀 完整部署與上線指南 (Deployment Guide)

### 第一步：環境準備與安裝
請確保本機已安裝 **Node.js (v20 或 v22)** 與 **Git**。

```bash
# 1. 複製專案儲存庫
git clone https://github.com/hippoking1/TzuChi-secretary-system.git
cd TzuChi-secretary-system

# 2. 安裝前端依賴套件
npm install

# 3. 安裝 Cloud Functions 依賴套件
cd functions
npm install
cd ..

# 4. 安裝 Firebase CLI (若尚未安裝)
npm install -g firebase-tools
```

---

### 第二步：Firebase 專案設定
1. 前往 [Firebase Console](https://console.firebase.google.com/) 建立專案（例如：`tzuchi-secretary-system`）。
2. 升級至 **Blaze (按量計費)** 方案（運行 Cloud Functions 與 Cloud Scheduler 必要，慈濟系統日常流量皆在免費額度內）。
3. **啟用 Cloud Firestore**：
   - 地點建議選擇 `asia-east1` (台灣) 或 `asia-northeast1` (東京)。
4. **啟用 Firebase Authentication**：
   - 啟用「電子郵件 / 密碼」登入方式。
5. **取得 Web 應用程式設定**：
   - 於專案設定 ➔ 一般 ➔ 應用程式 ➔ 新增 Web 應用程式，取得 `firebaseConfig` 憑證。

---

### 第三步：環境變數配置
在專案根目錄建立 `.env.production` 與 `.env.local`：

```env
VITE_FIREBASE_API_KEY=你的_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=tzuchi-secretary-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tzuchi-secretary-system
VITE_FIREBASE_STORAGE_BUCKET=tzuchi-secretary-system.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=你的_SENDER_ID
VITE_FIREBASE_APP_ID=你的_APP_ID
```

---

### 第四步：部署 Firestore 安全規則與索引

```bash
# 登入 Firebase
firebase login

# 切換至目標專案
firebase use tzuchi-secretary-system

# 部署 Firestore 規則與複合索引
firebase deploy --only firestore
```

---

### 第五步：建立初始超級管理員 (Super Admin)
1. 進入 Firebase Console ➔ **Authentication** ➔ **Users** 點擊「新增使用者」，輸入管理員 Email（例如 `admin@tzuchi.org`）與自訂密碼。
2. 複製該使用者的 **UID**。
3. 進入 **Firestore Database**，在 `adminUsers` 集合中新增文件，**Document ID 填入該 UID**：
   ```json
   {
     "name": "超級管理員",
     "email": "admin@tzuchi.org",
     "role": "super_admin",
     "permissions": ["events", "meetings", "duty", "members", "export"],
     "createdAt": "2026-08-27T00:00:00.000Z"
   }
   ```

---

### 第六步：部署 Firebase Cloud Functions (LINE Bot + 定時任務)
1. 在 LINE Developers Console 建立 Messaging API Channel，取得 **Channel Access Token** 與 **Channel Secret**。
2. 設定 Cloud Functions Secrets：
   ```bash
   firebase functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN
   firebase functions:secrets:set LINE_CHANNEL_SECRET
   ```
3. 部署 Cloud Functions：
   ```bash
   firebase deploy --only functions
   ```
4. 將產生的 `lineWebhook` URL（例如 `https://asia-east1-tzuchi-secretary-system.cloudfunctions.net/lineWebhook`）填入 LINE Developers 的 Webhook URL 並開啟「Use Webhook」。

---

### 第七步：GitHub Pages 前端自動化部署
1. 將程式碼推送至 GitHub `main` 分支：
   ```bash
   git add .
   git commit -m "feat: release version 2.0"
   git push origin main
   ```
2. 進入 GitHub 儲存庫 ➔ **Settings** ➔ **Pages** ➔ **Build and deployment**：
   - Source 選擇 **GitHub Actions**。
3. 每次推送至 `main` 分支，GitHub Actions 將自動完成 Vite 打包並無縫部署至 GitHub Pages！

---

## 🔒 系統維護與安全規範

* **XSS 防護**：所有前台 Markdown 說明文字皆經過 `DOMPurify` 嚴格過濾清洗。
* **防搶票超賣**：報名寫入與取消遞補一律透過 Firestore runTransaction 交易鎖定。
* **LINE Webhook 資安**：採用 HMAC-SHA256 簽名驗證，防止非 LINE 伺服器的偽冒請求。
* **快取自動失效**：Service Worker 配置 NetworkFirst 與即時生命週期監聽，保證使用者每次皆取得最新版本。

---

*慈濟小祕書系統開發團隊 敬製*

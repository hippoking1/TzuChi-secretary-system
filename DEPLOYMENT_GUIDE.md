# 慈濟活動報名與志工排程系統 2.0 — 部署與上線操作手冊

本手冊提供詳細、可複製的端到端部署步驟。無論是由您親自操作，或交由其他 LLM 代理人執行，均可依據本手冊完整上線。

---

## 目錄
1. [架構概覽](#1-架構概覽)
2. [第一步：Firebase 專案與服務建立](#2-第一步firebase-專案與服務建立)
3. [第二步：建立管理員帳號與 RBAC 角色](#3-第二步建立管理員帳號與-rbac-角色)
4. [第三步：部署 Firestore 安全規則與索引](#4-第三步部署-firestore-安全規則與索引)
5. [第四步：設定前端環境變數與 GitHub Pages 自動部署](#5-第四步設定前端環境變數與-github-pages-自動部署)
6. [第五步：部署 Firebase Cloud Functions (LINE Bot + 定時任務)](#6-第五步部署-firebase-cloud-functions-line-bot--定時任務)
7. [第六步：Google Sheets 歷史資料遷移與雙向備份](#7-第六步google-sheets-歷史資料遷移與雙向備份)
8. [第七步：上線驗證清單](#8-第七步上線驗證清單)

---

## 1. 架構概覽
- **前端 SPA (託管於 GitHub Pages)**：Vue 3 + Vite + Pinia + Vue Router (Hash Mode) + PWA 離線快取支援。
- **資料庫 (Cloud Firestore)**：具備 IndexedDB 離線快取、Transaction 搶票防超額、12 Collections。
- **身份認證 (Firebase Auth)**：支援多管理員分級（超級管理員 / 一般管理員 / 會議召集人）。
- **後端服務 (Firebase Cloud Functions v2)**：LINE Webhook (HMAC 簽名驗證)、LINE Multicast 推播、每日 08:00 定時排班提醒、Google Sheets 同步備份。

---

## 2. 第一步：Firebase 專案與服務建立

1. 前往 [Firebase Console](https://console.firebase.google.com/) 並點擊「新增專案」（例如命名為 `tzuchi-registration-system`）。
2. 升級至 **Blaze (按量計費) 方案**（Cloud Functions 運行需要，系統在免費配額內幾乎不會產生費用）。
3. **建立 Firestore Database**：
   - 點擊「Firestore Database」->「建立資料庫」。
   - 選擇地點（建議選擇台灣 `asia-east1` 或東京 `asia-northeast1`）。
4. **啟用 Firebase Authentication**：
   - 點擊「Authentication」->「開始使用」。
   - 啟用「電子郵件/密碼」登入提供者。
5. **註冊 Web 應用程式以取得 API 金鑰**：
   - 點擊專案總覽齒輪圖示 ->「專案設定」->「一般」->「新增應用程式 (Web)」。
   - 複製 `firebaseConfig` 物件內容備用。

---

## 3. 第二步：建立管理員帳號與 RBAC 角色

1. 在 Firebase Console -> **Authentication** -> **Users** 點擊「新增使用者」，例如：`admin@tzuchi.org`，並設定初始密碼。
2. 複製該使用者的 **UID**。
3. 前往 **Firestore Database**，於 `adminUsers` 集合建立以該 **UID** 為 Document ID 的文件：
   ```json
   {
     "name": "超級管理員",
     "email": "admin@tzuchi.org",
     "role": "super_admin",
     "createdAt": "2026-08-20T08:00:00.000Z"
   }
   ```
   *(角色可為：`super_admin` 超級管理員、`admin` 一般管理員、`convener` 會議召集人)*

---

## 4. 第三步：部署 Firestore 安全規則與索引

在專案本機終端機執行：
```bash
# 安裝 Firebase CLI (若尚未安裝)
npm install -g firebase-tools

# 登入 Firebase
firebase login

# 關聯您的 Firebase 專案
firebase use --add

# 部署 Firestore 安全規則與索引
firebase deploy --only firestore
```

---

## 5. 第四步：設定前端環境變數與 GitHub Pages 自動部署

1. 在專案根目錄建立 `.env.production`，填入第一步取得的 Firebase 設定：
   ```env
   VITE_FIREBASE_API_KEY=你的API_KEY
   VITE_FIREBASE_AUTH_DOMAIN=你的專案ID.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=你的專案ID
   VITE_FIREBASE_STORAGE_BUCKET=你的專案ID.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=你的SENDER_ID
   VITE_FIREBASE_APP_ID=你的APP_ID
   ```

2. 在 GitHub 建立儲存庫並推送程式碼：
   ```bash
   git init
   git add .
   git commit -m "feat: upgrade to Vue 3 + Firebase 2.0"
   git branch -M main
   git remote add origin https://github.com/你的帳號/你的倉庫名稱.git
   git push -u origin main
   ```

3. 前往 GitHub 倉庫 -> **Settings** -> **Pages**：
   - **Build and deployment Source**：選擇 **GitHub Actions**。
   - 推送完成後，GitHub Actions 將會自動編譯並部署至 `https://你的帳號.github.io/你的倉庫名稱/`。

---

## 6. 第五步：部署 Firebase Cloud Functions (LINE Bot + 定時任務)

1. 設定 LINE Messaging API 金鑰環境變數：
   ```bash
   firebase functions:secrets:set LINE_CHANNEL_SECRET
   # 依提示貼入您的 LINE Channel Secret

   firebase functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN
   # 依提示貼入您的 LINE Channel Access Token
   ```

2. 部署 Cloud Functions：
   ```bash
   firebase deploy --only functions
   ```

3. 部署完成後，複製 `lineWebhook` 的 HTTPS 觸發網址（例如：`https://asia-east1-你的專案ID.cloudfunctions.net/lineWebhook`）。
4. 前往 [LINE Developers Console](https://developers.line.biz/)：
   - 進入您的 Messaging API Channel。
   - **Webhook URL** 貼上上述網址，並開啟 **Use Webhook**。
   - 點擊「Verify」確認驗證通過。

---

## 7. 第六步：Google Sheets 歷史資料遷移與雙向備份

### 7.1 單次遷移歷史資料至 Firestore
1. 在 GCP Console 下載 Service Account 金鑰，存放至 `functions/serviceAccountKey.json`。
2. 執行遷移腳本：
   ```bash
   cd functions
   node migrations/importFromSheets.js 1-N2k47EO1dYmGDqUgwBZBkPRZvGVtF9F0_JCSJehCq0
   ```

### 7.2 日常雙向備份至 Google Sheets
- 管理員隨時可於後台「**匯出與備份中心**」一鍵觸發同步備份，系統將調用 `syncBackupToSheets` 自動更新 Google Sheets。

---

## 8. 第七步：上線驗證清單

- [ ] **前台活動瀏覽**：能正常讀取已發佈活動，無 XSS 風險（Markdown 由 DOMPurify 清洗）。
- [ ] **報名與 Transaction 控管**：志工姓名+末4碼比對正常，滿額自動標記候補中，正取取消自動遞補。
- [ ] **道場個人值班查詢**：5 階下拉選單連動正常，月曆與個人班次正確。
- [ ] **現場點名快速終端**：支援離線打卡、搜尋、快速簽到。
- [ ] **多管理員 RBAC 權限**：超級管理員、一般管理員、召集人依權限顯示側邊欄。
- [ ] **LINE Bot**：支援「姓名 協力」自動核身綁定、查詢班表、每日 08:00 定時提醒推播。
- [ ] **Google Sheets 備份**：後台能一鍵觸發備份，保留試算表數據。

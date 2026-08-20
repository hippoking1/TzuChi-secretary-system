# 慈濟活動報名與志工排程系統 2.0 (Vue 3 + Firebase)

本專案為慈濟活動報名、會議出席、道場志工值班排程與 LINE Bot 整合系統的現代化 2.0 版本。已由 Google Apps Script 全面重構遷移為 **GitHub Pages (Vue 3 SPA) + Cloud Firestore + Firebase Cloud Functions**。

## 🌟 核心特色與技術升級
1. **GitHub Pages 靜態託管**：前端採用 Vue 3 + Vite + Pinia，秒級載入，完全免費託管。
2. **PWA & Firestore 離線支援**：現場簽到點名支援 IndexedDB 離線快取，斷網亦可操作，連網自動同步。
3. **多管理員 RBAC 角色分級**：
   - 🌟 **超級管理員 (Super Admin)**：全權限 + 帳號與權限分級管理。
   - 🛡️ **一般管理員 (Admin)**：活動 CRUD、志工名冊維護、道場排班。
   - 📢 **會議召集人 (Convener)**：會議發佈與指定名單出席管理。
4. **高併發防超賣**：報名名額計算採用 Firestore Transaction，確保正取/候補人數 100% 精準。
5. **LINE Bot 整合**：HMAC-SHA256 簽名驗證、個資安全綁定、開會通知 Multicast 推播、每日 08:00 定時排班提醒。
6. **Google Sheets 雙向備份**：保留原有 Google Sheets 作為永久外部備份，後台一鍵即時同步。
7. **資安強化**：全面使用 DOMPurify 消毒 Markdown，徹底防禦 XSS 攻擊。

## 📁 目錄架構
```
├── .github/workflows/deploy.yml   # GitHub Actions 自動部署工作流
├── functions/                     # Firebase Cloud Functions (LINE Bot / 定時推播 / 試算表備份)
│   ├── index.js
│   ├── lineWebhook.js             # LINE Webhook (含 HMAC 驗證)
│   ├── scheduledTasks.js          # 每日 08:00 值班提醒 (Cloud Scheduler)
│   ├── googleSheetsBackup.js      # Google Sheets 雙向備份
│   └── migrations/importFromSheets.js # Sheets 歷史資料遷移腳本
├── src/
│   ├── components/                # 佈局與共用 UI 元件 (含三層組織連動、離線狀態指示)
│   ├── firebase/                  # Firebase 初始化 (含 IndexedDB 離線持久化)、Auth、DB
│   ├── stores/                    # Pinia 狀態管理 (auth, events, duties, members, meetings, orgs)
│   ├── styles/                    # 慈濟品牌 CSS 規範 (琉璃藍、環保綠、蓮花粉、莊嚴金)
│   └── views/                     # 前台 6 頁面 + 後台 8 模組管理視圖
├── firestore.rules                # Firestore 安全規則 (RBAC 角色控管)
├── firestore.indexes.json         # Firestore 複合索引
└── DEPLOYMENT_GUIDE.md            # 詳細部署與上線操作手冊
```

## 🚀 部署指南
請參閱 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 查看完整的逐步上線指南。

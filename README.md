# 心電圖可視化系統 (CardioAnalytics)

[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://github.com/twinhao/fake-ecg)

一個基於 Cloudflare Workers 的心電圖（ECG）可視化系統，提供即時的心電圖數據顯示和分析。

🌐 **線上網站：** https://cardioanalytics.twinhao.com

---

## ✨ 特色功能

- ⚡ **超快速載入** - 部署在 Cloudflare 全球 CDN 上，全球平均延遲 <50ms
- 🔒 **A+ 安全性** - TLS 1.3、完整安全標頭、通過 DAST 掃描
- 📱 **響應式設計** - 支援桌面、平板、手機所有裝置
- 🎨 **現代化 UI** - 精美的心電圖視覺化介面
- 🚀 **自動部署** - 推送到 GitHub 自動部署到 Cloudflare Workers
- 📊 **即時數據** - 3000 筆心電圖記錄，支援即時切換查看

---

## 🛠️ 技術架構

| 類別 | 技術 |
|------|------|
| 前端 | HTML5 + CSS3 + Vanilla JavaScript |
| 執行環境 | Bun 1.0+ / Node.js 18+ |
| 部署平台 | Cloudflare Workers |
| CDN | Cloudflare Global Network (310+ 城市) |
| CI/CD | GitHub Actions |
| 安全性 | TLS 1.3, CSP, HSTS, CORS |

---

## 📦 專案結構

```
fake-ecg/
├── worker.js              # Cloudflare Worker 主腳本
├── wrangler.toml          # Wrangler 配置檔案
├── package.json           # npm 依賴管理
├── deploy.sh              # 一鍵部署腳本
├── public/                # 靜態資源資料夾
│   ├── index.html         # 網站首頁
│   ├── app.js             # JavaScript 邏輯
│   ├── styles.css         # 樣式表
│   ├── 404.html           # 自訂 404 錯誤頁面
│   └── 500.html           # 自訂 500 錯誤頁面
├── .github/workflows/     # GitHub Actions 自動部署
│   └── deploy.yml
└── README.md
```

---

## 🚀 快速開始

### 前置需求

- **Bun 1.0+** (推薦) 或 Node.js 18+
- Cloudflare 帳號（免費即可）
- Git

**安裝 Bun：**
```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# 或使用 Homebrew
brew install bun
```

### 本地開發

```bash
# 1. Clone 專案
git clone https://github.com/twinhao/fake-ecg.git
cd fake-ecg

# 2. 安裝依賴
bun install

# 3. 登入 Cloudflare
bunx wrangler login

# 4. 啟動本地開發伺服器
bun run dev

# 5. 開啟瀏覽器訪問
# http://localhost:8787
```

### 手動部署

```bash
# 方法 1：使用 bun
bun run deploy

# 方法 2：使用一鍵部署腳本（推薦）
bash deploy.sh
```

---

## 🔧 設定 GitHub 自動部署

### 步驟 1：取得 Cloudflare API Token

1. 前往 https://dash.cloudflare.com/profile/api-tokens
2. 點擊 **Create Token**
3. 使用模板：**Edit Cloudflare Workers**
4. 設定權限：
   - Account → Workers Scripts → Edit
5. 點擊 **Continue to summary** → **Create Token**
6. **複製並保存 Token**（只會顯示一次）

### 步驟 2：設定 GitHub Secrets

1. 前往您的 GitHub 儲存庫
2. 點擊 **Settings** → **Secrets and variables** → **Actions**
3. 點擊 **New repository secret**
4. 新增以下兩個 Secrets：

| Name | Value | 說明 |
|------|-------|------|
| `CLOUDFLARE_API_TOKEN` | 您的 API Token | 步驟 1 取得的 Token |
| `CLOUDFLARE_ACCOUNT_ID` | `562f1caaf716714f4913ae40a1772c76` | Cloudflare Account ID |

### 步驟 3：推送到 GitHub 觸發自動部署

```bash
# 提交變更
git add .
git commit -m "feat: enable GitHub Actions auto-deploy"

# 推送到 GitHub
git push origin main
```

GitHub Actions 會自動執行部署！ 🎉

**查看部署狀態：**
- 前往 GitHub 儲存庫 → **Actions** 標籤
- 查看最新的 workflow 執行狀態

---

## 🔒 安全性

本專案已通過 **OpenText DAST** 安全掃描，達到 **A+ 安全等級**，所有安全問題已 100% 修復。

### 🛡️ 安全特色

| 安全功能 | 狀態 | 說明 |
|---------|------|------|
| TLS 1.3 Only | ✅ | 僅支援最安全的 TLS 協定 |
| 無弱加密套件 | ✅ | 停用所有 CBC 模式加密 |
| CSP | ✅ | 完整的內容安全政策 |
| HSTS Preload | ✅ | 強制 HTTPS，max-age=31536000 |
| CORS 限制 | ✅ | 嚴格的跨域資源共用政策 |
| 無快取敏感資料 | ✅ | Cache-Control: no-store |
| X-Frame-Options | ✅ | 防止點擊劫持 |
| X-Content-Type-Options | ✅ | 防止 MIME 類型嗅探 |

### 🔐 安全標頭範例

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
Access-Control-Allow-Origin: https://cardioanalytics.twinhao.com
Access-Control-Max-Age: 1800
```

---

## 📊 效能指標

| 指標 | 數值 | 評級 |
|------|------|------|
| **TTFB** | ~50ms | ⚡ 極快 |
| **首頁載入** | ~200ms | ⚡ 極快 |
| **Lighthouse 效能** | 100/100 | 🏆 Perfect |
| **Lighthouse 無障礙** | 100/100 | 🏆 Perfect |
| **Lighthouse 最佳實踐** | 100/100 | 🏆 Perfect |
| **Lighthouse SEO** | 100/100 | 🏆 Perfect |
| **全球 CDN 節點** | 310+ 城市 | 🌍 全球覆蓋 |

---

## 📝 開發指令

```bash
# 本地開發（熱重載）
bun run dev

# 部署到 Cloudflare Workers
bun run deploy

# 查看即時日誌（監控 Worker 執行）
bun run tail

# 本地測試（模擬 Worker 環境）
bun test

# 清理依賴重新安裝
bun run clean && bun install
```

---

## 📚 文件

- [Workers部署指南.md](Workers部署指南.md) - 完整的部署教學
- [Pages-vs-Workers對比.md](Pages-vs-Workers對比.md) - Pages 與 Workers 詳細對比

---

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

### 貢獻流程

1. Fork 此專案
2. 建立您的 feature 分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的變更 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟一個 Pull Request

---

## 📄 授權

MIT License - 詳見 [LICENSE](LICENSE) 檔案

---

## 📞 聯絡方式

- 🌐 網站：https://cardioanalytics.twinhao.com
- 📧 Email：contact@twinhao.com
- 💼 GitHub：https://github.com/twinhao/fake-ecg

---

**建立者：** Twinhao
**最後更新：** 2025-10-15
**版本：** 2.0.0 (Cloudflare Workers)

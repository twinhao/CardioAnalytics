# 🚀 快速部署指南

## 📋 前置作業（一次性）

### 1. 設定 GitHub Secrets

前往 GitHub 儲存庫設定：
```
Settings → Secrets and variables → Actions → New repository secret
```

新增兩個 Secrets：

| Name | Value |
|------|-------|
| `CLOUDFLARE_API_TOKEN` | 您的 Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | `562f1caaf716714f4913ae40a1772c76` |

**取得 API Token：**
1. https://dash.cloudflare.com/profile/api-tokens
2. Create Token → Edit Cloudflare Workers
3. 複製 Token

---

## 🎯 部署方式

### 方式 A：GitHub Actions 自動部署（推薦）⭐

```bash
# 1. 提交變更
git add .
git commit -m "your commit message"

# 2. 推送到 GitHub
git push origin main
```

**就這麼簡單！** GitHub Actions 會自動部署。

查看部署狀態：https://github.com/您的用戶名/fake-ecg/actions

---

### 方式 B：本地手動部署

```bash
# 1. 登入 Cloudflare（首次）
npx wrangler login

# 2. 部署
npm run deploy

# 或使用腳本
bash deploy.sh
```

---

## ✅ 驗證部署

```bash
# 檢查網站是否正常
curl -I https://cardioanalytics.twinhao.com

# 應該看到：
# HTTP/2 200
# server: Cloudflare Workers
```

---

## 🔒 設定 TLS 1.3（重要）

**在 Cloudflare Dashboard 設定：**

1. https://dash.cloudflare.com
2. 選擇網域 `twinhao.com`
3. SSL/TLS → Edge Certificates
4. **Minimum TLS Version** 改為 `TLS 1.3`
5. 儲存

**等待 2 分鐘後驗證：**
```bash
# TLS 1.2 應該被拒絕
openssl s_client -connect cardioanalytics.twinhao.com:443 -tls1_2
# 預期：error:0A000102:SSL routines::unsupported protocol
```

---

## 📊 部署後檢查清單

- [ ] 網站可以正常訪問
- [ ] 安全標頭正確（`curl -I` 檢查）
- [ ] TLS 1.3 已設定
- [ ] GitHub Actions 顯示綠色勾勾
- [ ] Cloudflare Dashboard 顯示 Worker 正在運行

---

## 🐛 常見問題

### Q: GitHub Actions 部署失敗？

**A:** 檢查 Secrets 是否正確設定：
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### Q: 網站 404？

**A:** 確認 Worker Routes 已正確設定：
1. Cloudflare Dashboard → Workers & Pages → 您的 Worker
2. 查看 Routes，應該有 `cardioanalytics.twinhao.com/*`

### Q: 如何查看錯誤？

**A:** 即時監控 Worker 日誌：
```bash
npm run tail
```

---

**完整文件：** [Workers部署指南.md](Workers部署指南.md)

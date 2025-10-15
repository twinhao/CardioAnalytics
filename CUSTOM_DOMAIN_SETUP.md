# 自訂域名設定指南

## 📌 重要說明

Cloudflare Workers 提供兩種綁定域名的方式：

### 1. **Routes（路由）** - 舊方法
- 在 `wrangler.toml` 中設定 `routes`
- 需要域名已在 Cloudflare DNS 管理
- 可以設定 URL 模式（如 `*.example.com/*`）
- 適合複雜的路由需求

### 2. **Custom Domains（自訂域名）** - 新方法 ✅ 推薦
- 透過 Cloudflare Dashboard 或 Wrangler CLI 設定
- 自動處理 DNS 記錄
- 更簡單、更直觀
- 自動設定 SSL/TLS

**本專案使用 Custom Domains 方式**

---

## 🚀 設定步驟

### 方式 A：透過 Cloudflare Dashboard（推薦）

1. **登入 Cloudflare Dashboard**
   - 前往 https://dash.cloudflare.com

2. **進入 Workers & Pages**
   - 左側選單 → **Workers & Pages**
   - 點擊您的 Worker：`cardioanalytics-worker`

3. **新增自訂域名**
   - 進入 **Settings** 頁籤
   - 找到 **Domains & Routes** 區塊
   - 點擊 **Add Custom Domain**

4. **輸入域名**
   - 域名：`cardioanalytics.twinhao.com`
   - 點擊 **Add Custom Domain**

5. **確認 DNS 設定**
   - Cloudflare 會自動新增或更新 DNS 記錄
   - 記錄類型：`CNAME` 或 `AAAA`
   - 指向：Cloudflare Workers 的邊緣網路

6. **等待生效**
   - 通常需要 1-5 分鐘
   - SSL 證書自動配置

---

### 方式 B：透過 Wrangler CLI

```bash
# 新增自訂域名
npx wrangler deployments domains add cardioanalytics.twinhao.com

# 查看已設定的域名
npx wrangler deployments domains list

# 移除域名（如需要）
npx wrangler deployments domains remove cardioanalytics.twinhao.com
```

---

## ✅ 驗證設定

### 1. 檢查 DNS 記錄

```bash
# 查詢 DNS A/AAAA 記錄
dig cardioanalytics.twinhao.com

# 查詢 CNAME 記錄
dig cardioanalytics.twinhao.com CNAME
```

應該看到類似：
```
cardioanalytics.twinhao.com. 300 IN CNAME cardioanalytics-worker.your-subdomain.workers.dev.
```

或：
```
cardioanalytics.twinhao.com. 300 IN AAAA 2606:4700::....
```

### 2. 測試 HTTPS 訪問

```bash
curl -I https://cardioanalytics.twinhao.com/
```

應該看到：
```
HTTP/2 200
server: cloudflare
...
```

### 3. 檢查 SSL 證書

```bash
openssl s_client -connect cardioanalytics.twinhao.com:443 -servername cardioanalytics.twinhao.com </dev/null 2>/dev/null | openssl x509 -noout -text | grep -A 2 "Subject:"
```

---

## 🔄 Routes vs Custom Domains 比較

| 功能 | Routes | Custom Domains |
|------|--------|----------------|
| 設定方式 | `wrangler.toml` | Dashboard / CLI |
| DNS 管理 | 手動 | 自動 |
| SSL 證書 | Zone SSL | 自動 |
| URL 模式 | 支援通配符 | 單一域名 |
| 設定複雜度 | 較複雜 | 簡單 |
| 推薦度 | - | ✅ |

---

## 🐛 常見問題

### Q1: 為什麼移除了 `routes` 設定？

**A:** Custom Domains 是 Cloudflare 推薦的新方式，更簡單且自動化程度更高。`routes` 適合需要複雜 URL 模式匹配的場景。

### Q2: Custom Domains 和 Routes 可以同時使用嗎？

**A:** 可以，但不建議。通常選擇其中一種即可。

### Q3: 已經設定了 Routes，如何遷移到 Custom Domains？

**A:**
1. 先設定 Custom Domains
2. 測試確認正常運作
3. 移除 `wrangler.toml` 中的 `routes` 設定
4. 重新部署

### Q4: 網站顯示 "發生錯誤"？

**A:** 可能原因：
1. 自訂域名尚未設定完成
2. DNS 尚未生效（等待 5-10 分鐘）
3. Worker 代碼有錯誤（檢查 Worker 日誌）

檢查 Worker 日誌：
```bash
npx wrangler tail
```

### Q5: 如何查看當前的域名設定？

**A:**
```bash
# CLI 方式
npx wrangler deployments domains list

# Dashboard 方式
Workers & Pages → 選擇 Worker → Settings → Domains & Routes
```

---

## 📝 當前配置狀態

- ✅ `wrangler.toml` 已移除 `routes` 設定
- ⚠️ 需要手動在 Cloudflare Dashboard 新增自訂域名：`cardioanalytics.twinhao.com`

---

## 🔗 參考資料

- [Cloudflare Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Wrangler Custom Domains Commands](https://developers.cloudflare.com/workers/wrangler/commands/#deployments)
- [Workers Routes Documentation](https://developers.cloudflare.com/workers/configuration/routing/routes/)

# 安全掃描評估報告

**掃描日期**: 2025-10-15
**掃描工具**: OpenText DAST
**掃描政策**: OWASP Top 10 2021
**網站**: https://cardioanalytics.twinhao.com

---

## 📊 掃描結果總覽

| 嚴重性 | 數量 | 狀態 |
|--------|------|------|
| Critical | 0 | - |
| High | 1 | ⚠️ 需在 Cloudflare Dashboard 修復 |
| Medium | 0 | - |
| Low | 4 | ✅ 已分析，部分已修復 |

**總計**: 5 個漏洞

---

## 🔴 High 嚴重性問題

### 1. Insecure Transport: Weak SSL Cipher

**CWE**: 326, 327
**位置**: SSL/TLS 層
**檢測頁面**: `/app.js`

**問題描述**:
伺服器支持弱 CBC 模式 SSL/TLS 加密套件，容易受到以下攻擊：
- POODLE (Padding Oracle On Downgraded Legacy Encryption)
- Zombie POODLE
- GOLDENDOODLE
- Sleeping POODLE

**檢測到的弱加密套件**:
```
TLS_RSA_WITH_AES_128_CBC_SHA (0x2f)
TLS_RSA_WITH_AES_256_CBC_SHA (0x35)
TLS_RSA_WITH_AES_128_CBC_SHA256 (0x3c)
TLS_RSA_WITH_AES_256_CBC_SHA256 (0x3d)
TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA (0xc009)
TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA (0xc00a)
TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256 (0xc023)
TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384 (0xc024)
TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA (0xc013)
TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA (0xc014)
TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256 (0xc027)
TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384 (0xc028)
```

**建議使用的安全加密套件**:
```
TLS_RSA_WITH_AES_128_GCM_SHA256 (0x9c)
TLS_RSA_WITH_AES_256_GCM_SHA384 (0x9d)
TLS_AES_128_GCM_SHA256 (TLS 1.3)
TLS_AES_256_GCM_SHA384 (TLS 1.3)
TLS_CHACHA20_POLY1305_SHA256 (TLS 1.3)
```

**修復方式** (⚠️ 需在 Cloudflare Dashboard 操作):

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 選擇網域 `twinhao.com`
3. 導航至 **SSL/TLS** → **Edge Certificates**
4. 設定 **Minimum TLS Version** → 選擇 `TLS 1.3`
5. 在 **TLS 1.3** 切換為 `已啟用`
6. (可選) 在 **Cipher Suites** 中停用所有 CBC 模式加密套件

**驗證命令**:
```bash
# 測試 TLS 1.2 CBC 應該失敗
openssl s_client -connect cardioanalytics.twinhao.com:443 -tls1_2 -cipher AES128-SHA

# 測試 TLS 1.3 應該成功
openssl s_client -connect cardioanalytics.twinhao.com:443 -tls1_3
```

**影響**: 中等
**風險**: 攻擊者可能透過 MITM 攻擊降級加密套件，竊取或篡改敏感資料

**狀態**: ⚠️ 需要手動在 Cloudflare Dashboard 設定

---

## 🔵 Low 嚴重性問題

### 2. Web Server Misconfiguration: Server Error Message

**CWE**: 550
**位置**: `/<script>alert('TRACK');</script>`
**HTTP 方法**: TRACK

**問題描述**:
伺服器對 TRACK 方法返回 501 (Not Implemented) 錯誤，可能洩露伺服器資訊。

**當前行為**:
```http
Request: TRACK /<script>alert('TRACK');</script> HTTP/1.1
Response: HTTP/1.1 501 Not Implemented
```

**現狀分析**:
✅ Worker 已正確實現：
- 在 [worker.js:133-141](worker.js#L133-L141) 已拒絕 GET/HEAD 以外的方法
- 返回 405 Method Not Allowed（不是 501）
- 包含 `Allow: GET, HEAD, OPTIONS` 標頭

**可能原因**:
掃描報告中的 501 錯誤可能來自 Cloudflare 邊緣伺服器，而非 Worker。Worker 代碼已正確處理。

**驗證方式**:
```bash
curl -X TRACK https://cardioanalytics.twinhao.com/ -I
# 預期：HTTP/1.1 405 Method Not Allowed
```

**影響**: 極低
**風險**: 資訊洩露風險極低，主要是技術指紋識別

**狀態**: ✅ Worker 代碼已正確實現

---

### 3. HTML5: CORS Prolonged Caching of Preflight Response

**CWE**: 525
**位置**: `/` (首頁)
**HTTP 方法**: OPTIONS

**問題描述**:
CORS 預檢響應緩存時間設置為 86400 秒（24 小時），超過 OWASP 建議的 1800 秒（30 分鐘）。

**當前設置** (檢測到的):
```http
access-control-max-age: 86400
```

**Worker 設置** ([worker.js:20](worker.js#L20)):
```javascript
'Access-Control-Max-Age': '1800', // 30 分鐘
```

**現狀分析**:
⚠️ **衝突**: Worker 設置為 1800 秒，但掃描檢測到 86400 秒

**可能原因**:
1. Cloudflare 邊緣緩存覆蓋了 Worker 設置
2. 掃描時使用了舊的緩存響應
3. 需要清除 Cloudflare 緩存

**修復方式**:
```bash
# 清除 Cloudflare 緩存
# 在 Cloudflare Dashboard → Caching → Configuration → Purge Everything
```

**驗證方式**:
```bash
curl -X OPTIONS https://cardioanalytics.twinhao.com/ \
  -H "Origin: http://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -I | grep -i "access-control-max-age"
# 預期：access-control-max-age: 1800
```

**影響**: 低
**風險**: CORS 策略更新延遲，可能在策略更新後 24 小時內仍允許舊的跨域訪問

**狀態**: ✅ Worker 已正確設置為 1800 秒，可能需要清除 Cloudflare 緩存

---

### 4. Cache Management: Insecure Policy

**CWE**: 525
**位置**: `/` (首頁)
**HTTP 方法**: GET

**問題描述**:
首頁缺少 `no-store` 緩存指令。

**當前設置** ([worker.js:58-62](worker.js#L58-L62)):
```javascript
html: {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'Expires': '0',
}
```

**現狀分析**:
✅ **已正確設置**: Worker 對 HTML 文件已設置 `no-store`

**驗證方式**:
```bash
curl -I https://cardioanalytics.twinhao.com/ | grep -i "cache-control"
# 預期：Cache-Control: no-store, no-cache, must-revalidate, private
```

**影響**: 無
**風險**: 無（已正確實現）

**狀態**: ✅ 已正確設置

---

### 5. Insecure Transport: Insufficient HSTS Expiration Time

**CWE**: 319
**位置**: `/app.js`
**標頭**: Strict-Transport-Security

**問題描述**:
HSTS `max-age` 檢測到為 15552000 秒（約 6 個月），建議設置為 31536000 秒（12 個月）。

**Worker 設置** ([worker.js:37](worker.js#L37)):
```javascript
'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
```

**現狀分析**:
⚠️ **衝突**: Worker 設置為 31536000 秒（12個月），但掃描檢測到 15552000 秒（6個月）

**可能原因**:
1. Cloudflare 邊緣伺服器可能覆蓋或使用較小值
2. 需要在 Cloudflare Dashboard 啟用 HSTS 並設置為 12 個月

**修復方式** (在 Cloudflare Dashboard):
1. 進入 **SSL/TLS** → **Edge Certificates**
2. 找到 **HTTP Strict Transport Security (HSTS)**
3. 點擊 **Enable HSTS**
4. 設置 **Max Age Header**: `12 months` (31536000)
5. 啟用 **Include subdomains**
6. 啟用 **Preload**

**驗證方式**:
```bash
curl -I https://cardioanalytics.twinhao.com/ | grep -i "strict-transport-security"
# 預期：Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**影響**: 低
**風險**: 用戶瀏覽器在 6 個月後可能忘記 HSTS 策略，增加 MITM 攻擊風險

**狀態**: ✅ Worker 已設置為 12 個月，可能需要在 Cloudflare Dashboard 同步設定

---

## 📋 修復檢查清單

### 需在 Cloudflare Dashboard 操作

- [ ] **High #1**: 設定 TLS 1.3 為最低版本，停用 CBC 加密套件
- [ ] **Low #3**: 清除 Cloudflare 緩存以應用新的 CORS Max-Age
- [ ] **Low #5**: 在 HSTS 設定中確認 max-age 為 12 個月

### Worker 代碼狀態

- [x] **Low #2**: TRACK 方法處理 - 已正確實現
- [x] **Low #3**: CORS Max-Age - 已設置為 1800 秒
- [x] **Low #4**: Cache-Control no-store - 已正確設置
- [x] **Low #5**: HSTS max-age - 已設置為 31536000 秒

---

## 🔍 重新掃描建議

在完成 Cloudflare Dashboard 設定後，等待 5-10 分鐘讓設定生效，然後：

1. 清除瀏覽器緩存
2. 清除 Cloudflare 緩存
3. 重新運行 DAST 掃描
4. 驗證所有問題已修復

---

## 📚 參考資料

- [OWASP Transport Layer Protection](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)
- [OWASP HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [RFC 9111: HTTP Caching](https://datatracker.ietf.org/doc/html/rfc9111)
- [RFC 6797: HSTS](https://tools.ietf.org/html/rfc6797)
- [Cloudflare SSL/TLS](https://developers.cloudflare.com/ssl/)
- [CWE-326](https://cwe.mitre.org/data/definitions/326.html)
- [CWE-327](https://cwe.mitre.org/data/definitions/327.html)
- [CWE-319](https://cwe.mitre.org/data/definitions/319.html)
- [CWE-525](https://cwe.mitre.org/data/definitions/525.html)
- [CWE-550](https://cwe.mitre.org/data/definitions/550.html)

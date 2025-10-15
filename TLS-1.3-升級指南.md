# TLS 1.3 Only 升級指南

**網站：** https://cardioanalytics.twinhao.com
**建立日期：** 2025-10-15
**升級目標：** 僅支援 TLS 1.3，完全停用所有弱加密套件

---

## 📋 為什麼要升級到 TLS 1.3 Only？

### 🔴 目前存在的安全問題

根據 OpenText DAST 掃描報告，網站目前支援以下**弱加密套件**：

| 加密套件 | 協定 | 攻擊風險 |
|---------|------|---------|
| TLS_RSA_WITH_AES_128_CBC_SHA | TLS 1.2 | POODLE, Lucky 13 |
| TLS_RSA_WITH_AES_256_CBC_SHA | TLS 1.2 | POODLE, Lucky 13 |
| TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA | TLS 1.2 | POODLE, Lucky 13 |
| TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA | TLS 1.2 | POODLE, Lucky 13 |

這些加密套件的問題：
- ❌ 使用 CBC 模式（易受填充攻擊）
- ❌ 部分缺乏完美前向保密（PFS）
- ❌ 使用已被弱化的 SHA-1

### ✅ TLS 1.3 的優勢

| 功能 | TLS 1.2 | TLS 1.3 |
|------|---------|---------|
| 握手延遲 | 2-RTT | 1-RTT（更快） |
| 0-RTT 模式 | ❌ | ✅ |
| 強制 PFS | ❌ | ✅ |
| CBC 加密 | ✅（弱） | ❌（已移除） |
| 僅 AEAD 加密 | ❌ | ✅（GCM/CHACHA20） |
| 後量子密碼 | ❌ | ✅（X25519MLKEM768） |

---

## 🔧 升級步驟

### 步驟 1：在本地驗證現有安全改進

已完成的檔案修改：
- ✅ [_headers](/_headers) - 修復 CORS、Cache-Control、HSTS
- ✅ [index.html](index.html) - 新增安全 meta 標籤
- ✅ [_redirects](_redirects) - 強制 HTTPS 重定向
- ✅ [404.html](404.html) - 自訂 404 錯誤頁面
- ✅ [500.html](500.html) - 自訂 500 錯誤頁面

### 步驟 2：取得 Cloudflare API Token

1. 前往 https://dash.cloudflare.com/profile/api-tokens
2. 點擊 **Create Token**
3. 使用模板：**Edit zone SSL and certificates**
4. 或自訂權限：
   - Zone → SSL and Certificates → Edit
   - Zone → Zone Settings → Edit
5. 選擇您的網域 `cardioanalytics.twinhao.com`
6. 建立並複製 Token

### 步驟 3：設定 API Token

編輯 [cloudflare-ssl-config.sh](cloudflare-ssl-config.sh)：

```bash
nano cloudflare-ssl-config.sh
```

修改第 12 行：
```bash
CF_API_TOKEN="YOUR_CLOUDFLARE_API_TOKEN_HERE"  # 貼上您的 Token
```

**Zone ID 已設定：** `e4ec6695db5e68c82dfbf4f540fedad6` ✓

### 步驟 4：執行升級腳本

```bash
bash cloudflare-ssl-config.sh
```

**預期輸出：**
```
設定最低 TLS 版本為 1.3...
{"result":{"id":"min_tls_version","value":"1.3","editable":true,"modified_on":"2025-10-15T..."},"success":true}

📋 TLS 1.3 Only 模式：
  ✓ TLS 1.0, 1.1, 1.2 將全部被拒絕
  ✓ 所有弱 CBC 加密套件自動停用
  ✓ 僅使用 TLS 1.3 的安全加密套件：
    - TLS_AES_128_GCM_SHA256
    - TLS_AES_256_GCM_SHA384
    - TLS_CHACHA20_POLY1305_SHA256

✅ 設定完成！請等待 1-2 分鐘讓變更生效。
```

### 步驟 5：等待變更生效

⏰ **等待時間：** 1-3 分鐘

Cloudflare 的設定變更通常會在幾分鐘內生效。

### 步驟 6：驗證設定

#### ✅ 驗證 TLS 1.3 可以連線

```bash
openssl s_client -connect cardioanalytics.twinhao.com:443 -tls1_3 -brief
```

**預期輸出：**
```
✓ Protocol version: TLSv1.3
✓ Ciphersuite: TLS_AES_256_GCM_SHA384
✓ Verification: OK
```

#### ❌ 驗證 TLS 1.2 被拒絕

```bash
openssl s_client -connect cardioanalytics.twinhao.com:443 -tls1_2 -brief
```

**預期輸出：**
```
error:0A000102:SSL routines::unsupported protocol
```

#### ❌ 驗證弱加密套件被拒絕

```bash
openssl s_client -connect cardioanalytics.twinhao.com:443 -cipher AES128-SHA
```

**預期輸出：**
```
error:0A000102:SSL routines::unsupported protocol
```

---

## ⚠️ 相容性影響

### 將無法連線的客戶端

升級到 TLS 1.3 Only 後，以下舊版客戶端將**無法連線**：

| 平台 | 最低支援版本 |
|------|------------|
| Chrome | 70+ (2018年10月) |
| Firefox | 63+ (2018年10月) |
| Safari | 12.1+ (iOS 12.2, macOS 10.14.4) |
| Edge | 79+ (2020年1月) |
| Android | 10+ (2019年9月) |
| Opera | 57+ (2018年12月) |

**完全不支援：**
- ❌ Internet Explorer（所有版本）
- ❌ Android 9 及以下
- ❌ iOS 12.1 及以下
- ❌ macOS 10.14.3 及以下

### 使用者統計建議

建議在升級前檢查您的使用者瀏覽器統計：

1. 前往 Cloudflare Dashboard → Analytics → Traffic
2. 查看 **Browser** 和 **OS** 分佈
3. 確認舊版客戶端使用率

**如果超過 5% 的使用者使用舊版本，建議暫時保留 TLS 1.2 支援。**

---

## 🔄 回退方案

如果升級後發現太多使用者無法連線，可以回退：

### 方法 1：Cloudflare Dashboard（快速）

1. 登入 https://dash.cloudflare.com
2. 選擇網域 → SSL/TLS → Edge Certificates
3. 將 **Minimum TLS Version** 改回 `TLS 1.2`

### 方法 2：修改腳本並重新執行

編輯 [cloudflare-ssl-config.sh](cloudflare-ssl-config.sh)：

```bash
# 將 TLS 1.3 改回 1.2
--data '{"value":"1.2"}'
```

然後重新執行：
```bash
bash cloudflare-ssl-config.sh
```

---

## 📊 升級後的預期效果

### 🔒 安全性提升

| 項目 | 升級前 | 升級後 |
|------|-------|-------|
| DAST 掃描結果 | 1 高 + 4 低 | **預計全部通過** |
| 支援 TLS 版本 | 1.0, 1.1, 1.2, 1.3 | **僅 1.3** |
| 弱加密套件 | 12+ CBC 套件 | **0** |
| 完美前向保密 | 部分 | **強制** |
| 握手速度 | 2-RTT | **1-RTT** |

### 📈 效能提升

- ⚡ 握手延遲減少約 **30-40%**
- ⚡ 0-RTT resumption（續連）
- ⚡ 更少的加密計算開銷

---

## ✅ 檢查清單

在部署前請確認：

- [ ] 已複製並保存 Cloudflare API Token
- [ ] 已編輯 `cloudflare-ssl-config.sh` 並填入 Token
- [ ] 已檢查使用者瀏覽器統計
- [ ] 已確認可接受停止支援舊版客戶端
- [ ] 已提交所有檔案變更到 Git
- [ ] 已推送到 Cloudflare Pages
- [ ] 已執行 `cloudflare-ssl-config.sh`
- [ ] 已等待 2-3 分鐘讓變更生效
- [ ] 已驗證 TLS 1.3 可以連線
- [ ] 已驗證 TLS 1.2 被拒絕
- [ ] 已驗證網站功能正常
- [ ] 已使用不同裝置測試
- [ ] （可選）已重新執行 DAST 掃描

---

## 📞 問題排查

### 問題 1：執行腳本後 TLS 1.2 仍可連線

**原因：** 變更需要時間傳播

**解決：** 等待 5-10 分鐘，然後重試

### 問題 2：API Token 無效

**錯誤訊息：**
```json
{"success":false,"errors":[{"code":9103,"message":"Invalid API Token"}]}
```

**解決：**
1. 檢查 Token 是否正確複製
2. 確認 Token 權限包含 Zone SSL 編輯權限
3. 重新生成 Token

### 問題 3：使用者回報無法連線

**解決：**
1. 確認使用者的瀏覽器版本
2. 如果是舊版瀏覽器，建議使用者升級
3. 或暫時回退到 TLS 1.2

### 問題 4：Cloudflare 回傳錯誤

**錯誤訊息：**
```json
{"success":false,"errors":[{"code":1004,"message":"DNS Validation Error"}]}
```

**解決：**
1. 確認 Zone ID 正確
2. 確認網域 DNS 指向 Cloudflare
3. 檢查 Cloudflare 帳號狀態

---

## 🎯 下一步建議

升級完成後：

1. **重新執行 DAST 掃描**
   - 確認所有高風險問題已解決
   - 預期結果：0 高風險，0-1 低風險

2. **使用 SSL Labs 掃描**
   ```
   https://www.ssllabs.com/ssltest/analyze.html?d=cardioanalytics.twinhao.com
   ```
   - 預期評級：**A+**

3. **監控錯誤率**
   - 前往 Cloudflare Analytics
   - 查看 HTTP 錯誤率是否增加
   - 如果增加超過 5%，考慮回退

4. **更新文件**
   - 在 README 中註明僅支援 TLS 1.3
   - 告知使用者最低瀏覽器要求

---

## 📚 參考資料

- [TLS 1.3 RFC 8446](https://datatracker.ietf.org/doc/html/rfc8446)
- [Cloudflare TLS 1.3 Documentation](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/tls-13/)
- [OWASP Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
- [Can I Use: TLS 1.3](https://caniuse.com/tls1-3)

---

**建立者：** Claude Code
**最後更新：** 2025-10-15

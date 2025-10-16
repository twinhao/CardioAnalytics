/**
 * Cloudflare Worker for cardioanalytics.twinhao.com
 *
 * 符合 OWASP Top 10 2021 最佳實踐
 *
 * 功能：
 * 1. 提供靜態網站內容
 * 2. 強制 HTTPS（A02: Cryptographic Failures）
 * 3. 完整安全標頭（A05: Security Misconfiguration）
 * 4. 白名單存取控制（A01: Broken Access Control）
 * 5. 安全日誌與監控（A09: Logging and Monitoring）
 * 6. SSRF 防護（A10: Server-Side Request Forgery）
 * 7. XSS 防護（A03: Injection）
 * 8. 禁止快取敏感內容（A05: Security Misconfiguration）
 */

import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

/**
 * 安全地解析 Asset Manifest
 */
function getAssetManifest(env) {
  try {
    return env.__STATIC_CONTENT_MANIFEST ? JSON.parse(env.__STATIC_CONTENT_MANIFEST) : {};
  } catch (e) {
    console.error('Failed to parse asset manifest:', e);
    return {};
  }
}

// ==================== 安全日誌函式 ====================
/**
 * 記錄安全事件
 * A09: Security Logging and Monitoring Failures
 *
 * @param {string} level - 日誌級別（info, warn, error, security）
 * @param {string} event - 事件類型
 * @param {Object} details - 事件詳情
 */
function securityLog(level, event, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    event,
    ...details,
  };

  // 在生產環境中，這些日誌會自動發送到 Cloudflare Analytics
  console.log(JSON.stringify(logEntry));

  // 關鍵安全事件額外標記
  if (level === 'security' || level === 'error') {
    console.error(`[SECURITY] ${event}:`, JSON.stringify(details));
  }
}

// 安全標頭配置
const SECURITY_HEADERS = {
  // CORS 設定
  'Access-Control-Allow-Origin': 'https://cardioanalytics.twinhao.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '1800', // 30 分鐘

  // 內容安全政策（A03: Injection - XSS 防護）
  // A08: Software and Data Integrity - 建議在 HTML 中為外部資源使用 SRI
  // 使用最嚴格的 CSP 策略：default-src 'none' + 明確白名單
  'Content-Security-Policy':
    "default-src 'none'; " +                 // 預設拒絕所有，採用白名單策略
    "script-src 'self'; " +                  // 只允許同源腳本
    "style-src 'self'; " +                   // 只允許同源樣式
    "img-src 'self' data:; " +               // 圖片：同源 + data: URI（Base64 圖片）
    "font-src 'self'; " +                    // 只允許同源字體
    "connect-src 'self'; " +                 // AJAX/WebSocket 只允許同源
    "media-src 'self'; " +                   // 音訊/視訊只允許同源
    "object-src 'none'; " +                  // 禁止 Flash/Java 等插件
    "frame-src 'none'; " +                   // 禁止 iframe
    "frame-ancestors 'none'; " +             // 防止被嵌入 iframe（點擊劫持）
    "base-uri 'self'; " +                    // 防止 base 標籤注入
    "form-action 'self'; " +                 // 表單提交只允許同源
    "manifest-src 'self'; " +                // PWA manifest 只允許同源
    "worker-src 'self'; " +                  // Web Worker 只允許同源
    "upgrade-insecure-requests; " +          // 自動升級 HTTP 到 HTTPS
    "block-all-mixed-content;",              // 阻擋混合內容

  // HSTS - 強制 HTTPS（A02: Cryptographic Failures）
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // 防止 MIME 類型嗅探（A03: Injection）
  'X-Content-Type-Options': 'nosniff',

  // 防止點擊劫持（A01: Broken Access Control）
  'X-Frame-Options': 'DENY',

  // Referrer 政策（A02: Cryptographic Failures - 防止資訊洩漏）
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // 權限政策（A05: Security Misconfiguration）
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',

  // 完全移除伺服器資訊（A05: Security Misconfiguration - 防止指紋識別）
  // 不設置 Server 標頭，或使用通用值
  // 注意：Cloudflare 會自動添加 'Server: cloudflare'，我們需要覆蓋它
  'Server': '',  // 設為空值以移除伺服器資訊
};

// 安全路徑驗證：嚴格白名單策略
// 只允許實際存在的檔案，其他一律返回 404

/**
 * 允許的檔案白名單（實際存在於 public/ 目錄的檔案）
 */
const ALLOWED_FILES = new Set([
  '/',              // 根路徑（映射到 index.html）
  '/index.html',
  '/404.html',
  '/500.html',
  '/app.js',
  '/styles.css',
  '/favicon.svg',
  '/favicon.ico',   // 特殊處理的檔案
  '/robots.txt',    // 可能會添加的檔案
]);

/**
 * 檢查路徑是否在白名單中
 * @param {string} pathname - URL 路徑
 * @returns {boolean} - true 表示允許，false 表示阻擋
 */
function isValidPath(pathname) {
  // 防止目錄列出：拒絕所有以斜線結尾的路徑（除了根路徑）
  // 這防止了類似 /index/ 或 /app.js/ 的目錄遍歷嘗試
  if (pathname !== '/' && pathname.endsWith('/')) {
    return false;
  }

  // 直接檢查白名單
  if (ALLOWED_FILES.has(pathname)) {
    return true;
  }

  // 額外的安全檢查：阻擋明顯的攻擊模式（即使不在白名單中）
  const maliciousPatterns = [
    /\.\./,              // 路徑遍歷
    /\/\./,              // 隱藏檔案
    /\.(bak|backup|bac|old|tmp|swp|log|sql|db|env|config|ini|htm|000|asa|php|asp|jsp|cgi)/i,
    /(admin|login|wp-|phpmyadmin|servlet|cgi-bin|usage)/i,
  ];

  // 如果匹配惡意模式，直接拒絕（避免進入錯誤處理）
  if (maliciousPatterns.some(pattern => pattern.test(pathname))) {
    return false;
  }

  // 不在白名單中，也返回 false（會導致 404）
  return false;
}

// 快取控制標頭
const CACHE_HEADERS = {
  // HTML 檔案 - 禁止快取
  html: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'CDN-Cache-Control': 'no-store',  // 明確指示 Cloudflare 不要快取
    'Pragma': 'no-cache',
    'Expires': '0',
  },
  // JavaScript 檔案 - 長期快取
  js: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },
  // CSS 檔案 - 長期快取
  css: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },
  // 其他檔案 - 短期快取
  default: {
    'Cache-Control': 'public, max-age=3600, must-revalidate',
  },
};

/**
 * 根據檔案類型取得快取標頭
 */
function getCacheHeaders(pathname) {
  if (pathname.endsWith('.html') || pathname === '/') {
    return CACHE_HEADERS.html;
  } else if (pathname.endsWith('.js')) {
    return CACHE_HEADERS.js;
  } else if (pathname.endsWith('.css')) {
    return CACHE_HEADERS.css;
  }
  return CACHE_HEADERS.default;
}

/**
 * 新增安全標頭到回應
 */
function addSecurityHeaders(response) {
  const newResponse = new Response(response.body, response);

  // 新增所有安全標頭
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });

  return newResponse;
}

/**
 * 處理 HTTP 請求
 */
export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();

    try {
      const url = new URL(request.url);

      // 0. 取得客戶端 IP（用於日誌）
      const clientIP = request.headers.get('CF-Connecting-IP') ||
                       request.headers.get('X-Forwarded-For') ||
                       'unknown';

      // A10: SSRF 防護 - 驗證請求來源
      const origin = request.headers.get('Origin');
      const referer = request.headers.get('Referer');
      const userAgent = request.headers.get('User-Agent') || 'unknown';

      // 0.5 立即處理特殊情況，避免 Cloudflare 預設行為

      // 攔截 TRACK/TRACE 方法
      if (request.method === 'TRACK' || request.method === 'TRACE') {
        securityLog('warn', 'DANGEROUS_METHOD_BLOCKED', {
          ip: clientIP,
          method: request.method,
          path: url.pathname,
          userAgent,
        });

        return new Response('Method Not Allowed', {
          status: 405,
          headers: {
            'Allow': 'GET, HEAD, OPTIONS',
            'Content-Type': 'text/plain',
            ...SECURITY_HEADERS,
          },
        });
      }

      // 防止目錄列出：立即拒絕以斜線結尾的路徑（除了根路徑）
      // Cloudflare 可能會自動重定向 /index/ 到 /index，我們要阻止這種行為
      if (url.pathname !== '/' && url.pathname.endsWith('/')) {
        securityLog('warn', 'DIRECTORY_TRAVERSAL_BLOCKED', {
          ip: clientIP,
          path: url.pathname,
          userAgent,
        });

        return new Response(null, {
          status: 404,
          headers: SECURITY_HEADERS,
        });
      }

      // 1. 針對 HTML 請求，強制 Cloudflare 不使用快取
      // 這是關鍵：確保 Worker 總是被執行，而不是從快取返回
      const isHtmlRequest = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/index.html';
      if (isHtmlRequest) {
        // 方法 1: 清除 Cloudflare 快取
        const cache = caches.default;
        await cache.delete(request);
        await cache.delete(new Request(url.toString(), { method: 'GET' }));

        // 方法 2: 在請求頭中添加 Cache-Control 以告知 Cloudflare 不要快取
        const newHeaders = new Headers(request.headers);
        newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

        // 建立新請求物件，強制繞過 Cloudflare 快取
        request = new Request(request, {
          headers: newHeaders,
          cf: {
            cacheEverything: false,  // 禁止快取
            cacheTtl: 0,            // TTL = 0
            cacheTtlByStatus: {
              '200-299': 0,
              '300-399': 0,
              '400-499': 0,
              '500-599': 0,
            },
          },
        });
      }

      // 2. 強制 HTTPS（A02: Cryptographic Failures）
      if (url.protocol === 'http:') {
        url.protocol = 'https:';
        securityLog('info', 'HTTPS_REDIRECT', {
          ip: clientIP,
          originalUrl: request.url,
        });
        return Response.redirect(url.toString(), 301);
      }

      // 3. 路徑驗證：使用白名單檢查（A01: Broken Access Control）
      if (!isValidPath(url.pathname)) {
        securityLog('warn', 'INVALID_PATH_BLOCKED', {
          ip: clientIP,
          path: url.pathname,
          userAgent,
          origin,
          referer,
        });

        return new Response(null, {
          status: 404,
          headers: SECURITY_HEADERS,
        });
      }

      // 4. 處理 OPTIONS 預檢請求（CORS）
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': SECURITY_HEADERS['Access-Control-Allow-Origin'],
            'Access-Control-Allow-Methods': SECURITY_HEADERS['Access-Control-Allow-Methods'],
            'Access-Control-Allow-Headers': SECURITY_HEADERS['Access-Control-Allow-Headers'],
            'Access-Control-Max-Age': SECURITY_HEADERS['Access-Control-Max-Age'],
          },
        });
      }

      // 5. 只允許 GET 和 HEAD 方法（A01: Broken Access Control）
      // 明確處理所有方法，避免預設行為洩漏資訊
      const allowedMethods = ['GET', 'HEAD', 'OPTIONS'];
      if (!allowedMethods.includes(request.method)) {
        securityLog('warn', 'METHOD_NOT_ALLOWED', {
          ip: clientIP,
          method: request.method,
          path: url.pathname,
          userAgent,
        });

        // 總是返回 405 Method Not Allowed，避免洩漏伺服器資訊
        // 不返回 501 Not Implemented，因為這會暴露伺服器實作細節
        return new Response('Method Not Allowed', {
          status: 405,
          headers: {
            'Allow': 'GET, HEAD, OPTIONS',
            'Content-Type': 'text/plain',
            ...SECURITY_HEADERS,
          },
        });
      }

      // 6. 特殊處理 favicon.ico - 如果不存在，返回 204 而不是錯誤
      if (url.pathname === '/favicon.ico') {
        try {
          const faviconResponse = await getAssetFromKV(
            {
              request,
              waitUntil: ctx.waitUntil.bind(ctx),
            },
            {
              ASSET_NAMESPACE: env.__STATIC_CONTENT,
              ASSET_MANIFEST: getAssetManifest(env),
            }
          );
          return addSecurityHeaders(faviconResponse);
        } catch (e) {
          // favicon 不存在，返回 204 No Content
          return new Response(null, {
            status: 204,
            headers: SECURITY_HEADERS
          });
        }
      }

      // 7. 嘗試從 KV 獲取靜態資源
      let response;

      // 在呼叫 getAssetFromKV 之前，先建立映射後的 URL
      let assetPath = url.pathname;
      if (assetPath === '/') {
        assetPath = '/index.html';
      }

      // 建立新的請求物件
      const assetRequest = new Request(
        new URL(assetPath, url.origin).toString(),
        request
      );

      try {
        response = await getAssetFromKV(
          {
            request: assetRequest,
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: getAssetManifest(env),
            cacheControl: {
              bypassCache: true,  // 繞過快取，確保每次都從 Worker 返回最新標頭
              browserTTL: null,  // 不設置瀏覽器快取，由我們自己控制
              edgeTTL: null,     // 不設置邊緣快取
            },
          }
        );
      } catch (e) {
        // 8. 如果找不到資源，返回 404
        if (e.status === 404 || e.message.includes('could not find')) {
          try {
            // 嘗試載入自訂 404 頁面
            const notFoundRequest = new Request(
              new URL('/404.html', request.url).toString(),
              request
            );
            response = await getAssetFromKV(
              {
                request: notFoundRequest,
                waitUntil: ctx.waitUntil.bind(ctx),
              },
              {
                ASSET_NAMESPACE: env.__STATIC_CONTENT,
                ASSET_MANIFEST: getAssetManifest(env),
              }
            );
            response = new Response(response.body, {
              ...response,
              status: 404,
              statusText: 'Not Found',
            });
          } catch (error) {
            // 如果連 404 頁面都找不到，返回簡單的 404
            response = new Response('404 Not Found', {
              status: 404,
              headers: { 'Content-Type': 'text/plain' },
            });
          }
        } else if (e.status >= 500) {
          // 9. 伺服器錯誤，返回自訂 500 頁面
          try {
            const errorRequest = new Request(
              new URL('/500.html', request.url).toString(),
              request
            );
            response = await getAssetFromKV(
              {
                request: errorRequest,
                waitUntil: ctx.waitUntil.bind(ctx),
              },
              {
                ASSET_NAMESPACE: env.__STATIC_CONTENT,
                ASSET_MANIFEST: getAssetManifest(env),
              }
            );
            response = new Response(response.body, {
              ...response,
              status: 500,
              statusText: 'Internal Server Error',
            });
          } catch (error) {
            response = new Response('500 Internal Server Error', {
              status: 500,
              headers: { 'Content-Type': 'text/plain' },
            });
          }
        } else {
          // 其他錯誤
          throw e;
        }
      }

      // 10. 建立新的 Response 以完全控制標頭
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(),  // 從空標頭開始
      });

      // 11. 先添加安全標頭
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        if (key === 'Server' && value === '') {
          // 如果 Server 標頭設為空值，則刪除它
          newResponse.headers.delete('Server');
        } else {
          newResponse.headers.set(key, value);
        }
      });

      // 12. 根據檔案類型設置快取標頭
      const isHtml = url.pathname.endsWith('.html') || url.pathname === '/';

      if (isHtml) {
        // HTML 檔案 - 完全禁止快取（A05: Security Misconfiguration）
        // 使用多層標頭確保瀏覽器和 CDN 都不快取
        newResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
        newResponse.headers.set('CDN-Cache-Control', 'no-store, max-age=0');
        newResponse.headers.set('Cloudflare-CDN-Cache-Control', 'no-store, max-age=0');
        newResponse.headers.set('Surrogate-Control', 'no-store, max-age=0');  // 給代理伺服器
        newResponse.headers.set('Pragma', 'no-cache');
        newResponse.headers.set('Expires', '0');

        // 添加 Vary 標頭防止共享快取
        newResponse.headers.set('Vary', 'Accept-Encoding, User-Agent');

        // 清除 Cloudflare 快取
        const cache = caches.default;
        await cache.delete(request);
        await cache.delete(new Request(url.toString(), { method: 'GET' }));
      } else {
        // 其他檔案 - 根據類型設置快取
        const cacheHeaders = getCacheHeaders(url.pathname);
        Object.entries(cacheHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
      }

      // 13. 保留必要的 Content-Type
      const contentType = response.headers.get('Content-Type');
      if (contentType) {
        newResponse.headers.set('Content-Type', contentType);
      }

      // 14. 記錄成功的請求（A09: Logging and Monitoring）
      const duration = Date.now() - startTime;
      securityLog('info', 'REQUEST_SUCCESS', {
        ip: clientIP,
        method: request.method,
        path: url.pathname,
        statusCode: newResponse.status,
        duration,
        userAgent,
      });

      return newResponse;

    } catch (error) {
      // 15. 全域錯誤處理（A09: Logging and Monitoring）
      const duration = Date.now() - startTime;

      securityLog('error', 'WORKER_ERROR', {
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        path: new URL(request.url).pathname,
        error: error.message,
        stack: error.stack,
        duration,
      });

      console.error('Worker error:', error);

      return new Response(
        `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>伺服器錯誤</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 40px;
    }
    h1 { font-size: 48px; margin-bottom: 20px; }
    p { font-size: 18px; opacity: 0.9; }
    a {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 30px;
      background: rgba(255,255,255,0.2);
      color: white;
      text-decoration: none;
      border-radius: 25px;
      border: 2px solid rgba(255,255,255,0.3);
    }
    a:hover { background: rgba(255,255,255,0.3); }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ 發生錯誤</h1>
    <p>很抱歉，伺服器暫時無法處理您的請求。</p>
    <a href="/">返回首頁</a>
  </div>
</body>
</html>`,
        {
          status: 500,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...SECURITY_HEADERS,
            ...CACHE_HEADERS.html,
          },
        }
      );
    }
  },
};

/**
 * Cloudflare Worker for cardioanalytics.twinhao.com
 *
 * 功能：
 * 1. 提供靜態網站內容
 * 2. 強制 HTTPS
 * 3. 新增所有安全標頭
 * 4. 自訂錯誤頁面
 * 5. 禁止快取敏感內容
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

// 安全標頭配置
const SECURITY_HEADERS = {
  // CORS 設定
  'Access-Control-Allow-Origin': 'https://cardioanalytics.twinhao.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '1800', // 30 分鐘

  // 內容安全政策
  'Content-Security-Policy':
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "script-src 'self'; " +
    "img-src 'self' data:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "object-src 'none'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "upgrade-insecure-requests;",

  // HSTS - 強制 HTTPS（12 個月）
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // 防止 MIME 類型嗅探
  'X-Content-Type-Options': 'nosniff',

  // 防止點擊劫持
  'X-Frame-Options': 'DENY',

  // Referrer 政策
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // 權限政策
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',

  // 移除伺服器資訊
  'Server': 'Cloudflare Workers',
};

// 安全路徑驗證：使用白名單 + 簡單規則（更簡潔的方法）
// 只允許合法的路徑模式，直接拒絕所有可疑請求

/**
 * 檢查路徑是否合法
 * @param {string} pathname - URL 路徑
 * @returns {boolean} - true 表示合法，false 表示應該阻擋
 */
function isValidPath(pathname) {
  // 規則 1：只允許根路徑 /
  if (pathname === '/') return true;

  // 規則 2：阻擋任何帶 trailing slash 的路徑（防止目錄列表）
  if (pathname.endsWith('/')) return false;

  // 規則 3：阻擋明顯可疑的模式
  const suspiciousPatterns = [
    /\.\./,              // 路徑遍歷 (../)
    /\/\./,              // 隱藏檔案 (/.)
    /\.(bak|backup|bac|old|tmp|swp|log|sql|db|env|config|ini|htm|000)/i,  // 敏感副檔名（任何位置）
    /^\/[^\/]*\.(php|asp|asa|jsp|cgi)/i,  // 後端腳本
    /(admin|login|wp-|phpmyadmin|servlet|cgi-bin|usage_\d)/i,  // 常見攻擊目標
  ];

  // 如果匹配任何可疑模式，拒絕
  if (suspiciousPatterns.some(pattern => pattern.test(pathname))) {
    return false;
  }

  // 規則 4：只允許合理的檔案名格式
  // 允許：單層路徑，檔名包含字母、數字、底線、連字號、點
  // 不允許：多層路徑 (如 /admin/login.php)
  const validFormat = /^\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

  return validFormat.test(pathname);
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
    try {
      const url = new URL(request.url);

      // 0. 針對 HTML 請求，強制 Cloudflare 不使用快取
      const isHtmlRequest = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/index.html';
      if (isHtmlRequest) {
        // 建立新請求，添加 Cache-Control: no-cache 以繞過 Cloudflare 快取
        request = new Request(request, {
          cf: {
            cacheEverything: false,
            cacheTtl: 0,
          },
        });
      }

      // 1. 強制 HTTPS
      if (url.protocol === 'http:') {
        url.protocol = 'https:';
        return Response.redirect(url.toString(), 301);
      }

      // 2. 路徑驗證：使用白名單檢查（簡潔的單一檢查點）
      if (!isValidPath(url.pathname)) {
        return new Response(null, {
          status: 404,
          headers: SECURITY_HEADERS,
        });
      }

      // 3. 處理 OPTIONS 預檢請求（CORS）
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

      // 4. 只允許 GET 和 HEAD 方法（返回簡潔錯誤訊息）
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response(null, {
          status: 405,
          headers: {
            'Allow': 'GET, HEAD, OPTIONS',
            ...SECURITY_HEADERS,
          },
        });
      }

      // 5. 特殊處理 favicon.ico - 如果不存在，返回 204 而不是錯誤
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

      // 6. 嘗試從 KV 獲取靜態資源
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
            },
          }
        );
      } catch (e) {
        // 7. 如果找不到資源，返回 404
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
          // 8. 伺服器錯誤，返回自訂 500 頁面
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

      // 9. 新增安全標頭
      response = addSecurityHeaders(response);

      // 10. 新增適當的快取標頭
      const cacheHeaders = getCacheHeaders(url.pathname);
      Object.entries(cacheHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      // 11. 針對 HTML 檔案，明確告訴 Cloudflare 不要快取
      if (url.pathname.endsWith('.html') || url.pathname === '/') {
        // 使用 Cache API 清除這個請求的快取
        const cache = caches.default;
        await cache.delete(request);

        // 建立新的 Response，強制設定 no-store
        response = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });

        // 設定多層快取控制標頭
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        response.headers.set('CDN-Cache-Control', 'no-store');
        response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        response.headers.delete('CF-Cache-Status');
        response.headers.delete('ETag'); // 移除 ETag 防止條件快取
        response.headers.delete('Last-Modified');
      }

      return response;

    } catch (error) {
      // 12. 全域錯誤處理
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

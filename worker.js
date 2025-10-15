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

// 快取控制標頭
const CACHE_HEADERS = {
  // HTML 檔案 - 禁止快取
  html: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
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

      // 1. 強制 HTTPS
      if (url.protocol === 'http:') {
        url.protocol = 'https:';
        return Response.redirect(url.toString(), 301);
      }

      // 2. 處理 OPTIONS 預檢請求（CORS）
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

      // 3. 只允許 GET 和 HEAD 方法
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: {
            'Allow': 'GET, HEAD, OPTIONS',
            ...SECURITY_HEADERS,
          },
        });
      }

      // 4. 特殊處理 favicon.ico - 如果不存在，返回 204 而不是錯誤
      if (url.pathname === '/favicon.ico') {
        try {
          response = await getAssetFromKV(
            {
              request,
              waitUntil: ctx.waitUntil.bind(ctx),
            },
            {
              ASSET_NAMESPACE: env.__STATIC_CONTENT,
              ASSET_MANIFEST: JSON.parse(env.__STATIC_CONTENT_MANIFEST),
            }
          );
        } catch (e) {
          // favicon 不存在，返回 204 No Content
          return new Response(null, {
            status: 204,
            headers: SECURITY_HEADERS
          });
        }
        response = addSecurityHeaders(response);
        return response;
      }

      // 5. 嘗試從 KV 獲取靜態資源
      let response;
      try {
        response = await getAssetFromKV(
          {
            request,
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: JSON.parse(env.__STATIC_CONTENT_MANIFEST),
            cacheControl: {
              bypassCache: false,
            },
            mapRequestToAsset: (req) => {
              const url = new URL(req.url);
              // 將 / 映射到 /index.html
              if (url.pathname === '/') {
                url.pathname = '/index.html';
              }
              return new Request(url.toString(), req);
            },
          }
        );
      } catch (e) {
        // 6. 如果找不到資源，返回 404
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
                ASSET_MANIFEST: JSON.parse(env.__STATIC_CONTENT_MANIFEST),
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
          // 7. 伺服器錯誤，返回自訂 500 頁面
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
                ASSET_MANIFEST: JSON.parse(env.__STATIC_CONTENT_MANIFEST),
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

      // 8. 新增安全標頭
      response = addSecurityHeaders(response);

      // 9. 新增適當的快取標頭
      const cacheHeaders = getCacheHeaders(url.pathname);
      Object.entries(cacheHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;

    } catch (error) {
      // 10. 全域錯誤處理
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

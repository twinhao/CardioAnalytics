/**
 * Cloudflare Worker - 模組化架構
 * cardioanalytics.twinhao.com
 *
 * 特色：
 * - 模組化的路由處理
 * - 基於路徑的快取策略
 * - 完整的安全標頭管理
 * - 符合 OWASP Top 10 2021 最佳實踐
 */

import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

// ==================== 配置模組 ====================

/**
 * 路由快取策略配置
 * 定義不同路徑的快取行為
 */
const CACHE_POLICIES = {
  // 靜態資源 - 長期快取
  static: {
    pattern: /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i,
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'CDN-Cache-Control': 'public, max-age=31536000',
    },
  },

  // HTML 頁面 - 短期快取，需要重新驗證
  html: {
    pattern: /\.(html?)$|^\/$/i,
    headers: {
      'Cache-Control': 'public, max-age=3600, must-revalidate',
      'CDN-Cache-Control': 'public, max-age=3600',
      'Pragma': 'no-cache',
    },
  },

  // API 路由 - 完全不快取
  api: {
    pattern: /^\/api\//,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'CDN-Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },

  // 管理後台 - 完全不快取
  admin: {
    pattern: /^\/admin\//,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'CDN-Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },

  // 預設策略 - 謹慎快取
  default: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'CDN-Cache-Control': 'no-store',
      'Pragma': 'no-cache',
    },
  },
};

/**
 * 全域安全標頭配置
 * 適用於所有回應
 */
const SECURITY_HEADERS = {
  // HSTS - 強制 HTTPS（A02: Cryptographic Failures）
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // 防止點擊劫持（A01: Broken Access Control）
  'X-Frame-Options': 'DENY',

  // 防止 MIME 類型嗅探（A03: Injection）
  'X-Content-Type-Options': 'nosniff',

  // XSS 防護（舊瀏覽器）
  'X-XSS-Protection': '1; mode=block',

  // Referrer 政策（A02: Cryptographic Failures - 防止資訊洩漏）
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // 權限政策（A05: Security Misconfiguration）
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',

  // 內容安全政策（A03: Injection - XSS 防護）
  'Content-Security-Policy':
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +  // 允許內聯腳本（如果需要）
    "style-src 'self' 'unsafe-inline'; " +   // 允許內聯樣式（如果需要）
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "upgrade-insecure-requests; " +
    "block-all-mixed-content;",

  // CORS 設定
  'Access-Control-Allow-Origin': 'https://cardioanalytics.twinhao.com',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '1800', // 30 分鐘
};

/**
 * 允許的檔案白名單
 */
const ALLOWED_FILES = new Set([
  '/',
  '/index.html',
  '/404.html',
  '/500.html',
  '/app.js',
  '/styles.css',
  '/favicon.svg',
  '/favicon.ico',
  '/robots.txt',
]);

// ==================== 工具函式模組 ====================

/**
 * 安全日誌記錄
 */
function securityLog(level, event, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    event,
    ...details,
  };

  console.log(JSON.stringify(logEntry));

  if (level === 'security' || level === 'error') {
    console.error(`[SECURITY] ${event}:`, JSON.stringify(details));
  }
}

/**
 * 取得 Asset Manifest
 */
function getAssetManifest(env) {
  try {
    return env.__STATIC_CONTENT_MANIFEST ? JSON.parse(env.__STATIC_CONTENT_MANIFEST) : {};
  } catch (e) {
    console.error('Failed to parse asset manifest:', e);
    return {};
  }
}

/**
 * 根據路徑決定快取策略
 */
function getCachePolicy(pathname) {
  // 檢查靜態資源
  if (CACHE_POLICIES.static.pattern.test(pathname)) {
    return CACHE_POLICIES.static.headers;
  }

  // 檢查 HTML
  if (CACHE_POLICIES.html.pattern.test(pathname) || pathname === '/') {
    return CACHE_POLICIES.html.headers;
  }

  // 檢查 API
  if (CACHE_POLICIES.api.pattern.test(pathname)) {
    return CACHE_POLICIES.api.headers;
  }

  // 檢查管理後台
  if (CACHE_POLICIES.admin.pattern.test(pathname)) {
    return CACHE_POLICIES.admin.headers;
  }

  // 預設策略
  return CACHE_POLICIES.default.headers;
}

/**
 * 路徑驗證
 */
function isValidPath(pathname) {
  // 防止目錄列出
  if (pathname !== '/' && pathname.endsWith('/')) {
    return false;
  }

  // 檢查白名單
  if (ALLOWED_FILES.has(pathname)) {
    return true;
  }

  // 阻擋惡意模式 - 更完整的備份檔案和敏感路徑檢測
  const maliciousPatterns = [
    /\.\./,                                                              // 路徑遍歷
    /\/\./,                                                              // 隱藏檔案
    /\.(bak|backup|bac|old|tmp|swp|log|sql|db|env|config|ini|orig|save|dist|tar|gz|zip|rar)$/i,  // 備份和壓縮檔案
    /(-old|-backup|-bak|-orig|-copy|-save|~)$/i,                        // 其他備份檔案命名模式
    /\.(php|asp|aspx|jsp|cgi|py|rb|pl|sh|bash|exe|dll|so)$/i,          // 可執行檔案
    /(wp-admin|phpmyadmin|servlet|cgi-bin|admin|login|shell|cmd)/i,    // 敏感路徑
    /\.(git|svn|hg|bzr|cvs)/i,                                         // 版本控制目錄
    /(web\.config|\.htaccess|\.htpasswd|\.user\.ini)/i,                // 伺服器配置檔案
  ];

  return !maliciousPatterns.some(pattern => pattern.test(pathname));
}

/**
 * 建立安全回應
 */
function createSecureResponse(body, options = {}) {
  const headers = new Headers(options.headers || {});

  // 添加安全標頭
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  // 添加快取策略
  const cacheHeaders = getCachePolicy(options.pathname || '/');
  Object.entries(cacheHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  // 保留原始 Content-Type
  if (options.contentType) {
    headers.set('Content-Type', options.contentType);
  }

  return new Response(body, {
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    headers,
  });
}

// ==================== 請求處理模組 ====================

/**
 * 處理 OPTIONS 預檢請求
 */
function handleOptions() {
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

/**
 * 處理不允許的 HTTP 方法
 */
function handleMethodNotAllowed(method, clientIP, pathname, userAgent) {
  securityLog('warn', 'METHOD_NOT_ALLOWED', {
    ip: clientIP,
    method,
    path: pathname,
    userAgent,
  });

  return createSecureResponse('Method Not Allowed', {
    status: 405,
    pathname,
    headers: {
      'Allow': 'GET, HEAD, OPTIONS',
    },
  });
}

/**
 * 處理 404 錯誤
 */
async function handle404(request, env, ctx) {
  try {
    const notFoundRequest = new Request(
      new URL('/404.html', request.url).toString(),
      request
    );

    const response = await getAssetFromKV(
      {
        request: notFoundRequest,
        waitUntil: ctx.waitUntil.bind(ctx),
      },
      {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        ASSET_MANIFEST: getAssetManifest(env),
      }
    );

    return createSecureResponse(response.body, {
      status: 404,
      statusText: 'Not Found',
      pathname: '/404.html',
      contentType: response.headers.get('Content-Type'),
    });
  } catch {
    return createSecureResponse('404 Not Found', {
      status: 404,
      pathname: '/404.html',
      contentType: 'text/plain',
    });
  }
}

/**
 * 處理 500 錯誤
 */
async function handle500(request, env, ctx, error) {
  securityLog('error', 'INTERNAL_ERROR', {
    error: error.message,
    stack: error.stack,
  });

  try {
    const errorRequest = new Request(
      new URL('/500.html', request.url).toString(),
      request
    );

    const response = await getAssetFromKV(
      {
        request: errorRequest,
        waitUntil: ctx.waitUntil.bind(ctx),
      },
      {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        ASSET_MANIFEST: getAssetManifest(env),
      }
    );

    return createSecureResponse(response.body, {
      status: 500,
      statusText: 'Internal Server Error',
      pathname: '/500.html',
      contentType: response.headers.get('Content-Type'),
    });
  } catch {
    return createSecureResponse('500 Internal Server Error', {
      status: 500,
      pathname: '/500.html',
      contentType: 'text/plain',
    });
  }
}

// ==================== 主要處理器 ====================

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // 取得客戶端資訊
      const clientIP = request.headers.get('CF-Connecting-IP') ||
                       request.headers.get('X-Forwarded-For') ||
                       'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';

      // 立即處理特殊 HTTP 方法
      if (request.method === 'TRACK' || request.method === 'TRACE') {
        return handleMethodNotAllowed(request.method, clientIP, pathname, userAgent);
      }

      // 防止目錄遍歷
      if (pathname !== '/' && pathname.endsWith('/')) {
        securityLog('warn', 'DIRECTORY_TRAVERSAL_ATTEMPT', {
          ip: clientIP,
          path: pathname,
        });
        return handle404(request, env, ctx);
      }

      // 強制 HTTPS
      if (url.protocol === 'http:') {
        url.protocol = 'https:';
        return Response.redirect(url.toString(), 301);
      }

      // 處理 OPTIONS
      if (request.method === 'OPTIONS') {
        return handleOptions();
      }

      // 只允許 GET 和 HEAD
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return handleMethodNotAllowed(request.method, clientIP, pathname, userAgent);
      }

      // 路徑驗證
      if (!isValidPath(pathname)) {
        securityLog('warn', 'INVALID_PATH', {
          ip: clientIP,
          path: pathname,
        });
        return handle404(request, env, ctx);
      }

      // 特殊處理 favicon.ico - 重定向到 favicon.svg
      // 瀏覽器會自動請求 favicon.ico，我們重定向到實際存在的 SVG
      if (pathname === '/favicon.ico') {
        // 直接重定向到 favicon.svg
        return Response.redirect(new URL('/favicon.svg', url.origin).toString(), 301);
      }

      // 處理根路徑
      let assetPath = pathname;
      if (assetPath === '/') {
        assetPath = '/index.html';
      }

      // 建立資源請求
      const assetRequest = new Request(
        new URL(assetPath, url.origin).toString(),
        request
      );

      // 嘗試取得資源
      try {
        const response = await getAssetFromKV(
          {
            request: assetRequest,
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: getAssetManifest(env),
            cacheControl: {
              bypassCache: true,  // 繞過 Worker 內部快取
            },
          }
        );

        // 記錄成功請求
        const duration = Date.now() - startTime;
        securityLog('info', 'REQUEST_SUCCESS', {
          ip: clientIP,
          method: request.method,
          path: pathname,
          duration,
        });

        // 返回安全回應
        return createSecureResponse(response.body, {
          pathname,
          contentType: response.headers.get('Content-Type'),
        });

      } catch (e) {
        if (e.status === 404 || e.message.includes('could not find')) {
          return handle404(request, env, ctx);
        }
        throw e;
      }

    } catch (error) {
      return handle500(request, env, ctx, error);
    }
  },
};
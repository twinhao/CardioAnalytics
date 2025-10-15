#!/bin/bash

#===============================================================================
# Cloudflare Workers 部署腳本
# 用途：一鍵部署 cardioanalytics.twinhao.com 到 Cloudflare Workers
#===============================================================================

set -e  # 遇到錯誤立即退出

echo "=========================================="
echo "  Cloudflare Workers 部署腳本"
echo "  網站：cardioanalytics.twinhao.com"
echo "=========================================="
echo ""

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 檢查 Bun 或 Node.js
echo -e "${BLUE}[1/7]${NC} 檢查執行環境..."
if command -v bun &> /dev/null; then
    RUNTIME="bun"
    echo -e "${GREEN}✅ Bun $(bun --version) 已安裝 (推薦)${NC}"
elif command -v node &> /dev/null; then
    RUNTIME="npm"
    echo -e "${YELLOW}⚠️  使用 Node.js $(node --version)${NC}"
    echo -e "${YELLOW}   建議安裝 Bun 以獲得更快的速度：curl -fsSL https://bun.sh/install | bash${NC}"
else
    echo -e "${RED}❌ 錯誤: 未安裝 Bun 或 Node.js${NC}"
    echo "請先安裝 Bun: curl -fsSL https://bun.sh/install | bash"
    echo "或安裝 Node.js: https://nodejs.org/"
    exit 1
fi
echo ""

# 安裝依賴
echo -e "${BLUE}[2/7]${NC} 安裝專案依賴..."
if [ ! -d "node_modules" ]; then
    echo "首次部署，正在安裝依賴..."
    if [ "$RUNTIME" = "bun" ]; then
        bun install
    else
        npm install
    fi
else
    echo "依賴已存在，跳過安裝"
fi
echo -e "${GREEN}✅ 依賴安裝完成${NC}"
echo ""

# 檢查 Wrangler
echo -e "${BLUE}[3/7]${NC} 檢查 Wrangler CLI..."
if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}⚠️  未安裝 Wrangler，正在安裝...${NC}"
    if [ "$RUNTIME" = "bun" ]; then
        bun install -g wrangler
    else
        npm install -g wrangler
    fi
fi
echo -e "${GREEN}✅ Wrangler $(wrangler --version | head -1) 已安裝${NC}"
echo ""

# 檢查登入狀態
echo -e "${BLUE}[4/7]${NC} 檢查 Cloudflare 登入狀態..."
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  尚未登入 Cloudflare${NC}"
    echo "請執行以下指令登入："
    echo "  wrangler login"
    exit 1
fi
echo -e "${GREEN}✅ 已登入 Cloudflare${NC}"
ACCOUNT_INFO=$(wrangler whoami 2>&1)
echo "$ACCOUNT_INFO"
echo ""

# 檢查 public 資料夾
echo -e "${BLUE}[5/7]${NC} 檢查靜態資源..."
if [ ! -d "public" ]; then
    echo -e "${RED}❌ 錯誤: public 資料夾不存在${NC}"
    exit 1
fi

REQUIRED_FILES=("index.html" "app.js" "styles.css" "404.html" "500.html")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "public/$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo -e "${RED}❌ 錯誤: 缺少以下檔案：${NC}"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - public/$file"
    done
    exit 1
fi

echo -e "${GREEN}✅ 所有必要檔案都存在${NC}"
echo ""

# 部署
echo -e "${BLUE}[6/7]${NC} 部署到 Cloudflare Workers..."
echo ""
echo "準備部署..."
echo "  Worker 名稱: cardioanalytics-worker"
echo "  域名: cardioanalytics.twinhao.com"
echo "  使用執行環境: $RUNTIME"
echo ""

# 確認是否繼續
read -p "確認要部署嗎？[y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "部署已取消"
    exit 0
fi

echo ""
echo "正在部署..."
if [ "$RUNTIME" = "bun" ]; then
    bun run deploy
else
    npm run deploy
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "=========================================="
echo ""
echo "🌐 您的網站已上線："
echo "  https://cardioanalytics.twinhao.com"
echo ""
echo "📊 查看 Worker 狀態："
echo "  https://dash.cloudflare.com"
echo ""
echo "🔍 即時日誌："
if [ "$RUNTIME" = "bun" ]; then
    echo "  bun run tail"
else
    echo "  npm run tail"
fi
echo "  或"
echo "  wrangler tail"
echo ""
echo "=========================================="
echo "⚠️  下一步：設定 TLS 1.3 Only"
echo "=========================================="
echo ""
echo "要完全解決 DAST 掃描的安全問題，請："
echo ""
echo "方法 1: Cloudflare Dashboard"
echo "  1. 登入 https://dash.cloudflare.com"
echo "  2. 選擇網域 twinhao.com"
echo "  3. SSL/TLS → Edge Certificates"
echo "  4. 設定 Minimum TLS Version: TLS 1.3"
echo ""
echo "方法 2: 執行腳本"
echo "  bash cloudflare-ssl-config-legacy.sh"
echo ""
echo "等待 2-3 分鐘後驗證："
echo "  openssl s_client -connect cardioanalytics.twinhao.com:443 -tls1_2"
echo "  （應該顯示錯誤，表示 TLS 1.2 已停用）"
echo ""
echo "=========================================="

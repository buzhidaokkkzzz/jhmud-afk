#!/usr/bin/env bash
# 江湖行挂机 · Linux 一键安装
# 用法：chmod +x install.sh && ./install.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "============================================"
echo "   江湖行挂机 · Linux 安装"
echo "============================================"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then SUDO="sudo"; else
    echo "[错误] 需要 root 或 sudo"; exit 1
  fi
fi

# ---------- 1. Node.js >= 18 ----------
need_node=1
if command -v node >/dev/null 2>&1; then
  major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "$major" -ge 18 ]; then need_node=0; fi
fi

if [ "$need_node" -eq 1 ]; then
  echo "==> 安装 Node.js 20"
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO dnf install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO yum install -y nodejs
  else
    echo "[错误] 不认识的发行版，请先手动安装 Node.js 18+"; exit 1
  fi
fi
echo "==> Node $(node -v)"

# ---------- 2. swap（内存不足 3G 且没有 swap 时自动加）----------
mem_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
swap_mb="$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)"
if [ "$mem_mb" -lt 3000 ] && [ "$swap_mb" -lt 512 ]; then
  echo "==> 内存 ${mem_mb}MB，创建 2G swap 兜底"
  $SUDO fallocate -l 2G /swapfile 2>/dev/null || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile
  $SUDO swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
  $SUDO sysctl -w vm.swappiness=10 >/dev/null
fi

# ---------- 3. 依赖 ----------
export PLAYWRIGHT_DOWNLOAD_HOST="https://cdn.npmmirror.com/binaries/playwright"

echo "==> 安装 npm 依赖"
npm i --no-audit --no-fund

echo "==> 安装 Chromium 的系统依赖"
$SUDO npx playwright install-deps chromium

echo "==> 下载 Chromium（约 150MB，需要几分钟）"
npx playwright install chromium

echo
echo "============================================"
echo "安装完成"
if [ -f config-multi.json ]; then
  echo "下一步：./start.sh"
else
  echo "还没有账号配置，先运行：node setup.js"
  echo "配置好之后再：./start.sh"
fi
echo "============================================"

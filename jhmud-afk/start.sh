#!/usr/bin/env bash
# 启动挂机（前台运行，Ctrl+C 停止）
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 没有 Node.js，先运行 ./install.sh"; exit 1
fi

if [ ! -d node_modules ]; then
  echo "[错误] 依赖没装，先运行 ./install.sh"; exit 1
fi

if [ ! -f config-multi.json ]; then
  echo "还没有配置账号，正在启动配置向导..."
  node setup.js
  [ -f config-multi.json ] || { echo "配置没有保存，退出"; exit 1; }
fi

echo "启动中... 按 Ctrl+C 停止"
exec node multi.js

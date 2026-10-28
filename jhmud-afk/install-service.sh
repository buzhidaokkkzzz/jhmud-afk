#!/usr/bin/env bash
# 注册成 systemd 服务：开机自启、崩溃自动重启、日志落盘
# 用法：chmod +x install-service.sh && sudo ./install-service.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE="$(command -v node || true)"
SERVICE=/etc/systemd/system/jhmud.service

if [ "$(id -u)" -ne 0 ]; then
  echo "[错误] 请用 sudo 运行"; exit 1
fi
if [ -z "$NODE" ]; then
  echo "[错误] 找不到 node，先运行 ./install.sh"; exit 1
fi
if [ ! -d "$ROOT/node_modules" ]; then
  echo "[错误] 依赖没装，先运行 ./install.sh"; exit 1
fi

echo "==> 写入 $SERVICE"
cat > "$SERVICE" <<EOF
[Unit]
Description=Jianghu MUD AFK
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT
ExecStart=$NODE multi.js
Restart=always
RestartSec=10
MemoryMax=1500M

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now jhmud

sleep 3
echo
echo "============================================"
systemctl status jhmud --no-pager -l | head -20 || true
echo "============================================"
echo "查看日志： journalctl -u jhmud -f"
echo "停止服务： systemctl stop jhmud"
echo "取消自启： systemctl disable jhmud"

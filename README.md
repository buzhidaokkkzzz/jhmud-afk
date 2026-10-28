<div align="center">

# 江湖行 · 挂机

网页版 MUD「江湖行」挂机工具 —— 用无头 Chromium 把游戏页面挂在后台，游戏自带的挂机脚本照常跑。

[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

## 使用

**Windows**

1. 双击 `jhmud-afk/安装依赖.bat` —— 首次，下载浏览器内核约 150MB
2. 双击 `jhmud-afk/配置账号.bat` —— 依次填账号、密码、要挂的角色
3. 双击 `jhmud-afk/启动挂机.bat` —— 开始挂机

**Linux**

```bash
cd jhmud-afk
chmod +x *.sh

./install.sh          # 装 Node / 依赖 / Chromium，内存不足自动加 swap
node setup.js         # 配置账号
./start.sh            # 前台运行

sudo ./install-service.sh   # 可选：开机自启 + 崩溃自动重启
```

## 配置

向导会生成 `config-multi.json`（已在 `.gitignore`，不会提交）：

```json
{
  "accounts": [
    { "user": "你的账号", "pass": "你的密码", "roles": [] }
  ],
  "blockCss": true
}
```

`roles` 留空 = 该账号下全部角色；填名字 = 只挂指定的几个。

## 常见问题

| 问题 | 怎么办 |
|---|---|
| bat 报「'cho' 不是内部或外部命令」 | 文件被转成了 LF 换行，用 `git clone` 重新拿一份 |
| 内存不够 | 每角色约 170MB，2G 机器建议不超过 6 个，`install.sh` 会自动加 swap |
| 角色名写错 | 会一直重试，看窗口日志改配置 |
| 账号被踢下线 | 同一账号不能在两处同时登录，换机器前先关旧的 |

## 另一套方案

`jhmud-bot/` 是纯 WebSocket 的协议客户端（每进程约 60MB），适合定时跑固定流程。
目前只有骨架（登录 + 收帧 + 发指令），任务逻辑待写。一般用上面的浏览器版就够。

## 说明

不修改游戏、不绕过任何机制，只负责把页面养活着。仓库不包含游戏客户端代码，也不含任何账号信息。

[MIT](LICENSE)

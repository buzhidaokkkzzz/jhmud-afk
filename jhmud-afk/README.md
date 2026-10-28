# 江湖行 · 无头挂机

用无头 Chromium 在服务器上跑游戏页面，自动登录 + 保持在线 + 断线重连。
不需要开窗口，也不需要远程桌面。

> ⚠️ **运行在哪台机器，就跟哪台机器共存亡。**
> - 部署到 VPS / NAS / 旧电脑：那台机器一直开着就行，你自己的电脑关不关都无所谓
> - 直接在自己电脑上双击：**关掉黑窗口 = 停止，关机 = 停止**，这不是脱机

## 最短路径（Windows 本机）

**只用两个 bat，不用碰任何配置文件。**

1. 第一次：双击 **`配置账号.bat`**，按提示回答
   ```
   账号：你的账号
   （密码会显示在屏幕上，输了什么就是什么）
   密码：你的密码
   查到 5 个侠影：
     1. 侠客甲   2. 侠客乙   3. 侠客丙   4. 侠客丁   5. 侠客戊
   要挂哪些？直接回车=全部，或输入序号（如 1,3,5 或 2-4）：
   >
   还要再加一个账号吗？(y/N)
   ```
   密码输错不用重头来，会问「再试一次这个账号？」
2. 以后：双击 **`启动挂机.bat`** 就行（没配置过会自动先弹向导）

**换账号 / 换角色**：重新双击 `配置账号.bat` 走一遍，会覆盖旧配置。

**停止**：关掉那个黑窗口。

> 关窗口后如果发现还有 `chrome-headless-shell.exe` 残留（任务管理器里看），手动结束即可。

## 多账号 / 选角色（config-multi.json）

一个 Chromium 进程 + 每个角色一个独立 context（cookie/localStorage 互不干扰），
所以多个账号可以同时挂，互不影响。

### 多账号写法（推荐）

```json
{
  "url": "http://175.178.190.184/",
  "accounts": [
    { "user": "你的账号", "pass": "你的密码", "roles": ["侠客甲", "侠客乙"] },
    { "user": "93001", "pass": "222222", "roles": [] }
  ],
  "headless": true,
  "checkEvery": 20,
  "blockCss": true
}
```

- `roles` 填名字 = **只挂指定的侠影**
- `roles: []` = **自动登录该账号下全部侠影**（启动时通过 HTTP 查询，不用手写）
- 想加/换账号，就在 `accounts` 里增删一项，保存后重新双击 `启动挂机.bat`

### 单账号写法（也支持）

```json
{
  "url": "http://175.178.190.184/",
  "user": "你的账号",
  "pass": "你的密码",
  "roles": ["侠客甲", "侠客乙", "侠客丙", "侠客丁", "侠客戊"]
}
```

### 启动时会打印清单

```
[13:01:26][你的账号] 自动获取到 5 个侠影: 侠客甲 / 侠客乙 / 侠客丙 / 侠客丁 / 侠客戊
[13:01:26][main] 浏览器已启动 | 账号 1 个 | 角色 5 个
[13:01:26][main] 挂机清单: 你的账号/侠客甲  你的账号/侠客乙  你的账号/侠客丙  你的账号/侠客丁  你的账号/侠客戊
```

### 内存

| 配置 | 内存 |
|---|---|
| 默认（640×480，不拦 CSS） | 1065 MB |
| `blockCss: true` + 520×400 视口 | **840~870 MB** |

**每个角色约 170 MB**，2G 的机器建议不超过 6 个。角色名必须和游戏里完全一致，
登录后脚本会校验，进错角色会报错重试。

`blockCss` 会拦掉 CSS 文件，页面没有样式但 DOM 和脚本完全正常（都是按文本点按钮）。
如果发现挂机脚本行为异常，把它设成 `false` 即可。

## 实测结果（2026-10-28）

```
1. 页面就绪，开始登录: 你的账号
   服务器返回: (无提示=成功)
2. 点击: 进入分舵
2. 点击: 踏入江湖
3. WebSocket 已连接: true
4. 游戏内状态: {"role":{"name":"侠客甲"},"room":"扬州城-任务阁二楼",
              "trigger":"...jhxmud.js?1.2.8-20260825-a"}
5. 保活 60 秒: ws=true ×6
6. 挂机脚本已在跑（自动上交任务物品、获得经验/潜能）
```

进程内存合计 **342 MB**（5 个进程：node + 4 个 chrome-headless-shell）。
启动到进游戏约 **10 秒**。

## 为什么是这个方案

游戏自带的挂机脚本（`脚本地址` 指向的 `jhxmud.js`）是一个 **Vue 组件 + jQuery**，
必须在真实 DOM 环境里运行 —— 它调用 `GameClient.ws.send()`、读写 `vm.*`、点击
`$("[command=jh]")`。所以：

- ❌ 不能像纯协议机器人那样只开一个 WebSocket（逻辑重写成本极高，6 千多行）
- ✅ 但也不需要真浏览器窗口 —— 无头 Chromium 就够，内存约为有头的一半

本机实测（登录页，已屏蔽图片/字体）：

| 进程 | 内存 |
|---|---|
| chrome-headless-shell ×4 | ≈ 266 MB |
| node (afk.js) | ≈ 85 MB |
| **合计** | **≈ 350 MB** |

进游戏后加载挂机脚本，会再涨 50~100 MB，**按 450 MB 规划**。1C1G 的 VPS 够用；
512M 的会吃紧，必须加 swap。

## 安装

```bash
npm i playwright
npx playwright install chromium
```

国内直连官方 CDN 很可能卡住（实测十几分钟不动），用镜像：

```bash
# Windows PowerShell
$env:PLAYWRIGHT_DOWNLOAD_HOST="https://cdn.npmmirror.com/binaries/playwright"
npx playwright install chromium
```

```bash
# Linux
export PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright
npx playwright install --with-deps chromium
```

## 配置

```bash
copy config.example.json config.json     # Linux: cp
```

```json
{
  "url": "http://175.178.190.184/",
  "user": "你的账号",
  "pass": "你的密码",
  "headless": true,
  "checkEvery": 15
}
```

第一次建议 `"headless": false` 跑一遍，肉眼确认能走完
`登录 → 进入分舵 → 踏入江湖 → 进游戏`，再改成 `true`。

## 运行

```bash
node probe.js     # 可选：打印页面全局对象/按钮文案，改版后用它校对
node afk.js       # 正式挂机，日志写入 afk.log
```

`afk.js` 会自己处理：登录失败提示、断线、页面崩溃，每 10 秒重连一次。
出错时截一张 `error.png`，方便回头看作卡在哪一步。

## 部署成服务

**Linux：三个脚本，一条命令搞定**

```bash
# 把整个文件夹传到服务器，例如 /opt/jhmud-afk
cd /opt/jhmud-afk
chmod +x *.sh

./install.sh          # 装 Node、装依赖、装 Chromium、内存不足自动加 swap
node setup.js         # 问答式配账号（也可以用 config-multi.json 手填）
./start.sh            # 前台跑，Ctrl+C 停
```

想让它开机自启、崩了自动重启：

```bash
sudo ./install-service.sh
journalctl -u jhmud -f        # 看日志
systemctl stop jhmud          # 停止
systemctl disable jhmud       # 取消自启
```

`install-service.sh` 会自动写 `/etc/systemd/system/jhmud.service`，
带 `Restart=always` 和 `MemoryMax=1500M`（防止内存吃满拖垮整机）。

**Windows (任务计划程序)**

- 程序：`node.exe`
- 参数：`multi.js`
- 起始于：本项目目录
- 触发器：计算机启动时
- 勾选「不管用户是否登录都要运行」+「使用最高权限」

## 省资源的几个开关（已内置）

`afk.js` 里的 `ARGS` 已经打开：

- `--blink-settings=imagesEnabled=false` + 路由拦截图片/字体/媒体
- `--js-flags=--max-old-space-size=128` 限制 JS 堆
- `--disable-gpu` / `--disable-software-rasterizer` 不要 GPU
- `--disable-background-timer-throttling` 等三项 —— **别删**，否则无头模式下
  定时器会被浏览器节流，技能冷却和脚本计时会变慢

还可以把 viewport 调小（现在是 720×540），内存能再省一点。

## 关于脚本地址

游戏设置里的「脚本地址」在登录后由服务器下发，页面会自动 `<script src>` 加载它。
默认指向 `http://114.132.72.231:8080/jhxmud.js`（第三方机器）。

建议把 `jhxmud.js` 下载下来放到自己的服务器/对象存储，再把「脚本地址」改过去：
既不怕对方关站，也不用把账号指令流交给陌生人的 JS。

## 注意

- 这是「绿色服」，挂机是否允许请先看服规。
- 账号密码是明文写在 `config.json` 里的，别把这个目录传到公开仓库。
- 登录频率别太高：连续失败会被服务器挡，脚本里已经是 10 秒退避。

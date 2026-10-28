# jhmud-bot · 江湖行协议客户端

参考 [wsmud/daily](https://github.com/wsmud/daily) 的架构，给「江湖行」写的纯 WebSocket 客户端。
不启动浏览器、不占 300 MB，直接连游戏服。

## 实测

| 方案 | 内存 | 说明 |
|---|---|---|
| 无头 Chromium（`../jhmud-afk`） | **342 MB** | 跑完整挂机脚本，功能全 |
| 本客户端 | **60 MB** | 纯协议，按需写逻辑 |

已验证：登录 → 连接 → 收发指令 → 解析房间/背包/任务帧，全部跑通。

## 用法

```bash
npm i
node src/index.js --record     # 连上，发 cha/look/pack/tasks，打印帧统计
node src/index.js --daily      # 日常模式（待补事件）
```

`config.json`：

```json
{ "user": "你的账号", "pass": "你的密码", "role": "侠客甲" }
```

## 协议（逆向自 `jhmud.js` 与实际抓包）

### 登录五步

| # | 请求 | 说明 |
|---|---|---|
| 1 | `POST /User/Login` `{name, pwd}` | 返回 `Set-Cookie: c=<用户id>` |
| 2 | `POST /Servers/GetServer` | `[{Id, Name, Ip, Port}]` |
| 3 | `POST /Servers/SelectServer` `{id, server[Id], server[Name], server[Ip], server[Port]}` | `id` 就是 cookie 里的 `c`；返回角色数组 |
| 4 | `POST /Role/SelectRole` `{Id, Title, Name, IsMove}` | `Data` = **key**（登录票据） |
| 5 | `ws://<Ip>:<Port>` | 连上后服务器先发一帧，含「登录信息确认：」→ 回 `login <key>\n` |

### 帧格式

- 分隔符 **`^^`**，最后一段可能不完整，要留到下次拼接
- `{type:"..."}` 是控制帧，**key 没引号、允许尾逗号 → 不是严格 JSON，用 `json5` 解析**
- 其余是文本行，带 `<hic> <hir> <nor>` 颜色标签，去掉标签就是正文
- **发指令必须带 `\n`**（游戏里是 `GameClient.Send(cmd + "\n")`）

### 已见帧类型

```
room        {path, name, desc, exits, items}
exits       出口列表
items       房间物品
dialog      {dialog: "pack"|"tasks"|"skills"|"jh"|"notice", ...}
sc          状态变化 {id, hp}
state       自身状态
actions     可用动作
perform     技能表 {skills:[{id, name, distime}]}
itemadd / itemremove / removeAction
login
```

## 目录结构（与参考项目的对应）

| 本仓库 | wsmud/daily | 作用 |
|---|---|---|
| `src/socket.js` | `source/librarys/socket.js` | EventEmitter，按 `type` 派发 |
| `src/cmd.js` | `source/librarys/cmd.js` | 指令队列，500 ms 间隔 |
| `src/login.js` | `source/utils/getToken.js` + `getServer.js` | HTTP 登录换 key |
| `src/loader.js` | `source/librarys/daily.js` 的 `loadEvent` | 按文件名绑定事件 |
| `src/events/general/*.js` | `source/events/general/*.js` | 具体场景逻辑 |

## 加一个日常事件

在 `src/events/general/` 下建 `事件名.js`，文件名 = 帧的 `type`：

```js
// src/events/general/datong.js  —— 收到 type:"datong" 时触发
module.exports = function (data) {
  if (data.done) return;
  this.send('dazuo 30');       // this 是 Socket，send 已自动排队 + 补 \n
};
```

文本类事件（没有 type 的行）跑在 `tip` 上：

```js
// src/events/general/tip.js
module.exports = function (line) {
  if (/你饿了/.test(line)) this.send('eat food');
};
```

## 现状与边界

- ✅ 登录、收帧、发指令、事件派发、指令限速
- ⏳ 日常任务逻辑（签到/师门/追捕/副本）还没写 —— 需要按 `tasks` 返回的具体条目逐条接
- ⚠️ 这套只适合**固定流程**（每天跑一遍日常）。原版 `jhxmud.js` 那 6000 多行的实时战斗/副本逻辑，
  用浏览器方案更划算
- 两个方案可以并存：浏览器常驻跑复杂副本，协议客户端每天定时跑日常

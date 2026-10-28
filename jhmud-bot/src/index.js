'use strict';
/**
 * 江湖行 · 协议客户端（参考 wsmud/daily 的结构）
 *
 *   node src/index.js --record   打印所有帧，用来摸协议
 *   node src/index.js --daily    跑日常（目前只做信息采集）
 */
const fs = require('fs');
const path = require('path');
const { login } = require('./login');
const Socket = require('./socket');
const { loadEvents } = require('./loader');

const argv = process.argv.slice(2);
const MODE = argv.includes('--daily') ? 'daily' : 'record';

const counts = Object.create(null);
const texts = [];

(async () => {
  const cfgPath = path.join(__dirname, '..', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));

  const info = await login(cfg);
  console.log(`[登录] ${info.role.Title || ''}${info.role.Name}  →  ${info.server}`);

  const sock = new Socket(cfg);
  loadEvents(sock, 'general');

  sock.on('OPEN', () => console.log('[WS] 已连接，等待服务器提示'));

  sock.on('LOGIN_SENT', () => {
    console.log('[WS] 已发送 login，开始采集');
    setTimeout(() => sock.send('cha;look;pack;tasks', true), 600);
    setTimeout(() => {
      console.log('\n===== 帧类型统计 =====');
      Object.entries(counts).sort((a, b) => b[1] - a[1])
        .forEach(([k, v]) => console.log(String(k).padEnd(16), v));
      console.log('\n===== 最后 20 条文本 =====');
      texts.slice(-20).forEach((t) => console.log(' ', t));
      sock.close();
      process.exit(0);
    }, 15000);
  });

  sock.on('frame', (d) => {
    counts[d.type] = (counts[d.type] || 0) + 1;
    if (MODE === 'record' && d.type === 'room') {
      console.log(`[房间] ${d.name}  ${d.path}`);
    }
  });

  sock.on('tip', (line) => {
    if (!line) return;
    texts.push(line);
    if (texts.length > 200) texts.shift();
  });

  sock.on('CLOSE', () => console.log('[WS] 断开'));

  sock.connect(info.server, info.key);
})().catch((e) => {
  console.error('[失败]', e.message);
  process.exit(1);
});

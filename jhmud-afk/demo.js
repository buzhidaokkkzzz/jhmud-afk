#!/usr/bin/env node
'use strict';
/** 一次性演示：登录 → 选服 → 选角色 → 进游戏，每步截图 */
const { chromium } = require('playwright');
const fs = require('fs');

const cfg = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
const ARGS = ['--disable-gpu','--disable-software-rasterizer','--disable-dev-shm-usage','--no-sandbox','--mute-audio',
  '--blink-settings=imagesEnabled=false','--js-flags=--max-old-space-size=128',
  '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ headless: true, args: ARGS });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  p.on('pageerror', (e) => console.log('PAGE ERROR:', String(e).slice(0, 200)));
  await p.route('**/*', (r) => ['image','font','media'].includes(r.request().resourceType()) ? r.abort() : r.continue());

  await p.goto(cfg.url, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.vm && window.vm.login);
  console.log('1. 页面就绪，开始登录:', cfg.user);

  await p.evaluate(([u, pw]) => { vm.login.name = u; vm.login.pwd = pw; User.Login(); }, [cfg.user, cfg.pass]);
  await sleep(3000);

  const msg = await p.evaluate(() => (vm.prompt && vm.prompt.message) || '');
  console.log('   服务器返回:', msg || '(无提示=成功)');
  await p.screenshot({ path: 'step1-after-login.png' });

  // 依次点：进入分舵 / 踏入江湖
  for (const label of ['进入分舵', '踏入江湖', '进入江湖']) {
    const els = p.getByText(label, { exact: true });
    const n = await els.count();
    let hit = false;
    for (let i = 0; i < n; i++) {
      if (await els.nth(i).isVisible().catch(() => false)) {
        await els.nth(i).click().catch(() => {});
        console.log('2. 点击:', label);
        hit = true;
        await sleep(2500);
        break;
      }
    }
    if (!hit) console.log('   （未见按钮:', label + '）');
    if (await p.evaluate(() => !!(window.GameClient?.Connected?.())).catch(() => false)) break;
  }

  // 等 WebSocket 连上
  const ok = await p.waitForFunction(() => !!(window.GameClient && GameClient.Connected && GameClient.Connected()),
    null, { timeout: 20000 }).then(() => true).catch(() => false);

  console.log('3. WebSocket 已连接:', ok);
  await sleep(4000);
  await p.screenshot({ path: 'step2-in-game.png' });

  const state = await p.evaluate(() => ({
    role: User.role ? { name: User.role.Name, id: User.role.Id } : null,
    key: !!User.key,
    room: (window.vm && vm.room) ? vm.room.Name || vm.room.name : null,
    trigger: (window.vm && vm.trigger) || null,
  })).catch(() => ({}));
  console.log('4. 游戏内状态:', JSON.stringify(state));

  // 保活 60 秒，观察挂机脚本是否开始动作
  console.log('5. 保活 60 秒，观察脚本...');
  for (let i = 0; i < 6; i++) {
    await sleep(10000);
    const alive = await p.evaluate(() => !!(window.GameClient && GameClient.Connected && GameClient.Connected()));
    console.log('   +' + (i + 1) * 10 + 's  ws=' + alive);
  }
  await p.screenshot({ path: 'step3-after-60s.png' });

  const ps = await p.evaluate(() => ({
    hp: document.querySelector('.state-bar')?.innerText?.replace(/\s+/g, ' ').slice(0, 120) || null,
    lines: [...document.querySelectorAll('.msg, .message, .room-msg')].slice(-5).map((e) => e.innerText.slice(0, 80)),
  })).catch(() => ({}));
  console.log('6. 界面快照:', JSON.stringify(ps));

  await b.close();
  console.log('完成');
})().catch((e) => { console.error('失败:', e); process.exit(1); });

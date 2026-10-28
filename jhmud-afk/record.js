#!/usr/bin/env node
'use strict';
/** 录制器：跑一次登录→进游戏，把 HTTP 请求和 WebSocket 帧全部录下来 */
const { chromium } = require('playwright');
const fs = require('fs');

const cfg = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8').replace(/^\uFEFF/, ''));
const ARGS = ['--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--mute-audio',
  '--blink-settings=imagesEnabled=false','--disable-background-timer-throttling'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const redact = (s) => (s || '').replace(/(pwd[^&]*=)[^&]*/gi, '$1***').slice(0, 400);

(async () => {
  const out = [];
  const b = await chromium.launch({ headless: true, args: ARGS });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  await p.route('**/*', (r) => ['image','font','media'].includes(r.request().resourceType()) ? r.abort() : r.continue());

  p.on('request', (req) => {
    const rt = req.resourceType();
    if (rt === 'script' || rt === 'stylesheet' || rt === 'image' || rt === 'font') return;
    out.push(`HTTP> ${req.method()} ${req.url()}\n      ${redact(req.postData())}`);
  });
  p.on('response', async (res) => {
    const u = res.url();
    if (!/175\.178\.190\.184/.test(u)) return;
    if (/\.(js|css|png|jpg|gif|woff)/.test(u)) return;
    try {
      const body = await res.text();
      out.push(`HTTP< ${res.status()} ${u}\n      ${body.slice(0, 500)}`);
    } catch { /* ignore */ }
  });
  p.on('websocket', (ws) => {
    out.push(`WS OPEN ${ws.url()}`);
    ws.on('framesent', (f) => out.push(`WS> ${String(f.payload).slice(0, 300)}`));
    ws.on('framereceived', (f) => out.push(`WS< ${String(f.payload).slice(0, 300)}`));
    ws.on('close', () => out.push('WS CLOSE'));
  });

  await p.goto(cfg.url, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.vm && window.vm.login);
  await p.evaluate(([u, pw]) => { vm.login.name = u; vm.login.pwd = pw; User.Login(); }, [cfg.user, cfg.pass]);
  await sleep(3000);

  for (const label of ['进入分舵', '踏入江湖']) {
    const els = p.getByText(label, { exact: true });
    for (let i = 0; i < (await els.count()); i++) {
      if (await els.nth(i).isVisible().catch(() => false)) {
        await els.nth(i).click().catch(() => {});
        await sleep(3000);
        break;
      }
    }
  }
  await sleep(15000);
  await b.close();

  fs.writeFileSync(__dirname + '/record.txt', out.join('\n'), 'utf8');
  console.log('帧/请求条数:', out.length);
  console.log(out.slice(0, 40).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });

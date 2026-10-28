#!/usr/bin/env node
'use strict';
/**
 * 江湖行 —— 无头挂机守护进程
 * 用无头 Chromium 加载游戏页面，自动登录并保持在线；断线自动重连。
 * 依赖：npm i playwright && npx playwright install chromium
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const cfgPath = path.join(ROOT, 'config.json');
if (!fs.existsSync(cfgPath)) {
  console.error('缺少 config.json —— 先复制 config.example.json 并填账号密码');
  process.exit(1);
}
const cfg = Object.assign({
  url: 'http://175.178.190.184/',
  user: '', pass: '',
  headless: true,
  checkEvery: 15,
  logFile: path.join(ROOT, 'afk.log'),
  shotOnError: true,
}, JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, '')));

function log(...a) {
  const line = `[${new Date().toISOString()}] ${a.join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(cfg.logFile, line + '\n'); } catch { /* ignore */ }
}

// 省内存 / 省 CPU 的启动参数
const ARGS = [
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--mute-audio',
  '--blink-settings=imagesEnabled=false',
  '--js-flags=--max-old-space-size=128',
  // 以下三项很重要：无头模式下定时器会被节流，会让游戏计时/技能冷却变慢
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=Translate,MediaRouter,BackForwardCache',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 按可见文本点击，找不到就跳过 */
async function clickText(page, label, timeout = 2500) {
  const els = page.getByText(label, { exact: true });
  const n = Math.min(await els.count().catch(() => 0), 8);
  for (let i = 0; i < n; i++) {
    const el = els.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout }).catch(() => {});
      return true;
    }
  }
  return false;
}

const inGame = (page) =>
  page.evaluate(() => {
    const g = window.GameClient;
    return !!(g && g.ws && g.ws.readyState === 1);
  }).catch(() => false);

async function login(page) {
  await page.waitForFunction(() => window.vm && window.vm.login, null, { timeout: 20000 });

  // 登录方法挂在 User 命名空间下（不是 vm.Login）
  const viaVm = await page.evaluate(([u, p]) => {
    try {
      if (!window.User || typeof User.Login !== 'function') return false;
      vm.login.name = u;
      vm.login.pwd = p;
      User.Login();
      return true;
    } catch { return false; }
  }, [cfg.user, cfg.pass]).catch(() => false);

  if (!viaVm) {
    log('User.Login 不可用，改用表单填写');
    await page.fill('input[placeholder="请输入用户名"]', cfg.user).catch(() => {});
    await page.fill('input[placeholder="请输入密码"]', cfg.pass).catch(() => {});
    await clickText(page, '踏入江湖');
  }
  await sleep(1500);
  const msg = await page.evaluate(() => (window.vm && vm.prompt && vm.prompt.message) || '').catch(() => '');
  if (msg) log('登录返回:', msg);
}

/** 一路点过 服务器 → 角色 → 进入游戏 */
async function advance(page) {
  const labels = ['进入分舵', '踏入江湖', '进入江湖', '确定'];
  for (let round = 0; round < 15; round++) {
    if (await inGame(page)) return true;
    let clicked = false;
    for (const l of labels) {
      if (await clickText(page, l)) { clicked = true; break; }
    }
    if (!clicked) {
      // 兜底：直接调 Vue 的方法链（不依赖按钮文案）
      await page.evaluate(() => {
        try {
          if (!window.vm || !window.User) return;
          if (vm.list && vm.list.servers && vm.list.servers.length && !User.server) {
            User.SelectServer(vm.list.servers[0]);
            return;
          }
          if (vm.list && vm.list.roles && vm.list.roles.length && User.server && !User.key) {
            User.SelectRole(vm.ui.selectedRole || vm.list.roles[0]);
          }
        } catch { /* ignore */ }
      }).catch(() => {});
    }
    await sleep(1500);
  }
  return inGame(page);
}

async function newPage(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 720, height: 540 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  // 不下载图片/字体/媒体，省带宽也省内存
  await page.route('**/*', (route) => {
    const t = route.request().resourceType();
    if (t === 'image' || t === 'font' || t === 'media') return route.abort();
    return route.continue();
  });

  page.on('pageerror', (e) => log('页面异常:', String(e).slice(0, 200)));
  page.on('crash', () => log('页面崩溃'));
  return page;
}

async function session(browser) {
  const page = await newPage(browser);
  await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1500);

  await login(page);
  await sleep(2500);

  if (!(await advance(page))) {
    await page.screenshot({ path: path.join(ROOT, 'error.png') }).catch(() => {});
    throw new Error('未能进入游戏（已截图 error.png）');
  }
  log('已进入游戏，开始保活');

  // 保活看门狗
  let idle = 0;
  while (true) {
    await sleep(cfg.checkEvery * 1000);
    if (!(await inGame(page))) throw new Error('WebSocket 已断开');
    idle += cfg.checkEvery;

    // 每 5 分钟尝试刷新一次角色状态，顺便确认页面没卡死
    if (idle % 300 === 0) {
      const alive = await page.evaluate(() => !!(window.vm && window.vm.role)).catch(() => false);
      if (!alive) throw new Error('页面状态丢失');
    }
  }
}

(async () => {
  let browser;
  while (true) {
    try {
      if (!browser || !browser.isConnected()) {
        browser = await chromium.launch({ headless: cfg.headless, args: ARGS });
        log('浏览器已启动', `headless=${cfg.headless}`);
      }
      await session(browser);
    } catch (e) {
      log('断开:', e.message, '—— 10 秒后重连');
      try { if (browser) await browser.close(); } catch { /* ignore */ }
      browser = null;
      await sleep(10000);
    }
  }
})();

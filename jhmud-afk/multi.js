#!/usr/bin/env node
'use strict';
/**
 * 江湖行 · 多账号 / 多角色无头挂机
 *
 * config-multi.json 两种写法：
 *   A. 多账号（推荐）
 *      { "accounts": [ {"user":"你的账号","pass":"你的密码","roles":["侠客甲","侠客乙"]} ] }
 *      roles 留空数组 = 自动登该账号下全部侠影
 *   B. 单账号（兼容旧写法）
 *      { "user":"你的账号","pass":"你的密码","roles":["侠客甲"] }
 *
 * 每个角色一个独立 context，cookie/localStorage 互不干扰，所以多账号天然隔离。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const cfg = Object.assign(
  { url: 'http://175.178.190.184/', accounts: [], roles: [], headless: true, checkEvery: 20, blockCss: true },
  JSON.parse(fs.readFileSync(path.join(ROOT, 'config-multi.json'), 'utf8').replace(/^\uFEFF/, ''))
);

const ARGS = [
  '--disable-gpu', '--disable-software-rasterizer', '--disable-dev-shm-usage', '--no-sandbox',
  '--mute-audio', '--blink-settings=imagesEnabled=false', '--js-flags=--max-old-space-size=96',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=Translate,MediaRouter',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (tag, ...a) => console.log(`[${new Date().toTimeString().slice(0, 8)}][${tag}]`, ...a);

/** 把两种配置写法统一成 [{user, pass, roles}] */
function normalizeAccounts(c) {
  const list = Array.isArray(c.accounts) && c.accounts.length
    ? c.accounts
    : [{ user: c.user, pass: c.pass, roles: c.roles || [] }];
  return list
    .filter((a) => a && a.user && a.pass)
    .map((a) => ({ user: String(a.user), pass: String(a.pass), roles: a.roles || [] }));
}

/** 用 HTTP 直接问服务器：这个账号下有哪些侠影 */
async function listRoles(user, pass) {
  const form = (o) => (o ? new URLSearchParams(o).toString() : '');
  const call = async (url, body, cookie) => {
    const res = await fetch(cfg.url + url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: form(body),
    });
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    return { json: await res.json().catch(() => null), cookie: setCookie.map((s) => s.split(';')[0]).join('; ') };
  };

  const r1 = await call('User/Login', { name: user, pwd: pass });
  if (!r1.json || !r1.json.Sucess) throw new Error('账号登录失败: ' + (r1.json && r1.json.Message));
  const uid = (r1.cookie.match(/(?:^|;\s*)c=([^;]+)/) || [])[1];

  const r2 = await call('Servers/GetServer?', null, r1.cookie);
  const srv = r2.json && r2.json.Data && r2.json.Data[0];
  if (!srv) throw new Error('没有可用服务器');

  const r3 = await call('Servers/SelectServer', {
    id: uid,
    'server[Id]': srv.Id,
    'server[Name]': srv.Name,
    'server[Ip]': srv.Ip,
    'server[Port]': srv.Port,
  }, r1.cookie);
  const roles = (r3.json && r3.json.Data) || [];
  return { names: roles.map((r) => r.Name), server: srv };
}

async function clickText(page, label, timeout = 2500) {
  const els = page.getByText(label, { exact: true });
  const n = Math.min(await els.count().catch(() => 0), 10);
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

const whoAmI = (page) =>
  page.evaluate(() => (window.User && User.role && User.role.Name) || null).catch(() => null);

async function loginAs(page, account, roleName) {
  await page.waitForFunction(() => window.vm && window.vm.login, null, { timeout: 25000 });
  await page.evaluate(([u, p]) => {
    vm.login.name = u; vm.login.pwd = p; User.Login();
  }, [account.user, account.pass]);
  await sleep(3000);

  const msg = await page.evaluate(() => (vm.prompt && vm.prompt.message) || '').catch(() => '');
  if (msg) throw new Error('登录返回: ' + msg);

  await clickText(page, '进入分舵');     // 服务器页
  await sleep(2500);

  if (roleName) {
    const ok = await clickText(page, roleName);   // 选中指定侠影
    if (!ok) throw new Error(`角色列表里没找到「${roleName}」`);
    await sleep(800);
  }
  await clickText(page, '踏入江湖');
  await sleep(3000);

  const who = await whoAmI(page);
  if (roleName && who !== roleName) throw new Error(`进错角色：期望 ${roleName}，实际 ${who}`);
}

async function runRole(browser, account, roleName) {
  const tag = roleName;
  let backoff = 5000;
  while (true) {
    let ctx;
    try {
      ctx = await browser.newContext({ viewport: { width: 520, height: 400 }, deviceScaleFactor: 1, locale: 'zh-CN' });
      const page = await ctx.newPage();
      page.setDefaultTimeout(15000);
      const block = ['image', 'font', 'media', ...(cfg.blockCss ? ['stylesheet'] : [])];
      await page.route('**/*', (r) =>
        block.includes(r.request().resourceType()) ? r.abort() : r.continue());

      await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await loginAs(page, account, roleName);
      log(tag, '已进入游戏，开始保活');
      backoff = 5000;

      while (true) {
        await sleep(cfg.checkEvery * 1000);
        if (!(await inGame(page))) throw new Error('连接断开');
      }
    } catch (e) {
      log(tag, '异常:', e.message, `— ${backoff / 1000}s 后重试`);
      try { if (ctx) await ctx.close(); } catch { /* ignore */ }
      await sleep(backoff);
      backoff = Math.min(backoff * 1.5, 60000);
    }
  }
}

(async () => {
  const accounts = normalizeAccounts(cfg);
  if (!accounts.length) { console.error('config-multi.json 里没有有效账号（user/pass）'); process.exit(1); }

  // 角色列表为空 -> 自动拉取该账号下全部侠影
  const jobs = [];
  for (const acc of accounts) {
    let roles = acc.roles;
    if (!roles.length) {
      try {
        const { names } = await listRoles(acc.user, acc.pass);
        roles = names;
        log(acc.user, `自动获取到 ${names.length} 个侠影: ${names.join(' / ')}`);
      } catch (e) {
        log(acc.user, '获取角色列表失败:', e.message);
        continue;
      }
    }
    roles.forEach((r) => jobs.push({ account: acc, role: r }));
  }

  if (!jobs.length) { console.error('没有可挂的角色'); process.exit(1); }

  const browser = await chromium.launch({ headless: cfg.headless, args: ARGS });
  log('main', `浏览器已启动 | 账号 ${accounts.length} 个 | 角色 ${jobs.length} 个`);
  log('main', '挂机清单: ' + jobs.map((j) => `${j.account.user}/${j.role}`).join('  '));
  if (jobs.length > 6) log('main', `⚠ ${jobs.length} 个角色预计占 ${(jobs.length * 0.17).toFixed(1)} GB 内存`);

  await Promise.all(jobs.map((j) => runRole(browser, j.account, j.role)));
})();

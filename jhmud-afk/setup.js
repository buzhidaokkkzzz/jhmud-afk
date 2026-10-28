#!/usr/bin/env node
'use strict';
/**
 * 江湖行 · 配置向导
 * 双击「配置账号.bat」，按提示回答即可，自动写 config-multi.json
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { stdin, stdout } = process;

const ROOT = __dirname;
const CONFIG = path.join(ROOT, 'config-multi.json');
const URL_BASE = 'http://175.178.190.184/';

const rl = readline.createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
const ask = (text) => new Promise((resolve) => rl.question(text, (a) => resolve(a.trim())));

async function httpLogin(user, pass) {
  const form = (o) => (o ? new URLSearchParams(o).toString() : '');
  const call = async (url, body, cookie) => {
    const res = await fetch(URL_BASE + url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: form(body),
    });
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    return {
      json: await res.json().catch(() => null),
      cookie: setCookie.map((s) => s.split(';')[0]).join('; '),
    };
  };

  const r1 = await call('User/Login', { name: user, pwd: pass });
  if (!r1.json || !r1.json.Sucess) throw new Error((r1.json && r1.json.Message) || '账号或密码错误');
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
  return roles.map((r) => r.Name);
}

/** "" => 全部；"1,3" => 指定；"2-4" => 范围 */
function pick(names, input) {
  if (!input) return names.slice();
  const idx = new Set();
  for (const part of input.split(/[,，\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) { for (let i = +m[1]; i <= +m[2]; i++) idx.add(i); }
    else if (/^\d+$/.test(part)) idx.add(+part);
  }
  return [...idx].filter((i) => i >= 1 && i <= names.length).map((i) => names[i - 1]);
}

(async () => {
  console.log('\n============================================');
  console.log('        江湖行 · 挂机配置向导');
  console.log('============================================\n');

  if (fs.existsSync(CONFIG)) {
    const a = await ask('已存在配置，重新配置会覆盖。继续？(Y/n) ');
    if (a && /^n/i.test(a)) { console.log('已取消。'); rl.close(); return; }
    console.log('');
  }

  const accounts = [];

  while (true) {
    const user = await ask('账号：');
    if (!user) { console.log('账号不能为空\n'); continue; }

    console.log('（密码会显示在屏幕上，输了什么就是什么）');
    let pass = '';
    let names = null;

    // 密码可以重试，不用重头开始
    while (!names) {
      pass = await ask('密码：');
      if (!pass) { console.log('密码不能为空\n'); continue; }

      process.stdout.write('正在查询角色...');
      try {
        names = await httpLogin(user, pass);
      } catch (e) {
        console.log(`\r查询失败：${e.message}          `);
        const again = await ask('再试一次这个账号？(Y/n) ');
        if (again && /^n/i.test(again)) break;
      }
    }

    if (!names) {
      const more = await ask('换一个账号？(Y/n) ');
      if (more && /^n/i.test(more)) break;
      console.log('');
      continue;
    }

    console.log(`\r查到 ${names.length} 个侠影：          `);
    names.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));

    const sel = await ask('\n要挂哪些？直接回车=全部，或输入序号（如 1,3,5 或 2-4）：\n> ');
    const roles = pick(names, sel);
    if (!roles.length) {
      console.log('一个都没选，跳过这个账号\n');
    } else {
      accounts.push({ user, pass, roles });
      console.log(`已添加：${user} → ${roles.join(' / ')}\n`);
    }

    const more = await ask('还要再加一个账号吗？(y/N) ');
    if (!/^y/i.test(more)) break;
    console.log('');
  }

  rl.close();

  if (!accounts.length) {
    console.log('\n没有配置任何账号，已退出。');
    return;
  }

  fs.writeFileSync(CONFIG, JSON.stringify({
    url: URL_BASE,
    accounts,
    headless: true,
    checkEvery: 20,
    blockCss: true,
  }, null, 2), 'utf8');

  const total = accounts.reduce((n, a) => n + a.roles.length, 0);
  console.log('\n============================================');
  console.log(`配置已保存：${accounts.length} 个账号，共 ${total} 个角色`);
  accounts.forEach((a) => console.log(`  ${a.user} : ${a.roles.join(' / ')}`));
  console.log(`预计内存：约 ${(total * 0.17).toFixed(1)} GB`);
  console.log('\n现在双击「启动挂机.bat」就可以开始挂机了。');
  console.log('============================================\n');
})();

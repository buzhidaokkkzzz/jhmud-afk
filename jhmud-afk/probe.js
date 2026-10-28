#!/usr/bin/env node
'use strict';
/** 探针：把页面上的全局对象、按钮文案、输入框全打出来，用于适配改版 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => console.log('PAGE ERROR:', String(e).slice(0, 300)));

  await page.goto('http://175.178.190.184/', { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const out = { hasVm: !!window.vm, fields: {}, buttons: [], inputs: [] };
    if (window.vm) {
      out.fields.vmKeys = Object.keys(window.vm).filter((k) => !k.startsWith('$') && !k.startsWith('_')).slice(0, 60);
      out.fields.hasLogin = typeof window.vm.Login;
      out.fields.hasGetServer = typeof window.vm.GetServer;
      out.fields.hasSelectServer = typeof window.vm.SelectServer;
      out.fields.loginModel = window.vm.login ? Object.keys(window.vm.login) : null;
      out.fields.key = !!window.vm.key;
    }
    out.hasGameClient = !!window.GameClient;
    document.querySelectorAll('input').forEach((el) => {
      if (el.offsetParent !== null) out.inputs.push({ model: el.getAttribute('v-model'), type: el.type });
    });
    document.querySelectorAll('a,button,div,span').forEach((el) => {
      const t = (el.textContent || '').trim();
      if (t && t.length <= 8 && el.offsetParent !== null && el.children.length === 0) {
        if (!out.buttons.includes(t)) out.buttons.push(t);
      }
    });
    out.buttons = out.buttons.slice(0, 80);
    return out;
  });

  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: 'probe.png' });
  await browser.close();
})();

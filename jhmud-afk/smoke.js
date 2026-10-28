const { chromium } = require('playwright');
const ARGS = ['--disable-gpu','--disable-software-rasterizer','--disable-dev-shm-usage','--no-sandbox','--mute-audio','--blink-settings=imagesEnabled=false','--js-flags=--max-old-space-size=128','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'];
(async () => {
  const b = await chromium.launch({ headless: true, args: ARGS });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  await p.route('**/*', r => ['image','font','media'].includes(r.request().resourceType()) ? r.abort() : r.continue());
  const t0 = Date.now();
  await p.goto('http://175.178.190.184/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.vm && window.vm.login, null, { timeout: 20000 });
  console.log('页面就绪耗时:', Date.now() - t0, 'ms');
  const st = await p.evaluate(() => ({
    userLogin: typeof window.User?.Login,
    inputs: [...document.querySelectorAll('input')].filter(e=>e.offsetParent).map(e=>e.placeholder),
    title: document.title,
  }));
  console.log(JSON.stringify(st));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'shot-login.png' });
  await b.close();
  console.log('OK');
})();

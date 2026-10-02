const fs = require('node:fs');
let browser;
async function render(input, uiBase) {
  if (!browser?.isConnected()) {
    const { chromium } = require('./runtime/playwright-core');
    for (const channel of ['msedge','chrome']) {
      try { browser = await chromium.launch({channel, headless:true, chromiumSandbox:true}); break; } catch {}
    }
    if (!browser?.isConnected()) throw Error('Install Microsoft Edge or Chrome to render employee images.');
  }
  const context = await browser.newContext({serviceWorkers:'block'});
  try {
    const origin = new URL(uiBase).origin;
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === origin || ['data:','blob:'].includes(url.protocol) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(`${uiBase}/id-generator-renderer.html`, {timeout:15000});
    await page.waitForFunction(() => typeof window.renderEmployeeAssets === 'function');
    const result = await page.evaluate(async data => await window.renderEmployeeAssets(data), input);
    return {photo:Buffer.from(result.photo,'base64'),signature:Buffer.from(result.signature,'base64')};
  } finally { await context.close(); }
}
async function close() { await browser?.close(); browser = null; }
module.exports = {render,close};

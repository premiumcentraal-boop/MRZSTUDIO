/**
 * Headless Chrome: pad a real Incoming badge PNG and check IHDR + white corners.
 * Uses the Vite /api proxy so the canvas is not CORS-tainted.
 *
 *   node tests/print-margin-pad.cjs
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const WebSocket = globalThis.WebSocket;

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PAGE = "http://127.0.0.1:5173/tools/id-generator";
const JOB = "af22222e-a9a0-4e08-8adf-87e41623fd1c";
const FILE = `/api/jobs/${JOB}/files/result-front.png`;
const MARGIN = 12; // 1.0 mm at 300 DPI
const PORT = 9229;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitJson(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      /* chrome not up yet */
    }
    await sleep(150);
  }
  throw new Error(`timeout waiting for ${url}`);
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  return (method, params) =>
    new Promise((resolve, reject) => {
      const next = ++id;
      pending.set(next, { resolve, reject });
      ws.send(JSON.stringify({ id: next, method, params }));
    });
}

async function main() {
  if (!fs.existsSync(CHROME)) {
    console.log("SKIP chrome pad smoke (Chrome not installed)");
    return;
  }
  const ui = await fetch("http://127.0.0.1:5173", { method: "HEAD" }).catch(() => null);
  if (!ui || !ui.ok) {
    console.log("SKIP chrome pad smoke (Vite not running at 127.0.0.1:5173)");
    return;
  }

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "mrz-chrome-"));
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userData}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    await waitJson(`http://127.0.0.1:${PORT}/json/version`);
    const targets = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
    const page =
      (Array.isArray(targets) ? targets : []).find((t) => t.type === "page" && t.webSocketDebuggerUrl) ||
      (Array.isArray(targets) ? targets : []).find((t) => t.webSocketDebuggerUrl);
    if (!page) throw new Error("no Chrome page target");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    const send = cdp(ws);
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url: PAGE });
    await sleep(2500);

    const expression = `(() => {
      const FILE = ${JSON.stringify(FILE)};
      const MARGIN = ${MARGIN};
      return (async () => {
        const res = await fetch(FILE);
        if (!res.ok) throw new Error("fetch " + res.status);
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        const srcW = bmp.width;
        const srcH = bmp.height;
        const canvas = document.createElement("canvas");
        canvas.width = srcW + 2 * MARGIN;
        canvas.height = srcH + 2 * MARGIN;
        const ctx = canvas.getContext("2d", { alpha: false });
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bmp, MARGIN, MARGIN);
        const corner = Array.from(ctx.getImageData(0, 0, 1, 1).data);
        const inner = Array.from(ctx.getImageData(MARGIN, MARGIN, 1, 1).data);
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = srcW;
        srcCanvas.height = srcH;
        const sctx = srcCanvas.getContext("2d", { alpha: false });
        sctx.drawImage(bmp, 0, 0);
        const orig = Array.from(sctx.getImageData(0, 0, 1, 1).data);
        bmp.close();
        return {
          srcW, srcH,
          outW: canvas.width,
          outH: canvas.height,
          corner, inner, orig,
        };
      })();
    })()`;

    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "evaluate failed");
    }
    const v = result.result.value;
    if (v.srcW !== 1874 || v.srcH !== 1181) {
      throw new Error(`unexpected source size ${v.srcW}x${v.srcH}`);
    }
    if (v.outW !== 1874 + 24 || v.outH !== 1181 + 24) {
      throw new Error(`unexpected padded size ${v.outW}x${v.outH}`);
    }
    if (v.corner[0] !== 255 || v.corner[1] !== 255 || v.corner[2] !== 255) {
      throw new Error(`corner not white: ${v.corner}`);
    }
    if (v.inner[0] !== v.orig[0] || v.inner[1] !== v.orig[1] || v.inner[2] !== v.orig[2]) {
      throw new Error(`content not preserved: inner ${v.inner} orig ${v.orig}`);
    }
    console.log(
      `OK  chrome pad ${v.srcW}x${v.srcH} + ${MARGIN}px → ${v.outW}x${v.outH}; corner white; pixels untouched`,
    );

    let clicked = false;
    for (let i = 0; i < 20; i++) {
      const ui = await send("Runtime.evaluate", {
        expression: `(() => {
          const buttons = [...document.querySelectorAll("button")];
          const view = buttons.find((b) => (b.textContent || "").trim() === "View");
          if (!view) return { ok: false, reason: "no View button" };
          view.click();
          return { ok: true };
        })()`,
        returnByValue: true,
      });
      if (ui.exceptionDetails) throw new Error(ui.exceptionDetails.text || "view click failed");
      if (ui.result.value.ok) {
        clicked = true;
        break;
      }
      await sleep(250);
    }
    if (!clicked) throw new Error("no View button (recent jobs not loaded)");
    await sleep(1500);
    const panel = await send("Runtime.evaluate", {
      expression: `(() => {
        const text = document.body.innerText || "";
        const slider = document.querySelector('input.print-margin-slider, input[aria-label="Print margin"]');
        return {
          hasIncoming: text.includes("Incoming items"),
          hasLabel: text.includes("Print margin"),
          hasSublabel: text.includes("White edge for cutting"),
          hasFull: text.includes("Full Badge"),
          hasFront: text.includes("Badge front"),
          hasBack: text.includes("Badge back"),
          hasSlider: !!slider,
          sliderMin: slider ? slider.min : null,
          sliderMax: slider ? slider.max : null,
          sliderStep: slider ? slider.step : null,
          sliderValue: slider ? slider.value : null,
        };
      })()`,
      returnByValue: true,
    });
    const p = panel.result.value;
    if (!p.hasIncoming || !p.hasLabel || !p.hasSublabel || !p.hasSlider) {
      throw new Error("Incoming print-margin UI missing: " + JSON.stringify(p));
    }
    if (!p.hasFull || !p.hasFront || !p.hasBack) {
      throw new Error("badge cards missing: " + JSON.stringify(p));
    }
    if (p.sliderMin !== "0" || p.sliderMax !== "5" || p.sliderStep !== "0.1") {
      throw new Error("slider range mismatch: " + JSON.stringify(p));
    }
    await send("Runtime.evaluate", {
      expression: `(() => {
        const slider = document.querySelector('input.print-margin-slider, input[aria-label="Print margin"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(slider, "1.0");
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        slider.dispatchEvent(new Event("change", { bubbles: true }));
        return slider.value;
      })()`,
      returnByValue: true,
    });
    await sleep(400);
    const after = await send("Runtime.evaluate", {
      expression: `(() => {
        const slider = document.querySelector('input.print-margin-slider, input[aria-label="Print margin"]');
        const text = document.body.innerText || "";
        return { value: slider && slider.value, hasPx: /\\d+ px/.test(text) };
      })()`,
      returnByValue: true,
    });
    const a = after.result.value;
    if (a.value !== "1" && a.value !== "1.0") {
      throw new Error("slider did not move to 1 mm: " + JSON.stringify(a));
    }
    if (!a.hasPx) throw new Error("px readout missing after slider move");
    const stored = await send("Runtime.evaluate", {
      expression: `localStorage.getItem("mrz.printMarginMm")`,
      returnByValue: true,
    });
    const storedVal = stored.result.value;
    if (storedVal !== "1" && storedVal !== "1.0") {
      throw new Error("localStorage mrz.printMarginMm not persisted: " + JSON.stringify(storedVal));
    }
    console.log("OK  Incoming Print margin slider 0–5 mm step 0.1; live 1.0 mm + px readout + localStorage");
    ws.close();
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

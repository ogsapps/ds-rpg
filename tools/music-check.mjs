import { chromium } from 'playwright-core';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const CHROMIUM_CANDIDATES = [
  '/usr/lib64/chromium-browser/chromium-browser',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json; charset=utf-8',
};

const exists = (p) => {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
};

const oneLine = (err) => String(err instanceof Error ? err.message : err).split('\n')[0];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return CHROMIUM_CANDIDATES.find(exists);
}

function staticServer() {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      let file = path.resolve(DIST, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (file !== DIST && !file.startsWith(`${DIST}${path.sep}`)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      const body = fs.readFileSync(file);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

// Runs in the page. Connects an analyser to the music bus and takes the peak RMS of 50 ms
// windows across the requested span (max, so a quiet moment between notes does not win).
// Windows overlap (sampled every 10 ms) so the peak does not depend on where a 50 ms grid lands.
async function measureRms(seconds) {
  const a = window.__emberfallAudio;
  const ctx = a.ctx;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  a.musicBus.connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);
  let max = 0;
  const end = performance.now() + seconds * 1000;
  try {
    while (performance.now() < end) {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
      max = Math.max(max, Math.sqrt(sum / buffer.length));
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } finally {
    a.musicBus.disconnect(analyser);
  }
  return max;
}

async function main() {
  if (!exists(DIST)) throw new Error(`Missing dist: ${DIST} (run npm run build)`);
  const executablePath = findChromium();
  if (!executablePath) throw new Error('No Chromium binary found (set CHROMIUM_PATH)');

  const server = staticServer();
  let browser = null;
  const results = [];

  try {
    // A short-lived concrete port on loopback (this sandbox refuses OS-assigned listen(0) ports).
    let port = 0;
    for (let attempt = 0; attempt < 20 && !port; attempt++) {
      const candidate = 20000 + Math.floor(Math.random() * 40000);
      try {
        await new Promise((resolve, reject) => {
          const onError = (err) => { server.off('listening', onListening); reject(err); };
          const onListening = () => { server.off('error', onError); resolve(); };
          server.once('error', onError);
          server.once('listening', onListening);
          server.listen(candidate, '127.0.0.1');
        });
        port = candidate;
      } catch {
        // EADDRINUSE: try another short-lived port.
      }
    }
    assert(port, 'could not bind a local server port');
    const base = `http://127.0.0.1:${port}/`;

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
      executablePath,
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(oneLine(err)));

    const openAudioPage = async (url, init = true) => {
      const p = await context.newPage();
      p.setDefaultTimeout(15000);
      p.on('pageerror', (err) => pageErrors.push(oneLine(err)));
      await p.goto(url, { waitUntil: 'load' });
      await p.click('body');
      if (init) await p.evaluate(async () => { await window.__emberfallAudio.init(); });
      return p;
    };

    const run = async (name, fn) => {
      try {
        const detail = await fn();
        results.push(true);
        console.log(JSON.stringify({ check: name, ok: true, ...detail }));
      } catch (err) {
        results.push(false);
        console.log(JSON.stringify({ check: name, ok: false, error: oneLine(err) }));
      }
    };

    const toneweftPage = await openAudioPage(`${base}?toneweft&audiodebug`);

    await run('engine', async () => {
      const info = await toneweftPage.evaluate(() => {
        const a = window.__emberfallAudio;
        return { toneweft: a.tw !== null };
      });
      assert(info.toneweft, 'a.tw is null');
      return info;
    });

    await run('plays', async () => {
      await toneweftPage.evaluate(() => window.__emberfallAudio.playMusic('ashen'));
      await toneweftPage.waitForTimeout(1500);
      const state = await toneweftPage.evaluate(() => {
        const a = window.__emberfallAudio;
        return {
          playing: a.tw.playing,
          loop: a.tw.loop,
          timer: a.timer,
        };
      });
      const rms = await toneweftPage.evaluate(measureRms, 1);
      assert(state.playing === true, 'a.tw.playing is not true');
      assert(state.loop !== null, 'a.tw.loop is null');
      assert(state.timer === null, 'the old scheduler timer is running');
      assert(rms > 0.001, `RMS over 1 s was ${rms}`);
      return { playing: state.playing, loop: state.loop, rms, timer: state.timer };
    });

    await run('boss', async () => {
      await toneweftPage.evaluate(() => window.__emberfallAudio.playMusic('ashen', true));
      await toneweftPage.waitForTimeout(2000);
      const on = await toneweftPage.evaluate(() => window.__emberfallAudio.tw.getLayerVolume('boss'));
      await toneweftPage.evaluate(() => window.__emberfallAudio.playMusic('ashen', false));
      await toneweftPage.waitForTimeout(2000);
      const off = await toneweftPage.evaluate(() => window.__emberfallAudio.tw.getLayerVolume('boss'));
      assert(on === 1, `boss layer volume was ${on}`);
      assert(off === 0, `boss layer volume was ${off}`);
      return { bossOn: on, bossOff: off };
    });

    await run('switch', async () => {
      await toneweftPage.evaluate(() => window.__emberfallAudio.playMusic('map'));
      await toneweftPage.waitForTimeout(1000);
      const state = await toneweftPage.evaluate(() => {
        const a = window.__emberfallAudio;
        return { theme: a.twTheme, playing: a.tw.playing };
      });
      assert(state.theme === 'map', `a.twTheme was ${String(state.theme)}`);
      assert(state.playing === true, 'a.tw.playing is not true');
      return state;
    });

    await run('mute', async () => {
      await toneweftPage.evaluate(() => window.__emberfallAudio.setMusicLevel(0));
      await toneweftPage.waitForTimeout(1000);
      const rms = await toneweftPage.evaluate(measureRms, 0.5);
      await toneweftPage.evaluate(() => window.__emberfallAudio.setMusicLevel(1));
      assert(rms < 0.0005, `muted RMS over 0.5 s was ${rms}`);
      return { mutedRms: rms };
    });

    await run('stop', async () => {
      await toneweftPage.evaluate(() => window.__emberfallAudio.stopMusic());
      await toneweftPage.waitForTimeout(500);
      const playing = await toneweftPage.evaluate(() => window.__emberfallAudio.tw.playing);
      assert(playing === false, 'a.tw.playing is not false after stopMusic()');
      return { playing };
    });

    let oldPage = null;

    await run('level', async () => {
      await toneweftPage.evaluate(() => window.__emberfallAudio.playMusic('ashen'));
      await toneweftPage.waitForTimeout(1000);
      const toneweftRms = await toneweftPage.evaluate(measureRms, 3);

      // Close the Toneweft page so the flag-off page is the only tab and its timers stay
      // unthrottled while the old sequencer is measured.
      await toneweftPage.close();
      oldPage = await openAudioPage(`${base}?audiodebug`);
      await oldPage.evaluate(() => window.__emberfallAudio.playMusic('ashen'));
      await oldPage.waitForTimeout(1000);
      const oldRms = await oldPage.evaluate(measureRms, 3);

      const ratioDb = 20 * Math.log10(toneweftRms / oldRms);
      return { toneweftRms, oldRms, ratioDb };
    });

    await run('flag-off', async () => {
      const state = await oldPage.evaluate(() => {
        const a = window.__emberfallAudio;
        return { toneweft: a.tw, timer: a.timer };
      });
      assert(state.toneweft === null, 'a.tw is not null with the flag off');
      assert(state.timer !== null, 'the old scheduler is not running with the flag off');
      return { toneweft: state.toneweft, timer: state.timer !== null };
    });

    if (pageErrors.length) console.log(JSON.stringify({ pageErrors }));
  } catch (err) {
    results.push(false);
    console.log(JSON.stringify({ check: 'setup', ok: false, error: oneLine(err) }));
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }

  const ok = results.length > 0 && results.every(Boolean);
  console.log(JSON.stringify({ ok }));
  process.exitCode = ok ? 0 : 1;
}

await main();

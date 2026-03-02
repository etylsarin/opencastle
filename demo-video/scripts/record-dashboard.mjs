/**
 * Record the OpenCastle dashboard in a browser using Playwright.
 *
 * Expects the dashboard to be running on http://localhost:4300
 * (started by build.sh before this script runs).
 *
 * Output: clips/04-dashboard-browser.mp4
 */

import { chromium } from 'playwright';

const DASHBOARD_URL = 'http://localhost:4300';
const OUTPUT_DIR = new URL('../clips', import.meta.url).pathname;
const WIDTH = 1280;
const HEIGHT = 720;

async function waitForServer(url, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${url} not ready after ${maxRetries}s`);
}

async function main() {
  // Wait for dashboard to be fully up and serving data
  console.log('  ⏳ Waiting for dashboard...');
  await waitForServer(DASHBOARD_URL);
  await waitForServer(`${DASHBOARD_URL}/data/sessions.ndjson`);
  console.log('  ✅ Dashboard ready');

  const browser = await chromium.launch({ headless: true });

  // First: load the page WITHOUT recording to let it fully render
  const preloadContext = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
  });
  const preloadPage = await preloadContext.newPage();
  await preloadPage.goto(DASHBOARD_URL, { waitUntil: 'networkidle' });

  // Wait until KPI cards show real data (not "—" or "0")
  await preloadPage.waitForFunction(() => {
    const vals = document.querySelectorAll('.kpi-card__value');
    if (vals.length === 0) return false;
    const first = vals[0]?.textContent?.trim();
    return first && first !== '—' && first !== '0';
  }, { timeout: 15000 });
  console.log('  ✅ Dashboard data rendered');
  await preloadContext.close();

  // Now start recording with a fresh context — page will load with cached data
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: WIDTH, height: HEIGHT },
    },
  });

  const page = await context.newPage();

  // Navigate to dashboard — it should render quickly now
  await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' });

  // Wait for data to appear in the recorded session too
  await page.waitForFunction(() => {
    const vals = document.querySelectorAll('.kpi-card__value');
    if (vals.length === 0) return false;
    const first = vals[0]?.textContent?.trim();
    return first && first !== '—' && first !== '0';
  }, { timeout: 15000 });

  // Ensure recording starts at top, then hold on fully loaded dashboard
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(3500);

  // Slowly scroll down to show content
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = 120;
    const total = document.body.scrollHeight;
    for (let y = 0; y < total; y += step) {
      window.scrollTo({ top: y, behavior: 'smooth' });
      await delay(400);
    }
  });

  await page.waitForTimeout(2000);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  // Close and save video
  await context.close();
  await browser.close();

  // Rename the recording to our expected filename
  const fs = await import('fs');
  const path = await import('path');
  const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.webm'));
  if (files.length > 0) {
    // Take the most recent webm
    const latest = files.sort().pop();
    const src = path.join(OUTPUT_DIR, latest);
    const dest = path.join(OUTPUT_DIR, '04-dashboard-browser.webm');
    fs.renameSync(src, dest);
    console.log(`  📹 Saved: ${dest}`);

    // Convert to mp4
    const { execSync } = await import('child_process');
    const mp4 = path.join(OUTPUT_DIR, '04-dashboard-browser.mp4');
    execSync(
      `ffmpeg -y -i "${dest}" -c:v libx264 -preset fast -crf 20 -c:a aac "${mp4}"`,
      { stdio: 'pipe' }
    );
    fs.unlinkSync(dest);
    console.log(`  🎬 Converted: ${mp4}`);
  }
}

main().catch((err) => {
  console.error('Browser recording failed:', err.message);
  process.exit(1);
});

import { access, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import puppeteer, { KnownDevices } from "puppeteer";

const outputDir = process.env.SCREENSHOT_OUTPUT_DIR ?? "screenshots";
const execFileAsync = promisify(execFile);

const captureSequences = {
  default: [
    {
      mode: "screenshot",
      device: "desktop",
      size: "1440x1024",
      urls: ["/"],
    },
    {
      mode: "screenshot",
      preset: "iPhone 14",
      size: "390x844",
      urls: ["/"],
    },
    {
      mode: "screenshot",
      device: "desktop",
      size: "1440x1024",
      urls: ["/explore"],
    },
    {
      mode: "screenshot",
      preset: "iPhone 14",
      size: "390x844",
      urls: ["/explore"],
    },
    {
      mode: "screenshot",
      device: "desktop",
      size: "1440x1024",
      urls: ["/club/1006012480/play?courseId=928991790"],
    },
    {
      mode: "screenshot",
      preset: "iPhone 14",
      size: "390x844",
      urls: ["/club/1006012480/play?courseId=928991790"],
    },
    {
      mode: "video",
      device: "desktop",
      size: "1440x1024",
      urls: ["/club/1006012480/play?courseId=928991790"],
    },
    {
      mode: "video",
      preset: "iPhone 14",
      size: "390x844",
      urls: ["/club/1006012480/play?courseId=928991790"],
    },
  ],
};

function parseArgs(argv) {
  const urls = [];
  let mode = process.env.SCREENSHOT_MODE ?? "screenshot";
  let size = process.env.SCREENSHOT_SIZE ?? "1440x1024";
  let device = process.env.SCREENSHOT_DEVICE ?? "desktop";
  let preset = process.env.SCREENSHOT_PRESET ?? "";
  let baseUrl = process.env.SCREENSHOT_BASE_URL ?? "";
  let cacheEnabled = process.env.SCREENSHOT_CACHE !== "false";
  let executablePath = process.env.SCREENSHOT_EXECUTABLE_PATH ?? "";
  let sequence = process.env.SCREENSHOT_SEQUENCE ?? "";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--url") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --url");
      urls.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--url=")) {
      urls.push(arg.slice("--url=".length));
      continue;
    }

    if (arg === "--size") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --size");
      size = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--size=")) {
      size = arg.slice("--size=".length);
      continue;
    }

    if (arg === "--mode") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --mode");
      mode = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length);
      continue;
    }

    if (arg === "--device") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --device");
      device = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--device=")) {
      device = arg.slice("--device=".length);
      continue;
    }

    if (arg === "--preset") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --preset");
      preset = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--preset=")) {
      preset = arg.slice("--preset=".length);
      continue;
    }

    if (arg === "--base-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --base-url");
      baseUrl = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--base-url=")) {
      baseUrl = arg.slice("--base-url=".length);
      continue;
    }

    if (arg === "--cache") {
      cacheEnabled = true;
      continue;
    }

    if (arg === "--no-cache") {
      cacheEnabled = false;
      continue;
    }

    if (arg === "--sequence") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --sequence");
      sequence = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--sequence=")) {
      sequence = arg.slice("--sequence=".length);
      continue;
    }

    if (arg === "--executable-path") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --executable-path");
      executablePath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--executable-path=")) {
      executablePath = arg.slice("--executable-path=".length);
      continue;
    }
  }

  if (!sequence && urls.length === 0) {
    throw new Error("Provide at least one --url argument");
  }

  const normalizedMode = mode.toLowerCase();
  if (!["screenshot", "video"].includes(normalizedMode)) {
    throw new Error(`Unsupported --mode value: ${mode}`);
  }

  const normalizedDevice = device.toLowerCase();
  if (!["desktop", "mobile"].includes(normalizedDevice)) {
    throw new Error(`Unsupported --device value: ${device}`);
  }

  return {
    urls,
    sequence,
    mode: normalizedMode,
    preset,
    baseUrl,
    viewport: buildViewport(size, normalizedDevice, preset),
    device: normalizedDevice,
    cacheEnabled,
    executablePath,
  };
}

function getSequence(sequenceName) {
  const sequence = captureSequences[sequenceName];
  if (!sequence) {
    throw new Error(`Unknown sequence: ${sequenceName}`);
  }
  return sequence;
}

function parseSize(value) {
  const match = /^(\d+)x(\d+)$/i.exec(value);
  if (!match) {
    throw new Error(`Invalid --size value: ${value}. Expected WIDTHxHEIGHT`);
  }

  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
  };
}

function getPresetConfig(preset) {
  if (!preset) return null;

  const knownDevice = KnownDevices[preset];
  if (!knownDevice) {
    throw new Error(`Unknown preset: ${preset}`);
  }

  return knownDevice;
}

function buildViewport(size, device, preset) {
  const parsedSize = parseSize(size);
  const presetConfig = getPresetConfig(preset);

  if (presetConfig) {
    return {
      ...presetConfig.viewport,
      width: parsedSize.width,
      height: parsedSize.height,
    };
  }

  return {
    ...parsedSize,
    deviceScaleFactor: 1,
    isMobile: device === "mobile",
    hasTouch: device === "mobile",
  };
}

async function configurePage(page, viewport, preset) {
  const presetConfig = getPresetConfig(preset);

  if (presetConfig) {
    await page.setUserAgent(presetConfig.userAgent);
  }

  await page.setViewport(viewport);
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveExecutablePath(executablePath) {
  if (!executablePath) return undefined;

  if (!(await pathExists(executablePath))) {
    throw new Error(`Executable path does not exist: ${executablePath}`);
  }

  return executablePath;
}

function buildBaseName(url, index, includeIndex) {
  const { host, pathname, search } = new URL(url);
  const pathPart = pathname === "/" ? "index" : pathname.replace(/^\//, "");
  const queryPart = search ? `__${search.slice(1)}` : "";
  const prefix = includeIndex ? `${String(index + 1).padStart(2, "0")}__` : "";

  return `${prefix}${host}__${pathPart}${queryPart}`
    .replace(/\//g, "__")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

function slugifyName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

function captureVariantLabel(device, preset) {
  if (preset) return slugifyName(preset);
  return device;
}

function screenshotFileName(url, index, device, preset) {
  return `${buildBaseName(url, index, true)}__${captureVariantLabel(device, preset)}.png`;
}

function videoFileName(url, device, preset) {
  return `${buildBaseName(url, 0, false)}__${captureVariantLabel(device, preset)}.mp4`;
}

function temporaryVideoFileName(url, device, preset) {
  return `${buildBaseName(url, 0, false)}__${captureVariantLabel(device, preset)}.webm`;
}

function isMapRoute(url) {
  const { pathname } = new URL(url);
  return pathname === "/explore" || pathname.includes("/play");
}

function resolveCaptureUrl(url, baseUrl) {
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url)) {
    return url;
  }

  if (!baseUrl) {
    throw new Error(`Relative URL requires --base-url: ${url}`);
  }

  return new URL(url, baseUrl).toString();
}

function resolveCaptureUrls(urls, baseUrl) {
  return urls.map((url) => resolveCaptureUrl(url, baseUrl));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMaplibreLoaded(page, mapGlobalName, readySelector, delay = 2000) {
  await page.waitForSelector(readySelector, { timeout: 20000 });
  await page.waitForFunction(
    (globalName) => {
      const map = window[globalName];
      return Boolean(
        map &&
          typeof map.loaded === "function" &&
          typeof map.areTilesLoaded === "function" &&
          map.loaded() &&
          map.areTilesLoaded(),
      );
    },
    { timeout: 30000 },
    mapGlobalName,
  );
  await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 20000 });
  await sleep(delay);
}

function interpolateCoordinates(from, to, steps) {
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    return [
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
    ];
  });
}

async function waitForPageToSettle(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });

  try {
    await page.waitForFunction(
      () => !document.querySelector('[role="progressbar"]'),
      { timeout: 15000 },
    );
  } catch {
    // Some pages keep a progressbar mounted longer than needed; continue with route-specific checks.
  }

  if (new URL(url).pathname.includes("/play")) {
    await page.waitForFunction(
      () => {
        const dialog = document.querySelector('[role="dialog"]');
        const mapContainer = document.querySelector('[data-map-ready="true"]');
        return Boolean(dialog || mapContainer);
      },
      { timeout: 20000 },
    );

    if (!(await page.$('[role="dialog"]'))) {
      await waitForMaplibreLoaded(
        page,
        "__navteeMap",
        '[data-map-ready="true"]',
        3000,
      );
    }
    return;
  }

  if (new URL(url).pathname === "/explore") {
    await waitForMaplibreLoaded(
      page,
      "__navteeExploreMap",
      '[data-explore-map-ready="true"]',
      3000,
    );
  }
}

async function waitForPlayPageReady(page, url) {
  await waitForPageToSettle(page, url);
  await page.waitForFunction(
    () => Boolean(window.__navteeMapAutomation?.userPath?.length && window.__navteeMap),
    { timeout: 10000 },
  );
}

async function installMockGeolocation(page) {
  await page.evaluateOnNewDocument(() => {
    let currentPosition = {
      latitude: 36.5776,
      longitude: -121.9475,
      accuracy: 10,
    };
    let watchId = 0;
    const watchers = new Map();

    const emit = () => {
      const payload = {
        coords: {
          latitude: currentPosition.latitude,
          longitude: currentPosition.longitude,
          accuracy: currentPosition.accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };

      for (const watcher of watchers.values()) {
        watcher.success(payload);
      }
    };

    window.__navteeSetMockPosition = (coords) => {
      currentPosition = { ...currentPosition, ...coords };
      emit();
    };

    const geolocation = {
      getCurrentPosition(success) {
        success({
          coords: {
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude,
            accuracy: currentPosition.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      },
      watchPosition(success, error) {
        watchId += 1;
        watchers.set(watchId, { success, error });
        success({
          coords: {
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude,
            accuracy: currentPosition.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
        return watchId;
      },
      clearWatch(id) {
        watchers.delete(id);
      },
    };

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: geolocation,
    });
  });
}

async function clickTestId(page, testId) {
  await page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 10000 });
  await page.click(`[data-testid="${testId}"]`);
}

async function setMockPosition(page, latitude, longitude, accuracy = 8) {
  await page.evaluate(
    ({ latitude: lat, longitude: lng, accuracy: acc }) => {
      window.__navteeSetMockPosition({ latitude: lat, longitude: lng, accuracy: acc });
    },
    { latitude, longitude, accuracy },
  );
}

async function getAutomationTargets(page) {
  const targets = await page.evaluate(() => {
    const automation = window.__navteeMapAutomation;
    if (!automation?.userPath?.length) return null;

    const map = window.__navteeMap;
    if (!map) return null;

    const project = ([lng, lat]) => {
      const point = map.project([lng, lat]);
      return { x: point.x, y: point.y };
    };

    return {
      userPath: automation.userPath.map((coords) => ({
        coords,
        point: project(coords),
      })),
      bunkerTarget: {
        coords: automation.bunkerTarget,
        point: project(automation.bunkerTarget),
      },
    };
  });

  if (!targets) {
    throw new Error("Could not read automation targets from play page");
  }

  return targets;
}

async function resizeMapForCapture(page, mapGlobalName) {
  await page.evaluate((globalName) => {
    window.dispatchEvent(new Event("resize"));
    const map = window[globalName];
    if (map && typeof map.resize === "function") {
      map.resize();
    }
  }, mapGlobalName);

  await sleep(500);
}

async function convertWebmToMp4(sourcePath, targetPath) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    targetPath,
  ]);
}

async function moveMouseSmooth(page, from, to, steps = 30) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.move(to.x, to.y, { steps });
}

async function dragMap(page, from, to, steps = 35) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

async function clickMapAt(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
}

async function waitForDialogToClose(page, testId) {
  await page.waitForFunction(
    (value) => !document.querySelector(`[data-testid="${value}"]`),
    { timeout: 10000 },
    testId,
  );
}

async function panMapToKeepTargetsVisible(page, fromPoint, toPoint) {
  const viewport = page.viewport();
  if (!viewport) return;

  const marginX = viewport.width * 0.12;
  const marginY = viewport.height * 0.18;
  const points = [fromPoint, toPoint];
  const outOfBounds = points.some(
    (point) =>
      point.x < marginX ||
      point.x > viewport.width - marginX ||
      point.y < marginY ||
      point.y > viewport.height - marginY,
  );

  if (!outOfBounds) return;

  const center = {
    x: (fromPoint.x + toPoint.x) / 2,
    y: (fromPoint.y + toPoint.y) / 2,
  };
  const targetCenter = {
    x: viewport.width * 0.58,
    y: viewport.height * 0.46,
  };

  await dragMap(page, targetCenter, center, 40);
  await sleep(1200);
}

async function panMapPointToPosition(page, fromPoint, toPoint) {
  await dragMap(page, fromPoint, toPoint, 36);
  await sleep(1200);
}

async function runPlayVideoInteraction(page) {
  await sleep(600);

  let targets = await getAutomationTargets(page);

  await clickTestId(page, "gps-toggle");
  await sleep(1200);

  for (let index = 0; index < targets.userPath.length; index += 1) {
    const current = targets.userPath[index].coords;
    const previous =
      index === 0 ? current : targets.userPath[index - 1].coords;
    const frames = interpolateCoordinates(previous, current, index === 0 ? 1 : 6);

    for (const [lng, lat] of frames) {
      await setMockPosition(page, lat, lng, 4.5);
      await sleep(180);
    }
  }

  await sleep(600);

  await clickTestId(page, "yardage-toggle");
  await sleep(1400);

  const shell = await page.$('[data-testid="play-map-shell"]');
  const box = await shell.boundingBox();
  if (!box) throw new Error("Could not determine map bounds");

  const start = { x: box.x + box.width * 0.55, y: box.y + box.height * 0.42 };
  const end = { x: box.x + box.width * 0.35, y: box.y + box.height * 0.58 };

  await clickTestId(page, "measure-toggle");
  await sleep(600);

  targets = await getAutomationTargets(page);
  await panMapToKeepTargetsVisible(
    page,
    targets.userPath[targets.userPath.length - 1].point,
    targets.bunkerTarget.point,
  );
  targets = await getAutomationTargets(page);

  const userPoint = {
    x: box.x + targets.userPath[targets.userPath.length - 1].point.x,
    y: box.y + targets.userPath[targets.userPath.length - 1].point.y,
  };
  const bunkerPoint = {
    x: box.x + targets.bunkerTarget.point.x,
    y: box.y + targets.bunkerTarget.point.y,
  };

  await moveMouseSmooth(page, start, userPoint, 24);
  await sleep(400);
  await clickMapAt(page, userPoint.x, userPoint.y);
  await sleep(500);
  await moveMouseSmooth(page, userPoint, bunkerPoint, 24);
  await sleep(400);
  await clickMapAt(page, bunkerPoint.x, bunkerPoint.y);
  await sleep(1600);

  await clickTestId(page, "measure-toggle");
  await sleep(700);

  await clickTestId(page, "score-button");
  await page.waitForSelector('[data-testid="score-dialog"]', { timeout: 10000 });
  await sleep(500);
  await clickTestId(page, "quick-score-4");
  await waitForDialogToClose(page, "score-dialog");
  await sleep(1200);

  await clickTestId(page, "next-hole");
  await sleep(1000);

  await clickTestId(page, "score-button");
  await page.waitForSelector('[data-testid="score-dialog"]', { timeout: 10000 });
  await sleep(500);
  await clickTestId(page, "quick-score-5");
  await waitForDialogToClose(page, "score-dialog");
  await sleep(1200);

  await clickTestId(page, "scorecard-toggle");
  await page.waitForSelector('[data-testid="scorecard-dialog"]', { timeout: 10000 });
  await sleep(1800);
  await clickTestId(page, "scorecard-close");
  await waitForDialogToClose(page, "scorecard-dialog");
  await sleep(800);

  await clickTestId(page, "yardage-toggle");
  await sleep(1000);
}

async function captureScreenshot(
  browser,
  viewport,
  urls,
  device,
  preset,
  baseUrl,
  cacheEnabled,
) {
  const page = await browser.newPage();
  const resolvedUrls = resolveCaptureUrls(urls, baseUrl);

  try {
    await configurePage(page, viewport, preset);
    await page.emulateMediaType("screen");
    await page.setCacheEnabled(cacheEnabled);
    await page.setGeolocation({ latitude: 37.7749, longitude: -122.4194, accuracy: 25 });

    for (const [index, url] of resolvedUrls.entries()) {
      await page.browserContext().overridePermissions(new URL(url).origin, [
        "geolocation",
      ]);
      await waitForPageToSettle(page, url);

      if (new URL(url).pathname === "/explore") {
        await resizeMapForCapture(page, "__navteeExploreMap");
      } else if (new URL(url).pathname.includes("/play")) {
        await resizeMapForCapture(page, "__navteeMap");
      }

      const targetPath = join(
        outputDir,
        screenshotFileName(page.url(), index, device, preset),
      );

      await page.screenshot({ path: targetPath, fullPage: !isMapRoute(url) });
      console.log(`Saved ${basename(targetPath)} for ${url}`);
    }
  } finally {
    await page.close();
  }
}

async function captureVideo(
  browser,
  viewport,
  url,
  device,
  preset,
  baseUrl,
  cacheEnabled,
) {
  const page = await browser.newPage();
  const resolvedUrl = resolveCaptureUrl(url, baseUrl);

  try {
    await installMockGeolocation(page);
    await configurePage(page, viewport, preset);
    await page.emulateMediaType("screen");
    await page.setCacheEnabled(cacheEnabled);
    await page.browserContext().overridePermissions(new URL(resolvedUrl).origin, [
      "geolocation",
    ]);

    await waitForPlayPageReady(page, resolvedUrl);

    const temporaryPath = join(
      outputDir,
      temporaryVideoFileName(page.url(), device, preset),
    );
    const targetPath = join(outputDir, videoFileName(page.url(), device, preset));
    const recorder = await page.screencast({ path: temporaryPath });

    try {
      await runPlayVideoInteraction(page);
    } finally {
      await recorder.stop();
    }

    await convertWebmToMp4(temporaryPath, targetPath);
    await execFileAsync("rm", ["-f", temporaryPath]);

    console.log(`Saved ${basename(targetPath)} for ${url}`);
  } finally {
    await page.close();
  }
}

async function runCaptureEntry(
  browser,
  viewport,
  defaultDevice,
  defaultPreset,
  defaultBaseUrl,
  defaultCacheEnabled,
  entry,
) {
  const entryDevice = entry.device ?? defaultDevice;
  const entryPreset = entry.preset ?? defaultPreset;
  const entryViewport =
    entry.size || entry.device || entry.preset
      ? buildViewport(
        entry.size ?? `${viewport.width}x${viewport.height}`,
          entryDevice,
          entryPreset,
        )
      : viewport;

  if (entry.mode === "video") {
    if (entry.urls.length !== 1) {
      throw new Error("Video sequence entries must contain exactly one url");
    }

    await captureVideo(
      browser,
      entryViewport,
      entry.urls[0],
      entryDevice,
      entryPreset,
      defaultBaseUrl,
      defaultCacheEnabled,
    );
    return;
  }

  await captureScreenshot(
    browser,
    entryViewport,
    entry.urls,
    entryDevice,
    entryPreset,
    defaultBaseUrl,
    defaultCacheEnabled,
  );
}

const {
  urls,
  sequence,
  mode,
  viewport,
  device,
  preset,
  baseUrl,
  cacheEnabled,
  executablePath,
} = parseArgs(process.argv.slice(2));
const resolvedExecutablePath = await resolveExecutablePath(executablePath);
const browser = await puppeteer.launch({
  headless: true,
  executablePath: resolvedExecutablePath,
  defaultViewport: viewport,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});

try {
  await mkdir(outputDir, { recursive: true });

  if (sequence) {
    for (const entry of getSequence(sequence)) {
      await runCaptureEntry(
        browser,
        viewport,
        device,
        preset,
        baseUrl,
        cacheEnabled,
        entry,
      );
    }
  } else {
    if (mode === "video") {
      if (urls.length !== 1) {
        throw new Error("Video mode supports exactly one --url");
      }

      await captureVideo(
        browser,
        viewport,
        urls[0],
        device,
        preset,
        baseUrl,
        cacheEnabled,
      );
    } else {
      await captureScreenshot(
        browser,
        viewport,
        urls,
        device,
        preset,
        baseUrl,
        cacheEnabled,
      );
    }
  }
} finally {
  await browser.close();
}

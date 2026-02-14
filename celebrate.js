const canvas = document.getElementById("hearts");
const catVideoLeft = document.getElementById("catVideoLeft");
const catVideoRight = document.getElementById("catVideoRight");
const catCanvasLeft = document.getElementById("catCanvasLeft");
const catCanvasRight = document.getElementById("catCanvasRight");

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function resizeCanvas() {
  if (!canvas) return;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeCatCanvas(catCanvas) {
  if (!catCanvas) return;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const rect = catCanvas.getBoundingClientRect();
  catCanvas.width = Math.floor(rect.width * dpr);
  catCanvas.height = Math.floor(rect.height * dpr);
  const ctx = catCanvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawHeart(ctx, x, y, size, rotation, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.moveTo(0, -0.32);
  ctx.bezierCurveTo(0.5, -0.95, 1.4, -0.12, 0, 1.1);
  ctx.bezierCurveTo(-1.4, -0.12, -0.5, -0.95, 0, -0.32);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

let raf = 0;
let hearts = [];
let last = 0;

function spawnHeart(width, height, x = Math.random() * width, y = -30) {
  const colors = ["#ff5d9d", "#ff86b7", "#ffd36c", "#ffb5d1", "#ffd6e7"];
  const size = 5 + Math.random() * 10;
  const drift = -0.7 + Math.random() * 1.4;
  return {
    x,
    y,
    size,
    vy: 0.9 + Math.random() * 2.6,
    vx: drift,
    rot: Math.random() * Math.PI,
    vrot: (-0.03 + Math.random() * 0.06) * 1.2,
    alpha: 0.55 + Math.random() * 0.45,
    color: colors[(Math.random() * colors.length) | 0],
    wobble: Math.random() * 6,
  };
}

function burst(x, y) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const count = 80;
  for (let i = 0; i < count; i += 1) {
    const h = spawnHeart(width, height, x, y);
    const ang = Math.random() * Math.PI * 2;
    const spd = 0.8 + Math.random() * 3.8;
    h.vx = Math.cos(ang) * spd;
    h.vy = Math.sin(ang) * spd + 0.8;
    h.alpha = 0.75 + Math.random() * 0.25;
    hearts.push(h);
  }
}

function tick(t) {
  const ctx = canvas?.getContext("2d");
  if (!ctx || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  const dt = clamp((t - last) / 16.67, 0.5, 2.2);
  last = t;

  // Spawn a LOT of hearts continuously.
  const targetCount = Math.floor(clamp(width / 2.6, 220, 520));
  while (hearts.length < targetCount) hearts.push(spawnHeart(width, height));

  ctx.clearRect(0, 0, width, height);

  for (const h of hearts) {
    h.x += (h.vx + Math.sin((h.y + t * 0.001) * 0.015) * 0.6) * dt;
    h.y += h.vy * dt;
    h.rot += h.vrot * dt;

    drawHeart(ctx, h.x, h.y, h.size, h.rot, h.color, h.alpha);

    if (h.y > height + 50 || h.x < -80 || h.x > width + 80) {
      // recycle
      h.x = Math.random() * width;
      h.y = -40 - Math.random() * 160;
      h.vy = 0.9 + Math.random() * 2.6;
      h.vx = -0.7 + Math.random() * 1.4;
      h.alpha = 0.55 + Math.random() * 0.45;
      h.size = 5 + Math.random() * 10;
      h.color = ["#ff5d9d", "#ff86b7", "#ffd36c", "#ffb5d1", "#ffd6e7"][
        (Math.random() * 5) | 0
      ];
    }
  }

  raf = requestAnimationFrame(tick);
}

function start() {
  if (!canvas || prefersReducedMotion()) return;
  resizeCanvas();
  hearts = [];
  last = performance.now();
  raf = requestAnimationFrame(tick);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  resizeCatCanvas(catCanvasLeft);
  resizeCatCanvas(catCanvasRight);
});
window.addEventListener("pointerdown", (e) => burst(e.clientX, e.clientY));

start();

// ---- green screen "vyparovac" for cat videos ----

function applyChromaKey(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const maxRB = r > b ? r : b;
    const dominance = g - maxRB;

    if (g > 70 && dominance > 55) {
      data[i + 3] = 0;
      continue;
    }

    if (g > 60 && dominance > 35) {
      const a = clamp(1 - (dominance - 35) / 30, 0, 1);
      data[i + 3] = Math.floor(data[i + 3] * a);
    }

    if (g > 80 && dominance > 15) {
      data[i + 1] = Math.floor(maxRB + (g - maxRB) * 0.6);
    }

    const alpha = data[i + 3];
    if (alpha > 0 && alpha < 70) {
      const avg = (r + g + b) / 3;
      if (avg < 22 || alpha < 18) data[i + 3] = 0;
    }
  }
}

function setupGreenScreen(catVideo, catCanvas) {
  if (!catVideo || !catCanvas) return { start: () => {}, stop: () => {} };

  let vfcHandle = 0;
  let rafHandle = 0;
  let sourceCanvas = null;
  let sourceCtx = null;

  const ensureBuffer = (outW, outH) => {
    const scale = 0.5;
    const w = Math.max(240, Math.floor(outW * scale));
    const h = Math.max(240, Math.floor(outH * scale));
    if (sourceCanvas && sourceCanvas.width === w && sourceCanvas.height === h) return;
    sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = w;
    sourceCanvas.height = h;
    sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  };

  const render = () => {
    const outCtx = catCanvas.getContext("2d");
    if (!outCtx) return;

    const rect = catCanvas.getBoundingClientRect();
    const outW = rect.width;
    const outH = rect.height;
    ensureBuffer(outW, outH);

    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    sourceCtx.clearRect(0, 0, w, h);

    try {
      sourceCtx.drawImage(catVideo, 0, 0, w, h);
    } catch {
      return;
    }

    let frame;
    try {
      frame = sourceCtx.getImageData(0, 0, w, h);
    } catch {
      return;
    }

    applyChromaKey(frame);
    sourceCtx.putImageData(frame, 0, 0);

    outCtx.clearRect(0, 0, outW, outH);
    outCtx.drawImage(sourceCanvas, 0, 0, outW, outH);
  };

  const stop = () => {
    if (rafHandle) cancelAnimationFrame(rafHandle);
    rafHandle = 0;
    if (catVideo.cancelVideoFrameCallback && vfcHandle) {
      try {
        catVideo.cancelVideoFrameCallback(vfcHandle);
      } catch {
        // ignore
      }
    }
    vfcHandle = 0;
  };

  const start = () => {
    if (prefersReducedMotion()) return;
    stop();
    resizeCatCanvas(catCanvas);

    if (catVideo.requestVideoFrameCallback) {
      const onFrame = () => {
        render();
        vfcHandle = catVideo.requestVideoFrameCallback(onFrame);
      };
      vfcHandle = catVideo.requestVideoFrameCallback(onFrame);
      return;
    }

    const tickKey = () => {
      render();
      rafHandle = requestAnimationFrame(tickKey);
    };
    rafHandle = requestAnimationFrame(tickKey);
  };

  return { start, stop };
}

function tryAutoPlayMuted(video) {
  if (!video) return;
  video.muted = true;
  video.volume = 0;
  try {
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    // ignore
  }
}

async function tryEnableAudio(video) {
  if (!video) return false;
  try {
    video.muted = false;
    video.volume = 0.9;
    const p = video.play();
    if (p && typeof p.then === "function") await p;
    return true;
  } catch {
    return false;
  }
}

const keyLeft = setupGreenScreen(catVideoLeft, catCanvasLeft);
const keyRight = setupGreenScreen(catVideoRight, catCanvasRight);

function ensureVideoPlaysMuted(video) {
  if (!video) return;
  video.muted = true;
  video.volume = 0;
  try {
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    // ignore
  }
}

function startCats() {
  if (!catVideoLeft || !catVideoRight) return;

  // Start both videos muted (autoplay-friendly) so the chroma-key animation runs.
  ensureVideoPlaysMuted(catVideoLeft);
  ensureVideoPlaysMuted(catVideoRight);

  // Start keying once metadata is available (seeking not needed here).
  const startKeying = () => {
    keyLeft.start();
    keyRight.start();
  };

  if (catVideoLeft.readyState >= 1) startKeying();
  else catVideoLeft.addEventListener("loadedmetadata", startKeying, { once: true });

  catVideoLeft.muted = true;
  catVideoRight.muted = true;

  // Keep both videos running even after refresh / bfcache / tab switching.
  const ensureBoth = () => {
    ensureVideoPlaysMuted(catVideoLeft);
    ensureVideoPlaysMuted(catVideoRight);
  };

  window.addEventListener("pageshow", ensureBoth);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) ensureBoth();
  });

  // Use the LEFT video's audio as background "hudba" (only one sound),
  // but only enable it on the first user gesture (browser autoplay policies).
  window.addEventListener(
    "pointerdown",
    async () => {
      // Ensure visuals keep playing, then enable audio on the left only.
      ensureBoth();
      await tryEnableAudio(catVideoLeft);
      catVideoRight.muted = true;
      catVideoRight.volume = 0;
    },
    { once: true },
  );
}

startCats();

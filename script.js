const yesBtn = document.getElementById("yesBtn");
const noBtn = document.getElementById("noBtn");
const noWrap = document.getElementById("noWrap");
const hint = document.getElementById("hint");
const card = document.querySelector(".card");

const result = document.getElementById("result");
const confettiCanvas = document.getElementById("confetti");
const timestamp = document.getElementById("timestamp");
const copyBtn = document.getElementById("copyBtn");
const againBtn = document.getElementById("againBtn");

const boomOverlay = document.getElementById("boomOverlay");
const boomSpot = document.getElementById("boomSpot");
const boomCanvas = document.getElementById("boomCanvas");
const boomPng = document.getElementById("boomPng");
const boomVideo = document.getElementById("boomVideo");
const boomKeyCanvas = document.getElementById("boomKeyCanvas");

let noLocked = false;
let boomCooldown = false;

const BOOM_VIDEO_START_SECONDS = 0.34;
const BOOM_SPOT_X_OFFSET_PX = 0;
const BOOM_SPOT_Y_OFFSET_PX = 0;
const BOOM_SPOT_SIZE_MULTIPLIER = 3.4;
const BOOM_SPOT_MIN_SIZE_PX = 160;
const BOOM_SPOT_MAX_SIZE_PX = 280;
const BOOM_VIDEO_SCALE = 1.18;
const BOOM_VIDEO_PAN_X = 0; // -1..1-ish (relative to spot size)
const BOOM_VIDEO_PAN_Y = -0.36; // negative = move video up

const NO_DODGE_DISTANCE_PX = 22;
const NO_DODGE_COOLDOWN_MS = 260;
const NO_DODGE_DIRECTIONS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function setHint(text) {
  if (!hint) return;
  hint.textContent = text ?? "";
}

function moveNoButton() {
  if (!noBtn || !noWrap || noLocked) return;

  const wrapRect = noWrap.getBoundingClientRect();
  const btnRect = noBtn.getBoundingClientRect();

  // Switch to absolute positioning for dodging.
  if (getComputedStyle(noBtn).position !== "absolute") {
    noBtn.style.position = "absolute";
    const left = Math.max(0, (wrapRect.width - btnRect.width) / 2);
    const top = Math.max(0, (wrapRect.height - btnRect.height) / 2);
    noBtn.style.left = `${left}px`;
    noBtn.style.top = `${top}px`;
    noBtn.style.width = `${btnRect.width}px`;
    noBtn.style.transition = "left 420ms ease, top 420ms ease, opacity 220ms ease, filter 220ms ease";
  }
}

let noDodgeCooldown = 0;
let noDodgeIndex = 0;

function dodgeNoButton(e) {
  if (!noBtn || !noWrap || noLocked) return;
  if (e?.pointerType && e.pointerType !== "mouse") return;

  const now = performance.now();
  if (now < noDodgeCooldown) return;
  noDodgeCooldown = now + NO_DODGE_COOLDOWN_MS;

  moveNoButton();

  const wrapRect = noWrap.getBoundingClientRect();
  const btnRect = noBtn.getBoundingClientRect();

  const maxX = Math.max(0, wrapRect.width - btnRect.width);
  const maxY = Math.max(0, wrapRect.height - btnRect.height);

  const currentLeft = Number.parseFloat(noBtn.style.left || "0") || 0;
  const currentTop = Number.parseFloat(noBtn.style.top || "0") || 0;

  let nextLeft = currentLeft;
  let nextTop = currentTop;
  // Try a few directions in case we're pinned to an edge.
  for (let i = 0; i < NO_DODGE_DIRECTIONS.length; i += 1) {
    const [dx0, dy0] = NO_DODGE_DIRECTIONS[noDodgeIndex % NO_DODGE_DIRECTIONS.length];
    noDodgeIndex += 1;
    const dx = dx0 / Math.hypot(dx0, dy0);
    const dy = dy0 / Math.hypot(dx0, dy0);

    const candidateLeft = clamp(currentLeft + dx * NO_DODGE_DISTANCE_PX, 0, maxX);
    const candidateTop = clamp(currentTop + dy * NO_DODGE_DISTANCE_PX, 0, maxY);
    if (candidateLeft !== currentLeft || candidateTop !== currentTop) {
      nextLeft = candidateLeft;
      nextTop = candidateTop;
      break;
    }
  }

  noBtn.style.left = `${nextLeft}px`;
  noBtn.style.top = `${nextTop}px`;
}

function bindNoEscape() {
  if (!noBtn) return;

  noBtn.addEventListener("pointerenter", dodgeNoButton);
  noBtn.addEventListener("pointermove", dodgeNoButton);

  noBtn.addEventListener("click", (e) => {
    e.preventDefault();
    triggerBoom(e);
  });
}

function resizeBoomCanvas() {
  if (!boomCanvas) return;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const rect = boomCanvas.getBoundingClientRect();
  boomCanvas.width = Math.floor(rect.width * dpr);
  boomCanvas.height = Math.floor(rect.height * dpr);
  const ctx = boomCanvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeBoomKeyCanvas() {
  if (!boomKeyCanvas) return;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const rect = boomKeyCanvas.getBoundingClientRect();
  boomKeyCanvas.width = Math.floor(rect.width * dpr);
  boomKeyCanvas.height = Math.floor(rect.height * dpr);
  const ctx = boomKeyCanvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function positionBoomSpot(event) {
  if (!boomOverlay) return;

  const vw = Math.max(320, window.innerWidth || 320);
  const vh = Math.max(320, window.innerHeight || 320);

  let x = event?.clientX ?? vw * 0.5;
  let y = event?.clientY ?? vh * 0.58;

  // Prefer the "Ne" button center so the explosion targets the button.
  const rect = noBtn?.getBoundingClientRect?.();
  if (rect) {
    x = rect.left + rect.width / 2 + BOOM_SPOT_X_OFFSET_PX;
    y = rect.top + rect.height / 2 + BOOM_SPOT_Y_OFFSET_PX;
  }

  const base = rect ? Math.max(rect.width, rect.height) : 64;
  const size = clamp(
    base * BOOM_SPOT_SIZE_MULTIPLIER,
    BOOM_SPOT_MIN_SIZE_PX,
    Math.min(BOOM_SPOT_MAX_SIZE_PX, Math.min(vw, vh) * 0.75),
  );

  // Keep it on-screen only when we don't have a precise target rect.
  if (!rect) {
    const half = size / 2;
    x = clamp(x, half + 8, vw - half - 8);
    y = clamp(y, half + 8, vh - half - 8);
  }

  boomOverlay.style.setProperty("--boom-x", `${x}px`);
  boomOverlay.style.setProperty("--boom-y", `${y}px`);
  boomOverlay.style.setProperty("--boom-size", `${size}px`);
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function playBoomSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    osc.connect(gain);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.connect(gain);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.36);
    noise.stop(now + 0.36);

    setTimeout(() => ctx.close?.(), 800);
  } catch {
    // ignore audio failures (autoplay restrictions, etc.)
  }
}

function triggerBoom(event) {
  if (boomCooldown || !boomOverlay || !boomCanvas) return;
  boomCooldown = true;

  positionBoomSpot(event);
  boomOverlay.hidden = false;
  resizeBoomCanvas();

  // Start evaporating soon after click (not only at the end).
  window.setTimeout(evaporateNoButton, 220);
  playBoom(event);
}

let boomHideTimer = 0;
let boomEndFallbackTimer = 0;
let boomKeyRaf = 0;
let boomKeyVfcHandle = 0;
let boomKeySourceCanvas = null;
let boomKeySourceCtx = null;

function showBoomOverlay() {
  boomOverlay.hidden = false;
  resizeBoomCanvas();
  resizeBoomKeyCanvas();
}

function clearBoomEndFallback() {
  if (boomEndFallbackTimer) window.clearTimeout(boomEndFallbackTimer);
  boomEndFallbackTimer = 0;
}

function armBoomEndFallback(finish) {
  if (!boomVideo) return;
  clearBoomEndFallback();

  const schedule = () => {
    const duration = boomVideo.duration;
    const currentTime = boomVideo.currentTime;
    if (!Number.isFinite(duration) || duration <= 0) {
      boomEndFallbackTimer = window.setTimeout(finish, 2600);
      return;
    }

    const remainingMs = Math.max(0, (duration - currentTime) * 1000);
    boomEndFallbackTimer = window.setTimeout(finish, remainingMs + 120);
  };

  // If metadata is ready we can schedule precisely, otherwise wait a moment.
  if (boomVideo.readyState >= 1) {
    schedule();
    return;
  }

  boomVideo.addEventListener("loadedmetadata", schedule, { once: true });
  // Safety fallback in case metadata never arrives.
  boomEndFallbackTimer = window.setTimeout(finish, 3000);
}

function hideBoomOverlay() {
  if (boomHideTimer) window.clearTimeout(boomHideTimer);
  boomHideTimer = 0;
  clearBoomEndFallback();

  stopBoomParticles();
  stopChromaKey();
  if (boomPng) boomPng.hidden = true;
  if (boomVideo) {
    try {
      boomVideo.pause();
      boomVideo.currentTime = 0;
      boomVideo.classList.remove("boom-video--hidden");
    } catch {
      // ignore
    }
  }

  boomOverlay.hidden = true;
  boomCooldown = false;
}

async function tryPlayBoomVideo() {
  if (!boomVideo) return false;
  const startAt = Math.max(0, Number(BOOM_VIDEO_START_SECONDS) || 0);

  const startPlayback = async () => {
    try {
      if (startAt > 0) boomVideo.currentTime = startAt;
    } catch {
      // ignore seek failures
    }

    try {
      const p = boomVideo.play();
      if (p && typeof p.then === "function") await p;
      return true;
    } catch {
      return false;
    }
  };

  if (boomVideo.readyState >= 1) return await startPlayback();

  // Wait for metadata so we can seek reliably.
  return await new Promise((resolve) => {
    const onMeta = async () => {
      boomVideo.removeEventListener("loadedmetadata", onMeta);
      resolve(await startPlayback());
    };
    boomVideo.addEventListener("loadedmetadata", onMeta, { once: true });
    try {
      boomVideo.load();
    } catch {
      // ignore
    }
    // Safety timeout: if metadata never arrives, fallback to plain play.
    window.setTimeout(async () => resolve(await startPlayback()), 350);
  });
}

async function playBoom(event) {
  showBoomOverlay();

  // Always ensure we don't get stuck if video never ends.
  boomHideTimer = window.setTimeout(hideBoomOverlay, 8000);

  let usedVideo = false;
  if (boomVideo) {
    // Hide the raw video immediately to avoid a green-screen flash before keying starts.
    boomVideo.classList.add("boom-video--hidden");
    const finish = () => {
      // Replace the end-frame with the PNG, then close the overlay.
      try {
        stopChromaKey();
        boomVideo.pause();
      } catch {
        // ignore
      }

      if (boomPng) boomPng.hidden = false;
      window.setTimeout(hideBoomOverlay, 10000);
    };

    boomVideo.onended = finish;
    usedVideo = await tryPlayBoomVideo();
    if (usedVideo) armBoomEndFallback(finish);
  }

  if (!usedVideo) {
    boomVideo?.classList.remove("boom-video--hidden");
    if (boomHideTimer) window.clearTimeout(boomHideTimer);
    boomHideTimer = window.setTimeout(() => {
      if (boomPng) boomPng.hidden = false;
      window.setTimeout(hideBoomOverlay, 10000);
    }, 750);
    playBoomSound();
    startBoomParticles(event);
    clearBoomKeyCanvas();
    return;
  }

  const chromaOk = startChromaKey();
  if (chromaOk) {
    // Draw once ASAP so the spot isn't blank while waiting for the first callback.
    renderChromaKeyFrame();
  } else {
    // Fallback: just show the raw video (green included).
    boomVideo?.classList.remove("boom-video--hidden");
    clearBoomKeyCanvas();
  }
}

function evaporateNoButton() {
  if (!noBtn || !noWrap) return;
  if (noBtn.dataset.evaporated === "1") return;
  noBtn.dataset.evaporated = "1";

  noLocked = true;
  noBtn.disabled = true;
  noBtn.classList.add("evaporate");
  setHint('Wo ist die Option „Nein“ geblieben?');

  window.setTimeout(() => {
    if (noBtn.dataset.evaporated !== "1") return;
    noBtn.style.display = "none";
  }, 560);
}

function clearBoomKeyCanvas() {
  const ctx = boomKeyCanvas?.getContext("2d");
  if (!ctx || !boomKeyCanvas) return;
  const rect = boomKeyCanvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
}

function stopChromaKey() {
  if (boomKeyRaf) cancelAnimationFrame(boomKeyRaf);
  boomKeyRaf = 0;

  if (boomVideo?.cancelVideoFrameCallback && boomKeyVfcHandle) {
    try {
      boomVideo.cancelVideoFrameCallback(boomKeyVfcHandle);
    } catch {
      // ignore
    }
  }
  boomKeyVfcHandle = 0;
  clearBoomKeyCanvas();
}

function ensureKeyingBuffer(width, height) {
  const scale = 0.45;
  const w = Math.max(240, Math.floor(width * scale));
  const h = Math.max(240, Math.floor(height * scale));

  if (boomKeySourceCanvas && boomKeySourceCanvas.width === w && boomKeySourceCanvas.height === h) return;
  boomKeySourceCanvas = document.createElement("canvas");
  boomKeySourceCanvas.width = w;
  boomKeySourceCanvas.height = h;
  boomKeySourceCtx = boomKeySourceCanvas.getContext("2d", { willReadFrequently: true });
}

function applyChromaKey(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Basic "green dominance" key with soft edge.
    const maxRB = r > b ? r : b;
    const dominance = g - maxRB; // > 0 means greener than red/blue

    if (g > 70 && dominance > 55) {
      data[i + 3] = 0;
      continue;
    }

    if (g > 60 && dominance > 35) {
      // Soft edge: fade alpha instead of a hard cut.
      const a = clamp(1 - (dominance - 35) / 30, 0, 1);
      data[i + 3] = Math.floor(data[i + 3] * a);
    }

    // Optional spill suppression (very mild): reduce green a bit near edges.
    if (g > 80 && dominance > 15) {
      data[i + 1] = Math.floor(maxRB + (g - maxRB) * 0.6);
    }

    // Fringe cleanup: drop very low-alpha dark pixels (removes black halos).
    const alpha = data[i + 3];
    if (alpha > 0 && alpha < 70) {
      const avg = (r + g + b) / 3;
      if (avg < 22 || alpha < 18) data[i + 3] = 0;
    }
  }
}

function renderChromaKeyFrame() {
  if (!boomVideo || !boomKeyCanvas || !boomKeySourceCanvas || !boomKeySourceCtx) return;

  const outCtx = boomKeyCanvas.getContext("2d");
  if (!outCtx) return;

  const rect = boomKeyCanvas.getBoundingClientRect();
  const outW = rect.width;
  const outH = rect.height;
  ensureKeyingBuffer(outW, outH);

  const w = boomKeySourceCanvas.width;
  const h = boomKeySourceCanvas.height;

  // Draw video into a small buffer first (cheaper to key).
  boomKeySourceCtx.clearRect(0, 0, w, h);
  try {
    boomKeySourceCtx.drawImage(boomVideo, 0, 0, w, h);
  } catch {
    // Video not ready or blocked
    return;
  }

  let frame;
  try {
    frame = boomKeySourceCtx.getImageData(0, 0, w, h);
  } catch {
    // Tainted canvas (shouldn't happen for same-origin), or read blocked.
    return;
  }

  applyChromaKey(frame);
  boomKeySourceCtx.putImageData(frame, 0, 0);

  // Draw keyed buffer up to the spot size.
  outCtx.clearRect(0, 0, outW, outH);
  const drawW = outW * BOOM_VIDEO_SCALE;
  const drawH = outH * BOOM_VIDEO_SCALE;
  const dx = (outW - drawW) / 2 + BOOM_VIDEO_PAN_X * outW;
  const dy = (outH - drawH) / 2 + BOOM_VIDEO_PAN_Y * outH;
  outCtx.drawImage(boomKeySourceCanvas, dx, dy, drawW, drawH);
}

function startChromaKey() {
  if (!boomVideo || !boomKeyCanvas) return false;
  if (prefersReducedMotion()) return false;

  try {
    const rect = boomKeyCanvas.getBoundingClientRect();
    ensureKeyingBuffer(rect.width, rect.height);
  } catch {
    return false;
  }

  stopChromaKey();

  // Prefer requestVideoFrameCallback when available.
  if (boomVideo.requestVideoFrameCallback) {
    const onFrame = () => {
      renderChromaKeyFrame();
      boomKeyVfcHandle = boomVideo.requestVideoFrameCallback(onFrame);
    };
    boomKeyVfcHandle = boomVideo.requestVideoFrameCallback(onFrame);
    return true;
  }

  const tick = () => {
    renderChromaKeyFrame();
    boomKeyRaf = requestAnimationFrame(tick);
  };
  boomKeyRaf = requestAnimationFrame(tick);
  return true;
}

let boomRaf = 0;
let boomStart = 0;
let boomParticles = [];

function startBoomParticles(event) {
  const ctx = boomCanvas?.getContext("2d");
  if (!ctx || !boomCanvas) return;

  const rect = boomCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  let vx = event?.clientX ?? rect.left + width * 0.5;
  let vy = event?.clientY ?? rect.top + height * 0.58;

  const noRect = noBtn?.getBoundingClientRect?.();
  if (noRect) {
    vx = noRect.left + noRect.width / 2;
    vy = noRect.top + noRect.height / 2;
  }

  const ex = clamp(vx - rect.left, 0, width);
  const ey = clamp(vy - rect.top, 0, height);

  boomParticles = [];
  const count = Math.floor(clamp(width / 6, 120, 220));
  for (let i = 0; i < count; i += 1) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 3 + Math.random() * 8;
    boomParticles.push({
      x: ex,
      y: ey,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - (2 + Math.random() * 2),
      r: 2 + Math.random() * 5,
      life: 520 + Math.random() * 240,
      hue: 18 + Math.random() * 330,
    });
  }

  boomStart = performance.now();
  tickBoom();
}

function stopBoomParticles() {
  if (boomRaf) cancelAnimationFrame(boomRaf);
  boomRaf = 0;
  boomParticles = [];
  const ctx = boomCanvas?.getContext("2d");
  if (ctx && boomCanvas) {
    const rect = boomCanvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  }
}

function tickBoom() {
  const ctx = boomCanvas?.getContext("2d");
  if (!ctx || !boomCanvas) return;

  const rect = boomCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  const t = performance.now();
  const elapsed = t - boomStart;

  ctx.clearRect(0, 0, width, height);

  // Flash
  const flash = clamp(1 - elapsed / 220, 0, 1);
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.85;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  // Particles
  const gravity = 0.18;
  for (const p of boomParticles) {
    const age = elapsed;
    const a = clamp(1 - age / p.life, 0, 1);
    if (a <= 0) continue;

    p.vy += gravity;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;

    ctx.globalAlpha = a;
    ctx.fillStyle = `hsl(${p.hue} 95% 65%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (elapsed < 650) boomRaf = requestAnimationFrame(tickBoom);
}

function resizeConfettiCanvas() {
  if (!confettiCanvas) return;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const rect = confettiCanvas.getBoundingClientRect();
  confettiCanvas.width = Math.floor(rect.width * dpr);
  confettiCanvas.height = Math.floor(rect.height * dpr);
  const ctx = confettiCanvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function nowText() {
  try {
    const dt = new Date();
    return new Intl.DateTimeFormat("cs-CZ", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(dt);
  } catch {
    return new Date().toString();
  }
}

function showResult() {
  if (!result || !card) return;
  result.hidden = false;
  card.style.visibility = "hidden";
  timestamp.textContent = `Čas potvrzení: ${nowText()}`;
  startConfetti();
}

function hideResult() {
  if (!result || !card) return;
  stopConfetti();
  result.hidden = true;
  card.style.visibility = "visible";
}

let confettiRaf = 0;
let confettiPieces = [];
let confettiStart = 0;

function createConfettiPiece(width, height) {
  const colors = ["#ff2e73", "#ff7aa8", "#ffd166", "#8be9fd", "#c4b5fd"];
  return {
    x: Math.random() * width,
    y: -20 - Math.random() * height * 0.2,
    r: 3 + Math.random() * 5,
    w: 6 + Math.random() * 8,
    h: 8 + Math.random() * 10,
    vx: -0.8 + Math.random() * 1.6,
    vy: 2.0 + Math.random() * 3.6,
    rot: Math.random() * Math.PI,
    vrot: -0.15 + Math.random() * 0.3,
    color: colors[(Math.random() * colors.length) | 0],
    shape: Math.random() < 0.35 ? "heart" : "rect",
  };
}

function drawHeart(ctx, x, y, size, rotation, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(size, size);
  ctx.beginPath();
  // Simple heart path (unit-ish)
  ctx.moveTo(0, -0.35);
  ctx.bezierCurveTo(0.5, -0.9, 1.35, -0.1, 0, 1.05);
  ctx.bezierCurveTo(-1.35, -0.1, -0.5, -0.9, 0, -0.35);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function startConfetti() {
  if (!confettiCanvas) return;
  resizeConfettiCanvas();
  const rect = confettiCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  confettiPieces = [];
  const count = Math.floor(clamp(width / 9, 90, 180));
  for (let i = 0; i < count; i += 1) {
    confettiPieces.push(createConfettiPiece(width, height));
  }
  confettiStart = performance.now();
  tickConfetti();
}

function stopConfetti() {
  if (confettiRaf) cancelAnimationFrame(confettiRaf);
  confettiRaf = 0;
  confettiPieces = [];
  const ctx = confettiCanvas?.getContext("2d");
  if (ctx && confettiCanvas) ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

function tickConfetti() {
  const ctx = confettiCanvas?.getContext("2d");
  if (!ctx || !confettiCanvas) return;

  const rect = confettiCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  const t = performance.now();
  const elapsed = t - confettiStart;

  // After ~9s gradually reduce the amount
  const fade = clamp(1 - (elapsed - 9000) / 2500, 0, 1);

  for (const p of confettiPieces) {
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vrot;

    const sway = Math.sin((p.y + elapsed * 0.001) * 0.02) * 0.8;
    p.x += sway;

    if (p.shape === "heart") {
      drawHeart(ctx, p.x, p.y, p.r, p.rot, p.color);
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    // Wrap / respawn
    if (p.y > height + 40 || p.x < -60 || p.x > width + 60) {
      if (fade <= 0) {
        p.y = height + 9999; // park it
      } else {
        const np = createConfettiPiece(width, height);
        p.x = np.x;
        p.y = np.y;
        p.vx = np.vx;
        p.vy = np.vy;
        p.rot = np.rot;
        p.vrot = np.vrot;
        p.color = np.color;
        p.shape = np.shape;
        p.w = np.w;
        p.h = np.h;
        p.r = np.r;
      }
    }
  }

  if (fade > 0) {
    confettiRaf = requestAnimationFrame(tickConfetti);
  } else {
    // Final clear
    ctx.clearRect(0, 0, width, height);
  }
}

function confirmationMessage() {
  return `Ano! 💘\n\nPotvrzeno: jsem tvůj Valentýn.\n(${nowText()})`;
}

yesBtn?.addEventListener("click", () => {
  window.location.assign("celebrate.html");
});

copyBtn?.addEventListener("click", async () => {
  const text = confirmationMessage();
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Zkopírováno!";
    setTimeout(() => (copyBtn.textContent = "Zkopírovat zprávu"), 1200);
  } catch {
    // Fallback: prompt
    window.prompt("Zkopíruj si zprávu:", text);
  }
});

againBtn?.addEventListener("click", () => {
  hideResult();
  noLocked = false;
  if (noBtn) {
    noBtn.disabled = false;
    delete noBtn.dataset.evaporated;
    noBtn.classList.remove("evaporate");
    noBtn.style.display = "";
    noBtn.style.opacity = "";
    noBtn.style.cursor = "";
    noBtn.style.position = "";
    noBtn.style.left = "";
    noBtn.style.top = "";
    noBtn.style.width = "";
    noBtn.style.transition = "";
  }
  if (noWrap) {
    noWrap.style.opacity = "";
    noWrap.style.pointerEvents = "";
  }
  setHint("");
});

window.addEventListener("resize", () => {
  if (!result?.hidden) resizeConfettiCanvas();
  if (!boomOverlay?.hidden) {
    positionBoomSpot();
    resizeBoomCanvas();
    resizeBoomKeyCanvas();
  }
});

bindNoEscape();

// Warm up video metadata for faster/cleaner seeking.
try {
  boomVideo?.load?.();
} catch {
  // ignore
}

// Warm up PNG.
try {
  boomPng?.decode?.();
} catch {
  // ignore
}

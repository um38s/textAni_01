'use strict';

// ── DOM Elements ───────────────────────────────────────────────────────────
const canvas = document.getElementById('artCanvas');
const ctx = canvas.getContext('2d');
const input = document.getElementById('hiddenInput');
const typedTextEl = document.getElementById('typedText');
const container = document.querySelector('.frame-container');

let width, height;
let particles = [];
let cachedFragCount = 0;

const config = {
    fontFamily: '"Playfair Display", serif',
    baseFontSize: 60,
    baseGravity: 0.055,
    friction: 0.97,
    maxFragments: 630,      // 420 × 1.5
    fragChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
};

// ── Glyph Cache ────────────────────────────────────────────────────────────
const glyphCache = new Map();
const GLYPH_CACHE_LIMIT = 256;

function getGlyph(char, sizeFloat) {
    const size = Math.max(1, Math.round(sizeFloat));
    const key = char + '_' + size;
    if (glyphCache.has(key)) return glyphCache.get(key);

    // Evict oldest entries when cache is full
    if (glyphCache.size >= GLYPH_CACHE_LIMIT) {
        const firstKey = glyphCache.keys().next().value;
        glyphCache.delete(firstKey);
    }

    const pad = Math.ceil(size * 0.8);
    const dim = size * 2 + pad * 2;
    const gc = document.createElement('canvas');
    gc.width = dim;
    gc.height = dim;
    const gctx = gc.getContext('2d');
    gctx.font = `${size}px ${config.fontFamily}`;
    gctx.fillStyle = '#0a0a0a';
    gctx.textAlign = 'center';
    gctx.textBaseline = 'middle';
    gctx.fillText(char, dim / 2, dim / 2);
    glyphCache.set(key, gc);
    return gc;
}

function randomFragChar() {
    return config.fragChars[(Math.random() * 26) | 0];
}

// ── Resize ─────────────────────────────────────────────────────────────────
let resizeTimer;
function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
    config.baseFontSize = Math.max(28, height * 0.08);
    glyphCache.clear();
}
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
}, { passive: true });
resize();

// ── Particle ───────────────────────────────────────────────────────────────
class Particle {
    constructor(char, x, y, isFragment, charFontSize) {
        this.char = char;
        this.x = x;
        this.y = y;
        this.isFragment = isFragment;

        if (isFragment) {
            this.maxSize = charFontSize * 0.30;
            this.size = this.maxSize * (Math.random() * 0.10 + 0.05);
            this.vx = (Math.random() - 0.5) * 1.2;
            this.vy = -(Math.random() * 1.8 + 0.4);
            this.opacity = 0.95;
            this.fadeRate = 0.95 / (Math.random() * 60 + 100);
            this.rotationSpeed = (Math.random() - 0.5) * 0.008;
        } else {
            this.size = charFontSize;
            this.vx = 0;
            this.vy = 0;
            this.opacity = 1;
            this.gravityScale = Math.random() * 0.28 + 0.36;
            this.rotationSpeed = (Math.random() - 0.5) * 0.0164;
        }

        this.rotation = (Math.random() - 0.5) * 0.4;
        this.age = 0;
    }

    update() {
        this.age++;

        if (!this.isFragment) {
            this.vy += config.baseGravity * this.gravityScale;
            this.vx *= config.friction;

            // Trail spawn (budget-gated, 45% chance → 1.5x more trails)
            if (Math.random() > 0.55 && cachedFragCount < config.maxFragments) {
                const spread = this.size * 0.3;
                particles.push(new Particle(
                    randomFragChar(),
                    this.x + (Math.random() - 0.5) * spread,
                    this.y + (Math.random() - 0.5) * spread,
                    true, this.size
                ));
                cachedFragCount++;
            }

            this.rotation += this.rotationSpeed;
            if (this.y > height - 120) this.opacity -= 0.015;

        } else {
            this.vy *= 0.988;
            this.vx += Math.sin(this.age * 0.04 + this.x * 0.01) * 0.012;
            this.vx *= config.friction;

            if (this.size < this.maxSize) {
                this.size += (this.maxSize - this.size) * 0.05;
            }
            this.opacity -= this.fadeRate;
            this.rotation += this.rotationSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;
    }

    drawFragment() {
        if (this.opacity <= 0) return;
        const gc = getGlyph(this.char, this.size);
        const half = gc.width >> 1;
        ctx.save();
        ctx.globalAlpha = Math.min(0.95, this.opacity);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.drawImage(gc, -half, -half);
        ctx.restore();
    }

    drawMain() {
        if (this.opacity <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.font = `${Math.round(this.size)}px ${config.fontFamily}`;
        ctx.fillStyle = '#0a0a0a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.char, 0, 0);
        ctx.restore();
    }

    isDead() {
        return this.opacity <= 0 ||
            this.y > height + 250 ||
            this.y < -350 ||
            this.size < 0.5;
    }
}

// ── Typing Display ─────────────────────────────────────────────────────────
function addCharToDisplay(char) {
    const charSpan = document.createElement('span');
    charSpan.className = 'typed-char';
    charSpan.textContent = char;
    typedTextEl.appendChild(charSpan);

    setTimeout(() => {
        charSpan.classList.add('fading');
        setTimeout(() => {
            if (charSpan.parentNode) charSpan.parentNode.removeChild(charSpan);
        }, 1500);
    }, 1000);
}

function handleBackspace() {
    const chars = typedTextEl.querySelectorAll('.typed-char:not(.fading)');
    if (chars.length > 0) {
        const last = chars[chars.length - 1];
        last.classList.add('fading');
        setTimeout(() => {
            if (last.parentNode) last.parentNode.removeChild(last);
        }, 1500);
    }
}

// ── Input ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
    }

    if (e.key.length !== 1) return;
    e.preventDefault();

    addCharToDisplay(e.key);
    if (e.key !== ' ') spawnCharacter(e.key);
});

// Mobile fallback
container.addEventListener('click', () => input.focus());
container.addEventListener('touchstart', () => input.focus(), { passive: true });
input.addEventListener('input', (e) => {
    const val = e.target.value;
    for (const ch of val) {
        addCharToDisplay(ch);
        if (ch !== ' ') spawnCharacter(ch);
    }
    e.target.value = '';
});

// ── Spawn ──────────────────────────────────────────────────────────────────
function spawnCharacter(char) {
    if (char === ' ') return;

    const spawnX = width / 2 + (Math.random() - 0.5) * (width * 0.70);
    const spawnY = height * (Math.random() * 0.20 + 0.05);
    const charSize = config.baseFontSize * (Math.random() * 0.50 + 0.60);

    particles.push(new Particle(char, spawnX, spawnY, false, charSize));

    // 1.5x fragments: was 14–42, now 21–63
    const budget = Math.max(0, config.maxFragments - cachedFragCount);
    const numFrags = Math.min(Math.floor(Math.random() * 42) + 21, budget);
    const spread = charSize * 0.8;

    for (let i = 0; i < numFrags; i++) {
        particles.push(new Particle(
            randomFragChar(),
            spawnX + (Math.random() - 0.5) * spread,
            spawnY + (Math.random() - 0.5) * spread,
            true, charSize
        ));
    }
    cachedFragCount += numFrags;
}

// ── Animation Loop ─────────────────────────────────────────────────────────
let frameCount = 0;

function animate() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    frameCount++;

    // Purge dead particles every 8 frames (less frequent = smoother)
    if (frameCount % 8 === 0) {
        let writeIdx = 0;
        cachedFragCount = 0;
        for (let i = 0; i < particles.length; i++) {
            if (!particles[i].isDead()) {
                particles[writeIdx++] = particles[i];
                if (particles[i].isFragment) cachedFragCount++;
            }
        }
        particles.length = writeIdx;
    }

    // Update all
    for (let i = 0, len = particles.length; i < len; i++) {
        particles[i].update();
    }
    // Draw fragments (behind)
    for (let i = 0, len = particles.length; i < len; i++) {
        if (particles[i].isFragment) particles[i].drawFragment();
    }
    // Draw main chars (in front)
    for (let i = 0, len = particles.length; i < len; i++) {
        if (!particles[i].isFragment) particles[i].drawMain();
    }

    requestAnimationFrame(animate);
}

// ── Start ──────────────────────────────────────────────────────────────────
input.focus();
animate();

// ── MP4 Recording (WebCodecs + mp4-muxer + overlay compositing) ────────────
const recBtn = document.getElementById('recBtn');
const recLabel = recBtn.querySelector('.rec-label');

let mp4Recording = false;
let mp4Encoder = null;
let mp4Muxer = null;
let mp4FrameTimer = null;
let mp4FrameIndex = 0;

const REC_FPS = 30;
const REC_BITRATE = 16_000_000; // 16 Mbps

// Offscreen canvas for compositing art + overlay
let recCanvas = null;
let recCtx = null;

/**
 * Draw DOM overlay elements (TRY TYPING, typed chars, cursor)
 * onto the recording canvas using exact DOM positions.
 */
function drawOverlay(rCtx, w, h) {
    const containerRect = container.getBoundingClientRect();
    const scaleX = w / containerRect.width;
    const scaleY = h / containerRect.height;

    rCtx.save();

    // "TRY TYPING" prompt
    const prompt = document.getElementById('typingPrompt');
    const promptRect = prompt.getBoundingClientRect();
    const promptFs = parseFloat(getComputedStyle(prompt).fontSize) * scaleY;
    rCtx.font = `300 ${promptFs}px Inter, sans-serif`;
    rCtx.fillStyle = 'rgba(150, 150, 150, 0.8)';
    rCtx.textAlign = 'center';
    rCtx.textBaseline = 'middle';
    const px = (promptRect.left - containerRect.left + promptRect.width / 2) * scaleX;
    const py = (promptRect.top - containerRect.top + promptRect.height / 2) * scaleY;
    rCtx.fillText('TRY TYPING', px, py);

    // Typed characters (each with its own fade opacity)
    const chars = typedTextEl.querySelectorAll('.typed-char');
    chars.forEach(ch => {
        const r = ch.getBoundingClientRect();
        const fs = parseFloat(getComputedStyle(ch).fontSize) * scaleY;
        const op = parseFloat(getComputedStyle(ch).opacity);
        if (op <= 0) return;

        rCtx.globalAlpha = op;
        rCtx.font = `400 ${fs}px "Playfair Display", serif`;
        rCtx.fillStyle = 'rgba(10, 10, 10, 0.85)';
        rCtx.textAlign = 'center';
        rCtx.textBaseline = 'middle';
        const cx = (r.left - containerRect.left + r.width / 2) * scaleX;
        const cy = (r.top - containerRect.top + r.height / 2) * scaleY;
        rCtx.fillText(ch.textContent, cx, cy);
    });

    // Blinking cursor
    const cursor = document.getElementById('blinkCursor');
    const cursorRect = cursor.getBoundingClientRect();
    const cursorOp = parseFloat(getComputedStyle(cursor).opacity);
    if (cursorOp > 0) {
        const cFs = parseFloat(getComputedStyle(cursor).fontSize) * scaleY;
        rCtx.globalAlpha = cursorOp;
        rCtx.font = `300 ${cFs}px Inter, sans-serif`;
        rCtx.fillStyle = 'rgba(10, 10, 10, 0.4)';
        rCtx.textAlign = 'center';
        rCtx.textBaseline = 'middle';
        const ccx = (cursorRect.left - containerRect.left + cursorRect.width / 2) * scaleX;
        const ccy = (cursorRect.top - containerRect.top + cursorRect.height / 2) * scaleY;
        rCtx.fillText('|', ccx, ccy);
    }

    rCtx.restore();
}

recBtn.addEventListener('click', async () => {
    if (mp4Recording) {
        // ── STOP ──
        mp4Recording = false;
        clearInterval(mp4FrameTimer);

        await mp4Encoder.flush();
        mp4Encoder.close();

        mp4Muxer.finalize();
        const buffer = mp4Muxer.target.buffer;

        const blob = new Blob([buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url;
        a.download = `media-art_${ts}.mp4`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        recBtn.classList.remove('recording');
        recLabel.textContent = 'REC';
        mp4Encoder = null;
        mp4Muxer = null;
        recCanvas = null;
        recCtx = null;
    } else {
        // ── START ──
        // Ensure even dimensions (H.264 requirement)
        const w = canvas.width % 2 === 0 ? canvas.width : canvas.width - 1;
        const h = canvas.height % 2 === 0 ? canvas.height : canvas.height - 1;

        // Offscreen canvas for compositing
        recCanvas = document.createElement('canvas');
        recCanvas.width = w;
        recCanvas.height = h;
        recCtx = recCanvas.getContext('2d');

        mp4Muxer = new Mp4Muxer.Muxer({
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: w,
                height: h
            },
            fastStart: 'in-memory'
        });

        mp4Encoder = new VideoEncoder({
            output: (chunk, meta) => {
                mp4Muxer.addVideoChunk(chunk, meta);
            },
            error: (e) => console.error('VideoEncoder error:', e)
        });

        mp4Encoder.configure({
            codec: 'avc1.42001f',   // H.264 Baseline Level 3.1
            width: w,
            height: h,
            bitrate: REC_BITRATE,
            framerate: REC_FPS
        });

        mp4FrameIndex = 0;
        mp4Recording = true;
        const frameDuration = 1_000_000 / REC_FPS; // microseconds

        mp4FrameTimer = setInterval(() => {
            if (!mp4Recording) return;

            // Composite: art canvas + DOM overlay
            recCtx.clearRect(0, 0, w, h);
            recCtx.drawImage(canvas, 0, 0, w, h);
            drawOverlay(recCtx, w, h);

            const frame = new VideoFrame(recCanvas, {
                timestamp: mp4FrameIndex * frameDuration
            });

            // Keyframe every 2 seconds for smooth seeking in Premiere
            const keyFrame = mp4FrameIndex % (REC_FPS * 2) === 0;
            mp4Encoder.encode(frame, { keyFrame });
            frame.close();
            mp4FrameIndex++;
        }, 1000 / REC_FPS);

        recBtn.classList.add('recording');
        recLabel.textContent = 'STOP';
    }
});

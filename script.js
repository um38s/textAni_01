const canvas = document.getElementById('artCanvas');
const ctx = canvas.getContext('2d');
const input = document.getElementById('hiddenInput');
const introText = document.getElementById('introText');
const container = document.querySelector('.frame-container');

let width, height;
let particles = [];
let textString = "";

const config = {
    fontFamily: '"Playfair Display", serif',
    baseFontSize: 60,
    baseGravity: 0.055,
    friction: 0.97,
    maxFragments: 420,
    fragChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
};

// ── Glyph Cache — must be declared before resize() uses it ───────────────
const glyphCache = new Map();

// ── Resize ─────────────────────────────────────────────────────────────────
function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
    config.baseFontSize = Math.max(28, height * 0.08);
    glyphCache.clear(); // clear cached glyphs on resize (sizes change)
}
window.addEventListener('resize', resize);
resize();

function randomFragChar() {
    return config.fragChars[Math.floor(Math.random() * config.fragChars.length)];
}
function getGlyph(char, sizeFloat) {
    const size = Math.max(1, Math.round(sizeFloat));
    const key = char + '_' + size;
    if (glyphCache.has(key)) return glyphCache.get(key);
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
            // Falling speed: current was 60-80% → now an additional 60-80% = net 36-64% of baseGravity
            this.gravityScale = Math.random() * 0.28 + 0.36; // 36–64%
            this.rotationSpeed = (Math.random() - 0.5) * 0.0164; // +20% from 0.0137
        }

        this.rotation = (Math.random() - 0.5) * 0.4;
        this.age = 0;
    }

    update() {
        this.age++;

        if (!this.isFragment) {
            this.vy += config.baseGravity * this.gravityScale;
            this.vx *= config.friction;

            // Trail spawn (budget-gated)
            if (Math.random() > 0.65 && cachedFragCount < config.maxFragments) {
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

    // Draw fragment using cached glyph (fast drawImage path)
    drawFragment() {
        if (this.opacity <= 0) return;
        const size = Math.max(1, Math.round(this.size));
        const gc = getGlyph(this.char, size);
        const half = gc.width / 2;
        ctx.save();
        ctx.globalAlpha = Math.min(0.95, Math.max(0, this.opacity));
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.drawImage(gc, -half, -half);
        ctx.restore();
    }

    // Draw main character using fillText
    drawMain() {
        if (this.opacity <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.opacity);
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

let cachedFragCount = 0;

// ── Input: document-level keydown (works without clicking first) ───────────
document.addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    // Prevent key from also being inserted into hiddenInput (which would fire input event → double spawn)
    e.preventDefault();
    if (introText.style.opacity !== '0') introText.style.opacity = '0';
    spawnCharacter(e.key);
});

// Mobile fallback: touch → focus hidden input → on-screen keyboard → input event
container.addEventListener('click', () => { input.focus(); });
container.addEventListener('touchstart', () => { input.focus(); }, { passive: true });
input.addEventListener('input', (e) => {
    // Only fires on mobile (desktop keydown's preventDefault blocks it)
    const val = e.target.value;
    for (const ch of val) {
        if (introText.style.opacity !== '0') introText.style.opacity = '0';
        spawnCharacter(ch);
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

    const budget = Math.max(0, config.maxFragments - cachedFragCount);
    const numFrags = Math.min(Math.floor(Math.random() * 28) + 14, budget);
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
    // Clear canvas with globalAlpha guaranteed reset
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);

    frameCount++;

    // Purge dead particles every 5 frames
    if (frameCount % 5 === 0) {
        particles = particles.filter(p => !p.isDead());
        cachedFragCount = 0;
        for (let i = 0; i < particles.length; i++) {
            if (particles[i].isFragment) cachedFragCount++;
        }
    }

    // Single pass: update all, then draw fragments, then draw mains
    // (two-pass draw ensures mains always appear on top)
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
    }
    // Pass 1 – fragments (behind)
    for (let i = 0; i < particles.length; i++) {
        if (particles[i].isFragment) particles[i].drawFragment();
    }
    // Pass 2 – main chars (in front)
    for (let i = 0; i < particles.length; i++) {
        if (!particles[i].isFragment) particles[i].drawMain();
    }

    requestAnimationFrame(animate);
}

// Start
input.focus();
animate();

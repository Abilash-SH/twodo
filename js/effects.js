/* Twodo · message effects: bubble effects (slam, loud, gentle, invisible ink) and full-screen effects */
'use strict';

const FX = {
  bubble: [['slam', 'Slam'], ['loud', 'Loud'], ['gentle', 'Gentle'], ['ink', 'Invisible Ink']],
  screen: [['echo', 'Echo'], ['spotlight', 'Spotlight'], ['balloons', 'Balloons'], ['confetti', 'Confetti'], ['love', 'Love'], ['lasers', 'Lasers'], ['fireworks', 'Fireworks'], ['celebration', 'Celebration']],
  isBubble: fx => ['slam', 'loud', 'gentle', 'ink'].includes(fx),
};
// iMessage-style automatic effects for certain phrases
function autoFx(text) {
  const t = String(text || '').toLowerCase();
  if (/happy\s+birthday|happy\s+bday/.test(t)) return 'balloons';
  if (/congrat|selamat/.test(t)) return 'confetti';
  if (/happy\s+new\s+year/.test(t)) return 'fireworks';
  if (/pew\s*pew/.test(t)) return 'lasers';
  if (/\b(i\s+)?love\s+(you|u)\b|happy\s+anniversary/.test(t)) return 'love';
  return null;
}

/* ---------- bubble effects ---------- */
function playBubbleFx(el, fx, scroller) {
  if (!el || reducedMotion.matches) return;
  const spring = 'cubic-bezier(.34,1.56,.64,1)';
  if (fx === 'slam') {
    el.animate([
      { transform: 'translateY(-140px) scale(2.6)', opacity: 0, filter: 'blur(3px)' },
      { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'blur(0)', offset: 0.5, easing: 'cubic-bezier(.6,0,1,.6)' },
      { transform: 'scale(.9)', offset: 0.62 }, { transform: 'scale(1.03)', offset: 0.8 }, { transform: 'scale(1)' }], { duration: 850 });
    const ring = document.createElement('div'); ring.className = 'fx-ring'; el.appendChild(ring);
    ring.animate([{ transform: 'scale(.6)', opacity: 0.7 }, { transform: 'scale(2.2)', opacity: 0 }], { duration: 600, delay: 400, easing: 'ease-out', fill: 'both' }).onfinish = () => ring.remove();
    if (scroller) scroller.animate([{ transform: 'none' }, { transform: 'translate(7px,-5px)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(5px,3px)' }, { transform: 'translate(-3px,-2px)' }, { transform: 'none' }], { duration: 420, delay: 420 });
    haptic('heavy');
  } else if (fx === 'loud') {
    el.animate([
      { transform: 'scale(1)' }, { transform: 'scale(1.9) rotate(-3deg)', offset: 0.22 }, { transform: 'scale(1.9) rotate(3deg)', offset: 0.32 },
      { transform: 'scale(1.9) rotate(-3deg)', offset: 0.42 }, { transform: 'scale(1.9) rotate(2deg)', offset: 0.52 }, { transform: 'scale(1.9) rotate(0)', offset: 0.62 },
      { transform: 'scale(1)' }], { duration: 1500, easing: 'ease-in-out' });
    haptic('medium');
  } else if (fx === 'gentle') {
    el.animate([{ transform: 'scale(.3)', opacity: 0.2 }, { transform: 'scale(.3)', opacity: 1, offset: 0.25 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 2600, easing: 'cubic-bezier(.2,.7,.2,1)' });
  } else if (fx === 'pop') {
    el.animate([{ transform: 'scale(.5) translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 480, easing: spring });
  }
}

/* Invisible ink: drifting particles cover the text until tapped */
const Ink = {
  items: new Set(), raf: 0,
  attach(bub) {
    if (bub._ink) return;
    const c = document.createElement('canvas'); c.className = 'ink-cv'; bub.appendChild(c); bub.classList.add('inked');
    const r = bub.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    c.width = Math.max(1, r.width * dpr); c.height = Math.max(1, r.height * dpr);
    const n = Math.min(900, Math.round(r.width * r.height / 14));
    const P = Array.from({ length: n }, () => ({ x: Math.random() * r.width, y: Math.random() * r.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, a: Math.random() }));
    bub._ink = { c, x: c.getContext('2d'), P, w: r.width, h: r.height, dpr, light: bub.classList.contains('me') };
    this.items.add(bub); this.loop();
  },
  reveal(bub) {
    if (!bub._ink || bub.classList.contains('revealed')) return;
    bub.classList.add('revealed'); haptic('light');
    clearTimeout(bub._inkT); bub._inkT = setTimeout(() => bub.classList.remove('revealed'), 6000);
  },
  loop() {
    if (this.raf) return;
    const step = () => {
      this.raf = 0;
      for (const b of this.items) {
        if (!b.isConnected) { this.items.delete(b); continue; }
        const k = b._ink, x = k.x;
        x.setTransform(k.dpr, 0, 0, k.dpr, 0, 0); x.clearRect(0, 0, k.w, k.h);
        x.fillStyle = k.light ? 'rgba(255,255,255,.9)' : (document.documentElement.dataset.theme === 'dark' ? 'rgba(255,255,255,.75)' : 'rgba(60,60,67,.7)');
        for (const p of k.P) {
          p.x += p.vx; p.y += p.vy; p.a += 0.05;
          if (p.x < 0 || p.x > k.w) p.vx *= -1; if (p.y < 0 || p.y > k.h) p.vy *= -1;
          x.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(p.a)); x.fillRect(p.x, p.y, 1.4, 1.4);
        }
        x.globalAlpha = 1;
      }
      if (this.items.size) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },
};

/* ---------- full-screen effects ---------- */
function fxCanvas(dur, draw, { dim = 0, add = false } = {}) {
  if (reducedMotion.matches) return;
  const c = document.createElement('canvas'); c.className = 'fx-canvas'; document.body.append(c);
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const t0 = performance.now();
  (function frame(now) {
    const t = Math.max(0, (now - t0) / 1000);
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H);
    if (dim) { x.fillStyle = `rgba(0,0,0,${dim * Math.min(1, t / 0.35, (dur - t) / 0.6)})`; x.fillRect(0, 0, W, H); }
    if (add) x.globalCompositeOperation = 'lighter';
    draw(x, t, W, H);
    if (t < dur) requestAnimationFrame(frame); else c.remove();
  })(t0);
}
const darken = (hex, f = 0.62) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) * f | 0},${((n >> 8) & 255) * f | 0},${(n & 255) * f | 0})`; };
function heartPath(x, cx, cy, size) {
  const s = size / 2;
  x.beginPath(); x.moveTo(cx, cy + s * 0.9);
  x.bezierCurveTo(cx - s * 1.6, cy - s * 0.1, cx - s * 0.8, cy - s * 1.25, cx, cy - s * 0.45);
  x.bezierCurveTo(cx + s * 0.8, cy - s * 1.25, cx + s * 1.6, cy - s * 0.1, cx, cy + s * 0.9);
  x.closePath();
}

const ScreenFx = {
  balloons() {
    const cols = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE', '#FF2D55'];
    const W = innerWidth, H = innerHeight;
    const B = Array.from({ length: 16 }, (_, i) => ({ x: Math.random() * W, y: H + 50 + Math.random() * H * 0.7, r: 24 + Math.random() * 16, c: cols[i % cols.length], sp: 2.4 + Math.random() * 1.8, ph: Math.random() * 6 }));
    fxCanvas(5, (x, t) => {
      for (const b of B) {
        b.y -= b.sp; const sx = b.x + Math.sin(t * 1.4 + b.ph) * 16, bot = b.y + b.r * 1.18;
        x.strokeStyle = 'rgba(140,140,150,.7)'; x.lineWidth = 1; x.beginPath(); x.moveTo(sx, bot + 4);
        x.quadraticCurveTo(sx + 9 * Math.sin(t * 3 + b.ph), bot + 34, sx - 2, bot + 70); x.stroke();
        const g = x.createRadialGradient(sx - b.r * 0.35, b.y - b.r * 0.45, b.r * 0.08, sx, b.y, b.r * 1.25);
        g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.22, b.c); g.addColorStop(1, darken(b.c));
        x.fillStyle = g; x.beginPath(); x.ellipse(sx, b.y, b.r, b.r * 1.18, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = darken(b.c, 0.8); x.beginPath(); x.moveTo(sx - 5, bot + 6); x.lineTo(sx + 5, bot + 6); x.lineTo(sx, bot - 2); x.fill();
      }
    });
  },
  confetti() {
    const cols = ['#FF2D55', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE', '#5AC8FA'], W = innerWidth;
    const P = Array.from({ length: 220 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * 500, vy: 2 + Math.random() * 3, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6, va: 0.05 + Math.random() * 0.12, sw: Math.random() * 6 }));
    fxCanvas(4.5, (x, t) => {
      for (const p of P) {
        p.y += p.vy; p.a += p.va; const sx = p.x + Math.sin(t * 2 + p.sw) * 20;
        x.save(); x.translate(sx, p.y); x.rotate(p.a); x.scale(1, Math.cos(p.a * 1.7)); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore();
      }
    });
  },
  love({ from }) {
    const W = innerWidth, H = innerHeight, sx = from ? from.x : W / 2, sy = from ? from.y : H * 0.7;
    const small = Array.from({ length: 26 }, () => ({ a: Math.random() * Math.PI * 2, v: 2 + Math.random() * 4, s: 10 + Math.random() * 18 }));
    fxCanvas(3.4, (x, t) => {
      const cx = W / 2, cy = H * 0.45, big = Math.min(W, H) * 0.62;
      let px, py, s, alpha = 1;
      if (t < 0.6) { const e = 1 - Math.pow(1 - t / 0.6, 3); px = sx + (cx - sx) * e; py = sy + (cy - sy) * e; s = big * (0.1 + 0.9 * e); }
      else if (t < 2) { px = cx; py = cy; s = big * (1 + 0.08 * Math.max(0, Math.sin((t - 0.6) * Math.PI * 2.4))); }
      else { const e = (t - 2) / 1.4; px = cx; py = cy - e * H * 0.35; s = big * (1 - 0.3 * e); alpha = 1 - e; }
      x.globalAlpha = Math.max(0, alpha);
      const g = x.createLinearGradient(px, py - s / 2, px, py + s / 2); g.addColorStop(0, '#FF6B8B'); g.addColorStop(1, '#E3002D');
      x.shadowColor = 'rgba(255,45,85,.6)'; x.shadowBlur = 40; x.fillStyle = g; heartPath(x, px, py, s); x.fill(); x.shadowBlur = 0;
      if (t > 0.55 && t < 2.6) for (const h of small) {
        const k = (t - 0.55) * 60; x.globalAlpha = Math.max(0, 1 - (t - 0.55) / 2);
        x.fillStyle = '#FF2D55'; heartPath(x, cx + Math.cos(h.a) * h.v * k, cy + Math.sin(h.a) * h.v * k, h.s); x.fill();
      }
      x.globalAlpha = 1;
    });
  },
  fireworks() {
    const W = innerWidth, H = innerHeight, cols = ['#FF453A', '#FFD60A', '#30D158', '#64D2FF', '#BF5AF2', '#FF9F0A', '#FFFFFF'];
    const P = []; let next = 0;
    const burst = () => { const cx = W * (0.15 + Math.random() * 0.7), cy = H * (0.12 + Math.random() * 0.45), c = cols[(Math.random() * cols.length) | 0];
      for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 4.5; P.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c }); } };
    fxCanvas(4.2, (x, t) => {
      if (t > next && t < 3.2) { burst(); next = t + 0.35 + Math.random() * 0.4; }
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.045; p.x += p.vx; p.y += p.vy; p.life -= 0.012;
        if (p.life <= 0) { P.splice(i, 1); continue; }
        x.globalAlpha = p.life; x.strokeStyle = p.c; x.lineWidth = 2; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); x.stroke();
      }
      x.globalAlpha = 1;
    }, { dim: 0.78, add: true });
  },
  lasers() {
    const cols = ['#00FFF0', '#FF00E6', '#39FF14', '#FFE600', '#3D7BFF', '#FF2D2D'];
    fxCanvas(3.8, (x, t, W, H) => {
      x.lineCap = 'round';
      cols.forEach((c, i) => {
        const ang = Math.PI / 2 + Math.sin(t * (1.6 + i * 0.25) + i) * 0.85, ox = W * (i % 2 ? 0.25 : 0.75), oy = -10;
        x.strokeStyle = c; x.shadowColor = c; x.shadowBlur = 22; x.lineWidth = 3.5;
        x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + Math.cos(ang) * H * 1.6, oy + Math.sin(ang) * H * 1.6); x.stroke();
      });
      x.shadowBlur = 0;
    }, { dim: 0.85, add: true });
  },
  celebration() {
    const W = innerWidth, cols = ['#FFD700', '#FFC107', '#FFF3B0', '#FFE680', '#FFFFFF'], P = [];
    fxCanvas(3.8, (x, t) => {
      if (t < 2.6) for (let i = 0; i < 9; i++) { const a = Math.PI * (0.55 + Math.random() * 0.4), v = 3 + Math.random() * 7; P.push({ x: W - 10, y: 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, s: 1 + Math.random() * 2.5, c: cols[(Math.random() * cols.length) | 0], f: Math.random() * 6 }); }
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.vy += 0.06; p.x += p.vx; p.y += p.vy; p.life -= 0.011; p.f += 0.4;
        if (p.life <= 0) { P.splice(i, 1); continue; }
        x.globalAlpha = p.life * (0.5 + 0.5 * Math.abs(Math.sin(p.f))); x.fillStyle = p.c;
        x.beginPath(); x.arc(p.x, p.y, p.s, 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 1;
    }, { dim: 0.55, add: true });
  },
  echo({ text, mine }) {
    if (reducedMotion.matches) return;
    const wrap = document.createElement('div'); wrap.className = 'fx-layer'; document.body.append(wrap);
    const W = innerWidth, H = innerHeight;
    for (let i = 0; i < 22; i++) {
      const b = document.createElement('div'); b.className = 'bub echo ' + (mine ? 'me' : 'them'); b.textContent = text.slice(0, 60);
      b.style.left = (Math.random() * (W - 120)) + 'px'; b.style.top = (H * 0.4 + Math.random() * H * 0.6) + 'px';
      wrap.append(b);
      b.animate([{ transform: 'translateY(0) scale(.6)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translateY(${-H * (0.5 + Math.random() * 0.5)}px) scale(1)`, opacity: 0 }],
        { duration: 1800 + Math.random() * 1200, delay: Math.random() * 900, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    }
    setTimeout(() => wrap.remove(), 4200);
  },
  spotlight({ from }) {
    if (reducedMotion.matches) return;
    const o = document.createElement('div'); o.className = 'fx-layer spot'; document.body.append(o);
    const W = innerWidth, H = innerHeight, tx = from ? from.x : W / 2, ty = from ? from.y : H / 2;
    const pts = [[W * 0.2, H * 0.2], [W * 0.8, H * 0.35], [W * 0.3, H * 0.7], [tx, ty]], t0 = performance.now();
    (function frame(now) {
      const t = Math.max(0, (now - t0) / 1000), seg = Math.min(2.999, t / 0.7), i = Math.floor(seg), f = seg - i, e = f * f * (3 - 2 * f);
      const [ax, ay] = pts[i], [bx, by] = pts[Math.min(3, i + 1)];
      const x = t > 2.1 ? tx : ax + (bx - ax) * e, y = t > 2.1 ? ty : ay + (by - ay) * e;
      const a = Math.min(1, t / 0.3, (3.6 - t) / 0.5);
      o.style.background = `radial-gradient(circle at ${x}px ${y}px, transparent 0 80px, rgba(0,0,0,${0.85 * a}) 130px)`;
      if (t < 3.6) requestAnimationFrame(frame); else o.remove();
    })(t0);
  },
};

function playScreenFx(fx, opts = {}) { const f = ScreenFx[fx]; if (f) f(opts); }

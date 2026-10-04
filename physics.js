const GRAVITY = 1800;
const AIR = 0.999;
const WALL_REST = 0.5;
const WALL_FRIC = 0.98;
const MAX_SPEED = 1800;
const DT = 1 / 240;

const BALL = { x: 430, y: 730, vx: 0, vy: 0, r: 9 };

const FLIP_RATE = 20; // rad/s
const FLIPPER_REST = 0.35; // 球撞 flipper 的 restitution
const FLIPPERS = [
  { side:'L', px:150, py:710, len:80, rest: 0.5236, press:-0.4887, angle: 0.5236, pressed:false, omega: 0 }, // 左：rest +30°、按下 -28°
  { side:'R', px:330, py:710, len:80, rest: 2.6180, press: 3.6303, angle: 2.6180, pressed:false, omega: 0 }  // 右：rest 150°、按下 208°
];

const BUMPER_BOOST = 350, SLING_BOOST = 320;
const BUMPERS = [
  { x:150, y:300, r:26 },
  { x:330, y:300, r:26 },
  { x:240, y:180, r:26 }
];
// slingshot：三角形的斜邊會踢球；kick:true 的線段碰撞後沿法線加速
const SLINGS = [
  { x1:90,  y1:615, x2:145, y2:690, kick:true },   // 左斜邊（法線朝右上）
  { x1:90,  y1:615, x2:90,  y2:690 },              // 左內側
  { x1:90,  y1:690, x2:145, y2:690 },              // 左底
  { x1:390, y1:615, x2:335, y2:690, kick:true },   // 右斜邊（法線朝左上）
  { x1:390, y1:615, x2:390, y2:690 },
  { x1:390, y1:690, x2:335, y2:690 }
];
const PHYS_EVENTS = []; // {type:'bumper'|'sling', x, y}

function clearEvents() {
  PHYS_EVENTS.length = 0;
}

function arcSegs(cx, cy, r, n) {
  const segs = [];
  let px = cx - r;
  let py = cy;
  for (let i = 1; i <= n; i++) {
    const a = Math.PI * (1 - i / n);
    const x = cx + r * Math.cos(a);
    const y = cy - r * Math.sin(a);
    segs.push({ x1: px, y1: py, x2: x, y2: y });
    px = x;
    py = y;
  }
  return segs;
}

const SEGS = [
  { x1: 20, y1: 40, x2: 20, y2: 760 },
  { x1: 460, y1: 40, x2: 460, y2: 760 },
  ...arcSegs(240, 240, 220, 16).slice(0, 12),
  { x1: 400, y1: 140, x2: 400, y2: 760 },
  { x1: 20, y1: 760, x2: 100, y2: 760 },
  { x1: 380, y1: 760, x2: 400, y2: 760 },
  { x1: 20, y1: 690, x2: 100, y2: 760 },
  { x1: 395.6, y1: 84.4, x2: 460, y2: 140 },
  { x1: 400, y1: 748, x2: 460, y2: 748 },
  { x1: 400, y1: 140, x2: 460, y2: 140, oneway: true }
];

function closestPointOnSeg(px, py, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - s.x1) * dx + (py - s.y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { x: s.x1 + dx * t, y: s.y1 + dy * t };
}

function setFlipper(side, pressed) {
  for (let i = 0; i < FLIPPERS.length; i++) {
    if (FLIPPERS[i].side === side) FLIPPERS[i].pressed = pressed;
  }
}

function updateFlippers(dt) {
  for (let i = 0; i < FLIPPERS.length; i++) {
    const f = FLIPPERS[i];
    const prev = f.angle;
    const target = f.pressed ? f.press : f.rest;
    const diff = target - f.angle;
    const step = FLIP_RATE * dt;
    if (Math.abs(diff) <= step) f.angle = target;
    else f.angle += Math.sign(diff) * step;
    f.omega = (f.angle - prev) / dt;
  }
}

function flipperSeg(f) {
  return {
    x1: f.px,
    y1: f.py,
    x2: f.px + f.len * Math.cos(f.angle),
    y2: f.py + f.len * Math.sin(f.angle)
  };
}

function stepBall(dt) {
  updateFlippers(dt);
  BALL.vy += GRAVITY * dt;
  BALL.x += BALL.vx * dt;
  BALL.y += BALL.vy * dt;
  const r2 = BALL.r * BALL.r;
  for (let i = 0; i < SEGS.length; i++) {
    const s = SEGS[i];
    const p = closestPointOnSeg(BALL.x, BALL.y, s);
    if (s.oneway && BALL.y >= p.y) continue;
    const dx = BALL.x - p.x;
    const dy = BALL.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r2) continue;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d;
    const ny = dy / d;
    const push = BALL.r - d;
    BALL.x += nx * push;
    BALL.y += ny * push;
    const vn = BALL.vx * nx + BALL.vy * ny;
    if (vn < 0) {
      const vnx = vn * nx;
      const vny = vn * ny;
      BALL.vx = (BALL.vx - vnx) * WALL_FRIC - vnx * WALL_REST;
      BALL.vy = (BALL.vy - vny) * WALL_FRIC - vny * WALL_REST;
    }
  }
  for (let i = 0; i < FLIPPERS.length; i++) {
    const f = FLIPPERS[i];
    const p = closestPointOnSeg(BALL.x, BALL.y, flipperSeg(f));
    const dx = BALL.x - p.x;
    const dy = BALL.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r2) continue;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d;
    const ny = dy / d;
    const push = BALL.r - d;
    BALL.x += nx * push;
    BALL.y += ny * push;
    const w = f.omega;
    const surfVx = -w * (p.y - f.py);
    const surfVy = w * (p.x - f.px);
    const rvx = BALL.vx - surfVx;
    const rvy = BALL.vy - surfVy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const vnx = vn * nx;
      const vny = vn * ny;
      BALL.vx = (rvx - vnx) * 0.98 - vnx * FLIPPER_REST + surfVx;
      BALL.vy = (rvy - vny) * 0.98 - vny * FLIPPER_REST + surfVy;
    }
  }
  for (let i = 0; i < BUMPERS.length; i++) {
    const b = BUMPERS[i];
    const rr = b.r + BALL.r;
    const dx = BALL.x - b.x;
    const dy = BALL.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d;
    const ny = dy / d;
    const push = rr - d;
    BALL.x += nx * push;
    BALL.y += ny * push;
    const tx = -ny, ty = nx;
    const vt = BALL.vx * tx + BALL.vy * ty;
    BALL.vx = tx * vt * 0.98 + nx * BUMPER_BOOST;
    BALL.vy = ty * vt * 0.98 + ny * BUMPER_BOOST;
    PHYS_EVENTS.push({ type: 'bumper', x: BUMPERS[i].x, y: BUMPERS[i].y });
  }
  for (let i = 0; i < SLINGS.length; i++) {
    const s = SLINGS[i];
    const p = closestPointOnSeg(BALL.x, BALL.y, s);
    const dx = BALL.x - p.x;
    const dy = BALL.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r2) continue;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d;
    const ny = dy / d;
    BALL.x += nx * (BALL.r - d);
    BALL.y += ny * (BALL.r - d);
    if (!s.kick) {
      const vn = BALL.vx * nx + BALL.vy * ny;
      if (vn < 0) {
        const vnx = vn * nx;
        const vny = vn * ny;
        BALL.vx = (BALL.vx - vnx) * WALL_FRIC - vnx * WALL_REST;
        BALL.vy = (BALL.vy - vny) * WALL_FRIC - vny * WALL_REST;
      }
    } else {
      let kx = -(s.y2 - s.y1);
      let ky = s.x2 - s.x1;
      const kl = Math.sqrt(kx * kx + ky * ky) || 1e-6;
      kx /= kl;
      ky /= kl;
      if (ky > 0) { kx = -kx; ky = -ky; }
      const vn = BALL.vx * kx + BALL.vy * ky;
      if (vn < 0) {
        const vnx = vn * kx;
        const vny = vn * ky;
        BALL.vx = (BALL.vx - vnx) * 0.98 + SLING_BOOST * kx;
        BALL.vy = (BALL.vy - vny) * 0.98 + SLING_BOOST * ky;
        PHYS_EVENTS.push({ type: 'sling', x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 });
      }
    }
  }
  const sp = Math.sqrt(BALL.vx * BALL.vx + BALL.vy * BALL.vy);
  if (sp > MAX_SPEED) {
    const k = MAX_SPEED / sp;
    BALL.vx *= k;
    BALL.vy *= k;
  }
  BALL.vx *= AIR;
  BALL.vy *= AIR;
}

function drained() {
  return BALL.y > 810;
}

function resetBall() {
  BALL.x = 430;
  BALL.y = 739;
  BALL.vx = 0;
  BALL.vy = 0;
}

function launch(charge) {
  BALL.vy = -(900 + 900 * charge);
}

function inLauncherLane(x) {
  return x > 400;
}

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const overlay = document.getElementById('overlay');

cv.width = 480;
cv.height = 800;
cv.style.touchAction = 'none';

let state = 'title';
let charge = 0;
let charging = false;
let acc = 0;
let stuckT = 0;
let score = 0;
let balls = 3;
let high = Number(localStorage.getItem('pinball_high') || 0);
const scoreEl = document.getElementById('score');
const ballsEl = document.getElementById('balls');
const highEl = document.getElementById('high');
document.getElementById('hud').style.font = 'bold 14px monospace';
for (const el of [scoreEl, ballsEl, highEl]) el.style.padding = '6px 10px';
const pops = [];
function addPop(x, y, txt) {
  pops.push({ x, y, txt, life: 0.8 });
}
function updateHUD() {
  scoreEl.textContent = 'SCORE ' + score;
  ballsEl.textContent = 'BALL ' + Math.max(0, balls);
  highEl.textContent = 'HIGH ' + high;
}
updateHUD();

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STARS = (() => {
  const rnd = mulberry32(20261004);
  const arr = [];
  for (let i = 0; i < 80; i++) {
    arr.push({
      x: rnd() * 480,
      y: rnd() * 800,
      s: rnd() < 0.5 ? 1 : 2,
      c: rnd() < 0.6 ? '#ffffff' : '#bcd7ff'
    });
  }
  return arr;
})();

function resize() {
  const scale = Math.min((innerWidth - 8) / 480, (innerHeight - 8) / 800);
  cv.style.width = 480 * scale + 'px';
  cv.style.height = 800 * scale + 'px';
}
window.addEventListener('resize', resize);
resize();

function showOverlay(html) {
  overlay.innerHTML = html;
  overlay.hidden = false;
}
function hideOverlay() {
  overlay.hidden = true;
}
hideOverlay();

const ovStyle = document.createElement('style');
ovStyle.textContent = '#overlay{padding:26px 36px;border-radius:12px}#overlay .t1{font-size:32px;font-weight:bold;color:#59d9ff;letter-spacing:2px}#overlay .t2{font-size:15px;margin:10px 0;color:#cfd8ff}#overlay button{margin-top:14px;padding:10px 28px;font-size:16px;font-weight:bold;color:#0b0b23;background:#ffd166;border:0;border-radius:8px;cursor:pointer}';
document.head.appendChild(ovStyle);

function startGame() {
  score = 0;
  balls = 3;
  updateHUD();
  resetBall();
  charge = 0;
  stuckT = 0;
  state = 'aiming';
  hideOverlay();
}
overlay.addEventListener('click', (e) => {
  if (e.target.id === 'btnStart' || e.target.id === 'btnRestart') startGame();
});
showOverlay('<div class=t1>太空彈珠台</div><div class=t2>SPACE CADET PINBALL</div><button id=btnStart>開始遊戲</button>');

const held = new Set();
const pointerSides = new Map();

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (e.repeat) return;
    if (state === 'playing') {
      setFlipper('L', true);
      setFlipper('R', true);
    } else if (state === 'aiming') {
      charging = true;
    }
    return;
  }
  if (e.repeat) return;
  if (state !== 'playing' && state !== 'aiming') return;
  if (e.code === 'KeyZ' || e.code === 'ArrowLeft') {
    e.preventDefault();
    setFlipper('L', true);
  } else if (e.code === 'Slash' || e.code === 'ArrowRight') {
    e.preventDefault();
    setFlipper('R', true);
  }
});

window.addEventListener('keyup', (e) => {
  if (state !== 'playing' && state !== 'aiming') return;
  if (e.code === 'Space') {
    if (state === 'playing') {
      setFlipper('L', false);
      setFlipper('R', false);
    } else if (state === 'aiming') {
      if (!charging) return;
      charging = false;
      launch(charge);
      charge = 0;
      stuckT = 0;
      state = 'playing';
    }
    return;
  }
  if (e.code === 'KeyZ' || e.code === 'ArrowLeft') {
    setFlipper('L', false);
  } else if (e.code === 'Slash' || e.code === 'ArrowRight') {
    setFlipper('R', false);
  }
});

cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (state !== 'aiming' && state !== 'playing') return;
  const r = cv.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 480;
  if (state === 'aiming') {
    if (x > 360) {
      held.add(e.pointerId);
      charging = true;
    }
    return;
  }
  if (state === 'playing') {
    const side = x < 240 ? 'L' : 'R';
    pointerSides.set(e.pointerId, side);
    setFlipper(side, true);
  }
});

function pointerRelease(e) {
  e.preventDefault();
  if (pointerSides.has(e.pointerId)) {
    const side = pointerSides.get(e.pointerId);
    pointerSides.delete(e.pointerId);
    let other = false;
    pointerSides.forEach((s) => {
      if (s === side) other = true;
    });
    if (!other) setFlipper(side, false);
    return;
  }
  if (!held.delete(e.pointerId)) return;
  if (held.size > 0 || state !== 'aiming') return;
  charging = false;
  launch(charge);
  charge = 0;
  stuckT = 0;
  state = 'playing';
}

window.addEventListener('pointerup', pointerRelease);
window.addEventListener('pointercancel', pointerRelease);

function update(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].y -= 30 * dt;
    pops[i].life -= dt;
    if (pops[i].life <= 0) pops.splice(i, 1);
  }
  if (state === 'aiming') {
    resetBall();
    if (charging) charge = Math.min(1, charge + 1 / 72);
  } else if (state === 'playing') {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 8) {
      stepBall(DT);
      acc -= DT;
      n++;
    }
    if (n === 8) acc = 0;
    if (drained()) {
      balls--;
      updateHUD();
      if (balls > 0) {
        resetBall();
        charge = 0;
        state = 'aiming';
      } else {
        if (score > high) {
          high = score;
          localStorage.setItem('pinball_high', high);
        }
        updateHUD();
        showOverlay('<div class=t1>GAME OVER</div><div class=t2>本局 ' + score + ' 分' + (score >= high ? '　🏆 新紀錄' : '') + '</div><div class=t2>最高 ' + high + '</div><button id=btnRestart>再玩一次</button>');
        state = 'gameover';
      }
      return;
    }
    const sp = Math.hypot(BALL.vx, BALL.vy);
    if (sp < 25 && !ballNearFlipper(20)) stuckT += dt;
    else stuckT = 0;
    if (stuckT > 2) {
      stuckT = 0;
      resetBall();
      charge = 0;
      state = 'aiming';
      addPop(240, 420, '卡住！送回發射道');
    }
    for (const ev of PHYS_EVENTS) {
      if (ev.type === 'bumper') { score += 100; addPop(ev.x, ev.y, '+100'); }
      else if (ev.type === 'sling') { score += 10; addPop(ev.x, ev.y, '+10'); }
    }
    clearEvents();
    updateHUD();
  }
}

function render() {
  ctx.fillStyle = '#0b0b23';
  ctx.fillRect(0, 0, 480, 800);

  for (let i = 0; i < STARS.length; i++) {
    const st = STARS[i];
    ctx.fillStyle = st.c;
    ctx.fillRect(st.x, st.y, st.s, st.s);
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7c5cff';
  ctx.beginPath();
  for (let i = 0; i < SEGS.length; i++) {
    const s = SEGS[i];
    if (s.oneway) continue;
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();

  ctx.strokeStyle = '#ffd166';
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  for (let i = 0; i < SEGS.length; i++) {
    const s = SEGS[i];
    if (!s.oneway) continue;
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const kicks = SLINGS.filter((s) => s.kick);
  const walls = SLINGS.filter((s) => !s.kick);
  for (const k of kicks) {
    const pts = [[k.x1, k.y1], [k.x2, k.y2]];
    for (const w of walls) {
      if ((w.x1 === k.x1 && w.y1 === k.y1) || (w.x1 === k.x2 && w.y1 === k.y2)) pts.push([w.x2, w.y2]);
      else if ((w.x2 === k.x1 && w.y2 === k.y1) || (w.x2 === k.x2 && w.y2 === k.y2)) pts.push([w.x1, w.y1]);
    }
    if (pts.length >= 3) {
      ctx.fillStyle = 'rgba(255,209,102,0.12)';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.lineCap = 'round';
  for (const w of walls) {
    ctx.strokeStyle = '#7c5cff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }
  for (const k of kicks) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(k.x1, k.y1);
    ctx.lineTo(k.x2, k.y2);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  for (let i = 0; i < BUMPERS.length; i++) {
    const b = BUMPERS[i];
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#59d9ff';
    const bg = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.r);
    bg.addColorStop(0, '#1b6fae');
    bg.addColorStop(1, '#59d9ff');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = 'round';

  ctx.lineCap = 'round';
  for (let i = 0; i < FLIPPERS.length; i++) {
    const s = flipperSeg(FLIPPERS[i]);
    ctx.strokeStyle = '#12304a';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    const g = ctx.createLinearGradient(s.x1, s.y1, s.x2, s.y2);
    g.addColorStop(0, '#e8f6ff');
    g.addColorStop(1, FLIPPERS[i].pressed ? '#aef' : '#59d9ff');
    ctx.strokeStyle = g;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  const g = ctx.createRadialGradient(BALL.x - 3, BALL.y - 3, 1, BALL.x, BALL.y, BALL.r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#dfe4ee');
  g.addColorStop(1, '#8a90a5');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(BALL.x, BALL.y, BALL.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(BALL.x - 3, BALL.y - 3.5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i < pops.length; i++) {
    const p = pops[i];
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.8));
    ctx.fillStyle = '#ffd166';
    ctx.fillText(p.txt, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  if (state === 'aiming') {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#7c5cff';
    ctx.strokeRect(405, 700, 50, 60);
    const h = 54 * charge;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(408, 757 - h, 44, h);
    ctx.fillStyle = '#9aa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('按住右側蓄力，放開發射', 230, 735);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = '#667';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(state + ' ball(' + Math.round(BALL.x) + ',' + Math.round(BALL.y) + ')', 474, 16);
  ctx.textAlign = 'left';
}

let last = performance.now();

function frame(t) {
  const dt = Math.min((t - last) / 1000, 0.1);
  last = t;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

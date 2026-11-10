'use strict';
/* ---------- constants & helpers ---------- */
const W = 1600, H = 900, HALF = 22, SP = 3;
const $ = id => document.getElementById(id);
const cssv = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
const C = {};
['bg','bg2','line','line2','fg','dim','mute','pulse','rail','arc','mortar','stasis','lance','amp','bot','good'].forEach(k => C[k] = cssv('--' + k));
const hexRgb = h => { h = h.replace('#', ''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; };
const rgba = (h, a) => { const c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const TAU = Math.PI * 2;

/* ---------- maps (turtle paths: f = straight, t = arc [deg, radius], +deg turns right) ---------- */
const F = n => ['f', n], T = (d, r) => ['t', d, r];
const MAPS = [
  { id: 'meander', name: 'Meander', tag: 'Open', blurb: 'Long passes with a tight hairpin. Plenty of room low and left.',
    lives: 20, credits: 230, hp: 1,
    start: [-60, 130, 0], cmds: [F(480),T(60,160),T(-60,160),F(560),T(180,110),F(960),T(-180,90),F(1140)],
    obs: [[190,380,46,'c'],[520,400,40,'h'],[900,600,32,'c'],[1490,420,42,'h'],[1000,130,40,'h'],[1180,810,36,'c']] },
  { id: 'inward', name: 'Inward', tag: 'Long', blurb: 'A spiral that ends in the middle. Long route, narrow corridors.',
    lives: 20, credits: 230, hp: 0.92,
    start: [-60, 100, 0], cmds: [F(1380),T(90,100),F(480),T(90,100),F(1040),T(90,100),F(280),T(90,100),F(700),T(90,100),F(160)],
    obs: [[640,560,50,'h'],[480,430,40,'c'],[880,680,40,'c'],[1250,420,44,'h']] },
  { id: 'switchback', name: 'Switchback', tag: 'Tight', blurb: 'Folded columns, then a hook around an open pocket. Fewer lives.',
    lives: 14, credits: 260, hp: 1.1,
    start: [230, -60, 90], cmds: [F(710),T(-90,120),T(-90,120),F(450),T(90,120),T(90,120),F(450),T(-90,120),T(-90,120),F(330),T(90,150),F(200),T(90,150),F(200),T(90,150),F(160)],
    obs: [[1250,430,44,'h'],[1100,520,36,'c'],[1520,740,38,'c'],[1500,110,36,'h'],[90,430,44,'c']] },
  { id: 'ripple', name: 'Ripple', tag: 'Flowing', blurb: 'One wave across the middle. Huge open fields above and below.',
    lives: 20, credits: 240, hp: 1,
    start: [-60, 450, 0], cmds: [F(100),T(60,110),T(-120,110),T(120,110),T(-120,110),T(120,110),T(-120,110),T(120,110),T(-60,110),F(120)],
    obs: [[420,200,44,'h'],[820,720,44,'c'],[1220,170,40,'h'],[1340,740,40,'c'],[160,720,38,'h'],[700,160,34,'c']] },
  { id: 'outbound', name: 'Outbound', tag: 'Reverse', blurb: 'Bots appear in the middle and spiral out to a core in the corner.',
    lives: 20, credits: 260, hp: 0.95, rev: true,
    start: [-60, 100, 0], cmds: [F(1380),T(90,100),F(480),T(90,100),F(1040),T(90,100),F(280),T(90,100),F(700),T(90,100),F(160)],
    obs: [[640,560,50,'h'],[480,430,40,'c'],[880,680,40,'c'],[1250,420,44,'h']] },
  { id: 'gauntlet', name: 'Gauntlet', tag: 'Short', blurb: 'One short run with almost no time to react. Build big and build early.',
    lives: 18, credits: 320, hp: 1,
    start: [-60, 420, 0], cmds: [F(200),T(-50,240),T(100,240),T(-50,240),F(120),T(50,160),T(-100,160),T(50,160)],
    obs: [[500,120,42,'h'],[700,720,46,'c'],[1180,140,40,'h'],[1300,700,40,'c'],[200,740,40,'h'],[1000,640,34,'c']] },
  { id: 'knot', name: 'Knot', tag: 'Crossing', blurb: 'The trace crosses itself twice and ends deep inside its own loop. Crossings are hit twice.',
    lives: 20, credits: 260, hp: 1.05, poly: [[-60,450],[1300,450],[1300,120],[300,120],[300,780],[1000,780],[1000,280],[700,280],[700,600]], pr: 75,
    obs: [[850,560,34,'c'],[520,300,36,'h'],[1150,230,36,'c'],[160,300,38,'h'],[160,620,36,'c'],[1450,720,40,'h'],[520,640,34,'h']] },
  { id: 'labyrinth', name: 'Labyrinth', tag: 'Very long', blurb: 'Five switchbacks stacked tight. A very long route with narrow lanes between.',
    lives: 20, credits: 250, hp: 0.9, poly: [[-60,100],[1450,100],[1450,280],[150,280],[150,460],[1450,460],[1450,640],[150,640],[150,820],[1000,820]], pr: 90,
    obs: [[800,370,30,'h'],[500,550,30,'c'],[1100,550,30,'h'],[800,190,26,'c']] },
  { id: 'tangle', name: 'Tangle', tag: 'Chaos', blurb: 'Three crossings and a core buried in the middle. Towers at the junctions see everything.',
    lives: 16, credits: 300, hp: 1.1, poly: [[-60,110],[1050,110],[1050,770],[250,770],[250,330],[1400,330],[1400,630],[600,630],[600,220]], pr: 75,
    obs: [[1300,200,36,'h'],[700,470,34,'c'],[120,600,38,'h'],[1450,780,40,'c'],[800,230,28,'h']] },
  { id: 'pentagram', name: 'Pentagram', tag: 'Star', blurb: 'Five razor points drawn in one stroke. Sharp 36° turns and a core at the centre.',
    lives: 18, credits: 280, hp: 1.05, poly: [[-60,333],[1161,333],[577,757],[800,70],[1023,757],[800,450]], pr: 40,
    obs: [[150,160,40,'h'],[1450,160,40,'c'],[150,780,40,'c'],[1450,780,40,'h'],[800,600,28,'h']] },
  { id: 'lightning', name: 'Lightning', tag: 'Diagonal', blurb: 'Steep diagonal strikes top to bottom. Nothing runs at a right angle.',
    lives: 20, credits: 260, hp: 1, poly: [[-60,60],[500,840],[800,60],[1100,840],[1400,60],[1250,450]], pr: 55,
    obs: [[700,800,36,'h'],[1250,800,36,'c'],[100,700,38,'c'],[1500,600,38,'h']] },
  { id: 'prism', name: 'Prism', tag: 'Spiral', blurb: 'A diamond spiral wound toward the centre. Every lane is slanted.',
    lives: 20, credits: 270, hp: 0.95, poly: [[-60,450],[800,30],[1540,450],[800,870],[260,450],[800,170],[1280,450],[800,730],[460,450],[800,330],[1030,450],[800,450]], pr: 50,
    obs: [[120,120,40,'h'],[1480,100,38,'c'],[120,800,38,'c'],[1480,800,40,'h']] }
];

function polyPath(w, r) {
  const out = [{ x: w[0][0], y: w[0][1] }], push = (x, y) => out.push({ x, y });
  for (let i = 1; i < w.length - 1; i++) {
    const a = w[i - 1], b = w[i], c = w[i + 1];
    let ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy); ux /= lu; uy /= lu; vx /= lv; vy /= lv;
    const phi = Math.acos(clamp(ux * vx + uy * vy, -1, 1));
    let t = r / Math.tan(phi / 2); t = Math.min(t, lu / 2, lv / 2);
    const rr = t * Math.tan(phi / 2);
    let bx = ux + vx, by = uy + vy; const bl = Math.hypot(bx, by); bx /= bl; by /= bl;
    const d = rr / Math.sin(phi / 2), cx = b[0] + bx * d, cy = b[1] + by * d;
    const t1x = b[0] + ux * t, t1y = b[1] + uy * t, t2x = b[0] + vx * t, t2y = b[1] + vy * t;
    const a1 = Math.atan2(t1y - cy, t1x - cx), a2 = Math.atan2(t2y - cy, t2x - cx);
    let da = a2 - a1; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    const n = Math.max(3, Math.ceil(Math.abs(da) * rr / 5));
    push(t1x, t1y);
    for (let k = 1; k < n; k++) push(cx + rr * Math.cos(a1 + da * k / n), cy + rr * Math.sin(a1 + da * k / n));
    push(t2x, t2y);
  }
  out.push({ x: w[w.length - 1][0], y: w[w.length - 1][1] });
  return out;
}

function turtle(s, cmds) {
  let x = s[0], y = s[1], h = s[2] * Math.PI / 180;
  const pts = [{ x, y }];
  for (const c of cmds) {
    if (c[0] === 'f') {
      const n = Math.max(1, Math.ceil(c[1] / 6)), dx = Math.cos(h), dy = Math.sin(h);
      for (let i = 1; i <= n; i++) pts.push({ x: x + dx * c[1] * i / n, y: y + dy * c[1] * i / n });
      x += dx * c[1]; y += dy * c[1];
    } else {
      const sg = c[1] > 0 ? 1 : -1, a = Math.abs(c[1]) * Math.PI / 180, r = c[2];
      const cx = x + r * Math.cos(h + sg * Math.PI / 2), cy = y + r * Math.sin(h + sg * Math.PI / 2);
      const st = Math.atan2(y - cy, x - cx), n = Math.max(2, Math.ceil(a * r / 6));
      for (let i = 1; i <= n; i++) { const an = st + sg * a * i / n; pts.push({ x: cx + r * Math.cos(an), y: cy + r * Math.sin(an) }); }
      h += sg * a; x = pts[pts.length - 1].x; y = pts[pts.length - 1].y;
    }
  }
  return pts;
}
function resample(dense, sp) {
  const out = [dense[0]]; let need = sp;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i], sl = Math.hypot(b.x - a.x, b.y - a.y);
    let pos = 0;
    while (sl - pos >= need) { pos += need; const t = pos / sl; out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); need = sp; }
    need -= (sl - pos);
  }
  return out;
}
function buildMap(m) {
  const dense = m.poly ? polyPath(m.poly, m.pr) : turtle(m.start, m.cmds);
  if (m.rev) { dense.reverse(); while (dense.length > 2) { const q = dense[dense.length - 1]; if (q.x < 90 || q.x > W - 90 || q.y < 90 || q.y > H - 90) dense.pop(); else break; } }
  const pts = resample(dense, SP), n = pts.length;
  const ang = pts.map((p, i) => { const a = pts[Math.max(0, i - 4)], b = pts[Math.min(n - 1, i + 4)]; return Math.atan2(b.y - a.y, b.x - a.x); });
  const near = []; for (let i = 0; i < n; i += 2) near.push(pts[i]);
  let entry = 0; while (entry < n - 1 && (pts[entry].x < 0 || pts[entry].x > W || pts[entry].y < 0 || pts[entry].y > H)) entry++;
  return { m, pts, ang, near, len: (n - 1) * SP, core: pts[n - 1], entry, entryAng: ang[entry] };
}
function pathAt(P, d) {
  const f = clamp(d / SP, 0, P.pts.length - 1.001), i = Math.floor(f), t = f - i, a = P.pts[i], b = P.pts[i + 1];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: P.ang[i] };
}
function pathDist(P, x, y) {
  let best = 1e12; const q = P.near;
  for (let i = 0; i < q.length; i++) { const dx = q[i].x - x, dy = q[i].y - y, d = dx * dx + dy * dy; if (d < best) best = d; }
  return Math.sqrt(best);
}

/* ---------- unit definitions ---------- */
const TOWERS = {
  pulse:  { name: 'Pulse',  key: '1', cost: 60,  color: C.pulse,  r: 14, sub: 'Rapid single target',
    lv: [ { dmg: 6, rate: 3.5, range: 175 }, { up: 55, dmg: 9, rate: 4.2, range: 190 }, { up: 100, dmg: 14, rate: 5, range: 205 }, { up: 170, dmg: 21, rate: 5.8, range: 222 }, { up: 280, dmg: 32, rate: 6.8, range: 240 } ] },
  rail:   { name: 'Rail',   key: '2', cost: 150, color: C.rail,   r: 15, sub: 'Piercing beam, long range',
    lv: [ { dmg: 42, rate: 0.55, range: 290 }, { up: 110, dmg: 80, rate: 0.65, range: 320 }, { up: 190, dmg: 150, rate: 0.75, range: 355 }, { up: 300, dmg: 260, rate: 0.85, range: 390 }, { up: 470, dmg: 430, rate: 0.95, range: 430 } ] },
  arc:    { name: 'Arc',    key: '3', cost: 110, color: C.arc,    r: 14, sub: 'Chain lightning',
    lv: [ { dmg: 13, rate: 1.3, range: 160, chain: 3 }, { up: 85, dmg: 19, rate: 1.5, range: 175, chain: 4 }, { up: 150, dmg: 28, rate: 1.8, range: 190, chain: 6 }, { up: 240, dmg: 40, rate: 2.0, range: 205, chain: 7 }, { up: 380, dmg: 58, rate: 2.3, range: 222, chain: 9 } ] },
  mortar: { name: 'Mortar', key: '4', cost: 130, color: C.mortar, r: 15, sub: 'Area splash damage',
    lv: [ { dmg: 30, rate: 0.6, range: 260, splash: 58 }, { up: 100, dmg: 48, rate: 0.7, range: 285, splash: 66 }, { up: 170, dmg: 80, rate: 0.8, range: 315, splash: 76 }, { up: 270, dmg: 125, rate: 0.9, range: 345, splash: 86 }, { up: 420, dmg: 190, rate: 1.0, range: 375, splash: 98 } ] },
  stasis: { name: 'Stasis', key: '5', cost: 85,  color: C.stasis, r: 14, sub: 'Slows, burns through armor',
    lv: [ { slow: 0.30, dps: 0, range: 135 }, { up: 70, slow: 0.40, dps: 7, range: 152 }, { up: 120, slow: 0.52, dps: 16, range: 172 }, { up: 200, slow: 0.60, dps: 28, range: 192 }, { up: 320, slow: 0.68, dps: 44, range: 214 } ] },
  lance:  { name: 'Lance',  key: '6', cost: 140, color: C.lance,  r: 14, sub: 'Beam that ramps up on one target',
    lv: [ { dps: 16, ramp: 2.2, range: 175 }, { up: 100, dps: 24, ramp: 2.4, range: 190 }, { up: 170, dps: 34, ramp: 2.6, range: 205 }, { up: 270, dps: 48, ramp: 2.8, range: 220 }, { up: 420, dps: 68, ramp: 3.2, range: 240 } ] },
  amp:    { name: 'Amp',    key: '7', cost: 100, color: C.amp,    r: 14, sub: 'Boosts damage of nearby towers',
    lv: [ { boost: 0.12, range: 130 }, { up: 80, boost: 0.18, range: 150 }, { up: 140, boost: 0.25, range: 170 }, { up: 230, boost: 0.33, range: 190 }, { up: 360, boost: 0.42, range: 215 } ] }
};
const TKEYS = Object.keys(TOWERS);
const ENEMIES = {
  drone:  { hp: 20,   speed: 62,  armor: 0, r: 8,  reward: 4,   dmg: 1 },
  runner: { hp: 14,   speed: 108, armor: 0, r: 8,  reward: 4,   dmg: 1 },
  block:  { hp: 70,   speed: 48,  armor: 1, r: 11, reward: 7,   dmg: 2 },
  split:  { hp: 80,   speed: 50,  armor: 0, r: 11, reward: 9,   dmg: 2 },
  hex:    { hp: 220,  speed: 36,  armor: 3, r: 14, reward: 14,  dmg: 3 },
  boss:   { hp: 2200, speed: 26,  armor: 5, r: 22, reward: 120, dmg: 8 }
};
const hpMul = n => Math.pow(1.11, n - 1);
function waveDef(n) {
  const g = [], add = (type, count, iv) => { if (count > 0) g.push({ type, count, iv }); };
  add('drone', 6 + Math.floor(n * 2), Math.max(0.22, 0.55 - 0.01 * n));
  if (n >= 2) add('runner', Math.floor(n * 1.3), 0.4);
  if (n >= 3) add('block', Math.floor((n - 1) * 1.1), 0.8);
  if (n >= 5) add('split', Math.floor((n - 3) * 0.8), 0.9);
  if (n >= 6) add('hex', Math.floor((n - 5) * 0.7), 1.1);
  if (n % 8 === 0) add('boss', n / 8, 3.5);
  return g;
}
function waveQueue(n) {
  const q = []; let start = 0;
  for (const g of waveDef(n)) {
    for (let i = 0; i < g.count; i++) q.push({ t: start + i * g.iv, type: g.type });
    start += g.count * g.iv * 0.4 + 0.8;
  }
  q.sort((a, b) => a.t - b.t);
  return q;
}
/* ---------- game state & simulation ---------- */
const DIFFS = [
  { name: 'Normal', hp: 1.0, rew: 1.0, lives: 1.0, cred: 1.0 },
  { name: 'Hard', hp: 1.5, rew: 0.8, lives: 0.75, cred: 0.8 },
  { name: 'Brutal', hp: 2.2, rew: 0.65, lives: 0.5, cred: 0.7 }
];
const MODES = ['first', 'last', 'strong', 'close'];
const MODE_LABEL = { first: 'First', last: 'Last', strong: 'Strongest', close: 'Closest' };
const G = { state: 'menu', diff: 1, mapIdx: 0, mapDef: MAPS[0], credits: 0, lives: 0, maxLives: 20, wave: 0, cleared: 0, score: 0, kills: 0,
  towers: [], enemies: [], proj: [], fx: [], spawns: [], active: false, speed: 1, paused: false, selected: null, build: null,
  shake: 0, coreFlash: 0, time: 0, auto: false, autoT: 0, best: {}, ghost: null };
const pathCache = {};
let P = null;
try { G.best = JSON.parse(localStorage.getItem('opencircuit.best') || '{}') || {}; const dv = parseInt(localStorage.getItem('opencircuit.diff'), 10); if (dv >= 0 && dv < 3) G.diff = dv; } catch (e) { G.best = {}; }

function setMap(i) {
  G.mapIdx = i; G.mapDef = MAPS[i];
  P = pathCache[i] || (pathCache[i] = buildMap(MAPS[i]));
}
function newGame(i) {
  setMap(i);
  const m = MAPS[i];
  const df = DIFFS[G.diff], lv = Math.max(3, Math.round(m.lives * df.lives));
  Object.assign(G, { state: 'play', credits: Math.round(m.credits * df.cred), lives: lv, maxLives: lv, wave: 0, cleared: 0, score: 0, kills: 0,
    towers: [], enemies: [], proj: [], fx: [], spawns: [], active: false, paused: false, selected: null, build: null,
    shake: 0, coreFlash: 0, time: 0, autoT: 0, ghost: null });
}
const st = t => TOWERS[t.type].lv[t.lvl];

/* ---------- effects ---------- */
function addFx(o) { if (G.fx.length < 900) G.fx.push(o); return o; }
function sparks(x, y, col, n, spd, life, len) {
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), s = rnd(spd * 0.4, spd); addFx({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(life * 0.6, life), max: life, col, len: len || 0.04 }); }
}
function ring(x, y, r0, r1, life, col, w) { addFx({ k: 'ring', x, y, r0, r1, life, max: life, col, w: w || 1.5 }); }
function floatText(x, y, txt, col) { addFx({ k: 'text', x, y, txt, life: 0.9, max: 0.9, col: col || C.dim }); }

/* ---------- enemies ---------- */
function spawnEnemy(type, d, hpScale) {
  const b = ENEMIES[type], n = Math.max(1, G.wave);
  const df = DIFFS[G.diff], hp = b.hp * hpMul(n) * G.mapDef.hp * df.hp * (hpScale || 1);
  const e = { type, hp, max: hp, d: d || 0, spd: b.speed * Math.min(1.5, 1 + 0.01 * (n - 1)), armor: b.armor * (1 + 0.07 * (n - 1)), r: b.r,
    reward: Math.max(1, Math.round(b.reward * (1 + 0.015 * (n - 1)) * df.rew)), dmg: b.dmg, slow: 0, flash: 0, dead: false, x: 0, y: 0, a: 0, rot: rnd(0, TAU), born: G.time };
  const p = pathAt(P, e.d); e.x = p.x; e.y = p.y; e.a = p.a;
  G.enemies.push(e);
  return e;
}
function hurt(e, dmg, src, pierce, quiet) {
  if (e.dead) return;
  const af = pierce === true ? 0 : typeof pierce === 'number' ? pierce : 1, d = Math.max(dmg - e.armor * af, dmg * 0.25);
  e.hp -= d;
  if (!quiet) e.flash = 1;
  if (e.hp <= 0) killEnemy(e, src);
}
function killEnemy(e, src) {
  if (e.dead) return;
  e.dead = true;
  G.credits += e.reward; G.score += e.reward * 10; G.kills++;
  if (src) src.kills++;
  const big = e.r > 12;
  for (let i = 0; i < (big ? 12 : 6); i++) {
    const a = rnd(0, TAU), s = rnd(40, big ? 150 : 110);
    addFx({ k: 'shard', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd(0, TAU), vr: rnd(-8, 8), len: rnd(3, big ? 10 : 7), life: rnd(0.35, 0.7), max: 0.7, col: C.bot });
  }
  ring(e.x, e.y, e.r * 0.6, e.r * 2.2, 0.35, C.bot, 1);
  floatText(e.x, e.y - e.r - 4, '+' + e.reward, C.dim);
  sfx(big ? 'boom' : 'kill');
  if (e.type === 'split') { for (let i = 0; i < 2; i++) spawnEnemy('drone', Math.max(0, e.d + (i ? 9 : -9)), 0.7); }
  if (e.type === 'boss') { G.shake = Math.max(G.shake, 0.5); ring(e.x, e.y, 10, 90, 0.7, C.bot, 2); }
}

/* ---------- towers ---------- */
function pickTarget(t, range) {
  let best = null, bv = 0;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = dist(t.x, t.y, e.x, e.y);
    if (d > range + e.r) continue;
    const v = t.mode === 'first' ? e.d : t.mode === 'last' ? -e.d : t.mode === 'strong' ? e.hp : -d;
    if (best === null || v > bv) { best = e; bv = v; }
  }
  return best;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const u = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
}
function fireTower(t, e, s) {
  const bm = t.buff || 1;
  const dx = e.x - t.x, dy = e.y - t.y, a = Math.atan2(dy, dx), col = TOWERS[t.type].color;
  const mx = t.x + Math.cos(a) * (t.r + 6), my = t.y + Math.sin(a) * (t.r + 6);
  t.flash = 1;
  if (t.type === 'pulse') {
    G.proj.push({ kind: 'bolt', x: mx, y: my, px: mx, py: my, tgt: e, spd: 600, dmg: s.dmg * bm, src: t, col });
    t.recoil = 3; addFx({ k: 'glow', x: mx, y: my, r: 14, life: 0.1, max: 0.1, col }); sfx('pulse');
  } else if (t.type === 'rail') {
    const ex = t.x + Math.cos(a) * s.range, ey = t.y + Math.sin(a) * s.range;
    for (const o of G.enemies) if (!o.dead && segDist(o.x, o.y, t.x, t.y, ex, ey) < o.r + 5) { hurt(o, s.dmg * bm, t); sparks(o.x, o.y, col, 5, 140, 0.3); }
    addFx({ k: 'beam', x1: mx, y1: my, x2: ex, y2: ey, life: 0.26, max: 0.26, col, w: 3 });
    ring(mx, my, 4, 22, 0.25, col, 1.5); t.recoil = 6; sfx('rail');
  } else if (t.type === 'arc') {
    const hit = [e], pts = [{ x: mx, y: my }, { x: e.x, y: e.y }];
    let cur = e, dmg = s.dmg * bm;
    hurt(e, dmg, t);
    for (let j = 1; j < s.chain; j++) {
      let nx = null, nd = 95;
      for (const o of G.enemies) { if (o.dead || hit.includes(o)) continue; const d = dist(cur.x, cur.y, o.x, o.y); if (d < nd) { nd = d; nx = o; } }
      if (!nx) break;
      dmg *= 0.85; hit.push(nx); pts.push({ x: nx.x, y: nx.y }); hurt(nx, dmg, t); cur = nx;
    }
    addFx({ k: 'bolt', pts, life: 0.16, max: 0.16, col });
    for (const o of hit) sparks(o.x, o.y, col, 3, 90, 0.25);
    sfx('arc');
  } else if (t.type === 'mortar') {
    const dd = dist(t.x, t.y, e.x, e.y), T = Math.max(0.6, dd / 300);
    const f = pathAt(P, Math.min(P.len, e.d + e.spd * (1 - e.slow) * T));
    G.proj.push({ kind: 'shell', sx: mx, sy: my, tx: f.x, ty: f.y, x: mx, y: my, t: 0, T, h: 0, dmg: s.dmg * bm, splash: s.splash, src: t, col });
    t.recoil = 5; sparks(mx, my, col, 4, 60, 0.3); sfx('mortar');
  }
}
function blast(x, y, splash, dmg, src, col) {
  for (const o of G.enemies) {
    if (o.dead) continue;
    const d = dist(x, y, o.x, o.y);
    if (d < splash + o.r) hurt(o, dmg * (1 - 0.5 * clamp(d / splash, 0, 1)), src);
  }
  ring(x, y, 4, splash, 0.4, col, 2); ring(x, y, 2, splash * 0.6, 0.28, C.fg, 1);
  addFx({ k: 'glow', x, y, r: splash, life: 0.22, max: 0.22, col });
  sparks(x, y, col, 12, 170, 0.5); G.shake = Math.max(G.shake, 0.12); sfx('thud');
}

/* ---------- placement & economy ---------- */
function placeReason(x, y, r) {
  if (x < r + 16 || x > W - r - 16 || y < r + 16 || y > H - r - 16) return 'OUT OF BOUNDS';
  if (pathDist(P, x, y) < HALF + r + 5) return 'ON THE TRACE';
  if (dist(x, y, P.core.x, P.core.y) < 34 + r + 12) return 'TOO CLOSE TO CORE';
  for (const o of P.m.obs) if (dist(x, y, o[0], o[1]) < o[2] + r + 4) return 'BLOCKED';
  for (const t of G.towers) if (dist(x, y, t.x, t.y) < t.r + r + 4) return 'OVERLAP';
  return null;
}
function placeTower(type, x, y) {
  const d = TOWERS[type];
  if (placeReason(x, y, d.r) || G.credits < d.cost) return false;
  G.credits -= d.cost;
  const t = { type, x, y, r: d.r, lvl: 0, cd: 0.3, ang: -Math.PI / 2, recoil: 0, flash: 0, mode: 'first', spent: d.cost, kills: 0, born: G.time, buff: 1, heat: 0, tick: 0, lock: null, beam: null };
  G.towers.push(t);
  ring(x, y, d.r, d.r + 26, 0.4, d.color, 1.5); sparks(x, y, d.color, 8, 90, 0.4); sfx('place');
  return t;
}
function upgradeCost(t) { const n = TOWERS[t.type].lv[t.lvl + 1]; return n ? n.up : null; }
function upgradeTower(t) {
  const c = upgradeCost(t);
  if (c === null || G.credits < c) return false;
  G.credits -= c; t.spent += c; t.lvl++;
  const col = TOWERS[t.type].color;
  ring(t.x, t.y, t.r, t.r + 34, 0.5, col, 2); sparks(t.x, t.y, col, 14, 130, 0.5); sfx('up');
  return true;
}
function sellValue(t) { return Math.floor(t.spent * 0.6); }
function sellTower(t) {
  G.credits += sellValue(t);
  ring(t.x, t.y, t.r, t.r + 20, 0.35, C.dim, 1);
  floatText(t.x, t.y - 20, '+' + sellValue(t), C.good);
  G.towers.splice(G.towers.indexOf(t), 1);
  if (G.selected === t) G.selected = null;
  sfx('sell');
}

/* ---------- waves ---------- */
function sendWave() {
  if (G.state !== 'play') return;
  G.wave++; G.active = true; G.autoT = 0;
  const q = waveQueue(G.wave).map(s => ({ at: G.time + 0.4 + s.t, type: s.type }));
  G.spawns = G.spawns.concat(q).sort((a, b) => a.at - b.at);
  sfx('wave');
}
function gameOver() {
  G.state = 'over'; G.build = null; G.selected = null;
  const id = G.mapDef.id + '.' + G.diff;
  if ((G.best[id] || 0) < G.cleared) { G.best[id] = G.cleared; try { localStorage.setItem('opencircuit.best', JSON.stringify(G.best)); } catch (e) {} }
  sfx('over');
}

/* ---------- step ---------- */
function update(dt) {
  G.time += dt;
  while (G.spawns.length && G.spawns[0].at <= G.time) spawnEnemy(G.spawns.shift().type, 0);

  for (const t of G.towers) t.buff = 1;
  for (const a of G.towers) {
    if (a.type !== 'amp') continue;
    const as = st(a);
    for (const t of G.towers) if (t !== a && t.type !== 'amp' && dist(a.x, a.y, t.x, t.y) <= as.range + t.r) t.buff *= 1 + as.boost;
  }
  for (const e of G.enemies) e.slow = 0;
  for (const t of G.towers) {
    if (t.type !== 'stasis') continue;
    const s = st(t);
    for (const e of G.enemies) {
      if (e.dead || dist(t.x, t.y, e.x, e.y) > s.range + e.r) continue;
      if (s.slow > e.slow) e.slow = s.slow;
      if (s.dps) hurt(e, s.dps * dt * t.buff, t, true, true);
    }
  }
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.d += e.spd * (e.type === 'boss' ? 0.9 : 1) * (1 - e.slow) * dt;
    e.flash = Math.max(0, e.flash - dt * 6); e.rot += dt * (e.type === 'hex' ? 1.2 : 2);
    const p = pathAt(P, e.d); e.x = p.x; e.y = p.y; e.a = p.a;
    if (e.d >= P.len) {
      e.dead = true; G.lives -= e.dmg; G.coreFlash = 1; G.shake = Math.max(G.shake, 0.45);
      ring(P.core.x, P.core.y, 30, 80, 0.5, C.bot, 2); sparks(P.core.x, P.core.y, C.bot, 10, 140, 0.5); sfx('leak');
      if (G.lives <= 0) { G.lives = 0; gameOver(); return; }
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);

  for (const t of G.towers) {
    t.recoil = Math.max(0, t.recoil - dt * 22); t.flash = Math.max(0, t.flash - dt * 7);
    if (t.type === 'stasis' || t.type === 'amp') continue;
    const s = st(t);
    if (t.type === 'lance') {
      const e = pickTarget(t, s.range);
      if (e) {
        const want = Math.atan2(e.y - t.y, e.x - t.x);
        let df = want - t.ang; df = Math.atan2(Math.sin(df), Math.cos(df)); t.ang += clamp(df, -14 * dt, 14 * dt);
        if (t.lock !== e) { t.lock = e; t.heat = 0; }
        t.heat = Math.min(3, t.heat + dt); t.beam = e; t.tick -= dt;
        if (t.tick <= 0) { t.tick += 0.25; hurt(e, s.dps * 0.25 * (1 + (s.ramp - 1) * t.heat / 3) * t.buff, t, 0.5); sfx('lance'); }
        if (Math.random() < dt * 18) sparks(e.x, e.y, TOWERS.lance.color, 1, 80, 0.22);
      } else { t.beam = null; t.lock = null; t.heat = Math.max(0, t.heat - dt * 2); }
      continue;
    }
    t.cd -= dt;
    const e = pickTarget(t, s.range);
    if (e) {
      const want = Math.atan2(e.y - t.y, e.x - t.x);
      let df = want - t.ang; df = Math.atan2(Math.sin(df), Math.cos(df));
      t.ang += clamp(df, -14 * dt, 14 * dt);
      if (t.cd <= 0 && Math.abs(df) < 0.5) { fireTower(t, e, s); t.cd = 1 / s.rate; }
    }
  }

  for (const p of G.proj) {
    if (p.kind === 'bolt') {
      if (p.tgt.dead) { p.done = true; continue; }
      p.px = p.x; p.py = p.y;
      const dx = p.tgt.x - p.x, dy = p.tgt.y - p.y, d = Math.hypot(dx, dy), step = p.spd * dt;
      if (d <= step + p.tgt.r) { hurt(p.tgt, p.dmg, p.src); sparks(p.x, p.y, p.col, 3, 90, 0.2); p.done = true; }
      else { p.x += dx / d * step; p.y += dy / d * step; }
    } else {
      p.t += dt; const u = Math.min(1, p.t / p.T);
      p.x = lerp(p.sx, p.tx, u); p.y = lerp(p.sy, p.ty, u); p.h = 4 * u * (1 - u) * 70;
      if (u >= 1) { blast(p.tx, p.ty, p.splash, p.dmg, p.src, p.col); p.done = true; }
    }
  }
  G.proj = G.proj.filter(p => !p.done);

  for (const f of G.fx) {
    f.life -= dt;
    if (f.k === 'spark' || f.k === 'shard') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.94; f.vy *= 0.94; if (f.k === 'shard') f.rot += f.vr * dt; }
    else if (f.k === 'text') f.y -= 16 * dt;
  }
  G.fx = G.fx.filter(f => f.life > 0);

  G.shake = Math.max(0, G.shake - dt * 2.2); G.coreFlash = Math.max(0, G.coreFlash - dt * 2);

  if (G.active && !G.spawns.length && !G.enemies.length) {
    G.active = false; G.cleared = G.wave;
    const bonus = Math.round((15 + 2 * G.wave) * DIFFS[G.diff].rew); G.credits += bonus; G.score += bonus * 5;
    floatText(P.core.x, P.core.y - 46, '+' + bonus + ' wave clear', C.good); sfx('clear');
    if (G.auto) G.autoT = 3.5;
  }
  if (G.autoT > 0) { G.autoT -= dt; if (G.autoT <= 0) sendWave(); }
}
/* ---------- rendering ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
const V = { s: 1, ox: 0, oy: 0, dpr: 1, w: 800, h: 450 };
let SC = null;
const glowCache = {};
function glowSprite(col) {
  if (glowCache[col]) return glowCache[col];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.35, rgba(col, 0.32)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (glowCache[col] = c);
}
function glow(c, x, y, r, col, a) { c.globalAlpha = a; c.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }
function poly(c, x, y, r, n, rot) {
  c.beginPath();
  for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath();
}
function seeded(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

function resize() {
  const r = $('stage').getBoundingClientRect();
  V.dpr = Math.min(2, window.devicePixelRatio || 1);
  V.w = Math.max(200, r.width); V.h = Math.max(120, r.height);
  cv.width = Math.round(V.w * V.dpr); cv.height = Math.round(V.h * V.dpr);
  V.s = Math.min(V.w / W, V.h / H);
  V.ox = (V.w - W * V.s) / 2; V.oy = (V.h - H * V.s) / 2;
  if (P) buildStatic();
}
function toWorld(ev) {
  const r = cv.getBoundingClientRect();
  return { x: (ev.clientX - r.left - V.ox) / V.s, y: (ev.clientY - r.top - V.oy) / V.s };
}

function buildStatic() {
  const k = V.s * V.dpr;
  SC = document.createElement('canvas'); SC.width = Math.ceil(W * k); SC.height = Math.ceil(H * k);
  const c = SC.getContext('2d'); c.scale(k, k);
  const rand = seeded(7 + G.mapIdx * 31);
  c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
  let g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 900);
  g.addColorStop(0, rgba(C.stasis, 0.05)); g.addColorStop(1, rgba(C.stasis, 0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // contour rings around the core, no grid
  c.strokeStyle = rgba(C.line, 0.7); c.lineWidth = 1;
  [110, 190, 290, 410, 550, 710].forEach((r, i) => { c.setLineDash(i % 2 ? [2, 9] : [14, 10]); c.globalAlpha = 0.55 - i * 0.05; c.beginPath(); c.arc(P.core.x, P.core.y, r, 0, TAU); c.stroke(); });
  c.setLineDash([]); c.globalAlpha = 1;
  for (let i = 0; i < 170; i++) { c.fillStyle = rgba(C.dim, rand() * 0.18 + 0.03); const s = rand() < 0.1 ? 1.6 : 1; c.fillRect(rand() * W, rand() * H, s, s); }
  // corner brackets
  c.strokeStyle = C.line2; c.lineWidth = 1.5;
  [[10, 10, 1, 1], [W - 10, 10, -1, 1], [10, H - 10, 1, -1], [W - 10, H - 10, -1, -1]].forEach(b => { c.beginPath(); c.moveTo(b[0] + 22 * b[2], b[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0], b[1] + 22 * b[3]); c.stroke(); });
  // trace
  const p2 = new Path2D(); P.near.forEach((p, i) => i ? p2.lineTo(p.x, p.y) : p2.moveTo(p.x, p.y)); P.p2 = p2;
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = rgba(C.stasis, 0.04); c.lineWidth = HALF * 2 + 16; c.stroke(p2);
  c.strokeStyle = rgba(C.line2, 0.85); c.lineWidth = HALF * 2 + 2; c.stroke(p2);
  c.strokeStyle = '#070a10'; c.lineWidth = HALF * 2; c.stroke(p2);
  c.strokeStyle = rgba(C.line2, 0.2); c.lineWidth = 1;
  for (let i = 8; i < P.pts.length - 8; i += 16) {
    const p = P.pts[i], a = P.ang[i] + Math.PI / 2, nx = Math.cos(a), ny = Math.sin(a);
    c.beginPath(); c.moveTo(p.x + nx * (HALF - 1), p.y + ny * (HALF - 1)); c.lineTo(p.x + nx * (HALF - 7), p.y + ny * (HALF - 7));
    c.moveTo(p.x - nx * (HALF - 1), p.y - ny * (HALF - 1)); c.lineTo(p.x - nx * (HALF - 7), p.y - ny * (HALF - 7)); c.stroke();
  }
  c.setLineDash([1, 9]); c.strokeStyle = rgba(C.line2, 0.9); c.lineWidth = 1.2; c.stroke(p2); c.setLineDash([]);
  // voids
  for (const o of P.m.obs) {
    const x = o[0], y = o[1], r = o[2], hex = o[3] === 'h', shape = () => hex ? poly(c, x, y, r, 6, Math.PI / 6) : (c.beginPath(), c.arc(x, y, r, 0, TAU));
    shape(); c.fillStyle = rgba(C.line, 0.28); c.fill();
    c.save(); shape(); c.clip(); c.strokeStyle = rgba(C.line2, 0.34); c.lineWidth = 1;
    for (let d = -r * 2; d < r * 2; d += 9) { c.beginPath(); c.moveTo(x + d - r, y + r); c.lineTo(x + d + r, y - r); c.stroke(); }
    c.restore();
    shape(); c.strokeStyle = C.line2; c.lineWidth = 1.4; c.stroke();
    c.setLineDash([2, 6]); c.strokeStyle = rgba(C.line2, 0.7);
    hex ? poly(c, x, y, r + 6, 6, Math.PI / 6) : (c.beginPath(), c.arc(x, y, r + 6, 0, TAU)); c.stroke(); c.setLineDash([]);
  }
}

/* ---------- entities ---------- */
function drawTower(c, t, now, alpha) {
  const d = TOWERS[t.type], col = d.color, r = t.r;
  c.save(); c.translate(t.x, t.y); c.globalAlpha = alpha == null ? 1 : alpha;
  c.fillStyle = '#0b111b'; c.strokeStyle = rgba(col, 0.9); c.lineWidth = 1.6;
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = rgba(col, 0.22); c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r - 4, 0, TAU); c.stroke();
  const fl = t.flash || 0;
  if (t.type === 'arc') {
    const sp = now * (1.6 + fl * 6);
    poly(c, 0, 0, 6, 6, sp * 0.3); c.fillStyle = rgba(col, 0.25 + fl * 0.5); c.fill(); c.strokeStyle = col; c.lineWidth = 1.3; c.stroke();
    for (let i = 0; i < 3; i++) { const a = sp + i * TAU / 3, x = Math.cos(a) * (r - 3.5), y = Math.sin(a) * (r - 3.5);
      c.strokeStyle = rgba(col, 0.3); c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(x, y); c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(x, y, 1.9, 0, TAU); c.fill(); }
  } else if (t.type === 'stasis') {
    const sp = now * 0.8;
    c.strokeStyle = col; c.lineWidth = 1.3;
    for (let i = 0; i < 6; i++) { const a = sp + i * TAU / 6; c.beginPath(); c.moveTo(Math.cos(a) * (r - 7), Math.sin(a) * (r - 7)); c.lineTo(Math.cos(a) * (r - 2.5), Math.sin(a) * (r - 2.5)); c.stroke(); }
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 2.8, 0, TAU); c.fill();
    c.strokeStyle = rgba(col, 0.5); c.beginPath(); c.arc(0, 0, 5 + Math.sin(now * 2.2) * 1.2, 0, TAU); c.stroke();
  } else if (t.type === 'amp') {
    const sp = now * 0.5; c.rotate(sp); c.strokeStyle = col; c.lineWidth = 1.7; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.beginPath(); c.moveTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8)); c.lineTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3)); c.stroke(); }
    c.rotate(-sp * 2); c.fillStyle = rgba(col, 0.9); c.fillRect(-3, -3, 6, 6); c.fillStyle = '#0b111b'; c.fillRect(-1.2, -1.2, 2.4, 2.4);
  } else {
    c.rotate(t.ang || 0);
    const rb = t.recoil || 0;
    if (t.type === 'pulse') {
      c.strokeStyle = col; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(3 - rb, 0); c.lineTo(r + 2 - rb, 0); c.stroke();
      c.fillStyle = rgba(col, 0.92); c.beginPath(); c.moveTo(6, 0); c.lineTo(-5, -6); c.lineTo(-2, 0); c.lineTo(-5, 6); c.closePath(); c.fill();
    } else if (t.type === 'rail') {
      const s = d.lv[t.lvl || 0], ch = t.cd == null ? 1 : clamp(1 - t.cd * s.rate, 0, 1);
      c.strokeStyle = col; c.lineWidth = 1.7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3 - rb, -3); c.lineTo(r + 8 - rb, -3); c.moveTo(-3 - rb, 3); c.lineTo(r + 8 - rb, 3); c.stroke();
      c.fillStyle = rgba(col, 0.88); c.fillRect(-7, -5.5, 11, 11);
      c.fillStyle = '#0b111b'; c.fillRect(-4.5, -3, 6, 6);
      c.fillStyle = rgba(col, 0.3 + 0.7 * ch); c.beginPath(); c.arc(r + 5 - rb, 0, 1.6 + ch * 1.2, 0, TAU); c.fill();
    } else if (t.type === 'mortar') {
      c.fillStyle = '#0b111b'; c.strokeStyle = col; c.lineWidth = 2;
      c.beginPath(); c.rect(-1 - rb, -3.8, r + 3, 7.6); c.fill(); c.stroke();
      c.fillStyle = rgba(col, 0.9); c.beginPath(); c.arc(-1, 0, 5.4, 0, TAU); c.fill();
      c.fillStyle = '#0b111b'; c.beginPath(); c.arc(-1, 0, 2, 0, TAU); c.fill();
    } else if (t.type === 'lance') {
      const hh = clamp((t.heat || 0) / 3, 0, 1);
      c.fillStyle = rgba(col, 0.9); c.beginPath(); c.moveTo(r + 3, 0); c.lineTo(0, -4.8); c.lineTo(-6, 0); c.lineTo(0, 4.8); c.closePath(); c.fill();
      c.fillStyle = '#0b111b'; c.beginPath(); c.arc(-1, 0, 1.9, 0, TAU); c.fill();
      c.fillStyle = rgba('#ffffff', 0.4 + 0.6 * hh); c.beginPath(); c.arc(r + 2, 0, 1.2 + hh * 1.6, 0, TAU); c.fill();
    }
  }
  c.restore();
  // level pips
  c.save(); c.translate(t.x, t.y); c.globalAlpha = alpha == null ? 1 : alpha; c.fillStyle = col;
  const L = t.lvl || 0;
  for (let i = 0; i <= L; i++) { c.beginPath(); c.arc((i - L / 2) * 6, r + 7, 1.6, 0, TAU); c.fill(); }
  c.restore();
}

function drawEnemy(c, e, now) {
  const r = e.r, col = C.bot;
  c.save(); c.translate(e.x, e.y);
  c.fillStyle = '#1b0d16'; c.strokeStyle = e.flash > 0.15 ? '#fff' : col; c.lineWidth = 1.7; c.lineJoin = 'round';
  const inner = rgba(col, 0.55);
  if (e.type === 'drone') {
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * 0.32, 0, TAU); c.fill();
  } else if (e.type === 'runner') {
    c.rotate(e.a); c.beginPath(); c.moveTo(r * 1.35, 0); c.lineTo(-r, -r * 0.95); c.lineTo(-r * 0.45, 0); c.lineTo(-r, r * 0.95); c.closePath(); c.fill(); c.stroke();
  } else if (e.type === 'block') {
    c.rotate(e.a); c.beginPath(); c.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7); c.fill(); c.stroke();
    c.strokeStyle = inner; c.lineWidth = 1.2; c.strokeRect(-r * 0.4, -r * 0.4, r * 0.8, r * 0.8);
  } else if (e.type === 'split') {
    c.rotate(e.a); poly(c, 0, 0, r * 1.3, 4, 0); c.fill(); c.stroke();
    c.strokeStyle = inner; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -r * 0.9); c.lineTo(0, r * 0.9); c.stroke();
  } else if (e.type === 'hex') {
    poly(c, 0, 0, r, 6, e.rot * 0.25); c.fill(); c.stroke();
    poly(c, 0, 0, r * 0.52, 6, -e.rot * 0.5); c.strokeStyle = inner; c.lineWidth = 1.3; c.stroke();
  } else {
    poly(c, 0, 0, r, 8, e.rot * 0.1); c.fill(); c.stroke();
    c.strokeStyle = inner; c.lineWidth = 1.3; c.beginPath(); c.arc(0, 0, r * 0.62, 0, TAU); c.stroke();
    for (let i = 0; i < 8; i++) { const a = -e.rot * 0.6 + i * TAU / 8; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); c.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); c.stroke(); }
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill();
  }
  c.restore();
  if (e.slow > 0) { c.save(); c.strokeStyle = rgba(C.stasis, 0.6); c.lineWidth = 1; c.setLineDash([3, 4]); c.lineDashOffset = -now * 12; c.beginPath(); c.arc(e.x, e.y, r + 4, 0, TAU); c.stroke(); c.restore(); }
  if (e.hp < e.max) {
    const w = Math.max(14, r * 2), x = e.x - w / 2, y = e.y - r - 8;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x - 1, y - 1, w + 2, 4);
    c.fillStyle = rgba(col, 0.95); c.fillRect(x, y, w * clamp(e.hp / e.max, 0, 1), 2);
  }
}

function drawCore(c, now) {
  const k = P.core, lives = G.state === 'menu' ? P.m.lives : G.lives, n = G.state === 'menu' ? P.m.lives : G.maxLives;
  c.save(); c.translate(k.x, k.y);
  const ph = (now / 3.2) % 1;
  c.strokeStyle = rgba(C.stasis, (1 - ph) * 0.2); c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 34 + ph * 60, 0, TAU); c.stroke();
  c.fillStyle = '#080c13'; c.beginPath(); c.arc(0, 0, 26, 0, TAU); c.fill();
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * TAU / n, lit = i < lives;
    c.strokeStyle = lit ? (lives <= 5 ? C.bot : C.fg) : C.line2; c.lineWidth = lit ? 2.4 : 1.4;
    c.beginPath(); c.moveTo(Math.cos(a) * 26, Math.sin(a) * 26); c.lineTo(Math.cos(a) * 33, Math.sin(a) * 33); c.stroke();
  }
  poly(c, 0, 0, 15, 6, now * 0.3); c.strokeStyle = C.stasis; c.lineWidth = 1.5; c.stroke();
  poly(c, 0, 0, 7, 6, -now * 0.5); c.fillStyle = rgba(C.stasis, 0.3); c.fill(); c.stroke();
  c.restore();
  if (G.coreFlash > 0) { c.globalCompositeOperation = 'lighter'; glow(c, k.x, k.y, 90, C.bot, G.coreFlash * 0.7); c.globalCompositeOperation = 'source-over'; }
}

function drawGate(c, now) {
  const p = P.pts[P.entry], a = P.entryAng;
  c.save(); c.translate(p.x, p.y); c.rotate(a);
  c.strokeStyle = rgba(C.bot, 0.8); c.lineWidth = 1.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -HALF - 6); c.lineTo(0, HALF + 6); c.stroke();
  c.beginPath(); c.moveTo(0, -HALF - 6); c.lineTo(8, -HALF - 6); c.moveTo(0, HALF + 6); c.lineTo(8, HALF + 6); c.stroke();
  for (let i = 0; i < 3; i++) {
    const ph = (now * 0.7 + i / 3) % 1, x = 6 + ph * 54;
    c.strokeStyle = rgba(C.bot, Math.sin(ph * Math.PI) * 0.6); c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(x - 6, -9); c.lineTo(x, 0); c.lineTo(x - 6, 9); c.stroke();
  }
  c.restore();
}

function drawFx(c, now) {
  for (const f of G.fx) {
    const u = clamp(f.life / f.max, 0, 1);
    if (f.k === 'spark') { c.strokeStyle = rgba(f.col, u); c.lineWidth = 1.4; c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x - f.vx * f.len, f.y - f.vy * f.len); c.stroke(); }
    else if (f.k === 'shard') { c.strokeStyle = rgba(f.col, u); c.lineWidth = 1.5; const dx = Math.cos(f.rot) * f.len, dy = Math.sin(f.rot) * f.len; c.beginPath(); c.moveTo(f.x - dx, f.y - dy); c.lineTo(f.x + dx, f.y + dy); c.stroke(); }
    else if (f.k === 'ring') { const r = lerp(f.r1, f.r0, u * u); c.strokeStyle = rgba(f.col, u * 0.9); c.lineWidth = f.w; c.beginPath(); c.arc(f.x, f.y, r, 0, TAU); c.stroke(); }
    else if (f.k === 'beam') {
      c.lineCap = 'round'; c.strokeStyle = rgba(f.col, u * 0.35); c.lineWidth = f.w * 5 * u + 2; c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2); c.stroke();
      c.strokeStyle = rgba('#ffffff', u); c.lineWidth = f.w * u + 0.6; c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2); c.stroke();
    } else if (f.k === 'bolt') {
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass ? rgba('#ffffff', u) : rgba(f.col, u * 0.6); c.lineWidth = pass ? 1.3 : 4; c.lineJoin = 'round'; c.beginPath();
        c.moveTo(f.pts[0].x, f.pts[0].y);
        for (let i = 1; i < f.pts.length; i++) {
          const a = f.pts[i - 1], b = f.pts[i], n = Math.max(2, Math.ceil(dist(a.x, a.y, b.x, b.y) / 12)), nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
          for (let j = 1; j <= n; j++) { const t = j / n, jit = j === n ? 0 : rnd(-5, 5); c.lineTo(lerp(a.x, b.x, t) + nx / nl * jit, lerp(a.y, b.y, t) + ny / nl * jit); }
        }
        c.stroke();
      }
    } else if (f.k === 'glow') { glow(c, f.x, f.y, f.r * 1.4, f.col, u); }
  }
}
function drawText(c) {
  c.font = '500 11px "DM Mono",monospace'; c.textAlign = 'center';
  for (const f of G.fx) if (f.k === 'text') { c.fillStyle = rgba(f.col, clamp(f.life / f.max * 1.6, 0, 1)); c.fillText(f.txt, f.x, f.y); }
}

function rangeRing(c, x, y, range, col, a, now, solid) {
  c.save(); c.fillStyle = rgba(col, 0.045 * (a * 3)); c.beginPath(); c.arc(x, y, range, 0, TAU); c.fill();
  c.strokeStyle = rgba(col, a); c.lineWidth = 1.2; if (!solid) { c.setLineDash([6, 6]); c.lineDashOffset = -now * 10; }
  c.stroke(); c.restore();
}

/* ---------- frame ---------- */
function draw(now) {
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = C.bg; c.fillRect(0, 0, cv.width, cv.height);
  if (!P || !SC) return;
  const sh = G.shake * 10, sx = sh ? rnd(-sh, sh) : 0, sy = sh ? rnd(-sh, sh) : 0, k = V.s * V.dpr;
  c.setTransform(k, 0, 0, k, (V.ox + sx) * V.dpr, (V.oy + sy) * V.dpr);
  c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
  c.drawImage(SC, 0, 0, W, H);
  // flowing dashes
  c.lineCap = 'butt'; c.setLineDash([10, 24]); c.lineDashOffset = -now * 36; c.strokeStyle = rgba(C.stasis, 0.22); c.lineWidth = 2; c.stroke(P.p2); c.setLineDash([]);
  drawGate(c, now); drawCore(c, now);
  // stasis auras
  for (const t of G.towers) if (t.type === 'stasis') {
    const s = st(t), ph = (now / 2.4) % 1;
    const g = c.createRadialGradient(t.x, t.y, 0, t.x, t.y, s.range); g.addColorStop(0, rgba(C.stasis, 0.09)); g.addColorStop(1, rgba(C.stasis, 0.01));
    c.fillStyle = g; c.beginPath(); c.arc(t.x, t.y, s.range, 0, TAU); c.fill();
    c.strokeStyle = rgba(C.stasis, 0.16); c.lineWidth = 1; c.beginPath(); c.arc(t.x, t.y, s.range, 0, TAU); c.stroke();
    c.strokeStyle = rgba(C.stasis, (1 - ph) * 0.3); c.beginPath(); c.arc(t.x, t.y, ph * s.range, 0, TAU); c.stroke();
  }
  // amp fields
  for (const a of G.towers) if (a.type === 'amp') {
    const s = st(a), ph = (now / 3) % 1;
    c.strokeStyle = rgba(C.amp, 0.12); c.lineWidth = 1; c.setLineDash([2, 7]); c.beginPath(); c.arc(a.x, a.y, s.range, 0, TAU); c.stroke(); c.setLineDash([]);
    c.strokeStyle = rgba(C.amp, (1 - ph) * 0.25); c.beginPath(); c.arc(a.x, a.y, ph * s.range, 0, TAU); c.stroke();
    c.strokeStyle = rgba(C.amp, 0.22); c.lineWidth = 1;
    for (const t of G.towers) if (t !== a && t.buff > 1 && dist(a.x, a.y, t.x, t.y) <= s.range + t.r) { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(t.x, t.y); c.stroke(); }
  }
  // mortar telegraphs
  for (const p of G.proj) if (p.kind === 'shell') {
    const u = p.t / p.T; c.strokeStyle = rgba(p.col, 0.25 + 0.4 * u); c.lineWidth = 1; c.setLineDash([3, 4]);
    c.beginPath(); c.arc(p.tx, p.ty, p.splash * (1.15 - 0.15 * u), 0, TAU); c.stroke(); c.setLineDash([]);
  }
  // range preview
  const sel = G.selected;
  if (sel && G.towers.includes(sel)) { rangeRing(c, sel.x, sel.y, st(sel).range, TOWERS[sel.type].color, 0.6, now, true);
    c.strokeStyle = rgba(TOWERS[sel.type].color, 0.8); c.lineWidth = 1.2; c.setLineDash([4, 5]); c.lineDashOffset = now * 14; c.beginPath(); c.arc(sel.x, sel.y, sel.r + 9, 0, TAU); c.stroke(); c.setLineDash([]); }
  else if (G.hoverTower) rangeRing(c, G.hoverTower.x, G.hoverTower.y, st(G.hoverTower).range, TOWERS[G.hoverTower.type].color, 0.3, now, true);
  for (const t of G.towers) {
    drawTower(c, t, now);
    if (t.buff > 1) { c.strokeStyle = rgba(C.amp, 0.8); c.lineWidth = 1.4; c.beginPath(); c.arc(t.x, t.y, t.r + 3.5, -2.3, -0.84); c.stroke(); }
  }
  for (const e of G.enemies) drawEnemy(c, e, now);
  c.globalCompositeOperation = 'lighter';
  for (const t of G.towers) if (t.type === 'lance' && t.beam && !t.beam.dead) {
    const e = t.beam, a = Math.atan2(e.y - t.y, e.x - t.x), mx = t.x + Math.cos(a) * (t.r + 7), my = t.y + Math.sin(a) * (t.r + 7), h = clamp(t.heat / 3, 0, 1);
    c.lineCap = 'round'; c.strokeStyle = rgba(C.lance, 0.16 + 0.2 * h); c.lineWidth = 5 + 5 * h; c.beginPath(); c.moveTo(mx, my); c.lineTo(e.x, e.y); c.stroke();
    c.strokeStyle = rgba('#ffffff', 0.55 + 0.4 * h); c.lineWidth = 1 + 1.4 * h; c.beginPath(); c.moveTo(mx, my); c.lineTo(e.x, e.y); c.stroke();
    glow(c, e.x, e.y, 10 + 10 * h, C.lance, 0.45 + 0.4 * h);
  }
  c.globalCompositeOperation = 'source-over';
  // projectiles
  c.globalCompositeOperation = 'lighter';
  for (const p of G.proj) {
    if (p.kind === 'bolt') { c.strokeStyle = rgba(p.col, 0.9); c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.px - (p.x - p.px) * 1.5, p.py - (p.y - p.py) * 1.5); c.lineTo(p.x, p.y); c.stroke(); glow(c, p.x, p.y, 9, p.col, 0.9); }
  }
  c.globalCompositeOperation = 'source-over';
  for (const p of G.proj) if (p.kind === 'shell') {
    c.fillStyle = rgba('#000000', 0.35); c.beginPath(); c.ellipse(p.x, p.y + 2, 4, 2, 0, 0, TAU); c.fill();
    c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y - p.h, 3.4, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter'; glow(c, p.x, p.y - p.h, 12, p.col, 0.6); c.globalCompositeOperation = 'source-over';
  }
  c.globalCompositeOperation = 'lighter'; drawFx(c, now); c.globalCompositeOperation = 'source-over';
  drawText(c);
  // ghost
  const gh = G.ghost;
  if (gh && G.build) {
    const d = TOWERS[G.build], bad = !!gh.reason || G.credits < d.cost, col = bad ? C.bot : d.color;
    rangeRing(c, gh.x, gh.y, d.lv[0].range, bad ? C.bot : d.color, 0.55, now);
    drawTower(c, { type: G.build, x: gh.x, y: gh.y, r: d.r, lvl: 0, ang: -Math.PI / 2 }, now, 0.7);
    if (bad) { c.strokeStyle = C.bot; c.lineWidth = 1.6; c.beginPath(); c.arc(gh.x, gh.y, d.r + 4, 0, TAU); c.stroke(); }
    const msg = gh.reason || (G.credits < d.cost ? 'NEED ' + (d.cost - G.credits) + ' MORE' : '');
    if (msg) { c.font = '500 10px "DM Mono",monospace'; c.textAlign = 'center'; c.fillStyle = col; c.fillText(msg, gh.x, gh.y - d.r - 12); }
  }
  c.restore();
}

/* menu previews */
function drawPreview(cnv, i) {
  const pp = pathCache[i] || (pathCache[i] = buildMap(MAPS[i])), c = cnv.getContext('2d'), k = cnv.width / W;
  c.setTransform(k, 0, 0, k, 0, 0); c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
  const p2 = new Path2D(); pp.near.forEach((p, j) => j ? p2.lineTo(p.x, p.y) : p2.moveTo(p.x, p.y));
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = C.line2; c.lineWidth = HALF * 2 + 4; c.stroke(p2);
  c.strokeStyle = '#070a10'; c.lineWidth = HALF * 2; c.stroke(p2);
  c.strokeStyle = rgba(C.stasis, 0.5); c.lineWidth = 3; c.setLineDash([2, 12]); c.stroke(p2); c.setLineDash([]);
  for (const o of pp.m.obs) { c.strokeStyle = C.line2; c.lineWidth = 3; c.fillStyle = rgba(C.line, 0.5); c.beginPath(); c.arc(o[0], o[1], o[2], 0, TAU); c.fill(); c.stroke(); }
  c.strokeStyle = C.fg; c.lineWidth = 5; c.beginPath(); c.arc(pp.core.x, pp.core.y, 26, 0, TAU); c.stroke();
}
/* ---------- audio (tiny synth, off until first gesture) ---------- */
let AC = null, master = null, noiseBuf = null, muted = false;
try { muted = localStorage.getItem('opencircuit.mute') === '1'; } catch (e) {}
function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.3; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(f0, f1, dur, type, vol, delay) {
  const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq) {
  const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}
const lastSfx = {};
function sfx(n) {
  if (muted || !AC) return;
  const t = AC.currentTime; if (lastSfx[n] && t - lastSfx[n] < 0.045) return; lastSfx[n] = t;
  switch (n) {
    case 'pulse': tone(900, 420, 0.06, 'square', 0.035); break;
    case 'rail': tone(260, 50, 0.3, 'sawtooth', 0.09); noise(0.2, 0.06, 2400); break;
    case 'arc': noise(0.12, 0.07, 5000); tone(300, 700, 0.1, 'triangle', 0.04); break;
    case 'mortar': tone(140, 55, 0.18, 'sine', 0.16); break;
    case 'thud': noise(0.3, 0.12, 700); tone(90, 40, 0.25, 'sine', 0.12); break;
    case 'kill': tone(520, 840, 0.07, 'sine', 0.05); break;
    case 'boom': noise(0.5, 0.16, 900); tone(120, 35, 0.5, 'sine', 0.16); break;
    case 'place': tone(440, 660, 0.07, 'triangle', 0.08); tone(660, 990, 0.09, 'triangle', 0.07, 0.06); break;
    case 'up': tone(520, 780, 0.08, 'triangle', 0.08); tone(780, 1170, 0.08, 'triangle', 0.08, 0.07); tone(1040, 1560, 0.12, 'triangle', 0.07, 0.14); break;
    case 'sell': tone(600, 300, 0.12, 'triangle', 0.07); break;
    case 'leak': tone(180, 60, 0.35, 'sawtooth', 0.12); break;
    case 'wave': tone(330, 330, 0.1, 'sine', 0.08); tone(495, 495, 0.1, 'sine', 0.08, 0.1); tone(660, 660, 0.16, 'sine', 0.08, 0.2); break;
    case 'clear': tone(523, 523, 0.1, 'triangle', 0.07); tone(784, 784, 0.18, 'triangle', 0.07, 0.1); break;
    case 'over': tone(300, 70, 0.9, 'sawtooth', 0.12); break;
    case 'no': tone(160, 120, 0.1, 'square', 0.05); break;
    case 'lance': tone(1200, 1500, 0.05, 'sine', 0.018); break;
  }
}

/* ---------- UI ---------- */
function iconFor(type, lvl) {
  const c = document.createElement('canvas'); c.width = c.height = 88;
  paintIcon(c, type, lvl || 0); return c;
}
function paintIcon(c, type, lvl) {
  const g = c.getContext('2d'), d = TOWERS[type];
  g.clearRect(0, 0, 88, 88); g.save(); g.translate(44, 44); g.scale(1.55, 1.55);
  drawTower(g, { type, x: 0, y: -2, r: d.r, lvl, ang: -0.7, cd: 0, recoil: 0, flash: 0 }, 0.5, 1);
  g.restore();
}
const trayBtns = {};
function buildTray() {
  const tray = $('tray');
  TKEYS.forEach(k => {
    const d = TOWERS[k], b = document.createElement('button');
    b.className = 'tb'; b.dataset.t = k; b.style.setProperty('--c', d.color); b.setAttribute('aria-pressed', 'false');
    b.title = d.name + ' (' + d.key + ') · ' + d.cost + ' cr · ' + d.sub; b.setAttribute('aria-label', d.name + ', ' + d.cost + ' credits');
    b.appendChild(iconFor(k, 0));
    const w = document.createElement('div');
    w.className = 'cost'; w.textContent = d.cost;
    const kb = document.createElement('kbd'); kb.textContent = d.key;
    b.appendChild(w); b.appendChild(kb); tray.appendChild(b); trayBtns[k] = b;
  });
  tray.addEventListener('click', e => { const b = e.target.closest('.tb'); if (b) { audio(); setBuild(b.dataset.t); } });
}
function buildMapCards() {
  const box = $('maps'); box.innerHTML = '';
  MAPS.forEach((m, i) => {
    const b = document.createElement('button'); b.className = 'mc'; b.setAttribute('aria-pressed', i === G.mapIdx ? 'true' : 'false');
    const cnv = document.createElement('canvas'); cnv.width = 480; cnv.height = 270; b.appendChild(cnv);
    const bv = G.best[m.id + '.' + G.diff], best = bv ? ' · best ' + bv : '';
    const t = document.createElement('div'); t.className = 't'; t.innerHTML = '<b>' + m.name + '</b><span>' + m.tag + best + '</span>'; b.appendChild(t);
    const p = document.createElement('p'); p.textContent = m.blurb; b.appendChild(p);
    b.addEventListener('click', () => { selectMap(i); });
    box.appendChild(b); drawPreview(cnv, i);
  });
}
function buildDiff() {
  const row = $('diffRow');
  DIFFS.forEach((d, i) => {
    const b = document.createElement('button'); b.className = 'ib'; b.textContent = d.name; b.dataset.d = i; b.setAttribute('aria-pressed', i === G.diff ? 'true' : 'false');
    b.addEventListener('click', () => {
      G.diff = i; try { localStorage.setItem('opencircuit.diff', String(i)); } catch (e) {}
      [...row.querySelectorAll('button')].forEach((x, j) => x.setAttribute('aria-pressed', j === i ? 'true' : 'false')); buildMapCards();
    });
    row.insertBefore(b, $('bStart'));
  });
}
function selectMap(i) {
  setMap(i); buildStatic();
  [...$('maps').children].forEach((b, j) => b.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
}
function setBuild(type) {
  if (G.state !== 'play') return;
  G.build = G.build === type ? null : type; G.selected = null;
  if (G.build && G.hover) setGhost(G.hover.x, G.hover.y); else G.ghost = null;
}
function setGhost(x, y) { G.ghost = { x, y, reason: placeReason(x, y, TOWERS[G.build].r) }; }
const SPEEDS = [1, 2, 3, 5, 8, 12, 16, 24];
function cycleSpeed(dir) { G.speed = SPEEDS[(SPEEDS.indexOf(G.speed) + (dir || 1) + SPEEDS.length) % SPEEDS.length]; $('bSpeed').textContent = G.speed + 'x'; }
function togglePause() { if (G.state !== 'play') return; G.paused = !G.paused; $('bPause').setAttribute('aria-pressed', G.paused); $('bPause').textContent = G.paused ? 'Resume' : 'Pause'; }
function setMuted(m) { muted = m; try { localStorage.setItem('opencircuit.mute', m ? '1' : '0'); } catch (e) {} $('bSound').setAttribute('aria-pressed', !m); $('bSound').textContent = m ? 'Mute' : 'Snd'; }

const pct = v => Math.round(v * 100) + '%', num = v => String(Math.round(v * 10) / 10);
function statHTML(k, cur, nx, fmt) {
  return '<div class="istat"><span class="k">' + k + '</span><span class="v">' + fmt(cur) + (nx != null && nx !== cur ? ' <i>→ ' + fmt(nx) + '</i>' : '') + '</span></div>';
}
function inspectorHTML(t) {
  const d = TOWERS[t.type], s = st(t), n = d.lv[t.lvl + 1] || {}, up = upgradeCost(t);
  let h = '<div class="ihead"><canvas width="88" height="88"></canvas><div><div class="nm">' + d.name + '</div><div class="lv">LV ' + (t.lvl + 1) + ' / ' + d.lv.length + '</div></div></div><div class="istats">';
  if (t.type === 'stasis') h += statHTML('Slow', s.slow, n.slow, pct) + statHTML('Burn/s', s.dps, n.dps, num);
  else if (t.type === 'amp') h += statHTML('Boost', s.boost, n.boost, pct);
  else if (t.type === 'lance') h += statHTML('Dmg/s', s.dps, n.dps, num) + statHTML('Max ramp', s.ramp, n.ramp, v => '×' + num(v));
  else h += statHTML('Damage', s.damage === undefined ? s.dmg : s.damage, n.dmg, num) + statHTML('Rate/s', s.rate, n.rate, num);
  if (t.type !== 'amp') h += '<div class="istat"><span class="k">Amp bonus</span><span class="v">' + (t.buff > 1 ? '<i>+' + Math.round((t.buff - 1) * 100) + '%</i>' : '—') + '</span></div>';
  h += statHTML('Range', s.range, n.range, num);
  if (s.chain) h += statHTML('Chain', s.chain, n.chain, num);
  if (s.splash) h += statHTML('Splash', s.splash, n.splash, num);
  h += '<div class="istat"><span class="k">Kills</span><span class="v">' + t.kills + '</span></div></div><div class="iact">';
  if (t.type !== 'stasis' && t.type !== 'amp') h += '<button class="btn" data-act="mode">Target: ' + MODE_LABEL[t.mode] + '</button>';
  h += '<button class="btn sell" data-act="sell">Sell +' + sellValue(t) + '</button><button class="btn" data-act="close">Done</button></div>';
  return h;
}
$('bUp').addEventListener('click', () => { const t = G.selected; if (t) actOn('up', t); else sfx('no'); });
$('inspect').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'), t = G.selected; if (!b || !t) return;
  actOn(b.dataset.act, t);
});
function actOn(act, t) {
  if (act === 'up') { if (!upgradeTower(t)) sfx('no'); }
  else if (act === 'sell') sellTower(t);
  else if (act === 'mode') t.mode = MODES[(MODES.indexOf(t.mode) + 1) % MODES.length];
  else if (act === 'close') G.selected = null;
}

const cache = {};
function setText(id, v, bump) {
  if (cache[id] === v) return; const el = $(id);
  if (bump && cache[id] !== undefined && v > cache[id]) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  cache[id] = v; el.textContent = v;
}
let insKey = '', overShown = false;
function syncUI() {
  const play = G.state === 'play';
  setText('vLives', G.state === 'menu' ? Math.max(3, Math.round(MAPS[G.mapIdx].lives * DIFFS[G.diff].lives)) : G.lives);
  $('vLives').classList.toggle('low', play && G.lives <= 5);
  setText('vCred', G.credits, true); setText('vWave', G.wave); setText('vScore', G.score);
  TKEYS.forEach(k => { const b = trayBtns[k]; b.classList.toggle('poor', G.credits < TOWERS[k].cost); b.setAttribute('aria-pressed', G.build === k ? 'true' : 'false'); });
  const sel = G.selected && G.towers.includes(G.selected) ? G.selected : null;
  if (!sel) G.selected = null;
  $('inspect').hidden = !sel;
  const bUp = $('bUp'), upc = sel ? upgradeCost(sel) : null;
  const upTxt = !sel ? 'Upgrade · U' : upc === null ? 'Maxed' : 'Upgrade · ' + upc + ' · U';
  if (bUp.textContent !== upTxt) bUp.textContent = upTxt;
  bUp.disabled = !sel || upc === null || G.credits < upc;
  bUp.style.setProperty('--c', sel ? TOWERS[sel.type].color : 'var(--stasis)');
  if (sel) {
    const up = upgradeCost(sel), key = G.towers.indexOf(sel) + '|' + sel.lvl + '|' + sel.mode + '|' + sel.kills + '|' + Math.round((sel.buff || 1) * 100) + '|' + (up !== null && G.credits >= up);
    if (key !== insKey) { insKey = key; $('inspect').innerHTML = inspectorHTML(sel); paintIcon($('inspect').querySelector('canvas'), sel.type, sel.lvl); }
  } else insKey = '';
  $('bWave').textContent = G.autoT > 0 ? 'Next wave in ' + Math.ceil(G.autoT) : 'Send wave ' + (G.wave + 1);
  const nx = waveDef(G.wave + 1).map(g => g.count + ' ' + g.type).join(' · ');
  setText('next', nx);
  $('pill').hidden = !(G.paused && play);
  $('hint').textContent = G.build ? 'Click to place, or click a tower to select it. Right-click or Esc cancels.' : sel ? 'U upgrade · X sell · T targeting · Esc close' : play ? 'Pick a tower (1–7), then place it anywhere off the trace.' : '';
  cv.style.cursor = G.hoverTower ? 'pointer' : G.build ? 'crosshair' : 'default';
  if (G.state === 'over' && !overShown) {
    overShown = true;
    $('oRes').innerHTML = statHTML('Waves cleared', G.cleared, null, num) + statHTML('Score', G.score, null, num) + statHTML('Bots down', G.kills, null, num) + statHTML('Best here', G.best[G.mapDef.id + '.' + G.diff] || 0, null, num);
    $('ovOver').hidden = false;
  }
}

/* ---------- input ---------- */
function hitTower(x, y) { for (let i = G.towers.length - 1; i >= 0; i--) { const t = G.towers[i]; if (dist(x, y, t.x, t.y) <= t.r + 7) return t; } return null; }
cv.addEventListener('pointermove', e => {
  const w = toWorld(e); G.hover = w;
  G.hoverTower = G.state === 'play' ? hitTower(w.x, w.y) : null;
  if (G.build && e.pointerType === 'mouse') { if (G.hoverTower) G.ghost = null; else setGhost(w.x, w.y); }
});
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { G.ghost = null; G.hover = null; G.hoverTower = null; } });
cv.addEventListener('pointerdown', e => {
  audio(); if (G.state !== 'play' || e.button > 0) return;
  const w = toWorld(e); G.hover = w;
  const hit = hitTower(w.x, w.y);
  if (hit) { G.selected = hit; G.build = null; G.ghost = null; return; }
  if (G.build) {
    const touch = e.pointerType !== 'mouse';
    if (touch && !(G.ghost && dist(w.x, w.y, G.ghost.x, G.ghost.y) < 28)) { setGhost(w.x, w.y); return; }
    const p = touch ? G.ghost : w;
    if (!placeTower(G.build, p.x, p.y)) { sfx('no'); if (touch) setGhost(w.x, w.y); } else { setGhost(p.x, p.y); if (touch) G.ghost = null; }
    return;
  }
  G.selected = null;
});
cv.addEventListener('contextmenu', e => { e.preventDefault(); G.build = null; G.ghost = null; });
window.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (e.key === ' ') { e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); togglePause(); return; }
  if (G.state !== 'play') return;
  const idx = '1234567'.indexOf(k);
  if (idx >= 0 && k.length === 1) { audio(); setBuild(TKEYS[idx]); }
  else if (e.key === 'Escape') { G.build = null; G.ghost = null; G.selected = null; }
  else if (k === 'n') { audio(); sendWave(); }
  else if (k === 'f') cycleSpeed(e.shiftKey ? -1 : 1);
  else if (k === 'm') setMuted(!muted);
  else if (k === 'u') { const ut = G.selected || G.hoverTower; if (ut) actOn('up', ut); }
  else if (G.selected) {
    if (k === 'x' || e.key === 'Delete' || e.key === 'Backspace') actOn('sell', G.selected);
    else if (k === 't' && G.selected.type !== 'stasis' && G.selected.type !== 'amp') actOn('mode', G.selected);
  }
});
$('bWave').addEventListener('click', () => { audio(); sendWave(); });
$('bSpeed').addEventListener('click', e => cycleSpeed(e.shiftKey ? -1 : 1));
$('bSpeed').addEventListener('contextmenu', e => { e.preventDefault(); cycleSpeed(-1); });
$('bPause').addEventListener('click', togglePause);
$('bSound').addEventListener('click', () => { audio(); setMuted(!muted); });
$('cAuto').addEventListener('change', e => { G.auto = e.target.checked; if (G.auto && G.state === 'play' && !G.active && G.autoT <= 0) G.autoT = 2; if (!G.auto) G.autoT = 0; });
function begin() {
  audio(); newGame(G.mapIdx); overShown = false; insKey = '';
  $('ovMenu').hidden = true; $('ovOver').hidden = true; G.paused = false; $('bPause').textContent = 'Pause'; $('bPause').setAttribute('aria-pressed', 'false');
  buildStatic();
}
$('bStart').addEventListener('click', begin);
$('bRetry').addEventListener('click', begin);
$('bMenu').addEventListener('click', () => { G.state = 'menu'; $('ovOver').hidden = true; $('ovMenu').hidden = false; overShown = false; buildMapCards(); });

let quitT = 0;
$('bQuit').addEventListener('click', () => {
  const b = $('bQuit');
  if (G.state === 'menu') return;
  if (!quitT) { b.textContent = 'Sure?'; b.setAttribute('aria-pressed', 'true'); quitT = setTimeout(() => { quitT = 0; b.textContent = 'Quit'; b.setAttribute('aria-pressed', 'false'); }, 3000); return; }
  clearTimeout(quitT); quitT = 0; b.textContent = 'Quit'; b.setAttribute('aria-pressed', 'false');
  Object.assign(G, { state: 'menu', towers: [], enemies: [], proj: [], fx: [], spawns: [], selected: null, build: null, ghost: null, active: false, paused: false, wave: 0, score: 0, credits: 0, autoT: 0 });
  $('bPause').textContent = 'Pause'; $('bPause').setAttribute('aria-pressed', 'false');
  $('ovOver').hidden = true; $('ovMenu').hidden = false; overShown = false; buildMapCards();
});
/* ---------- loop ---------- */
const STEP = 1 / 60;
let lastT = performance.now(), acc = 0;
function frame(ts) {
  const dt = Math.min(0.1, (ts - lastT) / 1000); lastT = ts;
  if (G.state === 'play' && !G.paused) {
    acc += dt * G.speed; let n = 0;
    while (acc >= STEP && n < 36) { update(STEP); acc -= STEP; n++; if (G.state !== 'play') break; }
    if (n >= 36) acc = 0;
  } else acc = 0;
  draw(ts / 1000); syncUI();
  requestAnimationFrame(frame);
}
G.hover = null; G.hoverTower = null;
setMap(0); buildTray(); buildDiff(); buildMapCards(); setMuted(muted);
resize(); new ResizeObserver(resize).observe($('stage')); window.addEventListener('resize', resize);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildMapCards(); });
requestAnimationFrame(frame);

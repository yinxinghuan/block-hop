// game.js — Block Hop core. Three.js v0.160 ES module.
// Grid-based 3D hop game. Iso-ish camera, NYC street theme, voxel cast from
// shelf-it/builders/characters.js. tap=forward, swipe lr/back. No chase line — die only by car/train/river/drift.

import * as THREE from 'three';
import { P, box, cyl, ball, cone, darken } from './lib/prims.js';
import { CHARACTERS } from './builders/characters.js';

// ── Tunables ──────────────────────────────────────────────────────────────────
const TILE         = 1.0;
const HALF_WIDTH   = 7;          // visible cells each side of x=0
const KILL_X       = 8;          // |worldX| > this → off-screen kill
const HOP_DUR      = 0.18;       // seconds
const HOP_HEIGHT   = 0.55;
const VIEW_H       = 6.4;        // ortho frustum half-height (smaller = zoomed in)
const PLAYER_SCALE = 0.55;       // bumped from 0.42 so character reads on small screens
const SURFACE_Y    = 0.20;       // y of road/grass/rail top surface — vehicles sit here

// ── Globals ───────────────────────────────────────────────────────────────────
let scene, camera, renderer, canvas;
let clock;
let playerMesh, playerRig;
let sun, sunTarget, ambient, fill;
let matHead, matTail;           // shared emissive vehicle-lamp materials (glow at night)
let dayT = 0;                   // seconds into the day/night cycle
const DAY_CYCLE = 80;           // seconds for one full day→night loop
const SKY_DAY = new THREE.Color(0xaed0e6), SKY_NIGHT = new THREE.Color(0x1d3a78);
const SKY_DAWN = new THREE.Color(0xf3a878), SKY_DUSK = new THREE.Color(0xe9714a);  // horizon glow
const SUN_DAY = new THREE.Color(0xfff4d6), SUN_NIGHT = new THREE.Color(0x5878d8);  // cool moonlight
const SUN_DAWN = new THREE.Color(0xffc08a), SUN_DUSK = new THREE.Color(0xff8a3c);  // golden hour
const AMB_DAY = new THREE.Color(0xfdfbf4), AMB_NIGHT = new THREE.Color(0x2a4a86), AMB_WARM = new THREE.Color(0xffc6a0);
const _dnSky = new THREE.Color(), _dnSun = new THREE.Color(), _dnAmb = new THREE.Color();
let lanesByGz = new Map();      // gz → laneRecord
let furthestAhead = -Infinity;  // largest gz that has a lane
let furthestBehind = Infinity;  // smallest gz that has a lane

const player = {
  gx: 0, gz: 0,
  worldX: 0,                    // overridden by log when riding
  hopping: false, hopT: 0,
  hopFromX: 0, hopFromZ: 0, hopToX: 0, hopToZ: 0,
  dead: false,
  riding: null,                 // { log, offsetX } when on a river log
  facing: Math.PI,              // mesh y-rot target; chars natively face +Z, so PI = world forward (-Z)
  bump: null,                   // { t, dx, dz } in-place bounce when a hop is blocked
  sinking: false,               // drown death animation
  hopDur: HOP_DUR,              // per-character (set in buildPlayer)
  hopHeight: HOP_HEIGHT,
  rigBase: null,                // captured rest rotations of the limb pivots
  step: 0,                      // alternates each hop so steps lead with opposite legs
  grace: 0,                     // seconds of post-revive invulnerability
};

// Roster. Civilians are free starters; NYC archetypes + after-dark monsters are
// coin-unlock collectibles. Only unlocked characters enter the random pool.
const STARTERS = [
  'shopkeeper', 'granny', 'oldman', 'blonde', 'kid', 'businessman', 'officeWoman',
  'student', 'darkWoman', 'worker', 'teen', 'fitWoman', 'chef', 'bigGuy',
];
const ARCH_KEYS = ['cop', 'nurse', 'firefighter', 'construction', 'delivery', 'cowboy', 'punk', 'rapper', 'biker', 'goth'];
const MONSTER_KEYS = ['vampire', 'werewolf', 'zombie', 'ghost', 'skeleton', 'mummy'];
const ROSTER = [...STARTERS, ...ARCH_KEYS, ...MONSTER_KEYS];
const UNLOCK_COST = 20;
// English display names (platform faces US/English users — never ship Chinese here).
const NAMES = {
  shopkeeper:'Shopkeeper', granny:'Granny', oldman:'Old Timer', blonde:'Blondie', kid:'The Kid',
  businessman:'The Suit', officeWoman:'Office Lady', student:'Student', darkWoman:'City Girl',
  worker:'Clerk', teen:'Teen', fitWoman:'Gym Rat', chef:'Chef', bigGuy:'Big Guy',
  cop:'Cop', nurse:'Nurse', firefighter:'Firefighter', construction:'Hard Hat', delivery:'Courier',
  cowboy:'Cowboy', punk:'Punk', rapper:'Rapper', biker:'Biker', goth:'Goth',
  vampire:'Vampire', werewolf:'Werewolf', zombie:'Zombie', ghost:'Ghost', skeleton:'Skeleton', mummy:'Mummy',
};
let unlocked = new Set(STARTERS);
// Per-character movement feel: durMul scales hop time (lower = snappier),
// heightMul scales hop arc. Anyone not listed uses the default 1.0/1.0.
const MOVE = {
  kid:          { dur: 0.82, height: 1.05 },
  teen:         { dur: 0.88, height: 1.05 },
  student:      { dur: 0.9,  height: 1.0  },
  fitWoman:     { dur: 0.80, height: 1.20 },
  biker:        { dur: 0.88, height: 0.95 },
  delivery:     { dur: 0.85, height: 1.0  },
  cop:          { dur: 0.95, height: 1.0  },
  businessman:  { dur: 1.15, height: 0.95 },
  chef:         { dur: 1.05, height: 0.95 },
  cowboy:       { dur: 1.1,  height: 1.0  },
  rapper:       { dur: 1.1,  height: 1.0  },
  granny:       { dur: 1.35, height: 0.78 },
  oldman:       { dur: 1.32, height: 0.80 },
  bigGuy:       { dur: 1.30, height: 0.85 },
  firefighter:  { dur: 1.22, height: 0.9  },
  construction: { dur: 1.20, height: 0.9  },
};
function pickChar(){
  const pool = ROSTER.filter(k => unlocked.has(k));
  return pool[Math.floor(Math.random() * pool.length)] || 'shopkeeper';
}

// ── Coin economy: revive (escalating per-run cost) + character unlock ─────────
const REVIVE_COSTS = [15, 30, 60];
function reviveCost(){ return REVIVE_COSTS[Math.min(reviveCount, REVIVE_COSTS.length - 1)]; }
let reviveCount = 0;

let coins = 0;
let bestDistance = 0;
let bestCoins = 0;
let started = false;
let runDistance = 0;

const tmpVec = new THREE.Vector3();

// HUD callbacks (set by index.html)
let hud = { setDistance(){}, setCoin(){}, setDead(){}, setReady(){} };

// ── Audio (WebAudio polish kit — master compressor + per-sound envelopes) ──────
let actx = null, master = null;
function initAudio(){
  if (actx){ if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = actx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.18;
    master = actx.createGain();
    master.gain.value = 0.5;
    master.connect(comp); comp.connect(actx.destination);
  } catch(e){ actx = null; }
}
function tone(freq, dur, o){
  if (!actx) return;
  o = o || {};
  const t0 = actx.currentTime + (o.delay || 0);
  const osc = actx.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  const lpf = actx.createBiquadFilter();
  lpf.type = 'lowpass'; lpf.frequency.value = o.lp || 2200;
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain || 0.3, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(lpf); lpf.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}
function noise(dur, o){
  if (!actx) return;
  o = o || {};
  const t0 = actx.currentTime + (o.delay || 0);
  const n = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, n, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource(); src.buffer = buf;
  const lpf = actx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = o.lp || 1200;
  const g = actx.createGain();
  g.gain.setValueAtTime(o.gain || 0.3, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(lpf); lpf.connect(g);
  if (o.hp){ const hpf = actx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = o.hp; g.connect(hpf); hpf.connect(master); }
  else g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.02);
}
const SFX = {
  hop(){ tone(420, 0.11, { type:'sine', gain:0.20, lp:1800, slideTo:640 }); },
  blocked(){ tone(150, 0.12, { type:'square', gain:0.16, lp:650, slideTo:90 }); noise(0.07, { gain:0.10, lp:500 }); },
  coin(){ tone(880, 0.07, { type:'triangle', gain:0.18, lp:4000 }); tone(1320, 0.10, { type:'triangle', gain:0.16, lp:5000, delay:0.06 }); },
  crash(){ noise(0.32, { gain:0.5, lp:1500, hp:120 }); tone(120, 0.3, { type:'sawtooth', gain:0.22, lp:800, slideTo:48 }); },
  splash(){ noise(0.42, { gain:0.42, lp:3800, hp:380 }); tone(300, 0.22, { type:'sine', gain:0.14, lp:1500, slideTo:120 }); },
  over(){ tone(330, 0.18, { type:'triangle', gain:0.20, slideTo:247 }); tone(196, 0.26, { type:'triangle', gain:0.18, slideTo:147, delay:0.16 }); },
};

// ── Particle FX ────────────────────────────────────────────────────────────────
let fxGroup;
const fxPool = [];
const fxActive = [];
function fxInit(){ fxGroup = new THREE.Group(); scene.add(fxGroup); }
function fxParticle(){
  let p = fxPool.pop();
  if (!p){
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85 })
    );
    p = { mesh: m };
    fxGroup.add(m);
  }
  p.mesh.visible = true;
  return p;
}
function burst(x, y, z, o){
  if (!fxGroup) return;
  o = o || {};
  const count = o.count || 10, speed = o.speed || 2.2, up = o.up || 2.5;
  const size = o.size || 0.12, life = o.life || 0.5, gravity = o.gravity != null ? o.gravity : -9;
  const spread = o.spread || 1, color = o.color || 0xffffff;
  for (let i = 0; i < count; i++){
    const p = fxParticle();
    const hex = Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color;
    p.mesh.material.color.setHex(hex);
    const s = size * (0.6 + Math.random() * 0.8);
    p.baseScale = s; p.mesh.scale.setScalar(s);
    p.mesh.position.set(x, y, z);
    const ang = Math.random() * Math.PI * 2;
    const sp = speed * (0.4 + Math.random() * 0.8);
    p.vx = Math.cos(ang) * sp * spread;
    p.vz = Math.sin(ang) * sp * spread;
    p.vy = up * (0.4 + Math.random() * 0.9);
    p.life = p.maxLife = life * (0.7 + Math.random() * 0.6);
    p.gravity = gravity;
    p.spin = (Math.random() - 0.5) * 12;
    fxActive.push(p);
  }
}
function fxUpdate(dt){
  for (let i = fxActive.length - 1; i >= 0; i--){
    const p = fxActive[i];
    p.life -= dt;
    if (p.life <= 0){ p.mesh.visible = false; fxActive.splice(i, 1); fxPool.push(p); continue; }
    p.vy += p.gravity * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    if (p.mesh.position.y < 0.02){ p.mesh.position.y = 0.02; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
    p.mesh.rotation.x += p.spin * dt;
    p.mesh.rotation.y += p.spin * 0.7 * dt;
    const k = p.life / p.maxLife;
    p.mesh.scale.setScalar(p.baseScale * (0.25 + 0.75 * k));
  }
}
function fxClear(){
  for (const p of fxActive){ p.mesh.visible = false; fxPool.push(p); }
  fxActive.length = 0;
  for (const p of puffActive){ p.mesh.visible = false; puffPool.push(p); }
  puffActive.length = 0;
}

// Soft cartoon puffs (round, translucent, grow + fade) — for footfall dust + foam.
const PUFF_GEO = new THREE.IcosahedronGeometry(0.13, 0);
const puffPool = [];
const puffActive = [];
function puffParticle(){
  let p = puffPool.pop();
  if (!p){
    const m = new THREE.Mesh(PUFF_GEO, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    p = { mesh: m };
    fxGroup.add(m);
  }
  p.mesh.visible = true;
  return p;
}
function puff(x, z, o){
  if (!fxGroup) return;
  o = o || {};
  const colors = o.color || [0xeee7d6, 0xd8cfba];
  const n = o.count || (2 + ((Math.random() * 2) | 0));
  const y0 = o.y != null ? o.y : 0.1;
  for (let i = 0; i < n; i++){
    const p = puffParticle();
    p.mesh.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
    p.mesh.material.opacity = 0.9;
    const sc = (o.size || 1) * (0.5 + Math.random() * 0.45);
    p.s0 = sc; p.mesh.scale.setScalar(sc);
    p.y0 = y0;
    p.mesh.position.set(x + (Math.random() - 0.5) * 0.4, y0, z + (Math.random() - 0.5) * 0.4);
    p.t = 0; p.life = (o.life || 0.5) * (0.85 + Math.random() * 0.4);
    p.vy = o.vy != null ? o.vy : (0.4 + Math.random() * 0.55);
    p.vx = (Math.random() - 0.5) * (o.spread || 0.55);
    p.vz = (Math.random() - 0.5) * (o.spread || 0.55);
    p.grow = o.grow != null ? o.grow : 1.4;
    puffActive.push(p);
  }
}
function puffUpdate(dt){
  for (let i = puffActive.length - 1; i >= 0; i--){
    const d = puffActive[i]; d.t += dt; const k = d.t / d.life;
    if (k >= 1){ d.mesh.visible = false; puffActive.splice(i, 1); puffPool.push(d); continue; }
    d.mesh.position.x += d.vx * dt;
    d.mesh.position.z += d.vz * dt;
    d.mesh.position.y = d.y0 + d.vy * d.t;
    d.mesh.scale.setScalar(d.s0 * (1 + k * d.grow));
    d.mesh.material.opacity = 0.9 * (1 - k) * (1 - k);
  }
}

// ── Init / Stage ──────────────────────────────────────────────────────────────
export function startGame(opts){
  canvas = opts.canvas;
  hud = opts.hud || hud;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8d7ea);
  scene.fog = new THREE.Fog(0xb8d7ea, 28, 44);

  // Mostly top-down orthographic camera (tiny yaw to keep voxel depth cue,
  // but +Z forward maps to "screen up" so touch swipes are unambiguous).
  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.OrthographicCamera(
    -VIEW_H * aspect, VIEW_H * aspect, VIEW_H, -VIEW_H, 0.1, 200
  );
  camera.position.set(2, 14, 11);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Ambient + warm key sun (real shadowMap) + cool fill.
  ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  sun = new THREE.DirectionalLight(0xfff4d6, 1.05);
  sun.position.set(8, 16, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left   = -12;
  sun.shadow.camera.right  =  12;
  sun.shadow.camera.top    =  14;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near   = 1;
  sun.shadow.camera.far    = 50;
  sun.shadow.bias        = -0.0006;
  sun.shadow.normalBias  =  0.02;
  scene.add(sun);
  sunTarget = new THREE.Object3D();
  scene.add(sunTarget);
  sun.target = sunTarget;
  fill = new THREE.DirectionalLight(0xc9e2ff, 0.28);
  fill.position.set(-6, 8, -4);
  scene.add(fill);

  // Shared vehicle-lamp materials — emissiveIntensity bumped at night.
  matHead = new THREE.MeshStandardMaterial({ color: 0xfff4c8, emissive: 0xfff0c0, emissiveIntensity: 0, roughness: 0.6, flatShading: true });
  matTail = new THREE.MeshStandardMaterial({ color: 0xe04030, emissive: 0xff2018, emissiveIntensity: 0, roughness: 0.6, flatShading: true });

  // Particle FX layer
  fxInit();
  initWeather();

  // Build player (random character each run)
  buildPlayer(pickChar());

  // Build initial lanes
  for (let gz = -4; gz <= 14; gz++) addLane(gz);

  // Resize
  window.addEventListener('resize', onResize);
  onResize();

  // Input
  attachInput();

  // Restore best
  try {
    bestDistance = +localStorage.getItem('bh.bestDist') || 0;
    bestCoins    = +localStorage.getItem('bh.bestCoins') || 0;
    coins        = +localStorage.getItem('bh.coins') || 0;
    const saved = JSON.parse(localStorage.getItem('bh.unlocked') || '[]');
    if (Array.isArray(saved)) for (const k of saved) if (ROSTER.includes(k)) unlocked.add(k);
  } catch(e) {}
  hud.setCoin(coins);

  clock = new THREE.Clock();
  hud.setReady(true);
  requestAnimationFrame(tick);

  return { restart, revive, reviveInfo, getCoins, getRoster, unlock: unlockChar, thumb: makeThumb,
           hop: (dx, dz) => { initAudio(); tryHop(dx, dz); } };
}

function buildPlayer(charKey){
  if (playerMesh) scene.remove(playerMesh);
  const factory = CHARACTERS[charKey] || CHARACTERS.shopkeeper;
  const mv = MOVE[charKey] || {};
  player.hopDur    = HOP_DUR * (mv.dur || 1);
  player.hopHeight = HOP_HEIGHT * (mv.height || 1);
  playerMesh = factory();
  playerMesh.scale.setScalar(PLAYER_SCALE);
  playerMesh.position.set(0, SURFACE_Y, 0);
  playerMesh.rotation.y = Math.PI;   // face +Z (forward in our world)
  playerRig = playerMesh.userData.rig || null;
  player.rigBase = playerRig ? {
    legL: playerRig.legL.rotation.x, legR: playerRig.legR.rotation.x,
    armL: playerRig.armL.rotation.x, armR: playerRig.armR.rotation.x,
  } : null;
  playerMesh.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  scene.add(playerMesh);
}

// Pose the limb pivots for a hop. `sw` 0→1→0 over the hop; `dir` ±1 alternates
// which leg leads. Rotations are added on top of each rig's rest pose so held
// props (cop's donut, etc.) keep their offset.
function poseLimbs(sw, dir){
  if (!playerRig || !player.rigBase) return;
  const b = player.rigBase;
  playerRig.legL.rotation.x = b.legL + sw * (0.75 + 0.30 * dir);
  playerRig.legR.rotation.x = b.legR + sw * (0.75 - 0.30 * dir);
  playerRig.armL.rotation.x = b.armL - sw * (1.05 - 0.35 * dir);
  playerRig.armR.rotation.x = b.armR - sw * (1.05 + 0.35 * dir);
}
function restLimbs(){
  if (!playerRig || !player.rigBase) return;
  const b = player.rigBase;
  playerRig.legL.rotation.x = b.legL; playerRig.legR.rotation.x = b.legR;
  playerRig.armL.rotation.x = b.armL; playerRig.armR.rotation.x = b.armR;
}

function onResize(){
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  camera.left = -VIEW_H * aspect; camera.right = VIEW_H * aspect;
  camera.top = VIEW_H; camera.bottom = -VIEW_H;
  camera.updateProjectionMatrix();
}


// ── Coordinate helpers ────────────────────────────────────────────────────────
// +gz is forward direction; world Z is negative gz so the camera (placed +Z)
// stays behind the player as gz grows.
function wX(gx){ return gx * TILE; }
function wZ(gz){ return -gz * TILE; }

// ── Lanes ─────────────────────────────────────────────────────────────────────
// Each lane is a row at integer gz, with kind ∈ {grass, road, river, rail}.
// Lane record: { gz, kind, group, mobs: [], dir, speed, spawnEvery, spawnT,
//                trainState? }

let lastKind = null;
let kindRun = 0;

function pickKind(gz){
  // Force start area to be safe grass
  if (gz <= 2) return 'grass';
  // After 3 of same kind, force grass break
  if (kindRun >= 3 && lastKind !== 'grass') return 'grass';
  // 30% chance to insert grass after any non-grass
  if (lastKind && lastKind !== 'grass' && Math.random() < 0.35) return 'grass';
  // Weighted random
  const r = Math.random();
  if (r < 0.40) return 'road';
  if (r < 0.65) return 'river';
  if (r < 0.78) return 'rail';
  return 'grass';
}

function addLane(gz){
  if (lanesByGz.has(gz)) return;
  const kind = pickKind(gz);
  if (kind === lastKind) kindRun++; else { kindRun = 1; lastKind = kind; }

  const lane = { gz, kind, group: new THREE.Group(), mobs: [],
    dir: Math.random() < 0.5 ? -1 : 1, speed: 0, spawnEvery: 0, spawnT: 0, decor: [] };

  // Lane tile geometry — top "skin" (grass/asphalt/water/wood) thin slab,
  // plus a thick dirt slab below to give the offscreen edge a cliff/cross-section look.
  const tileMat   = laneTileMat(kind, gz);
  const baseHeight = kind === 'river' ? 0.10 : 0.20;
  const topY       = kind === 'river' ? -0.08 : 0.20;   // y of top surface
  const W          = 2 * KILL_X + 4;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(W, baseHeight, TILE),
    tileMat
  );
  base.position.set(0, topY - baseHeight/2, wZ(gz));
  base.receiveShadow = true;
  lane.group.add(base);

  // Grass gets a thin dark soil-horizon band right under the green —
  // reads as the root layer of a sod stratum when seen from the side.
  if (kind === 'grass'){
    const horizonH = 0.06;
    const horizon = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.02, horizonH, TILE + 0.02),
      mat(0x4a3119)
    );
    horizon.position.set(0, topY - baseHeight - horizonH/2, wZ(gz));
    horizon.receiveShadow = true;
    lane.group.add(horizon);
  }

  // Thick layered earth cross-section extending below the viewport — stacked
  // strata bands (topsoil / clay / rock) plus occasional buried details
  // (bones, boulders, old pipes) peeking out of the +Z cliff face.
  const dirtTopY = kind === 'grass' ? (topY - baseHeight - 0.06)
                                    : (topY - baseHeight);
  buildStrata(lane, kind, W, dirtTopY);

  // Per-kind detail layer
  if (kind === 'grass') decorateGrass(lane);
  else if (kind === 'road') decorateRoad(lane);
  else if (kind === 'river') decorateRiver(lane);
  else if (kind === 'rail') decorateRail(lane);

  scene.add(lane.group);
  lanesByGz.set(gz, lane);
  if (gz > furthestAhead) furthestAhead = gz;
  if (gz < furthestBehind) furthestBehind = gz;
}

function removeLane(gz){
  const lane = lanesByGz.get(gz);
  if (!lane) return;
  scene.remove(lane.group);
  lane.group.traverse(o => {
    if (o.isMesh) { o.geometry?.dispose?.(); }
  });
  lanesByGz.delete(gz);
}

// ── Ground strata (the cliff cross-section under each lane) ───────────────────
const SOIL_COLS = [0x6b4a2e, 0x73502f, 0x5f4329];
const CLAY_COLS = [0xa9743f, 0x9c6b3f, 0xb07b46, 0x8f6238];
const ROCK_COLS = [0x595550, 0x4f4b47, 0x615c56, 0x534f4a];
const pick = arr => arr[(Math.random() * arr.length) | 0];

function slab(W, h, col, y, gz, w2){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w2 || W, h, TILE), mat(col));
  m.position.set(0, y - h/2, wZ(gz));
  m.receiveShadow = true;
  return m;
}

function buildStrata(lane, kind, W, topYin){
  const gz = lane.gz;

  if (kind === 'river'){
    // deep murky water column + dark silt bed
    lane.group.add(slab(W, 2.3, 0x1f4a72, topYin, gz));
    lane.group.add(slab(W, 0.6, 0x123a30, topYin - 2.3, gz));
    return;
  }

  // Stacked earth bands, slight per-lane jitter so no two lanes read identical.
  const soilH = 0.30 + Math.random() * 0.08;
  const clayH = 0.60 + Math.random() * 0.20;
  const rockH = 1.85 + Math.random() * 0.30;
  let y = topYin;
  lane.group.add(slab(W, soilH, pick(SOIL_COLS), y, gz));                 y -= soilH;
  lane.group.add(slab(W, 0.05, 0x3a2a1c, y, gz, W + 0.04));               // crisp boundary line
  lane.group.add(slab(W, clayH, pick(CLAY_COLS), y, gz));                 y -= clayH;
  lane.group.add(slab(W, 0.05, 0x2f2a26, y, gz, W + 0.04));               // boundary line
  lane.group.add(slab(W, rockH, pick(ROCK_COLS), y, gz));

  buryDetails(lane, topYin);
}

function buryDetails(lane, topYin){
  const gz = lane.gz;
  // The cliff face that points at the camera. Details poke OUT past it (toward
  // +Z) so they read clearly when this lane scrolls to the screen edge; while
  // buried mid-field they're hidden inside the next lane, which is correct.
  const frontZ = wZ(gz) + TILE / 2;
  const n = 1 + (Math.random() < 0.7 ? 1 : 0) + (Math.random() < 0.4 ? 1 : 0);  // 1–3
  for (let i = 0; i < n; i++){
    const x = (Math.random() * 2 - 1) * 2.8;
    const r = Math.random();
    if (r < 0.38){
      // bleached buried bones — skull + ribcage, proud of the face
      const y = topYin - (0.55 + Math.random() * 1.0);
      const bone = 0xeae2d0;
      lane.group.add(ball(0.21, bone, x, y, frontZ + 0.05));
      lane.group.add(box(0.06, 0.06, 0.05, 0x241f1a, x - 0.07, y + 0.02, frontZ + 0.22));  // eye socket
      lane.group.add(box(0.06, 0.06, 0.05, 0x241f1a, x + 0.07, y + 0.02, frontZ + 0.22));
      lane.group.add(box(0.10, 0.07, 0.05, bone, x, y - 0.16, frontZ + 0.20));             // jaw
      for (let k = 0; k < 4; k++)
        lane.group.add(box(0.40, 0.06, 0.07, bone, x + 0.42 + k * 0.02, y - 0.20 - k * 0.14, frontZ + 0.06));  // ribs
    } else if (r < 0.70){
      // embedded boulder, clearly half-exposed
      const y = topYin - (0.6 + Math.random() * 1.1);
      const rad = 0.34 + Math.random() * 0.16;
      lane.group.add(ball(rad, pick(ROCK_COLS), x, y, frontZ + rad * 0.35, 0));
    } else {
      // old buried pipe, hollow cross-section toward camera
      const y = topYin - (0.5 + Math.random() * 1.0);
      const pipe = cyl(0.17, 0.17, 0.55, 8, 0x8a5230, x, y, frontZ + 0.1);
      pipe.rotation.x = Math.PI / 2;    // axis along Z → round end faces the camera
      lane.group.add(pipe);
      const hole = cyl(0.11, 0.11, 0.08, 8, 0x241a10, x, y, frontZ + 0.34);
      hole.rotation.x = Math.PI / 2;
      lane.group.add(hole);
    }
  }
}

// ── Lane materials ────────────────────────────────────────────────────────────
const matCache = new Map();
function mat(hex){
  if (!matCache.has(hex)) matCache.set(hex,
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.95, metalness: 0, flatShading: true }));
  return matCache.get(hex);
}
function laneTileMat(kind, gz){
  // Grass alternates two muted, slightly desaturated greens per row — the
  // manicured-lawn stripe reads more refined than a single neon slab.
  if (kind === 'grass') return mat((gz & 1) ? 0x93b34e : 0xa3c25a);
  if (kind === 'road')  return mat(0x3a3a40);
  if (kind === 'river') return mat(0x4a9fd6);
  if (kind === 'rail')  return mat(0x826344);
  return mat(0x888888);
}

// ── Decor + obstacle setup per lane ──────────────────────────────────────────
function decorateGrass(lane){
  // Scatter a few props as static obstacles (block one cell). NYC street objects:
  // fire hydrant, mailbox, news rack, pretzel cart (rare).
  const used = new Set();
  // Edge of map: always trees (block) so you can't run sideways forever
  for (let gx = HALF_WIDTH; gx <= HALF_WIDTH + 2; gx++){
    const tree = makeTree();
    tree.position.set(wX(gx), 0, wZ(lane.gz));
    lane.group.add(tree);
    lane.mobs.push({ kind:'block', gx, w:0.9 });
    used.add(gx);
    const tree2 = makeTree();
    tree2.position.set(wX(-gx), 0, wZ(lane.gz));
    lane.group.add(tree2);
    lane.mobs.push({ kind:'block', gx:-gx, w:0.9 });
    used.add(-gx);
  }
  // Inner scatter — mostly flora (it's a city park feel between roads),
  // with the metal NYC street objects as accent props.
  const propCount = 1 + Math.floor(Math.random() * 3);   // 1-3
  for (let i = 0; i < propCount; i++){
    const gx = (Math.random()*2-1) * (HALF_WIDTH-1) | 0;
    if (gx === 0 || used.has(gx)) continue;
    used.add(gx);
    const r = Math.random();
    let prop;
    if (r < 0.62)      prop = makeTree();        // 62% flora
    else if (r < 0.80) prop = makeHydrant();     // 18%
    else if (r < 0.92) prop = makeMailbox();     // 12%
    else               prop = makeNewsRack();    //  8%
    prop.position.set(wX(gx), 0, wZ(lane.gz));
    lane.group.add(prop);
    lane.mobs.push({ kind:'block', gx, w:0.8 });
  }
  // Occasional coin
  if (Math.random() < 0.45){
    let gx;
    let tries = 0;
    do { gx = (Math.random()*2-1) * (HALF_WIDTH-1) | 0; tries++; }
    while ((gx === 0 || used.has(gx)) && tries < 10);
    if (!used.has(gx) && gx !== 0){
      const coin = makeCoin();
      coin.position.set(wX(gx), 0.55, wZ(lane.gz));
      lane.group.add(coin);
      lane.mobs.push({ kind:'coin', gx, mesh:coin, taken:false });
    }
  }
}

function decorateRoad(lane){
  // Painted dashed centerline
  const dashMat = mat(0xf2c14e);
  for (let gx = -HALF_WIDTH; gx <= HALF_WIDTH; gx += 2){
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.02, 0.10),
      dashMat
    );
    dash.position.set(wX(gx)+0.5, 0.22, wZ(lane.gz));
    lane.group.add(dash);
  }
  // Car traffic params
  const tier = Math.min(8, Math.floor(runDistance / 25));
  lane.speed = (1.6 + Math.random() * 1.4 + tier * 0.15);     // tiles/sec
  lane.dir = Math.random() < 0.5 ? -1 : 1;
  lane.spawnEvery = 1.4 + Math.random() * 1.8;               // seconds
  lane.spawnT = Math.random() * lane.spawnEvery;
}

function decorateRiver(lane){
  // Floating logs only — no obstacles other than missing log = drown
  lane.speed = 1.1 + Math.random() * 1.2;
  lane.dir = Math.random() < 0.5 ? -1 : 1;
  lane.spawnEvery = 1.6 + Math.random() * 1.6;
  lane.spawnT = Math.random() * lane.spawnEvery;
}

function decorateRail(lane){
  // Two steel rails along the X axis
  const railMat = mat(0xb0b6bd);
  for (const off of [-0.28, 0.28]){
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(2 * KILL_X + 4, 0.08, 0.10),
      railMat
    );
    rail.position.set(0, 0.24, wZ(lane.gz) + off);
    rail.receiveShadow = true;
    lane.group.add(rail);
  }
  // Wooden ties
  const tieMat = mat(0x5e3d24);
  for (let gx = -HALF_WIDTH-1; gx <= HALF_WIDTH+1; gx++){
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.06, 0.85),
      tieMat
    );
    tie.position.set(wX(gx), 0.22, wZ(lane.gz));
    tie.receiveShadow = true;
    lane.group.add(tie);
  }
  // Warning strip (a small post on each edge)
  const warnMat = new THREE.MeshStandardMaterial({ color: 0xff4438, roughness: 0.8 });
  const warn = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), warnMat);
  warn.position.set(wX(HALF_WIDTH + 1.5), 0.25, wZ(lane.gz));
  lane.group.add(warn);
  lane.warnMat = warnMat;
  // Trains heralded by warning blink
  lane.trainState = 'idle';          // idle | warning | passing | cooldown
  lane.trainT = 3 + Math.random() * 4;
  lane.trainDir = Math.random() < 0.5 ? -1 : 1;
}

// ── Decor builders (NYC street props) ────────────────────────────────────────
// Wrapper: each tile picks one of a few flora variants for visual variety.
function makeTree(){
  const r = Math.random();
  if (r < 0.42) return makeMaple();
  if (r < 0.66) return makePine();
  if (r < 0.85) return makeBush();
  return makePlanter();
}
function makeMaple(){
  const g = new THREE.Group();
  // trunk
  g.add(box(0.34, 0.65, 0.34, P.bark, 0, 0.32, 0));
  const palette = [0x3a8a32, 0x4ea03e, 0x6b9a3e, 0x55903a];
  const leafCol = palette[Math.floor(Math.random()*palette.length)];
  const leafMat = new THREE.MeshStandardMaterial({ color: leafCol, roughness: 0.95, flatShading: true });
  const ic = new THREE.IcosahedronGeometry(0.55, 0);
  // 5-ball cluster — wider canopy, irregular silhouette
  const clumps = [
    [ 0.00, 1.05,  0.00, 1.10],
    [-0.42, 1.00,  0.10, 0.85],
    [ 0.38, 0.96, -0.18, 0.85],
    [ 0.18, 1.34,  0.30, 0.95],
    [-0.10, 1.44, -0.10, 0.95],
  ];
  for (const [x, y, z, s] of clumps){
    const m = new THREE.Mesh(ic, leafMat);
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    g.add(m);
  }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makePine(){
  const g = new THREE.Group();
  g.add(box(0.26, 0.45, 0.26, 0x5e3d24, 0, 0.22, 0));
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x2e6d3a, roughness: 0.95, flatShading: true });
  // three tapered cone tiers
  const tiers = [[0.62, 0.68, 0.60], [0.50, 0.60, 1.08], [0.34, 0.50, 1.52]];
  for (const [r, h, y] of tiers){
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), pineMat);
    c.position.y = y;
    g.add(c);
  }
  // tiny star top (rare gold cap)
  if (Math.random() < 0.15){
    g.add(box(0.06, 0.10, 0.06, 0xf2c14e, 0, 1.82, 0));
  }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeBush(){
  const g = new THREE.Group();
  const palette = [0x4a8d3f, 0x5a9c4a, 0x4a8a55];
  const bushMat = new THREE.MeshStandardMaterial({ color: palette[Math.floor(Math.random()*palette.length)], roughness: 0.95, flatShading: true });
  const ic = new THREE.IcosahedronGeometry(0.36, 0);
  const positions = [
    [ 0.00, 0.30,  0.00, 1.00],
    [-0.22, 0.28,  0.18, 0.80],
    [ 0.20, 0.26, -0.16, 0.80],
    [ 0.04, 0.44, -0.06, 0.75],
  ];
  for (const [x, y, z, s] of positions){
    const m = new THREE.Mesh(ic, bushMat);
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    g.add(m);
  }
  // 50% chance of flower / berry sprinkle
  if (Math.random() < 0.55){
    const flowerHex = [0xe04060, 0xffd644, 0xff7e3a, 0xf2f0e6][Math.floor(Math.random()*4)];
    const fMat = new THREE.MeshStandardMaterial({ color: flowerHex, roughness: 0.7, flatShading: true });
    const sphere = new THREE.SphereGeometry(0.07, 4, 4);
    for (let i = 0; i < 5; i++){
      const f = new THREE.Mesh(sphere, fMat);
      f.position.set((Math.random()-0.5)*0.55, 0.40 + Math.random()*0.18, (Math.random()-0.5)*0.55);
      g.add(f);
    }
  }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makePlanter(){
  // Concrete sidewalk planter w/ little stems
  const g = new THREE.Group();
  g.add(box(0.80, 0.32, 0.80, 0xb0a89a, 0, 0.16, 0));
  g.add(box(0.84, 0.06, 0.84, 0x8a8276, 0, 0.32, 0));         // rim
  g.add(box(0.72, 0.04, 0.72, 0x4a3119, 0, 0.34, 0));         // dirt fill
  // a few stems with little flower heads
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a8a32, roughness: 0.95, flatShading: true });
  const flowerPalette = [0xe04060, 0xffd644, 0xff7e3a, 0xf2f0e6, 0xb05de8];
  const sphere = new THREE.SphereGeometry(0.07, 4, 4);
  for (let i = 0; i < 6; i++){
    const x = (Math.random() - 0.5) * 0.5;
    const z = (Math.random() - 0.5) * 0.5;
    const h = 0.20 + Math.random() * 0.18;
    const stem = box(0.05, h, 0.05, 0x3a8a32, x, 0.36 + h/2, z);
    g.add(stem);
    const fMat = new THREE.MeshStandardMaterial({ color: flowerPalette[Math.floor(Math.random()*flowerPalette.length)], roughness: 0.7, flatShading: true });
    const f = new THREE.Mesh(sphere, fMat);
    f.position.set(x, 0.36 + h + 0.05, z);
    g.add(f);
  }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeHydrant(){
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xe0483b, roughness: 0.7, flatShading: true });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.55, 8), m);
  top.position.y = 0.28; g.add(top);
  g.add(box(0.42, 0.12, 0.42, 0xe0483b, 0, 0.06, 0));
  // side nozzles
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 8), m);
  noz.rotation.z = Math.PI/2; noz.position.set(0.18, 0.32, 0);
  g.add(noz);
  // top cap
  g.add(box(0.18, 0.10, 0.18, 0xb6342a, 0, 0.6, 0));
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeMailbox(){
  const g = new THREE.Group();
  g.add(box(0.55, 0.55, 0.42, 0x3266a8, 0, 0.4, 0));
  g.add(box(0.55, 0.10, 0.42, 0x244b80, 0, 0.7, 0));
  g.add(box(0.1, 0.15, 0.1, P.ironD, 0, 0.13, 0));
  // little white usps stripe
  g.add(box(0.04, 0.10, 0.42, 0xfff7e6, 0.275, 0.34, 0));
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeNewsRack(){
  const g = new THREE.Group();
  g.add(box(0.6, 0.85, 0.45, P.ironD, 0, 0.45, 0));
  g.add(box(0.5, 0.22, 0.04, 0xf2c14e, 0, 0.7, 0.23));   // sticker
  g.add(box(0.5, 0.04, 0.46, 0xf2c14e, 0, 0.85, 0));      // top
  // 4 small legs
  for (const x of [-0.22, 0.22]){
    for (const z of [-0.18, 0.18]){
      g.add(box(0.04, 0.10, 0.04, 0x15110e, x, 0.05, z));
    }
  }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeCoin(){
  const m = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.4, metalness: 0.7, emissive: 0x553300, emissiveIntensity: 0.25, flatShading: true });
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), m);
  c.rotation.x = Math.PI/2;
  c.castShadow = true;
  c.userData.spinAxis = true;
  return c;
}

// ── Vehicle builders ─────────────────────────────────────────────────────────
// Crossy Road register: 2-3 box silhouette + glass-box cabin + chunky round
// wheels that poke out past the body. 1-2 signature details per vehicle, max.
function _addWheels(g, list, tireR, tireT, hubColor){
  const tireMat = mat(0x241f1c);
  const hubMat  = mat(hubColor || 0xb5b0a8);
  for (const [x, z] of list){
    // axle along Z (perpendicular to travel) so the round face shows to the side camera
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(tireR, tireR, tireT, 16), tireMat);
    tire.rotation.x = Math.PI/2; tire.position.set(x, tireR, z);
    g.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(tireR * 0.5, tireR * 0.5, tireT + 0.03, 10), hubMat);
    hub.rotation.x = Math.PI/2; hub.position.set(x, tireR, z);
    g.add(hub);
  }
}
// vehicle lamp — a box on a shared emissive material so all lamps glow at once
function lamp(w, h, d, material, x, y, z){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function makeTaxi(){
  const g = new THREE.Group();
  const yellow = 0xffce2e;
  const glass  = 0x9bcfe0;
  // body (one chunky slab)
  g.add(box(1.95, 0.42, 0.92, yellow, 0, 0.45, 0));
  // checker band — signature #1
  for (let i = 0; i < 9; i++){
    const cc = (i % 2 === 0) ? 0x15110e : 0xffffff;
    g.add(box(0.213, 0.10, 0.94, cc, -0.852 + i * 0.213, 0.32, 0));
  }
  // cabin = glass box, roof slab on top (windows read on all 4 sides for free)
  g.add(box(1.00, 0.28, 0.80, glass, -0.10, 0.80, 0));
  g.add(box(1.10, 0.08, 0.88, yellow, -0.10, 0.98, 0));
  // TAXI roof sign — signature #2
  g.add(box(0.50, 0.16, 0.20, 0xfff7e6, -0.10, 1.10, 0));
  g.add(box(0.42, 0.09, 0.02, 0x15110e, -0.10, 1.11, 0.105));
  g.add(box(0.42, 0.09, 0.02, 0x15110e, -0.10, 1.11, -0.105));
  // headlights / taillights
  for (const z of [0.30, -0.30]){
    g.add(lamp(0.05, 0.10, 0.16, matHead, 0.99, 0.48, z));
    g.add(lamp(0.05, 0.10, 0.16, matTail, -0.99, 0.48, z));
  }
  _addWheels(g, [[0.65, 0.45],[0.65,-0.45],[-0.65, 0.45],[-0.65,-0.45]], 0.24, 0.26, 0xd0c8b0);
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeSedan(){
  const g = new THREE.Group();
  const palette = [0xe0483b, 0x36a3ec, 0x4fae44, 0xb05de8, 0xe89534, 0x6b59c8, 0xf6f1e6];
  const bodyCol = palette[Math.floor(Math.random()*palette.length)];
  const glass = 0x9bcfe0;
  // body + glass cabin + roof — that's the whole car
  g.add(box(1.75, 0.40, 0.88, bodyCol, 0, 0.42, 0));
  g.add(box(0.95, 0.26, 0.74, glass, -0.06, 0.75, 0));
  g.add(box(1.04, 0.08, 0.82, bodyCol, -0.06, 0.92, 0));
  for (const z of [0.28, -0.28]){
    g.add(lamp(0.05, 0.09, 0.15, matHead, 0.89, 0.45, z));
    g.add(lamp(0.05, 0.09, 0.15, matTail, -0.89, 0.45, z));
  }
  _addWheels(g, [[0.58, 0.42],[0.58,-0.42],[-0.58, 0.42],[-0.58,-0.42]], 0.22, 0.24, 0xa8a09a);
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeTruck(){
  const g = new THREE.Group();
  const cabPalette = [0xf4f1e8, 0xb45642, 0x4e6d8f, 0x9c7e5a, 0xe4523c];
  const cabCol = cabPalette[Math.floor(Math.random()*cabPalette.length)];
  const glass = 0x9bcfe0;
  // cab: body + glass band + roof
  g.add(box(0.95, 0.50, 0.95, cabCol, 0.85, 0.45, 0));
  g.add(box(0.85, 0.26, 0.82, glass, 0.83, 0.83, 0));
  g.add(box(0.95, 0.08, 0.90, darken(cabCol, 0.8), 0.85, 1.00, 0));
  // cargo box (big clean slab) + darker rear door panel
  g.add(box(1.55, 1.10, 0.98, 0xd8cfba, -0.45, 0.77, 0));
  g.add(box(0.03, 0.95, 0.86, 0x9a8c70, -1.23, 0.72, 0));
  // chrome exhaust stack — signature
  g.add(box(0.09, 0.72, 0.09, 0xc8c2b0, 0.34, 0.86, 0.40));
  g.add(box(0.12, 0.06, 0.12, 0x241f1c, 0.34, 1.24, 0.40));
  // headlights
  for (const z of [0.32, -0.32]){
    g.add(lamp(0.05, 0.11, 0.16, matHead, 1.33, 0.40, z));
  }
  // rear taillights
  for (const z of [0.32, -0.32]){
    g.add(lamp(0.04, 0.10, 0.14, matTail, -1.24, 0.40, z));
  }
  _addWheels(g, [[0.92, 0.5],[0.92,-0.5],[-0.40, 0.5],[-0.40,-0.5],[-1.00, 0.5],[-1.00,-0.5]], 0.25, 0.26, 0x8a857f);
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function pickCar(){
  const r = Math.random();
  if (r < 0.45) return { mesh: makeTaxi(),  width: 1.9 };
  if (r < 0.85) return { mesh: makeSedan(), width: 1.7 };
  return { mesh: makeTruck(), width: 2.45 };
}

function makeLog(){
  const g = new THREE.Group();
  // 3-tile-long log (~2.6 wide on x)
  const mLog = new THREE.MeshStandardMaterial({ color: 0x7c5230, roughness: 0.95, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.6, 10), mLog);
  trunk.rotation.z = Math.PI/2;
  trunk.position.y = 0.04;     // sits about flush with river top (~-0.08)
  g.add(trunk);
  // end caps with concentric rings (lighter inner)
  for (const x of [-1.30, 1.30]){
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 10), mat(0x5e3d24));
    outer.rotation.z = Math.PI/2; outer.position.set(x, 0.04, 0); g.add(outer);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.05, 10), mat(0xa37752));
    inner.rotation.z = Math.PI/2; inner.position.set(x, 0.04, 0); g.add(inner);
  }
  // a couple of small bark knots on top
  for (let i = 0; i < 2; i++){
    const kx = (Math.random() - 0.5) * 1.8;
    const k = box(0.10, 0.04, 0.10, 0x5e3d24, kx, 0.36, (Math.random() - 0.5) * 0.18);
    g.add(k);
  }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function makeTrainCar(){
  const g = new THREE.Group();
  // dark undercarriage gap + silver body + roof
  g.add(box(3.60, 0.14, 0.80, 0x1f1d22, 0, 0.12, 0));
  g.add(box(3.60, 0.78, 0.90, 0x9094a0, 0, 0.58, 0));
  g.add(box(3.44, 0.10, 0.94, 0x6f747e, 0, 1.02, 0));
  // red MTA stripe — signature #1
  g.add(box(3.62, 0.12, 0.92, 0xe0483b, 0, 0.33, 0));
  // one long window band per side (no per-window slicing)
  for (const z of [0.46, -0.46]){
    g.add(box(2.90, 0.26, 0.04, 0x6cb8d1, 0, 0.76, z));
  }
  // route letter circle (F line) — signature #2
  for (const x of [1.50, -1.50]){
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 12), mat(0xf2c14e));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.51, 0.46);
    g.add(ring);
  }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ── Spawning + updating obstacles ────────────────────────────────────────────
function spawnCar(lane){
  const car = pickCar();
  const m = car.mesh;
  const startX = lane.dir > 0 ? -KILL_X - 2 : KILL_X + 2;
  m.position.set(startX, SURFACE_Y, wZ(lane.gz));
  if (lane.dir < 0) m.rotation.y = Math.PI;
  lane.group.add(m);
  lane.mobs.push({ kind:'car', mesh:m, x:startX, dir:lane.dir, speed:lane.speed, width:car.width });
}
function spawnLog(lane){
  const m = makeLog();
  const startX = lane.dir > 0 ? -KILL_X - 3 : KILL_X + 3;
  m.position.set(startX, 0, wZ(lane.gz));
  lane.group.add(m);
  lane.mobs.push({ kind:'log', mesh:m, x:startX, dir:lane.dir, speed:lane.speed, width:2.6 });
}
function spawnTrain(lane){
  // 3-car train
  const cars = [];
  const startX = lane.trainDir > 0 ? -KILL_X - 10 : KILL_X + 10;
  for (let i = 0; i < 3; i++){
    const m = makeTrainCar();
    const offset = i * 3.8 * -lane.trainDir;
    m.position.set(startX + offset, SURFACE_Y, wZ(lane.gz));
    lane.group.add(m);
    cars.push(m);
  }
  lane.mobs.push({ kind:'train', cars, x:startX, dir:lane.trainDir, speed:14, width:11 });
}

function updateLaneObstacles(lane, dt){
  if (lane.kind === 'road'){
    lane.spawnT -= dt;
    if (lane.spawnT <= 0){
      spawnCar(lane);
      lane.spawnT = lane.spawnEvery * (0.7 + Math.random() * 0.6);
    }
  } else if (lane.kind === 'river'){
    lane.spawnT -= dt;
    if (lane.spawnT <= 0){
      spawnLog(lane);
      lane.spawnT = lane.spawnEvery * (0.7 + Math.random() * 0.6);
    }
  } else if (lane.kind === 'rail'){
    lane.trainT -= dt;
    if (lane.trainState === 'idle' && lane.trainT <= 0){
      lane.trainState = 'warning';
      lane.trainT = 1.6;
    } else if (lane.trainState === 'warning'){
      // blink the warn post
      lane.warnMat.emissive.setHex(0xff4438);
      lane.warnMat.emissiveIntensity = (Math.sin(performance.now() * 0.025) + 1) * 0.5;
      if (lane.trainT <= 0){
        lane.trainState = 'passing';
        spawnTrain(lane);
        lane.trainT = 2.0;
      }
    } else if (lane.trainState === 'passing'){
      lane.warnMat.emissiveIntensity = 0;
      if (lane.trainT <= 0){
        lane.trainState = 'cooldown';
        lane.trainT = 3 + Math.random() * 5;
      }
    } else if (lane.trainState === 'cooldown'){
      if (lane.trainT <= 0){
        lane.trainState = 'idle';
        lane.trainT = 2 + Math.random() * 3;
      }
    }
  }

  // Move mobs
  for (let i = lane.mobs.length - 1; i >= 0; i--){
    const m = lane.mobs[i];
    if (m.kind === 'car' || m.kind === 'log'){
      m.x += m.dir * m.speed * dt;
      m.mesh.position.x = m.x;
      // recycle off-screen
      if ((m.dir > 0 && m.x > KILL_X + 4) || (m.dir < 0 && m.x < -KILL_X - 4)){
        lane.group.remove(m.mesh);
        lane.mobs.splice(i, 1);
      }
    } else if (m.kind === 'train'){
      m.x += m.dir * m.speed * dt;
      for (let j = 0; j < m.cars.length; j++){
        const offset = j * 3.8 * -m.dir;
        m.cars[j].position.x = m.x + offset;
      }
      // recycle when last car off-screen
      const last = m.cars[m.cars.length - 1].position.x;
      if ((m.dir > 0 && last > KILL_X + 12) || (m.dir < 0 && last < -KILL_X - 12)){
        for (const c of m.cars) lane.group.remove(c);
        lane.mobs.splice(i, 1);
      }
    } else if (m.kind === 'coin' && !m.taken){
      m.mesh.rotation.z += dt * 3;
      m.mesh.position.y = 0.55 + Math.sin(performance.now() * 0.003 + m.gx) * 0.05;
    }
  }
}

// ── Input ────────────────────────────────────────────────────────────────────
function attachInput(){
  // Touch input: tap *position* directly picks a direction, no swipe needed.
  // Player's screen position is roughly canvas-center, so:
  //   tap upper area  → forward
  //   tap lower area  → back
  //   tap left/right  → step that way
  //   tap near center → default forward
  // Swipe is still honored as a fallback for users who reflexively swipe.
  let downX = 0, downY = 0, downT = 0;
  let skipNextUp = false;
  const SWIPE = 30;
  const DEAD_R = 36;        // any tap within DEAD_R of center → forward
  const SIDE_RATIO = 1.15;
  const onDown = (e) => {
    initAudio();   // first touch unlocks/creates the AudioContext
    if (player.dead) { restart(); skipNextUp = true; return; }
    downX = e.clientX; downY = e.clientY; downT = performance.now();
  };
  const onUp = (e) => {
    if (skipNextUp) { skipNextUp = false; return; }
    if (player.dead) return;
    const dx = e.clientX - downX, dy = e.clientY - downY;
    const moved = Math.hypot(dx, dy);
    if (moved >= SWIPE){
      // Real swipe: use direction
      if (Math.abs(dx) > Math.abs(dy)) tryHop(dx > 0 ? 1 : -1, 0);
      else tryHop(0, dy > 0 ? -1 : 1);
      return;
    }
    // Mistouch shield: a static tap near the D-pad (when shown) or its toggle
    // is a missed button press — swallowing it beats reading it as a
    // directional hop (bottom taps would otherwise parse as back, which kills).
    for (const id of ['dpad', 'padToggle']){
      const el = document.getElementById(id);
      if (!el || el.classList.contains('hidden')) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX > r.left - 30 && e.clientX < r.right + 30 &&
          e.clientY > r.top  - 30 && e.clientY < r.bottom + 30) return;
    }
    // Static tap: decide by where on the canvas they tapped, relative to its center.
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top  + rect.height / 2);
    const ax = Math.abs(cx), ay = Math.abs(cy);
    if (Math.hypot(cx, cy) < DEAD_R){ tryHop(0, 1); return; }
    if (ax > ay * SIDE_RATIO){
      tryHop(cx > 0 ? 1 : -1, 0);
    } else {
      tryHop(0, cy < 0 ? 1 : -1);   // upper canvas = forward, lower = back
    }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  // Keyboard for desktop debug
  window.addEventListener('keydown', (e) => {
    initAudio();
    if (player.dead && (e.key === 'r' || e.key === 'R' || e.key === ' ')){ restart(); return; }
    if (e.key === 'ArrowUp' || e.key === 'w') tryHop(0, 1);
    else if (e.key === 'ArrowDown' || e.key === 's') tryHop(0, -1);
    else if (e.key === 'ArrowLeft' || e.key === 'a') tryHop(-1, 0);
    else if (e.key === 'ArrowRight' || e.key === 'd') tryHop(1, 0);
  });
}

function tryHop(dx, dz){
  if (player.hopping || player.dead || player.bump) return;

  const baseGx   = player.riding ? Math.round(player.worldX) : player.gx;
  const targetGx = baseGx + dx;
  const targetGz = player.gz + dz;

  // Blocked? off the playable strip, no lane, or a static block sits there
  let blocked = Math.abs(targetGx) > HALF_WIDTH;
  const targetLane = lanesByGz.get(targetGz);
  if (!targetLane) blocked = true;
  else for (const m of targetLane.mobs){
    if (m.kind === 'block' && m.gx === targetGx){ blocked = true; break; }
  }
  if (blocked){ bumpInPlace(dx, dz); return; }

  if (!started) started = true;

  // Detach from log if riding — current gx is rounded from worldX
  if (player.riding){
    player.gx = baseGx;
    player.riding = null;
  }

  // Begin hop
  player.step ^= 1;            // alternate which leg leads
  player.hopping = true;
  player.hopT = 0;
  player.hopFromX = wX(player.gx); player.hopFromZ = wZ(player.gz);
  player.hopToX   = wX(targetGx);  player.hopToZ   = wZ(targetGz);
  player.gx = targetGx;
  player.gz = targetGz;
  player.facing = Math.atan2(dx, -dz);   // face along hop direction
  SFX.hop();

  // distance score = furthest gz reached
  if (targetGz > runDistance){
    runDistance = targetGz;
    hud.setDistance(runDistance);
  }
}

function bumpInPlace(dx, dz){
  if (player.hopping || player.bump || player.dead) return;
  player.bump = { t: 0, dx, dz };
  player.facing = Math.atan2(dx, -dz);   // turn to face the wall we hit
  SFX.blocked();
}

// ── Game loop ────────────────────────────────────────────────────────────────
function tick(){
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());

  if (player.grace > 0) player.grace = Math.max(0, player.grace - dt);

  // Update player hop animation
  if (player.hopping){
    player.hopT += dt;
    const t = Math.min(1, player.hopT / player.hopDur);
    const ease = t * (2 - t);
    const x = player.hopFromX + (player.hopToX - player.hopFromX) * ease;
    const z = player.hopFromZ + (player.hopToZ - player.hopFromZ) * ease;
    const y = SURFACE_Y + Math.sin(Math.PI * t) * player.hopHeight;
    player.worldX = x;
    playerMesh.position.set(x, y, z);
    // slight squash anim
    playerMesh.scale.y = PLAYER_SCALE * (1 - 0.18 * Math.sin(Math.PI * t));
    // arms + legs swing through the leap
    poseLimbs(Math.sin(Math.PI * t), player.step ? 1 : -1);
    // smooth turn toward facing
    playerMesh.rotation.y = lerpAngle(playerMesh.rotation.y, player.facing, 12 * dt);
    if (t >= 1){
      player.hopping = false;
      playerMesh.scale.y = PLAYER_SCALE;
      restLimbs();
      onLand();
    }
  } else if (player.bump){
    // in-place bounce when a hop was blocked (still registers the tap visually)
    player.bump.t += dt;
    const bt = Math.min(1, player.bump.t / 0.16);
    const arc = Math.sin(Math.PI * bt);
    const lean = arc * 0.16;
    playerMesh.position.set(
      player.worldX + player.bump.dx * lean * 0.35,
      SURFACE_Y + arc * 0.18,
      wZ(player.gz) + (-player.bump.dz) * lean * 0.35
    );
    playerMesh.scale.y = PLAYER_SCALE * (1 - 0.12 * arc);
    poseLimbs(arc * 0.6, 1);   // small shuffle so a blocked tap still animates
    playerMesh.rotation.y = lerpAngle(playerMesh.rotation.y, player.facing, 16 * dt);
    if (bt >= 1){
      player.bump = null;
      playerMesh.scale.y = PLAYER_SCALE;
      playerMesh.position.set(player.worldX, SURFACE_Y, wZ(player.gz));
      restLimbs();
    }
  } else if (!player.dead){
    // Idle bounce — perky hop-in-place: ball-bounce height, squash on landing /
    // stretch at the apex, arms & legs lift on the way up.
    const t = performance.now() * 0.001;
    const air = Math.abs(Math.sin(t * 3.2));          // 0 = on the ground, 1 = apex, ~1s bounces
    playerMesh.position.y = SURFACE_Y + 0.06 * air;   // rest feet on the surface; small hop never dips below it
    playerMesh.scale.y = PLAYER_SCALE * (1 + 0.05 * air);   // stretch up only — never compress below rest, so feet stay put
    if (playerRig && player.rigBase){
      const b = player.rigBase;
      playerRig.armL.rotation.x = b.armL - 0.14 * air;
      playerRig.armR.rotation.x = b.armR - 0.14 * air;
      playerRig.legL.rotation.x = b.legL;   // legs stay at rest so feet never swing under the ground
      playerRig.legR.rotation.x = b.legR;
    }
  }

  // Drown sink animation
  if (player.dead && player.sinking){
    playerMesh.position.y = lerp(playerMesh.position.y, -1.6, 5 * dt);
    const ns = lerp(playerMesh.scale.x, PLAYER_SCALE * 0.3, 5 * dt);
    playerMesh.scale.set(ns, ns, ns);
  }

  fxUpdate(dt);
  puffUpdate(dt);

  // Update lanes (spawn + move obstacles)
  for (const lane of lanesByGz.values()){
    updateLaneObstacles(lane, dt);
  }

  // If riding a log, follow it
  if (player.riding && !player.hopping){
    const r = player.riding;
    player.worldX = r.log.x + r.offsetX;
    playerMesh.position.x = player.worldX;
    // dead if carried off the playable strip
    if (Math.abs(player.worldX) > KILL_X && player.grace <= 0){ die('drift'); }
  }

  // Collision check while NOT hopping (player on a tile)
  if (!player.hopping && !player.dead){
    checkLaneHazards();
  }

  // Coin pickup (cheap radius check on current lane only)
  if (!player.dead){
    const lane = lanesByGz.get(player.gz);
    if (lane){
      for (const m of lane.mobs){
        if (m.kind === 'coin' && !m.taken){
          if (Math.abs(player.worldX - wX(m.gx)) < 0.45){
            m.taken = true;
            m.mesh.visible = false;
            coins++;
            SFX.coin();
            burst(wX(m.gx), 0.4, wZ(lane.gz), { count: 6, color: [0xffd95e, 0xfff2b0], speed: 1.6, up: 2.0, size: 0.1, life: 0.4 });
            try { localStorage.setItem('bh.coins', String(coins)); } catch(e){}
            hud.setCoin(coins);
          }
        }
      }
    }
  }

  // Lane streaming
  if (player.gz + 10 > furthestAhead){
    for (let gz = furthestAhead + 1; gz <= player.gz + 14; gz++) addLane(gz);
  }
  while (furthestBehind < player.gz - 8){
    removeLane(furthestBehind);
    furthestBehind++;
  }

  // Camera follow — tiny yaw so +Z forward stays close to "screen up"
  const targetCamZ = wZ(player.gz) + 11;
  const targetCamX = player.worldX + 2;
  camera.position.x = lerp(camera.position.x, targetCamX, 6 * dt);
  camera.position.z = lerp(camera.position.z, targetCamZ, 6 * dt);
  camera.position.y = 14;
  camera.lookAt(player.worldX, 0, wZ(player.gz) - 0.5);

  // Day/night cycle — sweeps light colour, intensity, sun angle + headlights
  updateDayNight(dt);
  updateWeather(dt);
  sunTarget.position.set(player.worldX, 0, wZ(player.gz));

  renderer.render(scene, camera);
}

// Advances a smooth day→night loop: light colour/intensity, sun angle (so
// shadows sweep), sky + fog tint, and vehicle headlight glow after dark.
function updateDayNight(dt){
  dayT += dt;
  // Warp the clock so daylight (sun above horizon, first half of the sine)
  // takes DAY_FRAC of real time and night only the remainder.
  const DAY_FRAC = 0.68;
  const u = (dayT % DAY_CYCLE) / DAY_CYCLE;
  const ph = u < DAY_FRAC
    ? (u / DAY_FRAC) * 0.5
    : 0.5 + ((u - DAY_FRAC) / (1 - DAY_FRAC)) * 0.5;   // 0..1 around the clock
  const sunHeight = Math.sin(ph * Math.PI * 2);        // -1 (deep night) .. 1 (noon)
  const day = THREE.MathUtils.smoothstep(sunHeight, -0.28, 0.28);  // 0 night → 1 day
  const night = 1 - day;

  // Golden-hour glow peaks when the sun is near the horizon (sunrise & sunset).
  const horizon = Math.max(0, 1 - Math.abs(sunHeight) / 0.5);
  const rising  = Math.cos(ph * Math.PI * 2) > 0;   // sunrise side vs sunset side

  // Light levels — night keeps a generous floor so it stays readable (just blue, not dark)
  sun.intensity     = 0.42 + 0.70 * day;
  ambient.intensity = 0.40 + 0.30 * day;
  fill.intensity    = 0.20 + 0.16 * day;

  // Sky + fog: night→day base, then push toward warm horizon colour at dawn/dusk
  _dnSky.copy(SKY_NIGHT).lerp(SKY_DAY, day);
  _dnSky.lerp(rising ? SKY_DAWN : SKY_DUSK, horizon * 0.78);
  scene.background.copy(_dnSky);
  scene.fog.color.copy(_dnSky);

  // Sun colour: cool night → neutral-warm day → strong golden at the horizon
  _dnSun.copy(SUN_NIGHT).lerp(SUN_DAY, day);
  _dnSun.lerp(rising ? SUN_DAWN : SUN_DUSK, horizon * 0.85);
  sun.color.copy(_dnSun);

  // Ambient colour: blue night → white day → warm at golden hour
  _dnAmb.copy(AMB_NIGHT).lerp(AMB_DAY, day);
  _dnAmb.lerp(AMB_WARM, horizon * 0.55);
  ambient.color.copy(_dnAmb);

  // Sun position: orbit around the player so the shadow direction sweeps.
  const az = ph * Math.PI * 2;
  const px = player.worldX, pz = wZ(player.gz);
  sun.position.set(px + Math.cos(az) * 9, 9 + 9 * Math.max(0, sunHeight), pz + Math.sin(az) * 9 + 3);

  // Headlights glow once it gets dark
  matHead.emissiveIntensity = night * 1.5;
  matTail.emissiveIntensity = night * 1.1;
}

// ── Weather: passing spells of rain / snow / fog with smooth fades ───────────
const FOG_NEAR = 28, FOG_FAR = 44;                  // clear-sky baseline (matches init)
const OVERCAST = new THREE.Color(0xb4bcc6);
const wRand = (a, b) => a + Math.random() * (b - a);
let weather, rainGeo, rainMat, rainLines, rainDrops, snowGeo, snowMat, snowPts, snowFlakes;

function initWeather(){
  weather = { kind: 'clear', t: 0, dur: wRand(10, 20), fade: 0 };

  // Rain — slanted line streaks inside a volume that follows the player
  const N_RAIN = 220;
  rainDrops = [];
  for (let i = 0; i < N_RAIN; i++) rainDrops.push({ x: wRand(-9, 9), y: wRand(0, 11), z: wRand(-9, 9), s: wRand(13, 18) });
  rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_RAIN * 6), 3));
  rainMat = new THREE.LineBasicMaterial({ color: 0xa8c4e0, transparent: true, opacity: 0 });
  rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.visible = false; rainLines.frustumCulled = false;
  scene.add(rainLines);

  // Snow — slow drifting points with per-flake sway
  const N_SNOW = 240;
  snowFlakes = [];
  for (let i = 0; i < N_SNOW; i++) snowFlakes.push({ x: wRand(-9, 9), y: wRand(0, 11), z: wRand(-9, 9), s: wRand(0.8, 1.5), ph: wRand(0, Math.PI * 2) });
  snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_SNOW * 3), 3));
  // sizeAttenuation off: with an orthographic camera it shrinks points to sub-pixel
  snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 5, transparent: true, opacity: 0, sizeAttenuation: false });
  snowPts = new THREE.Points(snowGeo, snowMat);
  snowPts.visible = false; snowPts.frustumCulled = false;
  scene.add(snowPts);
}

function pickWeather(){
  const r = Math.random();
  if (r < 0.45) return 'clear';
  if (r < 0.66) return 'rain';
  if (r < 0.85) return 'snow';
  return 'fog';
}

// Runs right after updateDayNight each frame, modulating the colours and
// light levels it just set — never storing them, so the two stay independent.
function updateWeather(dt){
  weather.t += dt;
  const FADE = 3;
  weather.fade = Math.max(0, Math.min(1, weather.t / FADE, (weather.dur - weather.t) / FADE));
  if (weather.t >= weather.dur){
    let next = pickWeather();
    if (next === weather.kind) next = 'clear';     // no repeats → guaranteed clear breaks
    weather = { kind: next, t: 0, dur: next === 'clear' ? wRand(16, 32) : wRand(14, 26), fade: 0 };
  }
  const k = weather.kind, f = weather.fade;
  const px = player.worldX, pz = wZ(player.gz);

  // Overcast: grey the sky and dim the sun while a spell is active
  const ov = (k === 'rain' ? 0.55 : k === 'fog' ? 0.65 : k === 'snow' ? 0.35 : 0) * f;
  if (ov > 0){
    scene.background.lerp(OVERCAST, ov);
    scene.fog.color.lerp(OVERCAST, ov);
    sun.intensity *= 1 - 0.45 * ov;
  }
  // Fog distance squeeze — strongest for fog, a light haze for rain/snow.
  // Camera sits ~18 units from the player, so near must stay above ~15 or
  // the player themself disappears into the murk.
  const fogF = (k === 'fog' ? 1 : k === 'rain' ? 0.3 : k === 'snow' ? 0.25 : 0) * f;
  scene.fog.near = FOG_NEAR - (FOG_NEAR - 16) * fogF;
  scene.fog.far  = FOG_FAR  - (FOG_FAR - 27) * fogF;

  if (k === 'rain' && f > 0){
    rainLines.visible = true;
    rainMat.opacity = 0.55 * f;
    const a = rainGeo.attributes.position.array;
    for (let i = 0; i < rainDrops.length; i++){
      const d = rainDrops[i];
      d.y -= d.s * dt; d.x -= 2.5 * dt;
      if (d.y < 0){ d.y += 11; d.x = wRand(-9, 9); d.z = wRand(-9, 9); }
      const j = i * 6, wx = px + d.x, wz2 = pz + d.z;
      a[j] = wx;          a[j+1] = d.y;        a[j+2] = wz2;
      a[j+3] = wx + 0.07; a[j+4] = d.y + 0.5;  a[j+5] = wz2;
    }
    rainGeo.attributes.position.needsUpdate = true;
  } else rainLines.visible = false;

  if (k === 'snow' && f > 0){
    snowPts.visible = true;
    snowMat.opacity = 0.9 * f;
    const a = snowGeo.attributes.position.array;
    const tNow = performance.now() * 0.001;
    for (let i = 0; i < snowFlakes.length; i++){
      const d = snowFlakes[i];
      d.y -= d.s * dt;
      if (d.y < 0){ d.y += 11; d.x = wRand(-9, 9); d.z = wRand(-9, 9); }
      a[i*3]   = px + d.x + Math.sin(tNow * 1.3 + d.ph) * 0.6;
      a[i*3+1] = d.y;
      a[i*3+2] = pz + d.z + Math.cos(tNow * 1.1 + d.ph) * 0.4;
    }
    snowGeo.attributes.position.needsUpdate = true;
  } else snowPts.visible = false;
}

function onLand(){
  const lane = lanesByGz.get(player.gz);
  if (!lane) { die('void'); return; }

  // soft dust puff under the feet (skip on water — splash handles that)
  if (lane.kind !== 'river'){
    const dustCol = lane.kind === 'road' ? [0xcfcabf, 0xb9b4a8, 0xe2ddd2]
                                         : [0xe7dcc2, 0xcdb585, 0xd8c9a6];
    puff(player.worldX, wZ(player.gz), {
      count: 4, color: dustCol, size: 1.0, life: 0.5, vy: 0.5, grow: 1.5, spread: 0.7, y: 0.12,
    });
  }

  const inv = player.grace > 0;   // freshly revived → no lethal landings for a beat
  if (lane.kind === 'river'){
    // Must land on a log
    const log = nearestLog(lane, player.worldX);
    if (log && Math.abs(player.worldX - log.x) < log.width / 2 - 0.1){
      player.riding = { log, offsetX: player.worldX - log.x };
    } else if (!inv){
      die('drown');
    }
  } else if (lane.kind === 'rail' && !inv){
    // Check if a train is currently overlapping us
    for (const m of lane.mobs){
      if (m.kind === 'train'){
        for (const c of m.cars){
          if (Math.abs(player.worldX - c.position.x) < 1.9){ die('train'); return; }
        }
      }
    }
  } else if (lane.kind === 'road' && !inv){
    // car overlap check at land time (the per-frame checkLaneHazards handles ongoing)
    for (const m of lane.mobs){
      if (m.kind === 'car' && Math.abs(player.worldX - m.x) < m.width/2 + 0.2){ die('car'); return; }
    }
  }
}

function checkLaneHazards(){
  if (player.grace > 0) return;
  const lane = lanesByGz.get(player.gz);
  if (!lane) return;
  if (lane.kind === 'road'){
    for (const m of lane.mobs){
      if (m.kind === 'car' && Math.abs(player.worldX - m.x) < m.width/2 + 0.18){ die('car'); return; }
    }
  } else if (lane.kind === 'rail'){
    for (const m of lane.mobs){
      if (m.kind === 'train'){
        for (const c of m.cars){
          if (Math.abs(player.worldX - c.position.x) < 1.9){ die('train'); return; }
        }
      }
    }
  }
}

function nearestLog(lane, worldX){
  let best = null, bestD = 1e9;
  for (const m of lane.mobs){
    if (m.kind !== 'log') continue;
    const d = Math.abs(worldX - m.x);
    if (d < bestD){ best = m; bestD = d; }
  }
  return best;
}

function die(reason){
  if (player.dead) return;
  player.dead = true;
  // Best
  try {
    if (runDistance > bestDistance){
      bestDistance = runDistance;
      localStorage.setItem('bh.bestDist', String(bestDistance));
    }
    if (coins > bestCoins){
      bestCoins = coins;
      localStorage.setItem('bh.bestCoins', String(bestCoins));
    }
  } catch(e){}

  const px = player.worldX, pz = wZ(player.gz);
  let menuDelay = 700;
  if (reason === 'car' || reason === 'train'){
    SFX.crash();
    burst(px, 0.45, pz, { count: 18, color: [0xffce2e, 0xffffff, 0x241f1c, 0xe04030], speed: 3.4, up: 3.6, size: 0.17, life: 0.6 });
    puff(px, pz, { count: 5, color: [0xbfb9ad, 0xd8d2c6, 0x9a948a], size: 1.3, life: 0.65, vy: 0.8, grow: 1.8, y: 0.3 });
    // squashed flat
    playerMesh.rotation.x = -Math.PI / 2.1;
    playerMesh.position.y = SURFACE_Y;
    playerMesh.scale.y = PLAYER_SCALE * 0.35;
  } else if (reason === 'drown' || reason === 'drift'){
    SFX.splash();
    burst(px, 0.0, pz, { count: 20, color: [0x9bcfe0, 0xffffff, 0x6cb8d1, 0x4d93b8], speed: 2.6, up: 3.4, size: 0.15, life: 0.7, gravity: -7 });
    puff(px, pz, { count: 6, color: [0xffffff, 0xdceef5], size: 1.2, life: 0.6, vy: 0.6, grow: 1.6, y: 0.0 });
    player.sinking = true;
    menuDelay = 850;
  } else {
    SFX.splash();
    playerMesh.rotation.x = -Math.PI / 2.1;
    playerMesh.position.y = SURFACE_Y + 0.05;
  }
  setTimeout(() => SFX.over(), 240);

  // Delay the result menu so the death effect plays out in view first.
  deathToken++;
  const myToken = deathToken;
  const snap = { distance: runDistance, best: bestDistance, coins, reason };
  setTimeout(() => { if (deathToken === myToken && player.dead) hud.setDead(snap); }, menuDelay);

  // Submit leaderboard (if available)
  submitScore(runDistance);
}
let deathToken = 0;

function restart(){
  // Reset state
  for (const gz of [...lanesByGz.keys()]) removeLane(gz);
  furthestAhead = 0; furthestBehind = 0;
  lastKind = null; kindRun = 0;
  for (let gz = -4; gz <= 14; gz++) addLane(gz);
  player.gx = 0; player.gz = 0; player.worldX = 0;
  player.hopping = false; player.dead = false; player.riding = null;
  player.facing = Math.PI;
  player.bump = null; player.sinking = false;
  player.grace = 0; reviveCount = 0;
  deathToken++;   // cancel any pending death-menu timeout
  fxClear();
  buildPlayer(pickChar());   // fresh random character each run
  playerMesh.position.set(0, SURFACE_Y, 0);
  playerMesh.rotation.set(0, Math.PI, 0);
  playerMesh.scale.set(PLAYER_SCALE, PLAYER_SCALE, PLAYER_SCALE);
  started = false;
  runDistance = 0;
  hud.setDistance(0);
  hud.setDead(null);
}

// ── Coin revive ──────────────────────────────────────────────────────────────
function reviveInfo(){
  const cost = reviveCost();
  return { cost, coins, canAfford: coins >= cost };
}

// Nearest non-river lane at or behind the player — a safe place to drop back in.
function safeReviveGz(){
  for (let gz = player.gz; gz >= furthestBehind; gz--){
    const lane = lanesByGz.get(gz);
    if (lane && lane.kind !== 'river') return gz;
  }
  for (let gz = player.gz; gz <= furthestAhead; gz++){
    const lane = lanesByGz.get(gz);
    if (lane && lane.kind !== 'river') return gz;
  }
  return player.gz;
}

function revive(){
  if (!player.dead) return false;
  const cost = reviveCost();
  if (coins < cost) return false;
  coins -= cost;
  reviveCount++;
  try { localStorage.setItem('bh.coins', String(coins)); } catch(e){}
  hud.setCoin(coins);

  deathToken++;                 // cancel any pending death-menu timeout
  player.dead = false;
  player.sinking = false;
  player.riding = null;
  player.hopping = false;
  player.bump = null;
  player.grace = 1.8;           // brief invulnerability so cars/trains can't re-kill instantly

  player.gz = safeReviveGz();
  player.gx = Math.max(-HALF_WIDTH, Math.min(HALF_WIDTH, player.gx));
  player.worldX = wX(player.gx);
  player.facing = Math.PI;

  playerMesh.rotation.set(0, Math.PI, 0);
  playerMesh.scale.set(PLAYER_SCALE, PLAYER_SCALE, PLAYER_SCALE);
  playerMesh.position.set(player.worldX, SURFACE_Y, wZ(player.gz));
  restLimbs();

  burst(player.worldX, 0.5, wZ(player.gz), { count: 16, color: [0x3fb6ac, 0xffffff, 0xffce2e], speed: 2.6, up: 3.2, size: 0.14, life: 0.6 });
  SFX.coin();
  return true;
}

// ── Character unlock roster ──────────────────────────────────────────────────
function getCoins(){ return coins; }
function getRoster(){
  return ROSTER.map(key => ({ key, name: NAMES[key] || key, unlocked: unlocked.has(key) }));
}
function unlockChar(key){
  if (unlocked.has(key) || !ROSTER.includes(key) || coins < UNLOCK_COST) return false;
  coins -= UNLOCK_COST;
  unlocked.add(key);
  try {
    localStorage.setItem('bh.coins', String(coins));
    localStorage.setItem('bh.unlocked', JSON.stringify([...unlocked]));
  } catch(e){}
  hud.setCoin(coins);
  SFX.coin();
  return true;
}

// Offscreen renderer that bakes a transparent PNG thumbnail of any character.
let thumbRenderer = null, thumbScene = null, thumbCam = null;
function makeThumb(key){
  if (!thumbRenderer){
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    thumbRenderer.setSize(150, 150);
    thumbRenderer.setClearColor(0x000000, 0);
    thumbScene = new THREE.Scene();
    thumbScene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const d = new THREE.DirectionalLight(0xffffff, 0.95); d.position.set(3, 6, 5); thumbScene.add(d);
    const d2 = new THREE.DirectionalLight(0xcfe4ff, 0.45); d2.position.set(-4, 3, 2); thumbScene.add(d2);
    thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  }
  const mesh = (CHARACTERS[key] || CHARACTERS.shopkeeper)();
  thumbScene.add(mesh);
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = (maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(30) / 2))) * 1.35;
  thumbCam.position.set(center.x + dist * 0.45, center.y + dist * 0.30, center.z + dist);
  thumbCam.lookAt(center);
  thumbRenderer.render(thumbScene, thumbCam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbScene.remove(mesh);
  mesh.traverse(o => {
    if (!o.isMesh) return;
    o.geometry && o.geometry.dispose && o.geometry.dispose();
    const m = o.material;
    if (Array.isArray(m)) m.forEach(x => x && x.dispose && x.dispose());
    else if (m && m.dispose) m.dispose();
  });
  return url;
}

// ── Leaderboard wiring ───────────────────────────────────────────────────────
function submitScore(score){
  try {
    const A = window.Aigram;
    if (!A || !A.canRank) return;
    A.callAigramAPI('/note/aigram/ai/game/rank/score/save', 'POST', {
      session_id: A.gameUuid, score: Math.round(score),
    }).catch(()=>{});
  } catch(e){}
}

// ── Math helpers ─────────────────────────────────────────────────────────────
function lerp(a, b, t){ return a + (b - a) * Math.min(1, Math.max(0, t)); }
function lerpAngle(a, b, t){
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, Math.max(0, t));
}

// expose for debug
window.__bh = { player, lanesByGz, get state(){ return { runDistance, coins, started, dead: player.dead }; },
                setWeather(k){ weather = { kind: k, t: 3, dur: 9999, fade: 1 }; } };

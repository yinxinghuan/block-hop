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
const VIEW_H       = 7.5;        // ortho frustum half-height (smaller = zoomed in)
const PLAYER_SCALE = 0.55;       // bumped from 0.42 so character reads on small screens

// ── Globals ───────────────────────────────────────────────────────────────────
let scene, camera, renderer, canvas;
let clock;
let playerMesh, playerRig;
let sun, sunTarget;
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
  facing: 0,                    // y-rot in radians, 0 = +Z forward
};

let coins = 0;
let bestDistance = 0;
let bestCoins = 0;
let started = false;
let runDistance = 0;

const tmpVec = new THREE.Vector3();

// HUD callbacks (set by index.html)
let hud = { setDistance(){}, setCoin(){}, setDead(){}, setReady(){} };

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
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
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
  const fill = new THREE.DirectionalLight(0xc9e2ff, 0.28);
  fill.position.set(-6, 8, -4);
  scene.add(fill);

  // Build player
  buildPlayer('shopkeeper');

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
  } catch(e) {}
  hud.setCoin(coins);

  clock = new THREE.Clock();
  hud.setReady(true);
  requestAnimationFrame(tick);

  return { restart };
}

function buildPlayer(charKey){
  if (playerMesh) scene.remove(playerMesh);
  const factory = CHARACTERS[charKey] || CHARACTERS.shopkeeper;
  playerMesh = factory();
  playerMesh.scale.setScalar(PLAYER_SCALE);
  playerMesh.position.set(0, 0, 0);
  playerMesh.rotation.y = Math.PI;   // face +Z (forward in our world)
  playerRig = playerMesh.userData.rig || null;
  playerMesh.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  scene.add(playerMesh);
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
  const tileMat   = laneTileMat(kind);
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

  // Thick dirt slab (or deep water for river) extending down beyond the
  // viewport — kills the floating-strip look and makes the offscreen
  // edge read as a slice of earth, not a hovering plank.
  const dirtCol = kind === 'river' ? 0x1f4a72 : 0x8b6a44;
  const dirtH   = 1.6;
  const dirt = new THREE.Mesh(
    new THREE.BoxGeometry(W, dirtH, TILE),
    mat(dirtCol)
  );
  const dirtTopY = kind === 'grass' ? (topY - baseHeight - 0.06)
                                    : (topY - baseHeight);
  dirt.position.set(0, dirtTopY - dirtH/2, wZ(gz));
  dirt.receiveShadow = true;
  lane.group.add(dirt);

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

// ── Lane materials ────────────────────────────────────────────────────────────
const matCache = new Map();
function mat(hex){
  if (!matCache.has(hex)) matCache.set(hex,
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.95, metalness: 0, flatShading: true }));
  return matCache.get(hex);
}
function laneTileMat(kind){
  if (kind === 'grass') return mat(0x6fc85a);
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
// Pattern: thin chassis + body lower + body upper cabin + roof; add windshield/
// rear glass slabs, side windows, headlights/taillights/license/handles/mirrors.
function _addWheels(g, list, tireR, tireT, hubColor){
  const tireMat = mat(0x1a1612);
  const hubMat  = mat(hubColor || 0xb5b0a8);
  for (const [x, z] of list){
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(tireR, tireR, tireT, 12), tireMat);
    tire.rotation.z = Math.PI/2; tire.position.set(x, tireR, z);
    g.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(tireR * 0.45, tireR * 0.45, tireT + 0.02, 8), hubMat);
    hub.rotation.z = Math.PI/2; hub.position.set(x, tireR, z);
    g.add(hub);
  }
}
function makeTaxi(){
  const g = new THREE.Group();
  const yellow = 0xffce2e;
  const yDark  = darken(yellow, 0.78);
  const glass  = 0x9bcfe0;
  // chassis
  g.add(box(2.00, 0.16, 0.92, 0x2a221c, 0, 0.14, 0));
  // body lower
  g.add(box(1.92, 0.30, 0.88, yellow, 0, 0.37, 0));
  // body shoulder
  g.add(box(1.58, 0.18, 0.84, yellow, -0.08, 0.61, 0));
  // cabin / roof
  g.add(box(1.05, 0.28, 0.78, yellow, -0.10, 0.84, 0));
  // windshield + rear glass (front faces of cabin)
  g.add(box(0.04, 0.26, 0.76, glass, 0.43, 0.84, 0));
  g.add(box(0.04, 0.26, 0.76, glass, -0.63, 0.84, 0));
  // side windows
  for (const z of [0.39, -0.39]){
    g.add(box(0.92, 0.22, 0.04, glass, -0.10, 0.85, z));
  }
  // hood + trunk soft creases
  g.add(box(0.46, 0.04, 0.84, yDark, 0.70, 0.53, 0));
  g.add(box(0.40, 0.04, 0.84, yDark, -1.00 + 0.20, 0.53, 0));
  // headlights (warm white)
  for (const z of [0.30, -0.30]){
    g.add(box(0.06, 0.10, 0.16, 0xfff4c8, 0.99, 0.42, z));
  }
  // grille strip
  g.add(box(0.04, 0.10, 0.42, 0x2a221c, 1.00, 0.30, 0));
  // taillights (red)
  for (const z of [0.30, -0.30]){
    g.add(box(0.06, 0.10, 0.16, 0xe04030, -0.99, 0.42, z));
  }
  // bumpers
  g.add(box(0.06, 0.08, 0.82, 0x1a1612, 1.00, 0.26, 0));
  g.add(box(0.06, 0.08, 0.82, 0x1a1612, -1.00, 0.26, 0));
  // license plates
  g.add(box(0.04, 0.08, 0.30, 0xf2efe2, 1.02, 0.30, 0));
  g.add(box(0.04, 0.08, 0.30, 0xf2efe2, -1.02, 0.30, 0));
  // checker band (between body lower and shoulder)
  for (let i = 0; i < 9; i++){
    const cc = (i % 2 === 0) ? 0x15110e : 0xffffff;
    g.add(box(0.20, 0.07, 0.90, cc, -0.86 + i * 0.215, 0.225, 0));
  }
  // door handles
  for (const z of [0.43, -0.43]){
    g.add(box(0.20, 0.03, 0.02, 0x15110e, -0.10, 0.50, z));
  }
  // side mirrors
  for (const z of [0.49, -0.49]){
    g.add(box(0.10, 0.06, 0.10, yellow, 0.40, 0.68, z));
  }
  // wheels
  _addWheels(g, [[0.70, 0.45],[0.70,-0.45],[-0.70, 0.45],[-0.70,-0.45]], 0.21, 0.22, 0xd0c8b0);
  // wheel wells (dark cutout)
  for (const [x, z] of [[0.70, 0.46],[0.70,-0.46],[-0.70, 0.46],[-0.70,-0.46]]){
    g.add(box(0.50, 0.18, 0.06, 0x1a1612, x, 0.21, z));
  }
  // TAXI roof sign (lit)
  g.add(box(0.54, 0.18, 0.22, 0xfff7e6, -0.20, 1.07, 0));
  // "TAXI" black faces (each side)
  g.add(box(0.46, 0.10, 0.02, 0x15110e, -0.20, 1.08, 0.115));
  g.add(box(0.46, 0.10, 0.02, 0x15110e, -0.20, 1.08, -0.115));
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeSedan(){
  const g = new THREE.Group();
  const palette = [0xe0483b, 0x36a3ec, 0x4fae44, 0xb05de8, 0xe89534, 0x6b59c8, 0xf6f1e6];
  const bodyCol = palette[Math.floor(Math.random()*palette.length)];
  const bodyDark = darken(bodyCol, 0.72);
  const glass = 0x9bcfe0;
  // chassis
  g.add(box(1.82, 0.14, 0.86, 0x2a221c, 0, 0.12, 0));
  // body lower
  g.add(box(1.74, 0.28, 0.84, bodyCol, 0, 0.33, 0));
  // shoulder
  g.add(box(1.40, 0.16, 0.80, bodyCol, -0.06, 0.55, 0));
  // roof
  g.add(box(0.95, 0.26, 0.72, bodyCol, -0.06, 0.74, 0));
  // windshield + rear
  g.add(box(0.04, 0.22, 0.72, glass, 0.43, 0.74, 0));
  g.add(box(0.04, 0.22, 0.72, glass, -0.55, 0.74, 0));
  // side windows
  for (const z of [0.37, -0.37]){
    g.add(box(0.85, 0.20, 0.04, glass, -0.06, 0.75, z));
  }
  // hood crease
  g.add(box(0.42, 0.04, 0.78, bodyDark, 0.60, 0.49, 0));
  // headlights
  for (const z of [0.28, -0.28]){
    g.add(box(0.06, 0.08, 0.16, 0xfff4c8, 0.90, 0.38, z));
  }
  // grille
  g.add(box(0.04, 0.08, 0.36, 0x1a1612, 0.91, 0.28, 0));
  // taillights
  for (const z of [0.28, -0.28]){
    g.add(box(0.06, 0.08, 0.14, 0xe04030, -0.90, 0.38, z));
  }
  // bumpers
  g.add(box(0.06, 0.08, 0.80, 0x1a1612, 0.92, 0.24, 0));
  g.add(box(0.06, 0.08, 0.80, 0x1a1612, -0.92, 0.24, 0));
  // license plate front + rear
  g.add(box(0.04, 0.07, 0.26, 0xf2efe2, 0.94, 0.28, 0));
  g.add(box(0.04, 0.07, 0.26, 0xf2efe2, -0.94, 0.28, 0));
  // door handles
  for (const z of [0.42, -0.42]){
    g.add(box(0.18, 0.03, 0.02, 0x1a1612, -0.06, 0.46, z));
  }
  // side mirrors
  for (const z of [0.46, -0.46]){
    g.add(box(0.09, 0.06, 0.09, bodyCol, 0.36, 0.62, z));
  }
  // antenna (50%)
  if (Math.random() < 0.5){
    g.add(box(0.02, 0.20, 0.02, 0x1a1612, -0.45, 0.95, 0));
  }
  // wheels
  _addWheels(g, [[0.55, 0.42],[0.55,-0.42],[-0.55, 0.42],[-0.55,-0.42]], 0.19, 0.22, 0xa8a09a);
  for (const [x, z] of [[0.55, 0.43],[0.55,-0.43],[-0.55, 0.43],[-0.55,-0.43]]){
    g.add(box(0.45, 0.18, 0.06, 0x1a1612, x, 0.19, z));
  }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeTruck(){
  const g = new THREE.Group();
  const cabPalette = [0xf4f1e8, 0xb45642, 0x4e6d8f, 0x9c7e5a, 0xe4523c];
  const cabCol = cabPalette[Math.floor(Math.random()*cabPalette.length)];
  const cabDark = darken(cabCol, 0.80);
  const glass = 0x9bcfe0;
  // chassis
  g.add(box(2.55, 0.16, 0.96, 0x1a1612, 0, 0.14, 0));
  // cab body
  g.add(box(0.92, 0.78, 0.92, cabCol, 0.80, 0.52, 0));
  // cab nose (slightly forward + lower)
  g.add(box(0.12, 0.55, 0.92, cabDark, 1.30, 0.42, 0));
  // cab roof crease
  g.add(box(0.92, 0.06, 0.92, cabDark, 0.80, 0.92, 0));
  // cargo box
  g.add(box(1.50, 1.20, 0.96, 0xd0c6b0, -0.45, 0.71, 0));
  // cargo panel vertical seams
  for (const x of [-1.00, -0.45, 0.10]){
    g.add(box(0.02, 1.12, 0.98, 0x8e8470, x, 0.71, 0));
  }
  // cargo top + bottom trim
  g.add(box(1.54, 0.06, 0.98, 0x8e8470, -0.45, 1.34, 0));
  g.add(box(1.54, 0.06, 0.98, 0x8e8470, -0.45, 0.14, 0));
  // back doors
  g.add(box(0.02, 1.00, 0.86, 0x9a8c70, -1.20, 0.65, 0));
  g.add(box(0.04, 0.06, 0.04, 0x1a1612, -1.22, 0.65, 0));        // handle
  // cab windshield
  g.add(box(0.04, 0.30, 0.82, glass, 1.27, 0.68, 0));
  // cab side windows
  for (const z of [0.43, -0.43]){
    g.add(box(0.62, 0.26, 0.04, glass, 0.85, 0.70, z));
  }
  // headlights + turn signal
  for (const z of [0.34, -0.34]){
    g.add(box(0.06, 0.10, 0.16, 0xfff4c8, 1.34, 0.32, z));
    g.add(box(0.04, 0.06, 0.10, 0xf2a13a, 1.34, 0.18, z));
  }
  // grille
  g.add(box(0.04, 0.18, 0.30, 0x1a1612, 1.35, 0.30, 0));
  // taillights
  for (const z of [0.36, -0.36]){
    g.add(box(0.04, 0.16, 0.14, 0xe04030, -1.21, 0.42, z));
  }
  // cab handles
  for (const z of [0.47, -0.47]){
    g.add(box(0.10, 0.03, 0.02, 0x1a1612, 0.62, 0.50, z));
  }
  // big truck mirrors
  for (const z of [0.50, -0.50]){
    g.add(box(0.04, 0.30, 0.16, 0x1a1612, 1.18, 0.66, z));
    g.add(box(0.06, 0.20, 0.14, 0xb5b0a8, 1.18, 0.68, z));
  }
  // exhaust pipe (chrome stack behind cab)
  g.add(box(0.09, 0.70, 0.09, 0xc8c2b0, 0.36, 0.88, 0.40));
  g.add(box(0.12, 0.06, 0.12, 0x1a1612, 0.36, 1.24, 0.40));  // tip cap
  // bumpers
  g.add(box(0.06, 0.10, 0.96, 0x1a1612, 1.36, 0.20, 0));
  g.add(box(0.06, 0.10, 0.96, 0x1a1612, -1.22, 0.20, 0));
  // wheels (6: front 2 + dual rear 4)
  _addWheels(g, [[0.95, 0.5],[0.95,-0.5],[-0.40, 0.5],[-0.40,-0.5],[-1.00, 0.5],[-1.00,-0.5]], 0.22, 0.22, 0x8a857f);
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
  // chassis
  g.add(box(3.60, 0.12, 0.90, 0x1f1d22, 0, 0.10, 0));
  // body
  g.add(box(3.60, 0.78, 0.88, 0x8b8f98, 0, 0.55, 0));
  // roof curve fake (slightly narrower upper)
  g.add(box(3.40, 0.10, 0.92, 0x6f747e, 0, 0.99, 0));
  // red MTA stripe with white edges
  g.add(box(3.60, 0.04, 0.92, 0xfff7e6, 0, 0.34, 0));
  g.add(box(3.60, 0.10, 0.92, 0xe0483b, 0, 0.29, 0));
  g.add(box(3.60, 0.04, 0.92, 0xfff7e6, 0, 0.24, 0));
  // windows (long band on both sides)
  for (const z of [0.45, -0.45]){
    for (let i = -1; i <= 1; i++){
      g.add(box(0.62, 0.26, 0.04, 0x6cb8d1, i * 1.05, 0.74, z));
    }
  }
  // door panels between windows
  for (const z of [0.45, -0.45]){
    for (const x of [-0.50, 0.50]){
      g.add(box(0.04, 0.40, 0.04, 0x1a1612, x, 0.60, z));
    }
  }
  // headlight (front-only, but car symmetric — give both ends a light)
  for (const x of [1.78, -1.78]){
    g.add(box(0.04, 0.10, 0.18, 0xfff4c8, x, 0.55, 0));
  }
  // route letter circle (F line)
  for (const x of [1.50, -1.50]){
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 12), mat(0xf2c14e));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.68, 0.46);
    g.add(ring);
  }
  // bumpers / couplers
  g.add(box(0.04, 0.18, 0.40, 0x1a1612, 1.82, 0.30, 0));
  g.add(box(0.04, 0.18, 0.40, 0x1a1612, -1.82, 0.30, 0));
  // wheels (4 in two trucks)
  _addWheels(g, [[-1.20, 0.42],[-1.20,-0.42],[1.20, 0.42],[1.20,-0.42]], 0.20, 0.22, 0x6a6660);
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ── Spawning + updating obstacles ────────────────────────────────────────────
function spawnCar(lane){
  const car = pickCar();
  const m = car.mesh;
  const startX = lane.dir > 0 ? -KILL_X - 2 : KILL_X + 2;
  m.position.set(startX, 0, wZ(lane.gz));
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
    m.position.set(startX + offset, 0, wZ(lane.gz));
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
    if (player.dead && (e.key === 'r' || e.key === 'R' || e.key === ' ')){ restart(); return; }
    if (e.key === 'ArrowUp' || e.key === 'w') tryHop(0, 1);
    else if (e.key === 'ArrowDown' || e.key === 's') tryHop(0, -1);
    else if (e.key === 'ArrowLeft' || e.key === 'a') tryHop(-1, 0);
    else if (e.key === 'ArrowRight' || e.key === 'd') tryHop(1, 0);
  });
}

function tryHop(dx, dz){
  if (player.hopping || player.dead) return;

  if (!started) started = true;

  // Detach from log if riding — current gx is rounded from worldX
  if (player.riding){
    player.gx = Math.round(player.worldX);
    player.riding = null;
  }

  const targetGx = player.gx + dx;
  const targetGz = player.gz + dz;

  // Can't go off the playable strip (allow up to ±HALF_WIDTH; outside is tree zone)
  if (Math.abs(targetGx) > HALF_WIDTH) return;

  // Check static blocks on target lane
  const targetLane = lanesByGz.get(targetGz);
  if (!targetLane) return;
  for (const m of targetLane.mobs){
    if (m.kind === 'block' && m.gx === targetGx) return;
  }

  // Begin hop
  player.hopping = true;
  player.hopT = 0;
  player.hopFromX = wX(player.gx); player.hopFromZ = wZ(player.gz);
  player.hopToX   = wX(targetGx);  player.hopToZ   = wZ(targetGz);
  player.gx = targetGx;
  player.gz = targetGz;
  player.facing = Math.atan2(dx, -dz);   // face along hop direction

  // distance score = furthest gz reached
  if (targetGz > runDistance){
    runDistance = targetGz;
    hud.setDistance(runDistance);
  }
}

// ── Game loop ────────────────────────────────────────────────────────────────
function tick(){
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());

  // Update player hop animation
  if (player.hopping){
    player.hopT += dt;
    const t = Math.min(1, player.hopT / HOP_DUR);
    const ease = t * (2 - t);
    const x = player.hopFromX + (player.hopToX - player.hopFromX) * ease;
    const z = player.hopFromZ + (player.hopToZ - player.hopFromZ) * ease;
    const y = Math.sin(Math.PI * t) * HOP_HEIGHT;
    player.worldX = x;
    playerMesh.position.set(x, y, z);
    // slight squash anim
    playerMesh.scale.y = PLAYER_SCALE * (1 - 0.18 * Math.sin(Math.PI * t));
    // smooth turn toward facing
    playerMesh.rotation.y = lerpAngle(playerMesh.rotation.y, Math.PI + player.facing, 12 * dt);
    if (t >= 1){
      player.hopping = false;
      playerMesh.scale.y = PLAYER_SCALE;
      onLand();
    }
  }

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
    if (Math.abs(player.worldX) > KILL_X){ die('drift'); }
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

  // Move shadow camera with player so its frustum stays tight + crisp
  sun.position.set(player.worldX + 8, 16, wZ(player.gz) + 6);
  sunTarget.position.set(player.worldX, 0, wZ(player.gz));

  renderer.render(scene, camera);
}

function onLand(){
  const lane = lanesByGz.get(player.gz);
  if (!lane) { die('void'); return; }

  if (lane.kind === 'river'){
    // Must land on a log
    const log = nearestLog(lane, player.worldX);
    if (log && Math.abs(player.worldX - log.x) < log.width / 2 - 0.1){
      player.riding = { log, offsetX: player.worldX - log.x };
    } else {
      die('drown');
    }
  } else if (lane.kind === 'rail'){
    // Check if a train is currently overlapping us
    for (const m of lane.mobs){
      if (m.kind === 'train'){
        for (const c of m.cars){
          if (Math.abs(player.worldX - c.position.x) < 1.9){ die('train'); return; }
        }
      }
    }
  } else if (lane.kind === 'road'){
    // car overlap check at land time (the per-frame checkLaneHazards handles ongoing)
    for (const m of lane.mobs){
      if (m.kind === 'car' && Math.abs(player.worldX - m.x) < m.width/2 + 0.2){ die('car'); return; }
    }
  }
}

function checkLaneHazards(){
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
  // Tilt the body to "flat"
  playerMesh.rotation.x = -Math.PI / 2.1;
  playerMesh.position.y = 0.15;
  hud.setDead({ distance: runDistance, best: bestDistance, coins, reason });

  // Submit leaderboard (if available)
  submitScore(runDistance);
}

function restart(){
  // Reset state
  for (const gz of [...lanesByGz.keys()]) removeLane(gz);
  furthestAhead = 0; furthestBehind = 0;
  lastKind = null; kindRun = 0;
  for (let gz = -4; gz <= 14; gz++) addLane(gz);
  player.gx = 0; player.gz = 0; player.worldX = 0;
  player.hopping = false; player.dead = false; player.riding = null;
  player.facing = 0;
  playerMesh.position.set(0, 0, 0);
  playerMesh.rotation.set(0, Math.PI, 0);
  playerMesh.scale.set(PLAYER_SCALE, PLAYER_SCALE, PLAYER_SCALE);
  started = false;
  runDistance = 0;
  hud.setDistance(0);
  hud.setDead(null);
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
window.__bh = { player, lanesByGz, get state(){ return { runDistance, coins, started, dead: player.dead }; } };

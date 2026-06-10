// game.js — Block Hop core. Three.js v0.160 ES module.
// Grid-based 3D hop game. Iso-ish camera, NYC street theme, voxel cast from
// shelf-it/builders/characters.js. tap=forward, swipe lr/back, camera chase line.

import * as THREE from 'three';
import { P, box, cyl, ball, cone, darken } from './lib/prims.js';
import { CHARACTERS } from './builders/characters.js';

// ── Tunables ──────────────────────────────────────────────────────────────────
const TILE         = 1.0;
const HALF_WIDTH   = 7;          // visible cells each side of x=0
const KILL_X       = 8;          // |worldX| > this → off-screen kill
const HOP_DUR      = 0.18;       // seconds
const HOP_HEIGHT   = 0.55;
const CHASE_DELAY  = 3.5;        // grace before chase line moves
const CHASE_SPEED  = 0.85;       // cells / sec the chase line advances
const CHASE_GAP    = 7;          // player must be > chaseFloor + (-CHASE_GAP) ahead

// ── Globals ───────────────────────────────────────────────────────────────────
let scene, camera, renderer, canvas;
let clock;
let playerMesh, playerRig;
let lanesByGz = new Map();      // gz → laneRecord
let furthestAhead = -Infinity;  // largest gz that has a lane
let furthestBehind = Infinity;  // smallest gz that has a lane
let chaseFloor = 0;             // lowest gz still alive (advances forward)
let chaseGrace = CHASE_DELAY;

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
  scene.fog = new THREE.Fog(0xb8d7ea, 22, 38);

  // Iso-ish orthographic camera, follows player on Z
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const viewH = 10;
  camera = new THREE.OrthographicCamera(
    -viewH * aspect, viewH * aspect, viewH, -viewH, 0.1, 200
  );
  camera.position.set(10, 12, 12);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Sky-ish ambient + sunny key + soft fill
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc9e2ff, 0.35);
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
  playerMesh.scale.setScalar(0.42);  // characters are ~2.6 tall raw → ~1.1 on tile
  playerMesh.position.set(0, 0, 0);
  playerMesh.rotation.y = Math.PI;   // face +Z (forward in our world)
  playerRig = playerMesh.userData.rig || null;
  scene.add(playerMesh);
}

function onResize(){
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const viewH = 10;
  camera.left = -viewH * aspect; camera.right = viewH * aspect;
  camera.top = viewH; camera.bottom = -viewH;
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

  // Lane tile geometry: a wide flat box across X
  const tileMat = laneTileMat(kind);
  const baseHeight = kind === 'river' ? 0.10 : 0.20;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2 * KILL_X + 4, baseHeight, TILE),
    tileMat
  );
  base.position.set(0, baseHeight/2 - (kind === 'river' ? 0.18 : 0), wZ(gz));
  base.receiveShadow = true;
  lane.group.add(base);

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
  // Inner scatter
  const propCount = Math.floor(Math.random() * 4);
  for (let i = 0; i < propCount; i++){
    const gx = (Math.random()*2-1) * (HALF_WIDTH-1) | 0;
    if (gx === 0 || used.has(gx)) continue;
    used.add(gx);
    const r = Math.random();
    let prop;
    if (r < 0.35) prop = makeHydrant();
    else if (r < 0.65) prop = makeMailbox();
    else if (r < 0.85) prop = makeNewsRack();
    else prop = makeTree();
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
function makeTree(){
  const g = new THREE.Group();
  // trunk
  g.add(box(0.32, 0.7, 0.32, P.bark, 0, 0.35, 0));
  // leaves: three stacked faceted balls
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a8a32, roughness: 0.9, flatShading: true });
  const ic = new THREE.IcosahedronGeometry(0.55, 0);
  for (const yy of [0.95, 1.35, 1.65]){
    const m = new THREE.Mesh(ic, leafMat);
    m.position.y = yy;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
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
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeNewsRack(){
  const g = new THREE.Group();
  g.add(box(0.6, 0.85, 0.45, P.ironD, 0, 0.45, 0));
  g.add(box(0.5, 0.22, 0.04, 0xf2c14e, 0, 0.7, 0.23));
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeCoin(){
  const m = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.4, metalness: 0.7, emissive: 0x553300, emissiveIntensity: 0.2, flatShading: true });
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), m);
  c.rotation.x = Math.PI/2;
  c.castShadow = true;
  c.userData.spinAxis = true;
  return c;
}

// ── Vehicle builders ─────────────────────────────────────────────────────────
function makeTaxi(){
  const g = new THREE.Group();
  // body
  g.add(box(1.9, 0.46, 0.9, 0xffce2e, 0, 0.35, 0));
  // roof
  g.add(box(1.1, 0.40, 0.82, 0xffce2e, -0.05, 0.78, 0));
  // hood + trunk slope (faked with smaller boxes)
  g.add(box(0.4, 0.16, 0.84, darken(0xffce2e, 0.85), 0.85, 0.46, 0));
  // windows (cream tinted)
  g.add(box(1.0, 0.30, 0.88, 0x6cb8d1, -0.05, 0.78, 0).translateY(-0.02));
  // black taxi stripe
  g.add(box(2.0, 0.05, 0.92, 0x15110e, 0, 0.46, 0));
  // checker band
  for (let i = 0; i < 7; i++){
    const c = (i % 2 === 0) ? 0x15110e : 0xffffff;
    g.add(box(0.27, 0.05, 0.95, c, -0.9 + i * 0.30, 0.46, 0));
  }
  // wheels
  for (const [x, z] of [[0.7,0.45],[0.7,-0.45],[-0.7,0.45],[-0.7,-0.45]]){
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.22, 10), mat(0x1a1612));
    w.rotation.z = Math.PI/2; w.position.set(x, 0.20, z);
    w.castShadow = true; g.add(w);
  }
  // top sign
  g.add(box(0.5, 0.16, 0.20, 0xfff7e6, -0.2, 1.05, 0));
  g.add(box(0.42, 0.10, 0.04, 0x15110e, -0.2, 1.05, 0.10));
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeSedan(){
  const g = new THREE.Group();
  const bodyCol = [0xe0483b, 0x36a3ec, 0x4fae44, 0xb05de8][Math.floor(Math.random()*4)];
  g.add(box(1.7, 0.42, 0.84, bodyCol, 0, 0.33, 0));
  g.add(box(0.95, 0.36, 0.78, darken(bodyCol, 0.7), -0.05, 0.72, 0));
  // windows
  g.add(box(0.85, 0.22, 0.82, 0x6cb8d1, -0.05, 0.72, 0));
  // wheels
  for (const [x, z] of [[0.55,0.42],[0.55,-0.42],[-0.55,0.42],[-0.55,-0.42]]){
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.22, 10), mat(0x1a1612));
    w.rotation.z = Math.PI/2; w.position.set(x, 0.18, z);
    w.castShadow = true; g.add(w);
  }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeTruck(){
  const g = new THREE.Group();
  // cab (white) + box (panel)
  g.add(box(0.85, 0.7, 0.95, 0xf4f1e8, 0.95, 0.45, 0));
  g.add(box(1.55, 1.05, 0.95, 0xdcd7c9, -0.35, 0.62, 0));
  // window
  g.add(box(0.55, 0.28, 1.0, 0x6cb8d1, 1.0, 0.7, 0));
  // wheels
  for (const [x, z] of [[0.95,0.5],[0.95,-0.5],[-0.85,0.5],[-0.85,-0.5]]){
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 10), mat(0x1a1612));
    w.rotation.z = Math.PI/2; w.position.set(x, 0.22, z);
    w.castShadow = true; g.add(w);
  }
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
  // 3-tile-long log (~2.8 wide on x)
  const mLog = new THREE.MeshStandardMaterial({ color: 0x7c5230, roughness: 0.95, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 2.6, 8), mLog);
  trunk.rotation.z = Math.PI/2;
  trunk.position.y = 0.18;
  trunk.castShadow = true; trunk.receiveShadow = true;
  g.add(trunk);
  // end caps darker
  for (const x of [-1.3, 1.3]){
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 8), mat(0x5e3d24));
    cap.rotation.z = Math.PI/2;
    cap.position.set(x, 0.18, 0);
    g.add(cap);
  }
  return g;
}

function makeTrainCar(){
  const g = new THREE.Group();
  // body
  g.add(box(3.6, 0.85, 0.85, 0x8b8f98, 0, 0.6, 0));
  // red stripe
  g.add(box(3.6, 0.10, 0.86, 0xe0483b, 0, 0.32, 0));
  // windows
  for (let i = -1; i <= 1; i++){
    g.add(box(0.6, 0.22, 0.88, 0x6cb8d1, i * 1.0, 0.78, 0));
  }
  // wheels
  for (const x of [-1.2, 1.2]){
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.22, 10), mat(0x1a1612));
    w.rotation.z = Math.PI/2; w.position.set(x, 0.20, 0);
    w.castShadow = true; g.add(w);
  }
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
  let downX = 0, downY = 0, downT = 0;
  let skipNextUp = false;
  const SWIPE = 22;
  const onDown = (e) => {
    if (player.dead) { restart(); skipNextUp = true; return; }
    downX = e.clientX; downY = e.clientY; downT = performance.now();
  };
  const onUp = (e) => {
    if (skipNextUp) { skipNextUp = false; return; }
    if (player.dead) return;
    const dx = e.clientX - downX, dy = e.clientY - downY;
    if (Math.hypot(dx, dy) < SWIPE){
      tryHop(0, 1);          // tap = forward
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)){
      tryHop(dx > 0 ? 1 : -1, 0);
    } else {
      tryHop(0, dy > 0 ? -1 : 1);   // swipe down = backward, swipe up = forward
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

  // First hop starts the run + the chase
  if (!started){
    started = true;
    chaseGrace = CHASE_DELAY;
  }

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
    playerMesh.scale.y = 0.42 * (1 - 0.18 * Math.sin(Math.PI * t));
    // smooth turn toward facing
    playerMesh.rotation.y = lerpAngle(playerMesh.rotation.y, Math.PI + player.facing, 12 * dt);
    if (t >= 1){
      player.hopping = false;
      playerMesh.scale.y = 0.42;
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

  // Camera chase
  if (started && !player.dead){
    if (chaseGrace > 0) chaseGrace -= dt;
    else chaseFloor += CHASE_SPEED * dt;
    if (player.gz < chaseFloor){
      die('camera');
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

  // Camera follow
  const targetCamZ = wZ(player.gz) + 8;
  const targetCamX = player.worldX * 0.35 + 8;     // slight x parallax
  camera.position.x = lerp(camera.position.x, targetCamX, 6 * dt);
  camera.position.z = lerp(camera.position.z, targetCamZ, 6 * dt);
  camera.position.y = 12;
  camera.lookAt(player.worldX * 0.35, 0, wZ(player.gz) - 0.5);

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
  playerMesh.scale.set(0.42, 0.42, 0.42);
  chaseFloor = 0; chaseGrace = CHASE_DELAY; started = false;
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
window.__bh = { player, lanesByGz, get state(){ return { runDistance, coins, chaseFloor, started, dead: player.dead }; } };

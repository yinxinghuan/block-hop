// rig.js — the LOCKED "premium look" stage (the reusable skill asset).
// One call sets up: renderer, scene, hard 3-value lighting, orthographic iso camera,
// OrbitControls, GTAO composer, contact-shadow floor, resize, and a render() loop.
// Every lab/showcase uses this so the lighting + camera + AO are identical across
// all categories. See DESIGN_SYSTEM.md for the value triad + param rationale.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createStage(canvas, opt = {}){
  const {
    viewSize   = 2.6,
    target     = [0, 0.5, 0],
    camPos     = [11, 14, 11],   // ~42° elevation look-down (reveals top + one side)
    bg         = 0xeceae4,
    gtaoRadius = 0.42,
    floorOpacity = 0.30,
    exposure   = 1.12,
  } = opt;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.max(2, Math.min(devicePixelRatio, 2)));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);

  // ── HARD 3-value lighting: top = brightest / near side ~80% / far side ~62% ──
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c2bc, 0.30));
  const key = new THREE.DirectionalLight(0xffffff, 3.05);
  key.position.set(6.5, 16, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 60;
  key.shadow.camera.left = -16; key.shadow.camera.right = 16;
  key.shadow.camera.top = 16; key.shadow.camera.bottom = -16;
  key.shadow.bias = -0.0004; key.shadow.radius = 2.4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.14);
  fill.position.set(-9, 5, -3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfff0d8, 0.26);
  rim.position.set(-5, 7, -10); scene.add(rim);

  // ── orthographic isometric camera ──
  const aspect = innerWidth / innerHeight;
  const camera = new THREE.OrthographicCamera(
    -viewSize*aspect, viewSize*aspect, viewSize, -viewSize, 0.1, 100);
  camera.position.set(...camPos);
  camera.lookAt(...target);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...target);
  controls.enableDamping = true; controls.dampingFactor = 0.08;

  // ── contact-shadow floor ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({ opacity: floorOpacity }));
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);

  // ── GTAO composer ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 1.0;
  gtao.updateGtaoMaterial({ radius: gtaoRadius, distanceExponent:1, thickness:1, scale:1.05,
    samples:16, distanceFallOff:1, screenSpaceRadius:false });
  gtao.updatePdMaterial({ lumaPhi:10, depthPhi:2, normalPhi:3, radius:4, radiusExponent:1, rings:2, samples:16 });
  composer.addPass(gtao);
  composer.addPass(new OutputPass());

  addEventListener('resize', () => {
    const a = innerWidth / innerHeight;
    camera.left = -viewSize*a; camera.right = viewSize*a; camera.top = viewSize; camera.bottom = -viewSize;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight); gtao.setSize(innerWidth, innerHeight);
  });

  function render(){ controls.update(); composer.render(); requestAnimationFrame(render); }

  return { THREE, scene, camera, renderer, controls, composer, gtao, key, floor, render };
}

// lay a roster of groups along the SCREEN-horizontal world axis (1,0,-1)/√2 so an
// iso row reads cleanly left→right instead of a diagonal staircase.
export function layRow(scene, items, { sp = 1.6, y = 0, rotY = -0.5, make } = {}){
  const dx = Math.SQRT1_2, dz = -Math.SQRT1_2;
  items.forEach((it, i) => {
    const t = (i - (items.length - 1) / 2) * sp;
    const g = make ? make(it, i) : it;
    g.position.set(t*dx, y, t*dz); g.rotation.y = rotY; scene.add(g);
  });
}

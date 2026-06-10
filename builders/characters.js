// characters.js — people builders (FAMILY B: sharp cubic isometric, matches the library)
// Ported from the iso_lab prototype, retargeted to lib/prims.js (P palette + box).
// Garments use the locked product palette; every character carries the teal accent.
import * as THREE from 'three';
import { P, box, darken } from '../lib/prims.js';
import { MONSTERS } from './monsters.js';     // dedicated horror builders (after-dark crowd)
import { ARCHETYPES } from './archetypes.js'; // dedicated profession + pop-culture builders (silhouette-driven, like MONSTERS)

const EYE = 0x241f1c, FRAME = 0x4a3526;   // facial micro-detail (literal, like animal faces)

// sharp-cubic ADULT — long lower body, shoulders overhang neck, head narrower than torso.
// Proportion lock (reviewer 2026-06-07): head : torso : legs ≈ 1 : 1.3 : 1.5,
// head width ≈ 0.56 × torso width.
export function character(s){
  const g = new THREE.Group();
  const BW = s.bw ?? 1.00, BD = 0.52;             // wider shoulders so they overhang the neck
  const HW = s.hw ?? 0.56, HH = s.hh ?? 0.60, HDP = 0.50;   // head: narrow + slightly tall, NOT a cube
  const shoeH = 0.18, legH = s.legH ?? 0.92, legW = 0.34, gap = 0.10;   // longer legs
  const lx = legW/2 + gap/2;

  // ── lower body (legs wrapped in hip-pivot groups → walk animation; rest pose identical) ──
  const legL = new THREE.Group(), legR = new THREE.Group();
  if(s.skirt){
    const skY = shoeH + 0.62;
    g.add(box(BW+0.06, 0.80, BD+0.04, s.skirt, 0, skY, 0));
    const hipY = shoeH + 0.54;
    legL.position.set(-0.18, hipY, 0); legR.position.set(0.18, hipY, 0);
    [legL, legR].forEach(L=>{
      L.add(box(0.22,0.54,0.22, s.legskin ?? P.skin, 0, (shoeH+0.27)-hipY, 0.02));
      L.add(box(0.26,shoeH,BD-0.06, s.shoes, 0, shoeH/2-hipY, 0.05));
    });
  } else {
    const hipY = shoeH + legH;
    legL.position.set(-lx, hipY, 0); legR.position.set(lx, hipY, 0);
    [legL, legR].forEach(L=>{
      L.add(box(legW+0.02,shoeH,BD-0.02, s.shoes, 0, shoeH/2-hipY, 0.05));
      L.add(box(legW,legH,BD-0.08, s.bottom, 0, (shoeH+legH/2)-hipY, 0));
    });
  }
  g.add(legL); g.add(legR);

  // ── torso ──
  const torsoH = s.torsoH ?? 0.80;
  const torsoBase = s.skirt ? (shoeH+0.62+0.40-0.06) : (shoeH+legH);
  const torsoY = torsoBase + torsoH/2;
  g.add(box(BW, torsoH, BD, s.top, 0, torsoY, 0));
  if(s.collar) g.add(box(BW-0.20,0.16,0.05, s.collar, 0, torsoY+torsoH/2-0.09, BD/2+0.01));
  if(s.tie)    g.add(box(0.12,torsoH*0.6,0.04, s.tie, 0, torsoY+0.02, BD/2+0.02));
  if(s.apron){ // teal apron: front panel + two straps (hero feature + the single accent)
    g.add(box(BW-0.22, torsoH*0.82, 0.05, s.apron, 0, torsoY-0.05, BD/2+0.02));
    g.add(box(0.11, torsoH*0.5, 0.05, s.apron, -0.24, torsoY+torsoH*0.33, BD/2+0.02));
    g.add(box(0.11, torsoH*0.5, 0.05, s.apron,  0.24, torsoY+torsoH*0.33, BD/2+0.02));
  }
  if(s.belt) g.add(box(BW+0.02, 0.13, BD+0.02, s.belt, 0, torsoY-torsoH/2+0.07, 0));

  // ── arms wrapped in shoulder-pivot groups (sleeved upper + skin forearm; rest pose identical) ──
  const armW=0.24, armH=torsoH+legH*0.28, agap=0.02;
  const ax = BW/2 + agap + armW/2;
  const sleeve = s.bareArms ? s.skin : (s.sleeve ?? s.top);
  const armTop = torsoY+torsoH/2-armH*0.36;
  const shoulderY = torsoY+torsoH/2;
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-ax, shoulderY, 0); armR.position.set(ax, shoulderY, 0);
  [armL, armR].forEach(A=>{
    A.add(box(armW, armH*0.74, BD-0.06, sleeve, 0, armTop-shoulderY, 0));
    A.add(box(armW, armH*0.26, BD-0.06, s.skin, 0, (torsoY+torsoH/2-armH*0.87)-shoulderY, 0));
  });
  g.add(armL); g.add(armR);

  // ── neck + head ──
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.28,0.12,0.26, s.skin, 0, neckY, 0));
  const headY = neckY+0.06+HH/2;
  g.add(box(HW,HH,HDP, s.skin, 0, headY, 0));

  const fz = HDP/2+0.01, eyeY=headY+0.02, eyeX=HW*0.26;
  g.add(box(0.13,0.14,0.04, EYE, -eyeX, eyeY, fz));
  g.add(box(0.13,0.14,0.04, EYE,  eyeX, eyeY, fz));
  if(s.glasses){ // FIXED from prototype: set color on the mesh, not on the group; ≥1-voxel frames
    g.add(box(0.18,0.17,0.05, FRAME, -eyeX, eyeY, fz+0.005));
    g.add(box(0.18,0.17,0.05, FRAME,  eyeX, eyeY, fz+0.005));
    g.add(box(0.13,0.05,0.03, FRAME, 0, eyeY, fz+0.002));
  }

  // ── hair (scales with head dims) ──
  const topHead = headY+HH/2;
  if(s.hair){
    if(s.hairStyle==='bun'){
      g.add(box(HW+0.05,0.20,HDP+0.04, s.hair, 0, topHead+0.06, 0));
      g.add(box(0.32,0.30,0.30, s.hair, 0, topHead+0.18, -0.06));
      g.add(box(0.13,HH*0.7,HDP*0.9, s.hair, -(HW/2+0.03), headY-0.03,0));
      g.add(box(0.13,HH*0.7,HDP*0.9, s.hair,  (HW/2+0.03), headY-0.03,0));
    } else {
      g.add(box(HW+0.05,0.22,HDP+0.04, s.hair, 0, topHead+0.07, 0));
      g.add(box(HW+0.05,0.42,0.14, s.hair, 0, headY+0.04, -HDP*0.5));
      g.add(box(0.13,0.46,HDP*0.78, s.hair, -(HW/2+0.02), headY+0.02, -0.04));
      g.add(box(0.13,0.46,HDP*0.78, s.hair,  (HW/2+0.02), headY+0.02, -0.04));
    }
  }

  // ── cap (over the hair) — peaked baseball cap, the brim is the readable cue ──
  if(s.hat){
    g.add(box(HW+0.06, 0.16, HDP+0.06, s.hat, 0, topHead+0.06, 0));        // crown
    g.add(box(HW*0.7, 0.06, 0.20, s.hat, 0, topHead+0.02, HDP/2+0.08));    // peak/brim (forward)
  }

  // ── held / worn extras ──
  if(s.backpack){ // teal pack on the back + two shoulder straps on the front
    g.add(box(BW-0.06, torsoH+0.02, 0.22, s.backpack, 0, torsoY+0.02, -BD/2-0.13));
    g.add(box(0.10, torsoH*0.7, 0.04, darken(s.backpack,0.8), -0.22, torsoY+0.05, BD/2+0.02));
    g.add(box(0.10, torsoH*0.7, 0.04, darken(s.backpack,0.8),  0.22, torsoY+0.05, BD/2+0.02));
  }
  if(s.accordion){ // big chest-held bellows (hero) — teal body, MUTED bellows folds (no 2nd saturate)
    const aw=0.7, ah=0.62, az = BD/2+0.22;
    g.add(box(aw, ah, 0.34, s.accordion, 0, torsoY+0.02, az));
    for(let i=-1;i<=1;i++) g.add(box(0.05, ah, 0.36, darken(s.accordion,0.7), i*0.18, torsoY+0.02, az));
    g.add(box(0.11,ah,0.36, P.cream, -aw/2+0.055, torsoY+0.02, az));   // cream end caps
    g.add(box(0.11,ah,0.36, P.cream,  aw/2-0.055, torsoY+0.02, az));
    g.add(box(0.05,ah*0.7,0.04, P.panelD, aw/2-0.02, torsoY+0.02, az+0.18)); // muted keys
  }

  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  g.userData.rig = { legL, legR, armL, armR };   // hip/shoulder pivots for walk animation
  return g;
}

// ─── roster: 4 people. Accent discipline: each figure = skin + hair + 2 MUTED
// garments + exactly ONE saturated teal accent. Garment hues are pushed grey via
// darken() so the single teal reads as the only saturate (reviewer 2026-06-07).
export const CHARACTERS = {
  // shopkeeper: teal apron is the one accent; cream tee + muted slate-blue jeans
  shopkeeper: () => character({
    skin:P.skin, top:P.cream, sleeve:P.cream, bottom:darken(P.blue,0.48), shoes:P.ironD,
    hair:P.hairDark, hairStyle:'short', apron:P.accent }),
  // granny: muted green cardigan + muted coral skirt + bun + glasses, teal collar accent
  granny: () => character({
    skin:P.skin, top:darken(P.green,0.52), sleeve:darken(P.green,0.52),
    skirt:darken(P.coral,0.58), legskin:P.cream,
    shoes:P.ironD, hair:P.hairGrey, hairStyle:'bun', glasses:true, collar:P.accent }),
  // old man: stone sweater + wood pants + glasses + teal accordion (the one accent)
  oldman: () => character({
    skin:P.skinD, top:P.stone, sleeve:P.stone, bottom:P.woodD, shoes:P.ironD,
    hair:P.hairGrey, hairStyle:'short', glasses:true, accordion:P.accent }),
  // blonde: muted blue dress + cream collar + teal belt accent
  blonde: () => character({
    skin:P.skin, top:darken(P.blue,0.5), sleeve:darken(P.blue,0.5),
    skirt:darken(P.blue,0.5), legskin:P.skin,
    shoes:P.ironD, hair:P.hairBlond, hairStyle:'short', collar:P.cream, belt:P.accent }),

  // kid: child proportions (bigger head ratio, short legs), brown hair, muted tee, teal backpack
  kid: () => character({
    skin:P.skin, top:darken(P.orange,0.6), sleeve:darken(P.orange,0.6), bottom:darken(P.blue,0.5),
    shoes:P.ironD, hair:P.hairBrown, hairStyle:'short', backpack:P.accent,
    bw:0.78, hw:0.52, hh:0.58, torsoH:0.60, legH:0.52 }),

  // businessman: broad, deep-tan, muted slate suit + cream collar + teal TIE accent
  businessman: () => character({
    skin:P.skinD, top:P.slate, sleeve:P.slate, bottom:P.slate, shoes:P.ironD,
    hair:P.hairDark, hairStyle:'short', collar:P.cream, tie:P.accent, bw:1.08 }),

  // office woman: muted purple blouse + muted panel skirt + brown hair + teal collar
  officeWoman: () => character({
    skin:P.skin, top:darken(P.purple,0.6), sleeve:darken(P.purple,0.6),
    skirt:P.panelD, legskin:P.skin, shoes:P.ironD,
    hair:P.hairBrown, hairStyle:'short', collar:P.accent }),

  // student: tan skin, brown hair, muted green hoodie + muted jeans, teal backpack
  student: () => character({
    skin:P.skinTan, top:darken(P.green,0.55), sleeve:darken(P.green,0.55), bottom:darken(P.blue,0.5),
    shoes:P.ironD, hair:P.hairBrown, hairStyle:'short', backpack:P.accent }),

  // dark-skin woman: deep skin, black bun, muted coral dress, teal collar accent
  darkWoman: () => character({
    skin:P.skinDk, top:darken(P.coral,0.6), sleeve:darken(P.coral,0.6),
    skirt:darken(P.coral,0.6), legskin:P.skinDk, shoes:P.ironD,
    hair:P.hairDark, hairStyle:'bun', collar:P.accent }),

  // worker (shop clerk): deep skin, stone tee + wood pants, teal apron + matching teal cap (store uniform)
  worker: () => character({
    skin:P.skinDk, top:P.stone, sleeve:P.stone, bottom:P.woodD, shoes:P.ironD,
    hair:P.hairDark, hairStyle:'short', hat:P.accent, apron:P.accent, bw:1.04 }),

  // teen: tan skin, blond hair, muted red hoodie + dark shorts, teal CAP (shorter than an adult, taller than the kid)
  teen: () => character({
    skin:P.skinTan, top:darken(P.red,0.5), sleeve:darken(P.red,0.5), bottom:darken(P.slate,0.85),
    shoes:P.ironD, hair:P.hairBlond, hairStyle:'short', hat:P.accent,
    bw:0.92, hh:0.58, legH:0.74 }),

  // fitWoman: deep-tan skin, dark bun, bare arms (tank), muted coral top + muted purple leggings, teal BELT
  fitWoman: () => character({
    skin:P.skinD, top:darken(P.coral,0.55), bottom:darken(P.purple,0.7), shoes:P.white,
    hair:P.hairDark, hairStyle:'bun', belt:P.accent, bareArms:true }),

  // chef: light skin, dark hair, pale panel uniform + slate trousers, cream cap + teal NECKERCHIEF (collar)
  chef: () => character({
    skin:P.skin, top:P.panel, sleeve:P.panel, bottom:P.slate, shoes:P.ironD,
    hair:P.hairDark, hairStyle:'short', hat:P.cream, collar:P.accent }),

  // bigGuy: broad, deep skin, grey hair, glasses, muted green tee + wood pants, teal BELT
  bigGuy: () => character({
    skin:P.skinD, top:darken(P.green,0.5), sleeve:darken(P.green,0.5), bottom:P.woodD, shoes:P.ironD,
    hair:P.hairGrey, hairStyle:'short', glasses:true, belt:P.accent, bw:1.10 }),

  // ── profession + pop-culture pack: bespoke-per-archetype builders for distinct
  //    thumbnail-readable silhouettes (cop / nurse / firefighter / construction /
  //    delivery / cowboy / punk / rapper / biker / goth) — see builders/archetypes.js ──
  ...ARCHETYPES,

  // ── fantasy customers: dedicated horror builders, distinct silhouettes (after-dark unlock).
  //    vampire · werewolf · zombie · ghost · skeleton · mummy — see builders/monsters.js ──
  ...MONSTERS,
};

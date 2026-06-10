// monsters.js — horror-register creatures (FAMILY B: sharp cubic isometric).
// Register: 阴森/重口 — pale / blood / exposed bone / rot / glowing eyes. NOT cute.
// Built as DISTINCT silhouettes (not human + costume): each species reads from its
// own outline at thumbnail size. Species cues are ≥0.25u and front-protruding.
// Same ~2.5u scale as the people builders so the two sets compose in one scene.
//
// RIGGED for reuse in walking games (shelf-it customers): legs are hip-pivot groups
// (legL/legR) and arms are shoulder-pivot groups (armL/armR), exposed on
// g.userData.rig so an external walk loop can swing them. g.userData.armBase holds a
// forward/back reach offset (zombie, mummy) the swing layers on top of. The ghost is
// intentionally rig-less — it has no legs and should glide/float.
import * as THREE from 'three';
import { P, box, cyl, ball, cone, wedge, darken } from '../lib/prims.js';

const EYE = 0x201b18;

// horror palette — cold deathly tints, dried blood, raw bone, sick rot, fur, spectre
const MP = {
  pale:0xcdd2cf, paleD:0xb0b6b2,        // vampire deathly skin
  suit:0x1b1b22, suitD:0x12121a,        // formal near-black
  blood:0x7d1820, bloodD:0x521017,      // dried blood
  bone:0xe9e2cd, boneD:0xcdc4a7,        // raw bone / skull
  rot:0x83a05a, rotD:0x5f7a3e, rotG:0x4a6230, // zombie flesh
  fur:0x5b4a3b, furD:0x3f3327, furL:0x6f5a46,  // werewolf
  spectre:0xbcd6e2,                     // ghost
  band:0xd9cdb0, bandD:0xb6a988,        // mummy wraps
  glowRed:0xff3322, glowYel:0xffd23f, glowGrn:0x9bff5a, glowPale:0xd8ecff,
};
const glow = c => ({ e:c, ei:0.9 });

// attach hip/shoulder pivot groups + walk rig metadata, then ground-shadow flags
function rig(g, legL, legR, armL, armR, armBase=0){
  g.add(legL); g.add(legR); g.add(armL); g.add(armR);
  g.userData.rig = { legL, legR, armL, armR };
  g.userData.armBase = armBase;
  if(armBase){ armL.rotation.x = armR.rotation.x = armBase; }   // rest pose for static frames
}
function finish(g){ g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); }

// ─── VAMPIRE: gaunt pale aristocrat, blood-red cape + upswept collar wings, fangs ─
export function vampire(){
  const g = new THREE.Group();
  const BW=0.86, BD=0.48, torsoH=0.88, legH=0.96, shoeH=0.16;
  const lx=0.22, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.30,shoeH,BD+0.04, MP.suitD, 0, shoeH/2-hipY, 0.04));     // pointed shoes
    L.add(box(0.26,legH,BD-0.10, MP.suit, 0, (shoeH+legH/2)-hipY, 0));   // black trousers
  });
  const torsoY = hipY+torsoH/2;
  g.add(box(BW,torsoH,BD, MP.suit, 0,torsoY,0));                          // suit body
  g.add(box(0.30,torsoH*0.84,0.04, P.cream, 0,torsoY+0.02,BD/2+0.01));    // pale shirt placket
  g.add(box(0.16,0.10,0.05, MP.blood, 0,torsoY+torsoH*0.30,BD/2+0.03));   // blood-red medallion
  // arms — thin, hanging (shoulder pivots)
  const ax=BW/2+0.14, shoulderY=torsoY+torsoH/2, armH=torsoH+0.30;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=> A.add(box(0.20,armH,BD-0.10, MP.suit, 0, -armH/2+0.10, 0)));
  // CAPE: wide panel behind, dried-blood; tall upswept collar wings flank the head
  g.add(box(BW+0.28,torsoH+legH*0.7,0.06, MP.bloodD, 0, torsoY-0.10, -BD/2-0.04));
  for(const sx of [-1,1]){
    const wing = box(0.10,0.62,0.34, MP.blood, sx*(BW/2+0.04), torsoY+torsoH/2+0.30, -0.12);
    wing.rotation.z = sx*-0.34; g.add(wing);                             // splayed collar wings
  }
  // head — narrow, gaunt
  const HW=0.50,HH=0.62,HDP=0.46;
  const headY = torsoY+torsoH/2+0.06+HH/2;
  g.add(box(HW,HH,HDP, MP.pale, 0,headY,0));
  g.add(box(HW-0.06,0.14,HDP-0.04, MP.paleD, 0,headY-HH/2+0.10,0.02));    // sunken hollow cheeks
  const fz=HDP/2+0.01, eyeY=headY+0.05, eyeX=HW*0.25;
  for(const sx of [-1,1]) g.add(box(0.12,0.08,0.04, MP.glowRed, sx*eyeX,eyeY,fz, glow(MP.glowRed)));
  for(const sx of [-1,1]) g.add(box(0.05,0.10,0.04, P.white, sx*0.08, headY-HH/2+0.04, fz)); // fangs
  // slicked black hair with a widow's peak point at the brow
  const topHead=headY+HH/2;
  g.add(box(HW+0.04,0.18,HDP+0.04, MP.suit, 0,topHead+0.04,0));
  g.add(box(HW+0.04,0.30,0.12, MP.suit, 0,headY+0.10,-HDP*0.5));
  g.add(box(0.12,0.16,0.05, MP.suit, 0,headY+HH*0.5-0.04,fz-0.01));       // widow's peak
  rig(g, legL,legR,armL,armR, 0); finish(g); return g;
}

// ─── WEREWOLF: hunched brute, forward muzzle + fangs, pointed ears, claws, tail ──
export function werewolf(){
  const g = new THREE.Group();
  const BW=1.18, BD=0.62, torsoH=0.92, legH=0.66, shoeH=0.14;
  const lx=0.30, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.40,0.16,0.40, MP.furD, 0, 0.08-hipY, 0.10));             // big paws
    for(let c=-1;c<=1;c++) L.add(box(0.07,0.06,0.10, MP.bone, c*0.12, 0.04-hipY, 0.30)); // toe claws
    L.add(box(0.34,legH,BD-0.16, MP.fur, 0, (shoeH+legH/2)-hipY, 0));    // shaggy thighs
  });
  // torso pitched forward (hunch)
  const torso = new THREE.Group();
  const torsoY = hipY+torsoH/2;
  torso.position.set(0,torsoY,0); torso.rotation.x = 0.20;
  torso.add(box(BW,torsoH,BD, MP.fur, 0,0,0));
  torso.add(box(BW*0.6,0.40,0.06, MP.furL, 0,0.05,BD/2+0.01));           // pale chest fur tuft
  torso.add(box(BW+0.10,0.34,BD*0.7, MP.furD, 0,torsoH/2+0.02,-0.06));   // hunched shoulders
  g.add(torso);
  // long arms with claws, hanging forward (shoulder pivots; base tilt held in armBase)
  const ax=BW/2+0.12, shoulderY=torsoY+torsoH/2-0.10, armH=torsoH+0.40;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0.04); armR.position.set(ax,shoulderY,0.04);
  [armL,armR].forEach(A=>{
    A.add(box(0.26, armH, 0.28, MP.fur, 0,-armH/2+0.10,0));
    A.add(box(0.30,0.18,0.30, MP.furD, 0,-armH+0.16,0.06));              // fist
    for(let c=-1;c<=1;c++) A.add(box(0.06,0.05,0.13, MP.bone, c*0.10,-armH+0.12,0.22)); // claws
  });
  // tail
  const tail = box(0.20,0.20,0.66, MP.furD, 0, torsoY-0.10, -BD/2-0.24);
  tail.rotation.x = -0.5; g.add(tail);
  // head low & forward with a long muzzle
  const HW=0.56,HH=0.50,HDP=0.52;
  const headY = torsoY+torsoH/2+0.04, headZ = 0.18;
  g.add(box(HW,HH,HDP, MP.fur, 0,headY,headZ));
  g.add(box(0.34,0.26,0.34, MP.furL, 0,headY-0.08,headZ+HDP/2+0.10));    // muzzle
  g.add(box(0.16,0.12,0.10, EYE, 0,headY-0.02,headZ+HDP/2+0.28));        // nose
  for(const sx of [-1,1]) g.add(box(0.06,0.12,0.05, P.white, sx*0.09, headY-0.18, headZ+HDP/2+0.20)); // fangs
  for(const sx of [-1,1]) g.add(cone(0.16,0.34,4, MP.furD, sx*0.20, headY+HH/2+0.14, headZ-0.04)); // ears
  const eyeY=headY+0.08;
  for(const sx of [-1,1]) g.add(box(0.10,0.07,0.04, MP.glowYel, sx*0.15,eyeY,headZ+HDP/2+0.01, glow(MP.glowYel)));
  rig(g, legL,legR,armL,armR, 0.28); finish(g); return g;
}

// ─── ZOMBIE: lurching rotten corpse, exposed ribs, hanging jaw, reaching arms ────
export function zombie(){
  const g = new THREE.Group();
  const BW=0.94, BD=0.52, torsoH=0.82, legH=0.90, shoeH=0.16;
  const lx=0.22, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.30,shoeH,BD-0.02, MP.suitD, 0, shoeH/2-hipY, 0.04));
    L.add(box(0.30,legH,BD-0.08, MP.rot, 0, (shoeH+legH/2)-hipY, 0));    // rotten leg
    L.add(box(0.32,legH*0.5,BD-0.06, darken(P.blue,0.4), 0, (shoeH+legH*0.32)-hipY, 0)); // torn trouser
  });
  // torso tilted, decayed shirt with a torn-open midriff showing ribs
  const torsoY = hipY+torsoH/2;
  const torso = new THREE.Group(); torso.position.set(0.06,torsoY,0); torso.rotation.z = -0.06;
  torso.add(box(BW,torsoH,BD, darken(P.green,0.4), 0,0,0));              // grimy shirt
  torso.add(box(BW*0.5,torsoH*0.5,0.04, MP.rotG, -0.10,-0.10,BD/2+0.01)); // gaping rot hole
  for(let i=0;i<3;i++) torso.add(box(0.34,0.05,0.05, MP.bone, -0.10,-0.20+i*0.13,BD/2+0.03)); // ribs
  g.add(torso);
  // arms reaching forward (shoulder pivots; -1.15 base = toward viewer)
  const ax=BW/2+0.12, shoulderY=torsoY+torsoH/2-0.08, armH=torsoH+0.30;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(0.22, armH, BD-0.12, MP.rot, 0,-armH/2+0.08,0));
    A.add(box(0.24,0.18,0.20, MP.rotD, 0,-armH+0.12,0));                 // limp hand
  });
  // head lolling, sunken eyes, hanging jaw
  const HW=0.52,HH=0.56,HDP=0.48;
  const head = new THREE.Group();
  head.position.set(-0.04, torsoY+torsoH/2+0.06+HH/2, 0); head.rotation.z = 0.12;
  head.add(box(HW,HH,HDP, MP.rot, 0,0,0));
  const fz=HDP/2+0.01;
  for(const sx of [-1,1]){
    head.add(box(0.14,0.12,0.04, MP.rotG, sx*HW*0.24, 0.06, fz));        // sunken sockets
    head.add(box(0.07,0.07,0.04, MP.glowYel, sx*HW*0.24, 0.06, fz+0.01, glow(MP.glowYel)));
  }
  head.add(box(0.06,0.05,0.05, EYE, 0,0.0,fz));                          // rotted nose hole
  head.add(box(HW-0.10,0.18,HDP-0.08, MP.rotG, 0,-HH/2-0.04,0.02));      // hanging open jaw
  for(let i=-1;i<=1;i++) head.add(box(0.05,0.08,0.04, P.white, i*0.12,-HH/2+0.02,fz)); // teeth
  head.add(box(HW+0.02,0.16,HDP+0.02, darken(P.green,0.3), 0,HH/2-0.02,0)); // matted hair
  g.add(head);
  rig(g, legL,legR,armL,armR, -1.15); finish(g); return g;
}

// ─── GHOST: legless wailing spectre, tapered wispy tails, hollow face (rig-less) ─
export function ghost(){
  const g = new THREE.Group();
  const sheet = MP.spectre, op = 0.6;
  const baseY = 0.55;                                  // floats above ground
  const BW=0.92, BD=0.46;
  g.add(box(BW, 0.70, BD, sheet, 0, baseY+0.95, 0, {o:op}));
  g.add(box(BW-0.10, 0.40, BD-0.04, sheet, 0, baseY+0.50, 0, {o:op}));
  const tails=[-0.30,0,0.30], th=[0.34,0.46,0.30];
  tails.forEach((tx,i)=> g.add(box(0.22, th[i], BD-0.10, sheet, tx, baseY+0.20-(0.46-th[i])/2, 0, {o:op})));
  for(const sx of [-1,1]){
    const arm = box(0.18,0.46,0.22, sheet, sx*(BW/2+0.06), baseY+0.92, 0.04, {o:op});
    arm.rotation.z = sx*0.5; g.add(arm);
  }
  const headY = baseY+0.95+0.35+0.26;
  g.add(box(0.66,0.58,0.50, sheet, 0, headY, 0, {o:op}));
  g.add(box(0.58,0.16,0.46, sheet, 0, headY+0.30, 0, {o:op}));           // rounded crown cap
  const fz=0.26;
  for(const sx of [-1,1]) g.add(box(0.15,0.20,0.05, EYE, sx*0.17, headY+0.06, fz)); // hollow voids
  g.add(box(0.20,0.24,0.05, EYE, 0, headY-0.18, fz));                    // wailing mouth
  g.add(box(0.30,0.40,0.10, MP.glowPale, 0, baseY+0.80, 0, glow(MP.glowPale))); // spectral core
  finish(g); return g;                                                   // no rig → glides/floats
}

// ─── SKELETON: bare bones — skull, ribcage, spine, pelvis, thin limb bones ───────
export function skeleton(){
  const g = new THREE.Group();
  const bone = MP.bone, bD = MP.boneD;
  const shoeH=0.12, legH=0.92, lx=0.20, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.24,shoeH,0.32, bD, 0, shoeH/2-hipY, 0.06));              // foot
    L.add(cyl(0.07,0.07,legH*0.5,6, bone, 0, (shoeH+legH*0.27)-hipY, 0)); // shin
    L.add(box(0.10,0.10,0.10, bD, 0, (shoeH+legH*0.52)-hipY, 0));        // knee
    L.add(cyl(0.08,0.08,legH*0.5,6, bone, 0, (shoeH+legH*0.78)-hipY, 0)); // femur
  });
  g.add(box(0.46,0.22,0.30, bone, 0,hipY+0.05,0));                       // pelvis
  const ribBase = hipY+0.20;
  g.add(box(0.10,0.86,0.12, bD, 0, ribBase+0.40, -0.06));                // spine
  const ribW=[0.52,0.58,0.56,0.48];
  ribW.forEach((w,i)=> g.add(box(w,0.07,0.34, bone, 0, ribBase+0.10+i*0.18, 0.02))); // rib bars
  g.add(box(0.40,0.16,0.30, bone, 0, ribBase+0.82, 0));                  // sternum/clavicle
  // arms — thin hanging bones (shoulder pivots)
  const shoulderY = ribBase+0.86, ax=0.40;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(cyl(0.06,0.06,0.46,6, bone, 0, -0.20, 0));                     // humerus
    A.add(box(0.09,0.09,0.09, bD, 0, -0.44, 0));                         // elbow
    A.add(cyl(0.055,0.055,0.42,6, bone, 0, -0.66, 0.02));               // forearm
    for(let c=-1;c<=1;c++) A.add(box(0.04,0.12,0.04, bone, c*0.06, -0.92, 0.03)); // finger bones
  });
  // skull
  const HW=0.50,HH=0.50,HDP=0.46;
  const headY = shoulderY+0.10+HH/2;
  g.add(box(HW,HH,HDP, bone, 0,headY,0));
  g.add(box(HW-0.06,0.18,HDP-0.04, bD, 0,headY-HH/2+0.08,0.02));         // jaw block
  const fz=HDP/2+0.01;
  for(const sx of [-1,1]) g.add(box(0.15,0.16,0.06, EYE, sx*0.14, headY+0.06, fz)); // sockets
  g.add(box(0.07,0.10,0.05, EYE, 0, headY-0.04, fz));                    // nasal cavity
  for(let i=-2;i<=2;i++) g.add(box(0.045,0.09,0.04, bD, i*0.09, headY-HH/2+0.04, fz)); // teeth
  rig(g, legL,legR,armL,armR, 0); finish(g); return g;
}

// ─── MUMMY: wrapped corpse, stacked bandage bands, one glowing eye, reaching arms ─
export function mummy(){
  const g = new THREE.Group();
  const shoeH=0.16, legH=0.86, lx=0.21, BD=0.50, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.32,shoeH,BD, MP.bandD, 0, shoeH/2-hipY, 0.04));
    for(let i=0;i<5;i++){
      const c = i%2 ? MP.band : MP.bandD, off = (i%2?0.02:-0.02);
      L.add(box(0.32,0.16,BD-0.06, c, off, (shoeH+0.08+i*0.16)-hipY, 0));
    }
  });
  const torsoY = hipY, BW=0.96, torsoH=0.84;
  for(let i=0;i<6;i++){                                                  // torso wrap bands
    const c = i%2 ? MP.band : MP.bandD, w = BW - (i%3)*0.04, off = (i%2? 0.03 : -0.03);
    g.add(box(w, 0.16, BD, c, off, torsoY+0.09+i*0.15, 0));
  }
  const flap = box(0.14,0.42,0.05, MP.bandD, 0.20, torsoY+0.30, BD/2+0.02);
  flap.rotation.z = 0.4; g.add(flap);                                    // peeling chest wrap
  // arms reaching forward, wrapped (shoulder pivots; -1.1 base = toward viewer)
  const ax=BW/2+0.12, shoulderY=torsoY+torsoH-0.06;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    for(let i=0;i<5;i++){ const c = i%2 ? MP.band : MP.bandD; A.add(box(0.22,0.16,0.24, c, 0, -0.08-i*0.15, 0)); }
    A.add(box(0.06,0.34,0.04, MP.band, 0, -0.86, 0.10));                 // dangling wrist wrap
  });
  // head — wrapped, one dark eye-slit with a faint glow
  const HW=0.52,HH=0.58,HDP=0.48;
  const headY = torsoY+torsoH+0.06+HH/2;
  for(let i=0;i<4;i++){
    const c = i%2 ? MP.band : MP.bandD, off=(i%2?0.02:-0.02);
    g.add(box(HW,0.16,HDP, c, off, headY-HH/2+0.08+i*0.15, 0));
  }
  const fz=HDP/2+0.01;
  g.add(box(0.18,0.06,0.04, EYE, -0.06, headY+0.04, fz));                // exposed eye gap
  g.add(box(0.09,0.05,0.04, MP.glowGrn, -0.06, headY+0.04, fz+0.01, glow(MP.glowGrn)));
  const tail = box(0.10,0.40,0.05, MP.band, -HW/2-0.02, headY-0.10, 0.04);
  tail.rotation.z = -0.3; g.add(tail);                                   // trailing head wrap
  rig(g, legL,legR,armL,armR, -1.1); finish(g); return g;
}

export const MONSTERS = { vampire, werewolf, zombie, ghost, skeleton, mummy };

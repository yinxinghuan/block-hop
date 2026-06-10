// archetypes.js — profession + pop-culture pack (FAMILY B bespoke per-char).
// V4: CROSSY-ROAD-style CULTURAL CARICATURE. Each character is no longer "uniformed
// professional" but a specific iconic pop-culture caricature — donut-eating NYPD,
// WWII pin-up nurse, FDNY hero, Village People YMCA macho, vintage newsboy, Clint
// Eastwood spaghetti-western, 90s NYC Notorious BIG, Fonzie wild-one greaser.
// Punk (Sid Vicious) and goth (Morticia) carried over from V3 unchanged because
// they already landed the cultural register.
//
// Why the rewrite: monsters work because each is a CULTURAL ICON (Dracula /
// lycanthrope / spectre), not because they wear costumes. Earlier passes here
// kept the "single muted teal accent" civilian discipline, which produced
// realistic uniformed-worker variations rather than punchy cultural caricatures.
// V4 embraces saturated multi-colour Crossy Road palette + cultural signature
// props that change the silhouette (duster cape, winged cap, hose wrap, etc.)
import * as THREE from 'three';
import { P, box, darken } from '../lib/prims.js';

const EYE = 0x241f1c, FRAME = 0x4a3526;
const SHADE = 0x14110e;
const TEAL_GLOW = { e: P.accent, ei: 0.55 };
const glow = (c, ei=0.55) => ({ e: c, ei });

function rig(g, legL, legR, armL, armR, armBase=0){
  g.add(legL); g.add(legR); g.add(armL); g.add(armR);
  g.userData.rig = { legL, legR, armL, armR };
  g.userData.armBase = armBase;
  if(armBase){ armL.rotation.x = armR.rotation.x = armBase; }
}
function finish(g){ g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); }
function eyes(g, headY, HW, HDP, eyeYOffset=0.02){
  const fz = HDP/2+0.01, eyeY = headY+eyeYOffset, eyeX = HW*0.26;
  g.add(box(0.12,0.12,0.04, EYE, -eyeX, eyeY, fz));
  g.add(box(0.12,0.12,0.04, EYE,  eyeX, eyeY, fz));
  return { fz, eyeY, eyeX };
}

// ─── COP: DONUT-EATING NYPD STEREOTYPE ── big-bellied caricature, brown
//     handlebar mustache, mirrored aviators, holding a pink sprinkled donut ──
export function cop(){
  const g = new THREE.Group();
  const BW=1.18, BD=0.66, torsoH=0.86, legH=0.82, shoeH=0.18;       // big belly = BD wider; short legs
  const lx=0.24, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.36,shoeH,BD,     P.ironD,                   0, shoeH/2-hipY,        0.04));
    L.add(box(0.32,legH,BD-0.10, darken(P.ironD, 0.25),     0, (shoeH+legH/2)-hipY, 0));   // dark navy trousers
    L.add(box(0.34,0.06,BD-0.08, P.gold,                    0, (shoeH+legH*0.50)-hipY, 0.04)); // gold trouser stripe
  });
  const torsoY = hipY+torsoH/2;
  // SOLID BRIGHT BLUE uniform shirt (no darken — Crossy Road saturation)
  g.add(box(BW, torsoH, BD, P.blue, 0, torsoY, 0));
  // BELLY OVERHANG — the iconic cop paunch (round + protruding forward)
  g.add(box(BW+0.04, 0.30, BD+0.06, P.blue, 0, torsoY-torsoH*0.32, 0));
  g.add(box(BW-0.12, 0.10, BD+0.10, P.blue, 0, torsoY-torsoH*0.46, 0));                    // belly bottom curve
  // collar tab + tie
  g.add(box(0.26, 0.16, 0.04, darken(P.blue,0.3), 0, torsoY+torsoH/2-0.10, BD/2+0.02));
  g.add(box(0.08, torsoH*0.5, 0.04, P.ironD, 0, torsoY+0.04, BD/2+0.025));                 // dark tie
  // GIANT GOLD STAR BADGE (Crossy Road: bright + big)
  g.add(box(0.26, 0.28, 0.05, P.gold, -BW/2+0.26, torsoY+0.10, BD/2+0.03));
  g.add(box(0.16, 0.18, 0.06, darken(P.gold,0.4), -BW/2+0.26, torsoY+0.10, BD/2+0.055));    // star core
  // NAME TAG silver
  g.add(box(0.22, 0.07, 0.04, P.steel,  BW/2-0.20, torsoY+0.22, BD/2+0.03));
  // BELT + holster + nightstick
  g.add(box(BW+0.06, 0.16, BD+0.04, P.ironD, 0, torsoY-torsoH/2+0.07, 0));
  g.add(box(0.22, 0.18, 0.06, P.gold, 0, torsoY-torsoH/2+0.07, BD/2+0.030));                // big gold buckle
  g.add(box(0.20, 0.26, 0.18, P.ironD,  BW/2+0.10, torsoY-torsoH/2-0.06, 0));               // holster
  g.add(box(0.08, 0.42, 0.08, darken(P.woodD,0.2), -BW/2-0.10, torsoY-torsoH/2-0.10, 0));   // nightstick
  // arms — LEFT arm raised holding DONUT, right arm hanging
  const armW=0.26, armH=torsoH+legH*0.22, shoulderY=torsoY+torsoH/2;
  const ax=BW/2+0.02+armW/2;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(armW, armH*0.66, BD-0.06, P.blue,  0, (torsoY+torsoH/2-armH*0.33)-shoulderY, 0));
    A.add(box(armW, armH*0.34, BD-0.06, P.skin,  0, (torsoY+torsoH/2-armH*0.83)-shoulderY, 0));
  });
  // DONUT in left hand — pink ring (silhouette extender, the iconic cop prop)
  armL.rotation.x = -0.6;                                                                    // forearm raised
  armL.add(box(0.30, 0.30, 0.18, P.petal,    0.08, -armH*0.78, 0.18));                       // donut body (pink)
  armL.add(box(0.14, 0.30, 0.06, P.cream,    0.08, -armH*0.78, 0.18));                       // donut hole (gap)
  // sprinkles on donut
  for(let i=0;i<5;i++) armL.add(box(0.03, 0.05, 0.03, [P.red,P.blue,P.gold,P.green,P.purple][i],
                                    0.04+i*0.05, -armH*0.74, 0.18));
  // head + face
  const HW=0.60, HH=0.60, HDP=0.52;
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.32,0.12,0.30, P.skinTan, 0, neckY, 0));
  const headY = neckY+0.06+HH/2;
  g.add(box(HW,HH,HDP, P.skinTan, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  // BIG HANDLEBAR MUSTACHE — the iconic cop signature
  g.add(box(0.42, 0.10, 0.05, P.hairBrown, 0, headY-HH*0.16, HDP/2+0.012));
  g.add(box(0.08, 0.10, 0.06, P.hairBrown,  0.18, headY-HH*0.10, HDP/2+0.012));               // L curl up
  g.add(box(0.08, 0.10, 0.06, P.hairBrown, -0.18, headY-HH*0.10, HDP/2+0.012));               // R curl up
  // AVIATOR SHADES — teardrop frames (wider at top)
  g.add(box(0.20, 0.14, 0.04, SHADE, -HW*0.26, headY+0.04, HDP/2+0.012));
  g.add(box(0.20, 0.14, 0.04, SHADE,  HW*0.26, headY+0.04, HDP/2+0.012));
  g.add(box(0.10, 0.04, 0.03, P.gold,        0, headY+0.06, HDP/2+0.012));                    // bridge
  // PEAKED CAP — dark blue with patent black brim + gold center badge
  const topHead = headY+HH/2;
  g.add(box(HW+0.06, 0.18, HDP+0.06, darken(P.blue,0.4), 0, topHead+0.09, 0));                // crown
  g.add(box(HW+0.10, 0.05, HDP+0.10, P.ironD,           0, topHead+0.01, 0));                 // patent band
  g.add(box(HW*0.86, 0.05, 0.22, P.ironD,                0, topHead-0.02, HDP/2+0.10));        // patent peak
  g.add(box(0.16, 0.10, 0.04, P.gold, 0, topHead+0.06, HDP/2+0.10));                          // gold cap badge
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── NURSE: WWII PIN-UP / RED CROSS POSTER — bright white with BIG RED CROSS,
//     WINGED CAP (two vertical fins), short skirt, red cape, brilliant red lips ─
export function nurse(){
  const g = new THREE.Group();
  const BW=0.84, BD=0.46, torsoH=0.74, legH=0.86, shoeH=0.16;
  const lx=0.18, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  // SHORT WHITE SKIRT — silhouette flares slightly at hip
  const skirtY = shoeH+legH-0.30;
  g.add(box(BW+0.10, 0.36, BD+0.04, P.white, 0, skirtY, 0));
  g.add(box(BW+0.12, 0.04, BD+0.06, P.red, 0, skirtY-0.18, 0));                              // red hem stripe
  [legL,legR].forEach(L=>{
    L.add(box(0.26, shoeH, BD-0.02, P.red,    0, shoeH/2-hipY,         0.05));                // red shoes
    L.add(box(0.24, legH*0.46, BD-0.10, P.white, 0, (shoeH+legH*0.23)-hipY, 0));               // white stockings (lower)
    L.add(box(0.22, legH*0.30, BD-0.12, P.skin,  0, (shoeH+legH*0.62)-hipY, 0));               // upper leg skin
  });
  const torsoY = hipY+torsoH/2;
  g.add(box(BW, torsoH, BD, P.white, 0, torsoY, 0));                                          // white dress top
  // GIANT RED CROSS on the chest — the iconic nurse symbol
  g.add(box(0.18, 0.50, 0.04, P.red, 0, torsoY+0.02, BD/2+0.02));                              // vertical
  g.add(box(0.50, 0.18, 0.04, P.red, 0, torsoY+0.02, BD/2+0.02));                              // horizontal
  // RED CAPE over the shoulders — flares behind/sides (silhouette extender at shoulders)
  g.add(box(BW+0.20, 0.40, 0.06, P.red, 0, torsoY+torsoH*0.30, -BD/2-0.04));                  // back panel
  g.add(box(0.10, 0.30, BD+0.04, P.red, -BW/2-0.04, torsoY+torsoH*0.25, 0));                  // L side flap
  g.add(box(0.10, 0.30, BD+0.04, P.red,  BW/2+0.04, torsoY+torsoH*0.25, 0));                  // R side flap
  // belt
  g.add(box(BW+0.04, 0.08, BD+0.04, P.red, 0, torsoY-torsoH/2+0.08, 0));
  g.add(box(0.18, 0.10, 0.04, P.white, 0, torsoY-torsoH/2+0.08, BD/2+0.025));                 // white buckle
  // arms (slim, white sleeves with red cuffs)
  const armW=0.20, armH=torsoH+legH*0.26, shoulderY=torsoY+torsoH/2;
  const ax=BW/2+0.02+armW/2;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(armW, armH*0.66, BD-0.10, P.white, 0, (torsoY+torsoH/2-armH*0.33)-shoulderY, 0));
    A.add(box(armW+0.02, 0.05, BD-0.08, P.red,   0, (torsoY+torsoH/2-armH*0.66)-shoulderY, 0.01)); // red cuff
    A.add(box(armW, armH*0.34, BD-0.10, P.skin,  0, (torsoY+torsoH/2-armH*0.83)-shoulderY, 0));
  });
  // head + face — pretty proportions
  const HW=0.54, HH=0.60, HDP=0.48;
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.28,0.12,0.26, P.skin, 0, neckY, 0));
  const headY = neckY+0.06+HH/2;
  g.add(box(HW,HH,HDP, P.skin, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  // BRILLIANT RED LIPSTICK
  g.add(box(0.18, 0.07, 0.04, P.red, 0, headY-HH*0.30, HDP/2+0.012));
  // brown pin-curls visible at the sides
  const topHead = headY+HH/2;
  g.add(box(HW+0.02, 0.10, HDP+0.02, P.hairBrown, 0, topHead-0.02, 0));
  g.add(box(0.14, 0.14, 0.14, P.hairBrown, -(HW/2+0.05), headY-0.04, -0.02));                 // L curl
  g.add(box(0.14, 0.14, 0.14, P.hairBrown,  (HW/2+0.05), headY-0.04, -0.02));                 // R curl
  // WINGED CAP — small white cap with TWO VERTICAL WINGS standing up (silhouette extender)
  g.add(box(HW+0.04, 0.10, HDP, P.white, 0, topHead+0.10, 0));                                 // cap base
  // the wings — fins angled slightly outward
  const wingL = box(0.14, 0.30, 0.04, P.white, -HW*0.20, topHead+0.30, 0); wingL.rotation.z = -0.20; g.add(wingL);
  const wingR = box(0.14, 0.30, 0.04, P.white,  HW*0.20, topHead+0.30, 0); wingR.rotation.z =  0.20; g.add(wingR);
  // RED CROSS on the cap — front and center
  g.add(box(0.16, 0.06, 0.04, P.red, 0, topHead+0.10, HDP/2-0.02));                            // horizontal
  g.add(box(0.06, 0.14, 0.04, P.red, 0, topHead+0.10, HDP/2-0.02));                            // vertical
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── FIREFIGHTER: FDNY HERO — bright yellow + red helmet, HOSE COILED across
//     the torso like a python wrap (silhouette extender), American flag patch,
//     big brown mustache, leather boots ─────────────────────────────
export function firefighter(){
  const g = new THREE.Group();
  const BW=1.16, BD=0.58, torsoH=0.84, legH=0.86, shoeH=0.22;
  const lx=0.26, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.42, shoeH, BD+0.04, P.ironD, 0, shoeH/2-hipY, 0.06));                          // black boots
    L.add(box(0.36, legH, BD-0.04, P.gold,   0, (shoeH+legH/2)-hipY, 0));                      // bright golden pants
    L.add(box(0.38, 0.06, BD-0.02, P.cream, 0, (shoeH+legH*0.30)-hipY, 0.02));                 // reflective ankle band
    L.add(box(0.38, 0.06, BD-0.02, P.cream, 0, (shoeH+legH*0.65)-hipY, 0.02));                 // reflective mid band
  });
  const torsoY = hipY+torsoH/2;
  // BRIGHT YELLOW/GOLD turnout coat (no darken — saturated)
  g.add(box(BW, torsoH, BD, P.gold, 0, torsoY, 0));
  // reflective stripes — bright cream + teal glow
  g.add(box(BW+0.02, 0.07, BD+0.02, P.cream,  0, torsoY+0.20, 0));
  g.add(box(BW+0.02, 0.07, BD+0.02, P.cream,  0, torsoY-0.16, 0));
  // dark collar
  g.add(box(BW-0.14, 0.16, 0.04, P.ironD, 0, torsoY+torsoH/2-0.10, BD/2+0.02));
  g.add(box(0.06, torsoH-0.20, 0.04, P.ironD, 0, torsoY-0.04, BD/2+0.02));                    // zipper
  // FDNY-style chest stencil (block letters in red on coat)
  for(let i=0;i<4;i++) g.add(box(0.10, 0.10, 0.04, darken(P.red,0.2), -0.24+i*0.16, torsoY-0.04, BD/2+0.025));
  // AMERICAN FLAG PATCH on left shoulder area (red + white + blue mini-tiles)
  for(let i=0;i<3;i++) g.add(box(0.05, 0.04, 0.05, P.red,   -BW/2+0.18, torsoY+0.18+i*0.04, BD/2+0.030));
  for(let i=0;i<2;i++) g.add(box(0.05, 0.04, 0.05, P.cream, -BW/2+0.18, torsoY+0.20+i*0.04, BD/2+0.030));
  g.add(box(0.10, 0.07, 0.05, darken(P.blue,0.2), -BW/2+0.18, torsoY+0.28, BD/2+0.030));      // flag canton
  // HOSE COILED across torso — diagonal coils like a python wrap (silhouette extender)
  const hoseCol = darken(P.red, 0.15);
  for(let i=0;i<5;i++){
    const a = -0.55 + i*0.27;                                                                  // ascending diagonal
    const yy = torsoY + i*0.08 - 0.18;
    g.add(box(0.14, 0.10, 0.10, hoseCol, a*0.5,  yy,  BD/2+0.05));                             // front coil
    g.add(box(0.14, 0.10, 0.10, hoseCol, a*0.5,  yy, -BD/2-0.05));                             // back coil
    g.add(box(0.10, 0.10, BD+0.16, hoseCol, a*0.5+0.15, yy, 0));                               // side wrap
  }
  // nozzle end of hose at the right hand area
  g.add(box(0.12, 0.18, 0.12, P.steel, BW/2+0.04, torsoY-0.30, BD/2+0.04));
  // arms
  const armW=0.28, armH=torsoH+legH*0.24, shoulderY=torsoY+torsoH/2;
  const ax=BW/2+0.02+armW/2;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(armW, armH*0.66, BD-0.06, P.gold,            0, (torsoY+torsoH/2-armH*0.33)-shoulderY, 0));
    A.add(box(armW+0.02, armH*0.34, BD-0.06, P.ironD,      0, (torsoY+torsoH/2-armH*0.83)-shoulderY, 0)); // leather glove
    A.add(box(armW+0.04, 0.06, BD-0.04, P.cream, 0, (torsoY+torsoH/2-armH*0.55)-shoulderY, 0.01)); // sleeve stripe
  });
  // head + face
  const HW=0.58, HH=0.60, HDP=0.52;
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.30,0.12,0.28, P.skinTan, 0, neckY, 0));
  const headY = neckY+0.06+HH/2;
  g.add(box(HW,HH,HDP, P.skinTan, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  // BIG MUSTACHE — the all-American FDNY guy
  g.add(box(0.42, 0.08, 0.05, P.hairBrown, 0, headY-HH*0.16, HDP/2+0.012));
  // BUNKER HELMET — bright red with tall front shield + rear-flared brim
  const topHead = headY+HH/2;
  g.add(box(HW+0.12, 0.20, HDP+0.10, P.red, 0, topHead+0.11, 0));                              // dome
  g.add(box(HW+0.12, 0.04, HDP+0.32, P.red, 0, topHead+0.02, -0.10));                          // rear flare
  g.add(box(HW-0.02, 0.24, 0.12, P.red, 0, topHead+0.18, HDP/2+0.04));                         // front shield
  g.add(box(HW-0.20, 0.10, 0.14, P.cream, 0, topHead+0.20, HDP/2+0.10));                       // shield emblem
  g.add(box(HW-0.30, 0.06, 0.14, darken(P.blue,0.3), 0, topHead+0.12, HDP/2+0.10));            // shield number block
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── CONSTRUCTION: VILLAGE PEOPLE YMCA MACHO — bright orange TANK TOP (bare
//     arms!), big brown mustache, yellow hard hat, blue jeans, tool belt ────
export function construction(){
  const g = new THREE.Group();
  const BW=1.12, BD=0.54, torsoH=0.82, legH=0.92, shoeH=0.20;
  const lx=0.24, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.36, shoeH+0.04, BD, P.woodD,  0, (shoeH+0.04)/2-hipY, 0.05));                  // brown work boots
    L.add(box(0.36, legH, BD-0.04, P.blue,    0, (shoeH+legH/2)-hipY, 0));                     // BRIGHT blue jeans
    L.add(box(0.38, 0.04, BD-0.02, darken(P.blue,0.3), 0, (shoeH+legH*0.32)-hipY, 0.02));      // jean seam
  });
  const torsoY = hipY+torsoH/2;
  // BRIGHT ORANGE TANK TOP — no sleeves, just torso panel
  g.add(box(BW, torsoH, BD, P.orange, 0, torsoY, 0));
  // tank top STRAPS (narrow shoulder bands instead of full sleeves)
  g.add(box(0.18, 0.18, BD, P.orange, -BW/2+0.20, torsoY+torsoH/2-0.04, 0));
  g.add(box(0.18, 0.18, BD, P.orange,  BW/2-0.20, torsoY+torsoH/2-0.04, 0));
  // deep V neckline (skin showing)
  g.add(box(0.30, 0.30, 0.04, P.skinTan, 0, torsoY+torsoH*0.18, BD/2+0.02));
  g.add(box(0.12, 0.14, 0.06, darken(P.skinTan,0.3), 0, torsoY+torsoH*0.10, BD/2+0.025));      // pec cleft hint
  // tool belt
  g.add(box(BW+0.04, 0.16, BD+0.04, P.woodD, 0, torsoY-torsoH/2+0.06, 0));
  g.add(box(0.22, 0.18, 0.06, P.gold, 0, torsoY-torsoH/2+0.06, BD/2+0.025));                   // big gold buckle
  g.add(box(0.10, 0.40, 0.08, P.woodD,  BW/2+0.10, torsoY-torsoH/2-0.18, 0));                  // hammer handle
  g.add(box(0.22, 0.12, 0.20, P.steel,  BW/2+0.10, torsoY-torsoH/2-0.40, 0));                  // hammer head
  g.add(box(0.16, 0.16, 0.10, P.yellow,-BW/2-0.06, torsoY-torsoH/2-0.06, 0));                   // YMCA construction always has...
  // Wait — P.yellow doesn't exist, use P.gold
  // arms — BARE BICEPS showing (no sleeves; arms = exposed tan skin with mustachio macho bulk)
  const armW=0.30, armH=torsoH+legH*0.26, shoulderY=torsoY+torsoH/2-0.04;
  const ax=BW/2+0.02+armW/2;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    // BIG bare biceps — wider than V3, fully bare skin (no sleeve)
    A.add(box(armW+0.04, armH*0.45, BD-0.04, P.skinTan, 0, (torsoY+torsoH/2-armH*0.22)-shoulderY, 0));  // bicep BULGE
    A.add(box(armW, armH*0.55, BD-0.06, P.skinTan,             0, (torsoY+torsoH/2-armH*0.72)-shoulderY, 0));  // forearm
  });
  // work GLOVE on right hand (yellow construction glove)
  armR.add(box(armW+0.04, 0.14, BD-0.04, P.gold, 0, -armH*0.94, 0));
  // head + face
  const HW=0.58, HH=0.58, HDP=0.50;
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.30, 0.12, 0.28, P.skinTan, 0, neckY, 0));
  const headY = neckY+0.06+HH/2;
  g.add(box(HW,HH,HDP, P.skinTan, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  // BIG BROWN MUSTACHE — the macho Village People signature
  g.add(box(0.46, 0.12, 0.06, P.hairBrown, 0, headY-HH*0.15, HDP/2+0.012));
  g.add(box(0.10, 0.10, 0.06, P.hairBrown,  0.22, headY-HH*0.08, HDP/2+0.012));                // L upturn
  g.add(box(0.10, 0.10, 0.06, P.hairBrown, -0.22, headY-HH*0.08, HDP/2+0.012));                // R upturn
  // dark brown hair under hat
  const topHead = headY+HH/2;
  g.add(box(HW+0.04, 0.08, HDP+0.04, P.hairBrown, 0, topHead-0.02, 0));
  // YELLOW HARD HAT
  g.add(box(HW+0.20, 0.20, HDP+0.18, P.gold, 0, topHead+0.12, 0));                              // dome (bright gold/yellow)
  g.add(box(HW+0.06, 0.05, 0.22, P.gold, 0, topHead+0.02, HDP/2+0.06));                         // visor lip
  g.add(box(HW+0.22, 0.06, HDP+0.20, darken(P.blue,0.3), 0, topHead+0.03, 0));                   // dark band
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── DELIVERY: VINTAGE NEWSBOY / NEWSIES — FLAT 8-PANEL CAP (no peak), LEATHER
//     SATCHEL diagonal with NEWSPAPER ROLLS sticking out, aviation goggles ──
export function delivery(){
  const g = new THREE.Group();
  const BW=0.90, BD=0.48, torsoH=0.78, legH=0.84, shoeH=0.16;
  const lx=0.20, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.30, shoeH, BD, P.ironD,   0, shoeH/2-hipY,        0.05));                       // dark shoes
    L.add(box(0.28, legH*0.65, BD-0.06, P.woodM, 0, (shoeH+legH*0.32)-hipY, 0));                 // knickerbocker brown
    L.add(box(0.26, legH*0.40, BD-0.08, P.cream, 0, (shoeH+legH*0.78)-hipY, 0));                 // sock cuff
    L.add(box(0.30, 0.06, BD-0.04, darken(P.woodM,0.3), 0, (shoeH+legH*0.62)-hipY, 0.02));       // knee band
  });
  const torsoY = hipY+torsoH/2;
  // BRIGHT RED sweater
  g.add(box(BW, torsoH, BD, P.red, 0, torsoY, 0));
  // SUSPENDERS (cream straps over the shoulders)
  g.add(box(0.07, torsoH, 0.04, P.cream, -BW*0.30, torsoY, BD/2+0.02));
  g.add(box(0.07, torsoH, 0.04, P.cream,  BW*0.30, torsoY, BD/2+0.02));
  // dark brown belt
  g.add(box(BW+0.02, 0.08, BD+0.02, P.woodD, 0, torsoY-torsoH/2+0.04, 0));
  // LEATHER SATCHEL diagonal — silhouette extender across the body
  // strap going from R shoulder to L hip
  for(let i=0;i<6;i++){
    g.add(box(0.06, 0.10, 0.06, P.woodD, BW*0.30 - i*0.10, torsoY+0.18 - i*0.06, BD/2+0.025));
  }
  // SATCHEL BAG on left hip
  g.add(box(0.32, 0.34, 0.16, P.woodD, -BW/2-0.10, torsoY-0.18, 0.08));                          // bag body
  g.add(box(0.34, 0.10, 0.18, darken(P.woodD,0.3), -BW/2-0.10, torsoY-0.05, 0.08));              // bag flap top
  g.add(box(0.10, 0.06, 0.10, P.gold, -BW/2-0.10, torsoY-0.10, 0.16));                          // brass buckle
  // NEWSPAPERS sticking out of the bag
  g.add(box(0.18, 0.30, 0.06, P.cream, -BW/2-0.18, torsoY+0.04, 0.10));                          // rolled paper L
  g.add(box(0.18, 0.30, 0.06, P.cream, -BW/2-0.04, torsoY+0.04, 0.10));                          // rolled paper R
  g.add(box(0.16, 0.04, 0.06, EYE,    -BW/2-0.18, torsoY+0.10, 0.13));                           // headline ink line
  g.add(box(0.16, 0.04, 0.06, EYE,    -BW/2-0.04, torsoY+0.10, 0.13));
  // arms — both at sides
  const armW=0.22, armH=torsoH+legH*0.22, shoulderY=torsoY+torsoH/2;
  const ax=BW/2+0.02+armW/2;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(armW, armH*0.66, BD-0.10, P.red,   0, (torsoY+torsoH/2-armH*0.33)-shoulderY, 0));
    A.add(box(armW, armH*0.34, BD-0.10, P.skin,  0, (torsoY+torsoH/2-armH*0.83)-shoulderY, 0));
  });
  // RIGHT hand holds a single FOLDED NEWSPAPER (silhouette cue at hand level)
  armR.add(box(0.20, 0.16, 0.06, P.cream, 0, -armH*0.94, 0.10));
  armR.add(box(0.18, 0.04, 0.06, EYE,     0, -armH*0.92, 0.13));
  // head + face
  const HW=0.54, HH=0.56, HDP=0.48;
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.28, 0.12, 0.26, P.skin, 0, neckY, 0));
  const headY = neckY+0.06+HH/2;
  g.add(box(HW,HH,HDP, P.skin, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  // brown hair tuft visible at sides under the cap
  const topHead = headY+HH/2;
  g.add(box(HW+0.04, 0.10, HDP+0.04, P.hairBrown, 0, topHead-0.04, 0));
  // FLAT NEWSBOY CAP — wide top + tiny brim (NO baseball peak); silhouette is flat disc
  g.add(box(HW+0.20, 0.10, HDP+0.20, darken(P.woodM,0.2), 0, topHead+0.10, 0));                  // flat wide top
  g.add(box(HW+0.04, 0.08, HDP+0.04, darken(P.woodM,0.3), 0, topHead+0.02, 0));                  // narrow underside
  g.add(box(HW*0.7,  0.04, 0.10, darken(P.woodM,0.5), 0, topHead+0.00, HDP/2+0.04));             // tiny visor
  // AVIATOR GOGGLES PUSHED UP onto the cap front (signature newsboy/courier prop)
  g.add(box(0.18, 0.12, 0.04, SHADE, -HW*0.22, topHead+0.08, HDP/2+0.04));
  g.add(box(0.18, 0.12, 0.04, SHADE,  HW*0.22, topHead+0.08, HDP/2+0.04));
  g.add(box(0.10, 0.04, 0.03, P.steel,        0, topHead+0.08, HDP/2+0.04));                     // bridge
  g.add(box(HW+0.08, 0.04, 0.04, P.woodD, 0, topHead+0.04, HDP/2+0.04));                         // goggles strap
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── COWBOY: CLINT EASTWOOD MAN-WITH-NO-NAME — LONG DUSTER COAT trailing
//     behind (silhouette extender like vampire cape), poncho on shoulders,
//     cigar in mouth, huge Stetson, squint eyes ─────────────────────────
export function cowboy(){
  const g = new THREE.Group();
  const BW=1.02, BD=0.52, torsoH=0.78, legH=1.04, shoeH=0.24;     // tall + heeled boots
  const lx=0.22, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.36, shoeH, BD+0.04, P.woodD, 0, shoeH/2-hipY, 0.06));                            // tall brown boots
    L.add(box(0.10, 0.08, 0.10, darken(P.gold,0.3), 0, shoeH-0.12-hipY, BD/2+0.06));              // toe cap
    L.add(box(0.20, 0.06, 0.06, P.steel, 0, shoeH-0.08-hipY, -BD/2-0.04));                        // spur
    for(let i=0;i<4;i++) L.add(box(0.03, 0.06, 0.03, P.steel, i*0.04-0.06, shoeH-0.10-hipY, -BD/2-0.08));
    L.add(box(0.32, legH, BD-0.10, darken(P.blue,0.6), 0, (shoeH+legH/2)-hipY, 0));               // dark denim
  });
  const torsoY = hipY+torsoH/2;
  // muted denim shirt underneath
  g.add(box(BW, torsoH, BD, darken(P.blue,0.55), 0, torsoY, 0));
  // LONG DUSTER COAT — drops from shoulders to mid-thigh, trailing behind
  // (the iconic Clint Eastwood silhouette — like vampire cape, extends well past body)
  const dusterCol = P.woodM;
  g.add(box(BW+0.20, 1.10, 0.10, dusterCol, 0, torsoY-0.10, -BD/2-0.04));                         // BACK panel (long, trailing)
  g.add(box(0.16, torsoH+0.70, BD+0.10, dusterCol, -BW/2-0.06, torsoY-0.20, 0));                  // L side panel (long)
  g.add(box(0.16, torsoH+0.70, BD+0.10, dusterCol,  BW/2+0.06, torsoY-0.20, 0));                  // R side panel
  // duster open at the front showing the shirt
  g.add(box(0.12, torsoH+0.40, 0.08, darken(dusterCol,0.3), -BW*0.30, torsoY-0.10, BD/2+0.02));   // L lapel
  g.add(box(0.12, torsoH+0.40, 0.08, darken(dusterCol,0.3),  BW*0.30, torsoY-0.10, BD/2+0.02));   // R lapel
  // PONCHO over shoulders — colorful striped layer (Spaghetti-Western motif)
  for(let i=-1;i<=1;i++){
    const col = [darken(P.red,0.1), P.gold, darken(P.green,0.2)][i+1];
    g.add(box(BW+0.30, 0.10, BD+0.04, col, 0, torsoY+torsoH/2-0.04+i*0.10, 0));
  }
  // BIG BUCKLE on belt
  g.add(box(BW+0.02, 0.10, BD+0.02, P.woodD, 0, torsoY-torsoH/2+0.06, 0));
  g.add(box(0.24, 0.18, 0.04, P.gold, 0, torsoY-torsoH/2+0.06, BD/2+0.020));
  // REVOLVER hip holster
  g.add(box(0.18, 0.28, 0.16, P.woodD,    BW/2+0.10, torsoY-torsoH/2-0.04, 0));
  g.add(box(0.12, 0.14, 0.10, darken(P.woodD,0.4), BW/2+0.16, torsoY-torsoH/2-0.18, 0.05));
  // arms (lanky, with duster sleeves)
  const armW=0.26, armH=torsoH+legH*0.30, shoulderY=torsoY+torsoH/2;
  const ax=BW/2+0.06+armW/2;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(armW, armH*0.74, BD-0.06, dusterCol, 0, (torsoY+torsoH/2-armH*0.37)-shoulderY, 0)); // duster sleeve
    A.add(box(armW-0.04, armH*0.26, BD-0.08, P.skinTan, 0, (torsoY+torsoH/2-armH*0.87)-shoulderY, 0));
  });
  // head + face
  const HW=0.54, HH=0.58, HDP=0.50;
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.28, 0.12, 0.26, P.skinTan, 0, neckY, 0));
  const headY = neckY+0.06+HH/2;
  g.add(box(HW,HH,HDP, P.skinTan, 0, headY, 0));
  // SQUINT EYES — narrower, more menacing (override default eyes)
  const fz = HDP/2+0.01, eyeY = headY+0.04, eyeX = HW*0.26;
  g.add(box(0.14, 0.05, 0.04, EYE, -eyeX, eyeY, fz));                                              // narrow horizontal slits
  g.add(box(0.14, 0.05, 0.04, EYE,  eyeX, eyeY, fz));
  // brown stubble + cigar in mouth (small brown stick sticking out)
  g.add(box(HW*0.85, 0.05, 0.04, P.hairBrown, 0, headY-HH*0.14, HDP/2+0.012));                    // stubble
  g.add(box(0.16, 0.05, 0.05, darken(P.woodD,0.2), 0.08, headY-HH*0.30, HDP/2+0.04));             // cigar body
  g.add(box(0.04, 0.04, 0.04, P.red, 0.18, headY-HH*0.30, HDP/2+0.06, glow(P.red, 0.6)));         // cigar ember (glow)
  // blond hair tuft under hat
  const topHead = headY+HH/2;
  g.add(box(HW+0.02, 0.08, HDP+0.02, P.hairBrown, 0, topHead-0.02, 0));
  // STETSON — HUGE wide-brim disc + low crown
  const stetson = darken(P.amber, 0.45);
  g.add(box(HW+0.56, 0.05, HDP+0.56, stetson, 0, topHead+0.02, 0));                                // very wide brim
  g.add(box(HW+0.04, 0.20, HDP+0.04, stetson, 0, topHead+0.15, 0));
  g.add(box(HW+0.06, 0.04, HDP-0.10, darken(stetson,0.3), 0, topHead+0.07, 0));                    // hat band
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── PUNK: SID VICIOUS 1977 LONDON — kept from V3, the cultural register already
//     lands. (Tartan kilt + Union Jack tee could be a future v5 push; for now the
//     mohawk + spiked leather caricature reads correctly.) ──────────────────
export function punk(){
  const g = new THREE.Group();
  const BW=0.86, BD=0.46, torsoH=0.80, legH=1.04, shoeH=0.20;
  const lx=0.16, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.30,shoeH+0.06,BD,     P.ironD, 0, (shoeH+0.06)/2-hipY, 0.05));
    for(let i=0;i<3;i++) L.add(box(0.04, 0.04, 0.04, P.steel, i*0.06-0.06, shoeH/2-0.04-hipY, BD/2+0.03));
    L.add(box(0.20,legH,BD-0.12, darken(P.slate,0.95), 0, (shoeH+legH/2)-hipY, 0));
    L.add(box(0.24,0.04,BD-0.08, P.steel, 0, (shoeH+legH*0.55)-hipY, 0));
  });
  const torsoY = hipY+torsoH/2;
  g.add(box(BW, torsoH, BD, P.ironD, 0, torsoY, 0));
  g.add(box(0.10, 0.20, 0.04, darken(P.ironD,0.4), -0.14, torsoY+torsoH*0.28, BD/2+0.02));
  g.add(box(0.10, 0.20, 0.04, darken(P.ironD,0.4),  0.14, torsoY+torsoH*0.28, BD/2+0.02));
  for(let r=0;r<3;r++) for(let c=-1;c<=1;c++)
    g.add(box(0.05,0.05,0.05, P.steel, c*0.24, torsoY+0.16-r*0.14, BD/2+0.025));
  g.add(box(0.10, 0.04, 0.04, P.steel, -0.28, torsoY-0.04, BD/2+0.025));
  g.add(box(0.04, 0.10, 0.04, P.steel,  0.28, torsoY-0.04, BD/2+0.025));
  for(const sx of [-1,1]) for(let i=-2;i<=2;i++){
    const h = 0.12 + Math.abs(i)*0.04;
    g.add(box(0.05, 0.16+h, 0.05, P.steel, sx*(BW/2-0.04)+i*0.03, torsoY+torsoH/2+0.08+h/2, i*0.04));
  }
  for(let i=0;i<5;i++) g.add(box(0.05, 0.05, 0.05, P.steel, BW/2-0.06, torsoY-torsoH/2-0.04-i*0.12, BD/2+0.02));
  g.add(box(0.10, 0.12, 0.04, P.ironD, BW/2-0.06, torsoY-torsoH/2-0.66, BD/2+0.02));
  g.add(box(BW+0.02, 0.10, BD+0.02, P.ironD, 0, torsoY-torsoH/2+0.05, 0));
  for(let i=-2;i<=2;i++) g.add(box(0.05, 0.05, 0.05, P.steel, i*0.16, torsoY-torsoH/2+0.05, BD/2+0.02));
  const armW=0.18, armH=torsoH+legH*0.30, shoulderY=torsoY+torsoH/2;
  const ax=BW/2+0.02+armW/2;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(armW, armH*0.72, BD-0.12, P.ironD, 0, (torsoY+torsoH/2-armH*0.36)-shoulderY, 0));
    A.add(box(armW, armH*0.28, BD-0.12, P.skin,  0, (torsoY+torsoH/2-armH*0.86)-shoulderY, 0));
    for(let i=0;i<3;i++) A.add(box(0.05,0.05,0.05, P.steel, 0.03, (torsoY+torsoH/2-armH*0.40)-shoulderY-i*0.10, BD/2-0.08));
  });
  const HW=0.52, HH=0.56, HDP=0.46;
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.26,0.12,0.24, P.skin, 0, neckY, 0));
  const headY = neckY+0.06+HH/2;
  g.add(box(HW,HH,HDP, P.skin, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  g.add(box(HW*0.96, 0.06, 0.04, EYE, 0, headY+0.10, HDP/2+0.012));
  g.add(box(0.05, 0.05, 0.04, P.steel, -HW*0.3, headY+0.18, HDP/2+0.020));
  const topHead = headY+HH/2;
  g.add(box(0.18, 0.18, HDP*0.82, P.ironD, 0, topHead+0.04, 0));
  g.add(box(0.14, 0.80, HDP*0.78, P.accent, 0, topHead+0.46, 0, TEAL_GLOW));
  g.add(box(0.10, 0.24, HDP*0.42, P.accent, 0, topHead+0.94, 0, TEAL_GLOW));
  g.add(box(0.05, 0.16, HDP*0.5, EYE, -(HW/2+0.02), topHead-0.06, 0));
  g.add(box(0.05, 0.16, HDP*0.5, EYE,  (HW/2+0.02), topHead-0.06, 0));
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── RAPPER: NOTORIOUS BIG / 90s NYC HIP-HOP — bright tracksuit (red with
//     white stripes), MASSIVE gold name-plate chain, bandana under cap,
//     yellow Timberland boots ─────────────────────────────────────
export function rapper(){
  const g = new THREE.Group();
  const BW=1.32, BD=0.62, torsoH=0.86, legH=0.84, shoeH=0.28;       // chunky
  const lx=0.30, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  // YELLOW TIMBERLAND BOOTS — chunky construction-style boot, the 90s signature
  [legL,legR].forEach(L=>{
    L.add(box(0.50, shoeH, BD+0.10, darken(P.gold,0.1), 0, shoeH/2-hipY, 0.10));               // big yellow boots
    L.add(box(0.50, 0.06, BD+0.06, P.cream,             0, shoeH-0.06-hipY, 0.10));            // boot collar
    for(let i=0;i<3;i++) L.add(box(0.04, 0.04, 0.04, P.cream, 0, shoeH-0.12-hipY+i*0.05, BD/2+0.10)); // boot eyelets
    L.add(box(0.44, legH, BD-0.02, P.red,           0, (shoeH+legH/2)-hipY, 0));                // RED tracksuit pants
    // WHITE TRACKSUIT STRIPES down the sides
    L.add(box(0.04, legH*0.96, BD-0.02, P.cream,    -lx*0.4, (shoeH+legH/2)-hipY, 0.04));
    L.add(box(0.04, legH*0.96, BD-0.02, P.cream,     lx*0.4, (shoeH+legH/2)-hipY, 0.04));
  });
  const torsoY = hipY+torsoH/2;
  // RED TRACKSUIT TOP with white stripes
  g.add(box(BW, torsoH, BD, P.red, 0, torsoY, 0));
  g.add(box(BW-0.10, 0.16, BD+0.04, darken(P.red,0.3), 0, torsoY-torsoH/2+0.08, 0));            // hem
  // WHITE stripes down the arm-side seams of the torso
  g.add(box(0.06, torsoH-0.10, BD+0.06, P.cream, -BW/2+0.04, torsoY, 0));
  g.add(box(0.06, torsoH-0.10, BD+0.06, P.cream,  BW/2-0.04, torsoY, 0));
  // ZIPPER tracksuit pull (cream square with metal bit)
  g.add(box(0.04, torsoH-0.10, 0.04, darken(P.red,0.3), 0, torsoY, BD/2+0.025));
  g.add(box(0.08, 0.06, 0.05, P.steel, 0, torsoY+torsoH*0.32, BD/2+0.025));
  // MASSIVE NAME-PLATE CHAIN — gold, with letter blocks
  for(let i=-2;i<=2;i++) g.add(box(0.07, 0.07, 0.05, P.gold, i*0.10, torsoY+torsoH/2-0.06+Math.abs(i)*0.02, BD/2+0.030));
  // big rectangular name plate with letter recess
  g.add(box(0.50, 0.22, 0.08, P.gold, 0, torsoY+0.08, BD/2+0.045));                              // name plate body
  g.add(box(0.42, 0.14, 0.04, darken(P.gold,0.4), 0, torsoY+0.08, BD/2+0.075));                  // recess
  // pretend letters — 5 small darker blocks for "B-I-G-G-Y" or generic
  for(let i=-2;i<=2;i++) g.add(box(0.04, 0.08, 0.03, P.cream, i*0.08, torsoY+0.08, BD/2+0.090));
  // arms — tracksuit with white stripes, RIGHT arm holding MIC up
  const armW=0.32, armH=torsoH+legH*0.34, shoulderY=torsoY+torsoH/2;
  const ax=BW/2+0.02+armW/2;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(armW, armH*0.78, BD-0.04, P.red,   0, (torsoY+torsoH/2-armH*0.39)-shoulderY, 0));
    // WHITE TRACKSUIT STRIPE down the arm
    A.add(box(0.05, armH*0.78, BD-0.02, P.cream, -armW/2+0.06, (torsoY+torsoH/2-armH*0.39)-shoulderY, 0));
    A.add(box(0.05, armH*0.78, BD-0.02, P.cream,  armW/2-0.06, (torsoY+torsoH/2-armH*0.39)-shoulderY, 0));
    A.add(box(armW-0.06, armH*0.22, BD-0.06, P.skinDk, 0, (torsoY+torsoH/2-armH*0.89)-shoulderY, 0));
  });
  // gold watch on left wrist
  armL.add(box(armW+0.02, 0.10, BD-0.06, P.gold, 0, (torsoY+torsoH/2-armH*0.80)-shoulderY, 0.04));
  // head + face
  const HW=0.60, HH=0.58, HDP=0.52;
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.34, 0.12, 0.32, P.skinDk, 0, neckY, 0));
  const headY = neckY+0.06+HH/2;
  g.add(box(HW,HH,HDP, P.skinDk, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  // gold grill smile
  g.add(box(0.20, 0.06, 0.04, P.gold, 0, headY-HH*0.30, HDP/2+0.012));
  // BANDANA visible band under the cap — bright purple silk
  const topHead = headY+HH/2;
  g.add(box(HW+0.04, 0.10, HDP+0.04, darken(P.purple,0.2), 0, topHead, 0));                     // bandana band
  // BACKWARDS YANKEE-STYLE CAP — peak goes BACK
  const cap = darken(P.blue, 0.6);
  g.add(box(HW+0.06, 0.16, HDP+0.06, cap, 0, topHead+0.10, 0));
  g.add(box(HW*0.78, 0.05, 0.22, cap, 0, topHead+0.04, -HDP/2-0.10));                            // peak BACKWARD
  g.add(box(0.16, 0.08, 0.06, P.cream, 0, topHead+0.10, HDP/2+0.04));                            // logo patch on front
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── BIKER: FONZIE / MARLON BRANDO WILD ONE 50s — NO HELMET, slicked POMPADOUR
//     hair, white t-shirt under leather jacket, rolled jeans cuffs, cigarette ──
export function biker(){
  const g = new THREE.Group();
  const BW=1.10, BD=0.54, torsoH=0.82, legH=0.92, shoeH=0.20;
  const lx=0.24, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.36, shoeH, BD+0.04, P.ironD, 0, shoeH/2-hipY, 0.06));                            // black boots
    L.add(box(0.32, legH*0.85, BD-0.06, P.blue, 0, (shoeH+legH*0.42)-hipY, 0));                  // BLUE JEANS (bright)
    // ROLLED CUFFS — visible folded band at the bottom of the jeans
    L.add(box(0.34, 0.10, BD-0.02, darken(P.blue,0.3), 0, (shoeH+0.16)-hipY, 0.02));             // rolled cuff band
    L.add(box(0.36, 0.06, BD-0.00, darken(P.blue,0.4), 0, (shoeH+0.10)-hipY, 0.04));             // cuff edge shadow
  });
  const torsoY = hipY+torsoH/2;
  // WHITE T-SHIRT visible at neck and bottom hem under the jacket
  g.add(box(BW-0.18, torsoH, BD-0.04, P.cream, 0, torsoY, 0));                                    // white tee underneath
  // BLACK LEATHER JACKET — open at the center showing the white tee
  g.add(box(BW, torsoH, BD, P.ironD, 0, torsoY, 0.005));                                          // jacket body
  // jacket lapels OPEN — vertical cream gap showing white tee
  g.add(box(0.20, torsoH-0.10, 0.04, P.cream, 0, torsoY-0.04, BD/2+0.025));                       // white tee visible strip
  // jacket asymmetric zipper line (diagonal)
  g.add(box(0.04, torsoH-0.20, 0.04, P.steel, 0.10, torsoY, BD/2+0.030));
  // EAGLE PATCH (gold) on the left chest
  g.add(box(0.16, 0.16, 0.04, P.gold, -BW/2+0.18, torsoY+0.14, BD/2+0.025));
  g.add(box(0.08, 0.04, 0.05, darken(P.gold,0.4), -BW/2+0.18, torsoY+0.14, BD/2+0.050));         // wing detail
  // jacket collar — popped up
  g.add(box(BW-0.10, 0.12, 0.05, P.ironD, 0, torsoY+torsoH/2-0.04, BD/2+0.022));
  g.add(box(0.18, 0.18, 0.04, P.ironD, -BW/2+0.22, torsoY+torsoH/2-0.02, BD/2+0.022));            // L popped collar
  g.add(box(0.18, 0.18, 0.04, P.ironD,  BW/2-0.22, torsoY+torsoH/2-0.02, BD/2+0.022));            // R popped collar
  // STUDDED BELT
  g.add(box(BW+0.04, 0.10, BD+0.02, P.ironD, 0, torsoY-torsoH/2+0.05, 0));
  g.add(box(0.20, 0.14, 0.05, P.steel, 0, torsoY-torsoH/2+0.05, BD/2+0.022));                     // big buckle
  for(let i=-2;i<=2;i++) g.add(box(0.05, 0.05, 0.05, P.steel, i*0.18, torsoY-torsoH/2+0.05, BD/2+0.025));
  // arms — leather sleeves
  const armW=0.26, armH=torsoH+legH*0.28, shoulderY=torsoY+torsoH/2;
  const ax=BW/2+0.02+armW/2;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(armW, armH*0.72, BD-0.04, P.ironD, 0, (torsoY+torsoH/2-armH*0.36)-shoulderY, 0));
    A.add(box(armW+0.02, 0.05, BD-0.02, P.cream, 0, (torsoY+torsoH/2-armH*0.70)-shoulderY, 0.01)); // sleeve cuff
    A.add(box(armW, armH*0.28, BD-0.06, P.skinTan, 0, (torsoY+torsoH/2-armH*0.86)-shoulderY, 0));
  });
  // RIGHT thumb hooked in belt (silhouette cue — Fonzie's iconic pose)
  // (just place the hand near the buckle)
  // head + face (NO HELMET)
  const HW=0.56, HH=0.60, HDP=0.50;
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.30, 0.12, 0.28, P.skinTan, 0, neckY, 0));
  const headY = neckY+0.06+HH/2;
  g.add(box(HW,HH,HDP, P.skinTan, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  // CIGARETTE in mouth — small white stick with ember glow
  g.add(box(0.16, 0.04, 0.04, P.cream, 0.08, headY-HH*0.30, HDP/2+0.05));                         // cigarette body
  g.add(box(0.04, 0.04, 0.04, P.red, 0.16, headY-HH*0.30, HDP/2+0.07, glow(P.red, 0.6)));         // ember glow
  // SIDEBURNS (greaser style)
  g.add(box(0.06, 0.18, 0.04, P.hairDark, -HW/2-0.01, headY-0.04, HDP/2-0.04));
  g.add(box(0.06, 0.18, 0.04, P.hairDark,  HW/2+0.01, headY-0.04, HDP/2-0.04));
  // POMPADOUR HAIR — tall front swooshed up (the iconic greaser silhouette)
  const topHead = headY+HH/2;
  g.add(box(HW+0.04, 0.16, HDP+0.04, P.hairDark, 0, topHead+0.06, 0));                            // hair base on crown
  g.add(box(HW-0.06, 0.34, 0.16, P.hairDark, 0, topHead+0.24, HDP/2-0.02));                       // FRONT POMPADOUR (tall, forward)
  g.add(box(HW-0.14, 0.16, 0.10, P.hairDark, 0, topHead+0.40, HDP/2+0.04));                       // pompadour curl tip
  g.add(box(HW+0.04, 0.40, 0.14, P.hairDark, 0, headY+0.04, -HDP*0.5));                           // hair back
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── GOTH: MORTICIA ADDAMS — kept from V3, the cultural register already lands.
//     Long flowing hair, bell sleeves, long black skirt, teal cross necklace. ─
export function goth(){
  const g = new THREE.Group();
  const BW=0.82, BD=0.46, torsoH=0.74, legH=0.86, shoeH=0.24;
  const lx=0.18, hipY=shoeH+legH;
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  const paleSkin = darken(P.cream, 0.08);
  const skirtY = shoeH + 0.50;
  g.add(box(BW+0.20, 0.98, BD+0.04, P.ironD, 0, skirtY, 0));
  g.add(box(BW+0.22, 0.04, BD+0.06, darken(P.ironD,0.4), 0, skirtY-0.49, 0));
  for(let i=-2;i<=2;i++) g.add(box(0.04, 0.86, 0.04, darken(P.purple,0.7), i*0.16, skirtY, BD/2+0.025));
  [legL,legR].forEach(L=>{
    L.add(box(0.24, shoeH-0.06, BD-0.10, P.ironD,          0, (shoeH-0.06)/2-hipY,    0.04));
    L.add(box(0.06, 0.10, 0.10, darken(P.ironD,0.5),       0, shoeH-0.16-hipY,        BD/2-0.06));
    L.add(box(0.22, 0.16, BD-0.12, paleSkin,               0, (shoeH+0.06)-hipY,      0));
  });
  const torsoY = skirtY+0.49+torsoH/2-0.06;
  g.add(box(BW, torsoH, BD, P.ironD, 0, torsoY, 0));
  for(let i=0;i<5;i++) g.add(box(0.20, 0.04, 0.04, P.cream, 0, torsoY+torsoH*0.32-i*0.16, BD/2+0.02));
  for(let i=0;i<4;i++) g.add(box(0.02, 0.18, 0.05, P.cream, 0, torsoY+torsoH*0.22-i*0.16, BD/2+0.025));
  const neckY = torsoY+torsoH/2+0.05;
  g.add(box(0.34, 0.08, 0.30, EYE, 0, neckY+0.03, 0));
  g.add(box(0.06, 0.06, 0.05, P.steel, 0, neckY+0.03, 0.16));
  g.add(box(0.05, 0.24, 0.05, P.accent, 0, torsoY+torsoH/2-0.08, BD/2+0.040, TEAL_GLOW));
  g.add(box(0.20, 0.05, 0.05, P.accent, 0, torsoY+torsoH/2-0.14, BD/2+0.040, TEAL_GLOW));
  g.add(box(0.34, 0.04, 0.04, P.steel, 0, torsoY+0.06, BD/2+0.030));
  g.add(box(0.30, 0.04, 0.04, P.steel, 0, torsoY-0.10, BD/2+0.030));
  const armW=0.20, armH=torsoH+0.50, shoulderY=torsoY+torsoH/2;
  const ax=BW/2+0.02+armW/2;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(armW, armH*0.68, BD-0.12, P.ironD,  0, (torsoY+torsoH/2-armH*0.34)-shoulderY, 0));
    A.add(box(armW, armH*0.20, BD-0.12, paleSkin, 0, (torsoY+torsoH/2-armH*0.80)-shoulderY, 0));
    A.add(box(armW+0.14, armH*0.34, BD-0.06, P.ironD, 0, (torsoY+torsoH/2-armH*0.92)-shoulderY, 0));
    A.add(box(armW+0.04, 0.04, BD-0.04, darken(P.purple,0.7), 0, (torsoY+torsoH/2-armH*1.06)-shoulderY, 0.01));
  });
  const HW=0.50, HH=0.58, HDP=0.46;
  g.add(box(0.26,0.10,0.24, paleSkin, 0, neckY+0.10, 0));
  const headY = neckY+0.10+0.06+HH/2;
  g.add(box(HW,HH,HDP, paleSkin, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  g.add(box(HW*0.92, 0.10, 0.04, EYE, 0, headY+0.06, HDP/2+0.012));
  g.add(box(0.18, 0.05, 0.04, darken(P.purple,0.5), 0, headY-HH*0.30, HDP/2+0.012));
  const hair = darken(P.purple, 0.95);
  const topHead = headY+HH/2;
  g.add(box(HW+0.06, 0.20, HDP+0.04, hair, 0, topHead+0.05, 0));
  g.add(box(HW+0.08, 0.40, 0.14, hair, 0, headY+0.04, -HDP*0.55));
  g.add(box(0.18, 1.10, HDP*0.78, hair, -(HW/2+0.05), headY-0.56, -0.04));
  g.add(box(0.18, 1.10, HDP*0.78, hair,  (HW/2+0.05), headY-0.56, -0.04));
  g.add(box(HW+0.04, 0.14, 0.10, hair, 0, headY+HH*0.30, HDP/2+0.01));
  g.add(box(0.10, 0.05, 0.06, darken(P.red,0.4), -HW*0.3, topHead+0.10, 0.04));
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── export bundle — characters.js spreads this into CHARACTERS, same as MONSTERS ──
export const ARCHETYPES = { cop, nurse, firefighter, construction, delivery,
                            cowboy, punk, rapper, biker, goth };

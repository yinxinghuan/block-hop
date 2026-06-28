// office.js — corporate / office-ecosystem pack (FAMILY B bespoke per-char).
// Iconic office-tower archetypes for Corporate Climb (and any game to reuse): the
// slick pinstripe EXECUTIVE (briefcase), the food-delivery COURIER (square thermal
// bag), the JANITOR (upright mop), the BARISTA (takeaway cup + apron), and the
// corporate SECURITY GUARD (peaked cap + walkie). Same rig contract + visual
// language as archetypes.js so they drop straight into the shared roster.
//
// Design bar (see voxel_cultural_caricature_bar): each one is a SPECIFIC office
// icon with a silhouette-changing signature prop, saturated colour, not a generic
// "person in a uniform".
import * as THREE from 'three';
import { P, box, darken } from '../lib/prims.js';

const EYE = 0x241f1c, SHADE = 0x14110e;

function rig(g, legL, legR, armL, armR, armBase = 0){
  g.add(legL); g.add(legR); g.add(armL); g.add(armR);
  g.userData.rig = { legL, legR, armL, armR };
  g.userData.armBase = armBase;
  if (armBase){ armL.rotation.x = armR.rotation.x = armBase; }
}
function finish(g){ g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } }); }
function eyes(g, headY, HW, HDP, dy = 0.02){
  const fz = HDP / 2 + 0.01, eyeY = headY + dy, eyeX = HW * 0.26;
  g.add(box(0.12, 0.12, 0.04, EYE, -eyeX, eyeY, fz));
  g.add(box(0.12, 0.12, 0.04, EYE,  eyeX, eyeY, fz));
  return { fz, eyeY, eyeX };
}
// standard two-segment arm pair (sleeve upper + hand/glove forearm). Returns the
// arm groups + metrics so a builder can hang a prop in the hand.
function makeArms(g, BW, BD, torsoY, torsoH, legH, sleeve, hand){
  const armW = 0.24, armH = torsoH + legH * 0.24, shoulderY = torsoY + torsoH / 2;
  const ax = BW / 2 + 0.02 + armW / 2;
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-ax, shoulderY, 0); armR.position.set(ax, shoulderY, 0);
  [armL, armR].forEach(A => {
    A.add(box(armW, armH * 0.66, BD - 0.06, sleeve, 0, (torsoY + torsoH / 2 - armH * 0.33) - shoulderY, 0));
    A.add(box(armW, armH * 0.34, BD - 0.06, hand,   0, (torsoY + torsoH / 2 - armH * 0.83) - shoulderY, 0));
  });
  return { armL, armR, armW, armH, shoulderY, ax, handY: (torsoY + torsoH / 2 - armH * 0.9) - shoulderY };
}

// ─── EXECUTIVE: slick pinstripe power-suit boss — broad shoulders, white shirt +
//     RED power tie, slicked-back hair, gold watch, BRIEFCASE hanging in one hand ──
export function executive(){
  const g = new THREE.Group();
  const BW = 1.14, BD = 0.58, torsoH = 0.86, legH = 0.92, shoeH = 0.18;
  const lx = 0.22, hipY = shoeH + legH;
  const suit = darken(P.slate, 0.72), suitD = darken(P.slate, 0.5);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-lx, hipY, 0); legR.position.set(lx, hipY, 0);
  [legL, legR].forEach(L => {
    L.add(box(0.36, shoeH, BD, P.ironD, 0, shoeH / 2 - hipY, 0.04));                  // black wingtips
    L.add(box(0.34, legH, BD - 0.08, suit, 0, (shoeH + legH / 2) - hipY, 0));          // trousers
    L.add(box(0.05, legH, 0.05, suitD, 0.09, (shoeH + legH / 2) - hipY, BD / 2 - 0.06)); // pinstripe
  });
  const torsoY = hipY + torsoH / 2;
  g.add(box(BW, torsoH, BD, suit, 0, torsoY, 0));                                       // jacket
  g.add(box(0.16, torsoH * 0.74, 0.05, suitD, -0.18, torsoY + 0.04, BD / 2 + 0.01));     // lapel L
  g.add(box(0.16, torsoH * 0.74, 0.05, suitD,  0.18, torsoY + 0.04, BD / 2 + 0.01));     // lapel R
  g.add(box(0.24, torsoH * 0.66, 0.04, P.white, 0, torsoY + 0.02, BD / 2 + 0.012));      // shirt
  g.add(box(0.10, torsoH * 0.58, 0.04, P.red, 0, torsoY - 0.04, BD / 2 + 0.02));         // power tie
  g.add(box(0.14, 0.11, 0.05, P.red, 0, torsoY + torsoH * 0.30, BD / 2 + 0.02));         // tie knot
  g.add(box(0.10, 0.06, 0.04, P.red, -BW / 2 + 0.22, torsoY + 0.16, BD / 2 + 0.02));     // pocket square
  const { armL, armR, armH, shoulderY } = makeArms(g, BW, BD, torsoY, torsoH, legH, suit, P.skin);
  armL.add(box(0.27, 0.07, 0.27, P.gold, 0, (torsoY + torsoH / 2 - armH * 0.9) - shoulderY, 0));        // gold watch
  armR.add(box(0.46, 0.34, 0.15, darken(P.woodD, 0.5), 0, (torsoY + torsoH / 2 - armH) - shoulderY - 0.2, 0.02)); // briefcase
  armR.add(box(0.12, 0.07, 0.07, P.gold, 0, (torsoY + torsoH / 2 - armH) - shoulderY - 0.02, 0.06));     // case clasp/handle
  const HW = 0.58, HH = 0.60, HDP = 0.52;
  const neckY = torsoY + torsoH / 2 + 0.05;
  g.add(box(0.30, 0.12, 0.28, P.skin, 0, neckY, 0));
  const headY = neckY + 0.06 + HH / 2;
  g.add(box(HW, HH, HDP, P.skin, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  g.add(box(0.42, 0.04, 0.04, P.hairDark, 0, headY + 0.15, HDP / 2 + 0.012));            // strong brow
  const topHead = headY + HH / 2;
  g.add(box(HW + 0.04, 0.14, HDP + 0.04, P.hairDark, 0, topHead + 0.02, -0.04));          // slicked top
  g.add(box(HW + 0.04, 0.34, 0.12, P.hairDark, 0, headY + 0.04, -HDP * 0.5));             // slicked back
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── COURIER: food-delivery rider — bright jacket + reflective strips, a BIG SQUARE
//     INSULATED THERMAL BAG on the back (the icon), forward cap, holding a paper bag ─
export function courier(){
  const g = new THREE.Group();
  const BW = 0.92, BD = 0.50, torsoH = 0.78, legH = 0.86, shoeH = 0.16;
  const lx = 0.20, hipY = shoeH + legH;
  const jacket = P.red, bag = darken(P.accent, 0.95);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-lx, hipY, 0); legR.position.set(lx, hipY, 0);
  [legL, legR].forEach(L => {
    L.add(box(0.32, shoeH, BD, P.ironD, 0, shoeH / 2 - hipY, 0.04));
    L.add(box(0.30, legH, BD - 0.08, darken(P.slate, 0.7), 0, (shoeH + legH / 2) - hipY, 0));   // dark cargo pants
  });
  const torsoY = hipY + torsoH / 2;
  g.add(box(BW, torsoH, BD, jacket, 0, torsoY, 0));
  g.add(box(BW - 0.08, 0.10, BD + 0.02, P.white, 0, torsoY + torsoH * 0.12, 0));          // reflective strips
  g.add(box(BW - 0.08, 0.10, BD + 0.02, P.white, 0, torsoY - torsoH * 0.18, 0));
  // BIG SQUARE THERMAL BAG on the back — silhouette icon
  g.add(box(0.80, 0.84, 0.32, bag, 0, torsoY + 0.06, -BD / 2 - 0.18));
  g.add(box(0.52, 0.42, 0.05, darken(bag, 0.7), 0, torsoY + 0.10, -BD / 2 - 0.35));        // bag panel
  g.add(box(0.10, 0.74, 0.04, darken(jacket, 0.7), -0.24, torsoY + 0.04, BD / 2 + 0.02));   // straps front
  g.add(box(0.10, 0.74, 0.04, darken(jacket, 0.7),  0.24, torsoY + 0.04, BD / 2 + 0.02));
  const { armL, armR, armH, shoulderY } = makeArms(g, BW, BD, torsoY, torsoH, legH, jacket, P.skinTan);
  armR.rotation.x = -0.55;                                                                 // forearm up, holding bag
  armR.add(box(0.28, 0.32, 0.24, P.cream, 0, -armH * 0.82, 0.22));                          // paper food bag
  armR.add(box(0.28, 0.08, 0.24, darken(P.cream, 0.8), 0, -armH * 0.66, 0.22));             // folded top
  const HW = 0.56, HH = 0.58, HDP = 0.50;
  const neckY = torsoY + torsoH / 2 + 0.05;
  g.add(box(0.28, 0.12, 0.26, P.skinTan, 0, neckY, 0));
  const headY = neckY + 0.06 + HH / 2;
  g.add(box(HW, HH, HDP, P.skinTan, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  g.add(box(HW + 0.04, 0.30, 0.12, P.hairDark, 0, headY + 0.02, -HDP * 0.5));               // hair back
  const topHead = headY + HH / 2;
  g.add(box(HW + 0.05, 0.16, HDP + 0.05, jacket, 0, topHead + 0.07, 0));                    // cap crown
  g.add(box(HW * 0.8, 0.05, 0.20, darken(jacket, 0.6), 0, topHead + 0.02, HDP / 2 + 0.09)); // brim
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── JANITOR: blue coveralls, name patch, yellow rubber gloves, ball cap, holding a
//     tall MOP (upright pole + frayed head) — the silhouette signature ──
export function janitor(){
  const g = new THREE.Group();
  const BW = 0.92, BD = 0.50, torsoH = 0.80, legH = 0.88, shoeH = 0.16;
  const lx = 0.20, hipY = shoeH + legH;
  const coverall = darken(P.blue, 0.55);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-lx, hipY, 0); legR.position.set(lx, hipY, 0);
  [legL, legR].forEach(L => {
    L.add(box(0.32, shoeH, BD, P.woodD, 0, shoeH / 2 - hipY, 0.04));                        // work boots
    L.add(box(0.32, legH, BD - 0.06, coverall, 0, (shoeH + legH / 2) - hipY, 0));            // coverall legs
  });
  const torsoY = hipY + torsoH / 2;
  g.add(box(BW, torsoH, BD, coverall, 0, torsoY, 0));
  g.add(box(0.5, torsoH * 0.42, 0.04, darken(coverall, 0.8), 0, torsoY - 0.04, BD / 2 + 0.01)); // front zip panel
  g.add(box(0.22, 0.10, 0.05, P.cream, -0.22, torsoY + 0.20, BD / 2 + 0.02));                // name patch
  g.add(box(BW + 0.02, 0.10, BD + 0.02, darken(coverall, 0.7), 0, torsoY - torsoH / 2 + 0.1, 0)); // belt
  const { armL, armR, armH, shoulderY } = makeArms(g, BW, BD, torsoY, torsoH, legH, coverall, P.amber); // yellow gloves
  // MOP — added to g beside the right hand (a tall pole + frayed head near the floor)
  const mx = BW / 2 + 0.28;
  g.add(box(0.07, 1.55, 0.07, darken(P.woodD, 0.9), mx, 0.85, 0.16));                        // pole
  g.add(box(0.34, 0.26, 0.34, P.stone, mx, 0.18, 0.16));                                     // mop head
  g.add(box(0.40, 0.10, 0.40, darken(P.stone, 0.8), mx, 0.30, 0.16));                        // mop collar
  const HW = 0.56, HH = 0.58, HDP = 0.50;
  const neckY = torsoY + torsoH / 2 + 0.05;
  g.add(box(0.28, 0.12, 0.26, P.skinDk, 0, neckY, 0));
  const headY = neckY + 0.06 + HH / 2;
  g.add(box(HW, HH, HDP, P.skinDk, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  const topHead = headY + HH / 2;
  g.add(box(HW + 0.05, 0.15, HDP + 0.05, darken(P.green, 0.5), 0, topHead + 0.06, 0));        // ball cap
  g.add(box(HW * 0.8, 0.05, 0.20, darken(P.green, 0.4), 0, topHead + 0.01, HDP / 2 + 0.09));  // brim
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── BARISTA: knit beanie, dark tee + brown APRON, rolled sleeves, holding a
//     takeaway COFFEE CUP (sleeve + dome lid), pencil behind the ear ──
export function barista(){
  const g = new THREE.Group();
  const BW = 0.86, BD = 0.48, torsoH = 0.76, legH = 0.86, shoeH = 0.16;
  const lx = 0.18, hipY = shoeH + legH;
  const tee = darken(P.green, 0.5), apron = darken(P.woodD, 0.75);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-lx, hipY, 0); legR.position.set(lx, hipY, 0);
  [legL, legR].forEach(L => {
    L.add(box(0.30, shoeH, BD, P.ironD, 0, shoeH / 2 - hipY, 0.04));
    L.add(box(0.30, legH, BD - 0.08, darken(P.slate, 0.85), 0, (shoeH + legH / 2) - hipY, 0));  // jeans
  });
  const torsoY = hipY + torsoH / 2;
  g.add(box(BW, torsoH, BD, tee, 0, torsoY, 0));
  // brown apron front panel + two straps + a pocket
  g.add(box(BW - 0.18, torsoH * 0.86, 0.05, apron, 0, torsoY - 0.04, BD / 2 + 0.01));
  g.add(box(0.10, torsoH * 0.5, 0.05, apron, -0.22, torsoY + torsoH * 0.34, BD / 2 + 0.015));
  g.add(box(0.10, torsoH * 0.5, 0.05, apron,  0.22, torsoY + torsoH * 0.34, BD / 2 + 0.015));
  g.add(box(BW - 0.30, 0.16, 0.05, darken(apron, 0.8), 0, torsoY - torsoH * 0.18, BD / 2 + 0.02)); // pocket
  const { armL, armR, armH, shoulderY } = makeArms(g, BW, BD, torsoY, torsoH, legH, tee, P.skin);
  armR.rotation.x = -0.7;                                                                   // raise the cup
  armR.add(box(0.24, 0.30, 0.24, P.cream, 0, -armH * 0.8, 0.2));                             // coffee cup body
  armR.add(box(0.26, 0.10, 0.26, darken(P.woodD, 0.7), 0, -armH * 0.8, 0.2));                // cardboard sleeve
  armR.add(box(0.26, 0.08, 0.26, P.white, 0, -armH * 0.62, 0.2));                            // dome lid
  const HW = 0.56, HH = 0.58, HDP = 0.50;
  const neckY = torsoY + torsoH / 2 + 0.05;
  g.add(box(0.28, 0.12, 0.26, P.skin, 0, neckY, 0));
  const headY = neckY + 0.06 + HH / 2;
  g.add(box(HW, HH, HDP, P.skin, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  g.add(box(0.05, 0.14, 0.05, P.woodL, HW / 2 + 0.02, headY + 0.04, -0.08));                 // pencil behind ear
  const topHead = headY + HH / 2;
  g.add(box(HW + 0.06, 0.20, HDP + 0.06, darken(P.red, 0.6), 0, topHead + 0.06, 0));          // knit beanie
  g.add(box(HW + 0.08, 0.07, HDP + 0.08, darken(P.red, 0.45), 0, topHead - 0.03, 0));         // beanie fold
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

// ─── SECURITY GUARD: corporate-lobby security — navy uniform, SILVER badge, peaked
//     cap, sunglasses, shoulder WALKIE-TALKIE, flashlight on the belt ──
export function securityGuard(){
  const g = new THREE.Group();
  const BW = 1.04, BD = 0.58, torsoH = 0.84, legH = 0.90, shoeH = 0.18;
  const lx = 0.22, hipY = shoeH + legH;
  const navy = darken(P.blue, 0.32), navyD = darken(P.blue, 0.22);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-lx, hipY, 0); legR.position.set(lx, hipY, 0);
  [legL, legR].forEach(L => {
    L.add(box(0.36, shoeH, BD, P.ironD, 0, shoeH / 2 - hipY, 0.04));
    L.add(box(0.34, legH, BD - 0.08, navy, 0, (shoeH + legH / 2) - hipY, 0));
  });
  const torsoY = hipY + torsoH / 2;
  g.add(box(BW, torsoH, BD, navy, 0, torsoY, 0));                                            // uniform shirt
  g.add(box(0.30, 0.16, 0.04, navyD, 0, torsoY + torsoH / 2 - 0.10, BD / 2 + 0.02));          // collar
  g.add(box(0.07, torsoH * 0.66, 0.04, navyD, 0, torsoY, BD / 2 + 0.02));                     // button placket
  g.add(box(0.24, 0.26, 0.05, P.steel, -BW / 2 + 0.26, torsoY + 0.12, BD / 2 + 0.03));        // SILVER shield badge
  g.add(box(0.14, 0.16, 0.06, darken(P.steel, 0.5), -BW / 2 + 0.26, torsoY + 0.12, BD / 2 + 0.055));
  g.add(box(0.22, 0.07, 0.04, P.ironD, BW / 2 - 0.20, torsoY + 0.22, BD / 2 + 0.03));         // name bar
  g.add(box(BW + 0.06, 0.16, BD + 0.04, P.ironD, 0, torsoY - torsoH / 2 + 0.07, 0));           // duty belt
  g.add(box(0.18, 0.14, 0.06, P.steel, 0, torsoY - torsoH / 2 + 0.07, BD / 2 + 0.03));         // belt buckle
  g.add(box(0.10, 0.30, 0.10, P.ironD, BW / 2 + 0.05, torsoY - torsoH / 2 - 0.06, 0.06));      // flashlight on belt
  // shoulder WALKIE-TALKIE (with stub antenna)
  g.add(box(0.12, 0.22, 0.08, P.ironD, -BW / 2 + 0.06, torsoY + torsoH * 0.30, BD / 2 + 0.02));
  g.add(box(0.03, 0.18, 0.03, P.ironD, -BW / 2 + 0.06, torsoY + torsoH * 0.30 + 0.2, BD / 2 + 0.02));
  const { armL, armR } = makeArms(g, BW, BD, torsoY, torsoH, legH, navy, P.skinTan);
  const HW = 0.58, HH = 0.60, HDP = 0.52;
  const neckY = torsoY + torsoH / 2 + 0.05;
  g.add(box(0.32, 0.12, 0.30, P.skinTan, 0, neckY, 0));
  const headY = neckY + 0.06 + HH / 2;
  g.add(box(HW, HH, HDP, P.skinTan, 0, headY, 0));
  eyes(g, headY, HW, HDP);
  // sunglasses (single dark bar)
  g.add(box(HW + 0.02, 0.12, 0.04, SHADE, 0, headY + 0.05, HDP / 2 + 0.012));
  // peaked cap — navy crown + patent brim + silver badge
  const topHead = headY + HH / 2;
  g.add(box(HW + 0.06, 0.18, HDP + 0.06, navyD, 0, topHead + 0.09, 0));
  g.add(box(HW + 0.10, 0.05, HDP + 0.10, P.ironD, 0, topHead + 0.01, 0));
  g.add(box(HW * 0.86, 0.05, 0.22, P.ironD, 0, topHead - 0.02, HDP / 2 + 0.10));
  g.add(box(0.16, 0.10, 0.04, P.steel, 0, topHead + 0.06, HDP / 2 + 0.10));
  rig(g, legL, legR, armL, armR);
  finish(g);
  return g;
}

export const OFFICE = { executive, courier, janitor, barista, securityGuard };

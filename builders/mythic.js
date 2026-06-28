// mythic.js — fantasy / mythic register: orc, ogre, lich, minotaur,
// the ancient bestiary. Built deliberately broad-shouldered + chunky
// so they read as raw physical menace next to the lean MONSTERS pack.
// Same FAMILY-B sharp-cube style; rig contract identical (g.userData.rig
// = {legL,legR,armL,armR}, optional armBase).
import * as THREE from 'three';
import { P, box, cyl, darken } from '../lib/prims.js';

// mythic palette — warm earthen flesh + animal fur + iron weapons +
// horn ivory. Saturated red eyes / forge red as the one accent so the
// silhouette reads "ancient and angry" without going neon.
const TP = {
  fur:0x6b4a2e, furD:0x4a3320, furL:0x8a6740,        // bull-brown fur (minotaur base)
  hide:0x9d7148,                                       // exposed hide / loincloth
  horn:0xe6dec3, hornD:0xc3b994,                       // ivory horn / hoof
  iron:0x44464d, ironD:0x2a2c30,                       // weapon metal
  brass:0xc78a2f,                                      // weapon banding / studs
  loin:0x4a342a, loinTrim:0xa86628,                    // dark leather kilt + brass trim
  bloodR:0xa01a1a,                                     // forge / eye red
};
const glow = c => ({ e:c, ei:0.85 });

function rig(g, legL, legR, armL, armR, armBase=0){
  g.add(legL); g.add(legR); g.add(armL); g.add(armR);
  g.userData.rig = { legL, legR, armL, armR };
  g.userData.armBase = armBase;
  if(armBase){ armL.rotation.x = armR.rotation.x = armBase; }
}
function finish(g){ g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); }

// ─── MINOTAUR: bull-headed warrior, broad torso, horns + double-axe ───────
// Cue ≥0.25u front-protruding: the horn pair sticking sideways past the
// head silhouette + the axe blade. From thumbnail = "bull-man with axe".
export function minotaur(){
  const g = new THREE.Group();
  // Broader than humans — chest is the strength tell.
  const BW=1.28, BD=0.66, torsoH=1.04, legH=0.92, hoofH=0.18;
  const lx=0.30, hipY=hoofH+legH;

  // ─── Legs ─────── shaggy thighs + cloven hooves
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    // hoof — ivory front-toe + dark back, slightly forward
    L.add(box(0.36,hoofH,BD+0.10, TP.horn, 0, hoofH/2-hipY, 0.10));
    L.add(box(0.36,hoofH*0.65,0.16, TP.hornD, 0, hoofH/2-hipY, BD/2+0.08));   // toe split shadow
    // shaggy fur thigh
    L.add(box(0.38,legH*0.70,BD-0.04, TP.fur, 0, (hoofH+legH*0.35)-hipY, 0));
    L.add(box(0.42,legH*0.20,BD,      TP.furD, 0, (hoofH+legH*0.05)-hipY, 0)); // ankle tuft (lower)
    L.add(box(0.42,legH*0.18,BD+0.02, TP.furD, 0, (hoofH+legH*0.85)-hipY, 0)); // upper tuft
  });

  // ─── Torso ─────── massive chest, exposed pec ridge, leather kilt
  const torsoY = hipY+torsoH/2;
  g.add(box(BW,torsoH,BD, TP.hide, 0,torsoY,0));                              // chest hide
  g.add(box(BW-0.08,torsoH*0.32,BD-0.02, TP.furL, 0,torsoY+torsoH*0.28,0.02));// pec ridge (lighter)
  g.add(box(BW+0.08,0.04,BD+0.06, TP.fur, 0,torsoY+torsoH*0.50-0.02,0));      // chest fur top trim
  // Leather kilt across the hips
  g.add(box(BW+0.10, 0.30, BD+0.06, TP.loin,     0, hipY-0.08, 0));
  g.add(box(BW+0.14, 0.06, BD+0.08, TP.loinTrim, 0, hipY+0.06, 0));            // brass-tooled belt
  // Belt studs — small brass squares across the belt front
  for (const xx of [-0.30, -0.10, 0.10, 0.30]) {
    g.add(box(0.06, 0.06, 0.04, TP.brass, xx, hipY+0.06, BD/2+0.04, glow(TP.brass)));
  }

  // Shoulder fur tufts (broaden silhouette further)
  for (const sx of [-1, 1]) {
    g.add(box(0.36, 0.24, BD-0.04, TP.furD, sx*(BW/2+0.10), torsoY+torsoH/2-0.10, 0));
  }

  // ─── Arms ─────── thick muscular fur + bracers + iron-banded axe
  const ax=BW/2+0.20, shoulderY=torsoY+torsoH/2-0.10, armH=torsoH+0.40;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(0.30, armH*0.50, BD-0.18, TP.fur,  0,-armH*0.25+0.04,0));        // upper arm fur
    A.add(box(0.34, 0.10, BD-0.10, TP.furD, 0,-armH*0.50+0.04,0));             // elbow band
    A.add(box(0.30, armH*0.42, BD-0.16, TP.furL, 0,-armH*0.74+0.04,0));        // forearm
    A.add(box(0.36, 0.16, BD-0.08, TP.loinTrim, 0,-armH+0.18, 0));             // brass bracer
    A.add(box(0.34, 0.18, BD-0.10, TP.hide,     0,-armH+0.04, 0));             // bare fist
  });

  // ─── Battle axe in RIGHT arm — wide blade + iron-banded haft ──────────
  const axe = new THREE.Group();
  axe.position.set(0.04, -armH+0.12, 0.30);
  // Haft
  axe.add(box(0.10, 0.10, 1.00, TP.furD, 0, 0, 0));
  // Brass bands along haft
  for (const zz of [-0.32, 0.0, 0.32]) {
    axe.add(box(0.12, 0.12, 0.06, TP.brass, 0, 0, zz));
  }
  // Iron blade — broad asymmetric wedge at the front end
  axe.add(box(0.06, 0.62, 0.46, TP.iron, 0,  0.20,  0.66));
  axe.add(box(0.06, 0.50, 0.38, TP.iron, 0,  0.20,  0.96));
  axe.add(box(0.06, 0.30, 0.18, TP.ironD,0,  0.30,  1.08));   // tapered tip
  // Blade edge glint
  axe.add(box(0.04, 0.04, 0.40, TP.horn, 0,  0.50,  0.70, glow(TP.brass)));
  armR.add(axe);

  // ─── Head ─────── bull skull, sideways horns, glowing red eyes, snout ring
  const HW=0.62, HH=0.58, HDP=0.62;
  const headY = torsoY+torsoH/2+0.04+HH/2;
  g.add(box(HW, HH, HDP, TP.fur, 0,headY,0));                                  // skull base
  g.add(box(HW-0.10, 0.20, 0.30, TP.hide, 0, headY-HH*0.20, HDP/2+0.04));      // snout (slightly forward + lighter)
  g.add(box(0.18, 0.10, 0.10, TP.horn, 0, headY-HH*0.30, HDP/2+0.22));         // brass nose ring
  // Eyes — small recessed red
  for (const sx of [-1, 1]) {
    g.add(box(0.10, 0.06, 0.04, TP.bloodR, sx*0.14, headY+0.06, HDP/2+0.02, glow(TP.bloodR)));
  }
  // Horns — sideways jutting ivory, the silhouette anchor
  for (const sx of [-1, 1]) {
    const horn = new THREE.Group();
    horn.position.set(sx*(HW/2-0.02), headY+HH*0.30, 0);
    horn.rotation.z = sx*0.30;                                                  // upward outward sweep
    horn.add(box(0.18, 0.16, 0.30, TP.horn, sx*0.22, 0.10, 0));                 // inner base
    horn.add(box(0.14, 0.14, 0.26, TP.horn, sx*0.42, 0.18, 0));                 // mid
    horn.add(box(0.10, 0.10, 0.22, TP.hornD, sx*0.58, 0.26, 0));                // tip (darker)
    g.add(horn);
  }
  // Ear tufts
  for (const sx of [-1, 1]) {
    g.add(box(0.10, 0.14, 0.04, TP.furD, sx*(HW/2-0.02), headY+0.04, -HDP/2+0.04));
  }
  // Top fur tuft between horns
  g.add(box(0.30, 0.14, 0.20, TP.furD, 0, headY+HH/2+0.04, 0));

  rig(g, legL,legR,armL,armR, 0); finish(g); return g;
}

export const MYTHIC = { minotaur };

// villains.js — urban-villain register: armored authority, masked
// operatives, the men in tactical gear. Built to be readable as
// "elite / boss" silhouette at thumbnail — protruding visor, shield,
// or oversized pack. Same FAMILY-B sharp-cube style as monsters.js
// + archetypes.js so they compose in one scene.
//
// Rig contract matches monsters.js: g.userData.rig = {legL,legR,armL,armR},
// optional g.userData.armBase. Add new villains by exporting a function
// + listing it in the VILLAINS map at the bottom.
import * as THREE from 'three';
import { P, box, cyl, darken } from '../lib/prims.js';

const EYE = 0x201b18;

// urban-villain palette — tactical blacks, kevlar matte, hazard yellow,
// industrial yellow + steel-grey + warning red.
const VP = {
  tactBlk:0x1a1c20, tactDk:0x101116,     // tactical armor
  kevlar:0x2c2f36, kevlarD:0x1b1d22,     // body armor plates
  visor:0x6fb3ff, visorD:0x3a72b3,       // emissive smoked visor + frame
  shield:0xe9e5d6, shieldD:0xc7c3b4,     // riot shield panel
  hazardY:0xf4d020, hazardYD:0xcfae18,   // hazard yellow accents
  warnR:0xff3030,                        // warning red LED
  rubber:0x0c0c10,                       // boot/glove rubber
  gunM:0x2a2a30,                         // gun metal
};
const glow = c => ({ e:c, ei:0.85 });

function rig(g, legL, legR, armL, armR, armBase=0){
  g.add(legL); g.add(legR); g.add(armL); g.add(armR);
  g.userData.rig = { legL, legR, armL, armR };
  g.userData.armBase = armBase;
  if(armBase){ armL.rotation.x = armR.rotation.x = armBase; }
}
function finish(g){ g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); }

// ─── SWAT ENFORCER: black tactical kit, visored helmet, riot shield ───────
// Cue ≥0.25u front-protruding: the riot shield. From thumbnail = "armored
// guy with shield". Boss/elite variant of the urban authority threat.
export function swat(){
  const g = new THREE.Group();
  const BW=0.96, BD=0.56, torsoH=0.90, legH=0.86, bootH=0.20;
  const lx=0.24, hipY=bootH+legH;

  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.36,bootH,BD+0.06, VP.rubber, 0, bootH/2-hipY, 0.04));        // chunky tactical boot
    L.add(box(0.34,bootH*0.40,BD+0.02, VP.tactDk, 0, bootH*0.85-hipY, 0.04)); // boot ankle ring
    L.add(box(0.28,legH,BD-0.08, VP.tactBlk, 0, (bootH+legH/2)-hipY, 0));     // tac trousers
    L.add(box(0.30,0.24,0.12, VP.kevlar, 0, hipY*0.20-hipY, BD/2-0.04));     // knee plate
  });

  // Torso — kevlar vest layered over tactical undersuit, chest rig.
  const torsoY = hipY+torsoH/2;
  g.add(box(BW,torsoH,BD, VP.tactBlk, 0,torsoY,0));                          // body
  g.add(box(BW+0.06,torsoH*0.92,BD+0.06, VP.kevlar, 0,torsoY,0));            // vest shell
  g.add(box(0.20,0.18,0.05, VP.hazardY, 0,torsoY+torsoH*0.32,BD/2+0.04));    // chest patch
  g.add(box(0.06,0.06,0.05, VP.warnR, BW*0.30,torsoY+torsoH*0.32,BD/2+0.04, glow(VP.warnR))); // radio LED
  // Mag pouches across the front
  for (const xx of [-0.22, 0.0, 0.22]) {
    g.add(box(0.14,0.16,0.06, VP.kevlarD, xx, torsoY-torsoH*0.10, BD/2+0.04));
  }
  // Tactical belt
  g.add(box(BW+0.10,0.10,BD+0.08, VP.tactDk, 0,hipY-0.04,0));

  // Arms — kevlar pauldrons + gloves.
  const ax=BW/2+0.16, shoulderY=torsoY+torsoH/2, armH=torsoH+0.28;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(0.32,0.20,0.34, VP.kevlar, 0,-0.05,0));                        // pauldron
    A.add(box(0.22,armH,BD-0.16, VP.tactBlk, 0,-armH/2+0.10,0));              // sleeve
    A.add(box(0.24,0.20,0.20, VP.rubber, 0,-armH+0.18,0));                    // glove
  });
  // Riot shield — wide panel attached to LEFT arm, faces forward.
  const shieldW=1.10, shieldH=1.50, shieldT=0.10;
  const shieldGrp = new THREE.Group();
  shieldGrp.position.set(0.10, -armH/2 + 0.40, BD/2 + 0.18);
  shieldGrp.add(box(shieldW, shieldH, shieldT, VP.shield, 0, 0, 0));
  shieldGrp.add(box(shieldW+0.08, 0.10, shieldT+0.04, VP.shieldD, 0,  shieldH/2-0.05, 0));  // top trim
  shieldGrp.add(box(shieldW+0.08, 0.10, shieldT+0.04, VP.shieldD, 0, -shieldH/2+0.05, 0));  // bot trim
  shieldGrp.add(box(0.20, 0.10, shieldT, VP.tactDk, 0, 0.04, shieldT/2+0.005));             // "POLICE" stripe
  shieldGrp.add(box(0.06, 0.30, shieldT+0.06, VP.hazardY, -shieldW*0.36, 0, 0));            // hazard side stripe
  armL.add(shieldGrp);
  // Right arm: short rifle / baton sticking forward.
  const gun = new THREE.Group();
  gun.position.set(0.02, -armH+0.10, 0.34);
  gun.add(box(0.16, 0.16, 0.66, VP.gunM, 0, 0, 0));
  gun.add(box(0.10, 0.20, 0.16, VP.tactDk, 0, -0.08, -0.12));   // grip
  gun.add(box(0.06, 0.06, 0.12, VP.warnR, 0, 0.02, 0.40, glow(VP.warnR))); // muzzle LED
  armR.add(gun);

  // Helmet — full-face visored tactical helm.
  const HW=0.62, HH=0.62, HDP=0.56;
  const headY = torsoY+torsoH/2+0.06+HH/2;
  g.add(box(HW,HH,HDP, VP.tactBlk, 0,headY,0));                              // helm shell
  g.add(box(HW+0.06,HH*0.38,HDP+0.06, VP.tactDk, 0,headY+HH*0.30,0));        // crown ridge
  g.add(box(HW-0.06,0.26,0.04, VP.visor, 0, headY-0.02, HDP/2+0.03, glow(VP.visor))); // smoked visor
  g.add(box(HW-0.10,0.06,0.04, VP.visorD, 0, headY-0.15, HDP/2+0.04));       // visor frame
  g.add(box(HW-0.20,0.10,0.20, VP.tactDk, 0, headY-HH/2+0.06, HDP/2-0.02));  // chin guard
  // Radio antenna behind the helm
  g.add(box(0.04,0.22,0.04, VP.gunM, HW/2-0.06, headY+HH/2+0.12, -HDP/2+0.08));
  g.add(box(0.04,0.06,0.04, VP.warnR, HW/2-0.06, headY+HH/2+0.26, -HDP/2+0.08, glow(VP.warnR)));

  rig(g, legL,legR,armL,armR, 0); finish(g); return g;
}

// ─── VIKING RAIDER: horned helmet + round shield + battle axe ─────────────
// Designed to read as "armored melee with shield" — same role as SWAT in
// the boss skill chart (shield carrier) but a totally different silhouette
// register (mythic raider, not modern police). Cue: tall vertical horns on
// the helmet + round wooden shield on the front. No glow / no antenna —
// keeps the read organic against the chrome mech and the bull-head minotaur.
export function viking(){
  const g = new THREE.Group();
  const fur=0x6b4a2e, furD=0x4a3320, hide=0x9d7148;
  const leather=0x4a342a, leatherD=0x2a1d18;
  const skin=0xe2a877, skinD=0xb78550;
  const beard=0xa9774a, hair=0x7c5230;
  const horn=0xe6dec3, hornD=0xc3b994;
  const iron=0x44464d, ironD=0x2a2c30;
  const brass=0xc78a2f;
  const shieldWood=0x7c5230, shieldRim=0x3b3b44;
  const shieldGlyph=0xb05de8;     // teal-purple stripe — accent
  const eyeC=0x201b18;
  const BW=1.06, BD=0.58, torsoH=0.92, legH=0.86, bootH=0.20;
  const lx=0.24, hipY=bootH+legH;

  // ─── Legs ─────── leather wrap boots + fur-trimmed wraps
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    L.add(box(0.32,bootH,BD+0.04, leatherD, 0, bootH/2-hipY, 0.04));         // boot
    L.add(box(0.32,0.06,BD,       fur,      0, bootH+0.04-hipY, 0));         // fur cuff
    L.add(box(0.30,legH-0.10,BD-0.06, leather, 0, (bootH+legH*0.5)-hipY, 0)); // leather trousers
    L.add(box(0.32,0.04,BD-0.02, brass, 0, (bootH+legH*0.85)-hipY, 0));      // brass knee band
  });

  // ─── Torso ─────── chainmail tunic + belt + fur-trimmed shoulders
  const torsoY = hipY+torsoH/2;
  g.add(box(BW, torsoH, BD, fur,  0, torsoY, 0));                            // tunic base (fur)
  // Chainmail layer — slightly tighter + iron-tinted, no glow
  g.add(box(BW-0.04, torsoH*0.70, BD-0.02, iron, 0, torsoY+0.02, 0));
  // Brass belt buckle
  g.add(box(BW+0.08, 0.10, BD+0.06, leatherD, 0, hipY-0.04, 0));
  g.add(box(0.20, 0.16, 0.06, brass, 0, hipY-0.02, BD/2+0.04, glow(brass)));
  // Shoulder fur tufts (broader silhouette)
  for (const sx of [-1,1]) {
    g.add(box(0.30, 0.18, BD-0.04, furD, sx*(BW/2+0.06), torsoY+torsoH/2-0.04, 0));
  }

  // ─── Arms ─────── bare biceps + leather bracers
  const ax=BW/2+0.16, shoulderY=torsoY+torsoH/2-0.04, armH=torsoH+0.34;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach(A=>{
    A.add(box(0.26, armH*0.45, BD-0.18, fur,  0,-armH*0.225+0.04,0));        // chainmail shoulder
    A.add(box(0.22, armH*0.40, BD-0.20, skin, 0,-armH*0.68+0.04,0));         // bare bicep+forearm
    A.add(box(0.28, 0.18, BD-0.10, leatherD, 0,-armH+0.18, 0));              // leather bracer
    A.add(box(0.26, 0.16, BD-0.12, skinD,    0,-armH+0.04, 0));              // bare fist
  });

  // ─── Round shield on LEFT arm ── named so skill code can reach/orient
  const shield = new THREE.Group();
  shield.name = 'shield';
  shield.position.set(0.16, -armH/2 + 0.40, BD/2 + 0.16);
  // Front face — round wood disc approximated as concentric boxes
  shield.add(box(1.12, 1.12, 0.10, shieldWood, 0, 0, 0));                    // wood face
  shield.add(box(1.18, 0.10, 0.14, shieldRim,  0,  0.56, 0));                // rim top
  shield.add(box(1.18, 0.10, 0.14, shieldRim,  0, -0.56, 0));                // rim bottom
  shield.add(box(0.10, 1.18, 0.14, shieldRim,  0.56,  0, 0));                // rim right
  shield.add(box(0.10, 1.18, 0.14, shieldRim, -0.56,  0, 0));                // rim left
  shield.add(box(0.24, 0.24, 0.12, brass, 0, 0, 0.07));                      // central iron boss
  // Painted stripe (the only saturated accent on the whole figure)
  shield.add(box(0.12, 0.96, 0.012, shieldGlyph, 0, 0, 0.06));               // vertical stripe
  shield.add(box(0.96, 0.12, 0.012, shieldGlyph, 0, 0, 0.06));               // horizontal stripe
  armL.add(shield);

  // ─── Battle axe in RIGHT arm ── shorter than minotaur axe, single-edge
  const axe = new THREE.Group();
  axe.position.set(0.02, -armH + 0.14, 0.26);
  axe.add(box(0.10, 0.10, 0.78, leatherD, 0, 0, 0));                          // wooden haft
  for (const zz of [-0.20, 0.20]) {
    axe.add(box(0.12, 0.12, 0.06, brass, 0, 0, zz));
  }
  axe.add(box(0.06, 0.46, 0.32, iron, 0, 0.16, 0.52));                       // iron blade
  axe.add(box(0.06, 0.36, 0.24, iron, 0, 0.18, 0.74));                       // blade tip
  armR.add(axe);

  // ─── Head ─────── skin + beard + horned helmet
  const HW=0.50, HH=0.50, HDP=0.46;
  const headY = torsoY+torsoH/2+0.04+HH/2;
  g.add(box(HW, HH, HDP, skin, 0, headY, 0));                                // skin head
  // Long braided beard (two stacked boxes hanging from chin)
  g.add(box(HW-0.10, 0.20, 0.18, beard, 0, headY-HH/2-0.04, HDP/2-0.06));
  g.add(box(HW-0.14, 0.18, 0.14, beard, 0, headY-HH/2-0.20, HDP/2-0.08));
  // Eyes — small dark recessed
  for (const sx of [-1,1]) {
    g.add(box(0.08, 0.06, 0.04, eyeC, sx*0.12, headY+0.04, HDP/2+0.02));
  }
  // Long hair on the sides peeking out from under helm
  for (const sx of [-1,1]) {
    g.add(box(0.10, 0.30, HDP-0.08, hair, sx*(HW/2+0.02), headY-0.04, 0));
  }

  // Iron helmet — full head cap with brow ridge + nose guard + tall horns
  const helmY = headY + HH*0.30;
  g.add(box(HW+0.08, HH*0.42, HDP+0.06, iron, 0, helmY, 0));                 // crown
  g.add(box(HW+0.06, 0.10, HDP+0.04, ironD, 0, helmY-HH*0.25, 0));           // brow ridge
  g.add(box(0.10, 0.30, 0.10, ironD, 0, headY-HH*0.02, HDP/2+0.04));         // nose guard
  // Tall horns curving up + outward
  for (const sx of [-1,1]) {
    const hornGrp = new THREE.Group();
    hornGrp.position.set(sx*(HW/2-0.02), helmY+HH*0.18, 0);
    hornGrp.rotation.z = sx*-0.20;
    hornGrp.add(box(0.18, 0.22, 0.20, horn,  sx*0.06, 0.10, 0));             // base
    hornGrp.add(box(0.14, 0.20, 0.16, horn,  sx*0.14, 0.30, 0));             // mid
    hornGrp.add(box(0.10, 0.18, 0.12, hornD, sx*0.22, 0.50, 0));             // tip (darker)
    g.add(hornGrp);
  }

  rig(g, legL,legR,armL,armR, 0); finish(g); return g;
}

export const VILLAINS = { swat, viking };

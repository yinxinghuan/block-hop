// mechs.js — sci-fi register: bipedal walkers, exo suits, hunters from
// other worlds. Built deliberately oversized (tall, broad-shouldered)
// so even at low cycle they read as "this is NOT a person". Same FAMILY-B
// sharp-cube style.
//
// Rig contract matches monsters.js / villains.js: g.userData.rig =
// {legL,legR,armL,armR}. Optional armBase. Add new mechs by exporting a
// function + listing it in the MECHS map at the bottom.
import * as THREE from 'three';
import { P, box, cyl, darken } from '../lib/prims.js';

// sci-fi palette — gunmetal hull, hot orange core, sensor cyan,
// hazard amber striping. Pure additive emissives stay subtle so
// the silhouette wins over the glow at thumbnail size.
const SP = {
  hull:0x46484d, hullD:0x2d2e33, hullL:0x6a6e76,    // gunmetal body panels
  joint:0x18181c,                                    // black hydraulic joints
  rivet:0x9aa1a8,                                    // panel rivet highlight
  core:0xff7028, coreD:0xc44820,                     // emissive chest core
  sensor:0x4fd2ff,                                   // cyan eye / sensor
  amber:0xffaa30,                                    // hazard stripe
  warnR:0xff3030,
};
const glow = c => ({ e:c, ei:1.0 });

function rig(g, legL, legR, armL, armR, armBase=0){
  g.add(legL); g.add(legR); g.add(armL); g.add(armR);
  g.userData.rig = { legL, legR, armL, armR };
  g.userData.armBase = armBase;
  if(armBase){ armL.rotation.x = armR.rotation.x = armBase; }
}
function finish(g){ g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); }

// ─── COMBAT MECH: bipedal walker, hot core, sensor head, twin cannons ─────
// Cue ≥0.25u front-protruding: the orange chest core glow + the twin
// muzzles. Standing height ~3.0u (vs ~2.5u humans) so silhouette reads
// "not human" instantly even at thumbnail size.
export function combatMech(){
  const g = new THREE.Group();
  // Wider/taller than humanoids — the silhouette IS the strength tell.
  const BW=1.30, BD=0.80, torsoH=1.10, legH=1.05, footH=0.22;
  const lx=0.34, hipY=footH+legH;

  // ─── Legs ─────── hydraulic-jointed pistons + chunky feet
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-lx,hipY,0); legR.position.set(lx,hipY,0);
  [legL,legR].forEach(L=>{
    // foot — wide, splayed, hazard amber under-toe
    L.add(box(0.52,footH,BD+0.10, SP.hullD, 0, footH/2-hipY, 0.06));
    L.add(box(0.46,0.06,BD, SP.amber, 0, footH*0.20-hipY, 0.10));      // amber underplate stripe
    // shin — armored cylinder feel
    L.add(box(0.36,legH*0.5,BD-0.18, SP.hull, 0, footH+legH*0.25-hipY, 0));
    // knee joint — exposed black hydraulic ring
    L.add(box(0.38,0.16,BD-0.10, SP.joint, 0, footH+legH*0.50-hipY, 0));
    // thigh — wider servo
    L.add(box(0.42,legH*0.42,BD-0.04, SP.hull, 0, footH+legH*0.74-hipY, 0));
    // amber side stripe on the thigh — hazard read
    L.add(box(0.04,legH*0.42,0.20, SP.amber, 0.21, footH+legH*0.74-hipY, 0));
  });

  // ─── Torso ─────── armored chest with hot reactor core
  const torsoY = hipY+torsoH/2;
  g.add(box(BW,torsoH,BD, SP.hull, 0,torsoY,0));                      // chest plate
  g.add(box(BW+0.10,torsoH*0.30,BD+0.06, SP.hullD, 0,torsoY+torsoH*0.30,0)); // upper ridge
  g.add(box(BW+0.06,torsoH*0.18,BD+0.02, SP.hullD, 0,torsoY-torsoH*0.40,0)); // hip belt
  // Reactor core — emissive hot orange, recessed in chest
  g.add(box(0.42,0.32,0.10, SP.coreD, 0,torsoY,BD/2+0.01));            // recess frame
  g.add(box(0.32,0.22,0.08, SP.core, 0,torsoY,BD/2+0.06, glow(SP.core))); // glowing core
  // Vents on flanks — amber hazard
  for (const sx of [-1, 1]) {
    g.add(box(0.04, 0.30, 0.10, SP.amber, sx*(BW/2+0.02), torsoY-0.05, 0, glow(SP.amber)));
  }
  // Shoulder pauldrons — broad blocks suggesting big servos
  for (const sx of [-1, 1]) {
    g.add(box(0.42, 0.36, BD-0.04, SP.hull,  sx*(BW/2+0.18), torsoY+torsoH/2-0.06, 0));
    g.add(box(0.44, 0.06, BD-0.04, SP.amber, sx*(BW/2+0.18), torsoY+torsoH/2+0.16, 0));
  }

  // ─── Arms ─────── industrial cannon on each side
  const ax=BW/2+0.36, shoulderY=torsoY+torsoH/2-0.22, armH=torsoH+0.20;
  const armL=new THREE.Group(), armR=new THREE.Group();
  armL.position.set(-ax,shoulderY,0); armR.position.set(ax,shoulderY,0);
  [armL,armR].forEach((A, i)=>{
    A.add(box(0.32, armH*0.40, 0.36, SP.hull, 0,-armH*0.20+0.04,0));    // upper arm
    A.add(box(0.36, 0.16, 0.40, SP.joint, 0,-armH*0.42+0.04,0));        // elbow
    A.add(box(0.36, armH*0.40, 0.42, SP.hullL, 0,-armH*0.66+0.04,0));   // forearm (lighter highlight)
    // Cannon barrel jutting forward — the visual hook
    A.add(box(0.28, 0.28, 0.62, SP.hullD, 0,-armH+0.10, 0.28));
    A.add(box(0.18, 0.18, 0.10, SP.core, 0, -armH+0.10, 0.62, glow(SP.core)));  // muzzle glow
    A.add(box(0.06, 0.08, 0.30, SP.amber, 0, -armH+0.22, 0.36));        // hazard top stripe
  });

  // ─── Head/sensor cluster ─────── narrow, low, single cyclops eye
  const HW=0.46, HH=0.30, HDP=0.50;
  const headY = torsoY+torsoH/2+0.12+HH/2;
  g.add(box(HW,HH,HDP, SP.hullD, 0,headY,0));                          // sensor housing
  g.add(box(HW-0.08,0.16,0.04, SP.sensor, 0,headY,HDP/2+0.02, glow(SP.sensor))); // wide cyan eye slit
  // Twin antennas
  for (const sx of [-1, 1]) {
    g.add(box(0.04,0.30,0.04, SP.hullD, sx*(HW/2-0.04), headY+HH/2+0.16, -HDP/2+0.08));
    g.add(box(0.04,0.06,0.04, SP.warnR, sx*(HW/2-0.04), headY+HH/2+0.32, -HDP/2+0.08, glow(SP.warnR)));
  }

  rig(g, legL,legR,armL,armR, 0); finish(g); return g;
}

export const MECHS = { combatMech };

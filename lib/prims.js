// prims.js — shared low-poly primitives + palette (the "material asset" base layer)
// One visual language: hard-edge flat-shaded boxes, low-seg cylinders, faceted balls,
// 45° wedges. Every builder across all categories imports from here so the whole
// library reads as ONE coherent set. See DESIGN_SYSTEM.md for the rules.
import * as THREE from 'three';

// ─── voxel grid ──────────────────────────────────────────────────────────────
// All geometry SHOULD snap to this unit; min readable feature ≈ 1 unit at sheet scale.
export const GRID = 0.125;
export const snap = v => Math.round(v / GRID) * GRID;

// ─── shared palette (one wood + one metal + warm neutrals + curated accents) ──
// Structural neutrals are warm-tinted (never dead grey). ONE family accent (teal).
export const P = {
  // wood
  woodL:0xc8975c, woodM:0xa9774a, woodD:0x7c5230, woodDk:0x5e3d24,
  // metal / stone
  ironD:0x3b3b44, ironM:0x5c5c68, steel:0x8b8f98, slate:0x5b626b,
  stone:0x9aa1a8, stoneD:0x6f757c,
  // warm structural neutrals
  white:0xf4f1e8, panel:0xdcd7c9, panelD:0xc2bba9, cream:0xf3ead4,
  // family accent + glow
  accent:0x3fb6ac, gold:0xf2c14e, glass:0xbfe6ff, coldGlow:0x9fd6ff, amber:0xffcf6b,
  // locked 6-swatch product/object palette (reuse everywhere so the world matches)
  red:0xe0483b, orange:0xffb13b, green:0x4fae44, blue:0x36a3ec, purple:0xb05de8, coral:0xff7a4d,
  // nature
  leaf:0x4fae44, leafD:0x3a8a32, leafL:0x6fc85a, bark:0x7c5230, barkD:0x5e3d24,
  apple:0xe03b3b, fruitO:0xff8a2b, lime:0x8bc34a, plum:0x9c4dd6, petal:0xff7aa8,
  // people: warm skin tones + hair (character builders only; faces stay literal micro-detail)
  skin:0xf2c79a, skinD:0xe2a877, skinTan:0xc68642, skinDk:0x8d5524,
  hairDark:0x3a2f28, hairGrey:0xd2d0d4, hairBlond:0xf2c531, hairBrown:0x6b4423, hairRed:0xb5532a,
};

// ─── flat-shaded material cache (optionally emissive / transparent) ──────────
const matCache = new Map();
export function M(hex, rough=0.9, emissive=0, emInt=0, opacity=1){
  const k = hex+'|'+rough+'|'+emissive+'|'+emInt+'|'+opacity;
  if(!matCache.has(k)){
    const m = new THREE.MeshStandardMaterial({color:hex, roughness:rough, metalness:0, flatShading:true});
    if(emissive){ m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emInt; }
    if(opacity < 1){ m.transparent = true; m.opacity = opacity; }
    matCache.set(k, m);
  }
  return matCache.get(k);
}

// opt = { r:roughness, e:emissiveHex, ei:emissiveIntensity, o:opacity }
const mat = (hex, opt) => opt ? M(hex, opt.r, opt.e, opt.ei, opt.o) : M(hex);

export function box(w,h,d, hex, x,y,z, opt){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(hex,opt));
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m;
}
export function cyl(rt,rb,h,seg, hex, x,y,z, opt){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(hex,opt));
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m;
}
// low-poly faceted ball (fruit / berries / bushes) — icosahedron, flat-shaded
export function ball(r, hex, x,y,z, detail=0){
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), M(hex,0.85));
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m;
}
// cone (tree crowns, roofs, hats) — flat-shaded, low seg
export function cone(r,h,seg, hex, x,y,z, opt){
  const m = new THREE.Mesh(new THREE.ConeGeometry(r,h,seg), mat(hex,opt));
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m;
}
// 45° right-triangular prism (sloped lids / roofs / snouts), extruded along Z
export function wedge(w,h,d, hex, x,y,z, rotY=0){
  const g = new THREE.BufferGeometry(); const hw=w/2, hh=h/2, hd=d/2;
  const v = new Float32Array([
    -hw,-hh, hd,  hw,-hh, hd,  hw, hh, hd,
    -hw,-hh,-hd,  hw, hh,-hd,  hw,-hh,-hd,
    -hw,-hh,-hd, -hw,-hh, hd,  hw,-hh, hd,  -hw,-hh,-hd,  hw,-hh, hd,  hw,-hh,-hd,
     hw,-hh, hd,  hw,-hh,-hd,  hw, hh,-hd,   hw,-hh, hd,  hw, hh,-hd,  hw, hh, hd,
    -hw,-hh,-hd, -hw,-hh, hd,  hw, hh,-hd,  -hw,-hh, hd,  hw, hh, hd,  hw, hh,-hd,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v,3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, M(hex)); m.position.set(x,y,z); m.rotation.y = rotY;
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m;
}

export function darken(hex, f=0.66){
  const r=(hex>>16&255)*f, g=(hex>>8&255)*f, b=(hex&255)*f;
  return (r<<16 | g<<8 | b) | 0;
}

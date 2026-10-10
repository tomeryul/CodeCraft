"use strict";
/* ---------------- world generation ---------------- */
function noiseFn(rnd,cell){
  const gw=Math.floor(W/cell)+3, gh=Math.floor(H/cell)+3;
  const v=new Float32Array(gw*gh); for(let i=0;i<v.length;i++)v[i]=rnd();
  return (x,y)=>{
    const fx=x/cell, fy=y/cell, x0=Math.floor(fx), y0=Math.floor(fy);
    const tx=fx-x0, ty=fy-y0, sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
    const a=v[y0*gw+x0], b=v[y0*gw+x0+1], c=v[(y0+1)*gw+x0], d=v[(y0+1)*gw+x0+1];
    return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
  };
}
function buildTerrain(){
  const rnd=mulberry32(seed);
  const n1=noiseFn(rnd,11), n2=noiseFn(rnd,5);
  terrain=new Uint8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const n=.62*n1(x,y)+.38*n2(x,y);
    terrain[key(x,y)] = n<.34?T_WATER : n<.40?T_SAND : n<.70?T_GRASS : T_ROCKY;
  }
  homePos={x:W>>1,y:H>>1}; marketPos={x:(W>>1)+2,y:H>>1};
  for(let y=homePos.y-4;y<=homePos.y+4;y++)for(let x=homePos.x-4;x<=homePos.x+4;x++)
    if(x>=0&&y>=0&&x<W&&y<H) terrain[key(x,y)]=T_GRASS;
}
/* What the seed itself puts in the world: trees, flowers and the rock, iron
   and crystal nodes. A node is mined and comes back on the same tile, so this
   is also the full list of tiles where a node may ever stand — see worldTidy. */
function baseObjects(){
  const rnd=mulberry32(seed^0x9e37);
  const objects=new Map();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(Math.abs(x-homePos.x)<=3&&Math.abs(y-homePos.y)<=3)continue;
    const t=terrain[key(x,y)], r=rnd();
    if(t===T_GRASS){
      if(r<.13)objects.set(key(x,y),{type:"tree",stage:2});
      else if(r<.17)objects.set(key(x,y),{type:"flower"});
    }else if(t===T_ROCKY){
      if(r<.16)objects.set(key(x,y),{type:"rock"});
      else if(r<.24)objects.set(key(x,y),{type:"iron"});
      else if(r<.255)objects.set(key(x,y),{type:"crystal"});
    }
  }
  return objects;
}
function genObjects(){
  objects=baseObjects();
  objects.set(key(homePos.x,homePos.y),{type:"home"});
  objects.set(key(marketPos.x,marketPos.y),{type:"market"});
  objects.set(key(homePos.x-2,homePos.y),{type:"chest"});
  // hidden treasure far from home rewards explorers
  const rnd2=mulberry32(seed^0xabcd);
  let placed=0,tries=0;
  while(placed<10&&tries++<800){
    const x=2+Math.floor(rnd2()*(W-4)), y=2+Math.floor(rnd2()*(H-4));
    if(Math.abs(x-homePos.x)+Math.abs(y-homePos.y)>18&&terrain[key(x,y)]!==T_WATER&&!objects.has(key(x,y))){
      objects.set(key(x,y),{type:"gift"});placed++;
    }
  }
}
function genAnimals(){
  const rnd=mulberry32(seed^0x51f1);
  animals=[]; const kinds=["🐰","🐑","🐰","🦆","🐿️"];
  let tries=0;
  while(animals.length<16&&tries++<600){
    const x=1+Math.floor(rnd()*(W-2)), y=1+Math.floor(rnd()*(H-2));
    if(terrain[key(x,y)]===T_GRASS&&!objects.has(key(x,y)))
      animals.push({x,y,rx:x,ry:y,em:kinds[animals.length%kinds.length],next:rnd()*2000});
  }
}
/* A 💎 rich seam is a visit, not a feature: it sinks away when its event
   ends. Two ways it used to stay for good, and the world near home slowly
   filled with stone until a robot could not take a step:
   - the event is not saved, so a seam up when the game closed (every update
     reloads it) never got its ending, and its nodes stayed;
   - a seam node that was mined went on the respawn queue like any other, and
     came back as a plain, permanent node.
   Both are closed at the source (hitNode, applySave). This also heals a world
   that already filled up: any rock, iron or crystal on a tile where the seed
   never put one — standing, or waiting to come back — is removed. */
const NODE_TYPES={rock:1,iron:1,crystal:1};
function worldTidy(){
  const base=baseObjects();
  const stray=(k,type)=>NODE_TYPES[type]&&!(base.get(k)&&base.get(k).type===type);
  let gone=0;
  for(const [k,o] of [...objects]){
    if(o.lode||stray(k,o.type)){objects.delete(k);gone++;}
  }
  respawnQ=respawnQ.filter(e=>!stray(key(e.x,e.y),e.type));
  /* one building per finished build project: replaying one used to add
     another copy beside home each time (challenges.js mgSuccess) */
  const seenBuild=new Set();
  for(const [k,o] of [...objects]){
    if(o.type!=="proj")continue;
    if(seenBuild.has(o.em)){objects.delete(k);gone++;}else seenBuild.add(o.em);
  }
  return gone;
}

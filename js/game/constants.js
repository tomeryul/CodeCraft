"use strict";
/* ---------------- constants ---------------- */
const W=80, H=80, TILE=48;
const DX=[0,1,0,-1], DY=[-1,0,1,0];
const T_WATER=0,T_SAND=1,T_GRASS=2,T_ROCKY=3;
const RES={wood:{em:"🪵",price:2},stone:{em:"🪨",price:3},iron:{em:"⛓️",price:6},crystal:{em:"💎",price:15},water:{em:"💧",price:1}};
const NODE_HP={tree:3,rock:4,iron:5,crystal:6}; // hits needed to harvest — forces loops
const NODE_YIELD={tree:"wood",rock:"stone",iron:"iron",crystal:"crystal"};
const NODE_RESPAWN={tree:25000,rock:50000,iron:70000,crystal:120000};
const ROBOT_COLORS=["#ffb830","#5ab8ff","#ff5d73","#54d66a","#b184ff","#ff9d6b","#4dd4c0","#f06bd4"];
// 🤝 a claim is a short reservation, not a lock: long enough to walk over and
// work, short enough that a robot which wanders off never blocks the tile forever.
const CLAIM_MS=18000;
const RADIO_MS=45000;   // how long a 📡 Broadcast stays on the noticeboard
const RADIO_CH=["tree","rock","iron","crystal","help"];
const RADIO_EM={tree:"🌳",rock:"🪨",iron:"⛓️",crystal:"💎",help:"🆘"};
const SAVE_KEY="codecraft_save_v1";

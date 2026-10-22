"use strict";
/* ---------------- constants ---------------- */
/* Bumped with sw.js on every deploy, and shown at the bottom of Settings.
   A player reporting "this change is not there" and a build number in the
   same screenshot answers, in one look, whether they are even running it. */
const CC_BUILD="v209";
const W=80, H=80, TILE=48;
const DX=[0,1,0,-1], DY=[-1,0,1,0];
const T_WATER=0,T_SAND=1,T_GRASS=2,T_ROCKY=3;
const RES={wood:{em:"🪵",price:2},stone:{em:"🪨",price:3},iron:{em:"⛓️",price:6},crystal:{em:"💎",price:15},water:{em:"💧",price:1}};
/* One robot tick at speed 1, in ms. It was 340, which was too quick to
   see a single swing; a tick is now long enough for a step to read as a
   walk. A work action — a chop, a swing of the pick, a block set down —
   takes WORK_TICKS of them, so the clip it plays is not squeezed into a
   blink (loop.js schedules it, render.js times the clip to it). WORK_ACTS
   says how many ticks each one takes. */
const ROBOT_STEP_MS=420, WORK_TICKS=1.5;
/* the moments an action can turn into (a bump, a bag that will not shut,
   a sale) take a work action's time too, so they can be seen */
const WORK_ACTS={collect:WORK_TICKS,chop:WORK_TICKS,mine:WORK_TICKS,scoop:WORK_TICKS,
  drop:WORK_TICKS,build:WORK_TICKS,bump:WORK_TICKS,edge:WORK_TICKS,
  teeter:2.2,stuff:2.4,slump:2,sell:2.2};
/* A full bag is heavy: the robot slogs home this much slower. The walk it
   plays says so (the rig's "heavy"), and so does the clock. */
const HEAVY_SLOW=1.25;
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
/* Language is a property of the person holding the phone, not of the world,
   so it lives beside the save rather than inside it. It used to be a field
   in the save, which meant any save that predated the feature — a cloud
   save written on another device, or before Hebrew existed — read as
   English and turned the player's own choice off mid-session. */
const LANG_KEY="codecraft_lang";

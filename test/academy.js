/* Every Academy lesson is SOLVED here, by running the solution the lesson's own
   steps describe, through the real engine.

   A tutorial that cannot be completed by following its instructions is worse
   than no tutorial, and neither the text nor the block budget tells you whether
   that is the case — only running it does. For the lessons whose whole point is
   a technique (While, Functions, Algorithms), this also checks the SHORTCUT
   fails: a function lesson that a plain loop solves teaches nothing.

   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/academy.js */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LAUNCH = fs.existsSync(CHROME) ? { executablePath: CHROME } : {};
const APP = 'file://' + path.join(ROOT, 'index.html');

let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};

/* Runs a program on a lesson and reports whether it solved it and what it cost.
   Ticks synchronously rather than waiting on the animation timer. */
const DRIVE = `(id, prog) => {
  player.academy = {};
  const i = TUTS.findIndex(t => t.id === id);
  academyEnter(i);
  applyProg(mgRobot, prog);
  renderProgram(); mgUpdateCount();
  const size = progSize(mgRobot);
  const budget = mgState.proj.maxBlocks;
  mgRun();
  for (let k = 0; k < 6000 && mgState && mgState.running; k++) mgTick();
  const solved = !!player.academy[id];
  if (window.mgState) mgExit(false);
  mgState = null; mgRobot = null;
  return { solved, size, budget, within: size <= budget };
}`;

(async () => {
  const b = await chromium.launch(LAUNCH);
  const pg = await b.newPage({ viewport:{width:420,height:940} });
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto(APP); await pg.waitForTimeout(1000);
  await pg.evaluate(()=>{ try{ ageSet(true); document.getElementById('agegate').classList.remove('open'); }catch(e){} });
  await pg.evaluate(()=>{ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} });
  await pg.reload(); await pg.waitForTimeout(1000);
  await pg.evaluate(()=>{ ageSet(true); document.getElementById('agegate').classList.remove('open'); });
  await pg.click('#playBtn').catch(()=>{}); await pg.waitForTimeout(1200);
  await pg.evaluate(()=>{const c=document.querySelector('#ccCele .cc-cta');if(c)c.click();});
  await pg.waitForTimeout(400);
  const drive = (id, prog) => pg.evaluate(([d,i,p]) => eval('('+d+')')(i,p), [DRIVE, id, prog]);

  const B = (t, extra) => Object.assign({t, uid: Math.floor(Math.random()*1e9)}, extra||{});

  console.log('▶ every lesson is solvable by following its own instructions');

  // 1-4: the plain ones
  ck('👣 First Steps — four Moves reach the flag',
     (await drive('t_move', [B('move'),B('move'),B('move'),B('move')])).solved === true);

  let r = await drive('t_turn', [B('move'),B('move'),B('move'),B('turnR'),B('move'),B('move'),B('move')]);
  ck('🧭 Turn & Go — move across, turn, move down', r.solved === true && r.within, r);

  r = await drive('t_chop', [B('move'),B('move'),B('move'),B('chop')]);
  ck('🪓 Timber! — walk up to the tree and chop it', r.solved === true && r.within, r);

  r = await drive('t_collect', [B('move'),B('move'),B('move'),B('move'),B('collect')]);
  ck('💎 Treasure Hunt — reach the gem and collect', r.solved === true && r.within, r);

  // 5-6: loop and if
  r = await drive('t_loop', [B('repeat',{n:5,body:[B('move'),B('chop')]})]);
  ck('🔁 Loop the Forest — one loop clears five trees inside budget', r.solved === true && r.within, r);

  r = await drive('t_if', [B('repeat',{n:5,body:[
        B('if',{cond:'treeAhead',body:[B('chop')],els:[]}), B('move')]})]);
  ck('❓ Smart Chopper — If tree ahead → Chop, inside a Repeat', r.solved === true && r.within, r);

  // ---------------------------------------------------------------- advanced
  console.log('▶ the four advanced lessons, which are the point of this change');

  // 7 While
  r = await drive('t_while', [B('whileLoop',{cond:'treeAhead',body:[B('chop'),B('move')]})]);
  ck('🔄 Until It\'s Done — While tree ahead → Chop, Move clears all eleven',
     r.solved === true && r.within, r);
  ck('   ...and it needs no number: the same 3 blocks, whatever the count', r.size === 3, r);

  // 8 Variables
  const countProg = [
    B('setVar',{name:'count', val:{k:'num',n:0}}),
    B('repeat',{n:8, body:[
      B('if',{cond:'brickHere', body:[B('changeVar',{name:'count', n:1})], els:[]}),
      B('move')]}),
    B('say',{val:{k:'var', name:'count'}})
  ];
  r = await drive('t_var', countProg);
  ck('🔢 Keep Count — count the bricks and say the answer', r.solved === true && r.within, r);

  // 9 Functions: the routine solution fits, the written-out one does not
  const job = [B('build'),B('move'),B('move'),B('build')];
  const withFn = { main:[ B('call',{fn:'A'}), B('move'),B('move'),B('move'),
                          B('call',{fn:'A'}), B('move'),B('move'),
                          B('call',{fn:'A'}) ],
                   routines:{ A:{params:[], body:job}, B:{params:[], body:[]} } };
  r = await drive('t_func', withFn);
  ck('🔧 Name the Job — one routine called three times solves it', r.solved === true, r);
  ck('   ...and it fits the budget only because a routine is counted once',
     r.within === true, r);

  const inline = [].concat(job, [B('move'),B('move'),B('move')], job, [B('move'),B('move')], job);
  let r2 = await drive('t_func', inline);
  ck('   ...while writing the same job out three times BUSTS the budget',
     r2.within === false && r2.size > r.size, {routine:r, inline:r2});

  // 10 Algorithm: one program, four rows — and the lazy answer fails
  r = await drive('t_algo', countProg);
  ck('🧠 One Program, Any Row — the counting algorithm passes all four rows',
     r.solved === true && r.within, r);

  const hardcoded = [B('say',{val:{k:'num',n:4}})];
  r2 = await drive("t_algo", hardcoded);
  ck('   ...and hardcoding the first answer FAILS, which is the lesson',
     r2.solved === false, r2);

  // ------------------------------------------------- teaching text is present
  console.log('▶ every lesson explains itself');
  const text = await pg.evaluate(()=>TUTS.map(t=>({
    id:t.id, teach:(t.teach||[]).length, steps:(t.steps||[]).length,
    blocksNamed:(t.teach||[]).every(x=>x.em&&x.name&&x.txt)
  })));
  ck('every lesson says what its new blocks do', text.every(t=>t.teach>0 && t.blocksNamed), text.filter(t=>!t.teach));
  ck('every lesson lists the steps to take', text.every(t=>t.steps>=3), text.filter(t=>t.steps<3));

  // the card actually renders
  const card = await pg.evaluate(()=>{
    academyEnter(TUTS.findIndex(t=>t.id==='t_func'));
    const el=document.getElementById('mgLesson');
    const out={ shown:el.style.display!=='none',
                blocks:el.querySelectorAll('.ls-block').length,
                steps:el.querySelectorAll('.ls-steps li').length,
                badge:(el.querySelector('.ls-badge')||{}).textContent };
    el.querySelector('#lsClose').click();
    out.hidAfterClose=el.classList.contains('hid');
    out.reopenOffered=!!document.getElementById('lsShow');
    document.getElementById('lsShow').click();
    out.reopened=!el.classList.contains('hid');
    if(window.mgState)mgExit(false);
    return out;
  });
  ck('the lesson card renders its blocks and steps',
     card.shown && card.blocks===3 && card.steps===5, card);
  ck('it names which lesson you are on', /Lesson 9 of 10/.test(card.badge||''), card);
  ck('it can be dismissed and brought back', card.hidAfterClose && card.reopenOffered && card.reopened, card);

  // graduation still means the core six, not all ten
  const grad = await pg.evaluate(()=>{
    player.academy={}; TUTS.slice(0,ACADEMY_CORE).forEach(t=>player.academy[t.id]=1);
    return { core:academyComplete(), all:academyAllDone(), coreCount:ACADEMY_CORE, total:TUTS.length };
  });
  ck('finishing the six basics graduates you to the world',
     grad.core === true && grad.all === false, grad);
  ck('the advanced lessons do not gate the open world',
     grad.coreCount === 6 && grad.total === 10, grad);

  console.log('  pageerrors:', errs.length?errs.slice(0,3).join(' | '):'none');
  ck('no uncaught exceptions', errs.length===0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();

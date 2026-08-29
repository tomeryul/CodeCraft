/* v4 layout pass — the checklist the handoff ships with, run against the app.
   These assert WHERE controls are, not what they look like: one action bar at
   the foot of the editor, exactly one primary button at a time, and nothing
   tappable stranded in the middle of the play area.

   Two traps this file exists to avoid, both of which produced false results
   while it was being written:
     - .sheet closes by transform over .28s. Measuring in the same frame you
       remove .open shows the sheet still on screen, so every control inside
       it looks stranded in the play area. Wait for the transition.
     - offsetParent is non-null for a sheet parked off-screen by a transform,
       so it is not a visibility test. Hit-test the centre point instead.

   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/layout.js */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errs=[], bad=[];

  for (const [W,H] of [[390,844],[360,780],[320,700]]) {
    const pg = await b.newPage({ viewport:{width:W,height:H}, deviceScaleFactor:2 });
    pg.on('pageerror', e=>errs.push(String(e)));
    pg.on('response', r=>{ if(r.status()>=400) bad.push(r.status()+' '+r.url().split('/').pop()); });
    await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(1000);
    await pg.evaluate(()=>{ ageSet(true); document.getElementById('agegate').classList.remove('open'); });
    await pg.click('#playBtn').catch(()=>{}); await pg.waitForTimeout(1400);
    await pg.evaluate(()=>{ const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click(); });
    await pg.waitForTimeout(1800);

    // ---------------------------------------------- world: three docks only
    await pg.evaluate(()=>{
      if(mgState) mgExit(false);
      tutSet(0); $('editor').classList.remove('open','max');
      document.querySelectorAll('.sheet.open,#splash.open').forEach(s=>s.classList.remove('open'));
    });
    await pg.waitForTimeout(500);   // let the sheets finish sliding out
    const world = await pg.evaluate(()=>{
      const H=innerHeight, W=innerWidth;
      const tap=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>{
        const r=e.getBoundingClientRect();
        if(r.width<8||r.height<8) return false;
        if(r.bottom<0||r.top>H||r.right<0||r.left>W) return false;
        const x=Math.min(Math.max(r.left+r.width/2,1),W-1),
              y=Math.min(Math.max(r.top+r.height/2,1),H-1);
        const hit=document.elementFromPoint(x,y);
        return !!hit && (hit===e || e.contains(hit));
      });
      // #topbar and #bottombar are the docks; only strays between them count
      const mid=tap.filter(e=>{
        if(e.closest('#topbar,#bottombar')) return false;
        const r=e.getBoundingClientRect();
        return r.top>96 && r.bottom<H-140;
      }).map(e=>e.id||e.className);
      const fab=$('fabRun').getBoundingClientRect();
      return { mid, fabH:Math.round(fab.height),
               fabLabel:getComputedStyle($('fabRun'),'::after').content,
               energyShown:!!$('energyChip').offsetParent };
    });
    ck(`${W}x${H} world: nothing tappable stranded in the play area`, world.mid.length===0, world.mid);
    ck(`${W}x${H} world: the run button is a labelled pill`,
       world.fabH>=52 && /Run/.test(world.fabLabel||''), world);
    ck(`${W}x${H} energy chip hidden while full`, world.energyShown===false, world);

    // ---------------------------------------------- the bottom row fits
    /* The menu button costs this row 48px. At 320 (SE) that pushed Run past
       the bar and 25px of it off the screen, and at 360 it collapsed to its
       min-width. Run is the primary and the one control here that has to
       keep its word, so the room comes out of the paddings. */
    const bar = await pg.evaluate(()=>{
      const ids=['hubBtn','codeBtn','buildBtn','fabRun'];
      const bb=$('bottombar').getBoundingClientRect();
      return { fits:ids.every(n=>$(n).getBoundingClientRect().right<=bb.right+.5),
               tap:ids.every(n=>{const r=$(n).getBoundingClientRect();
                                 return r.height>=40&&r.width>=40;}),
               noClip:ids.every(n=>$(n).scrollWidth<=Math.round($(n).getBoundingClientRect().width)+1),
               labels:[$('codeBtn').textContent.trim(),$('buildBtn').textContent.trim(),
                       getComputedStyle($('fabRun'),'::after').content] };
    });
    ck(`${W}x${H} the whole bottom row fits, labels intact`,
       bar.fits && bar.tap && bar.noClip &&
       bar.labels[0]==='Code' && bar.labels[1]==='Build' && /Run/.test(bar.labels[2]), bar);

    // ---------------------------------------------- world editor: Run only
    const wed = await pg.evaluate(()=>{
      $('editor').classList.add('open'); setTab('blocks'); renderPalette(); updateFab();
      const v=n=>!!($(n)&&$(n).offsetParent);
      const bar=$('actionBar').getBoundingClientRect(), sh=$('editor').getBoundingClientRect();
      return { run:v('runBtn'), stop:v('stopBtn'), reset:v('mgResetBtn'), step:v('mgStepBtn'),
               barAtBottom:Math.abs(bar.bottom-sh.bottom)<2,
               runH:Math.round($('runBtn').getBoundingClientRect().height) };
    });
    ck(`${W}x${H} world editor: Run only, no Reset/Step`,
       wed.run && !wed.stop && !wed.reset && !wed.step, wed);
    ck(`${W}x${H} action bar is the last row of the sheet`, wed.barAtBottom, wed);
    ck(`${W}x${H} Run is 58px`, wed.runH===58, wed);

    // ---------------------------------------------- challenge: all four
    const mg = await pg.evaluate(()=>{
      academyEnter(TUTS.findIndex(t=>t.id==='t_func'));
      const v=n=>!!($(n)&&$(n).offsetParent);
      return { run:v('runBtn'), stop:v('stopBtn'), reset:v('mgResetBtn'), step:v('mgStepBtn'),
               // mgState is a top-level let, never on window — read the flag the CSS reads
               mgFlag:$('editor').classList.contains('mg'),
               labels:[...$('actionBar').querySelectorAll('i')].map(i=>i.textContent),
               heights:[...document.querySelectorAll('#actionBar button')]
                 .filter(e=>e.offsetParent).map(e=>Math.round(e.getBoundingClientRect().height)) };
    });
    ck(`${W}x${H} challenge: Reset + Step appear, labelled`,
       mg.reset&&mg.step&&mg.run&&!mg.stop&&mg.mgFlag&&mg.labels.join()==='RESET,STEP', mg);
    ck(`${W}x${H} every action-bar control >=40px`, mg.heights.every(h=>h>=40), mg.heights);

    // ---------------------------------------------- one primary at a time
    const run = await pg.evaluate(()=>{
      applyProg(mgRobot,[{t:'move',uid:1},{t:'move',uid:2},{t:'move',uid:3}]);
      renderProgram(); mgRun(); updateFab();
      const v=n=>!!($(n)&&$(n).offsetParent);
      const out={ run:v('runBtn'), stop:v('stopBtn'), running:$('editor').classList.contains('running') };
      mgStop(); updateFab();
      out.afterStop={ run:v('runBtn'), stop:v('stopBtn') };
      return out;
    });
    ck(`${W}x${H} exactly one primary while running (Stop, not both)`,
       run.stop && !run.run && run.running, run);
    ck(`${W}x${H} ...and back to Run when stopped`, run.afterStop.run && !run.afterStop.stop, run);

    // ---------------------------------------------- .max: bar still docked
    await pg.evaluate(()=>{ $('editor').classList.add('open','max'); });
    await pg.waitForTimeout(450);
    const mx = await pg.evaluate(()=>{
      const bar=$('actionBar').getBoundingClientRect(), sh=$('editor').getBoundingClientRect();
      return { barBottom:Math.round(bar.bottom), sheetBottom:Math.round(sh.bottom),
               visible:bar.top<innerHeight };
    });
    ck(`${W}x${H} at .max the action bar is still docked`,
       Math.abs(mx.barBottom-mx.sheetBottom)<2 && mx.visible, mx);

    // ---------------------------------------------- the home indicator, once
    // The desktop engine reports env(safe-area-inset-bottom) as 0, so the
    // double-count is invisible here unless a real inset is simulated.
    await pg.addStyleTag({content:':root{--sab:34px !important;}'});
    await pg.evaluate(()=>{ $('editor').classList.remove('max'); });
    await pg.waitForTimeout(200);
    const sab = await pg.evaluate(()=>{
      const e=$('editor').getBoundingClientRect(), b=$('actionBar').getBoundingClientRect(),
            r=$('runBtn').getBoundingClientRect();
      return { belowRun:Math.round(e.bottom-r.bottom),
               barToSheet:Math.round(e.bottom-b.bottom),
               sheetPad:getComputedStyle($('editor')).paddingBottom };
    });
    // 34 indicator + 12 padding. 80 means .sheet and #actionBar both added it.
    ck(`${W}x${H} safe area is reserved once, not twice`,
       sab.belowRun===46 && sab.barToSheet===0, sab);
    await pg.evaluate(()=>{
      [...document.querySelectorAll('style')].forEach(s=>{
        if(s.textContent.includes('--sab:34px')) s.remove(); });
    });

    // ---------------------------------------------- creator tool tray
    const cr = await pg.evaluate(()=>{
      if(mgState) mgExit(false);
      mgEnterCreator();
      $('mgCreatorBar').classList.add('setup');
      const t=document.querySelector('#mgCreatorBar .cb-row.tools');
      const st=t?getComputedStyle(t).position:null, r=t?t.getBoundingClientRect():null;
      if(mgState) mgExit(false);
      return { sticky:st, inView:r?r.top<innerHeight:false };
    });
    ck(`${W}x${H} creator tool tray is sticky`, cr.sticky==='sticky'&&cr.inView, cr);

    await pg.close();
  }

  console.log('  404s:', bad.length?bad.join(', '):'none');
  ck('no console errors', errs.length===0, errs.slice(0,3));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();

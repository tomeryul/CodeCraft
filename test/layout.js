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
    /* Energy used to be hidden whenever it was full, because four status chips
       and four tools would not fit across 390px. The status cluster is one
       42px pill now and the room is there, so a full battery is a number you
       can see — except at 359px and under, where it folds back to showing
       only when it is low enough to act on. */
    ck(`${W}x${H} energy chip follows the width, not the battery`,
       world.energyShown === (W>=384), world);

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
      const bar=$('actionBar').getBoundingClientRect(),
            tabs=$('tabs').getBoundingClientRect(),
            sh=$('editor').getBoundingClientRect();
      return { run:v('runBtn'), stop:v('stopBtn'), reset:v('mgResetBtn'), step:v('mgStepBtn'),
               /* v5 put #tabs last, where an app's tab bar goes, so the run
                  row is the row above it rather than the final one. */
               barAboveTabs:Math.abs(tabs.top-bar.bottom)<2,
               tabsLast:Math.abs(tabs.bottom-sh.bottom)<2,
               runH:Math.round($('runBtn').getBoundingClientRect().height) };
    });
    ck(`${W}x${H} world editor: Run only, no Reset/Step`,
       wed.run && !wed.stop && !wed.reset && !wed.step, wed);
    ck(`${W}x${H} the run row sits directly on the tab bar, which is last`,
       wed.barAboveTabs && wed.tabsLast, wed);
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
      const bar=$('actionBar').getBoundingClientRect(),
            tabs=$('tabs').getBoundingClientRect(),
            sh=$('editor').getBoundingClientRect();
      return { gap:Math.round(tabs.top-bar.bottom),
               tabsToSheet:Math.round(sh.bottom-tabs.bottom),
               visible:bar.top<innerHeight&&tabs.top<innerHeight };
    });
    ck(`${W}x${H} at .max both bottom rows are still docked`,
       Math.abs(mx.gap)<2 && Math.abs(mx.tabsToSheet)<2 && mx.visible, mx);

    // ---------------------------------------------- the home indicator, once
    // The desktop engine reports env(safe-area-inset-bottom) as 0, so the
    // double-count is invisible here unless a real inset is simulated.
    await pg.addStyleTag({content:':root{--sab:34px !important;}'});
    await pg.evaluate(()=>{ $('editor').classList.remove('max'); });
    await pg.waitForTimeout(200);
    /* Stated against whichever row is last, so a future reshuffle moves the
       inset instead of silently losing it: exactly one row may reserve it,
       and that row has to be the one against the bottom edge. */
    const sab = await pg.evaluate(()=>{
      const ed=$('editor'), e=ed.getBoundingClientRect();
      const rows=[...ed.children].filter(c=>c.getBoundingClientRect().height>0);
      const last=rows[rows.length-1];
      const pad=c=>parseFloat(getComputedStyle(c).paddingBottom)||0;
      return { lastRow:last.id||last.className,
               lastIsFlush:Math.abs(e.bottom-last.getBoundingClientRect().bottom)<2,
               lastReserves:pad(last)>=34,
               othersReserving:rows.slice(0,-1).filter(c=>pad(c)>=34).map(c=>c.id||c.className),
               sheetPad:pad(ed) };
    });
    ck(`${W}x${H} the home indicator is reserved once, by the last row`,
       sab.lastIsFlush && sab.lastReserves &&
       sab.othersReserving.length===0 && sab.sheetPad<34, sab);
    await pg.evaluate(()=>{
      [...document.querySelectorAll('style')].forEach(s=>{
        if(s.textContent.includes('--sab:34px')) s.remove(); });
    });

    /* The scrim used to be a ::before on .sheet. A z-index:-1 child paints
       above its own stacking context's background, so instead of dimming
       the world it dimmed every sheet by 52% black — #241b45 rendering as
       #150e2e, which is why the editor read as a dark hole. */
    const scrim = await pg.evaluate(()=>{
      $('editor').classList.add('open');
      const ed=$('editor');
      const before=getComputedStyle(ed,'::before');
      const sc=$('scrim');
      const alpha=c=>{const m=/rgba?\(([^)]+)\)/.exec(c);
        if(!m)return 0; const p=m[1].split(',');
        return p.length>3?parseFloat(p[3]):1;};
      return { sheetPseudoPaints:alpha(before.backgroundColor)>0.02,
               hasScrim:!!sc,
               scrimShown:sc?+getComputedStyle(sc).opacity:0,
               scrimZ:sc?+getComputedStyle(sc).zIndex:0,
               sheetZ:+getComputedStyle(ed).zIndex,
               scrimInSheet:!!(sc&&sc.closest('.sheet')) };
    });
    ck(`${W}x${H} the scrim dims the world, not the sheet`,
       !scrim.sheetPseudoPaints && scrim.hasScrim && scrim.scrimShown>0.9 &&
       !scrim.scrimInSheet && scrim.scrimZ<scrim.sheetZ, scrim);

    /* Shrink/expand resizes the screen, so it is chrome. It used to sit in
       the Blocks tab's tool row, and a challenge opens maximised on the
       Board tab — where that row is not rendered — so from the first
       screen you land on there was no way to shrink the sheet at all. */
    const mini = await pg.evaluate(async ()=>{
      const ed=$('editor'), m=$('edMax');
      const vis=e=>!!(e&&e.offsetParent);
      const top=()=>Math.round(ed.getBoundingClientRect().top/innerHeight*100);
      academyEnter(0);
      await new Promise(r=>setTimeout(r,600));
      /* it no longer matters which size a challenge opens at — that follows
         the player's preference now — only that the control is reachable
         from the Board tab and moves between the two sizes. */
      const onBoard={inHeader:!!m.closest('.v5-head'), shown:vis(m), start:top()};
      m.click(); await new Promise(r=>setTimeout(r,450));
      const other=top();
      m.click(); await new Promise(r=>setTimeout(r,450));
      const back=top();
      setTab('blocks'); renderPalette();
      await new Promise(r=>setTimeout(r,300));
      return { onBoard, other, back, shownOnBlocks:vis(m),
               size:(()=>{const r=m.getBoundingClientRect();
                         return r.width>=40&&r.height>=40;})() };
    });
    const sizes2=[mini.onBoard.start,mini.other].sort((a,b)=>a-b);
    ck(`${W}x${H} the shrink control is in the header and works from any tab`,
       mini.onBoard.inHeader && mini.onBoard.shown && mini.shownOnBlocks && mini.size &&
       sizes2[0]<15 && sizes2[1]>38 && sizes2[1]<55 && mini.back===mini.onBoard.start, mini);
    await pg.evaluate(()=>{ if(mgState)mgExit(false); });
    await pg.waitForTimeout(400);

    /* Shrinking the code sheet then opening the menu used to hand you a
       different height, so the two never agreed on how much of the world
       stayed visible. One state now, mirrored onto body from #editor.max
       so render.js's camera offset and the size a challenge restores stay
       in step. */
    const sizes = await pg.evaluate(async ()=>{
      const ids=['mentor','quests','hub','projects','guide','funcLib','orders','settings'];
      const measure=async()=>{
        const o={};
        for(const id of ids){
          const e=$(id); e.classList.add('open');
          await new Promise(r=>setTimeout(r,40));
          o[id]=Math.round(e.getBoundingClientRect().height/innerHeight*100);
          e.classList.remove('open');
        }
        o.editor=Math.round($('editor').getBoundingClientRect().height/innerHeight*100);
        return o;
      };
      $('editor').classList.add('open');
      if(!$('editor').classList.contains('max'))$('edMax').click();
      await new Promise(r=>setTimeout(r,400));
      const full=await measure();
      $('edMax').click(); await new Promise(r=>setTimeout(r,400));
      const half=await measure();
      /* the control has to work from a page that is not the editor */
      $('editor').classList.remove('open'); hubOpen();
      await new Promise(r=>setTimeout(r,300));
      /* guarded so a missing control fails this check instead of throwing
         and taking the rest of the suite with it */
      const sz=$('hubSize'); if(sz)sz.click();
      await new Promise(r=>setTimeout(r,400));
      const fromMenu={present:!!sz,
                      hub:Math.round($('hub').getBoundingClientRect().height/innerHeight*100),
                      editorMax:$('editor').classList.contains('max')};
      hubClose();
      const missing=ids.filter(id=>!$(id).querySelector('.m-head .iconbtn.size'));
      return {full,half,fromMenu,missing};
    });
    const same=o=>Object.values(o).every(v=>v===Object.values(o)[0]);
    ck(`${W}x${H} every page is the size the code page is`,
       same(sizes.full) && same(sizes.half) &&
       Object.values(sizes.full)[0]>Object.values(sizes.half)[0], sizes);
    ck(`${W}x${H} every page carries the shrink control, and it works from any of them`,
       sizes.missing.length===0 && sizes.fromMenu.present &&
       sizes.fromMenu.hub>80 && sizes.fromMenu.editorMax,
       {missing:sizes.missing,fromMenu:sizes.fromMenu});
    /* the creator check below measures inside an open editor, which is the
       state this block found and has to hand back */
    await pg.evaluate(()=>{ $('editor').classList.add('open'); });
    await pg.waitForTimeout(350);

    /* The size is a preference, not a mode a screen may set. Opening a
       challenge forced full, leaving restored whatever it had been, and
       Exit cleared it — so the choice reset every time you went in and out
       of code. Only the control may change it now. */
    const holds = await pg.evaluate(async ()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const now=()=>$('editor').classList.contains('max');
      const out={};
      for(const want of [false,true]){
        $('editor').classList.add('open'); await wait(200);
        if(now()!==want){$('edMax').click(); await wait(350);}
        out[want?'full':'half']={chose:now()};
        academyEnter(0); await wait(700);
        out[want?'full':'half'].inLesson=now();
        mgExit(true); await wait(600);
        out[want?'full':'half'].afterLesson=now();
        navHome(); await wait(400);
        out[want?'full':'half'].afterExit=now();
      }
      /* and it is saved, so it survives a reload the way sound does */
      saveNow();
      out.inSave=JSON.parse(localStorage.getItem(SAVE_KEY)).sheetFull;
      return out;
    });
    ck(`${W}x${H} the chosen size survives going in and out of code`,
       holds.half.chose===false && holds.half.inLesson===false &&
       holds.half.afterLesson===false && holds.half.afterExit===false &&
       holds.full.chose===true && holds.full.inLesson===true &&
       holds.full.afterLesson===true && holds.full.afterExit===true &&
       holds.inSave===true, holds);

    /* every one of these controls is the same object; only the editor's was
       in the design language's selector list, so the rest fell back to the
       base .iconbtn and came out a different size and shape. */
    const styled = await pg.evaluate(()=>{
      const box=e=>{const c=getComputedStyle(e);
        return [c.width,c.height,c.borderRadius,c.backgroundColor].join('|');};
      const ref=box($('edMax'));
      return [...document.querySelectorAll('.m-head .iconbtn.size')]
        .filter(e=>box(e)!==ref)
        .map(e=>(e.closest('.sheet,#shop')||{}).id+': '+box(e)+'  vs  '+ref);
    });
    ck(`${W}x${H} every shrink control is styled the same`, styled.length===0, styled);
    await pg.evaluate(()=>{ $('editor').classList.add('open'); });
    await pg.waitForTimeout(350);

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

    // ---------------------------------------------- the status pill is one line
    /* The corner used to hold two objects on three rows, 105px of map. It is
       one 42px pill now, market handle included. What is worth protecting is
       the shape, not the pixel: one object, one row, and the handle inside
       the pill rather than hanging off the end of it — which is exactly what
       it did until #stats stopped reserving room for a tool column that
       #topbar's own padding already reserves. */
    const pill = await pg.evaluate(async () => {
      if (typeof mgState !== 'undefined' && mgState) mgExit(false);
      document.querySelectorAll('.sheet.open').forEach(x => x.classList.remove('open'));
      coins = 1234; player.level = 7; R().energy = 100; updateHud();
      market.order = { need:{wood:6}, got:{}, until: now + 94000, reward: 40, shape:'spread' };
      if (typeof renderMarket === 'function') renderMarket();
      await new Promise(r => setTimeout(r, 400));
      const box = s => { const e = document.querySelector(s); if (!e) return null;
        const r = e.getBoundingClientRect();
        return { l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height) }; };
      const st = document.getElementById('stats');
      const kids = [...st.children].filter(e => e.offsetParent);
      const bx = kids.map(e => e.getBoundingClientRect());
      return {
        inPill: (document.getElementById('ticker') || {}).parentNode === st,
        /* one row means every chip overlaps every other vertically; comparing
           tops alone counts chips of different heights as separate rows */
        oneRow: bx.every(a => bx.every(c => a.top < c.bottom && c.top < a.bottom)),
        stats: box('#stats'), ticker: box('#ticker'),
        handleH: (box('#ticker .tk-btn') || {}).h,
        tools: box('#tbBtns'),
        bag: (document.getElementById('bagEl') || {}).textContent,
        /* the market handle and the order clock are two buttons, not two
           halves of one — they open different screens */
        buttons: document.querySelectorAll('#ticker button').length,
        ordH: (box('#ticker .tk-ord') || {}).h,
        gap: (() => { const a = document.querySelector('#ticker .tk-btn'),
                            c = document.querySelector('#ticker .tk-ord');
          return (a && c) ? Math.round(c.getBoundingClientRect().left -
                                       a.getBoundingClientRect().right) : null; })(),
        fills: [...document.querySelectorAll('#ticker button')]
          .map(e => getComputedStyle(e).backgroundColor)
      };
    });
    await pg.waitForTimeout(200);
    ck(`${W}x${H} the status cluster is one object, one row`,
       pill.inPill === true && pill.oneRow === true, pill);
    ck(`${W}x${H} the pill is a single 42px line`, pill.stats.h === 42, pill.stats);
    ck(`${W}x${H} the market handle sits inside the pill, clear of the tools`,
       pill.ticker.r <= pill.stats.r + 1 && pill.ticker.r <= pill.tools.l, pill);
    ck(`${W}x${H} the handle is still a tap target`, pill.handleH >= 32, pill);
    /* One pill-shaped button used to open the price panel on its left and the
       Orders sheet on its right, with nothing on it saying so. */
    ck(`${W}x${H} the market and the order are two separate chips`,
       pill.buttons === 2 && pill.gap >= 3 && pill.ordH >= 32, pill);
    ck(`${W}x${H} and they do not look like one`,
       pill.fills.length === 2 && pill.fills[0] !== pill.fills[1], pill.fills);
    ck(`${W}x${H} the bag chip is a count, not a changing-width preview`,
       /^\d+\/\d+$/.test((pill.bag || '').trim()), pill.bag);

    // ---------------------------------------------- iOS 26 edge glass
    /* Safari 26 samples position:fixed elements near the top and bottom of
       the viewport, folds their backdrop-filter into the system's own Liquid
       Glass, and paints the result across the whole width of that edge — a
       blurred band over the world where the HUD floats. Nothing pinned to an
       edge may carry one. Sheets are exempt: they cover the screen, so there
       is no edge being read through. */
    const glass = await pg.evaluate(() => {
      const EDGE = 90, bad = [];
      for (const e of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(e);
        const bf = cs.backdropFilter || cs.webkitBackdropFilter;
        if (!bf || bf === 'none') continue;
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (r.bottom <= 0 || r.top >= innerHeight) continue;      // parked off-screen
        if (e.closest('.sheet')) continue;
        if (r.top < EDGE || r.bottom > innerHeight - EDGE)
          bad.push((e.id || e.className || e.tagName) + ' ' + bf);
      }
      return bad;
    });
    ck(`${W}x${H} nothing pinned to a screen edge carries a backdrop-filter`,
       glass.length === 0, glass);

    // ---------------------------------------------- one full-size height
    /* Maximise, focus and every other full-size sheet are one height. It was
       a bare 94vh in four places while focus alone also capped itself
       against the safe area, so on a notched phone the two landed a dozen
       pixels apart and the sheet visibly twitched between them. The inset is
       simulated: a desktop Chromium reports none. */
    const heights = await pg.evaluate(async () => {
      const root = document.documentElement, was = root.style.getPropertyValue('--sat');
      const h = s => { const e = document.querySelector(s);
        return e ? Math.round(e.getBoundingClientRect().height) : null; };
      const ed = $('editor'), out = {};
      for (const inset of [0, 62]) {
        root.style.setProperty('--sat', inset + 'px');
        ed.className = 'sheet open'; setTab('blocks'); renderPalette();
        await new Promise(r => setTimeout(r, 300));
        ed.classList.add('max');
        await new Promise(r => setTimeout(r, 350));
        const max = h('#editor');
        ed.classList.remove('max'); ed.classList.add('focused');
        await new Promise(r => setTimeout(r, 350));
        const focused = h('#editor');
        /* nav.js mirrors #editor.max onto body.sheets-full, so the editor
           stays maximised while another sheet is measured */
        ed.classList.remove('focused'); ed.classList.add('max');
        document.body.classList.add('sheets-full');
        $('shop').classList.add('open');
        await new Promise(r => setTimeout(r, 350));
        const shop = h('#shop');
        $('shop').classList.remove('open'); ed.classList.remove('max');
        out[inset] = { max, focused, shop };
      }
      root.style.setProperty('--sat', was);
      ed.className = 'sheet';
      await new Promise(r => setTimeout(r, 300));
      return out;
    });
    await pg.waitForTimeout(300);
    const oneHeight = o => o.max === o.focused && o.max === o.shop;
    ck(`${W}x${H} maximise, focus and the other sheets are one height`,
       oneHeight(heights[0]) && oneHeight(heights[62]), heights);
    ck(`${W}x${H} and that height gets out of the safe area's way`,
       heights[62].max < heights[0].max, heights);

    // ---------------------------------------------- focus: blocks only
    /* Making the sheet taller only ever bought a little room: the rows above
       the program and the run bar below it keep their height whatever the
       sheet does. Focus drops them, so the two things you edit with — the
       program and the palette — get the screen. */
    const focus = await pg.evaluate(async () => {
      if (mgState) mgExit(false);
      $('editor').classList.remove('focused');
      $('editor').classList.add('open');
      setTab('blocks'); renderPalette();
      await new Promise(r => setTimeout(r, 400));
      const h = s => { const e = document.querySelector(s); if (!e) return null;
        const r = e.getBoundingClientRect(); return r.height < 1 ? 0 : Math.round(r.height); };
      const x = s => { const e = document.querySelector(s);
        return (e && e.offsetParent) ? Math.round(e.getBoundingClientRect().left) : null; };
      const snap = () => ({ program:h('#programWrap'), palette:h('#palette'),
        tabs:h('#tabs'), bar:h('#actionBar'), row:h('#blocksTab .v5-edrow'),
        head:h('#editor .v5-head'), sheet:h('#editor'),
        btn:!!($('edFocus')||{}).offsetParent, vh:innerHeight,
        xFocus:x('#edFocus'), xMax:x('#edMax'), xClose:x('#edClose') });
      const before = snap();
      $('edFocus').click();
      await new Promise(r => setTimeout(r, 450));
      const on = snap();
      $('edFocus').click();
      await new Promise(r => setTimeout(r, 450));
      const off = snap();
      $('editor').classList.remove('open');
      return { before, on, off };
    });
    await pg.waitForTimeout(400);
    /* The promise is not a ratio — the sheet may already be large — it is
       that the blocks get everything the sheet has apart from its header. */
    const area = s => s.program + s.palette;
    ck(`${W}x${H} focus gives the blocks all of the sheet but its header`,
       area(focus.on) >= focus.on.sheet - focus.on.head - 14 &&
       area(focus.on) > area(focus.before),
       { on:area(focus.on), sheet:focus.on.sheet, head:focus.on.head,
         before:area(focus.before) });

    /* Turning the mode on must not move a header control sideways. Hiding
       all of the header but the one button sent that button from the left of
       the row to the right — a control changing sides at the moment you are
       about to press it again — and took Back, shrink and exit with it. */
    const heldX = k => focus.before[k] !== null && focus.on[k] !== null &&
                       Math.abs(focus.before[k] - focus.on[k]) <= 2;
    ck(`${W}x${H} no header control moves or vanishes when focus turns on`,
       heldX('xFocus') && heldX('xMax') && heldX('xClose'),
       { before:[focus.before.xFocus, focus.before.xMax, focus.before.xClose],
         on:[focus.on.xFocus, focus.on.xMax, focus.on.xClose] });
    ck(`${W}x${H} focus keeps the program AND the palette`,
       focus.on.program > 0 && focus.on.palette > 0, focus.on);
    ck(`${W}x${H} focus hides the rows that are not the program`,
       focus.on.tabs === 0 && focus.on.bar === 0 && focus.on.row === 0, focus.on);
    ck(`${W}x${H} but keeps the header it needs to get back`,
       focus.on.head > 0, focus.on);
    ck(`${W}x${H} the way back stays on screen`, focus.on.btn, focus.on);
    ck(`${W}x${H} pressing it again restores every row`,
       JSON.stringify(focus.off) === JSON.stringify(focus.before), focus);

    /* Focus used to be 100vh. The sheet is anchored to the bottom, so that
       started it at y=0 — behind the status bar, where iOS dims and the
       button that turns focus off is hard to see and hard to press. The
       inset is simulated: a desktop Chromium reports none. */
    const clears = await pg.evaluate(async () => {
      const root = document.documentElement, was = root.style.getPropertyValue('--sat');
      const read = async inset => {
        root.style.setProperty('--sat', inset + 'px');
        $('editor').classList.add('open', 'focused');
        await new Promise(r => setTimeout(r, 350));
        const btn = $('edFocus').getBoundingClientRect();
        const sheet = $('editor').getBoundingClientRect();
        return { inset, btnTop: Math.round(btn.top), sheetH: Math.round(sheet.height) };
      };
      const flat = await read(0), notch = await read(62);
      root.style.setProperty('--sat', was);
      $('editor').classList.remove('focused', 'open');
      await new Promise(r => setTimeout(r, 300));
      return { flat, notch, vh: innerHeight };
    });
    await pg.waitForTimeout(300);
    ck(`${W}x${H} focus keeps its button clear of the status bar`,
       clears.notch.btnTop >= 62 && clears.flat.btnTop >= 0, clears);
    ck(`${W}x${H} focus is no taller than the other full-size sheets`,
       clears.flat.sheetH <= Math.round(clears.vh * 0.945), clears);

    /* Focus hides Back, the tabs and Run, so leaving it on when the editor
       closes would drop the player into a screen they did not choose. */
    const sticky = await pg.evaluate(async () => {
      $('editor').classList.add('open');
      await new Promise(r => setTimeout(r, 250));
      $('edFocus').click();
      await new Promise(r => setTimeout(r, 250));
      const during = $('editor').classList.contains('focused');
      $('editor').classList.remove('open');
      await new Promise(r => setTimeout(r, 250));
      return { during, after: $('editor').classList.contains('focused') };
    });
    await pg.waitForTimeout(400);
    ck(`${W}x${H} focus does not survive closing the editor`,
       sticky.during && !sticky.after, sticky);

    /* Content past the bottom of a fixed-height sheet has to be reachable.
       Both of these were laid out as plain flex children with no scroller,
       so the maker overflowed its own height by 59px and the Save button
       was what fell off the end. A sheet may not clip: whatever does not
       fit belongs to a body that scrolls. */
    const clipped = await pg.evaluate(async () => {
      const out = [];
      for (const [id, open] of [['style', () => styleOpen()], ['maker', () => makerOpen('hat', null)]]) {
        if (typeof window[id === 'style' ? 'styleOpen' : 'makerOpen'] !== 'function') continue;
        document.querySelectorAll('.sheet.open').forEach(x => x.classList.remove('open'));
        player.level = 20; player.myWear = [];
        open();
        await new Promise(r => setTimeout(r, 300));
        const sh = document.getElementById(id);
        const body = document.getElementById(id + 'Body');
        const scrolls = body && body.scrollHeight > body.clientHeight
          ? getComputedStyle(body).overflowY !== 'visible' : true;
        if (sh.scrollHeight > sh.clientHeight + 1 || !scrolls)
          out.push(id + ' sheet=' + sh.scrollHeight + '/' + sh.clientHeight +
                   ' body=' + (body ? body.scrollHeight + '/' + body.clientHeight : '?') +
                   ' scrolls=' + scrolls);
      }
      document.querySelectorAll('.sheet.open').forEach(x => x.classList.remove('open'));
      return out;
    });
    await pg.waitForTimeout(300);
    ck(`${W}x${H} no sheet clips content it cannot scroll to`, clipped.length===0, clipped);

    await pg.close();
  }

  console.log('  404s:', bad.length?bad.join(', '):'none');
  ck('no console errors', errs.length===0, errs.slice(0,3));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();

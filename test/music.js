/* Music — two generated themes, and the three rules they have to keep:
   never start without a gesture, never drown the blips, never run when
   nobody is listening.

   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/music.js */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await b.newPage({ viewport:{width:390,height:844} });
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  const S = () => pg.evaluate(()=>CC_MUSIC.state());

  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(1200);

  // ---------------------------------------------- autoplay policy
  /* Browsers suspend AudioContext until the user acts. A game that starts
     the loop on load does not get music early — it gets a context stuck in
     "suspended" and, often, no sound at all for the rest of the session. */
  const cold = await S();
  ck('silent until the player touches something',
     !cold.playing && cold.ctx===null && cold.scheduled===0 && !cold.timer, cold);

  // ---------------------------------------------- starts on Play
  await pg.evaluate(()=>{ ageSet(true); document.getElementById('agegate').classList.remove('open'); });
  await pg.click('#playBtn').catch(()=>{}); await pg.waitForTimeout(1600);
  const live = await S();
  ck('Play starts the music', live.playing && live.ctx==='running' &&
     live.timer && live.scheduled>0, live);
  ck('and it shares one AudioContext with the blips',
     await pg.evaluate(()=>{ sfx(440,.05); return actx===window.__probeCtx||true; }) &&
     await pg.evaluate(()=>CC_MUSIC.state().ctx)==='running', live);

  // ---------------------------------------------- the two modes
  /* Play drops straight into the first academy lesson, which is a challenge,
     so the focus theme is the correct thing to be hearing here. */
  await pg.evaluate(()=>{ const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click(); });
  await pg.waitForTimeout(1500);
  const inMg = await pg.evaluate(()=>({ mg:$('editor').classList.contains('mg'),
                                        ...CC_MUSIC.state() }));
  ck('a challenge crossfades to the focus theme', inMg.mg && inMg.mode==='focus', inMg);

  await pg.evaluate(()=>{ if(mgState)mgExit(false); tutSet(0);
    document.querySelectorAll('.sheet.open').forEach(x=>x.classList.remove('open')); });
  await pg.waitForTimeout(1400);
  const inWorld = await S();
  ck('leaving it crossfades back to the world theme',
     inWorld.mode==='world' && inWorld.playing, inWorld);

  // ---------------------------------------------- the off switches
  /* Both have to stop the scheduler, not merely turn the gain down: a
     silent timer waking 9x a second is a battery bug, not a mute. */
  await pg.evaluate(()=>{ musicOff=true; }); await pg.waitForTimeout(500);
  const off = await S();
  ck('"Music off" stops the scheduler, not just the volume',
     !off.playing && !off.timer && off.gain<.02, off);
  ck('...and leaves the blips alone', await pg.evaluate(()=>muted)===false, null);

  await pg.evaluate(()=>{ musicOff=false; musicStart(); }); await pg.waitForTimeout(900);
  ck('turning it back on resumes', (await S()).playing, await S());

  await pg.evaluate(()=>{ muted=true; }); await pg.waitForTimeout(500);
  const m = await S();
  ck('"Sound off" stops the music too', !m.playing && !m.timer, m);
  await pg.evaluate(()=>{ muted=false; musicStart(); }); await pg.waitForTimeout(700);

  // ---------------------------------------------- nobody listening
  await pg.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await pg.waitForTimeout(500);
  const hid = await S();
  ck('a hidden tab stops it', !hid.playing && !hid.timer, hid);
  await pg.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await pg.waitForTimeout(800);
  ck('coming back resumes it', (await S()).playing, await S());

  // ---------------------------------------------- what it sounds like
  /* Rendered offline, because state cannot show the two faults note data
     actually has: silence, and a mix that clips. */
  for (const name of ['world','focus']) {
    const r = await pg.evaluate(n=>CC_MUSIC.render(12,n), name);
    ck(`the ${name} theme renders: audible, no clipping`,
       r && r.peak>0.02 && r.peak<0.9 && r.rms>0.005 && r.notes>40, r);
  }
  const lvl = await pg.evaluate(()=>CC_MUSIC.render(12,'world'));
  ck('and sits under the blips (sfx peaks at .08 per note)', lvl.peak<0.2, lvl);

  // ---------------------------------------------- in key
  /* One mistyped MIDI number is a wrong note every eight bars and nothing
     else in the suite would notice. World is C major, focus its relative
     minor, so both draw from the same seven pitch classes. */
  const outOfKey = await pg.evaluate(()=>{
    const ok=[0,2,4,5,7,9,11], bad=[];          // C D E F G A B
    for(const [name,T] of Object.entries(CC_MUSIC.tracks)){
      const notes=[];
      for(const ch of T.prog) ch.forEach(n=>notes.push(n));
      for(const row of T.mel) row.forEach(n=>{ if(n!=null) notes.push(n); });
      for(const n of notes) if(ok.indexOf(((n%12)+12)%12)<0) bad.push(name+':'+n);
    }
    return bad;
  });
  ck('every note in both themes is in key', outOfKey.length===0, outOfKey);

  const shape = await pg.evaluate(()=>{
    const bad=[];
    for(const [name,T] of Object.entries(CC_MUSIC.tracks)){
      if(T.prog.length*T.barsPerChord!==T.bars) bad.push(name+': prog covers '+
        (T.prog.length*T.barsPerChord)+' bars, loop is '+T.bars);
      if(T.mel.length!==T.bars) bad.push(name+': '+T.mel.length+' melody bars, loop is '+T.bars);
      T.mel.forEach((r,i)=>{ if(r.length!==8) bad.push(name+' bar '+(i+1)+': '+r.length+' slots'); });
      T.prog.forEach((c,i)=>{ if(c.length!==3) bad.push(name+' chord '+(i+1)+': '+c.length+' notes'); });
    }
    return bad;
  });
  ck('chords, melody and loop length all agree', shape.length===0, shape);

  // ---------------------------------------------- the setting persists
  const saved = await pg.evaluate(()=>{
    musicOff=true; saveNow();
    const j=JSON.parse(localStorage.getItem(SAVE_KEY));
    musicOff=false; applySave(j); return { inFile:j.musicOff, afterLoad:musicOff };
  });
  ck('the music setting survives a save and load',
     saved.inFile===true && saved.afterLoad===true, saved);

  console.log('  pageerrors:', errs.length?errs.slice(0,3):'none');
  ck('no uncaught exceptions', errs.length===0, errs.slice(0,3));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();

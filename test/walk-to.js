/* 🚶 Walk To on a challenge board: name WHERE, not how.
   The engine is checked on real levels, then the things that decide
   whether it is safe to have at all — that no level which already exists
   gains it, that an author chooses where it may go, and that the choice
   survives saving and publishing.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/walk-to.js */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LAUNCH = fs.existsSync(CHROME) ? { executablePath: CHROME } : {};
const APP = 'file://' + path.join(ROOT, 'index.html');

let pass = 0, fail = 0;
const ck = (n, ok, d) => { ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + n + (ok ? '' : ' — ' + JSON.stringify(d))); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch(LAUNCH);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(APP); await wait(1100);
  await pg.selectOption('#ageMonth', '6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
  await pg.click('#ageGo'); await wait(400);
  await pg.evaluate(() => $('playBtn').click()); await wait(1500);
  await pg.evaluate(() => { const c = document.querySelector('#ccCele .cc-cta'); if (c) c.click(); });
  await wait(300);

  /* A run driven by hand, tick by tick, with the win captured rather than
     celebrated (the celebration tears the board down). */
  await pg.evaluate(() => {
    window.__run = (stage, prog, extra) => {
      const p = JSON.parse(JSON.stringify(stage)); p.id = 'walkto_' + Math.random();
      Object.assign(p, extra || {});
      const origSI = window.setInterval; window.setInterval = () => 0;
      const origS = mgSuccess; let won = false; mgSuccess = () => { won = true; mgStop(); };
      mgEnter(p); applyProg(mgRobot, prog); mgRun();
      const trail = [], dirs = [];
      let t = 0;
      for (; t < 700 && mgState && mgState.running; t++) {
        mgTick(); if (mgState) { trail.push(mgState.robot.x + ',' + mgState.robot.y); dirs.push(mgState.robot.dir); }
      }
      const r = { won, ticks: t, at: mgState ? [mgState.robot.x, mgState.robot.y, mgState.robot.dir] : null, trail, dirs };
      mgSuccess = origS; window.setInterval = origSI;
      if (mgState) mgExit(false);
      return r;
    };
    window.__g = o => ({ t: 'goNear', opt: o });
    window.__E = PUZZLE_PACKS.find(p => p.id === 'errands').stages;
  });

  console.log('▶ it walks, by the board’s own rules');
  const E = await pg.evaluate(() => {
    const r = {};
    __E.forEach((s, i) => r[i] = __run(s, s.sol));
    return r;
  });
  ck('every Errands level is solved by its stored solution',
    Object.values(E).every(x => x.won), Object.fromEntries(Object.entries(E).map(([k, v]) => [k, v.won])));

  const R = await pg.evaluate(() => {
    const open = { gw: 6, gh: 3, start: { x: 0, y: 1, dir: 1 }, cells: [], initial: [], tiles: [],
      goal: [5, 1], goalType: 'reach', maxBlocks: 9, allowed: ['move', 'turnL', 'turnR', 'goNear'], goTargets: ['flag'] };
    const walled = Object.assign({}, open, { tiles: [[2, 0, 'wall', 0], [2, 1, 'wall', 0]] });
    return {
      straight: __run(open, [__g('flag'), { t: 'turnL' }]),
      around: __run(walled, [__g('flag')]),
      noKey: __run(__E[0], [__g('flag')]),
      goesOn: __run(__E[0], [__g('flag'), __g('key'), __g('flag')]),
      plate: __run(__E[3], [__g('plate'), __g('flag')]),
      notHers: __run(__E[0], [__g('door'), __g('key'), __g('flag')]),
      // the same level with its key taken away, so none is picked up on the way
      door: __run(__E[0], [__g('door')], { goTargets: ['door'], tiles: __E[0].tiles.filter(t => t[2] !== 'key') })
    };
  });
  /* one tile a tick: five tiles is five ticks, and the tick that arrives
     is the tick that ends it */
  ck('it walks one tile a tick, and arriving is the last of them',
    R.straight.trail.slice(0, 5).join(' ') === '1,1 2,1 3,1 4,1 5,1' &&
    R.straight.dirs[4] === 1 && R.straight.dirs[5] === 0, R.straight);
  ck('it finds its own way round a wall', R.around.won && R.around.trail.length > 5, R.around);
  ck('a shut door stops it like anyone else — no key, no flag',
    !R.noKey.won && R.noKey.at[0] === 0, R.noKey);
  ck('nowhere it can reach is a bump, and the program goes on',
    R.goesOn.won === true, R.goesOn);
  /* the gate opens while the robot stands on the plate, and shuts the
     moment it steps off — Walk To plans again every step, so it stops
     rather than walking through a gate that is no longer open */
  ck('a gate that closes behind a plate stops it honestly',
    !R.plate.won && R.plate.at[0] < 5, R.plate);
  /* 🚪 is not one of this level's places: that block must not move the
     robot at all — the first tick is spent where it started — and the
     program still goes on to win */
  ck('a destination this level did not hand out does nothing',
    R.notHers.won === true && R.notHers.trail[0] === '0,2', R.notHers.trail.slice(0, 3));
  ck('a place it cannot stand on is reached by stopping next to it, facing it',
    R.door.at[0] === 4 && R.door.at[1] === 2 && R.door.at[2] === 1, R.door);

  console.log('▶ no level that already exists gains it');
  const D = await pg.evaluate(() => {
    const has = a => (a || []).indexOf('goNear') >= 0;
    const packs = PUZZLE_PACKS.filter(p => p.id !== 'errands');
    return {
      projects: PROJECTS.filter(p => has(p.allowed)).map(p => p.id),
      chapters: packs.flatMap(p => p.stages.filter(s => has(s.allowed)).map(s => p.id + ':' + s.name)),
      academy: TUTS.filter(t => has(t.allowed)).map(t => t.id),
      creator: has(CREATOR_BLOCKS), challenge: has(CHALLENGE_BLOCKS),
      community: has(ccToProj({ id: 1, name: 'x', max_blocks: 9, gw: 5, gh: 5, start_x: 0, start_y: 0, start_dir: 1,
        cells: [], initial: [], author_name: 'a' }).allowed),
      errands: __E.every(s => has(s.allowed) && (s.goTargets || []).length > 0)
    };
  });
  ck('no build project, chapter, lesson or community level hands it out',
    !D.projects.length && !D.chapters.length && !D.academy.length && !D.community, D);
  ck('and a new design does not start with it', D.creator === false && D.challenge === false, D);
  ck('only the Errands levels do, each with its own destinations', D.errands === true, D);

  console.log('▶ the player names only what the level allows');
  const P = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const s = JSON.parse(JSON.stringify(__E[0])); s.id = 'walkto_ed';
    mgEnter(s); setTab('blocks'); await wait(200);
    const pal = [...document.querySelectorAll('#palette .pblk')].map(x => x.dataset.t);
    document.querySelector('#palette .pblk[data-t="goNear"]').click(); await wait(100);
    const first = mgRobot.program[0].opt;
    const seen = [first];
    for (let i = 0; i < 4; i++) {
      document.querySelector('#programEl .pbtn[data-p="tgt"]').click(); await wait(60);
      seen.push(mgRobot.program[0].opt);
    }
    const noVar = !document.querySelector('#programEl .pbtn[data-p="tmode"]');
    renderPy(); const py = $('pyCode').textContent;
    mgExit(false);
    return { pal, first, seen, noVar, py };
  });
  ck('the level’s palette carries Walk To', P.pal.indexOf('goNear') >= 0, P.pal);
  ck('a new Walk To starts on the first place the level allows', P.first === 'key', P);
  ck('and tapping it cycles through only those places',
    P.seen.every(x => x === 'key' || x === 'flag') && P.seen.indexOf('flag') > 0, P.seen);
  ck('there is no "wherever a variable says" on a board', P.noVar === true, P);
  ck('the Python says what the block does', /robot\.walk_to_nearest\("key"\)/.test(P.py), P.py);

  console.log('▶ the author chooses, and the choice is kept');
  const C = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (mgState) mgExit(false);
    document.querySelectorAll('.sheet.open').forEach(x => x.classList.remove('open'));
    mgEnterCreator(); await wait(500);
    const p = mgState.proj;
    p.cells = [[3, 2], [4, 2]]; p.tiles = [[1, 1, 'key', 1], [5, 3, 'door', 1]];
    setTab('design'); mgCreatorUI(); await wait(200);
    const row = () => $('mgBlocks').querySelector('[data-blk="goNear"]');
    const out = { listed: !!row(), offAtFirst: !row().classList.contains('on'), noPickYet: !$('mgGoPick') };
    row().click(); await wait(150);
    const chips = () => [...document.querySelectorAll('#mgGoPick .t3chip')];
    out.defaults = p.goTargets.slice();
    out.chips = chips().map(c => c.dataset.go + (c.classList.contains('on') ? '+' : '-'));
    out.underItsRow = !!$('mgGoPick') && $('mgGoPick').previousElementSibling === row();
    // take all but one away; the last one refuses
    for (const k of ['key', 'door']) { const c = chips().find(c => c.dataset.go === k); if (c) c.click(); await wait(60); }
    out.one = p.goTargets.slice();
    chips().find(c => c.dataset.go === 'target').click(); await wait(60);
    out.lastStays = p.goTargets.slice();
    chips().find(c => c.dataset.go === 'block').click(); await wait(60);
    out.added = p.goTargets.slice();
    out.unproven = mgState.solved === false;
    // kept: in a banked level, and in My Challenges
    const snap = snapshotStage(p);
    out.snap = { allowed: (snap.allowed || []).indexOf('goNear') >= 0, go: snap.goTargets };
    // published: a level that hands it out goes up as a one-level pack whose
    // level carries the choice, since a single row has no column for it
    const sent = [];
    const keep = { sbRest: window.sbRest, askNick: window.askNick, nameOk: window.nameOk };
    window.sbRest = async (u, o) => { sent.push({ u, body: JSON.parse(o.body) }); return []; };
    window.askNick = () => true; window.nameOk = () => null;
    p.name = 'Walk test';
    mgState.solved = true;
    await publishChallenge(); await wait(100);
    Object.assign(window, keep);
    const body = sent.length && sent[0].body;
    out.pub = body ? { stages: (body.stages || []).length,
      allowed: body.stages && body.stages[0] && (body.stages[0].allowed || []).indexOf('goNear') >= 0,
      go: body.stages && body.stages[0] && body.stages[0].goTargets } : null;
    if (mgState) mgExit(false);
    return out;
  });
  ck('the Design tab lists Walk To, off until the author hands it out',
    C.listed && C.offAtFirst && C.noPickYet, C);
  ck('handing it out offers the places, starting with what the board has',
    JSON.stringify(C.defaults) === '["target","key","door"]' &&
    C.chips.join(' ') === 'target+ block- key+ door+ plate-', C);
  ck('the choice sits right under the Walk To row', C.underItsRow === true, C);
  ck('the last place cannot be taken away', JSON.stringify(C.one) === '["target"]' &&
    JSON.stringify(C.lastStays) === '["target"]', C);
  ck('and changing it means the level has to be proven again', C.unproven === true, C);
  ck('a banked level keeps it', C.snap.allowed && JSON.stringify(C.snap.go) === JSON.stringify(C.added), C.snap);
  ck('a published level keeps it, as a one-level pack',
    !!C.pub && C.pub.stages === 1 && C.pub.allowed && JSON.stringify(C.pub.go) === JSON.stringify(C.added), C.pub);

  console.log('▶ in Hebrew');
  const H = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    lang = 'he'; i18nApply(); await wait(200);
    const s = JSON.parse(JSON.stringify(__E[0])); s.id = 'walkto_he';
    mgEnter(s); setTab('blocks'); await wait(200);
    document.querySelector('#palette .pblk[data-t="goNear"]').click(); await wait(400);
    const btn = document.querySelector('#programEl .pbtn[data-p="tgt"]');
    const goal = $('mgGoal');
    const out = { word: btn.textContent.trim(), icon: !!btn.querySelector('.ui-emoji'),
      goalIcons: goal.querySelectorAll('.ui-emoji').length, goalHe: /[֐-׿]/.test(goal.textContent) };
    mgExit(false); lang = 'en'; i18nApply(); await wait(200);
    return out;
  });
  ck('the place is named in Hebrew and keeps its icon', H.word === 'מפתח' && H.icon, H);
  ck('the level text keeps the flag and key it names mid-sentence', H.goalHe && H.goalIcons >= 3, H);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();

/* Python you can type (js/game/pyparse.js, js/game/pyedit.js).
   The 🐍 tab is an editor: text is read into blocks. Three things have to
   hold for that to be safe to hand a child:
     1. nothing is lost — every program the game can hold goes
        blocks → Python → blocks and comes back the same program;
     2. a mistake is answered — with a sentence about that line, in the
        player's language, and never by quietly running something else;
     3. a level's rules survive the keyboard — what its author kept back
        cannot be typed in.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/python.js */
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

/* [where, text, the message it should get, on which line]
   where: w = a new world (nothing unlocked), u = everything unlocked,
          l = Puzzle Chapters › Maze 4 (Move, Turn, Repeat, Forever, If) */
const WRONG = [
  ['u', 'robot.jupm()', 'unknownMethodSug', 1], ['u', 'robot.fly()', 'unknownMethod', 1],
  ['u', 'robot.chop', 'needParens', 1], ['u', 'chop()', 'needRobot', 1], ['u', 'robot.chop(3)', 'noArgs', 1],
  ['u', 'robot.walk_to(tree2)', null, 0],                       // a variable: allowed once variables are
  ['w', 'robot.walk_to(tree)', 'needPlace', 1], ['u', 'robot.walk_to("tre")', 'unknownPlace', 1],
  ['u', 'robot.rest("a")', 'needNumber', 1], ['u', 'robot.rest(200)', 'numRange', 1], ['u', 'robot.rest(2, 3)', 'shape', 1],
  ['u', 'robot.chop()\nfor i in range(3):\nrobot.chop()', 'bodyIndent', 3], ['u', 'for i in range(3):', 'bodyNone', 1],
  ['u', 'for i in range(3)\n    robot.chop()', 'colon', 1], ['u', 'robot.chop()\n    robot.chop()', 'indentExtra', 2],
  ['u', '    robot.chop()', 'indentFirst', 1], ['u', 'for i in range(2):\n        robot.chop()\n    robot.chop()', 'indentOff', 3],
  ['u', 'for i in range(3): robot.chop()', 'afterColon', 1], ['u', 'for i in 3:\n    robot.chop()', 'forRange', 1],
  ['u', 'robot.move();', 'semicolon', 1], ['u', '// hello', 'slashComment', 1], ['u', 'robot.say("hi', 'strOpen', 1],
  ['u', 'robot.chop(', 'parenOpen', 1], ['u', 'robot.chop())', 'parenExtra', 1], ['u', 'שלום = 5', 'nameLetters', 1],
  ['u', 'robot.chop() {', 'braces', 1], ['u', 'import math', 'notYet', 1], ['u', 'robot.lift()', 'boardOnly', 1],
  ['u', 'robot.sees("tree")', 'questionAlone', 1], ['u', 'robot.read()', 'readingAlone', 1], ['u', 'hello', 'unknownStmt', 1],
  ['u', 'robot.chop() robot.chop()', 'trailing', 1], ['u', 'else:\n    robot.chop()', 'elseAlone', 1],
  ['u', 'x = y * 2', 'mathNo', 1], ['u', 'x = x - y', 'subVar', 1], ['u', 'x = a + b + c', 'mathLong', 1],
  ['u', 'x = "a" + "b"', 'mathText', 1], ['u', 'a, b = 3', 'multiAssign', 1], ['u', 'x = robot.is_blocked()', 'boxQuestion', 1],
  ['u', 'verylongname1 = 3', 'nameLong', 1], ['u', 'x = robot.red()', 'unknownMethodSug', 1], ['u', 'x = market.price("gold")', 'unknownPlace', 1],
  ['u', 'if x = 3:\n    robot.chop()', 'condAssign', 1], ['u', 'if x >= 3:\n    robot.chop()', 'condOpHint', 1],
  ['u', 'if x > 3 and y < 2:\n    robot.chop()', 'condAndOr', 1], ['u', 'if not x == 3:\n    robot.chop()', 'condNotNum', 1],
  ['u', 'if True:\n    robot.chop()', 'condAlways', 1], ['u', 'if x == "a":\n    robot.chop()', 'condText', 1],
  ['u', 'if robot.sees("dragon"):\n    robot.chop()', 'unknownThing', 1], ['u', 'if robot.is_bloked():\n    robot.chop()', 'unknownQuestionSug', 1],
  ['u', 'if robot.chop():\n    robot.chop()', 'actionAsQuestion', 1], ['u', 'if:\n    robot.chop()', 'condNone', 1],
  ['u', 'for i in range(3):\n    robot.say(i)', 'loopVar', 1], ['u', 'for i in range(2, 5):\n    robot.chop()', 'rangeStart', 1],
  ['u', 'for i in range(1, n):\n    robot.chop()', 'rangeNum', 1], ['u', 'def helper():\n    robot.chop()', 'defName', 1],
  ['u', 'robot.chop()\ndef routine_a():\n    robot.chop()\ndef routine_a():\n    robot.chop()', 'defTwice', 4],
  ['u', 'routine_a()', 'callUndefined', 1], ['u', 'def routine_a(a, b):\n    return a\nx = routine_a(1)', 'callShape', 3],
  ['u', 'foo()', 'unknownFunc', 1], ['u', 'robot.say("' + 'a'.repeat(31) + '")', 'strLong', 1],
  ['u', 'team.tell("gold")', 'unknownPlace', 1], ['u', 'robot.build("house")', 'unknownPlace', 1], ['u', 'x *= 2', 'mathNo', 1],
  // progression: the world's locks hold
  ['w', 'for i in range(3):\n    robot.chop()', 'locked', 1], ['w', 'if robot.sees("tree"):\n    robot.chop()', 'locked', 1],
  ['w', 'x = 5', 'locked', 1], ['w', 'robot.sell_all()', 'locked', 1], ['w', 'team.tell("tree")', 'locked', 1],
  // a level: what its author kept back cannot be typed in
  ['l', 'robot.walk_to("flag")', 'notHere', 1], ['l', 'robot.build()', 'notHere', 1], ['l', 'x = 5', 'notHere', 1],
  ['l', 'if robot.sees("tree"):\n    robot.move()', 'condNotHere', 1], ['l', 'robot.move()\nrobot.turn_lef()', 'unknownMethodSug', 2],
];
/* the same thing said the way a child might: all of these are programs */
const FINE = [
  ['u', 'robot.walk_to("tree")\nrobot.chop()', 'goNear,chop'],
  ['u', 'robot.walk_to_nearest("tree")', 'goNear'],                           // the name before this one
  ['u', 'if robot.sees("tree"):\n    robot.chop()\nelif robot.sees("rock"):\n    robot.mine()\nelse:\n    robot.rest(3)', 'if[chop]{if[mine]{rest}}'],
  ['u', 'x = 3\nif (x > 2):\n    print(x)', 'setVar,if[say]'],
  ['u', 'x = 1\nx += 1\nx -= 2\ny = x + 2\nz = 2 + 3', 'setVar,changeVar,changeVar,setVar,changeVar,setVar'],
  ['u', 'if 3 < x:\n    robot.chop()\nif robot.is_blocked() == False:\n    robot.chop()', 'if[chop],if[chop]'],
  ['u', 'robot.walk_to(\u201Ctree\u201D)\nrobot.say(\u2018hi\u2019)', 'goNear,say'],   // a phone's curly quotes
  ['u', 'while not (robot.is_blocked()):\n    robot.move()\nwhile True:\n    pass', 'whileLoop[move],forever'],
  ['u', 'def routine_a(n):\n    for _ in range(n):\n        robot.chop()\n    return n, 3\n\na, b = routine_a(4)\nroutine_a(a)', 'call,call'],
  ['u', '# only a note\n\n   # and another', ''],
  ['u', 'for n in range(1, 6):\n    robot.say(n)\nfor i in range(n):\n    robot.chop()', 'countLoop[say],repeat[chop]'],
  ['l', 'while True:\n    if robot.is_blocked():\n        robot.turn_right()\n    else:\n        robot.move()', 'forever[if[turnR]{move}]'],
];

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async (o) => {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    if (o && o.he) await pg.addInitScript(() => { try { localStorage.setItem('codecraft_lang', 'he'); } catch (_) {} });
    await pg.goto(APP); await wait(1100);
    await pg.selectOption('#ageMonth', '6');
    await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
    await pg.click('#ageGo'); await wait(400);
    await pg.evaluate(() => $('playBtn').click()); await wait(2200);
    await pg.evaluate(() => { player.fresh = false; for (let i = 0; i < 6; i++) player.academy[TUTS[i].id] = 1; HELD.length = 0;
      if (mgState) mgExit(false); navHome();
      window.__shape = l => l.map(x => x.t + (x.body && x.body.length ? '[' + __shape(x.body) + ']' : '') + (x.els && x.els.length ? '{' + __shape(x.els) + '}' : '')).join(',');
      /* put the game somewhere a line can be judged: a new world, a world
         with everything unlocked, or a level with a short list of blocks */
      window.__at = where => { if (mgState) mgExit(false);
        for (const k in unlocks) unlocks[k] = where === 'u';
        R().program = []; R().routines = { A: { params: [], body: [] }, B: { params: [], body: [] } };
        if (where === 'l') packEnter(PUZZLE_PACKS[0], 3); }; });
    await wait(300);
    return { pg, errs };
  };
  let { pg, errs } = await open();

  // -------------------------------------------------------- 1. nothing is lost
  console.log('▶ blocks → Python → blocks loses nothing');
  const RT = await pg.evaluate(() => {
    const out = { sols: 0, solBad: [], rand: 0, randBad: [], blocks: 0 };
    const n = l => (l || []).reduce((s, x) => s + 1 + n(x.body) + n(x.els), 0);
    for (const pack of PUZZLE_PACKS) for (let i = 0; i < pack.stages.length; i++) {
      packEnter(pack, i);
      applyProg(mgRobot, pack.stages[i].sol || []);
      const text = pyDoc(mgRobot), p = pyParse(text);
      out.sols++;
      if (!p.ok) out.solBad.push(pack.id + (i + 1) + ': ' + pyErrText(p.err, 'en'));
      else if (pyCanonOf(p) !== pyCanon(mgRobot)) out.solBad.push(pack.id + (i + 1) + ': not the same program');
      mgExit(false);
    }
    /* …and programs nobody wrote: every block type, every field at its
       edges, old save shapes (a bare number, a missing operator, .out, .val) */
    let seed = 20261110; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pick = a => a[Math.floor(rnd() * a.length)], int = (a, z) => a + Math.floor(rnd() * (z - a + 1));
    const NAMES = ['x', 'y', 'n', 'best', 'i', 'count', 'v_2', 'a1'];
    const val = str => { const k = rnd(); return k < .45 ? { k: 'num', n: int(-5, 30) } : k < .8 || !str ? { k: 'var', name: pick(NAMES) }
      : { k: 'str', s: pick(['hi', 'שלום!', 'a "q" b', "it's", 'x\\y', '']) }; };
    const ALL = CONDS.concat(['wallAhead', 'pitAhead', 'doorAhead', 'keyAhead', 'gateAhead', 'onPlate', 'brickHere', 'onTarget', 'holding',
      'canClimb', 'stepDown', 'gapAhead', 'canJump', 'needBrick', 'jammed', 'sealAhead', 'planDone', 'from_another_build']);
    const cond = () => { if (rnd() < .35) { const c = { var: pick(NAMES), op: pick(OPS),
        val: rnd() < .5 ? int(-3, 9) : rnd() < .5 ? { k: 'num', n: int(0, 9) } : { k: 'var', name: pick(NAMES) } };
        if (rnd() < .1) delete c.op; return c; }
      return (rnd() < .3 ? '!' : '') + pick(ALL); };
    const TYPES = Object.keys(DEFS);
    const gen = depth => { const list = [];
      for (let k = int(0, depth > 2 ? 2 : 4); k > 0; k--) {
        const t = pick(TYPES), x = newBlock(t);
        if (t === 'rest' || t === 'wait') x.n = int(1, 99);
        if (t === 'build') x.opt = pick(BUILDS);
        if (t === 'faceNearest' || t === 'goNear') { if (rnd() < .25) x.src = pick(NAMES); else x.opt = pick(TARGETS); }
        if (t === 'broadcast' || t === 'goTo') x.opt = pick(RADIO_CH);
        if (t === 'repeat') { if (rnd() < .3) x.src = pick(NAMES); else x.n = int(1, 99); }
        if (t === 'countLoop') { x.name = pick(NAMES); x.to = int(0, 99); }
        if (t === 'if' || t === 'whileLoop') x.cond = cond();
        if (t === 'setVar') { x.name = pick(NAMES); x.val = val(true); }
        if (t === 'changeVar') { x.name = pick(NAMES); x.n = rnd() < .6 ? int(-99, 99) : rnd() < .7 ? { k: 'var', name: pick(NAMES) } : { k: 'num', n: int(1, 5) }; }
        if (t === 'say' || t === 'tryCode') x.val = val(t === 'say');
        if (t === 'read') { x.name = pick(NAMES); x.src = pick(READ_SRC); x.opt = pick(MKT_RES); }
        if (t === 'call') { x.fn = pick(ROUTINE_IDS); x.args = [];
          for (let q = int(0, 5); q > 0; q--) if (rnd() < .8) x.args[q] = rnd() < .5 ? { k: 'num', n: int(-3, 9) } : { k: 'var', name: pick(NAMES) };
          x.outs = []; for (let q = int(0, 3); q > 0; q--) x.outs.push(pick(NAMES));
          if (rnd() < .2) { delete x.outs; if (rnd() < .5) x.out = pick(NAMES); } }
        if (t === 'ret') { x.vals = []; for (let q = int(0, 4); q > 0; q--) x.vals.push(rnd() < .5 ? { k: 'num', n: int(-3, 9) } : { k: 'var', name: pick(NAMES) });
          if (rnd() < .15) { delete x.vals; x.val = { k: 'num', n: 3 }; } }
        if (x.body && depth < 4) x.body = gen(depth + 1);
        if (t === 'if' && depth < 4 && rnd() < .5) x.els = gen(depth + 1);
        list.push(x);
      }
      return list; };
    const r = R();
    for (let it = 0; it < 2000; it++) {
      r.program = gen(0);
      r.routines = { A: { params: NAMES.slice(0, int(0, 4)), body: rnd() < .6 ? gen(1) : [] }, B: rnd() < .5 ? gen(1) : { params: [], body: rnd() < .5 ? gen(1) : [] } };
      const text = pyDoc(r), p = pyParse(text);
      out.rand++; out.blocks += n(r.program);
      let bad = null;
      if (!p.ok) bad = pyErrText(p.err, 'en') + ' @' + p.err.line;
      else if (pyCanonOf(p) !== pyCanon(r)) bad = 'not the same program';
      else if (pyDoc({ name: r.name, program: p.program, routines: p.routines }) !== text) bad = 'written out differently the second time';
      if (bad && out.randBad.length < 3) out.randBad.push(bad + '\n' + text);
    }
    r.program = []; r.routines = { A: { params: [], body: [] }, B: { params: [], body: [] } };
    return out;
  });
  ck('every stored solution (' + RT.sols + ' levels) comes back the same program', RT.sols > 20 && RT.solBad.length === 0, RT.solBad.slice(0, 3));
  ck(RT.rand + ' random programs (' + RT.blocks + ' blocks) come back the same, and are written the same way twice',
    RT.rand === 2000 && RT.blocks > 4000 && RT.randBad.length === 0, RT.randBad);

  const GAP = await pg.evaluate(() => {
    /* three things the listing used to get wrong, which a parser cannot forgive */
    const t3 = toPy([{ t: 'if', cond: 'canClimb', body: [{ t: 'tryCode', val: { k: 'num', n: 7 } }], els: [] }], '');
    const rep = toPy([{ t: 'repeat', n: 3, body: [{ t: 'say', val: { k: 'var', name: 'i' } }] }], '');
    const r = R(); r.routines = { A: { params: ['a', 'b'], body: [] }, B: { params: [], body: [] } };
    r.program = [{ t: 'call', fn: 'A', args: [{ k: 'num', n: 1 }], uid: 1 }, { t: 'call', fn: 'B', uid: 2 }];
    const doc = pyDoc(r); r.program = []; r.routines = { A: { params: [], body: [] }, B: { params: [], body: [] } };
    return { t3, rep, doc };
  });
  ck('a Tower sensor and 🔢 Try Code are written out (they printed `if True:` and nothing)',
    /if robot\.can_climb\(\):/.test(GAP.t3) && /robot\.try_code\(7\)/.test(GAP.t3), GAP.t3);
  ck('a 🔁 Repeat whose blocks use a variable called i does not overwrite it', /for _ in range\(3\):/.test(GAP.rep), GAP.rep);
  ck('a call has one argument per input, and a function that is called is defined',
    /routine_a\(1, 0\)/.test(GAP.doc) && /def routine_a\(a, b\):\n {4}pass/.test(GAP.doc) && /def routine_b\(\):\n {4}pass/.test(GAP.doc), GAP.doc);

  // -------------------------------------------------------- 2. a mistake is answered
  console.log('▶ a mistake gets a sentence about that line');
  const W = await pg.evaluate(CASES => CASES.map(([where, text, key, line]) => {
    __at(where);
    const p = pyParse(text);
    return { text, want: key, got: p.ok ? null : p.err.key, line: p.ok ? 0 : p.err.line, wantLine: line,
      en: p.ok ? '' : pyErrText(p.err, 'en'), he: p.ok ? '' : pyErrText(p.err, 'he') };
  }), WRONG);
  const wrongKey = W.filter(r => r.got !== r.want || r.line !== r.wantLine);
  ck(WRONG.length + ' wrong programs each get the message that is about their mistake, on the right line', wrongKey.length === 0,
    wrongKey.slice(0, 4).map(r => [r.text, 'wanted ' + r.want + '@' + r.wantLine, 'got ' + r.got + '@' + r.line]));
  const said = W.filter(r => r.got);
  ck('the English says what to type, with no placeholder left in it', said.every(r => r.en.length > 12 && !/\{\d\}|undefined|null/.test(r.en)),
    said.filter(r => /\{\d\}|undefined|null/.test(r.en)).slice(0, 3).map(r => r.en));
  /* a locked block's message ends with how to unlock it — a dictionary
     sentence the page translates, so it is still English in this text */
  ck('the Hebrew is Hebrew, and the code inside it is still code',
    said.every(r => /[\u0590-\u05FF]/.test(r.he) && !/\{\d\}|undefined|null/.test(r.he)),
    said.filter(r => !/[\u0590-\u05FF]/.test(r.he)).slice(0, 3).map(r => r.he));
  const M = await pg.evaluate(() => { const bad = [];
    for (const k in PY_MSG) { const [en, he] = PY_MSG[k]; const ph = s => (s.match(/\{\d\}/g) || []).sort().join(), tk = s => (s.match(/`/g) || []).length;
      if (!en || !he || !/[\u0590-\u05FF]/.test(he) || ph(en) !== ph(he) || tk(en) % 2 || tk(he) % 2 || tk(en) !== tk(he)) bad.push(k); }
    return { n: Object.keys(PY_MSG).length, bad }; });
  ck('all ' + M.n + ' messages exist in both languages, with the same code and the same blanks in each', M.n > 70 && M.bad.length === 0, M.bad);
  ck('"did you mean" is offered for a slip of the finger', /robot\.jump\(\)/.test(W[0].en) && /robot\.jump\(\)/.test(W[0].he), W[0]);

  console.log('▶ the same thing, said another way, is still a program');
  const F = await pg.evaluate(CASES => CASES.map(([where, text, shape]) => {
    __at(where);
    const p = pyParse(text);
    return { text, want: shape, got: p.ok ? __shape(p.program) : 'ERR ' + pyErrText(p.err, 'en') };
  }), FINE);
  ck('elif, +=, print, brackets round a question, curly quotes, 3 < x … all read', F.every(r => r.got === r.want),
    F.filter(r => r.got !== r.want).slice(0, 3));

  // -------------------------------------------------------- 3. the editor
  console.log('▶ typing writes the blocks');
  await pg.evaluate(() => { __at('u'); renderPalette(); $('editor').classList.add('open'); setTab('python'); });
  await wait(400);
  await pg.click('#pyEdit'); await wait(150);
  await pg.keyboard.press('Control+End');
  for (const line of ['for i in range(3):', 'robot.chop()', 'if robot.sees("tree"):', 'robot.collect()', 'else:', 'robot.mine()']) {
    await pg.keyboard.type(line); await pg.keyboard.press('Enter'); }
  await pg.keyboard.press('Backspace'); await pg.keyboard.press('Backspace');
  await pg.keyboard.type('robot.sell_all()');
  await wait(450);
  const T = await pg.evaluate(() => ({ text: $('pyEdit').value, shape: __shape(R().program), pre: $('pyCode').textContent,
    focus: document.activeElement.id, keys: getComputedStyle($('pyKeys')).display, bad: $('pyTab').classList.contains('bad') }));
  ck('Enter keeps the depth and goes deeper after a colon; `else:` steps back under its `if`; Backspace steps out',
    T.text === '# Robo-1 — program\nfor i in range(3):\n    robot.chop()\n    if robot.sees("tree"):\n        robot.collect()\n    else:\n        robot.mine()\nrobot.sell_all()', T.text);
  ck('what was typed is the robot\'s program', T.shape === 'repeat[chop,if[collect]{mine}],sellAll' && !T.bad, T);
  ck('the coloured copy says exactly what the field says', T.pre === T.text + '\n', [T.pre.length, T.text.length]);
  ck('the keys a phone hides are in reach while typing', T.focus === 'pyEdit' && T.keys === 'flex', T);

  const G = await pg.evaluate(() => {
    const a = $('pyEdit').getBoundingClientRect(), p = $('pyCode').getBoundingClientRect();
    const cs = e => { const c = getComputedStyle(e); return [c.fontFamily, c.fontSize, c.fontWeight, c.lineHeight, c.letterSpacing, c.whiteSpace, c.tabSize,
      c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft, c.borderTopWidth, c.textAlign, c.direction].join('|'); };
    return { same: cs($('pyEdit')) === cs($('pyCode')), box: [a.x - p.x, a.y - p.y, a.width - p.width, a.height - p.height].map(Math.round),
      size: getComputedStyle($('pyEdit')).fontSize, left: $('pyPane').scrollLeft, type: cs($('pyEdit')) };
  });
  ck('the field and its coloured copy are set in the same type, on the same box', G.same && G.box.every(v => v === 0), G);
  ck('the type is 16px or more, so an iPhone does not zoom the page into it', parseFloat(G.size) >= 16, G.size);
  ck('the code stays hard against the left edge', G.left === 0, G.left);

  await pg.keyboard.press('Enter');
  for (const k of ['.', '()', ':', '""', '=', '_']) await pg.tap('#pyKeys [data-k=\'' + k + '\']');
  const K = await pg.evaluate(() => ({ line: $('pyEdit').value.split('\n').pop(), focus: document.activeElement.id }));
  ck('a key writes its character and leaves the caret in the code; ( ) and " " leave it inside the pair',
    K.line === '.(:"=_")' && K.focus === 'pyEdit', K);
  await pg.tap('#pyKeys [data-k="undo"]');
  const U = await pg.evaluate(() => $('pyEdit').value.split('\n').pop());
  ck('the undo key undoes typing', U !== '.(:"=_")', U);
  await pg.evaluate(() => CC_PY.type('# Robo-1 — program\nrobot.chop()'));

  console.log('▶ a mistake is shown, and never skipped past');
  await pg.keyboard.press('Control+End'); await pg.keyboard.press('Enter'); await pg.keyboard.type('robot.chpo()');
  await wait(320);
  const E0 = await pg.evaluate(() => ({ shown: CC_PY.state.shown, err: !!CC_PY.state.err, say: $('pySay').classList.contains('on'), wait: $('pyTab').classList.contains('wait') }));
  ck('a line you are half way through is not called a mistake yet', E0.err && !E0.shown && !E0.say && E0.wait, E0);
  await wait(900);
  const E1 = await pg.evaluate(() => ({ say: $('pySay').innerText.replace(/\s+/g, ' '), on: $('pySay').classList.contains('on'), q: (document.querySelector('#pyCode .q') || {}).textContent,
    gut: (document.querySelector('#pyGut .bad') || {}).textContent, shape: __shape(R().program), dot: document.querySelector('#tabs button[data-tab="python"]').classList.contains('warn') }));
  ck('once you stop, it says which line and what to type instead', E1.on && /Line 3/.test(E1.say) && /robot\.chop\(\)/.test(E1.say), E1.say);
  ck('the piece it is about is marked in the code and in the margin', E1.q === 'chpo' && E1.gut === '3' && E1.dot, E1);
  ck('the blocks keep the last version that made sense', E1.shape === 'chop', E1.shape);
  await pg.tap('#runBtn'); await wait(300);
  const H = await pg.evaluate(() => ({ running: R().running, tab: document.querySelector('#tabs button.on').dataset.tab }));
  ck('▶ Run on the Python tab does not run the older blocks behind a mistake', H.running === false && H.tab === 'python', H);
  await pg.evaluate(() => { $('pyEdit').blur(); setTab('blocks'); }); await wait(200);
  await pg.tap('#runBtn'); await wait(300);
  const H2 = await pg.evaluate(() => { const r = R().running; stopRobot(R()); return r; });
  ck('…and on the Blocks tab, where the blocks are what is on screen, they run', H2 === true, H2);
  await pg.evaluate(() => { setTab('python'); CC_PY.type($('pyEdit').value.replace('chpo', 'chop')); }); await wait(200);
  await pg.tap('#runBtn'); await wait(1300);
  const RUN = await pg.evaluate(() => { const o = { running: R().running, line: CC_PY.state.run, mark: $('pyMarks').children[1].style.display,
      gut: (document.querySelector('#pyGut .run') || {}).textContent }; stopRobot(R()); return o; });
  ck('fixed, it runs — and the line the robot is on is lit', RUN.running && RUN.line >= 2 && RUN.mark === 'block' && +RUN.gut === RUN.line, RUN);

  console.log('▶ the palette, as lines of code');
  await pg.evaluate(() => { CC_PY.type('# Robo-1 — program\n'); $('pyEdit').blur(); }); await wait(200);
  const tap = async s => { await pg.evaluate(s2 => document.querySelector('#pySnips [data-s="' + s2 + '"]').scrollIntoView({ inline: 'center' }), s); await pg.tap('#pySnips [data-s="' + s + '"]'); await wait(120); };
  await tap('goNear'); await tap('repeat');
  const C0 = await pg.evaluate(() => ({ err: CC_PY.state.err && CC_PY.state.err.key, soft: $('pySay').classList.contains('soft'), bad: $('pyTab').classList.contains('bad') }));
  ck('a loop waiting for its first line is a hint, not an error', C0.err === 'bodyNone' && C0.soft && !C0.bad, C0);
  await tap('chop'); await tap('collect'); await tap('out');
  const C1 = await pg.evaluate(() => ({ text: $('pyEdit').value, shape: __shape(R().program), focus: document.activeElement.id,
    labels: [...document.querySelectorAll('#pySnips button')].every(x => x.getAttribute('aria-label')) }));
  ck('a chip writes its line after the caret — inside a loop that was just opened — and ⇤ pulls a line back out',
    C1.text === '# Robo-1 — program\nrobot.walk_to("tree")\nfor i in range(3):\n    robot.chop()\nrobot.collect()' && C1.shape === 'goNear,repeat[chop],collect', C1);
  ck('tapping chips never opens the keyboard, and every chip has a name for a screen reader', C1.focus !== 'pyEdit' && C1.labels, C1);

  console.log('▶ the text is the player\'s until the blocks change');
  await pg.evaluate(() => CC_PY.type('# my wood robot\n\nrobot.walk_to("tree")   # go there\nrobot.chop()')); await wait(100);
  const KEEP = await pg.evaluate(() => { setTab('blocks'); renderProgram(); setTab('python'); return $('pyEdit').value; });
  ck('notes and spacing survive a look at the Blocks tab', KEEP === '# my wood robot\n\nrobot.walk_to("tree")   # go there\nrobot.chop()', KEEP);
  const SAVED = await pg.evaluate(() => { const d = JSON.parse(JSON.stringify(buildSave())); const kept = d.robots[selRobot].py;
    robots[selRobot].py = null; pyRestore(robots[selRobot], kept); renderPy(); return { kept, back: $('pyEdit').value }; });
  ck('…and a save: they come back exactly as typed', /# go there/.test(SAVED.kept || '') && SAVED.back === KEEP, SAVED);
  const STALE = await pg.evaluate(() => { pyRestore(R(), '# old\nrobot.mine()'); renderPy(); return $('pyEdit').value; });
  ck('saved text that no longer matches the blocks is dropped for the real listing', STALE === '# Robo-1 — program\nrobot.walk_to("tree")\nrobot.chop()', STALE);
  const REGEN = await pg.evaluate(() => { setTab('blocks'); addBlock('mine'); setTab('python'); return $('pyEdit').value; });
  ck('change a block and the listing is written out fresh', REGEN === '# Robo-1 — program\nrobot.walk_to("tree")\nrobot.chop()\nrobot.mine()', REGEN);
  const UND = await pg.evaluate(() => { CC_PY.type($('pyEdit').value + '\nrobot.collect()'); const a = __shape(R().program); doUndo(); return [a, __shape(R().program), $('pyEdit').value.split('\n').length]; });
  ck('a typed line is one step of the program\'s own undo', UND[0] === 'goNear,chop,mine,collect' && UND[1] === 'goNear,chop,mine' && UND[2] === 4, UND);

  const RO = await pg.evaluate(() => { R().program = [Object.assign(newBlock('setVar'), { name: 'for', val: { k: 'num', n: 1 } })]; renderProgram(); renderPy();
    const o = { ro: CC_PY.state.ro, readOnly: $('pyEdit').readOnly, say: $('pySay').innerText, shape: __shape(R().program) };
    R().program = []; renderProgram(); renderPy(); o.after = $('pyEdit').readOnly; return o; });
  ck('a program the listing cannot say (a variable called `for`) is read-only here, not silently rewritten',
    RO.ro && RO.readOnly && /Blocks/.test(RO.say) && RO.shape === 'setVar' && RO.after === false, RO);

  console.log('▶ a level keeps its rules, and the keyboard its place');
  await pg.evaluate(() => { __at('l'); setTab('python'); }); await wait(600);
  const L = await pg.evaluate(() => { const chips = [...document.querySelectorAll('#pySnips .pblk')].map(x => x.dataset.s).join(',');
    const was = __shape(mgRobot.program);
    CC_PY.type('# x\nrobot.move()\nrobot.walk_to("flag")');
    const o = { chips, err: CC_PY.state.err && CC_PY.state.err.key, kept: __shape(mgRobot.program) === was };
    CC_PY.type('# x\nwhile True:\n    if robot.is_blocked():\n        robot.turn_right()\n    else:\n        robot.move()');
    o.shape = __shape(mgRobot.program); o.count = $('mgCount').textContent; return o; });
  ck('its chips are its own blocks', L.chips === 'move,turnL,turnR,repeat,forever,if', L.chips);
  ck('a block its author kept back cannot be typed in, and the program is left as it was', L.err === 'notHere' && L.kept, L);
  ck('what it does allow is read, and counted against the budget', L.shape === 'forever[if[turnR]{move}]' && /4\/5/.test(L.count), L);
  await pg.tap('#mgStepBtn'); await wait(250); await pg.evaluate(() => setTab('python')); await pg.tap('#mgStepBtn'); await wait(350);
  const ST = await pg.evaluate(() => { const o = { line: CC_PY.state.run, tab: document.querySelector('#tabs button.on').dataset.tab }; mgStop(); return o; });
  ck('⏭ Step walks the listing a line at a time', ST.line >= 2 && ST.tab === 'python', ST);
  const LS = await pg.evaluate(() => { CC_PY.type('# solved my way\nwhile True:\n    if robot.is_blocked():\n        robot.turn_right()   # wall!\n    else:\n        robot.move()');
    const id = mgState.proj.id; mgExit(false); const kept = player.projPy && player.projPy[id]; packEnter(PUZZLE_PACKS[0], 3); setTab('python'); return { kept: !!kept, back: $('pyEdit').value }; });
  ck('a level\'s Python is kept with its program', LS.kept && /# wall!/.test(LS.back), LS);

  await pg.click('#pyEdit'); await wait(150);
  const KB = await pg.evaluate(async () => { CC_PY.kb(336, 844 - 336); await new Promise(r => setTimeout(r, 350));
    const rc = id => { const q = $(id).getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom)]; };
    const o = { ed: rc('editor'), box: rc('pyBox'), run: rc('actionBar'), keys: rc('pyKeys'), tabs: getComputedStyle($('tabs')).display, free: 844 - 336 };
    CC_PY.kb(0, 844); $('pyEdit').blur(); await new Promise(r => setTimeout(r, 200)); o.off = $('editor').classList.contains('kb'); return o; });
  ck('with the keyboard up the sheet stands on top of it: code, keys and ▶ Run all above the keyboard',
    KB.ed[1] === KB.free && KB.run[1] <= KB.free && KB.keys[1] <= KB.free && KB.ed[0] >= 0 && KB.box[1] - KB.box[0] >= 100 && KB.tabs === 'none' && KB.off === false, KB);
  await pg.evaluate(() => { mgExit(false); navHome(); });
  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  await pg.close();

  // -------------------------------------------------------- 4. in Hebrew
  console.log('▶ in Hebrew');
  ({ pg, errs } = await open({ he: true }));
  await pg.evaluate(() => { __at('u'); $('editor').classList.add('open'); setTab('python'); CC_PY.type('# x\nrobot.jupm()'); }); await wait(400);
  const HE = await pg.evaluate(() => { const s = $('pySay'), btn = s.querySelector('button');
    return { text: s.innerText.replace(/\s+/g, ' '), codes: [...s.querySelectorAll('code')].map(c => c.textContent), dir: getComputedStyle(btn).direction,
      pre: $('pyCode').textContent, hint: getComputedStyle($('pyHint')).display, aria: $('pyEdit').getAttribute('aria-label'),
      keys: [...document.querySelectorAll('#pyKeys button,#pySnips button')].map(x => x.getAttribute('aria-label')).filter(a => /[A-Za-z]{3}/.test(a)) }; });
  ck('the message is a Hebrew sentence, right to left, with the code in it left as code',
    /שורה 2/.test(HE.text) && /הרובוט לא מכיר/.test(HE.text) && HE.codes.join() === 'robot.jupm(),robot.jump()' && HE.dir === 'rtl', HE);
  ck('the listing itself is never translated', !/[\u0590-\u05FF]/.test(HE.pre), HE.pre);
  ck('every key and chip is named in Hebrew for a screen reader', HE.keys.length === 0 && /[\u0590-\u05FF]/.test(HE.aria), HE);
  await pg.evaluate(() => { for (const k in unlocks) unlocks[k] = false; CC_PY.type('# x\nfor i in range(3):\n    robot.chop()'); }); await wait(500);
  const LK = await pg.evaluate(() => $('pySay').innerText.replace(/\s+/g, ' '));
  ck('a locked block says how to unlock it, in Hebrew', /עדיין נעול/.test(LK) && /לולאות/.test(LK) && !/unlock/.test(LK), LK);
  const EMPTY = await pg.evaluate(() => { CC_PY.type('# x\n'); return { shown: getComputedStyle($('pyHint')).display, text: $('pyHint').textContent }; });
  ck('an empty program says what to do, in Hebrew', EMPTY.shown === 'block' && /[\u0590-\u05FF]/.test(EMPTY.text) && !/[A-Za-z]{3}/.test(EMPTY.text), EMPTY);
  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();

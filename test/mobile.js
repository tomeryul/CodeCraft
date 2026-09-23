/* The platform layer — what a phone does to a web page that a native app
   never suffers. Run with a touch viewport (hasTouch + isMobile), because
   `(pointer: coarse)` and the soft keyboard's enterkeyhint only mean
   anything on one.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/mobile.js */
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

  for (const W of [320, 390]) {
    console.log(`▶ ${W}px, touch`);
    const pg = await b.newPage({ viewport: { width: W, height: 700 }, hasTouch: true, isMobile: true });
    const errs = [];
    pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto(APP); await wait(1300);

    /* Under 16px, iOS zooms the page into a field on focus and never zooms
       back out. The viewport tag's maximum-scale happens to block that,
       but Android's force-zoom accessibility setting overrides the tag —
       so the size is the fix, and it is asserted on every field. */
    const gate = await pg.evaluate(() => {
      const s = [...document.querySelectorAll('#ageSelects select')];
      const row = document.getElementById('ageSelects');
      return { fonts: s.map(x => getComputedStyle(x).fontSize),
        rowFits: row.scrollWidth <= row.clientWidth + 1,
        page: document.documentElement.scrollWidth <= window.innerWidth };
    });
    ck(`${W}: the age gate's pickers are 16px, so focusing one does not zoom the page`,
      gate.fonts.length === 2 && gate.fonts.every(f => f === '16px'), gate.fonts);
    ck(`${W}: and the bigger pickers still fit the row`, gate.rowFits && gate.page, gate);

    await pg.selectOption('#ageMonth', '6');
    await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
    await pg.click('#ageGo'); await wait(500);

    const sp = await pg.evaluate(() => {
      const e = document.getElementById('spEmail'), p = document.getElementById('spPass');
      const card = document.querySelector('#splashAuth .sp-card');
      return { fonts: [e && getComputedStyle(e).fontSize, p && getComputedStyle(p).fontSize],
        hints: [e && e.getAttribute('enterkeyhint'), p && p.getAttribute('enterkeyhint')],
        caps: e && e.getAttribute('autocapitalize'), correct: e && e.getAttribute('autocorrect'),
        cardFits: !!card && card.scrollWidth <= card.clientWidth + 1,
        page: document.documentElement.scrollWidth <= window.innerWidth };
    });
    ck(`${W}: the sign-in fields are 16px`, sp.fonts.every(f => f === '16px'), sp.fonts);
    ck(`${W}: and the card still fits`, sp.cardFits && sp.page, sp);
    /* The keyboard's return key says what it will do. */
    ck(`${W}: the keyboard says "next" on the email and "go" on the password`,
      sp.hints[0] === 'next' && sp.hints[1] === 'go', sp.hints);
    /* An email is not a sentence: no capital first letter, no "correcting"
       a made-up address into a dictionary word. */
    ck(`${W}: the email is neither capitalised nor autocorrected`,
      sp.caps === 'none' && sp.correct === 'off', sp);

    const misc = await pg.evaluate(() => {
      const a = document.getElementById('askInput');
      const cs = e => getComputedStyle(e);
      return {
        tsa: cs(document.documentElement).webkitTextSizeAdjust || cs(document.documentElement).textSizeAdjust,
        askHint: a.getAttribute('enterkeyhint'), askFont: cs(a).fontSize,
        py: cs(document.getElementById('pyTab')).userSelect || cs(document.getElementById('pyTab')).webkitUserSelect,
        body: cs(document.body).userSelect || cs(document.body).webkitUserSelect };
    });
    /* A game lays its own text out; Safari must not inflate it in landscape. */
    ck(`${W}: text is not inflated when the phone is turned`, misc.tsa === '100%', misc.tsa);
    ck(`${W}: the chat to Byte says "send" and is 16px`,
      misc.askHint === 'send' && misc.askFont === '16px', misc);
    /* Controls are not selectable (a long press must not select a button's
       label) but the Python the blocks become is content, and a child who
       just wrote it should be able to copy it out. */
    ck(`${W}: the Python can be selected and copied`, misc.py === 'text', misc.py);
    ck(`${W}: while the rest of the game still cannot`, misc.body === 'none', misc.body);

    if (W === 390) {
      console.log('▶ the return key actually does something');
      /* There is no <form> on either sign-in, so nothing used to listen for
         Enter at all: "next" and "go" on the keyboard were dead keys. */
      await pg.evaluate(() => { window.__login = 0;
        window.sbAuth = async () => { window.__login++; throw new Error('stubbed'); }; });
      await pg.focus('#spEmail'); await pg.keyboard.type('kid@example.com');
      await pg.keyboard.press('Enter'); await wait(60);
      const moved = await pg.evaluate(() => document.activeElement && document.activeElement.id);
      ck('Return on the email moves to the password', moved === 'spPass', moved);
      await pg.keyboard.type('secret123'); await pg.keyboard.press('Enter'); await wait(150);
      const pressed = await pg.evaluate(() => window.__login);
      ck('Return on the password presses Log in', pressed === 1, pressed);

      /* The same fields exist a second time, on the Projects sheet. */
      const again = await pg.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const c = document.querySelector('#ccCele .cc-cta'); if (c) c.click();
        if (typeof renderAuthBox === 'function') renderAuthBox();
        /* The form is folded behind its "Sign in" toggle, and a field that
           is display:none cannot take focus — open the sheet and unfold it
           the way a player would. */
        document.getElementById('projects').classList.add('open');
        const box = document.getElementById('authBox');
        if (box && !box.classList.contains('open')) box.classList.add('open');
        await wait(80);
        const e = document.getElementById('authEmail'), p = document.getElementById('authPass');
        if (!e || !p) return { missing: true };
        window.__login = 0;
        e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        const focus1 = document.activeElement && document.activeElement.id;
        e.value = 'kid@example.com'; p.value = 'secret123';
        p.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await wait(100);
        return { focus1, login: window.__login, hints: [e.getAttribute('enterkeyhint'), p.getAttribute('enterkeyhint')] };
      });
      ck('the Projects sheet sign-in has the same working return key',
        again.focus1 === 'authPass' && again.login === 1 &&
        again.hints[0] === 'next' && again.hints[1] === 'go', again);
    }

    /* A big board on a small screen makes tiny cells, and the brick the
       robot carries is drawn at half a cell. Under ~8px the brick's inset
       left it a NEGATIVE size, ellipse() threw, and the exception took
       down the whole board drawing every frame. */
    const bricks = await pg.evaluate(() => {
      const c = document.createElement('canvas').getContext('2d'), bad = [];
      for (const cell of [1, 2, 4, 5, 6, 8, 12, 40]) {
        try { drawBoardBrick(c, 0, 0, cell, true, 3); } catch (e) { bad.push(cell + ': ' + e.name); }
      }
      return bad;
    });
    ck(`${W}: a board brick too small to see is skipped, not a crash`, bricks.length === 0, bricks);
    ck(`${W}: no uncaught exceptions`, errs.length === 0, errs.slice(0, 3));
    await pg.close();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();

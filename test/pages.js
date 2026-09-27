/* Fewer pages, one stack, and Back to where you were
   (.claude/skills/game-app-design §2; docs/ux-roadmap.md topic 4).
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/pages.js */
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
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(APP); await wait(1100);
  await pg.selectOption('#ageMonth', '6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
  await pg.click('#ageGo'); await wait(400);
  await pg.evaluate(() => $('playBtn').click()); await wait(1600);

  const R = await pg.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
    const shown = e => !!e && !!e.offsetParent;
    HELD.length = 0; document.querySelectorAll('#ccCele').forEach(e => e.remove());
    if (mgState) mgExit(false); navHome(); await w(300);

    hubOpen(); await w(200); hubPage('mine'); await w(300);
    out.mine = [...document.querySelectorAll('#projList .t3sec:not(.cy-sec) .t3card')].filter(shown)
      .map(c => c.classList.contains('mine') || c.classList.contains('t3new'));
    out.mineHead = shown(document.querySelector('#projList .t3sec:not(.cy-sec) .t3head'));
    hubPage('tower'); await w(300);
    out.tower = [...document.querySelectorAll('#projList .t3sec:not(.cy-sec) .t3card')].filter(shown).length;

    hubPage('academy'); await w(300);
    out.lessons = [...document.querySelectorAll('#projList .acad-lesson')].filter(shown).length;
    out.lessonsTotal = TUTS.length;
    document.querySelector('#projList .acad-lesson[data-lesson="3"]').click(); await w(500);
    out.opened = !!mgState && mgState.proj.id === TUTS[3].id;
    if (mgState) mgExit(false); navHome(); await w(300);

    openShop(); await w(300); navHome(); await w(300);
    out.shopAfterHome = $('shopWrap').classList.contains('open');

    hubOpen(); await w(200); hubPage('puzzles'); await w(300);
    const pl = $('projList'); pl.scrollTop = 400; await w(100); out.scrolled = pl.scrollTop;
    packEnter(PUZZLE_PACKS[3], 0); await w(600);
    navBack(); await w(600);
    out.backPage = $('projects').dataset.page; out.backScroll = $('projList').scrollTop;
    hubOpen(); await w(200); hubPage('builds'); await w(300);
    out.freshPage = $('projList').scrollTop;
    navHome(); await w(300);
    return out;
  });
  ck('My Challenges holds only your own towers and the card to make one',
    R.mine.length >= 1 && R.mine.every(Boolean) && R.mineHead === false, R);
  ck('the built-in Tower levels live on the Tower page', R.tower >= 6, R);
  ck('the Academy page lists every lesson as a row of its own', R.lessons === R.lessonsTotal, R);
  ck('and a row opens its lesson', R.opened === true, R);
  ck('going home closes the shop too', R.shopAfterHome === false, R);
  ck('Back from a level lands on its page, scrolled where it was',
    R.backPage === 'puzzles' && Math.abs(R.backScroll - R.scrolled) <= 2, R);
  ck('while a page opened from the menu starts at the top', R.freshPage === 0, R);

  console.log('▶ what a page says is true, and a child can act on it');
  const P = await pg.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
    HELD.length = 0; document.querySelectorAll('#ccCele').forEach(e => e.remove());
    if (mgState) mgExit(false); navHome(); await w(300);
    // a lesson at half height: one row that says what it holds
    if ($('editor').classList.contains('max')) $('edMax').click();
    academyEnter(0); await w(700);
    const pk = $('lsPeek');
    out.peek = !!pk && !!pk.offsetParent && /How do I do this/.test(pk.textContent) && pk.getBoundingClientRect().height >= 44;
    out.badgeOnly = !!document.querySelector('#mgLesson .ls-head') && !!document.querySelector('#mgLesson .ls-head').offsetParent;
    pk.click(); await w(800);
    out.opensFull = $('editor').classList.contains('max');
    out.cardAtFull = !!document.querySelector('#mgLesson .ls-steps').offsetParent && !pk.offsetParent;
    $('edMax').click(); await w(600); mgExit(false); navHome(); await w(300);
    // no internet: words a child understands, not the browser's
    const f = window.fetch; window.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const ready = window.sbReady; window.sbReady = () => true;
    await loadCommunity();
    out.offline = $('ccList').textContent;
    window.fetch = f; window.sbReady = ready;
    return out;
  });
  ck('a lesson at half height is one row that says what it holds, big enough to tap', P.peek === true && P.badgeOnly === false, P);
  ck('tapping it opens the sheet to full height, where the whole lesson is', P.opensFull && P.cardAtFull, P);
  ck('with no internet, Community says so in words — not "Failed to fetch"',
    /internet/.test(P.offline) && /try again/.test(P.offline) && !/Failed to fetch/.test(P.offline), P.offline);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();

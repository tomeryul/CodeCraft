"use strict";
/* =====================================================================
   Hebrew
   ---------------------------------------------------------------------
   The game builds most of its UI by regenerating innerHTML on every
   render, across thirty files. Threading a t() call through all of them
   would touch every one and still miss the next new string. js/ui-icons.js
   already solved the same shape of problem for emoji — watch text nodes,
   swap what you recognise — so this follows that pattern: one dictionary
   of whole strings, one MutationObserver, no changes to the callers.

   Whole-string matches only. A partial or word-level match would maul a
   player's challenge name, a robot's name, a number or a line of Python.

   The font needs nothing: styles.css already declares the Fredoka Hebrew
   subset with unicode-range U+0590-05FF, and sw.js already caches it, so
   Hebrew renders in the same face as the rest of the game.
   ===================================================================== */
(function(){
if(window.__i18n)return; window.__i18n=1;

/* Zones never translated: real code, the player's own text, and the
   canvas. A dictionary hit inside a Python listing would be a bug. */
const SKIP=new Set(["SCRIPT","STYLE","CANVAS","TEXTAREA","INPUT","PRE","CODE"]);
/* Only the Python view. An earlier version also skipped #palette and
   #programWrap to protect user text, but those hold the block names —
   the most important words in the game to translate — and it left the
   palette in English. What protects a player's own variable or challenge
   name is that matching is whole-string: nothing in the dictionary is a
   name anyone would choose. */
const SKIP_IN="#pyTab,#pyCode,.mono";

const HE={
/* ---- splash ---- */
"CodeCraft — Program Your World":"CodeCraft — תכנת את העולם שלך",
"A living open world where":"עולם פתוח וחי שבו",
"everything runs on your code":"הכול רץ על הקוד שלך",
"Program robots. Automate everything. Build your empire.":
  "תכנת רובוטים. תהפוך הכול לאוטומטי. תבנה אימפריה.",
"▶ Play":"▶ שחק",
"🌍 Open world":"🌍 עולם פתוח","🧩 Block coding":"🧩 תכנות בבלוקים",
"🐍 Real Python":"🐍 פייתון אמיתי","⚙️ Automation":"⚙️ אוטומציה","🦉 AI mentor":"🦉 מנטור AI",

/* ---- world + editor chrome ---- */
"🧩 Code":"🧩 קוד","🔨 Build":"🔨 בנייה",
"🗺️ Board":"🗺️ לוח","🧩 Blocks":"🧩 בלוקים","🐍 Python":"🐍 פייתון",
"Board":"לוח","Blocks":"בלוקים","Python":"פייתון",
"RESET":"אפס","STEP":"צעד","SPEED":"מהירות",
"Run":"הרצה","Stop":"עצור","The world":"העולם","Your code":"הקוד שלך",
"＋ robot":"＋ רובוט",

/* ---- the menu ---- */
"Everything in the game":"כל מה שיש במשחק",
"Pick where to go. Your world keeps running.":"בחר לאן ללכת. העולם שלך ממשיך לרוץ.",
"Next up":"הבא בתור",
"Play":"לשחק","Create":"ליצור","Your world":"העולם שלך",
"Academy":"אקדמיה","lessons":"שיעורים",
"Puzzle Chapters":"פרקי חידות","Build Projects":"פרויקטי בנייה",
"Tower Mode":"מצב מגדל","Community":"קהילה",
"New challenge":"אתגר חדש","New tower level":"שלב מגדל חדש",
"My Challenges":"האתגרים שלי","yours":"שלך",
"My Functions":"הפונקציות שלי","reusable":"לשימוש חוזר",
"How to design":"איך לעצב","guide":"מדריך",
"Shop":"חנות","robots & upgrades":"רובוטים ושדרוגים",
"Settings":"הגדרות","sound & world":"צליל ועולם",
"Market Orders":"הזמנות מהשוק","on a clock":"על השעון",
"Quests":"משימות","progress":"התקדמות",
"Account & save":"חשבון ושמירה","sign in · export":"התחברות · ייצוא",

/* ---- destination pages ---- */
"Harder coding challenges — finished builds appear in your world!":
  "אתגרי תכנות קשים יותר — מה שתסיים לבנות מופיע בעולם שלך!",
"Design a great challenge":"לעצב אתגר טוב",
"Six rules, then five boards to start from.":"שישה כללים, ואז חמישה לוחות להתחיל מהם.",
"Save a function once — use it in every world and minigame.":
  "שמור פונקציה פעם אחת — והשתמש בה בכל עולם ובכל מיני-משחק.",
"A job on a clock. Deliver it before time runs out.":
  "עבודה על השעון. תספק אותה לפני שהזמן נגמר.",
"Quests & Progress":"משימות והתקדמות",
"Finish goals, claim rewards, level up!":"תסיים מטרות, תאסוף פרסים, תעלה רמה!",
"Byte — your AI mentor":"Byte — המנטור שלך",
"Ask me anything about coding or your robots!":"תשאל אותי כל דבר על תכנות או על הרובוטים שלך!",
"Ask Byte something…":"תשאל את Byte משהו…",
"🛒 Robo-Mart":"🛒 רובו-מרט",
"Sell resources near the market 🏪, then power up your automation empire!":
  "תמכור חומרים ליד השוק 🏪, ואז תשדרג את אימפריית האוטומציה שלך!",
"Sell at the 🏪 market, then upgrade your robots.":"תמכור בשוק 🏪, ואז תשדרג את הרובוטים שלך.",
"Done":"סיום",

/* ---- shop ---- */
"Get":"קנה","Sell":"מכור",
"New Robot":"רובוט חדש","Bigger Bag":"תיק גדול יותר",
"Speed Boost":"האצה","Sell the Bank":"למכור את הבנק",
"More robots = more automation! It spawns at your home base.":
  "עוד רובוטים = עוד אוטומציה! הוא מופיע בבסיס הבית שלך.",

/* ---- settings ---- */
"Sound, your name, and what happens to your world.":
  "צליל, השם שלך, ומה קורה לעולם שלך.",
"Sound":"צליל","Blips, dings and celebrations.":"ציוצים, צלילים וחגיגות.",
"Music":"מוזיקה",
"A theme for the world, another for challenges.":"נעימה לעולם, ואחרת לאתגרים.",
"Language":"שפה","English · עברית":"English · עברית",
"Turn on":"הפעל","Turn off":"כבה","Change":"שנה","None":"אין",
"New World":"עולם חדש",
"Erase everything and generate a fresh world.":"למחוק הכול ולייצר עולם חדש.",
"Reset":"אפס",
"What other players see on challenges you publish.":
  "מה שחקנים אחרים רואים על אתגרים שאתה מפרסם.",
"Their challenges are hidden from you.":"האתגרים שלהם מוסתרים ממך.",
"You haven't hidden anyone.":"לא הסתרת אף אחד.",
"Show all":"הצג הכול",
"Export a copy":"ייצא עותק","Import a save":"ייבא שמירה",
"💾 Your save":"💾 השמירה שלך",

/* ---- account, privacy, age gate ---- */
"When were you born?":"מתי נולדת?",
"We turn this into a yes-or-no straight away and keep only that — the date itself is never saved.":
  "אנחנו הופכים את זה לכן-או-לא מיד ושומרים רק את זה — התאריך עצמו לא נשמר בכלל.",
"Continue":"המשך","Privacy policy":"מדיניות פרטיות",
"Delete your account":"מחיקת החשבון שלך",
"This cannot be undone. Nobody can get any of it back for you — not even us.":
  "אין דרך לבטל את זה. אף אחד לא יוכל להחזיר לך שום דבר — גם לא אנחנו.",
"Keep my account":"להשאיר את החשבון","Delete everything":"למחוק הכול",
"Sign in":"התחברות",
"Report a challenge":"לדווח על אתגר",
"Tell us what's wrong. Three reports takes a challenge down for everyone, and it disappears for you straight away.":
  "תספר לנו מה לא בסדר. שלושה דיווחים מורידים אתגר לכולם, ואצלך הוא נעלם מיד.",

/* ---- creator ---- */
"Design guide & starter boards":"מדריך עיצוב ולוחות התחלה",
"Rename challenge":"שנה שם לאתגר",
"Split into inputs — this board becomes input 1":"פצל לקלטים — הלוח הזה הופך לקלט 1",
"Starter routines: off":"שגרות פתיחה: כבוי",
"⭐ Easy":"⭐ קל",
"➕ Add level":"➕ הוסף שלב","🌍 Publish":"🌍 פרסם",
"🚚 Move":"🚚 הזז","🗑 Delete":"🗑 מחק",

/* ---- blocks ---- */
"Move":"קדימה","Turn Left":"פנה שמאלה","Turn Right":"פנה ימינה",
"Collect":"אסוף","Chop":"כרות","Mine":"כרה","Scoop":"שאב","Drop":"הנח",
"Lift":"הרם","Build":"בנה","Rest":"נוח","Wait":"חכה",
"Repeat":"חזור","Forever":"לתמיד","While":"כל עוד","If":"אם",
"Face Nearest":"פנה לקרוב","Walk To":"לך אל","Go Home":"חזור הביתה",
"Sell All":"מכור הכול","Bank All":"הפקד הכול",
"Set":"קבע","Count":"מנה","Read":"קרא","Say":"אמור",
"Call":"קרא לפונקציה","Give Back":"החזר","Call It":"תן שם",
"Tell Team":"ספר לצוות","Go To Call":"חזור לקורא","Give Bag":"תן תיק",
"BASICS":"בסיס","LOOPS":"לולאות","LOGIC":"לוגיקה",
"MEMORY":"זיכרון","SMART":"חכם","FUNCTIONS":"פונקציות",

/* ---- the journey, which the menu shows as "Next up" ---- */
"Finish the Starter Academy":"לסיים את אקדמיית הפתיחה",
"Six short lessons. They teach every block you need to start.":
  "שישה שיעורים קצרים. הם מלמדים כל בלוק שצריך כדי להתחיל.",
"Send your robot for wood":"לשלוח את הרובוט להביא עץ",
"Open 🧩 Code and build: 🚶 Walk To 🌳 → 🪓 Chop. Then press ▶.":
  "פתח 🧩 קוד ובנה: 🚶 לך אל 🌳 → 🪓 כרות. ואז לחץ ▶.",
"Sell what you gathered":"למכור את מה שאספת",
"Add 🚶 Walk To 🏪 and then ⤵️ Drop — the market pays you for a full bag.":
  "הוסף 🚶 לך אל 🏪 ואז ⤵️ הנח — השוק משלם לך על תיק מלא.",
"Do it again — with a loop":"לעשות את זה שוב — עם לולאה",
"Wrap your gathering blocks in 🔁 Repeat so one program works forever.":
  "עטוף את בלוקי האיסוף ב-🔁 חזור, כך שתוכנית אחת תעבוד לתמיד.",
"Hire a second robot":"לגייס רובוט שני",
"100 🪙 in the shop. Two robots run their own programs at the same time.":
  "100 🪙 בחנות. שני רובוטים מריצים כל אחד את התוכנית שלו בו-זמנית.",
"Fill an order at the market":"למלא הזמנה בשוק",
"The board posts an order on a clock. Deliver it before it runs out.":
  "הלוח מפרסם הזמנה על השעון. תספק אותה לפני שהזמן נגמר.",
"Finish a Build Project":"לסיים פרויקט בנייה",
"A blueprint to fill in. What you build appears in your world.":
  "תוכנית בנייה למלא. מה שתבנה מופיע בעולם שלך.",
"Build upwards in Tower Mode":"לבנות למעלה במצב מגדל",
"The board gets a third dimension. You can only reach one brick above your feet.":
  "הלוח מקבל מימד שלישי. אתה מגיע רק לגובה לבנה אחת מעל הרגליים שלך.",
"Design a challenge of your own":"לעצב אתגר משלך",
"Draw a board, prove it can be solved, then share it with everyone.":
  "צייר לוח, הוכח שאפשר לפתור אותו, ואז שתף אותו עם כולם.",
"Menu ▸ Academy":"תפריט ▸ אקדמיה",
"Menu ▸ Build Projects":"תפריט ▸ פרויקטי בנייה",
"Menu ▸ Tower Mode (3D)":"תפריט ▸ מצב מגדל (3D)",
"Menu ▸ New challenge":"תפריט ▸ אתגר חדש",
"Menu ▸ Shop":"תפריט ▸ חנות",
"Menu ▸ Market Orders":"תפריט ▸ הזמנות מהשוק",
"Starter Academy":"אקדמיית הפתיחה",
"Levels other players published.":"שלבים שחקנים אחרים פרסמו.",
"Short lessons, in order. They teach every block the rest of the game needs.":
  "שיעורים קצרים, לפי הסדר. הם מלמדים כל בלוק שהמשחק צריך.",
"A flat board and one new trick per chapter.":"לוח שטוח, וטריק חדש אחד בכל פרק.",
"A blueprint to fill in. What you finish appears in your world.":
  "תוכנית בנייה למלא. מה שתסיים מופיע בעולם שלך.",
"The same board with height. Stack, climb, and rebuild the blueprint in 3D.":
  "אותו לוח, עם גובה. תערים, תטפס, ותבנה את התוכנית מחדש ב-3D.",
"Levels you designed — flat boards and towers.":"שלבים שעיצבת — לוחות שטוחים ומגדלים.",
"Sign in to keep your world on every device. Export a copy any time.":
  "התחבר כדי לשמור את העולם שלך בכל מכשיר. אפשר לייצא עותק בכל רגע.",
"Tower Mode — 3D":"מצב מגדל — 3D",

/* ---- palette headings (CSS uppercases them, the DOM text is title case) ---- */
"Basics":"בסיס","Loops":"לולאות","Logic":"לוגיקה","Smart":"חכם",
"Memory":"זיכרון","Functions":"פונקציות","Teamwork":"עבודת צוות",

/* ---- the editor's empty state, which the <b> around the robot's name
        splits into separate text nodes ---- */
"Tap blocks below to program":"לחץ על בלוקים למטה כדי לתכנת את",
"Try:":"נסה:",
"new blocks go in here":"בלוקים חדשים נכנסים לכאן",
"runs when the condition is false":"רץ כשהתנאי לא מתקיים",
"Main":"ראשי",

/* ---- attributes ---- */
"Back":"אחורה","Back to the list":"חזרה לרשימה","Back to the menu":"חזרה לתפריט",
"Exit to the world":"יציאה לעולם","Close":"סגור",
"Shrink or expand":"הקטן או הגדל","Expand / shrink editor":"הגדל / הקטן עורך",
"Expand editor":"הגדל עורך","Menu":"תפריט",
"Menu — everything in the game":"תפריט — כל מה שיש במשחק",
"Find my robot":"מצא את הרובוט שלי","AI Mentor":"מנטור AI",
"Undo":"בטל","Redo":"בצע שוב","Copy":"העתק","Paste here":"הדבק כאן",
"Playback speed":"מהירות הרצה","Run one action at a time":"הרץ פעולה אחת בכל פעם",
"Reset the board":"אפס את הלוח","Difficulty":"דרגת קושי",
"Level setup":"הגדרות שלב","Save to My Challenges":"שמור לאתגרים שלי",
"Prove the level, then bank it and start the next":"הוכח את השלב, שמור אותו, והתחל את הבא",
"Hand players a ready-made routine":"תן לשחקנים שגרה מוכנה",
"Clears the board and starts a new input on it":"מנקה את הלוח ומתחיל עליו קלט חדש"
};

/* ui-icons.js also rewrites text nodes: it lifts each emoji into its own
   <span>, so by the time this observer sees "🧩 Code" the text node may
   already read " Code". Both observers watch the same tree and whichever
   registered first wins, which showed up exactly as you would expect from
   a race — Build translated and Code did not, because the dictionary
   happened to hold a bare "Build" and not a bare "Code".

   So matching ignores emoji entirely. The key is the wordy part; any
   leading or trailing emoji and spacing are kept from the node itself and
   put back around the Hebrew, whether ui-icons has run yet or not. */
const STRIP=/[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu;
const EDGE=/^[\s\p{Extended_Pictographic}\uFE0F\u200D\u20E3]*|[\s\p{Extended_Pictographic}\uFE0F\u200D\u20E3]*$/gu;
const norm=s=>s.replace(STRIP,"").replace(/\s+/g," ").trim();

/* Readouts carrying a live number cannot match as whole strings; their
   skeleton can. Digits become {n}, are looked up, and go back in order.
   Still whole-string, so a robot named "Level 3" is untouched — nothing
   in this table says that. */
const NUM=/\d+(?:[.,]\d+)?/g;
const HE_N={
  "/min {n}":"{n} לדקה",
  "Lesson {n} of {n}":"שיעור {n} מתוך {n}",
  "{n}/{n} done":"{n}/{n} הושלמו",
  "Bigger Bag +{n} — {n}":"תיק גדול יותר +{n} — {n}",
  "New Robot — {n}":"רובוט חדש — {n}",
  "Speed Boost — {n}":"האצה — {n}",
  "Sell the Bank — +{n}":"למכור את הבנק — +{n}"
};

/* one index, built once, keyed on the emoji-free form both ways */
const IDX={}, IDX_N={};
for(const k in HE) IDX[norm(k)]=norm(HE[k]);
for(const k in HE_N) IDX_N[norm(k).replace(NUM,"{n}")]=HE_N[k];

/* ---------- the swap ---------- */
function tr(s){
  const core=norm(s);
  if(!core)return null;
  const edges=s.match(EDGE)||["",""];
  const lead=edges[0]||"", tail=edges[edges.length-1]||"";
  const hit=IDX[core];
  if(hit)return lead+hit+tail;
  const nums=core.match(NUM);
  if(nums){
    const tmpl=IDX_N[core.replace(NUM,"{n}")];
    if(tmpl){
      let i=0;
      return lead+norm(tmpl).replace(/\{n\}/g,()=>nums[i++])+tail;
    }
  }
  return null;
}
function walk(node){
  if(node.nodeType===3){
    const p=node.parentNode;
    if(!p||SKIP.has(p.nodeName)||p.closest&&p.closest(SKIP_IN))return;
    const out=tr(node.nodeValue);
    if(out!==null)node.nodeValue=out;
    return;
  }
  if(node.nodeType!==1||SKIP.has(node.nodeName))return;
  if(node.closest&&node.closest(SKIP_IN))return;
  for(const a of ["title","aria-label","placeholder"]){
    const v=node.getAttribute&&node.getAttribute(a);
    if(v){const out=tr(v); if(out!==null)node.setAttribute(a,out);}
  }
  for(let c=node.firstChild;c;c=c.nextSibling)walk(c);
}

let mo=null;
function on(){
  document.documentElement.setAttribute("lang","he");
  document.documentElement.setAttribute("dir","rtl");
  walk(document.body);
  if(mo)return;
  mo=new MutationObserver(ms=>{
    for(const m of ms){
      if(m.type==="characterData")walk(m.target);
      else for(const n of m.addedNodes)walk(n);
    }
  });
  mo.observe(document.body,{childList:true,subtree:true,characterData:true});
}
/* Off is a reload: the English strings were replaced in place, and putting
   them all back by reverse lookup would be guesswork the moment one of them
   is a word that appears in both directions. */
function off(){
  document.documentElement.setAttribute("lang","en");
  document.documentElement.removeAttribute("dir");
  if(mo){mo.disconnect();mo=null;}
}
function i18nApply(){ (typeof lang!=="undefined"&&lang==="he")?on():off(); }

window.i18nApply=i18nApply;
window.i18nOn=on; window.i18nOff=off;
window.CC_I18N={size:Object.keys(HE).length, has:s=>!!HE[String(s).trim()]};
})();

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
"Style":"סטייל","dress your robots":"להלביש את הרובוטים",
"Open":"פתח",
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
"Dress your robots. New pieces unlock as you level up.":
  "תלביש את הרובוטים שלך. פריטים חדשים נפתחים כשאתה עולה רמה.",
/* the Style sheet: slot labels, the two preview poses, and the pieces */
"Hat":"כובע","Outfit":"תלבושת","Shoes":"נעליים","None":"אין",
/* ---- make a piece ---- */
"Make a piece":"להכין אביזר",
"Paint your own. It shows up in Style with the rest.":
  "תצייר משלך. זה מופיע בסטייל יחד עם כל השאר.",
"Paint it, or build it out of boxes and read the HTML it means.":
  "תצייר אותו, או תבנה אותו מקופסאות ותקרא את ה-HTML שהוא אומר.",
/* build mode: boxes, and the code they mean */
"Paint":"ציור","Build":"בנייה",
"Box":"ריבוע","Tile":"אריח","Pill":"גלולה","Dot":"עיגול",
"Front":"קדימה","Add a box":"להוסיף קופסה",
"Add a box first!":"קודם תוסיף קופסה!",
"That is as many boxes as one piece can hold.":
  "זה מספר הקופסאות המקסימלי לאביזר אחד.",
"Add a box to start. Drag it to move it, drag its corner to resize it.":
  "תוסיף קופסה כדי להתחיל. תגרור אותה כדי להזיז, ותגרור את הפינה כדי לשנות גודל.",
"This is your piece written in HTML and CSS — the language every web page is made of. Your boxes and this code always match.":
  "זה האביזר שלך כתוב ב-HTML וב-CSS — השפה שכל אתר באינטרנט עשוי ממנה. הקופסאות שלך והקוד הזה תמיד תואמים.",
"This is your piece written in HTML and CSS — the language every web page is made of. Tap any value to change it exactly.":
  "זה האביזר שלך כתוב ב-HTML וב-CSS — השפה שכל אתר באינטרנט עשוי ממנה. תלחץ על כל ערך כדי לשנות אותו בדיוק.",
"Copy code":"להעתיק את הקוד",
"Copied! Paste it into an HTML file to see it in a browser.":
  "הועתק! תדביק את זה בקובץ HTML כדי לראות את זה בדפדפן.",
"Could not copy — select the code and copy it by hand.":
  "לא הצלחתי להעתיק — תסמן את הקוד ותעתיק ידנית.",
"Class name":"שם ה-class",
/* the CSS property names the editing strip echoes. They are the words in
   the stylesheet, so they stay as they are written there — a property is
   an identifier, not a sentence. */
/* the palette's colour names — they are also the words that end up in the
   class names, so a child sees the swatch they tapped in the stylesheet */
"Gold":"זהב","Sand":"חול","Amber":"ענבר","Coral":"אלמוג","Cherry":"דובדבן",
"Blush":"ורוד","Sky":"שמיים","Ocean":"אוקיינוס","Leaf":"עלה","Pine":"אורן",
"Violet":"סגול","Snow":"שלג","Cloud":"ענן","Stone":"אבן","Cocoa":"קקאו","Ink":"דיו",
"Name it":"תן שם","Clear":"לנקות","Save":"לשמור","Delete":"למחוק",
"Piece name":"שם האביזר",
"Smooth":"חלק","Blocky":"מרובע",
"My piece":"האביזר שלי","Eraser":"מחק",
"Paint something first!":"קודם תצייר משהו!",
"Make your own hat":"להכין כובע משלך",
"Make your own outfit":"להכין תלבושת משלך",
"Make your own shoes":"להכין נעליים משלך",
"Idle":"עומד","Walk":"הולך",
"Hard Hat":"קסדה","Top Hat":"מגבעת","Graduate":"בוגר","Ranger":"פרש",
"Crown":"כתר","Party":"מסיבה",
"Hi-Vis Vest":"אפוד זוהר","Builder Apron":"סינר בנאי","Stripes":"פסים",
"Hoodie":"קפוצ׳ון","Lab Coat":"חלוק מעבדה","Cape":"גלימה",
"Work Boots":"מגפי עבודה","Sneakers":"נעלי ספורט","Wellies":"מגפי גשם",
"Rocket Boots":"מגפי רקטה",
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
"Language":"שפה",
/* "English · עברית" needs no entry: it is already in both languages, and a
   string the dictionary does not know is left exactly as it is. As an entry
   that translated to itself it was the trigger for the freeze above. */
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

/* ---- block conditions and pickers (shown inside If / While blocks) ---- */
"tree ahead":"עץ לפנים","rock ahead":"סלע לפנים","iron ahead":"ברזל לפנים",
"water ahead":"מים לפנים","wall ahead":"קיר לפנים","pit ahead":"בור לפנים",
"key ahead":"מפתח לפנים","locked door ahead":"דלת נעולה לפנים",
"closed gate ahead":"שער סגור לפנים","number ahead":"מספר לפנים",
"block under me":"בלוק מתחתיי","number under me":"מספר מתחתיי",
"carrying a block":"נושא בלוק","number I'm holding":"המספר שאני מחזיק",
"bag full":"התיק מלא","bag empty":"התיק ריק","tired":"עייף","blocked":"חסום",
"on a plate":"על לחצן","on a target":"על יעד",
"my row":"השורה שלי","my column":"העמודה שלי",
"another robot called it":"רובוט אחר קרא לזה",
"go to the nearest X":"לך אל ה-X הקרוב ביותר",
"not equal":"לא שווה",
"Variable name:":"שם משתנה:",
"Challenge name:":"שם האתגר:",

/* ---- quests ---- */
"Walk 150 steps":"ללכת 150 צעדים",
"Run a program with a loop":"להריץ תוכנית עם לולאה",
"Run 2 robots at the same time":"להריץ 2 רובוטים בו-זמנית",
"Complete a Build Project":"לסיים פרויקט בנייה",
"Find a treasure chest":"למצוא תיבת אוצר",
"Make a robot say something":"לגרום לרובוט להגיד משהו",
"Claim reward":"קבל פרס","Quest complete:":"משימה הושלמה:",
"LEVEL":"רמה","Day":"יום",
"level up to unlock a perk":"עלה רמה כדי לפתוח הטבה",
"Skills — level up by doing":"כישורים — עולים רמה בעשייה",

/* ---- shop + unlocks ---- */
"Tap a hat to wear it!":"לחץ על כובע כדי לחבוש אותו!",
"Hats unlock as you level up (first at level 2)":
  "כובעים נפתחים ככל שעולים רמה (הראשון ברמה 2)",
"That file isn't a CodeCraft world.":"הקובץ הזה הוא לא עולם של CodeCraft.",

/* ---- settings, account, boot ---- */
"Your name:":"השם שלך:","Hidden players:":"שחקנים מוסתרים:",
"Really erase your world, robots and coins?":
  "באמת למחוק את העולם, הרובוטים והמטבעות שלך?",
"Delete account":"מחיקת חשבון","log out":"התנתקות",
"You're not signed in.":"אתה לא מחובר.",
"Your session expired — log in again first.":"הסשן פג — התחבר שוב.",
"Tap again to delete forever":"לחץ שוב כדי למחוק לצמיתות",
"Still fine to change your mind.":"עדיין אפשר להתחרט.",
"Deleting your account…":"מוחק את החשבון שלך…",
"Your account is gone. Starting fresh…":"החשבון שלך נמחק. מתחילים מחדש…",
"Password (6+)":"סיסמה (6+)",
"Enter your email and a 6+ character password":"הזן אימייל וסיסמה של 6 תווים ומעלה",
"Creating your account…":"יוצר את החשבון שלך…","Logging in…":"מתחבר…",
"Loading your world…":"טוען את העולם שלך…",
"Play offline":"שחק במצב לא מקוון",
"Couldn't reach the cloud — playing on this device.":
  "לא הצלחתי להתחבר לענן — משחקים על המכשיר הזה.",
"Check your email to confirm your address, then log in!":
  "בדוק את המייל שלך כדי לאשר את הכתובת, ואז התחבר!",
"Following":"עוקב אחרי","Shrink editor":"הקטן עורך",
"Online mode isn't connected yet.":"מצב מקוון עדיין לא מחובר.",

/* ---- challenges: complete strings (fragments joined with a name or a
        number cannot match whole-string and are left for now) ---- */
"CHALLENGE SOLVED!":"האתגר נפתר!","CHAPTER COMPLETE!":"הפרק הושלם!",
"PROJECT COMPLETE!":"הפרויקט הושלם!",
"Community challenge by":"אתגר קהילה מאת",
"Create your own":"צור משלך","Delete Level":"מחק שלב","Delete level":"מחק שלב",
"Delete this input":"מחק את הקלט הזה","Edit level":"ערוך שלב",
"Edit this challenge":"ערוך את האתגר הזה",
"Hide everything by this player":"הסתר הכול מהשחקן הזה",
"Hide this input from the player":"הסתר את הקלט הזה מהשחקן",
"Put this input on the board":"שים את הקלט הזה על הלוח",
"Leave edit mode and start a new level":"צא ממצב עריכה והתחל שלב חדש",
"Log out":"התנתק","My Challenge":"האתגר שלי",
"Fill the blueprint":"מלא את התוכנית","Fill the whole blueprint":"מלא את כל התוכנית",
"Sort Any Row":"מיין כל שורה",
"Sort the numbered blocks into order":"מיין את הבלוקים הממוספרים לפי הסדר",
"Design a blueprint, prove it solvable, then share it with other players.":
  "עצב תוכנית, הוכח שאפשר לפתור אותה, ואז שתף אותה עם שחקנים אחרים.",
"Players everywhere can now try to solve your challenge!":
  "שחקנים בכל מקום יכולים עכשיו לנסות לפתור את האתגר שלך!",
"Your changes are live for everyone who plays it!":
  "השינויים שלך חיים לכל מי שמשחק בו!",
"You solved your own challenge!":"פתרת את האתגר של עצמך!",
"Amazing!":"מדהים!","Awesome!":"אדיר!","Nice!":"יפה!","Sweet!":"מתוק!",
"Medium":"בינוני","Hard":"קשה","Colour":"צבע","Function":"פונקציה",
"Enter email and a 6+ char password":"הזן אימייל וסיסמה של 6 תווים ומעלה",
"Creating account…":"יוצר חשבון…","Welcome back!":"ברוך שובך!",
"Account created!":"החשבון נוצר!","Solved your challenge!":"פתרת את האתגר שלך!",
"Check your email to confirm, then log in!":"אשר את המייל שלך ואז התחבר!",
"Update level":"עדכן שלב","Update":"עדכן",
"Input removed.":"הקלט הוסר.","Level removed.":"השלב הוסר.",
"empty hands":"ידיים ריקות","the secret test":"המבחן הסודי",
"bank the board":"שמור את הלוח",
"is now a secret test.":"הוא עכשיו מבחן סודי.",
"is visible again.":"גלוי שוב.",

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
"Clears the board and starts a new input on it":"מנקה את הלוח ומתחיל עליו קלט חדש",
/* ---- academy ---- */
"ACADEMY COMPLETE!":"האקדמיה הושלמה!",
"EVERY LESSON DONE!":"כל השיעורים הושלמו!",
"First Steps":"צעדים ראשונים",
"Keep Count":"לספור",
"Loop the Forest":"לולאה ביער",
"Name the Job":"לתת שם לעבודה",
"One Program, Any Row":"תוכנית אחת, כל שורה",
"Repeat vs While":"חזור מול כל עוד",
"Smart Chopper":"כורת חכם",
"Timber!":"עץ נופל!",
"Treasure Hunt":"ציד אוצרות",
"Until It's Done":"עד שזה נגמר",
"Change by":"שנה ב",
"Set variable":"קבע משתנה",
"The block budget":"תקציב הבלוקים",
"The same, the other way.":"אותו דבר, לכיוון השני.",
"The world is yours!":"העולם שלך!",
"Try the lazy way first":"קודם תנסה בדרך העצלה",
"Why it's cheaper":"למה זה זול יותר",
"You can write real programs now":"אתה יכול לכתוב תוכניות אמיתיות עכשיו",
"Let's play! 🎉":"בוא נשחק! 🎉",
"Onwards! 🚀":"קדימה! 🚀",
"5 trees, 3 blocks. That is the whole idea of a loop.":
  "5 עצים, 3 בלוקים. זה כל הרעיון של לולאה.",
"A loop that asks a question before EVERY turn, and keeps looping while the answer stays yes.":
  "לולאה ששואלת שאלה לפני כל סיבוב, וממשיכה כל עוד התשובה היא כן.",
"A set of steps that works for every case, not just the one in front of you. This is the real thing programmers write.":
  "סדרת צעדים שעובדת לכל מקרה, לא רק לזה שלפניך. זה מה שמתכנתים באמת כותבים.",
"Adds to the box. Add 1 each time you find a block.":
  "מוסיף לקופסה. הוסף 1 בכל פעם שאתה מוצא בלוק.",
"Asks a question RIGHT NOW, and only runs the blocks inside when the answer is yes.":
  "שואל שאלה עכשיו, ומריץ את הבלוקים שבפנים רק אם התשובה היא כן.",
"Count the trees if you like — then don't. You won't need the number.":
  "תספור את העצים אם בא לך — ואז אל. לא תצטרך את המספר.",
"Look at the row of inputs at the top — your program runs once for each.":
  "תסתכל על שורת הקלטים למעלה — התוכנית שלך רצה פעם אחת לכל אחד.",
"Loops, conditions, variables, functions and algorithms — that is genuinely what programming is. Go and build something nobody has built yet.":
  "לולאות, תנאים, משתנים, פונקציות ואלגוריתמים — זה באמת מה שתכנות הוא. לך תבנה משהו שאף אחד עוד לא בנה.",
"Makes a named box to remember a number. Start your counter at 0.":
  "יוצר קופסה עם שם שזוכרת מספר. תתחיל את המונה מ-0.",
"Nothing about your program mentions 4, or 3, or 1 — that's what makes it an algorithm.":
  "שום דבר בתוכנית שלך לא מזכיר 4, או 3, או 1 — זה מה שהופך אותה לאלגוריתם.",
"One step forward, in whatever direction the robot is already facing.":
  "צעד אחד קדימה, לכיוון שאליו הרובוט כבר פונה.",
"Run it. The same 3 blocks would clear 5 trees or 500.":
  "תריץ. אותם 3 בלוקים היו מפנים 5 עצים או 500.",
"Runs the blocks INSIDE it again and again, a set number of times.":
  "מריץ את הבלוקים שבתוכו שוב ושוב, מספר פעמים קבוע.",
"Runs the job. Calling A three times costs 3 blocks — writing it out three times costs a lot more.":
  "מריץ את העבודה. לקרוא ל-A שלוש פעמים עולה 3 בלוקים — לכתוב אותה שלוש פעמים עולה הרבה יותר.",
"Runs your blocks from top to bottom, one at a time. Watch the robot follow them.":
  "מריץ את הבלוקים שלך מלמעלה למטה, אחד אחרי השני. תראה את הרובוט הולך אחריהם.",
"Tells us the answer. The level checks what the robot says.":
  "אומר לנו את התשובה. השלב בודק מה הרובוט אומר.",
"The same counting job — but now on FOUR different rows, and your one program has to get all four right. Guessing the number works for one row and fails the rest.":
  "אותה עבודת ספירה — אבל עכשיו על ארבע שורות שונות, והתוכנית האחת שלך צריכה לפתור את כולן. לנחש את המספר עובד לשורה אחת ונכשל בשאר.",
"This is exactly how your robots gather wood, stone and crystal out in the world.":
  "זה בדיוק איך שהרובוטים שלך אוספים עץ, אבן וגביש בעולם.",
"Turns the robot on the spot. It does NOT move — turning costs a step but changes nothing else.":
  "מסובב את הרובוט במקום. הוא לא זז — סיבוב עולה צעד אבל לא משנה שום דבר אחר.",
"Writing the job out three times needs 17 blocks. You only have 13.":
  "לכתוב את העבודה שלוש פעמים דורש 17 בלוקים. יש לך רק 13.",
"You do NOT need to stand on the tree — chopping reaches the tile ahead.":
  "אתה לא צריך לעמוד על העץ — הכריתה מגיעה למשבצת שלפניך.",
"Every lesson done — loops, conditions, variables, functions and algorithms. Replay any of them any time.":
  "כל השיעורים הושלמו — לולאות, תנאים, משתנים, פונקציות ואלגוריתמים. אפשר לחזור על כל אחד מהם מתי שרוצים.",
"Add enough of them to cross the gap to the 🚩 flag.":
  "תוסיף מספיק מהם כדי לחצות את הפער אל 🚩 הדגל.",
"Move across until the robot is under the 🚩 flag.":"תעבור עד שהרובוט נמצא מתחת ל-🚩 הדגל.",
"Press ▶ and watch. Too few or too many and it won't land on the flag.":
  "תלחץ ▶ ותסתכל. מעט מדי או הרבה מדי והוא לא ינחת על הדגל.",
"Press ▶. It has to pass all four rows to win.":
  "תלחץ ▶. הוא צריך לעבור את כל ארבע השורות כדי לנצח.",
"Add ✋ Collect to pick it up.":"תוסיף ✋ אסוף כדי להרים אותו.",
"Add 🪓 Chop.":"תוסיף 🪓 כרות.",
"Add ⬆️ Move blocks to finish the trip.":"תוסיף בלוקים של ⬆️ זוז כדי לסיים את הדרך.",
/* ---- challenges ---- */
"Big House":"בית גדול",
"Race Car":"מכונית מרוץ",
"Theme Park":"פארק שעשועים",
"Sort the Blocks":"מיין את הבלוקים",
"PUBLISHED!":"פורסם!",
"SOLVED!":"נפתר!",
"UPDATED!":"עודכן!",
"Log in":"התחבר",
"Sign up":"הרשמה",
"Report this challenge":"דווח על האתגר הזה",
"How to design a great challenge":"איך לעצב אתגר מעולה",
"— paint the whole blueprint":"— צבע את כל התוכנית",
"— sort the numbered blocks into order":"— סדר את הבלוקים הממוספרים לפי הסדר",
"publish challenges &amp; sync progress":"לפרסם אתגרים ולסנכרן התקדמות",
"Build the car body: fill the whole 5×2 plate. Paint one row, make a U-turn, paint the row back. Budget: 12 blocks.":
  "בנה את גוף המכונית: מלא את כל הלוח 5×2. צבע שורה אחת, עשה פניית פרסה, וצבע את השורה חזרה. תקציב: 12 בלוקים.",
"Fence the whole Theme Park: paint the 6×5 outline. The sides have DIFFERENT lengths — two loops inside one loop. Budget: 9 blocks. This is expert work!":
  "גדר את כל פארק השעשועים: צבע את המסגרת 6×5. לצלעות יש אורכים שונים — שתי לולאות בתוך לולאה אחת. תקציב: 9 בלוקים. זו עבודה של מומחים!",
"Lay the walls of the Big House: paint every tile of the 4×4 outline. Your robot drops a brick on the tile it's STANDING on. Budget: 8 blocks — you'll need a loop inside a loop!":
  "הנח את קירות הבית הגדול: צבע כל משבצת במסגרת 4×4. הרובוט שלך מניח לבנה על המשבצת שהוא עומד עליה. תקציב: 8 בלוקים — תצטרך לולאה בתוך לולאה!",
"Six rules that make a level worth solving, what turns a puzzle into a real algorithm question, and five ready boards you can build on.":
  "שישה כללים שהופכים שלב לכזה ששווה לפתור, מה הופך חידה לשאלת אלגוריתם אמיתית, וחמישה לוחות מוכנים לבנות עליהם.",
/* ---- puzzle chapters ---- */
"Add Up the Row":"לחבר את השורה",
"Bridge It":"לגשר",
"Bridge, Then Build":"לגשר, ואז לבנות",
"Carry It Further":"לסחוב רחוק יותר",
"Count the Big Ones":"לספור את הגדולים",
"Escape Any Maze":"לצאת מכל מבוך",
"Feel Your Way":"למשש את הדרך",
"Find the Biggest":"למצוא את הגדול ביותר",
"First Wall":"הקיר הראשון",
"Leave It Behind":"להשאיר מאחור",
"Locked Machine":"מכונה נעולה",
"Locked Vault":"כספת נעולה",
"Mind the Gap":"להיזהר מהפער",
"One Job, Many Times":"עבודה אחת, הרבה פעמים",
"One Key, One Door":"מפתח אחד, דלת אחת",
"One Way Only":"כיוון אחד בלבד",
"Portal Vault":"כספת שערים",
"The Full Machine":"המכונה המלאה",
"The Key Is Elsewhere":"המפתח נמצא במקום אחר",
"The Long Corridor":"המסדרון הארוך",
"The Machine":"המכונה",
"Two Colours":"שני צבעים",
"Two Holes":"שני חורים",
"Where Is It?":"איפה זה?",
"How many numbers are bigger than 4?":"כמה מספרים גדולים מ-4?",
"What do all the numbers add up to?":"כמה כל המספרים יחד?",
"What is the biggest number in the row?":"מה המספר הגדול ביותר בשורה?",
"Which position holds the 7? (the first block is position 0)":
  "באיזו עמדה נמצא ה-7? (הבלוק הראשון הוא עמדה 0)",
"Doors stay shut until the robot is carrying a key of the same colour.":
  "דלתות נשארות סגורות עד שהרובוט נושא מפתח באותו צבע.",
"Gates open while their plates are held down — by the robot, or by a block it leaves behind.":
  "שערים נפתחים כל עוד הלחצנים שלהם לחוצים — על ידי הרובוט, או על ידי בלוק שהוא השאיר.",
"Keep a running total: start at 0, and for every block you stand on, ➕ Change the total BY the number you just read.":
  "תחזיק סכום רץ: תתחיל מ-0, ולכל בלוק שאתה עומד עליו, ➕ שנה את הסכום במספר שקראת עכשיו.",
"Now the real thing: write ONE program that is right for every row we give it — including one you never see.":
  "עכשיו הדבר האמיתי: תכתוב תוכנית אחת שנכונה לכל שורה שניתן לך — כולל אחת שלא תראה בכלל.",
"Pits can't be crossed — unless the robot drops a block into one first.":
  "אי אפשר לחצות בורות — אלא אם הרובוט מפיל לתוכם בלוק קודם.",
"Same walk, but this time only count the blocks that pass a test. Counting IF something is true is one of the most useful things a program does.":
  "אותה הליכה, אבל הפעם תספור רק את הבלוקים שעוברים מבחן. לספור אם משהו נכון זה אחד הדברים הכי שימושיים שתוכנית עושה.",
"The block is nowhere near the hole. Pick it up and CARRY it — the robot keeps holding it while it walks.":
  "הבלוק לא נמצא בכלל ליד החור. תרים אותו ותסחב אותו — הרובוט ממשיך להחזיק בו בזמן שהוא הולך.",
"Two doors, two colours. Collect BOTH keys before you set off — the robot keeps every key it finds.":
  "שתי דלתות, שני צבעים. תאסוף את שני המפתחות לפני שאתה יוצא — הרובוט שומר כל מפתח שהוא מוצא.",
"Walk the row, remember the biggest number you've seen, and 💬 Say it at the end. The rows are different every time — so no guessing.":
  "תעבור את השורה, תזכור את המספר הגדול ביותר שראית, ו-💬 אמור אותו בסוף. השורות שונות בכל פעם — אז אין ניחושים.",
"Walls block the way. Teach your robot to find a way around them.":
  "קירות חוסמים את הדרך. תלמד את הרובוט שלך למצוא דרך לעקוף אותם.",
"A wall sits between you and the 🚩. Step around it: up, across, and back down.":
  "קיר עומד בינך לבין 🚩. תעקוף אותו: למעלה, לרוחב, וחזרה למטה.",
"Cross the hole, then lay the last two tiles of the plan with 🔨 Build. The bridge block doesn't count against you.":
  "תחצה את החור, ואז תניח את שתי המשבצות האחרונות בתוכנית עם 🔨 בנה. בלוק הגשר לא נספר לחובתך.",
"Two walls, and the SAME dodge works for both. Find the pattern, then 🔁 Repeat it twice.":
  "שני קירות, ואותה התחמקות עובדת לשניהם. תמצא את התבנית, ואז 🔁 חזור עליה פעמיים.",
/* ---- creator guide ---- */
"Bridge the Gap":"לגשר על הפער",
"Line Them Up":"לסדר אותם בשורה",
"Only Where It Counts":"רק איפה שזה נחשב",
"The Detour":"העיקוף",
"The Long Row":"השורה הארוכה",
"Breaks?":"נשבר?",
"Still solves it?":"עדיין פותר אותו?",
"So run the":"אז תריץ את",
"same program, unchanged":"אותה תוכנית, בלי שינוי",
"shuffle test":"מבחן הערבוב",
"that exact number":"בדיוק את המספר הזה",
"The built-in 🧠":"ה-🧠 המובנה",
"One idea per level":"רעיון אחד לכל שלב",
"Say it in one sentence":"תגיד את זה במשפט אחד",
"Build a ladder, not a wall":"תבנה סולם, לא קיר",
"Make the robot look, not remember":"תגרום לרובוט להסתכל, לא לזכור",
"Prove it, then try to break it":"תוכיח את זה, ואז תנסה לשבור אותו",
"A great level makes the robot":"שלב מעולה גורם לרובוט",
"The block budget is your difficulty dial":"תקציב הבלוקים הוא חוגת הקושי שלך",
"Lay out your numbered blocks and add them as input 1.":
  "סדר את הבלוקים הממוספרים שלך והוסף אותם כקלט 1.",
"Move the blocks, add them again as input 2. Up to eight.":
  "תזיז את הבלוקים, ותוסיף אותם שוב כקלט 2. עד שמונה.",
"Tap one and it lands on your canvas. Solve it, then change it until it is yours.":
  "לחץ על אחד והוא נוחת על הקנבס שלך. תפתור אותו, ואז תשנה אותו עד שהוא שלך.",
"You wrote an algorithm. That is a question worth publishing.":
  "כתבת אלגוריתם. זו שאלה ששווה לפרסם.",
"and build the whole board around it. Two new ideas at once and nobody finishes.":
  "ותבנה את כל הלוח סביבו. שני רעיונות חדשים בבת אחת ואף אחד לא מסיים.",
"chapter is made entirely of questions that pass this test — play it when you want ideas.":
  "בנוי כולו משאלות שעוברות את המבחן הזה — תשחק בו כשאתה מחפש רעיונות.",
"input, and you only prove the level — and only unlock 💾 Save — if all of them pass.":
  "קלט, ואתה מוכיח את השלב — ופותח 💾 שמור — רק אם כולם עוברים.",
"is directions you memorised. An":"אלה הוראות ששיננת. ואילו",
"program and press ▶. It runs against":"תוכנית ותלחץ ▶. היא רצה מול",
"still works after the board changes — that is the whole difference.":
  "עדיין עובד אחרי שהלוח משתנה — זה כל ההבדל.",
"A wall sits between the robot and its target. The only way is around — the smallest level that makes ↪️ Turn matter.":
  "קיר עומד בין הרובוט ליעד שלו. הדרך היחידה היא לעקוף — השלב הקטן ביותר שבו ↪️ פנה באמת חשוב.",
"Eight targets in a straight line, and a budget of 4 blocks. You cannot paste your way out — the player has to find the loop.":
  "שמונה יעדים בקו ישר, ותקציב של 4 בלוקים. אי אפשר להעתיק את הדרך החוצה — השחקן חייב למצוא את הלולאה.",
"Two pits block the corridor. The robot has to make a brick, carry it, and drop it into the hole to walk across its own bridge.":
  "שני בורות חוסמים את המסדרון. הרובוט צריך ליצור לבנה, לסחוב אותה, ולהפיל אותה לחור כדי לעבור על הגשר שהוא בנה.",
"Your player will just memorise the answer. Give the robot a way to look at the board instead of a route to follow: 📖 Read, ❓ If, 🔄 While.":
  "השחקן שלך פשוט ישנן את התשובה. תן לרובוט דרך להסתכל על הלוח במקום מסלול ללכת אחריו: 📖 קרא, ❓ אם, 🔄 כל עוד.",
"\"fetch the key, then open the door\"":"„להביא את המפתח, ואז לפתוח את הדלת”",
"\"fill every tile in the row\"":"„למלא כל משבצת בשורה”",
/* ---- mentor ---- */
"Explain loops":"תסביר לולאות",
"Give me an idea":"תן לי רעיון",
"How can I make this faster?":"איך אפשר לעשות את זה מהר יותר?",
"How do I earn coins?":"איך מרוויחים מטבעות?",
"Tell me about python":"ספר לי על פייתון",
"Why isn't my robot moving?":"למה הרובוט שלי לא זז?",
"what should":"מה כדאי",
/* ---- tower editor ---- */
"Always available":"תמיד זמין",
"Design a level":"עצב שלב",
"Erase everything on the tile":"מחק הכול מהמשבצת",
"Level hint for the player":"רמז לשחקן",
"Pit — a hole to jump across":"בור — חור שצריך לקפוץ מעליו",
"Ground — raise the terrain the robot starts on":"קרקע — הגבה את השטח שהרובוט מתחיל עליו",
"Start — tap the same tile again to turn":"התחלה — לחץ שוב על אותה משבצת כדי לפנות",
"Tap to allow it":"לחץ כדי לאפשר",
"Tap to take it away":"לחץ כדי להסיר",
"Blueprint — tap to add a level, hold to clear":"תוכנית — לחץ להוספת קומה, החזק כדי לנקות",
"Players everywhere can now climb your tower!":
  "שחקנים בכל מקום יכולים עכשיו לטפס על המגדל שלך!",
"Switch between a flat 2D challenge and a 3D Tower level":
  "החלף בין אתגר שטוח דו-ממדי לשלב מגדל תלת-ממדי",
"The robot starts inside a 🕳️ pit.":"הרובוט מתחיל בתוך 🕳️ בור.",
"The robot starts off the board — place it with 🤖.":"הרובוט מתחיל מחוץ ללוח — הנח אותו עם 🤖.",
"What should the player read when the level opens?":"מה השחקן צריך לקרוא כשהשלב נפתח?",
"Your Tower level is live for everyone who plays it!":"שלב המגדל שלך באוויר לכל מי שמשחק!",
"Your own tower — plan it, prove it, publish it":
  "המגדל שלך — תכנן אותו, תוכיח אותו, תפרסם אותו",
"Back to the flat 2D board?\n\nYour 3D blueprint is cleared.":
  "לחזור ללוח השטוח הדו-ממדי?\n\nהתוכנית התלת-ממדית שלך תימחק.",
"Switch to 🧊 3D Tower mode?\n\nThe flat board and the program you've written are cleared — you design with heights instead.":
  "לעבור למצב 🧊 מגדל תלת-ממדי?\n\nהלוח השטוח והתוכנית שכתבת יימחקו — במקום זה מעצבים עם גבהים.",
/* ---- world, moderation, tower 3D, orders, shop ---- */
"Copied from someone else":"מועתק ממישהו אחר",
"Impossible or broken":"בלתי אפשרי או שבור",
"Rude or mean words":"מילים גסות או פוגעניות",
"Scary or not for kids":"מפחיד או לא לילדים",
"Something else":"משהו אחר",
"Give it a name first.":"קודם תן לזה שם.",
"Show challenges from everyone again?":"להציג שוב אתגרים מכולם?",
"That name isn't allowed — pick something else.":"השם הזה לא מותר — תבחר משהו אחר.",
"Names can't contain links, contact details or long numbers.":
  "שמות לא יכולים להכיל קישורים, פרטי קשר או מספרים ארוכים.",
"Pick a name to sign your challenges with.\n\nOther players will see this — don't use your real name, your school or anything private.":
  "בחר שם לחתום בו על האתגרים שלך.\n\nשחקנים אחרים יראו אותו — אל תשתמש בשם האמיתי שלך, בבית הספר שלך או בכל דבר פרטי.",
"Climb Up":"טפס למעלה",
"Jump Gap":"קפוץ מעל פער",
"Step Down":"רד מדרגה",
"Take Brick":"קח לבנה",
"Down and Over":"למטה ומעבר",
"The Corner":"הפינה",
"The Long Ramp":"הרמפה הארוכה",
"can climb up 🪜":"יכול לטפס למעלה 🪜",
"can jump across 🦘":"יכול לקפוץ מעבר 🦘",
"gap ahead 🕳️":"פער לפנים 🕳️",
"step down ahead ⬇️":"מדרגה למטה לפנים ⬇️",
"tile ahead needs a brick 🧱":"המשבצת שלפנים צריכה לבנה 🧱",
"Builds with height — stack, climb, and rebuild the blueprint in 3D.":
  "בונה עם גובה — לערום, לטפס, ולבנות מחדש את התוכנית בתלת-ממד.",
"ORDER FILLED!":"ההזמנה מולאה!",
"Delivered before the clock ran out — that is what a fast program buys you.":
  "נמסר לפני שנגמר הזמן — זה מה שתוכנית מהירה נותנת לך.",
"Deliver by":"למסור עד",
"A new order goes up every few seconds — keep gathering in the meantime.":
  "הזמנה חדשה עולה כל כמה שניות — תמשיך לאסוף בינתיים.",
"at the 🏪 market — whatever you sell counts towards the order automatically.":
  "ב-🏪 שוק — כל מה שאתה מוכר נספר להזמנה אוטומטית.",
"asks for a little of two or three different things, and they sit in different places. The quick answer is":
  "מבקשת קצת משניים או שלושה דברים שונים, והם נמצאים במקומות שונים. התשובה המהירה היא",
"asks for one resource in volume — far more than a bag holds, so most of the work is the walking. The quick answer is a":
  "מבקשת חומר אחד בכמות — הרבה יותר ממה שתיק מכיל, אז רוב העבודה היא ההליכה. התשובה המהירה היא",
"Load into 🔧 B":"טען אל 🔧 B",
"· takes nothing":"· לא מקבל כלום",
"Bigger Bag +4 — 60 🪙":"תיק גדול יותר +4 — 60 🪙",
"New Robot — 100 🪙":"רובוט חדש — 100 🪙",
"Speed Boost — 80 🪙":"האצה — 80 🪙",
/* ---- account, build, editor, journey, tutorial, skills ---- */
"DAILY GIFT":"מתנה יומית",
"NEW POWER":"כוח חדש",
"Let’s try it! 🚀":"בוא ננסה! 🚀",
"Deleting…":"מוחק…",
"Every challenge you published — they come off the community list for everyone":
  "כל אתגר שפרסמת — הם יורדים מרשימת הקהילה של כולם",
"The progress saved on this device":"ההתקדמות ששמורה במכשיר הזה",
"Your email and password. You won't be able to log in again":
  "האימייל והסיסמה שלך. לא תוכל להתחבר שוב",
"Your saved game in the cloud — coins, levels, robots and every program you wrote":
  "המשחק השמור שלך בענן — מטבעות, רמות, רובוטים וכל תוכנית שכתבת",
"delete account":"מחק חשבון",
"Blue Roof":"גג כחול",
"Green Roof":"גג ירוק",
"Purple Roof":"גג סגול",
"Market Stall":"דוכן שוק",
"new blocks → after selection":"בלוקים חדשים ← אחרי הבחירה",
"new blocks → inside Else":"בלוקים חדשים ← בתוך אחרת",
"Hold & drag to move":"החזק וגרור כדי להזיז",
"Text:":"טקסט:",
"is empty.":"ריק.",
"Put the steps you repeat in here, then 🔧 Call it from your main program.":
  "שים כאן את הצעדים שאתה חוזר עליהם, ואז 🔧 קרא לזה מהתוכנית הראשית שלך.",
"Catch the values it gives back in which variables?\nComma-separated, in order. Empty = throw them away.":
  "לתפוס את הערכים שהיא מחזירה לאילו משתנים?\nמופרדים בפסיקים, לפי הסדר. ריק = לזרוק אותם.",
"Robot team":"צוות רובוטים",
"Steps walked":"צעדים שהלכת",
"Coding challenges: Big House, Car, Theme Park…":"אתגרי תכנות: בית גדול, מכונית, פארק שעשועים…",
"Load a world back from a file. This replaces the world you have now.":
  "טען עולם בחזרה מקובץ. זה מחליף את העולם שיש לך עכשיו.",
"Saves your whole world to a file on this device. Keep it anywhere.":
  "שומר את כל העולם שלך לקובץ במכשיר הזה. תשמור אותו איפה שתרצה.",
"Projects ▸ Build Projects":"פרויקטים ▸ פרויקטי בנייה",
"Projects ▸ Create your own":"פרויקטים ▸ ליצור משלך",
"Projects ▸ Starter Academy":"פרויקטים ▸ אקדמיית הפתיחה",
"Projects ▸ Tower Mode":"פרויקטים ▸ מצב מגדל",
"the 🧩 Code button":"כפתור 🧩 קוד",
"the 📋 board — tap the ⏱ chip up top":"לוח 📋 — לחץ על תווית ⏱ למעלה",
"—  that's the whole journey! 🏆":"—  זה כל המסע! 🏆",
"button and watch your robot!":"ותראה את הרובוט שלך!",
"it!":"אותו!",
"or a":"או",
/* ---- walkthrough leftovers ---- */
"My saved functions":"הפונקציות השמורות שלי",
"Refresh":"רענן",
"Tap":"לחץ על",
"to write your program, then press":"כדי לכתוב את התוכנית שלך, ואז תלחץ",
"to run it here.":"כדי להריץ אותה כאן.",
"Labyrinth":"מבוך",
"Algorithms":"אלגוריתמים",
"publish challenges & sync progress":"לפרסם אתגרים ולסנכרן התקדמות",
"Six quick lessons take you from your first Move to loops & conditions — then four more teach variables, functions and algorithms.":
  "שישה שיעורים קצרים לוקחים אותך מהזוז הראשון ללולאות ותנאים — ואז עוד ארבעה מלמדים משתנים, פונקציות ואלגוריתמים.",
/* ---- academy names ---- */
"Turn & Go":"לפנות וללכת",
"Function (A)":"פונקציה (A)",
"Algorithm":"אלגוריתם",
"blank":"ריק",
/* ---- audit leftovers ---- */
"Hide":"הסתר",
"Zigzag":"זיגזג",
/* ---- version row ---- */
"Tap Update to fetch the newest version of the game.":
  "לחץ על עדכן כדי להוריד את הגרסה החדשה ביותר של המשחק.",
/* ---- resource nouns ---- */
"wood":"עץ",
"stone":"אבן",
"iron":"ברזל",
"crystal":"גביש",
"water":"מים",
"Wood":"עץ",
"Stone":"אבן",
"Iron":"ברזל",
"Crystal":"גביש",
"Water":"מים",
/* ---- focus mode ---- */
"Blocks only — hide everything else":"בלוקים בלבד — להסתיר את כל השאר",
"Show everything again":"להציג הכול שוב",
"Blocks only":"בלוקים בלבד",
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
/* The em-dash counts as decoration too. A lesson row is built as
   "<b>Move</b> — One step forward…", so the sentence reaches us as a text
   node that begins "— One step forward…" and missed a dictionary keyed on
   the sentence alone. Leading and trailing separators are stripped for the
   lookup and put back around the Hebrew, exactly like the emoji. */
const MARK="\\s\\u2013\\u2014\\u00b7:\\u2022\\u25cb\\u2713\\u2717";   // dashes, bullets, and the \u25CB \u2713 \u2717 a test row is prefixed with
const EDGE=new RegExp("^["+MARK+"\\p{Extended_Pictographic}\\uFE0F\\u200D\\u20E3]*|["+
  MARK+"\\p{Extended_Pictographic}\\uFE0F\\u200D\\u20E3]*$","gu");
const norm=s=>s.replace(STRIP,"").replace(/\s+/g," ").replace(EDGE,"").trim();

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
  "Sell the Bank — +{n}":"למכור את הבנק — +{n}",
  "Hats, outfits and shoes — {n} of {n} unlocked.":"כובעים, תלבושות ונעליים — {n} מתוך {n} נפתחו.",
  "Unlocks at level {n}":"נפתח ברמה {n}",
  "Colour {n}":"צבע {n}",
  "You already have {n} of these. Delete one to make another.":
    "כבר יש לך {n} כאלה. תמחק אחד כדי להכין עוד."
};

/* Ignoring emoji means two different English strings can normalise to the
   same key: the splash button "▶ Play" and the menu heading "Play" both
   became "Play", and the button ended up reading the heading's wording.
   A scoped entry wins over the global one for that element. */
const SCOPED=[
  ["#playBtn",       {"Play":"שחק","Play offline":"שחק במצב לא מקוון"}],
  ["#actionBar",     {"Reset":"אפס"}],
  [".hub-sec",       {"Play":"לשחק"}],
  /* Scoped to a block on purpose: "is" is two letters and could be a word in
     anyone's challenge name or robot name. Inside a block it is the is/is-not
     switch and nothing else. */
  [".blk",           {"is":"כן","is not":"לא"}]
];

/* Entries whose emoji sit INSIDE the sentence, not at its edges. The
   reconstruction below puts the node's leading and trailing emoji back
   around the Hebrew, which is right for "🧩 Code" and would silently drop
   the ⛓️ from "Collect 5 ⛓️ iron". These are used verbatim instead, and
   ui-icons.js turns whatever emoji they carry into icons either way. */
const HE_RAW={
  /* the emoji sit inside these sentences, so they are used as written */
  "Hats, outfits and shoes unlock as you level up ⭐ (first at level 2).":
    "כובעים, תלבושות ונעליים נפתחים כשאתה עולה רמה ⭐ (הראשון ברמה 2).",
  "Collect 10 🪵 wood":"לאסוף 10 🪵 עץ",
  "Collect 8 🪨 stone":"לאסוף 8 🪨 אבן",
  "Collect 5 ⛓️ iron":"לאסוף 5 ⛓️ ברזל",
  "Collect 2 💎 crystals":"לאסוף 2 💎 גבישים",
  "Build 2 🌉 bridges":"לבנות 2 🌉 גשרים",
  "Plant 3 🌱 saplings":"לשתול 3 🌱 שתילים",
  "Earn 80 🪙 at the market":"להרוויח 80 🪙 בשוק",
  "Complete a 🏗️ Build Project":"לסיים 🏗️ פרויקט בנייה",
  "Find a 🎁 treasure chest":"למצוא 🎁 תיבת אוצר",
  "Make a robot 💬 say something":"לגרום לרובוט 💬 להגיד משהו",
  "Run a program with a 🔁 loop":"להריץ תוכנית עם 🔁 לולאה",
  "🌉 bridge (2🪨)":"🌉 גשר (2🪨)",
  "🌱 sapling (1🪵)":"🌱 שתיל (1🪵)",
  "📦 chest (5🪵)":"📦 תיבה (5🪵)",
  "💰 market price of":"💰 מחיר השוק של",
  "📋 what the order wants":"📋 מה ההזמנה רוצה",
  "📋 how many it still needs":"📋 כמה עוד חסר לה",
  "Collect 5 resources to unlock 🔁 loops!":"אסוף 5 חומרים כדי לפתוח 🔁 לולאות!",
  "Sell something at the market 🏪 to unlock ❓ logic!":
    "מכור משהו בשוק 🏪 כדי לפתוח ❓ לוגיקה!",
  "Earn 150 🪙 total (or own 2 robots) to unlock 🧭 smart blocks!":
    "הרווח 150 🪙 בסך הכול (או שיהיו לך 2 רובוטים) כדי לפתוח 🧭 בלוקים חכמים!",
  "Earn 250 🪙 total to unlock 🧠 memory & variables!":
    "הרווח 250 🪙 בסך הכול כדי לפתוח 🧠 זיכרון ומשתנים!",
  "Buy a 2nd robot 🤖 to unlock 🤝 teamwork blocks!":
    "קנה רובוט שני 🤖 כדי לפתוח 🤝 בלוקים של עבודת צוות!",
  "🔁 LOOPS UNLOCKED! Repeat & Forever blocks are yours!":
    "🔁 לולאות נפתחו! הבלוקים חזור ולתמיד שלך!",
  "❓ LOGIC UNLOCKED! Your robots can now make decisions with If!":
    "❓ לוגיקה נפתחה! הרובוטים שלך יכולים עכשיו להחליט עם אם!",
  "🧭 SMART BLOCKS UNLOCKED! Face Nearest, Go Home & Sell All!":
    "🧭 בלוקים חכמים נפתחו! פנה לקרוב, חזור הביתה ומכור הכול!",
  "🧠 MEMORY UNLOCKED! Variables, counting loops & Say!":
    "🧠 זיכרון נפתח! משתנים, לולאות ספירה ואמור!",
  "💡 Tip: in full-screen mode, double-tap a block to delete it!":
    "💡 טיפ: במסך מלא, לחיצה כפולה על בלוק מוחקת אותו!",
  "🖌️ Paint the target tiles first (where blocks must end up)!":
    "🖌️ קודם צבע את משבצות היעד (איפה שהבלוקים צריכים לסיים)!",
  "🔐 Log in first — account box at the top of Projects.":
    "🔐 קודם התחבר — תיבת החשבון בראש עמוד החשבון.",
  "👋 Hi! I'm Byte, your coding mentor. Let's run through a few quick lessons at the Academy — then the whole open world is yours! 🦉":
    "👋 היי! אני Byte, המנטור שלך לתכנות. בוא נעבור כמה שיעורים קצרים באקדמיה — ואז כל העולם הפתוח שלך! 🦉",

/* ---- academy ---- */
"A job you write once and give a name. Tap the 🔧 A tab to write inside it.":
  "עבודה שכותבים פעם אחת ונותנים לה שם. לחץ על הלשונית 🔧 A כדי לכתוב בתוכה.",
"A whole forest — and you get 4 blocks. 🔄 While 🌳 tree ahead → 🪓 Chop, ⬆️ Move. It keeps going until the trees run out, so you never have to count them.":
  "יער שלם — ויש לך 4 בלוקים. 🔄 כל עוד 🌳 עץ לפנים ← 🪓 כרות, ⬆️ זוז. זה ממשיך עד שהעצים נגמרים, אז אף פעם לא צריך לספור אותם.",
"Add a 🔁 Repeat block and set its number to 5.":"תוסיף בלוק 🔁 חזור ותקבע את המספר שלו ל-5.",
"Add a 🔄 While block and set its question to “🌳 tree ahead”.":
  "תוסיף בלוק 🔄 כל עוד ותקבע את השאלה שלו ל„🌳 עץ לפנים”.",
"Add ↪️ Turn Right so it faces the flag.":"תוסיף ↪️ פנה ימינה כדי שיפנה אל הדגל.",
"Add ⬆️ Move blocks to walk to the next pair, then 🔧 Call A again — three times in all.":
  "תוסיף בלוקים של ⬆️ זוז כדי ללכת לזוג הבא, ואז 🔧 קרא ל-A שוב — שלוש פעמים בסך הכול.",
"After the loop, 💬 Say count.":"אחרי הלולאה, 💬 אמור את count.",
"Cuts down the 🌳 tree the robot is facing. If there is no tree there it just does nothing.":
  "כורת את 🌳 העץ שהרובוט פונה אליו. אם אין שם עץ, פשוט לא קורה כלום.",
"Drag ⬆️ Move and 🪓 Chop INSIDE the loop — blocks inside are indented.":
  "תגרור את ⬆️ זוז ואת 🪓 כרות לתוך הלולאה — הבלוקים שבפנים מוזחים פנימה.",
"Five trees, but only 4 blocks! Put ⬆️ Move and 🪓 Chop INSIDE a 🔁 Repeat so one small loop does the work of many.":
  "חמישה עצים, אבל רק 4 בלוקים! שים את ⬆️ זוז ואת 🪓 כרות בתוך 🔁 חזור, כך שלולאה קטנה אחת עושה את העבודה של הרבה.",
"Go back to 🧩 Main and add 🔧 Call, set to A.":"תחזור אל 🧩 ראשי ותוסיף 🔧 קרא, מכוון ל-A.",
"How many 🧱 blocks are in the row?":"כמה 🧱 בלוקים יש בשורה?",
"Inside A, write the little job: 🧱 Build, ⬆️ Move, ⬆️ Move, 🧱 Build.":
  "בתוך A, תכתוב את העבודה הקטנה: 🧱 בנה, ⬆️ זוז, ⬆️ זוז, 🧱 בנה.",
"Inside it put 🪓 Chop then ⬆️ Move.":"בתוכו שים 🪓 כרות ואז ⬆️ זוז.",
"Inside it, add ❓ If and set the question to “🌳 tree ahead”.":
  "בתוכו, תוסיף ❓ אם ותקבע את השאלה ל„🌳 עץ לפנים”.",
"Picks up the 💎 gem the robot is on, or the one right in front of it.":
  "מרים את 💎 האבן שהרובוט עומד עליה, או את זו שממש לפניו.",
"Put a 🔁 Repeat around everything so the robot walks the whole row.":
  "שים 🔁 חזור סביב הכול כדי שהרובוט יעבור את כל השורה.",
"Put 🪓 Chop INSIDE the If, and ⬆️ Move after it — so it only chops when there is something to chop.":
  "שים 🪓 כרות בתוך האם, ואת ⬆️ זוז אחריו — כך שהוא כורת רק כשיש מה לכרות.",
"Reach the 💎 gem and use ✋ Collect to pick it up — the same way you gather crystals and resources.":
  "תגיע אל 💎 האבן ותשתמש ב-✋ אסוף כדי להרים אותה — בדיוק כמו שאוספים גבישים וחומרים.",
"Robots do exactly what your code says. Add ⬆️ Move blocks until the robot reaches the 🚩 flag, then press ▶ to run.":
  "רובוטים עושים בדיוק מה שהקוד שלך אומר. תוסיף בלוקים של ⬆️ זוז עד שהרובוט מגיע אל 🚩 הדגל, ואז תלחץ ▶ להרצה.",
"Six quick lessons take you from your first Move to loops &amp; conditions — then four more teach variables, functions and algorithms.":
  "שישה שיעורים קצרים לוקחים אותך מהזוז הראשון ללולאות ותנאים — ואז עוד ארבעה מלמדים משתנים, פונקציות ואלגוריתמים.",
"Tap the 🔧 A tab at the top of the Blocks screen.":"לחץ על הלשונית 🔧 A בראש מסך הבלוקים.",
"Tap ⬆️ Move at the bottom to add it to your program.":
  "לחץ על ⬆️ זוז למטה כדי להוסיף אותו לתוכנית שלך.",
"The flag is around a corner! Use ↪️ Turn Right to change the way the robot faces, then ⬆️ Move toward the 🚩.":
  "הדגל מעבר לפינה! תשתמש ב-↪️ פנה ימינה כדי לשנות את הכיוון שאליו הרובוט פונה, ואז ⬆️ זוז אל 🚩.",
"The 🧩 counter shows blocks used / allowed. A loop is how you do a lot of work with few blocks.":
  "המונה 🧩 מראה בלוקים בשימוש / מותרים. לולאה היא איך שעושים הרבה עבודה עם מעט בלוקים.",
"Three pairs of 🧱 blocks, spaced unevenly — so one 🔁 Repeat can't do it. Teach the robot the little job ONCE inside 🔧 A, then call it three times.":
  "שלושה זוגות של 🧱 בלוקים, במרווחים לא שווים — אז 🔁 חזור אחד לא יספיק. תלמד את הרובוט את העבודה הקטנה פעם אחת בתוך 🔧 A, ואז תקרא לה שלוש פעמים.",
"Trees are scattered with gaps. 🔁 Repeat: ❓ If 🌳 tree ahead → 🪓 Chop, then ⬆️ Move. The robot decides for itself!":
  "העצים מפוזרים עם פערים. 🔁 חזור: ❓ אם 🌳 עץ לפנים ← 🪓 כרות, ואז ⬆️ זוז. הרובוט מחליט בעצמו!",
"Walk the row and count the 🧱 blocks, then 💬 Say the answer. The robot has to work it out — you can't just look and type the number.":
  "תעבור את השורה ותספור את 🧱 הבלוקים, ואז 💬 אמור את התשובה. הרובוט צריך להבין את זה — אי אפשר פשוט להסתכל ולהקליד את המספר.",
"Walk up to the 🌳 tree and use 🪓 Chop to clear it — exactly how your robots gather wood out in the world.":
  "תגיע עד 🌳 העץ ותשתמש ב-🪓 כרות כדי לפנות אותו — בדיוק איך שהרובוטים שלך אוספים עץ בעולם.",
"Write the counting program from the last lesson: count = 0, walk the row, add 1 for each 🧱, then 💬 Say count.":
  "תכתוב את תוכנית הספירה מהשיעור הקודם: count = 0, תעבור את השורה, תוסיף 1 לכל 🧱, ואז 💬 אמור את count.",
"You've graduated. The last four lessons are the ones that turn moving a robot into programming: 🔄 While, 🔢 Variables, 🔧 Functions and 🧠 Algorithms.":
  "סיימת. ארבעת השיעורים האחרונים הם אלה שהופכים הזזת רובוט לתכנות: 🔄 כל עוד, 🔢 משתנים, 🔧 פונקציות ו-🧠 אלגוריתמים.",
"You've learned moving, turning, chopping, collecting, loops and conditions. Four harder lessons are waiting whenever you want them — 🔄 While, 🔢 Variables, 🔧 Functions and 🧠 Algorithms are how you build things that think.":
  "למדת לזוז, לפנות, לכרות, לאסוף, לולאות ותנאים. ארבעה שיעורים קשים יותר מחכים מתי שתרצה — 🔄 כל עוד, 🔢 משתנים, 🔧 פונקציות ו-🧠 אלגוריתמים הם איך שבונים דברים שחושבים.",
"❓ How do I do this?":"❓ איך עושים את זה?",
"⬆️ Move toward the 💎 gem.":"⬆️ זוז לכיוון 💎 האבן.",
"⬆️ Move until the robot is standing right next to the 🌳 tree.":
  "⬆️ זוז עד שהרובוט עומד ממש ליד 🌳 העץ.",
"🎓 Academy complete — the world is yours! Four advanced lessons are waiting.":
  "🎓 האקדמיה הושלמה — העולם שלך! ארבעה שיעורים מתקדמים מחכים.",
"🎓 Academy — learn the basics":"🎓 אקדמיה — ללמוד את היסודות",
"👣 What to do":"👣 מה לעשות",
"💬 Say 4 passes the first row and fails the other three. That failure IS the lesson.":
  "💬 אמור 4 עובר בשורה הראשונה ונכשל בשלוש האחרות. הכישלון הזה הוא השיעור.",
"🔁 Repeat 8 times: ❓ If 🧱 block here → ➕ Change count by 1, then ⬆️ Move.":
  "🔁 חזור 8 פעמים: ❓ אם 🧱 בלוק כאן ← ➕ שנה את count ב-1, ואז ⬆️ זוז.",
"🔁 Repeat needs a number: “do this 5 times”. 🔄 While needs a question: “keep going until there are none left”.":
  "🔁 חזור צריך מספר: „תעשה את זה 5 פעמים”. 🔄 כל עוד צריך שאלה: „תמשיך עד שלא נשאר אף אחד”.",
"🔢 Set a variable — call it count — to 0.":"🔢 קבע משתנה — תקרא לו count — ל-0.",
"🧠 Every lesson done — you can write real programs now!":
  "🧠 כל השיעורים הושלמו — אתה יכול לכתוב תוכניות אמיתיות עכשיו!",
"🧩 What these blocks do":"🧩 מה הבלוקים האלה עושים",
/* ---- challenges ---- */
"The numbered blocks are jumbled! The top row is free space. Use ✊ Lift and ⤵️ Drop to arrange them 1·2·3 across the bottom row — your very first sorting algorithm!":
  "הבלוקים הממוספרים מבולגנים! השורה העליונה היא מקום פנוי. השתמש ב-✊ הרם וב-⤵️ הנח כדי לסדר אותם 1·2·3 לאורך השורה התחתונה — אלגוריתם המיון הראשון שלך!",
"No challenges yet — be the first to publish one! ✏️":"עוד אין אתגרים — תהיה הראשון לפרסם! ✏️",
"or ➕ Add level":"או ➕ הוסף שלב",
"or ➕ Update level":"או ➕ עדכן שלב",
"— ➕ updates it":"— ➕ מעדכן אותו",
"⏱ How much work each row took:":"⏱ כמה עבודה לקחה כל שורה:",
"⏳ Loading challenges…":"⏳ טוען אתגרים…",
"▶ First prove it's solvable — write a program and run it, then 💾 Save opens up!":
  "▶ קודם תוכיח שאפשר לפתור — תכתוב תוכנית ותריץ אותה, ואז 💾 שמור ייפתח!",
"▶ First prove this level is solvable — write a program and run it, then it can be added!":
  "▶ קודם תוכיח שאפשר לפתור את השלב — תכתוב תוכנית ותריץ אותה, ואז אפשר יהיה להוסיף אותו!",
"♾️ Your program ran too long — something is looping forever!":
  "♾️ התוכנית שלך רצה יותר מדי זמן — משהו רץ בלולאה אינסופית!",
"⚠️ This level is missing its expected answer.":"⚠️ לשלב הזה חסרה התשובה הצפויה.",
"✏️ Editing level":"✏️ עריכת שלב",
"✏️ Editing your published challenge — your saved solution is loaded. Add ➕ levels or tweak it, prove ▶, then 🌍 Publish to update.":
  "✏️ אתה עורך את האתגר שפרסמת — הפתרון השמור שלך נטען. הוסף ➕ שלבים או שנה אותו, תוכיח ▶, ואז 🌍 פרסם כדי לעדכן.",
"✏️ Pick a name to publish under first.":"✏️ קודם בחר שם לפרסם תחתיו.",
"🌳 Trees still standing — make sure the robot chops every one!":
  "🌳 עדיין נשארו עצים — תוודא שהרובוט כורת את כולם!",
"🎁 Starter routines off — players begin from a blank program.":
  "🎁 שגרות פתיחה כבויות — שחקנים מתחילים מתוכנית ריקה.",
"🎈 Publishing opens up when you're older.":"🎈 פרסום נפתח כשתהיה מבוגר יותר.",
"🎬 Add at least one level first!":"🎬 קודם תוסיף לפחות שלב אחד!",
"💎 Gems left behind — collect them all!":"💎 נשארו אבנים — תאסוף את כולן!",
"💬 Say your answer at the end — the robot has to tell us the number!":
  "💬 אמור את התשובה שלך בסוף — הרובוט צריך להגיד לנו את המספר!",
"💾 Saved to “My Challenges”!":"💾 נשמר ל„האתגרים שלי”!",
"🔌 Not connected yet.":"🔌 עוד לא מחובר.",
"🔌 Online accounts & shared challenges are coming online soon — everything else works offline!":
  "🔌 חשבונות מקוונים ואתגרים משותפים יעלו לאוויר בקרוב — כל השאר עובד גם בלי חיבור!",
"🔢 Eight inputs is the maximum.":"🔢 שמונה קלטים זה המקסימום.",
"🔢 Match every \"→n\" target — each numbered tile needs that exact block!":
  "🔢 התאם כל יעד „→n” — כל משבצת ממוספרת צריכה בדיוק את הבלוק הזה!",
"🔢 No.":"🔢 לא.",
"🔢 Not sorted yet — get every numbered block onto its target cell in order!":
  "🔢 עוד לא ממוין — תביא כל בלוק ממוספר למשבצת היעד שלו לפי הסדר!",
"🔧 Write something in routine A or B first — that is what players will be given.":
  "🔧 קודם תכתוב משהו בשגרה A או B — זה מה שהשחקנים יקבלו.",
"🖌️ Design a level and solve it first, then Save it!":
  "🖌️ קודם תעצב שלב ותפתור אותו, ואז תשמור!",
"🖌️ Design this level first — paint tiles or 🔢 place blocks.":
  "🖌️ קודם תעצב את השלב — צבע משבצות או 🔢 הנח בלוקים.",
"🖌️ Draw a board first — the first ➕ turns it into input 1 and hands you a blank one for input 2.":
  "🖌️ קודם צייר לוח — ה-➕ הראשון הופך אותו לקלט 1 ונותן לך לוח ריק לקלט 2.",
"🖌️ Nothing to build yet — paint some target tiles first!":
  "🖌️ אין עדיין מה לבנות — קודם צבע כמה משבצות יעד!",
"🖌️ Paint target tiles or 🔢 place some blocks first!":
  "🖌️ קודם צבע משבצות יעד או 🔢 הנח כמה בלוקים!",
"🚧 A brick landed outside the plan — check your path!":
  "🚧 לבנה נחתה מחוץ לתוכנית — תבדוק את המסלול שלך!",
"🚩 Not on the flag yet — guide the robot onto it, then run again!":
  "🚩 עוד לא על הדגל — תוביל את הרובוט אליו, ואז תריץ שוב!",
"🤖 The robot starts here — move it first!":"🤖 הרובוט מתחיל כאן — קודם תזיז אותו!",
"🧩 Add some blocks first!":"🧩 קודם תוסיף כמה בלוקים!",
"🧱 Almost! Fill every target tile, then run again!":"🧱 כמעט! מלא כל משבצת יעד, ואז תריץ שוב!",
"🧱 There's terrain here — 🧹 erase it first.":"🧱 יש כאן שטח — 🧹 קודם תמחק אותו.",
/* ---- puzzle chapters ---- */
"A door AND a gate. Take the block with you from the very start — you'll need it on the plate later.":
  "גם דלת וגם שער. קח איתך את הבלוק כבר מההתחלה — תצטרך אותו על הלחצן אחר כך.",
"A hole in the ground! ✊ Lift the block, face the hole and ⤵️ Drop it IN — now you can walk over it.":
  "חור באדמה! ✊ הרם את הבלוק, תפנה אל החור ו-⤵️ הפל אותו פנימה — עכשיו אפשר לעבור מעליו.",
"A long wall — but only 6 blocks. Put ⬆️ Move inside a 🔁 Repeat and let the loop do the walking.":
  "קיר ארוך — אבל רק 6 בלוקים. שים את ⬆️ זוז בתוך 🔁 חזור ותן ללולאה ללכת במקומך.",
"A wall with no way round it — but two 🌀 portals of the same colour are a pair. Step on one, come out the other.":
  "קיר שאי אפשר לעקוף — אבל שני 🌀 שערים באותו צבע הם זוג. תדרוך על אחד, תצא מהשני.",
"A ➡️ one-way tile only lets you leave the way it points. Step on it, then turn to face that way.":
  "משבצת ➡️ חד-כיוונית נותנת לצאת רק לכיוון שאליו היא מצביעה. תדרוך עליה, ואז תפנה לכיוון הזה.",
"Carry EVERY block up to the row above. Moving one block is nine steps — so don't write them over and over. Put them in 🔧 routine A (lift · turn left · move · drop · turn right · move · turn right · move · turn left) and your main program becomes: 🔄 While a block is under me → 🔧 Call A.":
  "תסחב כל בלוק לשורה שמעל. להזיז בלוק אחד זה תשעה צעדים — אז אל תכתוב אותם שוב ושוב. שים אותם ב-🔧 שגרה A (הרם · פנה שמאלה · זוז · הנח · פנה ימינה · זוז · פנה ימינה · זוז · פנה שמאלה) והתוכנית הראשית שלך הופכת ל: 🔄 כל עוד יש בלוק מתחתיי ← 🔧 קרא ל-A.",
"Everything at once: bridge the hole, squeeze through the gap, grab the key, open the door. You've learned all of it.":
  "הכול בבת אחת: לגשר על החור, להידחק דרך הפער, לחטוף את המפתח, לפתוח את הדלת. למדת את כל זה.",
"Four different mazes, one program, only 6 blocks. Don't count steps — teach the robot to feel the wall and follow it round.":
  "ארבעה מבוכים שונים, תוכנית אחת, רק 6 בלוקים. אל תספור צעדים — תלמד את הרובוט למשש את הקיר וללכת סביבו.",
"Only 5 blocks! Don't count steps — let the robot FEEL: ♾️ Forever ❓ If 🚧 blocked → ↪️ Turn, else ⬆️ Move.":
  "רק 5 בלוקים! אל תספור צעדים — תן לרובוט להרגיש: ♾️ לתמיד ❓ אם 🚧 חסום ← ↪️ פנה, אחרת ⬆️ זוז.",
"Search the row for the 7 and 💬 Say WHERE it was, not what it was. 📖 Read can tell the robot its own column.":
  "תחפש את ה-7 בשורה ו-💬 אמור איפה הוא היה, לא מה הוא היה. 📖 קרא יכול להגיד לרובוט באיזו עמודה הוא נמצא.",
"The real thing: put ANY row in order, smallest first. 🔧 Routine A already holds a Swap — it trades the block under you with the one in front. Your job is the algorithm: walk the row comparing each block with the next, swap when they're the wrong way round, walk back to the start, and do that enough times.":
  "הדבר האמיתי: תסדר כל שורה, מהקטן לגדול. ב-🔧 שגרה A כבר יש החלפה — היא מחליפה בין הבלוק שמתחתיך לזה שלפניך. העבודה שלך היא האלגוריתם: תעבור את השורה ותשווה כל בלוק לזה שאחריו, תחליף כשהם בסדר הפוך, תחזור להתחלה, ותעשה את זה מספיק פעמים.",
"The 🚧 gate opens while its 🔘 plate is pressed — but you can't stand on the plate AND walk through. Leave a block on it instead.":
  "🚧 השער נפתח כל עוד 🔘 הלחצן שלו לחוץ — אבל אי אפשר גם לעמוד על הלחצן וגם לעבור. תשאיר עליו בלוק במקום.",
"The 🚪 is straight ahead but the 🔑 isn't. Go and fetch it FIRST, then come back.":
  "🚪 הדלת ממש לפניך אבל 🔑 המפתח לא. קודם לך להביא אותו, ואז תחזור.",
"Two holes, two blocks — and the same four steps each time. One 🔁 Repeat does it all.":
  "שני חורים, שני בלוקים — ואותם ארבעה צעדים בכל פעם. 🔁 חזור אחד עושה הכול.",
"Walk over the 🔑 to pick it up, and the 🚪 of the same colour opens for you. Just 4 blocks.":
  "תעבור מעל 🔑 המפתח כדי להרים אותו, ו-🚪 הדלת באותו צבע תיפתח לך. רק 4 בלוקים.",
"🧩 Puzzle Chapters — learn every trick":"🧩 פרקי חידות — ללמוד כל טריק",
/* ---- creator guide ---- */
": solve your level, then move the 🔢 blocks around (or move the robot's start) and press ▶ again with the":
  ": תפתור את השלב שלך, ואז תזיז את 🔢 הבלוקים (או תזיז את נקודת ההתחלה של הרובוט) ותלחץ ▶ שוב עם",
"A 🧱 wall in the way teaches turning. A long row of targets teaches 🔁 Repeat. Gaps in the row teach ❓ If. Numbered 🔢 blocks teach comparing. Pick":
  "🧱 קיר בדרך מלמד לפנות. שורה ארוכה של יעדים מלמדת 🔁 חזור. פערים בשורה מלמדים ❓ אם. 🔢 בלוקים ממוספרים מלמדים להשוות. תבחר",
"And if your question needs a building block that is not the point of the puzzle — a swap, a step, a turn-around — write it in routine 🔧 A and switch on":
  "ואם השאלה שלך צריכה אבן בניין שהיא לא הנקודה של החידה — החלפה, צעד, סיבוב לאחור — תכתוב אותה בשגרה 🔧 A ותדליק",
"Before you paint anything, finish this: \"the robot has to ___\". Like":
  "לפני שאתה צובע משהו, תשלים את זה: „הרובוט צריך ___”. למשל",
"Same row — but now the targets have gaps. Building everywhere fails, so the robot must ask ❓ If 🎯 on a target before it drops a brick.":
  "אותה שורה — אבל עכשיו יש פערים בין היעדים. לבנות בכל מקום נכשל, אז הרובוט חייב לשאול ❓ אם 🎯 על יעד לפני שהוא מניח לבנה.",
"Then tap 👁 on your last input to make it":"ואז לחץ על 👁 בקלט האחרון שלך כדי להפוך אותו ל",
"Three numbered blocks in the wrong order, and a free row above to use as scratch space. This is the one that can become a real algorithm question — run the shuffle test on it.":
  "שלושה בלוקים ממוספרים בסדר הלא נכון, ושורה פנויה מעל לשימוש כשטח עבודה. זה השלב שיכול להפוך לשאלת אלגוריתם אמיתית — תריץ עליו את מבחן הערבוב.",
"Use ➕ Add level. Level 1 shows the trick with two blocks. Level 2 makes them use it twice. Level 4 makes it the only way through. Four small levels beat one giant one — and your player actually finishes them.":
  "השתמש ב-➕ הוסף שלב. שלב 1 מראה את הטריק עם שני בלוקים. שלב 2 מכריח להשתמש בו פעמיים. שלב 4 הופך אותו לדרך היחידה. ארבעה שלבים קטנים עדיפים על אחד ענק — והשחקן שלך באמת מסיים אותם.",
"You do not have to shuffle by hand. Open ⚙️ and use":
  "אתה לא צריך לערבב ביד. פתח את ⚙️ והשתמש ב",
"something it could not know in advance: ❓ If 🧱 wall ahead, ❓ If 🎯 on a target, 📖 Read the number under me. A level with nothing to check can only be walked from memory.":
  "משהו שהוא לא יכול לדעת מראש: ❓ אם 🧱 קיר לפנים, ❓ אם 🎯 על יעד, 📖 קרא את המספר מתחתיי. שלב שאין בו מה לבדוק אפשר רק ללכת בו מהזיכרון.",
"thing (move a block, move the start) and run the same program again. What happens next is rule number seven…":
  "דבר (תזיז בלוק, תזיז את ההתחלה) ותריץ את אותה תוכנית שוב. מה שקורה אחר כך הוא כלל מספר שבע…",
"▶ until it is solved — the game will not let you 💾 Save a level you have not solved yourself. Then change":
  "▶ עד שהוא נפתר — המשחק לא ייתן לך 💾 לשמור שלב שלא פתרת בעצמך. ואז תשנה",
"🍳 Start from a board":"🍳 להתחיל מלוח",
"🎁 Starter routines":"🎁 שגרות פתיחה",
"📏 Six rules for a level people finish":"📏 שישה כללים לשלב שאנשים מסיימים",
"🔢 Add this board as an input":"🔢 הוסף את הלוח הזה כקלט",
"🔢 Make the game run the shuffle test for you":"🔢 תן למשחק להריץ את מבחן הערבוב בשבילך",
"🧠 When is it an algorithm question?":"🧠 מתי זו שאלת אלגוריתם?",
"🧩 is the strongest tool in the creator. Solve your own level first, count the blocks you used, then set the budget to":
  "🧩 הוא הכלי החזק ביותר ביוצר. קודם תפתור את השלב שלך, תספור את הבלוקים שהשתמשת בהם, ואז תקבע את התקציב ל",
/* ---- mentor ---- */
"Hey there, world-builder! 👋 I'm Byte. Ask me about loops, selling, building… or tap 💡 Give me an idea and I'll suggest a project!":
  "היי, בונה עולמות! 👋 אני Byte. תשאל אותי על לולאות, מכירה, בנייה… או תלחץ על 💡 תן לי רעיון ואציע לך פרויקט!",
"⚡ Make it faster":"⚡ שיהיה מהר יותר",
"🐍 Show me Python":"🐍 תראה לי פייתון",
"💡 Give me an idea":"💡 תן לי רעיון",
"💰 How do I earn coins?":"💰 איך מרוויחים מטבעות?",
"🔁 Explain loops":"🔁 תסביר לולאות",
"🤔 Why isn't my robot moving?":"🤔 למה הרובוט שלי לא זז?",
"♾️ The dream: a program you never have to touch again. Coins roll in while you just watch your world work!":
  "♾️ החלום: תוכנית שלא צריך לגעת בה שוב לעולם. המטבעות נכנסים בזמן שאתה רק מסתכל על העולם שלך עובד!",
"🌉 Bridge builder: collect 10 stone, walk to a river, and use Build → bridge to cross into new lands!":
  "🌉 בונה גשרים: תאסוף 10 אבן, תלך לנהר, ותשתמש בבנה ← גשר כדי לעבור לארצות חדשות!",
"🌱 Tree planter: Repeat 5 → Build sapling → Move. Plant a forest, then harvest it later — renewable resources!":
  "🌱 שותל עצים: חזור 5 ← בנה שתיל ← זוז. תשתול יער, ותקצור אותו אחר כך — חומרים מתחדשים!",
"🌲 Wood farm: Forever → Face Nearest tree → If tree ahead: Collect, else Move. Watch it harvest forever!":
  "🌲 חוות עץ: לתמיד ← פנה לעץ הקרוב ← אם עץ לפנים: אסוף, אחרת זוז. תראה אותו קוצר בלי סוף!",
"🎒 A robot's bag is full! Sell at the market 🏪 or Drop into a chest 📦.":
  "🎒 התיק של רובוט מלא! תמכור בשוק 🏪 או תפיל לתוך תיבה 📦.",
"🏭 Full factory: harvester bot fills its bag → Go Home → face the chest → Drop → back to work. Sell the chest storage in the shop!":
  "🏭 מפעל שלם: רובוט קוצר ממלא את התיק ← חזור הביתה ← תפנה לתיבה ← הפל ← בחזרה לעבודה. תמכור את מלאי התיבה בחנות!",
"💎 Crystal hunter: crystals hide in rocky mountains and sell for 15 🪙 each. Program an expedition!":
  "💎 צייד גבישים: גבישים מסתתרים בהרים סלעיים ונמכרים ב-15 🪙 כל אחד. תתכנת משלחת!",
"💰 Sell All only works within 2 tiles of the market 🏪.":
  "💰 מכור הכול עובד רק במרחק 2 משבצות מהשוק 🏪.",
"🚚 Delivery bot: one robot drops wood in a line, a second robot collects it and carries it to the market. A supply chain!":
  "🚚 רובוט משלוחים: רובוט אחד מפיל עץ בשורה, רובוט שני אוסף אותו ומעביר לשוק. שרשרת אספקה!",
"🤖 Robot fleet: buy more robots and give each one a different job — miner, lumberjack, courier, seller.":
  "🤖 צי רובוטים: תקנה עוד רובוטים ותן לכל אחד עבודה אחרת — כורה, חוטב, שליח, מוכר.",
"🧮 Counter bot: Set c = 0 → Forever → Collect → Change c by 1 → Say c. Watch it count its harvest out loud!":
  "🧮 רובוט מונה: קבע c = 0 ← לתמיד ← אסוף ← שנה את c ב-1 ← אמור c. תראה אותו סופר את היבול בקול!",
"🗺️ Treasure hunter: 🎁 chests hide far from home. Program a robot with Face Nearest + If blocked → Turn, and go exploring!":
  "🗺️ צייד אוצרות: 🎁 תיבות מסתתרות רחוק מהבית. תתכנת רובוט עם פנה לקרוב + אם חסום ← פנה, וצא לחקור!",
"😴 Your robot is worn out! Add a Rest 😴 block (put it in the loop so it rests as it works).":
  "😴 הרובוט שלך מותש! תוסיף בלוק מנוחה 😴 (שים אותו בלולאה כדי שינוח תוך כדי עבודה).",
"🤔 Interesting question! I know a lot about: loops 🔁, if-logic ❓, collecting ✋, building 🔨, selling 💰, robots 🤖, Python 🐍 and speed ⚡. Try asking about one of those — or say \"give me an idea\"!":
  "🤔 שאלה מעניינת! אני יודע הרבה על: לולאות 🔁, לוגיקת אם ❓, איסוף ✋, בנייה 🔨, מכירה 💰, רובוטים 🤖, פייתון 🐍 ומהירות ⚡. תנסה לשאול על אחד מאלה — או תגיד „תן לי רעיון”!",
"Loops repeat actions so YOU don't have to! 🔁\n\n• Repeat 5 → runs its inside blocks 5 times\n• Forever ♾️ → runs them until you press Stop — perfect for automation!\n\nIn Python it looks like:\nfor i in range(5):\n    robot.move()\n\nTap a loop block, then tap other blocks — they go INSIDE it.":
  "לולאות חוזרות על פעולות כדי שאתה לא תצטרך! 🔁\n\n• חזור 5 ← מריץ את הבלוקים שבפנים 5 פעמים\n• לתמיד ♾️ ← מריץ אותם עד שתלחץ עצור — מושלם לאוטומציה!\n\nבפייתון זה נראה כך:\nfor i in range(5):\n    robot.move()\n\nלחץ על בלוק לולאה, ואז על בלוקים אחרים — הם נכנסים לתוכו.",
"⚡ Skills level up slowly as your robots WORK (check 📜 → Skills):\n• 🪓 Woodcutting — chance of bonus wood per chop\n• ⛏️ Mining — chance of bonus ore\n• 🏃 Agility — all robots run a bit faster\n• 🔨 Building — chance the materials are free\n• 💰 Trading — better prices at the market\n\nEvery level is earned with real practice — just like real skills!":
  "⚡ מיומנויות עולות ברמה לאט תוך כדי שהרובוטים שלך עובדים (תבדוק 📜 ← מיומנויות):\n• 🪓 חטיבת עצים — סיכוי לעץ בונוס בכל כריתה\n• ⛏️ כרייה — סיכוי לעפרה בונוס\n• 🏃 זריזות — כל הרובוטים רצים קצת מהר יותר\n• 🔨 בנייה — סיכוי שהחומרים בחינם\n• 💰 מסחר — מחירים טובים יותר בשוק\n\nכל רמה מושגת בתרגול אמיתי — בדיוק כמו מיומנויות אמיתיות!",
"⚡ Ways to go faster:\n1️⃣ Buy Speed Boost in the shop\n2️⃣ Write smarter code — 🧭 Face Nearest beats wandering randomly\n3️⃣ Bigger bag = fewer trips\n4️⃣ MORE ROBOTS working in parallel — that's real optimization thinking!":
  "⚡ דרכים להיות מהיר יותר:\n1️⃣ תקנה האצה בחנות\n2️⃣ תכתוב קוד חכם יותר — 🧭 פנה לקרוב עדיף על שיטוט אקראי\n3️⃣ תיק גדול יותר = פחות נסיעות\n4️⃣ יותר רובוטים עובדים במקביל — זו חשיבת אופטימיזציה אמיתית!",
"✋ Collect grabs whatever is directly in FRONT of your robot: full-grown trees 🌳 → wood, rocks 🪨 → stone, ⛓️ iron, 💎 crystal.\n\nFace the thing first (turn blocks), and make sure your bag isn't full — check 🎒 at the top!":
  "✋ אסוף לוקח כל מה שנמצא ממש לפני הרובוט שלך: עצים בוגרים 🌳 ← עץ, סלעים 🪨 ← אבן, ⛓️ ברזל, 💎 גביש.\n\nקודם תפנה אל הדבר (בלוקי פנייה), ותוודא שהתיק לא מלא — תבדוק 🎒 למעלה!",
"❓ If blocks let robots make decisions!\n\nExample: If tree ahead → Collect. Otherwise the robot skips it.\n\nCombine with Forever for smart bots:\n♾️ Forever\n  ❓ If tree ahead → ✋ Collect\n  ⬆️ Move\n\nThat robot harvests every tree it walks past!":
  "❓ בלוקי אם נותנים לרובוטים להחליט!\n\nדוגמה: אם עץ לפנים ← אסוף. אחרת הרובוט מדלג עליו.\n\nתשלב עם לתמיד לרובוטים חכמים:\n♾️ לתמיד\n  ❓ אם עץ לפנים ← ✋ אסוף\n  ⬆️ זוז\n\nהרובוט הזה קוצר כל עץ שהוא עובר לידו!",
"⭐ Ways to grow:\n• 📜 Quests — finish goals, claim coins & XP\n• ⭐ Level up — every action gives XP; levels give coins and 🎩 hats for your robots (🛒 → Style)\n• ⚡ Skills — the more you chop/mine/build/sell, the better you get at it!\n• 🎁 Daily gift — a present every day you play\n• 🎁 Treasure chests are hidden FAR from home… send an explorer robot!":
  "⭐ דרכים להתקדם:\n• 📜 משימות — תסיים יעדים, תקבל מטבעות ונקודות ניסיון\n• ⭐ עלייה ברמה — כל פעולה נותנת נקודות ניסיון; רמות נותנות מטבעות ו-🎩 כובעים לרובוטים שלך (🛒 ← סטייל)\n• ⚡ מיומנויות — ככל שתכרות/תכרה/תבנה/תמכור יותר, ככה תשתפר!\n• 🎁 מתנה יומית — מתנה בכל יום שאתה משחק\n• 🎁 תיבות אוצר מוסתרות רחוק מהבית… תשלח רובוט חוקר!",
"🌊 At a river you can 🪣 Scoop water 💧 (face the water first!). To cross, collect 2 stone and 🔨 Build → bridge. Chain bridges to reach islands full of treasure.":
  "🌊 בנהר אפשר 🪣 לדלות מים 💧 (קודם תפנה אל המים!). כדי לעבור, תאסוף 2 אבן ו-🔨 בנה ← גשר. תשרשר גשרים כדי להגיע לאיים מלאי אוצרות.",
"🏦 The Bank is your shared storage — it never gets sold unless YOU sell it (🛒 shop).\n\n• 🏦 Bank All block stores a robot's whole bag\n• Dropping into a chest 📦 also banks it\n• Any robot can 🔨 Build using bank materials when its own bag runs short — so stockpile wood, then send a builder to raise saplings, bridges and chests from the reserve!":
  "🏦 הבנק הוא האחסון המשותף שלך — הוא לא נמכר לעולם אלא אם אתה מוכר אותו (🛒 חנות).\n\n• בלוק 🏦 הפקד הכול מאחסן את כל התיק של רובוט\n• הפלה לתוך תיבה 📦 גם מפקידה\n• כל רובוט יכול 🔨 לבנות מחומרי הבנק כשהתיק שלו מתרוקן — אז תצבור עץ, ואז תשלח בנאי להקים שתילים, גשרים ותיבות מהמאגר!",
"💰 Earning coins:\n1️⃣ Collect resources (wood 2🪙, stone 3🪙, iron 6🪙, crystal 15🪙)\n2️⃣ Walk your robot next to the market 🏪 (near your home)\n3️⃣ Face it and use ⤵️ Drop — or the 💰 Sell All smart block\n\nSpend coins in the 🛒 shop on robots and upgrades!":
  "💰 להרוויח מטבעות:\n1️⃣ תאסוף חומרים (עץ 2🪙, אבן 3🪙, ברזל 6🪙, גביש 15🪙)\n2️⃣ תוביל את הרובוט שלך ליד השוק 🏪 (קרוב לבית שלך)\n3️⃣ תפנה אליו ותשתמש ב-⤵️ הפל — או בבלוק החכם 💰 מכור הכול\n\nתוציא מטבעות ב-🛒 חנות על רובוטים ושדרוגים!",
"🔓 You unlock powers by PLAYING:\n• 🔁 Loops — collect 5 resources\n• ❓ Logic — sell anything at the market\n• 🧭 Smart blocks — earn 150 🪙 total or own 2 robots\n\nNo lessons, no levels — just build stuff!":
  "🔓 אתה פותח כוחות על ידי משחק:\n• 🔁 לולאות — תאסוף 5 חומרים\n• ❓ לוגיקה — תמכור משהו בשוק\n• 🧭 בלוקים חכמים — תרוויח 150 🪙 בסך הכול או שיהיו לך 2 רובוטים\n\nבלי שיעורים, בלי שלבים — פשוט תבנה דברים!",
"🔨 Build creates things on the tile ahead:\n• 🌱 Sapling (1 wood) — grows into a tree. Renewable farming!\n• 🌉 Bridge (2 stone) — cross water into new lands!\n• 📦 Chest (5 wood) — Drop while facing a chest to store items, then sell storage in the shop.":
  "🔨 בנה יוצר דברים על המשבצת שלפנים:\n• 🌱 שתיל (1 עץ) — גדל לעץ. חקלאות מתחדשת!\n• 🌉 גשר (2 אבן) — לעבור מים לארצות חדשות!\n• 📦 תיבה (5 עץ) — הפל כשאתה פונה לתיבה כדי לאחסן פריטים, ואז תמכור את האחסון בחנות.",
"😴 Working uses energy (see the ⚡ meter up top). When a robot runs out it gets too tired to chop, mine or build!\n\nAdd a 😴 Rest block to recover — the smart trick is to put Rest INSIDE your loop, or use ❓ If tired → Rest, so your robot paces itself and never conks out. ⚡":
  "😴 עבודה צורכת אנרגיה (תראה את מד ה-⚡ למעלה). כשלרובוט נגמרת האנרגיה הוא עייף מדי לכרות, לכרות או לבנות!\n\nתוסיף בלוק 😴 מנוחה כדי להתאושש — הטריק החכם הוא לשים מנוחה בתוך הלולאה, או להשתמש ב-❓ אם עייף ← נוח, כך שהרובוט שלך מווסת את עצמו ולא נופל. ⚡",
"🤖 Buy extra robots in the 🛒 shop (100 🪙). Each robot has its OWN program and runs at the same time.\n\nPro move: give each robot one job — one harvests, one hauls, one sells. That's called division of labor, and it's how real factories (and real software!) work.":
  "🤖 תקנה רובוטים נוספים ב-🛒 חנות (100 🪙). לכל רובוט יש תוכנית משלו והם רצים בו זמנית.\n\nמהלך של מקצוענים: תן לכל רובוט עבודה אחת — אחד קוצר, אחד מוביל, אחד מוכר. זה נקרא חלוקת עבודה, וככה מפעלים אמיתיים (ותוכנה אמיתית!) עובדים.",
"🧠 Memory blocks (unlock by earning 250 🪙):\n• 📦 Set x = 5 — store a number or text\n• ➕ Change x by 1 — count things!\n• 🔢 Count i from 1 to N — a loop where i goes UP each time\n• 💬 Say — your robot shows the value in a speech bubble\n\nTry: Set c = 0 → Forever → Collect → Change c by 1 → Say c. A robot that counts its harvest!\n\nIn Python: for i in range(1, 6): — you're writing real code!":
  "🧠 בלוקי זיכרון (נפתחים בהרווחת 250 🪙):\n• 📦 קבע x = 5 — לאחסן מספר או טקסט\n• ➕ שנה את x ב-1 — לספור דברים!\n• 🔢 ספור i מ-1 עד N — לולאה שבה i עולה בכל פעם\n• 💬 אמור — הרובוט שלך מציג את הערך בבועת דיבור\n\nתנסה: קבע c = 0 ← לתמיד ← אסוף ← שנה את c ב-1 ← אמור c. רובוט שסופר את היבול שלו!\n\nבפייתון: for i in range(1, 6): — אתה כותב קוד אמיתי!",
"🪓 Different jobs, different tools!\n• 🪓 Chop — trees (into wood)\n• ⛏️ Mine — rocks, iron & crystal\n• 🪣 Scoop — water from a river\n• ✋ Collect — does the right thing to whatever is in front (and picks up dropped items)\n\nBig things take SEVERAL hits — a tree needs a few chops — so put the action in a 🔁 loop!":
  "🪓 עבודות שונות, כלים שונים!\n• 🪓 כרות — עצים (לעץ)\n• ⛏️ כרה — סלעים, ברזל וגביש\n• 🪣 דלה — מים מנהר\n• ✋ אסוף — עושה את הדבר הנכון לכל מה שלפנים (וגם מרים פריטים שהופלו)\n\nדברים גדולים דורשים כמה מכות — עץ צריך כמה כריתות — אז שים את הפעולה ב-🔁 לולאה!",
/* ---- tower editor ---- */
"The blueprint is empty — tap tiles with 🧱 to plan bricks.":
  "התוכנית ריקה — לחץ על משבצות עם 🧱 כדי לתכנן לבנים.",
"The build goes higher than 1 but 🪜 Climb Up isn't an allowed block — turn it on below.":
  "הבנייה מגיעה גבוה מ-1 אבל 🪜 טפס למעלה אינו בלוק מאושר — הדלק אותו למטה.",
"There are 🕳️ pits but 🦘 Jump Gap isn't an allowed block — turn it on below.":
  "יש 🕳️ בורות אבל 🦘 קפוץ מעל פער אינו בלוק מאושר — הדלק אותו למטה.",
"▶ First prove it: write a program and run it, then 💾 Save opens up.":
  "▶ קודם תוכיח: תכתוב תוכנית ותריץ אותה, ואז 💾 שמור ייפתח.",
"🔑 Log in first to publish.":"🔑 קודם התחבר כדי לפרסם.",
"🕳️ A brick needs ground under it — fill the pit first.":
  "🕳️ לבנה צריכה קרקע מתחתיה — קודם תמלא את הבור.",
"🕳️ Not into a pit — pick solid ground.":"🕳️ לא לתוך בור — תבחר קרקע מוצקה.",
"🗺️ Plan view":"🗺️ תצוגת תוכנית",
"🤖 That's the robot's start — put it somewhere else first.":
  "🤖 זו נקודת ההתחלה של הרובוט — קודם תעביר אותה למקום אחר.",
"🧊 3D view":"🧊 תצוגה תלת-ממדית",
"🧊 Tower design — tap a tile to raise it, hold to clear it.":
  "🧊 עיצוב מגדל — לחץ על משבצת כדי להגביה אותה, החזק כדי לנקות.",
/* ---- world, moderation, tower 3D, orders, shop ---- */
"⛓️ Iron ore — mine it, worth 6🪙!":"⛓️ עפרת ברזל — תכרה אותה, שווה 6🪙!",
"🌉 Bridges go on water.":"🌉 גשרים נבנים על מים.",
"🌊 Water — face it and 🪣 Scoop for water 💧, or 🔨 Build a bridge (2🪨) to cross!":
  "🌊 מים — תפנה אליהם ו-🪣 דלה מים 💧, או 🔨 בנה גשר (2🪨) כדי לעבור!",
"🌱 A young tree… it's still growing!":"🌱 עץ צעיר… הוא עוד גדל!",
"🌳 Tree — chop it for wood!":"🌳 עץ — תכרות אותו לעץ!",
"🌼 Just a pretty flower":"🌼 סתם פרח יפה",
"🎁 Treasure! Send a robot to collect it!":"🎁 אוצר! תשלח רובוט לאסוף אותו!",
"🏠 Home base":"🏠 בסיס הבית",
"🏪 Market — sell resources here!":"🏪 שוק — כאן מוכרים חומרים!",
"💎 Crystal — mine it, worth 15🪙!":"💎 גביש — תכרה אותו, שווה 15🪙!",
"📦 Dropped items — a robot can collect these!":"📦 פריטים שהופלו — רובוט יכול לאסוף אותם!",
"🔨 Your creation — tap 🔨 Build to move or remove it.":
  "🔨 היצירה שלך — לחץ על 🔨 בנה כדי להזיז או להסיר אותה.",
"🗑 Removed.":"🗑 הוסר.",
"🚚 Moved!":"🚚 הוזז!",
"🚚 Tap an empty spot to move it there.":"🚚 לחץ על מקום ריק כדי להעביר לשם.",
"🚫 Pick an empty spot on land.":"🚫 תבחר מקום ריק על היבשה.",
"🪨 Rock — mine it for stone!":"🪨 סלע — תכרה אותו לאבן!",
"✏️ Letters and numbers only, please.":"✏️ אותיות ומספרים בלבד, בבקשה.",
"👍 Everyone's challenges are back.":"👍 האתגרים של כולם חזרו.",
"🔐 Sign in first so a report can be checked.":"🔐 קודם התחבר כדי שאפשר יהיה לבדוק דיווח.",
"🚩 Thanks — that's reported and hidden from you. Three reports takes it down for everyone.":
  "🚩 תודה — זה דווח והוסתר ממך. שלושה דיווחים מורידים את זה לכולם.",
"A hole splits the board. 🦘 Jump clears one low tile and lands you level on the far side. Cross it, then build the two-step marker on the other bank.":
  "חור מפצל את הלוח. 🦘 קפיצה מדלגת על משבצת נמוכה אחת ומנחיתה אותך באותו גובה בצד השני. תחצה אותו, ואז תבנה את סימן שתי המדרגות בגדה השנייה.",
"Climb the stair, then turn and keep going. Up on the top step the tile ahead is three below you — a walkway at height costs three bricks per tile before you can step onto it.":
  "תטפס במדרגות, ואז תפנה ותמשיך. על המדרגה העליונה המשבצת שלפניך נמצאת שלוש מתחתיך — שביל בגובה עולה שלוש לבנים למשבצת לפני שאפשר לדרוך עליו.",
"Height is new. 🧱 Build drops a brick on the tile IN FRONT of you — but never higher than your own shoulder. 🪜 Climb steps up onto a brick exactly one level high. Build the three-step stair.":
  "גובה זה דבר חדש. 🧱 בנה מניח לבנה על המשבצת שלפניך — אבל אף פעם לא גבוה מהכתף שלך. 🪜 טפס עולה על לבנה בגובה של בדיוק רמה אחת. תבנה את מדרגות שלושת השלבים.",
"Three steps up, then a walkway. The stair grows by one brick each time — a 🔢 Count loop can build a step whose height is the loop's own number.":
  "שלוש מדרגות למעלה, ואז שביל. המדרגה גדלה בלבנה אחת בכל פעם — לולאת 🔢 ספירה יכולה לבנות מדרגה שהגובה שלה הוא המספר של הלולאה עצמה.",
"You start on a cliff. ⬇️ Descend steps DOWN exactly one level — walk yourself to the ground, then build the matching stair back up on the far side. A 🔄 While loop can descend until the ground is flat.":
  "אתה מתחיל על צוק. ⬇️ רד יורד בדיוק רמה אחת — תוריד את עצמך לקרקע, ואז תבנה את המדרגות המתאימות חזרה למעלה בצד השני. לולאת 🔄 כל עוד יכולה לרדת עד שהקרקע שטוחה.",
"🌙 Nightfall — everything costs more energy, but 💎 crystal is precious. Watch for 😴 tired!":
  "🌙 יורד לילה — הכול עולה יותר אנרגיה, אבל 💎 גביש יקר. תשים לב ל-😴 עייפות!",
"💎 Rich seam — on 📻":"💎 עורק עשיר — ב-📻",
"📋 The order expired — a new one will come up.":"📋 ההזמנה פגה — תעלה אחת חדשה.",
"Nothing saved yet. Write something in 🔧 A or 🔧 B, then save it here — it will be waiting in every world and every minigame.":
  "עוד לא נשמר כלום. תכתוב משהו ב-🔧 A או 🔧 B, ואז תשמור אותו כאן — הוא יחכה לך בכל עולם ובכל משחקון.",
"💾 Save one of this robot's functions":"💾 שמור אחת מהפונקציות של הרובוט הזה",
"📚 My functions":"📚 הפונקציות שלי",
": leave the gatherers at the seam and give one robot the job of hauling. 📦 Give Bag hands a full bag to a robot standing next to you.":
  ": תשאיר את האוספים בעורק ותן לרובוט אחד את עבודת ההובלה. 📦 תן תיק מעביר תיק מלא לרובוט שעומד לידך.",
": one robot per resource, each running the whole loop on its own. No hand-offs, no waiting.":
  ": רובוט אחד לכל חומר, כל אחד מריץ את כל הלולאה בעצמו. בלי העברות, בלי המתנה.",
"⇉ A spread order":"⇉ הזמנה מפוזרת",
"⛓ A bulk order":"⛓ הזמנת כמות",
"📭 The board is empty right now.":"📭 הלוח ריק כרגע.",
"🚶 Walk To the resource → gather → 🚶 Walk To 🏪 → ⤵️ Drop.":
  "🚶 לך אל החומר ← תאסוף ← 🚶 לך אל 🏪 ← ⤵️ הפל.",
"🧩 Open the code editor":"🧩 פתח את עורך הקוד",
"🤝 TEAMWORK UNLOCKED! 🚶 Walk To already keeps your robots off each other's trees — now use 📡 Tell Team and 📻 Go To Call to send one scout ahead for the whole fleet.":
  "🤝 עבודת צוות נפתחה! 🚶 לך אל כבר שומר שהרובוטים שלך לא ידרכו זה על העצים של זה — עכשיו השתמש ב-📡 ספר לצוות וב-📻 לך לקריאה כדי לשלוח סייר אחד קדימה בשביל כל הצי.",
/* ---- account, build, editor, journey, tutorial, skills ---- */
"🎈 Everything in the game is yours to play, right here on this device. Accounts and publishing challenges open up when you're older.":
  "🎈 כל מה שיש במשחק פתוח לך לשחק, ממש כאן במכשיר הזה. חשבונות ופרסום אתגרים נפתחים כשתהיה מבוגר יותר.",
"Earn 250 🪙 total to unlock 🔧 functions!":"הרווח 250 🪙 בסך הכול כדי לפתוח 🔧 פונקציות!",
"☁️ Sign in to save your world to your account":"☁️ התחבר כדי לשמור את העולם שלך לחשבון",
"☁️ Signed in as":"☁️ מחובר בתור",
"↩️ Removed — resources refunded to the bank":"↩️ הוסר — החומרים הוחזרו לבנק",
"🌊 Can't build on water.":"🌊 אי אפשר לבנות על מים.",
"🔨 Build mode — tap a tile to place, tap a piece to remove it.":
  "🔨 מצב בנייה — לחץ על משבצת כדי להניח, לחץ על חלק כדי להסיר אותו.",
"🚫 That tile is taken — pick an empty spot.":"🚫 המשבצת הזו תפוסה — תבחר מקום ריק.",
"🤖 A robot is standing there.":"🤖 רובוט עומד שם.",
"✨ free build!":"✨ בנייה בחינם!",
"🏦 from bank":"🏦 מהבנק",
"🧪 First prove this level is solvable — build a program and press ▶! (or ➕ Add it)":
  "🧪 קודם תוכיח שאפשר לפתור את השלב — תבנה תוכנית ותלחץ ▶! (או ➕ תוסיף אותו)",
"Add 🚶 Walk To 🏪 then ⤵️ Drop at the end of your program.":
  "תוסיף 🚶 לך אל 🏪 ואז ⤵️ הפל בסוף התוכנית שלך.",
"Tap 🔁 Repeat, then tap the blocks that go inside it.":
  "לחץ על 🔁 חזור, ואז לחץ על הבלוקים שנכנסים לתוכו.",
"🚶 Walk To 🌳, then 🪓 Chop, then ▶ Run.":"🚶 לך אל 🌳, ואז 🪓 כרות, ואז ▶ הרץ.",
"Step 1 of 3 — tap the 🧩 Code button":"שלב 1 מתוך 3 — לחץ על כפתור 🧩 קוד",
"Step 2 of 3 — your blocks appear in the program above":
  "שלב 2 מתוך 3 — הבלוקים שלך מופיעים בתוכנית למעלה",
"🎉 You're a programmer now! Collect 🌳, sell at the 🏪, and unlock new powers!":
  "🎉 אתה מתכנת עכשיו! תאסוף 🌳, תמכור ב-🏪, ותפתח כוחות חדשים!",
"👋 Your robot only moves when you":"👋 הרובוט שלך זז רק כשאתה",
"🚀 Press the green":"🚀 תלחץ על הירוק",
/* ---- academy ---- */
"The blocks inside 🔧 A are counted ONCE, however many times you call it. That's the whole point of a function.":
  "הבלוקים שבתוך 🔧 A נספרים פעם אחת, כמה פעמים שלא תקרא לה. זו כל הנקודה של פונקציה.",
};

/* Sentences the game builds by concatenation — "Level 3 complete!",
   "Robot 2 sold 4 wood" — never arrive as a fixed string, so a whole-string
   table cannot hold them. Each entry here is a pattern: {n} stands for a
   run of digits, {s} for a short run of anything else (a name, a resource).
   Both sides are still whole-string anchored, so a pattern only fires when
   the ENTIRE node matches it; {1} {2} in the Hebrew pick captures by
   position, for the places where Hebrew wants them in a different order. */
const HE_T={
/* ---- academy ---- */
"{s} — Lesson {n}":"{1} — שיעור {2}",
"{s}/{s} done":"{1}/{2} הושלמו",
"· basics {s}/{s}":"· יסודות {1}/{2}",
"· next: {s} {s}":"· הבא: {1} {2}",
"✅ {s} done!  Next: {s} {s}":"✅ {1} הושלם!  הבא: {2} {3}",
/* ---- challenges ---- */
"+{s} 🪙 +{s} ⭐ — it now stands proudly next to your home base!":
  "+{1} 🪙 +{2} ⭐ — עכשיו זה עומד בגאווה ליד בסיס הבית שלך!",
"Community challenge by {s}{s} within {s} blocks!":"אתגר קהילתי מאת {1}{2} בתוך {3} בלוקים!",
"Delete Level {n}?":"למחוק את שלב {1}?",
"Delete “{s}”?":"למחוק את „{1}”?",
"New blank input (this makes it {s})":"קלט ריק חדש (זה הופך אותו ל-{1})",
"Starter routines: ON ({s} blocks)":"שגרות פתיחה: פועלות ({1} בלוקים)",
"by {s}":"מאת {1}",
"input {n}":"קלט {1}",
"{n} blocks":"{1} בלוקים",
"{n} levels · {s} — your multi-level minigame!":"{1} שלבים · {2} — המשחקון רב-השלבים שלך!",
"{s} built!":"{1} נבנה!",
"{s} is live!":"{1} באוויר!",
"{s} is yours!":"{1} שלך!",
"{s} is updated!":"{1} עודכן!",
"{s} steps":"{1} צעדים",
"{s} — Level {n}/{n}":"{1} — שלב {2}/{3}",
"{s}You beat a challenge made by another player!":"{1}ניצחת אתגר שנוצר על ידי שחקן אחר!",
"{s}You cleared all {s} levels! 🎉":"{1}סיימת את כל {2} השלבים! 🎉",
"{s}— your custom challenge!":"{1}— האתגר המותאם שלך!",
"· 💡 easier after {s}":"· 💡 קל יותר אחרי {1}",
"⚠️ Could not load: {s}":"⚠️ לא ניתן לטעון: {1}",
"⚠️ Publish failed: {s}":"⚠️ הפרסום נכשל: {1}",
"✅ Level {n} complete! Next: Level {s}/{s}":"✅ שלב {1} הושלם! הבא: שלב {2}/{3}",
"✅ Level {n} updated!":"✅ שלב {1} עודכן!",
"✅ Solvable! Now 💾 Save{s}{s}.":"✅ אפשר לפתור! עכשיו 💾 שמור{1}{2}.",
"✊ holding {s}":"✊ מחזיק {1}",
"✏️ Editing Level {n} — your solution is loaded; tweak it, run ▶ to prove it, then ➕ Update level.":
  "✏️ אתה עורך את שלב {1} — הפתרון שלך נטען; שנה אותו, הרץ ▶ כדי להוכיח, ואז ➕ עדכן שלב.",
"✏️ Editing “{s}” — change it, prove it ▶, then 💾 Save to update.":
  "✏️ אתה עורך את „{1}” — שנה אותו, תוכיח ▶, ואז 💾 שמור כדי לעדכן.",
"✏️ Input {n} is on the board — everything you change now belongs to it.":
  "✏️ קלט {1} נמצא על הלוח — כל מה שתשנה עכשיו שייך לו.",
"✏️ Input {s} is still blank — draw it before starting another.":
  "✏️ קלט {1} עדיין ריק — צייר אותו לפני שתתחיל אחד נוסף.",
"✏️ You are drawing input {s} of {s}":"✏️ אתה מצייר קלט {1} מתוך {2}",
"✖ Left level {s} as it was — designing a new level now.":
  "✖ שלב {1} נשאר כמו שהיה — עכשיו מעצבים שלב חדש.",
"❌ You answered {s}, but that's not right for this row. Check your algorithm!":
  "❌ ענית {1}, אבל זו לא התשובה הנכונה לשורה הזו. תבדוק את האלגוריתם שלך!",
"➕ Input {n} — blank board. Draw its blueprint and place its blocks; everything you do now belongs to this input.":
  "➕ קלט {1} — לוח ריק. צייר את התוכנית שלו והנח את הבלוקים; כל מה שתעשה עכשיו שייך לקלט הזה.",
"🌍 Updated “{s}”!":"🌍 „{1}” עודכן!",
"🎁 Players will open this challenge with your routines ({n} blocks) already written.":
  "🎁 שחקנים יפתחו את האתגר הזה כשהשגרות שלך ({1} בלוקים) כבר כתובות.",
"🎉 {s} built! +{s} 🪙":"🎉 {1} נבנה! +{2} 🪙",
"🎬 Level {n} banked — design the next, then 💾 Save the pack!":
  "🎬 שלב {1} נשמר — תעצב את הבא, ואז 💾 שמור את החבילה!",
"🎬 Saved “{s}” — {n} levels!":"🎬 „{1}” נשמר — {2} שלבים!",
"🎬 {n} lv":"🎬 {1} שלבים",
"🎬 {s} complete — all {s} levels cleared!":"🎬 {1} הושלם — כל {2} השלבים נוצחו!",
"👁 Input {n} is visible again.":"👁 קלט {1} גלוי שוב.",
"🔁 Function {s} called itself too many times — it never stops!":
  "🔁 הפונקציה {1} קראה לעצמה יותר מדי פעמים — היא לא נעצרת!",
"🙈 Input {n} is now a secret test.":"🙈 קלט {1} הוא עכשיו מבחן סודי.",
"🚧 The robot can't start on {s} — pick an open tile!":
  "🚧 הרובוט לא יכול להתחיל על {1} — בחר משבצת פנויה!",
"🚫 Too many blocks ({n}/{s}) — squeeze more into loops! 🔁":
  "🚫 יותר מדי בלוקים ({1}/{2}) — תדחוס עוד לתוך לולאות! 🔁",
"🧪 Passed {s}/{s} — failed on {s}. One program has to solve them all!":
  "🧪 עברת {1}/{2} — נכשלת ב-{3}. תוכנית אחת צריכה לפתור את כולם!",
"🧱 Almost! {s} tiles still missing — tweak your loops and run again!":
  "🧱 כמעט! עוד {1} משבצות חסרות — שנה את הלולאות ותריץ שוב!",
/* ---- puzzle chapters ---- */
"{s} — Level {n}":"{1} — שלב {2}",
/* ---- creator guide ---- */
"Replace the board you're working on with “{s}”?":"להחליף את הלוח שאתה עובד עליו ב„{1}”?",
"teaches {s}":"מלמד {1}",
"{s}  ✏️ It's yours now: change anything, then press ▶ to prove it.":
  "{1}  ✏️ עכשיו הוא שלך: תשנה מה שתרצה, ואז תלחץ ▶ כדי להוכיח.",
"🛠️ “{s}” is on the board — solve it first, then make it yours!":
  "🛠️ „{1}” על הלוח — קודם תפתור אותו, ואז תהפוך אותו לשלך!",
/* ---- mentor ---- */
"🔍 I checked {s} — its program is EMPTY! Open 🧩 Code and add some blocks first.":
  "🔍 בדקתי את {1} — התוכנית שלו ריקה! פתח 🧩 קוד ותוסיף כמה בלוקים קודם.",
"🔍 {s} has a program but isn't running. Press the green ▶ button!":
  "🔍 ל-{1} יש תוכנית אבל הוא לא רץ. תלחץ על הכפתור הירוק ▶!",
"🔍 {s} is blocked! Something is in the way (or its bag is full / nothing to collect). Try a ❓ If blocked → Turn Right block so it steers around obstacles by itself.":
  "🔍 {1} חסום! משהו בדרך (או שהתיק מלא / אין מה לאסוף). תנסה בלוק ❓ אם חסום ← פנה ימינה כדי שיעקוף מכשולים בעצמו.",
"🔍 {s} looks fine — it's at ({s}, {s}) and running. Tap 🎯 to jump the camera to it! Maybe it finished its program? Use ♾️ Forever to keep it going.":
  "🔍 {1} נראה בסדר — הוא ב-({2}, {3}) ורץ. לחץ על 🎯 כדי לקפוץ אליו עם המצלמה! אולי הוא סיים את התוכנית שלו? השתמש ב-♾️ לתמיד כדי שימשיך.",
/* ---- tower editor ---- */
"Rebuild the blueprint in 3D — {s} bricks, peak ⛰ {s}, within {s} blocks.":
  "בנה מחדש את התוכנית בתלת-ממד — {1} לבנים, שיא ⛰ {2}, בתוך {3} בלוקים.",
"The brick at {s},{s} hangs over a 🕳️ pit — bricks need ground under them.":
  "הלבנה ב-{1},{2} תלויה מעל 🕳️ בור — לבנים צריכות קרקע מתחתיהן.",
"The brick at {s},{s} isn't above its own ⛰️ ground — raise the brick or lower the ground.":
  "הלבנה ב-{1},{2} לא נמצאת מעל ⛰️ הקרקע שלה — הגבה את הלבנה או הנמך את הקרקע.",
"The robot can't build the brick at {s},{s} — it has to stand on a neighbouring tile {s} high. Plan a step beside it.":
  "הרובוט לא יכול לבנות את הלבנה ב-{1},{2} — הוא צריך לעמוד על משבצת שכנה בגובה {3}. תכנן מדרגה לידה.",
"{s} bricks from {s} blocks is very tight — the player will need nested loops.":
  "{1} לבנים מתוך {2} בלוקים זה צפוף מאוד — השחקן יצטרך לולאות מקוננות.",
"✅ Buildable — {s} bricks, peak ⛰ {s}. Write a program, press ▶ to prove it, then 💾 Save.":
  "✅ ניתן לבנייה — {1} לבנים, שיא ⛰ {2}. תכתוב תוכנית, תלחץ ▶ כדי להוכיח, ואז 💾 שמור.",
"✏️ Editing “{s}” — your solution is loaded. Change it, prove it ▶, then 💾 Save.":
  "✏️ אתה עורך את „{1}” — הפתרון שלך נטען. שנה אותו, תוכיח ▶, ואז 💾 שמור.",
"💾 Saved “{s}” to My Challenges!":"💾 „{1}” נשמר לאתגרים שלי!",
"🧊 Published “{s}”!":"🧊 „{1}” פורסם!",
/* ---- world, moderation, tower 3D, orders, shop ---- */
"{s} — what to do?":"{1} — מה לעשות?",
"🤖 Selected {s}":"🤖 נבחר {1}",
"Hide everything by “{s}”?\n\nYou won't see their challenges any more. You can undo this in the 🛒 shop.":
  "להסתיר את כל מה שנוצר על ידי „{1}”?\n\nלא תראה יותר את האתגרים שלהם. אפשר לבטל את זה ב-🛒 חנות.",
"⚠️ Could not send the report: {s}":"⚠️ לא ניתן לשלוח את הדיווח: {1}",
"✅ You'll sign your challenges as “{n}”.":"✅ תחתום על האתגרים שלך בשם „{1}”.",
"🚫 Hidden everything by “{s}”.":"🚫 הוסתר כל מה שנוצר על ידי „{1}”.",
"🚧 {s} brick{s} outside the plan — the red ones. ⛏️ Take Brick removes the top one.":
  "🚧 {1} לבנים{2} מחוץ לתוכנית — האדומות. ⛏️ קח לבנה מסירה את העליונה.",
"🧱 {s} brick{s} still missing from the blueprint — the ghost outlines show where.":
  "🧱 עוד {1} לבנים{2} חסרות בתוכנית — קווי הרפאים מראים איפה.",
"{s} is most wanted right now — it sells for a premium.":
  "{1} הכי מבוקש כרגע — הוא נמכר במחיר מועדף.",
"💎 A rich {s} seam surfaced — it is on the 📻 team channel for {n}s!":
  "💎 עורק {1} עשיר התגלה — הוא בערוץ הצוות 📻 למשך {2} שניות!",
"📈 The market now wants {s} most — worth {s} 🪙 each!":
  "📈 השוק רוצה עכשיו הכי הרבה {1} — שווה {2} 🪙 ליחידה!",
"📋 New order! {s} → {s} 🪙":"📋 הזמנה חדשה! {1} ← {2} 🪙",
"📋 Order filled! +{s} 🪙":"📋 ההזמנה מולאה! +{1} 🪙",
"📣 {s} RUSH":"📣 בהלת {1}",
"📣 {s} RUSH! Prices spiked to {s} 🪙 for a minute — send everyone!":
  "📣 בהלת {1}! המחירים זינקו ל-{2} 🪙 לדקה — תשלח את כולם!",
", takes {s}":", מקבל {1}",
"· takes {s}":"· מקבל {1}",
"Delete “{n}” from your library?":"למחוק את „{1}” מהספרייה שלך?",
"Save 🔧 {s} ({n} blocks{n})":"שמור 🔧 {1} ({2} בלוקים{3})",
"📚 Saved {s} — use it in any world or minigame.":
  "📚 {1} נשמר — אפשר להשתמש בו בכל עולם ובכל משחקון.",
"📚 Your library is full ({s}). Delete one first.":"📚 הספרייה שלך מלאה ({1}). תמחק אחת קודם.",
"🔧 Function {s} is empty — write something in it first.":
  "🔧 הפונקציה {1} ריקה — קודם תכתוב בה משהו.",
"🔧 {s} loaded into {s}.":"🔧 {1} נטען אל {2}.",
"🪙 {s} on delivery":"🪙 {1} במסירה",
"Sell the Bank — +{s} 🪙":"מכור את הבנק — +{1} 🪙",
"{s} carries {s} now. Fewer trips home!":"{1} נושא עכשיו {2}. פחות נסיעות הביתה!",
"{s} runs code 25% faster. (x{n} now, max x2)":
  "{1} מריץ קוד מהר ב-25%. (x{2} עכשיו, מקסימום x2)",
"⚡ {s} is faster!":"⚡ {1} מהיר יותר!",
"🎒 {s} bag upgraded to {s}!":"🎒 התיק של {1} שודרג ל-{2}!",
"💰 Bank sold for {s} 🪙":"💰 הבנק נמכר ב-{1} 🪙",
"🤖 {s} joined your team!":"🤖 {1} הצטרף לצוות שלך!",
/* ---- account, build, editor, journey, tutorial, skills ---- */
"🎁 Day {s} of your adventure — welcome back!":"🎁 יום {1} של ההרפתקה שלך — ברוך שובך!",
"🎁 Day {s} of your adventure! Daily gift: +{s} 🪙":
  "🎁 יום {1} של ההרפתקה שלך! מתנה יומית: +{2} 🪙",
"new blocks → inside {s}":"בלוקים חדשים ← בתוך {1}",
"📋 Copied {s}":"📋 הועתק {1}",
"🪙/min {s}":"🪙 לדקה {1}",
"tap {s} then add blocks inside":"לחץ על {1} ואז תוסיף בלוקים בפנים",
"⏹ {s} stopped — program changed":"⏹ {1} נעצר — התוכנית השתנתה",
"Lv {s}":"רמה {1}",
"— new hat {s} unlocked! (🛒 → Style)":"— כובע חדש {1} נפתח! (🛒 ← סטייל)",
"⭐ LEVEL {s}! +{s} 🪙":"⭐ רמה {1}! +{2} 🪙",
"📜 Quest complete: {s} — tap 📜 to claim!":"📜 משימה הושלמה: {1} — לחץ על 📜 כדי לקבל!",
"💾 World exported!":"💾 העולם יוצא לקובץ!",
"How many blocks may the player use? (3-{s})":"בכמה בלוקים השחקן רשאי להשתמש? (3-{1})",
"🎯 Following {s}":"🎯 עוקב אחרי {1}",
"💰 Sold goods for {s} 🪙":"💰 סחורה נמכרה ב-{1} 🪙",
"🧩 {s} has no program yet! Open the Code editor.":"🧩 ל-{1} אין עדיין תוכנית! פתח את עורך הקוד.",
"😕 Need {s} — send robots to gather & bank more!":"😕 חסר {1} — תשלח רובוטים לאסוף ולהפקיד עוד!",
"{n} steps done —":"{1} צעדים הושלמו —",
"→  Next: {s} {s}":"←  הבא: {1} {2}",
"🌍 While you were away: {s}{s}{s}!":"🌍 בזמן שלא היית: {1}{2}{3}!",
"Hidden players: {s}":"שחקנים מוסתרים: {1}",
"Your name: {s}":"השם שלך: {1}",
"+{n}% robot speed":"+{1}% מהירות רובוט",
"+{s}% bonus ore":"+{1}% עפרה בונוס",
"+{s}% bonus wood":"+{1}% עץ בונוס",
"+{s}% sale prices":"+{1}% מחירי מכירה",
"{s}% free builds":"{1}% בניות בחינם",
"{s} — Lesson {n}{n}":"{1} — שיעור {2}{3}",
"Bank: {s}{s} {s}{s} {s}{s} {s}{s}{s} — or keep it and let robots 🔨 Build from it!":
  "בנק: {1}{2} {3}{4} {5}{6} {7}{8}{9} — או תשאיר אותו ותן לרובוטים 🔨 לבנות ממנו!",
/* ---- level-up readouts ---- */
"{s} {s} Lv {s}! {s}":"{1} {2} רמה {3}! {4}",
"⭐ LEVEL {s}! +{s} 🪙{s}":"⭐ רמה {1}! +{2} 🪙{3}",
"Lv {s}{s}":"רמה {1}{2}",
/* ---- walkthrough leftovers ---- */
"easier after {s}":"קל יותר אחרי {1}",
"{s} — Lesson {n} (advanced)":"{1} — שיעור {2} (מתקדם)",
/* ---- audit leftovers ---- */
"start {n},{n}":"התחלה {1},{2}",
/* ---- version row ---- */
"Version {s}":"גרסה {1}",
};

/* ---- pattern index ----
   One regex per entry would mean hundreds of regex runs per text node.
   Each pattern is filed under its longest literal word instead, so a node
   only tries the handful of patterns that share a word with it. */
const TIDX=new Map();
function compile(pat,val){
  const parts=pat.split(/(\{[ns]\})/);
  let rx="",kinds=[],anchorWord="";
  for(let i=0;i<parts.length;i++){
    const part=parts[i];
    if(part==="{n}"){ rx+="(\\d+(?:[.,]\\d+)?)"; kinds.push("n"); continue; }
    if(part==="{s}"){ rx+="(.{0,60}?)"; kinds.push("s"); continue; }
    /* A space next to a placeholder is optional. "📣 {s} RUSH!" is filled
       with an emoji, and the emoji-free form of the pattern therefore has a
       space with nothing on the other side of it — which the emoji-free
       form of the live string does not, because trimming took it. Without
       this the whole pattern misses by one character. */
    let lit=part,pre="",post="";
    if(i>0&&/^\s+/.test(lit)){ lit=lit.replace(/^\s+/,""); pre="\\s*"; }
    if(i<parts.length-1&&/\s+$/.test(lit)){ lit=lit.replace(/\s+$/,""); post="\\s*"; }
    rx+=pre+lit.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+post;
    for(const w of lit.match(/[A-Za-z][A-Za-z'-]+/g)||[])
      if(w.length>anchorWord.length)anchorWord=w;
  }
  if(!anchorWord)return;
  const e={re:new RegExp("^"+rx+"$"),val:val,kinds:kinds};
  const key=anchorWord.toLowerCase();
  if(!TIDX.has(key))TIDX.set(key,[]);
  TIDX.get(key).push(e);
}
/* A captured value is usually a name and passes through untouched, but not
   always: "the market now wants ⛓️ iron most" captures the resource, and a
   Hebrew sentence with an English noun dropped into the middle of it reads
   worse than no translation at all. Each capture gets a whole-string lookup
   of its own — never the patterns, so this cannot recurse — and anything
   the dictionary does not know is left exactly as it arrived. */
function trWord(c){
  const core=norm(c);
  if(!core)return c;
  const raw=IDX_RAW[core];
  if(raw)return raw;
  const hit=IDX[core];
  if(!hit)return c;
  const e=c.match(EDGE)||["",""];
  return (e[0]||"")+hit+(e[e.length-1]||"");
}
function fill(val,caps){
  caps=caps.map(c=>c==null?c:trWord(c));
  let i=0;
  return val.replace(/\{(\d+)\}/g,(_,d)=>caps[+d-1]!==undefined?caps[+d-1]:"")
            .replace(/\{[ns]\}/g,()=>caps[i++]!==undefined?caps[i-1]:"");
}
function trTemplate(core){
  const words=core.match(/[A-Za-z][A-Za-z'-]+/g);
  if(!words)return null;
  const tried=new Set();
  for(const w of words){
    const list=TIDX.get(w.toLowerCase());
    if(!list)continue;
    for(const e of list){
      if(tried.has(e))continue; tried.add(e);
      const mm=core.match(e.re);
      if(mm)return fill(e.val,mm.slice(1));
    }
  }
  return null;
}

/* one index, built once, keyed on the emoji-free form both ways */
const IDX={}, IDX_N={}, IDX_RAW={};
for(const k in HE) IDX[norm(k)]=norm(HE[k]);
for(const k in HE_RAW) IDX_RAW[norm(k)]=HE_RAW[k];
for(const k in HE_N) IDX_N[norm(k).replace(NUM,"{n}")]=HE_N[k];
/* Every pattern is filed twice: once as written, emoji and all, and once
   emoji-free. The first is what matches a sentence that reached us intact,
   and it keeps an emoji that landed INSIDE a captured value — the 💎 in
   "📣 💎 RUSH!" is the resource, not decoration, and normalising it away
   put an empty string into the Hebrew. The second is the fallback for a
   sentence that lost its emoji on the way here. */
const collapse=s=>String(s).replace(/\s+/g," ").trim();
for(const k in HE_T){
  const raw=collapse(k), bare=norm(k);
  compile(raw,HE_T[k]);
  if(bare!==raw)compile(bare,HE_T[k]);
}

/* ---------- the swap ---------- */
function tr(s,el){
  const core=norm(s);
  if(!core)return null;
  if(el&&el.closest)for(const [sel,map] of SCOPED)
    if(map[core]&&el.closest(sel)){
      const e=s.match(EDGE)||["",""];
      return (e[0]||"")+map[core]+(e[e.length-1]||"");
    }
  const edges=s.match(EDGE)||["",""];
  const lead=edges[0]||"", tail=edges[edges.length-1]||"";
  const raw=IDX_RAW[core];
  if(raw)return raw;
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
  /* A pattern value carries its own emoji, like HE_RAW, so it is used as
     written rather than wrapped in the node's own leading/trailing ones. */
  const whole=collapse(s);
  const pat=trTemplate(whole)||(whole===core?null:trTemplate(core));
  if(pat!==null&&pat!==undefined)return pat;
  return null;
}
/* ui-icons.js lifts every emoji out of the text into its own span, so
   "Collect 5 ⛓️ iron" reaches us as three nodes and no single one of them
   matches the dictionary. Whichever observer ran first, the sentence is
   still recoverable: each span remembers the character it replaced.

   Only the unbroken RUN of text nodes and lifted emoji is put back
   together, never the whole element — a lesson row is
   "<b>Chop</b> — Cuts down the <emoji> tree…", and flattening it to reach
   the sentence would take the bold name with it. The run is looked up as
   one string and, on a hit, collapses to a single text node; ui-icons sees
   that change and lifts its emoji again. */
function runs(el){
  let run=[],hit=false;
  const flush=()=>{
    const r=run; run=[];
    if(r.length<2)return;
    let str="";
    for(const k of r)str+=(k.nodeType===3)?k.nodeValue:k.getAttribute("data-e");
    if(!str.trim()||str.length>400)return;
    const out=tr(str,el);
    if(out===null||out===str)return;
    const p=r[0].parentNode; if(!p)return;
    p.replaceChild(document.createTextNode(out),r[0]);
    for(let i=1;i<r.length;i++)if(r[i].parentNode)r[i].parentNode.removeChild(r[i]);
    hit=true;
  };
  for(const k of [...el.childNodes]){
    if(k.nodeType===3){run.push(k);continue;}
    if(k.nodeType===1&&k.classList&&k.classList.contains("ui-emoji")&&
       k.getAttribute("data-e")!==null){run.push(k);continue;}
    flush();
  }
  flush();
  return hit;
}
function walk(node){
  if(node.nodeType===3){
    const p=node.parentNode;
    if(!p||SKIP.has(p.nodeName)||p.closest&&p.closest(SKIP_IN))return;
    const out=tr(node.nodeValue,p);
    /* Only when it actually differs. Assigning nodeValue the value it
       already holds still queues a characterData record, which calls this
       observer, which assigns it again — a microtask loop that never
       yields, so the page freezes. Any entry that translates to itself was
       enough to trigger it; the Language row's "English · עברית" did. */
    if(out!==null&&out!==node.nodeValue)node.nodeValue=out;
    return;
  }
  if(node.nodeType!==1)return;
  if(node.closest&&node.closest(SKIP_IN))return;
  /* Attributes first: a placeholder on an <input> is player-facing even
     though the element's contents are the player's own text and are never
     touched. Skipping the element wholesale left "Ask Byte something…" in
     English. */
  for(const a of ["title","aria-label","placeholder"]){
    const v=node.getAttribute&&node.getAttribute(a);
    if(v){const out=tr(v,node); if(out!==null&&out!==v)node.setAttribute(a,out);}
  }
  if(SKIP.has(node.nodeName))return;
  runs(node);
  for(let c=node.firstChild;c;c=c.nextSibling)walk(c);
}

let mo=null;
function on(){
  /* lang, and a class — but deliberately NOT dir="rtl". Flipping the page
     moved every button to the other side, which is a bigger change than the
     player asked for when they picked a language: controls they had learned
     the position of swapped over, and every rule written with left/right had
     to be mirrored to match. Hebrew words, same layout. What RTL was doing
     for the text itself is done instead by unicode-bidi:plaintext in the
     stylesheet, per paragraph, without moving anything. */
  document.documentElement.setAttribute("lang","he");
  document.documentElement.classList.add("he");
  walk(document.body);
  if(mo)return;
  mo=new MutationObserver(ms=>{
    for(const m of ms){
      if(m.type==="characterData")walk(m.target);
      else for(const n of m.addedNodes)walk(n);
      /* The reassembly in runs() only ever ran on an element that arrived
         whole. In the game the common shape is the opposite: an element that
         is already on the page has its textContent replaced, ui-icons.js
         lifts the emoji out of it, and what reaches this observer is a
         handful of loose text nodes and spans — no element to reassemble.
         Offer the parent as well, so a sentence split around its emoji is
         still recognised. */
      const t=m.target;
      if(t&&t.nodeType===1&&!SKIP.has(t.nodeName)&&!(t.closest&&t.closest(SKIP_IN)))
        runs(t);
    }
  });
  mo.observe(document.body,{childList:true,subtree:true,characterData:true});
}
/* Off is a reload: the English strings were replaced in place, and putting
   them all back by reverse lookup would be guesswork the moment one of them
   is a word that appears in both directions. */
function off(){
  document.documentElement.setAttribute("lang","en");
  document.documentElement.classList.remove("he");
  document.documentElement.removeAttribute("dir");   // older builds set it
  if(mo){mo.disconnect();mo=null;}
}
function i18nApply(){ (typeof lang!=="undefined"&&lang==="he")?on():off(); }

window.i18nApply=i18nApply;
window.i18nOn=on; window.i18nOff=off;
/* selfMapped() is a guard, not a feature: an entry whose translation is the
   string it translates makes walk() write a node the value it already has,
   which queues a mutation, which calls walk() again. One such entry froze
   the game. The write is guarded now; this reports them anyway, because an
   entry that changes nothing is a mistake in its own right. */
window.CC_I18N={size:Object.keys(HE).length, has:s=>!!HE[String(s).trim()],
  selfMapped:()=>{
    const out=[];
    for(const t of [HE,HE_RAW,HE_T])
      for(const k in t) if(t[k]===k)out.push(k);
    return out;
  }};
})();

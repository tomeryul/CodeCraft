"use strict";
/* ---------------- Python you can type ----------------
   python.js writes a block program out as Python. This file reads Python
   back in as a block program, so the 🐍 tab is an editor and not a
   listing: type a line and its block appears, change a block and its line
   changes.

   The text is turned INTO blocks, not run. That keeps one interpreter, one
   block budget, one save format and one set of level rules — a level that
   hands out Move, Turn and Repeat accepts exactly those three typed, and
   nothing a board's author kept back gets in through the keyboard.

   It reads the Python this game writes, plus the handful of ways a child
   would naturally say the same thing (x += 1, elif, print, brackets round
   a question). Anything else is answered with a sentence about that line —
   what is wrong and what to type instead — never with "invalid syntax".

   Nothing in here touches the page. pyedit.js is the editor on top of it,
   and test/python.js drives this file on its own. */

/* the tables in python.js, read the other way round */
const PY_ACT_R={}, PY_SEES_R={}, PY_ASK_R={}, PY_READ_R={};
for(const t in PY_ACT)PY_ACT_R[PY_ACT[t]]=t;
for(const c in PY_SEES)PY_SEES_R[PY_SEES[c]]=c;
for(const c in PY_ASK)PY_ASK_R[PY_ASK[c]]=c;
for(const s in PY_READ)PY_READ_R[PY_READ[s].replace("()","")]=s;
/* robot.<name>(…) for the blocks that take something */
const PY_ARG={rest:"rest",wait:"wait",build:"build",face_nearest:"faceNearest",walk_to:"goNear",
  go_to:"goTo",say:"say",try_code:"tryCode",
  walk_to_nearest:"goNear"};      // what the listing called it before; still read
/* words a variable cannot be called: Python's own, and the game's objects */
const PY_KEPT=new Set(("False None True and as assert async await break class continue def del elif else "+
  "except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield "+
  "robot team market range print routine_a routine_b").split(" "));
/* real Python the robots have no use for — named, so the answer can say so */
const PY_LATER=new Set(("import from class try except finally break continue with lambda global nonlocal "+
  "del assert raise yield async await is as None").split(" "));

/* ---- what went wrong, in the player's language ----
   Written here, in both languages, and not in the dictionary in i18n.js:
   that dictionary matches whole text nodes and translates the words it
   captures, so "tree" inside a sentence about code would come back as
   "עץ" — in a line the child is being told to type. Text between
   backticks is code and is shown as code, in Latin letters, whatever the
   language around it. {0} {1} are filled in; a list fills in as several
   pieces of code. */
const PY_MSG={
  badChar:["Python doesn't use `{0}` here.","פייתון לא משתמש ב-`{0}` כאן."],
  nameLetters:["Names are written in English letters, like `count`. Other letters only go inside quotes.",
    "שמות כותבים באותיות באנגלית, כמו `count`. אותיות אחרות נכנסות רק בתוך מירכאות."],
  badNumber:["`{0}` is not a number and not a name — a name can't start with a digit.",
    "`{0}` הוא לא מספר וגם לא שם — שם לא יכול להתחיל בספרה."],
  strOpen:["This text never closes. Add `\"` where it ends.","הטקסט הזה לא נסגר. תוסיף `\"` איפה שהוא נגמר."],
  parenOpen:["A `(` on this line never closes. Add a `)`.","יש בשורה הזאת `(` שלא נסגר. תוסיף `)`."],
  parenExtra:["There is a `)` here with no `(` before it.","יש כאן `)` בלי `(` לפניו."],
  semicolon:["Python doesn't end a line with `;` — just delete it.","בפייתון לא מסיימים שורה ב-`;` — פשוט תמחק אותו."],
  slashComment:["A note in Python starts with `#`, not `//`.","הערה בפייתון מתחילה ב-`#`, לא ב-`//`."],
  braces:["Python doesn't use `{0}`. What goes inside a loop is pushed in with spaces.",
    "פייתון לא משתמש ב-`{0}`. מה שבתוך לולאה פשוט מוזז פנימה עם רווחים."],

  bodyIndent:["This line belongs inside the `{0}` above it, so it has to be pushed in. Start it with 4 spaces.",
    "השורה הזאת שייכת ל-`{0}` שמעליה, אז צריך להזיז אותה פנימה. תתחיל אותה ב-4 רווחים."],
  bodyNone:["`{0}` has nothing inside it yet. Tap a block to put it inside — or type a line under it, pushed in with 4 spaces.",
    "בתוך ה-`{0}` עדיין אין כלום. תלחץ על בלוק כדי להכניס אותו פנימה — או תכתוב שורה מתחתיו, מוזזת פנימה ב-4 רווחים."],
  indentExtra:["This line is pushed in, but the line above it doesn't open anything. Line it up with the line above.",
    "השורה הזאת מוזזת פנימה, אבל השורה שמעליה לא פותחת כלום. תיישר אותה עם השורה שמעליה."],
  indentFirst:["A program starts at the left edge. Take out the spaces in front of this line.",
    "תוכנית מתחילה בקצה השמאלי. תמחק את הרווחים שלפני השורה הזאת."],
  indentOff:["This line doesn't line up with the lines above it. Give it the same number of spaces as one of them.",
    "השורה הזאת לא מיושרת עם השורות שמעליה. תן לה אותו מספר רווחים כמו לאחת מהן."],
  colon:["A `{0}` line ends with a colon. Add `:` at the end.","שורה של `{0}` מסתיימת בנקודתיים. תוסיף `:` בסוף."],
  afterColon:["What is inside a `{0}` goes on the next line, pushed in — not after the `:`.",
    "מה שבתוך ה-`{0}` נכתב בשורה הבאה, מוזז פנימה — לא אחרי ה-`:`."],

  unknownStmt:["I can't read this line. A step for the robot looks like `{0}`.",
    "לא הצלחתי לקרוא את השורה הזאת. צעד של הרובוט נראה ככה: `{0}`."],
  needRobot:["Say who does it: `{0}`.","צריך להגיד מי עושה את זה: `{0}`."],
  unknownMethod:["The robot doesn't know `{0}`.","הרובוט לא מכיר את `{0}`."],
  unknownMethodSug:["The robot doesn't know `{0}`. Did you mean `{1}`?","הרובוט לא מכיר את `{0}`. התכוונת ל-`{1}`?"],
  unknownFunc:["There is no function called `{0}` here.","אין כאן פונקציה בשם `{0}`."],
  needParens:["Add brackets so it happens: `{0}`.","תוסיף סוגריים כדי שזה יקרה: `{0}`."],
  noArgs:["`{0}` takes nothing in its brackets. Write `{1}`.","`{0}` לא מקבל כלום בסוגריים. תכתוב `{1}`."],
  shape:["`{0}` is written like this: `{1}`.","את `{0}` כותבים ככה: `{1}`."],
  needNumber:["`{0}` needs a whole number in its brackets, like `{1}`.","`{0}` צריך מספר שלם בסוגריים, כמו `{1}`."],
  numRange:["Use a whole number from {0} to {1} here.","כאן צריך מספר שלם בין {0} ל-{1}."],
  needPlace:["`{0}` needs a name in quotes, like `{1}`.","`{0}` צריך שם בתוך מירכאות, כמו `{1}`."],
  unknownPlace:["The robot doesn't know `{0}` here. It knows: {1}.","הרובוט לא מכיר כאן את `{0}`. הוא מכיר: {1}."],
  needValue:["`{0}` needs something in its brackets, like `{1}`.","`{0}` צריך משהו בסוגריים, כמו `{1}`."],
  strLong:["That text is too long — keep it to 30 letters.","הטקסט הזה ארוך מדי — עד 30 תווים."],
  notHere:["`{0}` isn't one of this level's blocks.","`{0}` הוא לא אחד מהבלוקים של השלב הזה."],
  locked:["`{0}` is still locked.","`{0}` עדיין נעול."],
  boardOnly:["`{0}` only works on a puzzle board.","`{0}` עובד רק על לוח של חידה."],
  questionAlone:["`{0}` is a question. Ask it after `if` or `while`.","`{0}` היא שאלה. שואלים אותה אחרי `if` או `while`."],
  readingAlone:["`{0}` gives back a number. Keep it in a box: `x = {0}`.","`{0}` מחזיר מספר. תשמור אותו בקופסה: `x = {0}`."],
  actionAsQuestion:["`{0}` is something the robot does, not a question. A question looks like `{1}`.",
    "`{0}` זה משהו שהרובוט עושה, לא שאלה. שאלה נראית ככה: `{1}`."],
  trailing:["There is something extra at the end of this line: `{0}`. Each step gets a line of its own.",
    "יש משהו מיותר בסוף השורה: `{0}`. כל צעד מקבל שורה משלו."],
  notYet:["`{0}` is real Python, but the robots here don't use it yet.",
    "`{0}` זה פייתון אמיתי, אבל הרובוטים כאן עדיין לא משתמשים בו."],

  nameLong:["The name `{0}` is too long. Names here have up to 10 letters.","השם `{0}` ארוך מדי. שמות כאן הם עד 10 תווים."],
  nameKept:["`{0}` is a word Python keeps for itself. Pick another name.","`{0}` היא מילה שפייתון שומר לעצמו. תבחר שם אחר."],
  assignWhat:["I can't work that out. A box takes a number, text in quotes, another box, or a sum like `{0} = {0} + 1`.",
    "לא הצלחתי להבין את זה. קופסה מקבלת מספר, טקסט במירכאות, קופסה אחרת, או חשבון כמו `{0} = {0} + 1`."],
  mathNo:["The robots can add and take away, but not `{0}` yet.","הרובוטים יודעים לחבר ולחסר, אבל עדיין לא `{0}`."],
  mathLong:["One sum on a line, like `{0} = {0} + 1`.","חשבון אחד בשורה, כמו `{0} = {0} + 1`."],
  mathText:["Text can't be added up. Use numbers or boxes.","אי אפשר לחבר טקסט. תשתמש במספרים או בקופסאות."],
  subVar:["The robots can add another box (`{0} = {0} + {1}`), but can't take one away yet.",
    "הרובוטים יודעים לחבר קופסה אחרת (`{0} = {0} + {1}`), אבל עדיין לא לחסר אותה."],
  multiAssign:["Only a function fills several boxes at once: `a, b = routine_a()`.",
    "רק פונקציה ממלאת כמה קופסאות בבת אחת: `a, b = routine_a()`."],
  boxQuestion:["A box holds a number or text, not a question. Ask `{0}` after `if`.",
    "קופסה מחזיקה מספר או טקסט, לא שאלה. את `{0}` שואלים אחרי `if`."],

  forRange:["A loop here is written `for i in range(3):`.","לולאה כותבים כאן ככה: `for i in range(3):`."],
  rangeStart:["Counting starts at 1 here: `range(1, 6)` counts 1, 2, 3, 4, 5.",
    "הספירה כאן מתחילה מ-1: `range(1, 6)` סופר 1, 2, 3, 4, 5."],
  rangeNum:["A counting loop counts up to a number, like `range(1, 6)`.","לולאת ספירה סופרת עד מספר, כמו `range(1, 6)`."],
  loopVar:["`for {0} in range({1})` repeats, but `{0}` doesn't count along. To count, write `for {0} in range(1, {2}):`.",
    "`for {0} in range({1})` חוזר שוב ושוב, אבל `{0}` לא סופר. כדי לספור תכתוב `for {0} in range(1, {2}):`."],
  loopVarBox:["`{0}` doesn't count inside this loop. To count, use a counting loop: `for {0} in range(1, 6):`.",
    "`{0}` לא סופר בתוך הלולאה הזאת. כדי לספור תשתמש בלולאת ספירה: `for {0} in range(1, 6):`."],

  condNone:["After `{0}` comes a question, like `{1}`.","אחרי `{0}` באה שאלה, כמו `{1}`."],
  condWhat:["I can't read that question. Try `{0}` or `x > 3`.","לא הצלחתי לקרוא את השאלה. תנסה `{0}` או `x > 3`."],
  condAssign:["To compare, use two equals signs: `{0}`. One `=` puts a value in a box.",
    "כדי להשוות משתמשים בשני סימני שווה: `{0}`. סימן `=` אחד שם ערך בקופסה."],
  condOp:["`{0}` isn't here yet. Use `>`, `<`, `==` or `!=`.","`{0}` עדיין לא קיים כאן. תשתמש ב-`>`, `<`, `==` או `!=`."],
  condOpHint:["`{0}` isn't here yet. `{1}` asks the same thing.","`{0}` עדיין לא קיים כאן. `{1}` שואל את אותו דבר."],
  condAndOr:["One question at a time: `{0}` isn't here yet. Put a second `if` inside the first.",
    "שאלה אחת בכל פעם: `{0}` עדיין לא קיים כאן. תשים `if` שני בתוך הראשון."],
  condNotNum:["`not` goes with a robot question. For numbers use `!=`.","`not` הולך עם שאלה של הרובוט. למספרים משתמשים ב-`!=`."],
  condAlways:["The answer to `{0}` never changes. Ask something that can, like `{1}`.",
    "התשובה ל-`{0}` אף פעם לא משתנה. תשאל משהו שיכול להשתנות, כמו `{1}`."],
  condText:["Questions compare numbers here, not text.","כאן שאלות משוות מספרים, לא טקסט."],
  condNotHere:["This level can't answer `{0}`. It can answer: {1}.","השלב הזה לא יודע לענות על `{0}`. הוא יודע לענות על: {1}."],
  unknownThing:["The robot can't look for `{0}`. It can see: {1}.","הרובוט לא יודע לחפש `{0}`. הוא יכול לראות: {1}."],
  unknownQuestion:["The robot doesn't know the question `{0}`.","הרובוט לא מכיר את השאלה `{0}`."],
  unknownQuestionSug:["The robot doesn't know the question `{0}`. Did you mean `{1}`?",
    "הרובוט לא מכיר את השאלה `{0}`. התכוונת ל-`{1}`?"],
  elseAlone:["`{0}` needs an `if` just above it, lined up with it.","`{0}` צריך `if` ממש מעליו, מיושר איתו."],

  defTop:["A `def` starts at the left edge — don't push it in.","`def` מתחיל בקצה השמאלי — לא מזיזים אותו פנימה."],
  defName:["Functions here are called `routine_a` and `routine_b`.","לפונקציות כאן קוראים `routine_a` ו-`routine_b`."],
  defWhat:["A function starts like this: `def routine_a():`.","פונקציה מתחילה ככה: `def routine_a():`."],
  defTwice:["`{0}` is written twice. Keep one of them.","`{0}` כתובה פעמיים. תשאיר אחת."],
  defParams:["A function takes up to 4 inputs.","פונקציה מקבלת עד 4 קלטים."],
  paramTwice:["The input `{0}` appears twice.","הקלט `{0}` מופיע פעמיים."],
  callUndefined:["`{0}` isn't written yet. Add `def {0}():` at the top.","`{0}` עדיין לא כתובה. תוסיף `def {0}():` למעלה."],
  callShape:["`{0}` is called like this: `{1}`.","ככה קוראים ל-`{0}`: `{1}`."],
  argKind:["A function's inputs are numbers or boxes, like `{0}(3, x)`.","הקלטים של פונקציה הם מספרים או קופסאות, כמו `{0}(3, x)`."],
  retMany:["A function gives back up to 4 values.","פונקציה מחזירה עד 4 ערכים."],
  retKind:["A function gives back numbers or boxes, like `return x`.","פונקציה מחזירה מספרים או קופסאות, כמו `return x`."],
  outsMany:["One call fills up to 4 boxes.","קריאה אחת ממלאת עד 4 קופסאות."],
};
function pyErr(key,args,line,col,len){
  const e=new Error("py:"+key);
  e.py={key,args:args||[],line,col:col==null?-1:col,len:len||0};
  return e;
}
/* An error as a list of pieces — {t:text}, {c:code} or {d:a dictionary
   sentence the Hebrew layer already knows} — for pyedit.js to lay out. */
function pyErrParts(err,lng){
  const m=PY_MSG[err.key]||PY_MSG.unknownStmt;
  const tpl=m[(lng||(typeof lang!=="undefined"?lang:"en"))==="he"?1:0], out=[];
  const fill=(s,code)=>{
    /* {n} outside backticks is a number or a list of code; inside, raw text */
    let last=0;
    s.replace(/\{(\d)\}/g,(mm,d,at)=>{
      if(at>last)out.push(code?{c:s.slice(last,at),j:1}:{t:s.slice(last,at)});
      const a=err.args[+d];
      if(Array.isArray(a))a.forEach((x,i)=>{if(i)out.push({t:", "});out.push({c:String(x)});});
      else out.push(code?{c:String(a),j:1}:{t:String(a)});
      last=at+mm.length;
    });
    if(last<s.length)out.push(code?{c:s.slice(last),j:1}:{t:s.slice(last)});
  };
  tpl.split("`").forEach((seg,i)=>{ if(seg)fill(seg,i%2===1); });
  /* pieces of one code span were split round a placeholder: join them back */
  const parts=[];
  for(const p of out){
    const q=parts[parts.length-1];
    if(p.c!==undefined&&p.j&&q&&q.c!==undefined&&q.j)q.c+=p.c; else parts.push(p);
  }
  parts.forEach(p=>{delete p.j;});
  if(err.dict)parts.push({t:" "},{d:err.dict});
  return parts;
}
function pyErrText(err,lng){
  return pyErrParts(err,lng).map(p=>p.t!==undefined?p.t:p.c!==undefined?p.c:p.d).join("");
}

/* ---- the nearest word, for "did you mean" ---- */
function pyNear(word,list){
  /* two letters the wrong way round count as one slip, not two: "jupm" */
  const dist=(a,b)=>{
    const m=a.length,n=b.length; let prev=[],old=null;
    for(let j=0;j<=n;j++)prev[j]=j;
    for(let i=1;i<=m;i++){
      const cur=[i];
      for(let j=1;j<=n;j++){
        cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
        if(old&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])cur[j]=Math.min(cur[j],old[j-2]+1);
      }
      old=prev; prev=cur;
    }
    return prev[n];
  };
  let best=null,bd=1e9;
  const w=String(word).toLowerCase();
  for(const c of list){
    const d=dist(w,String(c).toLowerCase());
    if(d<bd){bd=d;best=c;}
  }
  /* near enough to be a slip of the finger, not a different word */
  return best!==null&&bd<=Math.max(1,Math.floor(Math.max(w.length,String(best).length)/3))?best:null;
}

/* ---- what this robot, here, may be told ----
   A board allows what its author allowed; the world allows what has been
   unlocked. Either way, anything the program already says it may go on
   saying — or a program could not be typed back the way it is. */
function pyCtx(){
  const r=R(), board=pyOnBoard();
  const types=new Set(), conds=new Set(), go=new Set(), face=new Set(TARGETS);
  if(board){
    for(const t of (mgState.proj.allowed||CHALLENGE_BLOCKS))types.add(t);
    for(const c of mgCondList())conds.add(c);
    for(const g of mgGoList(mgState.proj))go.add(g);
  }else{
    ["move","turnL","turnR"].forEach(t=>types.add(t));
    for(const c of CATS)if(!c.lock||unlocks[c.lock])c.types.forEach(t=>types.add(t));
    CONDS.forEach(c=>conds.add(c));
    TARGETS.forEach(g=>go.add(g));
  }
  const X={board,types,conds,go,face,cmp:board||!!unlocks.vars,byVar:!board&&!!unlocks.vars,
    repVar:board||!!unlocks.vars};
  const seen=l=>{for(const b of l||[]){
    types.add(b.t);
    if(b.cond){ if(typeof b.cond==="string")conds.add(condBase(b.cond)); else X.cmp=true; }
    if(b.t==="goNear"||b.t==="faceNearest"){ if(b.src)X.byVar=true; else (b.t==="goNear"?go:face).add(b.opt||"tree"); }
    if(b.t==="repeat"&&b.src)X.repVar=true;
    seen(b.body);seen(b.els);
  }};
  seen(r.program);
  for(const id of ROUTINE_IDS)seen(routineOf(r,id).body);
  return X;
}
/* how a block type is written, for a sentence about it */
function pyNameOf(t){
  if(PY_ACT[t])return "robot."+PY_ACT[t]+"()";
  for(const m in PY_ARG)if(PY_ARG[m]===t)return "robot."+m+"()";     // the first name is the current one
  return {repeat:"for",countLoop:"for",forever:"while True",whileLoop:"while","if":"if",setVar:"=",
    changeVar:"+",read:"robot.read()",call:"routine_a()",ret:"return",broadcast:"team.tell()"}[t]||t;
}
/* the first step this robot can actually take, as an example to copy */
function pyExample(X){
  if(X.types.has("move"))return "robot.move()";
  if(X.types.has("goNear"))return 'robot.walk_to("'+([...X.go][0]||"tree")+'")';
  for(const t of X.types)if(PY_ACT[t])return "robot."+PY_ACT[t]+"()";
  return "robot.move()";
}
function pyAskExample(X){
  for(const c of X.conds)return pyCond(c);
  return "robot.is_blocked()";
}

/* ---- text → lines of tokens ---- */
const PY_QD="\"“”„״", PY_QS="'‘’׳";
const PY_OP2=["==","!=",">=","<=","+=","-=","*=","/=","**","//","->"];
const PY_OP1="()[]{},:.=+-*/<>%;";
function pyLex(text){
  const lines=[];
  String(text).replace(/\r\n?/g,"\n").split("\n").forEach((s,idx)=>{
    const n=idx+1, toks=[];
    let i=0, ind=0;
    for(;i<s.length;i++){
      const ch=s[i];
      if(ch===" "||ch===" ")ind++; else if(ch==="\t")ind+=4; else break;
    }
    const fail=(key,args,c,l)=>{throw pyErr(key,args,n,c,l);};
    while(i<s.length){
      const ch=s[i];
      if(ch===" "||ch==="\t"||ch===" "||ch==="‎"||ch==="‏"){i++;continue;}
      if(ch==="#")break;
      if(PY_QD.indexOf(ch)>=0||PY_QS.indexOf(ch)>=0){
        /* a phone's keyboard curls quotes by itself; either kind closes the
           other of its own family, so “tree” and "tree" are the same text */
        const set=PY_QD.indexOf(ch)>=0?PY_QD:PY_QS;
        let j=i+1, v="";
        for(;;){
          if(j>=s.length)fail("strOpen",[],i,s.length-i);
          const c=s[j];
          if(c==="\\"&&j+1<s.length){
            const d=s[j+1];
            if(d==="u"&&/^[0-9a-fA-F]{4}$/.test(s.substr(j+2,4))){v+=String.fromCharCode(parseInt(s.substr(j+2,4),16));j+=6;continue;}
            v+=d==="n"?"\n":d==="t"?"\t":d; j+=2; continue;
          }
          if(set.indexOf(c)>=0)break;
          v+=c; j++;
        }
        toks.push({k:"str",v,c:i,l:j+1-i}); i=j+1; continue;
      }
      if(ch>="0"&&ch<="9"){
        let j=i; while(j<s.length&&s[j]>="0"&&s[j]<="9")j++;
        if(s[j]==="."&&s[j+1]>="0"&&s[j+1]<="9"){j++;while(j<s.length&&s[j]>="0"&&s[j]<="9")j++;}
        if(j<s.length&&/[A-Za-z_]/.test(s[j])){
          let e=j; while(e<s.length&&/\w/.test(s[e]))e++;
          fail("badNumber",[s.slice(i,e)],i,e-i);
        }
        toks.push({k:"num",v:Number(s.slice(i,j)),c:i,l:j-i}); i=j; continue;
      }
      if(/[A-Za-z_]/.test(ch)){
        let j=i+1; while(j<s.length&&/[A-Za-z0-9_]/.test(s[j]))j++;
        toks.push({k:"name",v:s.slice(i,j),c:i,l:j-i}); i=j; continue;
      }
      if(/\p{L}/u.test(ch)){
        let j=i+1; while(j<s.length&&/[\p{L}\p{N}_]/u.test(s[j]))j++;
        fail("nameLetters",[],i,j-i);
      }
      const two=s.substr(i,2);
      if(two==="//"&&!toks.length)fail("slashComment",[],i,2);
      if(PY_OP2.indexOf(two)>=0){toks.push({k:"op",v:two,c:i,l:2});i+=2;continue;}
      if(PY_OP1.indexOf(ch)>=0){
        if(ch==="{"||ch==="}")fail("braces",[ch],i,1);
        toks.push({k:"op",v:ch,c:i,l:1}); i++; continue;
      }
      const cp=String.fromCodePoint(s.codePointAt(i));
      fail("badChar",[cp],i,cp.length);
    }
    if(!toks.length)return;      // blank, or only a note
    let depth=0;
    for(const t of toks){
      if(t.k!=="op")continue;
      if(t.v==="(")depth++;
      if(t.v===")"&&--depth<0)fail("parenExtra",[],t.c,1);
    }
    if(depth>0){
      const open=toks.filter(t=>t.k==="op"&&t.v==="(").pop();
      fail("parenOpen",[],open.c,1);
    }
    lines.push({n,indent:ind,toks,raw:s});
  });
  return lines;
}

/* ---- a cursor over one line's tokens ---- */
function pyCur(L,at){
  return {t:L.toks,i:at||0,n:L.n,
    peek(k){return this.t[this.i+(k||0)];},
    isOp(v,k){const t=this.t[this.i+(k||0)];return !!t&&t.k==="op"&&t.v===v;},
    isName(v,k){const t=this.t[this.i+(k||0)];return !!t&&t.k==="name"&&(v===undefined||t.v===v);},
    done(){return this.i>=this.t.length;},
    /* an error at the current token (or at the end of the line) */
    err(key,args,tok){
      const t=tok||this.t[this.i]||null;
      if(t)return pyErr(key,args,this.n,t.c,t.l);
      const z=this.t[this.t.length-1];
      return pyErr(key,args,this.n,z?z.c+z.l:0,1);
    },
    /* the text of the tokens from a to b, as the player wrote them */
    src(a,b){
      const A=this.t[a], Z=this.t[(b===undefined?this.t.length:b)-1];
      return A&&Z?L.raw.slice(A.c,Z.c+Z.l):"";
    }};
}

/* ---- the parser ---- */
function pyParse(text,X){
  X=X||pyCtx();
  const P={X,i:0,lines:null,defs:{},defErr:{},routines:{},ln:new Map()};
  try{
    P.lines=pyLex(text);
    pyScanDefs(P);
    const program=pyBlock(P,0,true);
    for(const id of ROUTINE_IDS)if(!P.routines[id])P.routines[id]={params:[],body:[]};
    return {ok:true,program,routines:P.routines,ln:P.ln};
  }catch(e){
    if(e&&e.py)return {ok:false,err:e.py};
    throw e;
  }
}
/* the headers of the functions, first: a call may come before its def */
function pyScanDefs(P){
  for(const L of P.lines){
    if(L.indent!==0||!(L.toks[0].k==="name"&&L.toks[0].v==="def"))continue;
    /* a broken header is reported when the reading reaches its line, so
       the first mistake in the text is the one that is shown */
    try{pyScanDef(P,L);}catch(e){ if(!e||!e.py)throw e; P.defErr[L.n]=e; }
  }
}
function pyScanDef(P,L){
  const S=pyCur(L,1), nm=S.peek();
  if(!nm||nm.k!=="name")throw S.err("defWhat",[]);
  const id=pyRoutineId(nm.v);
  if(!id)throw S.err("defName",[]);
  if(P.defs[id])throw S.err("defTwice",[nm.v.toLowerCase()]);
  S.i++;
  if(!S.isOp("("))throw S.err("defWhat",[]);
  S.i++;
  const params=[];
  while(!S.isOp(")")){
    const p=S.peek();
    if(!p||p.k!=="name")throw S.err("defWhat",[]);
    pyVarName(S,p);
    if(params.indexOf(p.v)>=0)throw S.err("paramTwice",[p.v]);
    params.push(p.v); S.i++;
    if(S.isOp(","))S.i++; else if(!S.isOp(")"))throw S.err("defWhat",[]);
  }
  if(params.length>4)throw S.err("defParams",[]);
  S.i++;
  P.defs[id]={params,line:L.n,at:S.i};
}
/* routine_a → "A", or null for any other name */
function pyRoutineId(name){
  const m=/^routine_([a-z])$/i.exec(name), id=m?m[1].toUpperCase():null;
  return id&&ROUTINE_IDS.indexOf(id)>=0?id:null;
}
/* a name a variable may carry */
function pyVarName(S,tok){
  if(PY_KEPT.has(tok.v))throw S.err(PY_LATER.has(tok.v)?"notYet":"nameKept",[tok.v],tok);
  if(tok.v.length>10)throw S.err("nameLong",[tok.v],tok);
  return tok.v;
}
/* every line at one depth, until the text steps back out */
function pyBlock(P,indent,top){
  const out=[]; let afterBody=false;
  while(P.i<P.lines.length){
    const L=P.lines[P.i];
    if(L.indent<indent)break;
    if(L.indent>indent)throw pyErr(afterBody?"indentOff":P.i?"indentExtra":"indentFirst",[],L.n,0,L.indent);
    const before=P.i;
    for(const b of pyStmt(P,L,top))out.push(b);
    afterBody=P.i>before+1;       // a statement that swallowed lines had a body
  }
  return out;
}
/* the lines inside the one that ends with a colon */
function pyBody(P,L,kw){
  const nx=P.lines[P.i+1];
  if(!nx)throw pyErr("bodyNone",[kw],L.n,L.toks[0].c,L.toks[0].l);
  if(nx.indent<=L.indent)throw pyErr("bodyIndent",[kw],nx.n,0,Math.max(1,nx.indent));
  P.i++;
  return pyBlock(P,nx.indent,false);
}
function pyColon(S,kw){
  if(!S.isOp(":"))throw S.err("colon",[kw]);
  S.i++;
  if(!S.done())throw S.err("afterColon",[kw]);
}
function pyEnd(S){
  if(S.done())return;
  if(S.isOp(";"))throw S.err("semicolon",[]);
  throw S.err("trailing",[S.src(S.i)]);
}
/* is this block type something this robot may be told, here? */
function pyNeed(P,S,type,shown,tok){
  const X=P.X;
  if(X.types.has(type))return;
  if(X.board)throw S.err("notHere",[shown],tok);
  const cat=CATS.find(c=>c.types.indexOf(type)>=0);
  if(!cat)throw S.err("boardOnly",[shown],tok);
  const e=S.err("locked",[shown],tok);
  e.py.dict=cat.need;
  throw e;
}
function pyMk(P,S,type,fields){
  const b=newBlock(type);
  if(fields)Object.assign(b,fields);
  P.ln.set(b,S.n);
  return b;
}
function pyStmt(P,L,top){
  const S=pyCur(L,0), t0=S.peek(), X=P.X;
  const step=()=>{P.i++;};
  if(t0.k!=="name")throw S.err("unknownStmt",[pyExample(X)]);
  const w=t0.v;
  if(w==="pass"){S.i++;pyEnd(S);step();return [];}
  if(w==="for")return [pyFor_(P,L,S)];
  if(w==="while")return [pyWhile(P,L,S)];
  if(w==="if"){S.i++;return [pyIf(P,L,S,"if")];}
  if(w==="elif"||w==="else")throw S.err("elseAlone",[w]);
  if(w==="def"){
    if(!top||L.indent!==0)throw S.err("defTop",[]);
    if(P.defErr[L.n])throw P.defErr[L.n];
    pyDef(P,L);
    return [];
  }
  if(w==="return"){
    S.i++;
    pyNeed(P,S,"ret","return",t0);
    const vals=[];
    while(!S.done()){
      const v=pyValue(S,false);
      if(!v)throw S.err("retKind",[]);
      vals.push(v);
      if(S.isOp(","))S.i++; else break;
    }
    pyEnd(S);
    if(vals.length>4)throw S.err("retMany",[],t0);
    step();
    return [pyMk(P,S,"ret",{vals:vals.length?vals:[{k:"num",n:0}]})];
  }
  if(w==="print"){
    S.i++;
    if(!S.isOp("("))throw S.err("needParens",['print("hi")'],t0);
    pyNeed(P,S,"say","print()",t0);
    S.i++;
    const v=pyValue(S,true);
    if(!v||!S.isOp(")"))throw S.err("needValue",["print()",'print("hi")'],t0);
    S.i++; pyEnd(S); step();
    return [pyMk(P,S,"say",{val:v})];
  }
  if(w==="robot"||w==="team"||w==="market"){
    const b=pyCallStmt(P,S);
    pyEnd(S); step();
    return [b];
  }
  if(PY_LATER.has(w))throw S.err("notYet",[w]);
  /* a function call on its own line */
  if(S.isOp("(",1)){
    const b=pyRoutineCall(P,S,[]);
    pyEnd(S); step();
    return [b];
  }
  if(S.isOp("=",1)||S.isOp(",",1)||S.isOp("+=",1)||S.isOp("-=",1)||S.isOp("*=",1)||S.isOp("/=",1)){
    const bs=pyAssign(P,S);
    pyEnd(S); step();
    return bs;
  }
  /* `x == 3` on its own, `move` with nothing after it… */
  if(PY_ACT_R[w]||PY_ARG[w])throw S.err("needRobot",["robot."+w+"()"]);
  throw S.err("unknownStmt",[pyExample(X)]);
}
/* robot.<something>(…) as a step */
function pyCallStmt(P,S){
  const X=P.X, obj=S.peek().v, t0=S.peek();
  if(!S.isOp(".",1)||!S.isName(undefined,2))throw S.err("unknownStmt",[pyExample(X)]);
  const mt=S.peek(2), m=mt.v, full=obj+"."+m;
  const hasCall=S.isOp("(",3);
  const args=()=>{S.i+=4;};                      // past  obj . name (
  const close=(shown,ex)=>{ if(!S.isOp(")"))throw S.err(shown===ex?"noArgs":"shape",[shown,ex],mt); S.i++; };
  if(obj==="team"){
    if(m==="tell"){
      if(!hasCall)throw S.err("needParens",['team.tell("tree")'],mt);
      pyNeed(P,S,"broadcast","team.tell()",mt);
      args();
      const ch=pyPlace(S,RADIO_CH,"team.tell()",'team.tell("tree")',mt);
      close("team.tell()",'team.tell("tree")');
      return pyMk(P,S,"broadcast",{opt:ch});
    }
    if(m==="already_called")throw S.err("questionAlone",["team.already_called()"],mt);
    throw S.err("unknownMethod",[full+"()"],mt);
  }
  if(obj==="market")throw S.err("readingAlone",[S.src(S.i)||full],mt);
  /* robot. */
  if(PY_ACT_R[m]){
    const type=PY_ACT_R[m], shown="robot."+m+"()";
    if(!hasCall)throw S.err("needParens",[shown],mt);
    pyNeed(P,S,type,shown,mt);
    args(); close(shown,shown);
    return pyMk(P,S,type);
  }
  if(PY_ARG[m]){
    const type=PY_ARG[m], shown="robot."+m+"()";
    if(!hasCall)throw S.err("needParens",[shown],mt);
    pyNeed(P,S,type,shown,mt);
    args();
    if(type==="rest"||type==="wait"){
      const ex="robot."+m+"(2)";
      let n=type==="rest"?2:1;
      if(!S.isOp(")")){
        const nt=S.peek();
        if(!nt||nt.k!=="num"||nt.v%1)throw S.err("needNumber",[shown,ex],mt);
        if(nt.v<1||nt.v>99)throw S.err("numRange",[1,99],nt);
        n=nt.v; S.i++;
      }
      close(shown,ex);
      return pyMk(P,S,type,{n});
    }
    if(type==="build"){
      /* a brick on a board has no kind; the world's is one of three */
      let opt="sapling";
      if(!S.isOp(")")&&!X.board)opt=pyPlace(S,BUILDS,shown,'robot.build("sapling")',mt);
      close(shown,X.board?shown:'robot.build("sapling")');
      return pyMk(P,S,"build",{opt});
    }
    if(type==="faceNearest"||type==="goNear"){
      const list=[...(type==="goNear"?X.go:X.face)], ex="robot."+m+'("'+(list[0]||"tree")+'")';
      const t=S.peek();
      if(t&&t.k==="name"&&!S.isOp(".",1)){
        /* wherever a variable says — the world's, once variables are unlocked */
        if(!X.byVar)throw S.err("needPlace",[shown,ex],mt);
        pyVarName(S,t); S.i++;
        close(shown,ex);
        return pyMk(P,S,type,{src:t.v});
      }
      const opt=pyPlace(S,list,shown,ex,mt);
      close(shown,ex);
      return pyMk(P,S,type,{opt,src:null});
    }
    if(type==="goTo"){
      const ex='robot.go_to(team.get("tree"))';
      if(!(S.isName("team")&&S.isOp(".",1)&&S.isName("get",2)&&S.isOp("(",3)))throw S.err("needValue",[shown,ex],mt);
      S.i+=4;
      const ch=pyPlace(S,RADIO_CH,"team.get()",ex,mt);
      if(!S.isOp(")"))throw S.err("needValue",[shown,ex],mt);
      S.i++;
      close(shown,ex);
      return pyMk(P,S,"goTo",{opt:ch});
    }
    /* say / try_code: one value */
    const ex=type==="say"?'robot.say("hi")':"robot.try_code(1)";
    const v=pyValue(S,type==="say");
    if(!v)throw S.err("needValue",[shown,ex],mt);
    close(shown,ex);
    return pyMk(P,S,type,{val:v});
  }
  /* a question or a reading, standing where a step should be */
  if(m==="sees"||m==="sensor"||PY_ASK_R[full])throw S.err("questionAlone",[S.src(S.i)||full+"()"],mt);
  if(PY_READ_R[full])throw S.err("readingAlone",[S.src(S.i)||full],mt);
  const known=Object.keys(PY_ACT_R).filter(k=>X.types.has(PY_ACT_R[k]))
    .concat(Object.keys(PY_ARG).filter(k=>X.types.has(PY_ARG[k])));
  const sug=pyNear(m,known)||pyNear(m,Object.keys(PY_ACT_R).concat(Object.keys(PY_ARG)));
  throw S.err(sug?"unknownMethodSug":"unknownMethod",["robot."+m+"()","robot."+sug+"()"],mt);
}
/* "name" from a list, in quotes */
function pyPlace(S,list,shown,ex,tok){
  const t=S.peek();
  if(!t||t.k!=="str")throw S.err("needPlace",[shown,ex],tok);
  if(list.indexOf(t.v)<0)throw S.err("unknownPlace",['"'+t.v+'"',list.map(x=>'"'+x+'"')],t);
  S.i++;
  return t.v;
}
/* a number, a piece of text or a variable; null if the next token is none */
function pyValue(S,text){
  const t=S.peek();
  if(!t)return null;
  if(t.k==="num"){S.i++;return {k:"num",n:t.v};}
  if(t.k==="op"&&t.v==="-"&&S.peek(1)&&S.peek(1).k==="num"){const n=-S.peek(1).v;S.i+=2;return {k:"num",n};}
  if(t.k==="str"){
    if(!text)return null;
    if(t.v.length>30)throw S.err("strLong",[],t);
    S.i++; return {k:"str",s:t.v};
  }
  if(t.k==="name"&&!S.isOp("(",1)&&!S.isOp(".",1)){
    if(t.v==="True"||t.v==="False")return null;
    pyVarName(S,t); S.i++;
    return {k:"var",name:t.v};
  }
  return null;
}
/* routine_a(3, x), with the boxes that catch what it gives back */
function pyRoutineCall(P,S,outs){
  const nm=S.peek(), X=P.X;
  const id=pyRoutineId(nm.v);
  if(!id){
    if(PY_ACT_R[nm.v]||PY_ARG[nm.v])throw S.err("needRobot",["robot."+nm.v+"()"]);
    if(nm.v==="range"||nm.v==="len"||nm.v==="input"||nm.v==="int"||nm.v==="str")throw S.err("notYet",[nm.v+"()"]);
    throw S.err("unknownFunc",[nm.v+"()"]);
  }
  const fname="routine_"+id.toLowerCase();
  pyNeed(P,S,"call",fname+"()",nm);
  const def=P.defs[id];
  if(!def)throw S.err("callUndefined",[fname]);
  S.i+=2;
  const args=[];
  while(!S.isOp(")")){
    const v=pyValue(S,false);
    if(!v)throw S.err("argKind",[fname]);
    args.push(v);
    if(S.isOp(","))S.i++; else if(!S.isOp(")"))throw S.err("argKind",[fname]);
  }
  S.i++;
  if(args.length!==def.params.length)throw S.err("callShape",[fname,fname+"("+def.params.join(", ")+")"],nm);
  if(outs.length>4)throw S.err("outsMany",[],nm);
  return pyMk(P,S,"call",{fn:id,args,outs});
}
/* x = …  /  a, b = routine_a()  /  x += 1 */
function pyAssign(P,S){
  const X=P.X, first=S.peek(), names=[];
  for(;;){
    const t=S.peek();
    if(!t||t.k!=="name")throw S.err("assignWhat",[first.v]);
    names.push(pyVarName(S,t)); S.i++;
    if(S.isOp(","))S.i++; else break;
  }
  const T=names[0], op=S.peek();
  const add=(n)=>pyMk(P,S,"changeVar",{name:T,n});
  if(op&&op.k==="op"&&(op.v==="+="||op.v==="-="||op.v==="*="||op.v==="/=")){
    if(names.length>1)throw S.err("multiAssign",[],first);
    if(op.v==="*="||op.v==="/=")throw S.err("mathNo",[op.v]);
    pyNeed(P,S,"changeVar",T+" "+op.v+" 1",first);
    S.i++;
    const v=pyValue(S,false);
    if(!v)throw S.err("assignWhat",[T]);
    if(op.v==="-="&&v.k==="var")throw S.err("subVar",[T,v.name],first);
    return [add(v.k==="var"?{k:"var",name:v.name}:(op.v==="-="?-v.n:v.n))];
  }
  if(!op||op.k!=="op"||op.v!=="=")throw S.err("assignWhat",[T]);
  S.i++;
  const r0=S.peek();
  if(!r0)throw S.err("assignWhat",[T]);
  /* a reading: x = robot.read() */
  if(r0.k==="name"&&(r0.v==="robot"||r0.v==="market"||r0.v==="team")&&S.isOp(".",1)&&S.isName(undefined,2)){
    const m=S.peek(2), full=r0.v+"."+m.v;
    if(names.length>1)throw S.err("multiAssign",[],first);
    if(full==="market.price"){
      pyNeed(P,S,"read",T+" = market.price()",first);
      if(!S.isOp("(",3))throw S.err("needParens",['market.price("wood")'],m);
      S.i+=4;
      const res=pyPlace(S,MKT_RES,"market.price()",'market.price("wood")',m);
      if(!S.isOp(")"))throw S.err("noArgs",["market.price()",'market.price("wood")'],m);
      S.i++;
      return [pyMk(P,S,"read",{name:T,src:"price",opt:res})];
    }
    if(PY_READ_R[full]){
      const src=PY_READ_R[full], isProp=(src==="x"||src==="y");
      pyNeed(P,S,"read",T+" = "+PY_READ[src],first);
      if(isProp){ if(S.isOp("(",3))throw S.err("noArgs",[full+"()",full],m); S.i+=3; }
      else{
        if(!S.isOp("(",3))throw S.err("needParens",[PY_READ[src]],m);
        if(!S.isOp(")",4))throw S.err("noArgs",[full+"()",PY_READ[src]],m);
        S.i+=5;
      }
      return [pyMk(P,S,"read",{name:T,src,opt:"wood"})];
    }
    if(m.v==="sees"||m.v==="sensor"||PY_ASK_R[full])throw S.err("boxQuestion",[S.src(S.i)],m);
    if(r0.v==="robot"&&(PY_ACT_R[m.v]||PY_ARG[m.v]))throw S.err("assignWhat",[T],m);
    const sug=pyNear(full,Object.keys(PY_READ_R).concat(["market.price"]));
    throw S.err(sug?"unknownMethodSug":"unknownMethod",[full+"()",sug&&PY_READ[PY_READ_R[sug]]||(sug+"()")],m);
  }
  /* a function's answer: a, b = routine_a(1) */
  if(r0.k==="name"&&S.isOp("(",1))return [pyRoutineCall(P,S,names)];
  if(names.length>1)throw S.err("multiAssign",[],first);
  /* a value, or one sum */
  const textOK=true;
  const a=pyValue(S,textOK);
  if(!a)throw S.err("assignWhat",[T],r0);
  const o=S.peek();
  if(!o||o.k!=="op"||[")",";",","].indexOf(o.v)>=0){
    pyNeed(P,S,"setVar",T+" = 5",first);
    return [pyMk(P,S,"setVar",{name:T,val:a})];
  }
  if(o.v!=="+"&&o.v!=="-"){
    const maths=["*","/","%","**","//"].indexOf(o.v)>=0;
    throw S.err(maths?"mathNo":"assignWhat",[maths?o.v:T],o);
  }
  S.i++;
  const b=pyValue(S,true);
  if(!b)throw S.err("assignWhat",[T]);
  if(a.k==="str"||b.k==="str")throw S.err("mathText",[],o);
  if(S.peek()&&S.peek().k==="op"&&["+","-","*","/","%","**","//"].indexOf(S.peek().v)>=0)throw S.err("mathLong",[T]);
  const minus=o.v==="-";
  if(a.k==="num"&&b.k==="num"){
    pyNeed(P,S,"setVar",T+" = 5",first);
    return [pyMk(P,S,"setVar",{name:T,val:{k:"num",n:minus?a.n-b.n:a.n+b.n}})];
  }
  pyNeed(P,S,"changeVar",T+" = "+T+" + 1",first);
  if(minus&&b.k==="var")throw S.err("subVar",[T,b.name],first);
  /* x = x + 1, x = x + y, and the same sum written the other way round */
  if(a.k==="var"&&a.name===T)return [add(b.k==="var"?{k:"var",name:b.name}:(minus?-b.n:b.n))];
  if(!minus&&b.k==="var"&&b.name===T)return [add(a.k==="var"?{k:"var",name:a.name}:a.n)];
  /* x = y + 1 is two blocks: put y in the box, then add */
  pyNeed(P,S,"setVar",T+" = 5",first);
  return [pyMk(P,S,"setVar",{name:T,val:a}),add(b.k==="var"?{k:"var",name:b.name}:(minus?-b.n:b.n))];
}
/* for i in range(3):   /   for n in range(1, 6): */
function pyFor_(P,L,S){
  const X=P.X, kw=S.peek();
  S.i++;
  const v=S.peek();
  if(!v||v.k!=="name"||!S.isName("in",1)||!S.isName("range",2)||!S.isOp("(",3))throw S.err("forRange",[],kw);
  if(v.v!=="_")pyVarName(S,v);
  S.i+=4;
  const a=S.peek();
  const whole=t=>t&&t.k==="num"&&t.v%1===0;
  let blk;
  if(S.isOp(",",1)){
    /* two numbers: it counts, and the blocks inside can use the count */
    const b=S.peek(2);
    if(!whole(a)||a.v!==1)throw S.err("rangeStart",[],a||kw);
    if(!whole(b))throw S.err("rangeNum",[],b||kw);
    if(b.v<1||b.v>100)throw S.err("numRange",[1,100],b);
    S.i+=3;
    if(!S.isOp(")"))throw S.err("rangeStart",[],kw);
    S.i++;
    pyColon(S,"for");
    pyNeed(P,S,"countLoop","for "+v.v+" in range(1, "+b.v+")",kw);
    blk=pyMk(P,S,"countLoop",{name:v.v,to:b.v-1});
    blk.body=pyBody(P,L,"for");
    return blk;
  }
  let fields;
  if(whole(a)){
    if(a.v<1||a.v>99)throw S.err("numRange",[1,99],a);
    fields={n:a.v,src:null};
  }else if(a&&a.k==="name"&&!S.isOp("(",1)&&!S.isOp(".",1)){
    pyVarName(S,a);
    if(!X.repVar){ const e=S.err("locked",["range("+a.v+")"],a); e.py.dict=(CATS.find(c=>c.id==="vars")||{}).need; throw e; }
    fields={src:a.v};
  }else throw S.err("forRange",[],a||kw);
  S.i++;
  if(!S.isOp(")"))throw S.err("forRange",[],kw);
  S.i++;
  pyColon(S,"for");
  pyNeed(P,S,"repeat","for",kw);
  blk=pyMk(P,S,"repeat",fields);
  blk.body=pyBody(P,L,"for");
  /* 🔁 Repeat does not count: a body that reads the loop's own name would
     get a different number here than Python gives it */
  if(v.v!=="_"&&pyUsesVar(blk.body,v.v))
    throw fields.src?pyErr("loopVarBox",[v.v],L.n,v.c,v.l):pyErr("loopVar",[v.v,fields.n,fields.n+1],L.n,v.c,v.l);
  return blk;
}
function pyWhile(P,L,S){
  const kw=S.peek();
  S.i++;
  const c=pyCondOf(P,S,"while");
  pyColon(S,"while");
  if(c===true){
    pyNeed(P,S,"forever","while True",kw);
    const b=pyMk(P,S,"forever");
    b.body=pyBody(P,L,"while");
    return b;
  }
  if(c===false)throw S.err("condAlways",["while False",pyAskExample(P.X)],kw);
  pyNeed(P,S,"whileLoop","while",kw);
  const b=pyMk(P,S,"whileLoop",{cond:c});
  b.body=pyBody(P,L,"while");
  return b;
}
/* if … / elif … / else — an elif is an if inside the else */
function pyIf(P,L,S,kw){
  const kt=S.peek(-1);
  const c=pyCondOf(P,S,kw);
  pyColon(S,kw);
  if(c===true||c===false)throw S.err("condAlways",[kw+" "+(c?"True":"False"),pyAskExample(P.X)],kt);
  pyNeed(P,S,"if",kw,kt);
  const b=pyMk(P,S,"if",{cond:c});
  b.body=pyBody(P,L,kw);
  b.els=[];
  const nx=P.lines[P.i];
  if(nx&&nx.indent===L.indent&&nx.toks[0].k==="name"){
    if(nx.toks[0].v==="else"){
      const S2=pyCur(nx,1);
      pyColon(S2,"else");
      b.els=pyBody(P,nx,"else");
    }else if(nx.toks[0].v==="elif"){
      b.els=[pyIf(P,nx,pyCur(nx,1),"elif")];
    }
  }
  return b;
}
/* the question between `if` / `while` and the colon.
   Answers a sensor's name ("blocked", "!wallAhead"), a comparison
   {var,op,val}, or true / false for the literal words. */
function pyCondOf(P,S,kw){
  const X=P.X, kt=S.peek(-1);
  let end=S.t.length;
  if(end>S.i&&S.t[end-1].k==="op"&&S.t[end-1].v===":")end--;
  let a=S.i, b=end;
  if(a>=b)throw S.err("condNone",[kw,pyAskExample(X)],kt);
  const isOp=(i,v)=>S.t[i]&&S.t[i].k==="op"&&S.t[i].v===v;
  /* ( … ) round the whole question, the way other languages want it */
  const strip=()=>{
    while(isOp(a,"(")&&isOp(b-1,")")){
      let d=0, ok=true;
      for(let i=a;i<b-1;i++){ if(isOp(i,"("))d++; if(isOp(i,")"))d--; if(d===0){ok=false;break;} }
      if(!ok)break;
      a++; b--;
    }
  };
  strip();
  let neg=false;
  if(S.t[a]&&S.t[a].k==="name"&&S.t[a].v==="not"){neg=true;a++;strip();}
  if(a>=b)throw S.err("condNone",[kw,pyAskExample(X)],kt);
  const Q=pyCur({toks:S.t.slice(a,b),n:S.n,raw:""},0);
  const text=S.src(a,b);
  const t=Q.peek();
  const rest=()=>{
    if(Q.done())return;
    const z=Q.peek();
    if(z.k==="name"&&(z.v==="and"||z.v==="or"))throw Q.err("condAndOr",[z.v]);
    throw Q.err("condWhat",[pyAskExample(X)]);
  };
  let out;
  if(t.k==="name"&&(t.v==="True"||t.v==="False")&&Q.t.length===1){
    S.i=end;
    return (t.v==="True")!==neg;
  }
  if(t.k==="name"&&(t.v==="robot"||t.v==="team"||t.v==="market")&&Q.isOp(".",1)&&Q.isName(undefined,2)){
    const m=Q.peek(2), full=t.v+"."+m.v;
    let c=null;
    if(full==="robot.sees"||full==="robot.sensor"){
      if(!Q.isOp("(",3))throw Q.err("needParens",['robot.sees("tree")'],m);
      Q.i+=4;
      const th=Q.peek();
      const things=[...X.conds].filter(k=>PY_SEES[k]).map(k=>'"'+PY_SEES[k]+'"');
      if(!th||th.k!=="str")throw Q.err("needPlace",["robot.sees()","robot.sees("+(things[0]||'"tree"')+")"],m);
      if(full==="robot.sensor")c=th.v;
      else{
        c=PY_SEES_R[th.v];
        if(!c)throw Q.err("unknownThing",['"'+th.v+'"',things.length?things:Object.keys(PY_SEES_R).map(k=>'"'+k+'"')],th);
      }
      Q.i++;
      if(!Q.isOp(")"))throw Q.err("needPlace",["robot.sees()",'robot.sees("'+th.v+'")'],m);
      Q.i++;
    }else if(PY_ASK_R[full]){
      c=PY_ASK_R[full];
      if(!Q.isOp("(",3))throw Q.err("needParens",[full+"()"],m);
      if(!Q.isOp(")",4))throw Q.err("noArgs",[full+"()",full+"()"],m);
      Q.i+=5;
    }else{
      if(t.v==="robot"&&(PY_ACT_R[m.v]||PY_ARG[m.v]))throw Q.err("actionAsQuestion",["robot."+m.v+"()",pyAskExample(X)],m);
      if(PY_READ_R[full]||full==="market.price")throw Q.err("condWhat",[pyAskExample(X)],m);
      const asks=Object.keys(PY_ASK_R).concat(["robot.sees"]);
      const sug=pyNear(full,asks.filter(q=>q==="robot.sees"||X.conds.has(PY_ASK_R[q])))||pyNear(full,asks);
      throw Q.err(sug?"unknownQuestionSug":"unknownQuestion",[full+"()",sug==="robot.sees"?'robot.sees("tree")':sug+"()"],m);
    }
    /* == True / == False say the same thing the long way */
    if((Q.isOp("==")||Q.isOp("!="))&&Q.isName(undefined,1)&&(Q.peek(1).v==="True"||Q.peek(1).v==="False")){
      if((Q.peek().v==="==")!==(Q.peek(1).v==="True"))neg=!neg;
      Q.i+=2;
    }
    rest();
    if(!X.conds.has(c)){
      const can=[...X.conds].map(k=>pyCond(k));
      throw pyErr("condNotHere",[pyCond(c),can],S.n,m.c,m.l);
    }
    out=(neg?"!":"")+c;
  }else{
    /* a comparison: a box against a number or another box */
    const lhs=pyValue(Q,true), opT=Q.peek();
    if(!lhs)throw Q.err("condWhat",[pyAskExample(X)]);
    if(!opT)throw Q.err("condWhat",[pyAskExample(X)],t);
    if(opT.k==="name"&&(opT.v==="and"||opT.v==="or"))throw Q.err("condAndOr",[opT.v]);
    if(opT.k!=="op")throw Q.err(opT.k==="name"&&PY_LATER.has(opT.v)?"notYet":"condWhat",[opT.k==="name"?opT.v:pyAskExample(X)]);
    Q.i++;
    const rhs=pyValue(Q,true);
    if(!rhs)throw Q.err("condWhat",[pyAskExample(X)]);
    const show=v=>v.k==="var"?v.name:v.k==="str"?JSON.stringify(v.s):String(v.n);
    if(opT.v==="=")throw Q.err("condAssign",[show(lhs)+" == "+show(rhs)],opT);
    if(opT.v===">="||opT.v==="<="){
      /* for whole numbers, x >= 3 and x > 2 are the same question */
      if(lhs.k==="var"&&rhs.k==="num"&&rhs.n%1!==0)throw Q.err("condOp",[opT.v],opT);
      if(lhs.k==="var"&&rhs.k==="num")
        throw Q.err("condOpHint",[opT.v,lhs.name+" "+opT.v[0]+" "+(rhs.n+(opT.v===">="?-1:1))],opT);
      throw Q.err("condOp",[opT.v],opT);
    }
    const OPS_R={">":">","<":"<","==":"=","!=":"!="};
    if(!OPS_R[opT.v])throw Q.err("condOp",[opT.v],opT);
    if(lhs.k==="str"||rhs.k==="str")throw Q.err("condText",[],opT);
    rest();
    if(neg)throw pyErr("condNotNum",[],S.n,S.t[S.i].c,S.t[S.i].l);
    let L2=lhs, R2=rhs, o=OPS_R[opT.v];
    if(L2.k!=="var"){
      /* 3 < x is x > 3 */
      if(R2.k!=="var")throw Q.err("condWhat",[pyAskExample(X)],t);
      L2=rhs; R2=lhs; o=o===">"?"<":o==="<"?">":o;
    }
    if(!X.cmp){
      const e=pyErr("locked",[text],S.n,S.t[a].c,S.t[b-1].c+S.t[b-1].l-S.t[a].c);
      e.py.dict=(CATS.find(c2=>c2.id==="vars")||{}).need;
      throw e;
    }
    out={var:L2.name,op:o,val:R2.k==="var"?{k:"var",name:R2.name}:R2.n};
  }
  S.i=end;
  return out;
}
function pyDef(P,L){
  const id=Object.keys(P.defs).find(k=>P.defs[k].line===L.n);
  const d=P.defs[id], S=pyCur(L,d.at);
  pyColon(S,"def");
  const body=pyBody(P,L,"def");
  P.routines[id]={params:d.params.slice(),body};
}

/* ---- one shape for "the same program" ----
   Two block trees mean the same thing when these come out equal: no uids,
   and every field written the one way it runs — a count below 1 is 1, a
   comparison with no operator is "=", a call has one argument per input.
   The editor uses it to tell whether the text and the blocks still match,
   and the tests to prove blocks → Python → blocks loses nothing. */
function pyCanonVal(v){
  if(!v||typeof v!=="object")return Number(v)||0;
  if(v.k==="var")return {v:String(v.name)};
  if(v.k==="str")return {s:String(v.s)};
  return Number(v.n)||0;
}
function pyCanonCond(c){
  if(c&&typeof c==="object"){
    const w=c.val;
    return {a:String(c.var),op:OP_PY[c.op]?c.op:"=",b:(w&&typeof w==="object"&&w.k==="var")?{v:String(w.name)}:pyNum(w)};
  }
  return String(c);
}
function pyCanonList(list,r,board){
  return (list||[]).map(b=>{
    const o=[b.t], body=()=>pyCanonList(b.body,r,board);
    switch(b.t){
      case "rest":case "wait":o.push(Math.max(1,b.n|0));break;
      case "build":o.push(board?null:pyBuildKind(b.opt));break;
      case "faceNearest":case "goNear":o.push(b.src?{v:String(b.src)}:String(b.opt||"tree"));break;
      case "broadcast":case "goTo":o.push(String(b.opt||"tree"));break;
      case "repeat":o.push(b.src?{v:String(b.src)}:Math.max(1,b.n|0),body());break;
      case "countLoop":o.push(String(b.name),Math.max(0,b.to|0),body());break;
      case "forever":o.push(body());break;
      case "whileLoop":o.push(pyCanonCond(b.cond),body());break;
      case "if":o.push(pyCanonCond(b.cond),body(),pyCanonList(b.els,r,board));break;
      case "setVar":o.push(String(b.name),pyCanonVal(b.val));break;
      case "changeVar":o.push(String(b.name),(b.n&&typeof b.n==="object")?(b.n.k==="var"?{v:String(b.n.name)}:pyNum(b.n)):(b.n|0));break;
      case "say":case "tryCode":o.push(pyCanonVal(b.val));break;
      case "read":o.push(String(b.name),b.src==="price"||PY_READ[b.src]?String(b.src):"here",b.src==="price"?String(b.opt||"wood"):null);break;
      case "call":{
        const f=routineOf(r,b.fn||"A"), args=[];
        for(let i=0;i<f.params.length;i++)args.push(pyCanonVal((b.args||[])[i]));
        o.push(String(b.fn||"A"),args,callOuts(b).map(String));break;}
      case "ret":{const vs=retVals(b);o.push(vs.length?vs.map(pyCanonVal):[0]);break;}
    }
    return o;
  });
}
/* the whole robot: main, then each function as [inputs, steps] */
function pyCanon(r){
  const board=pyOnBoard(), o={main:pyCanonList(r.program,r,board)};
  for(const id of ROUTINE_IDS){const f=routineOf(r,id);o[id]=[f.params.map(String),pyCanonList(f.body,r,board)];}
  return JSON.stringify(o);
}
/* the same, for what the parser just read — before it is anyone's program */
function pyCanonOf(res){
  const r={program:res.program,routines:res.routines};
  return pyCanon(r);
}
/* which line each live block was written on: walk the parsed tree and the
   robot's own side by side — they are the same shape when the text and the
   blocks match, which is the only time anything asks */
function pyLineMap(res,r){
  const map=new Map();
  const zip=(A,B)=>{
    for(let i=0;i<A.length&&i<B.length;i++){
      const ln=res.ln.get(A[i]);
      if(ln)map.set(B[i].uid,ln);
      if(A[i].body&&B[i].body)zip(A[i].body,B[i].body);
      if(A[i].els&&B[i].els)zip(A[i].els,B[i].els);
    }
  };
  zip(res.program,r.program);
  for(const id of ROUTINE_IDS)zip(res.routines[id].body,routineOf(r,id).body);
  return map;
}

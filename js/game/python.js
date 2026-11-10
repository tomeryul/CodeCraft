"use strict";
/* ---------------- python view ----------------
   Blocks → Python is this file; Python → blocks is pyparse.js. The names
   live here once and both read them — toPy() forwards, the parser
   backwards — so a method cannot be printed under one name and typed
   under another. */
/* robot.<name>() for the blocks that take nothing in their brackets */
const PY_ACT={move:"move",turnL:"turn_left",turnR:"turn_right",collect:"collect",chop:"chop",mine:"mine",
  scoop:"scoop_water",drop:"drop",pickUp:"lift",climb:"climb",descend:"step_down",jump:"jump",dig:"take_brick",
  goHome:"go_home",sellAll:"sell_all",bankAll:"bank_all",claim:"call_it",give:"give_bag_to_robot_ahead"};
/* a sensor that looks at the tile in front is robot.sees("thing")… */
const PY_SEES={treeAhead:"tree",rockAhead:"rock",ironAhead:"iron",waterAhead:"water",wallAhead:"wall",
  pitAhead:"pit",doorAhead:"door",keyAhead:"key",gateAhead:"gate",gapAhead:"gap",sealAhead:"seal"};
/* …and every other one is a question of its own. The Tower's and the Cyber
   Lab's sensors had no entry at all, so `if can climb` printed `if True:`. */
const PY_ASK={blocked:"robot.is_blocked",bagFull:"robot.bag_full",bagEmpty:"robot.bag_empty",tired:"robot.is_tired",
  taken:"team.already_called",onPlate:"robot.on_plate",brickHere:"robot.on_block",onTarget:"robot.on_target",
  holding:"robot.is_holding",canClimb:"robot.can_climb",stepDown:"robot.can_step_down",canJump:"robot.can_jump",
  needBrick:"robot.needs_brick",planDone:"robot.plan_done",jammed:"robot.keypad_jammed"};
/* what 📖 Read can look at (💰 price takes a resource and is written out below) */
const PY_READ={here:"robot.read()",ahead:"robot.read_ahead()",held:"robot.holding()",x:"robot.x",y:"robot.y",
  order:"market.order_wants()",orderLeft:"market.order_left()"};
const pyOnBoard=()=>typeof mgState!=="undefined"&&!!mgState;
/* the number a value comes to when it is not a variable */
function pyNum(v){
  if(v&&typeof v==="object")return Number(v.k==="str"?v.s:v.n)||0;
  return Number(v)||0;
}
/* In the world a 🔨 Build with no kind is a chest — that is what doAction
   does with anything that is not a sapling or a bridge. */
function pyBuildKind(opt){return opt==="sapling"||opt==="bridge"?opt:"chest";}
/* does any block in here use a variable called `name`? */
function pyUsesVar(list,name){
  const val=v=>!!(v&&typeof v==="object"&&v.k==="var"&&v.name===name);
  for(const b of list||[]){
    if((b.t==="setVar"||b.t==="changeVar"||b.t==="read"||b.t==="countLoop")&&b.name===name)return true;
    if(val(b.val)||val(b.n)||b.src===name)return true;
    if(b.cond&&typeof b.cond==="object"&&(b.cond.var===name||val(b.cond.val)))return true;
    if(b.t==="call"&&((b.args||[]).some(val)||callOuts(b).indexOf(name)>=0))return true;
    if(b.t==="ret"&&retVals(b).some(val))return true;
    if(pyUsesVar(b.body,name)||pyUsesVar(b.els,name))return true;
  }
  return false;
}
function toPy(list,ind){
  const P=[];
  for(const b of list){
    if(PY_ACT[b.t]){P.push(ind+"robot."+PY_ACT[b.t]+"()");continue;}
    switch(b.t){
      case "rest":P.push(ind+"robot.rest("+Math.max(1,b.n|0)+")");break;
      case "wait":P.push(ind+"robot.wait("+Math.max(1,b.n|0)+")");break;
      /* A brick on a board has no kind — it just goes down. The world's
         does: a sapling, a bridge or a chest. */
      case "build":P.push(ind+(pyOnBoard()?"robot.build()":'robot.build("'+pyBuildKind(b.opt)+'")'));break;
      case "tryCode":P.push(ind+"robot.try_code("+pyVal(b.val)+")");break;
      case "faceNearest":P.push(ind+"robot.face_nearest("+(b.src?b.src:'"'+(b.opt||"tree")+'"')+")");break;
      /* walk_to, the block's own name. It was walk_to_nearest, and a line
         of it inside a loop — the commonest line in the world — ran off the
         right edge of a phone. */
      case "goNear":P.push(ind+"robot.walk_to("+(b.src?b.src:'"'+(b.opt||"tree")+'"')+")");break;
      case "broadcast":P.push(ind+'team.tell("'+(b.opt||"tree")+'")');break;
      case "goTo":P.push(ind+'robot.go_to(team.get("'+(b.opt||"tree")+'"))');break;
      case "repeat":
        /* `for i` would overwrite a variable called i that the loop's own
           blocks use, which 🔁 Repeat never does — so that loop counts on _ */
        P.push(ind+"for "+(pyUsesVar(b.body,"i")?"_":"i")+" in range("+(b.src?b.src:Math.max(1,b.n|0))+"):");
        P.push(b.body.length?toPy(b.body,ind+"    "):ind+"    pass");break;
      case "countLoop":
        P.push(ind+"for "+b.name+" in range(1, "+(Math.max(0,b.to|0)+1)+"):");
        P.push(b.body.length?toPy(b.body,ind+"    "):ind+"    pass");break;
      case "setVar":P.push(ind+b.name+" = "+pyVal(b.val));break;
      case "changeVar":
        if(b.n&&typeof b.n==="object"&&b.n.k==="var")P.push(ind+b.name+" = "+b.name+" + "+b.n.name);
        else{const n=(b.n&&typeof b.n==="object")?pyNum(b.n):(b.n|0);
          P.push(ind+b.name+" = "+b.name+(n<0?" - "+(-n):" + "+n));}
        break;
      case "say":P.push(ind+"robot.say("+pyVal(b.val)+")");break;
      case "read":P.push(ind+b.name+" = "+pyRead(b.src,b.opt));break;
      case "call":{
        /* one argument per input the function declares: a missing one is 0,
           exactly as it runs, and real Python would refuse the call without it */
        const f=pyRoutine(b.fn||"A"), args=[];
        for(let i=0;i<f.params.length;i++)args.push(pyVal((b.args||[])[i]));
        const c="routine_"+String(b.fn||"A").toLowerCase()+"("+args.join(", ")+")";
        const outs=callOuts(b);
        P.push(ind+(outs.length?outs.join(", ")+" = "+c:c));break;}
      case "ret":{
        const vs=retVals(b);
        P.push(ind+"return "+(vs.length?vs.map(pyVal).join(", "):"0"));break;}
      case "forever":
        P.push(ind+"while True:");
        P.push(b.body.length?toPy(b.body,ind+"    "):ind+"    pass");break;
      case "whileLoop":
        P.push(ind+"while "+pyCond(b.cond)+":");
        P.push(b.body.length?toPy(b.body,ind+"    "):ind+"    pass");break;
      case "if":
        P.push(ind+"if "+pyCond(b.cond)+":");
        P.push(b.body.length?toPy(b.body,ind+"    "):ind+"    pass");
        if(b.els&&b.els.length){P.push(ind+"else:");P.push(toPy(b.els,ind+"    "));}
        break;
    }
  }
  return P.join("\n");
}
/* the function a 🔧 Call names, on whichever robot the listing is for */
let pyFor=null;
function pyRoutine(id){
  const r=pyFor||(typeof R==="function"?R():null);
  return r?routineOf(r,id):{params:[],body:[]};
}
function pyVal(v){
  if(!v)return "0";
  if(v.k==="num")return String(Number(v.n)||0);
  if(v.k==="str")return JSON.stringify(String(v.s));
  return v.name;
}
function pyRead(src,opt){
  if(src==="price")return 'market.price("'+(opt||"wood")+'")';
  return PY_READ[src]||PY_READ.here;
}
function pyCond(c){
  // the right side is a value: a number, or another variable
  if(c&&typeof c==="object"){
    const w=c.val;
    return c.var+" "+(OP_PY[c.op]||"==")+" "+((w&&typeof w==="object"&&w.k==="var")?w.name:pyNum(w));
  }
  if(condNeg(c))return "not "+pyCond(condBase(c));
  if(PY_SEES[c])return 'robot.sees("'+PY_SEES[c]+'")';
  if(PY_ASK[c])return PY_ASK[c]+"()";
  /* a sensor from a build this one has never heard of still has a name,
     and a listing that printed `True` for it could not be typed back */
  return 'robot.sensor("'+String(c)+'")';
}
/* The whole listing for one robot: its functions as real definitions, then
   the main program. A function is written out if it has steps, takes
   something, or is called — calling one that was never defined is an error
   in Python, so an empty one that is called gets a body of `pass`. */
function pyDoc(r){
  const was=pyFor; pyFor=r;
  let defs="";
  if(typeof ROUTINE_IDS!=="undefined"){
    const called=new Set();
    const scan=l=>{for(const b of l||[]){if(b.t==="call")called.add(b.fn||"A");scan(b.body);scan(b.els);}};
    scan(r.program);
    for(const id of ROUTINE_IDS)scan(routineOf(r,id).body);
    for(const id of ROUTINE_IDS){
      const f=routineOf(r,id);
      if(!f.body.length&&!f.params.length&&!called.has(id))continue;
      defs+="def routine_"+id.toLowerCase()+"("+f.params.join(", ")+"):\n"+
        (f.body.length?toPy(f.body,"    "):"    pass")+"\n\n";
    }
  }
  /* An empty program is its title and an empty line to start on. What to
     do there is said by the editor, over the listing and in the player's
     language (#pyHint) — it used to be four lines of English comments in
     the listing itself, which a chip then wrote its line underneath. */
  const src="# "+String(r.name).replace(/\s+/g," ")+" — program\n"+defs+
    (r.program.length?toPy(r.program,""):"");
  pyFor=was;
  return src;
}
function renderPy(){
  /* the editor in pyedit.js keeps what the player typed; without it (a
     page that did not load it) the listing is simply printed */
  if(typeof pyShow==="function"){pyShow();return;}
  const src=pyDoc(R());
  if(window.CC_EXTRAS)$("pyCode").innerHTML=CC_EXTRAS.hl(src);else $("pyCode").textContent=src;
}

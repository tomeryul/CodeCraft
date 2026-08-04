"use strict";
/* ---------------- python view ---------------- */
function toPy(list,ind){
  const P=[];
  for(const b of list){
    switch(b.t){
      case "move":P.push(ind+"robot.move()");break;
      case "turnL":P.push(ind+"robot.turn_left()");break;
      case "turnR":P.push(ind+"robot.turn_right()");break;
      case "collect":P.push(ind+"robot.collect()");break;
      case "chop":P.push(ind+"robot.chop()");break;
      case "mine":P.push(ind+"robot.mine()");break;
      case "scoop":P.push(ind+"robot.scoop_water()");break;
      case "drop":P.push(ind+"robot.drop()");break;
      case "pickUp":P.push(ind+"robot.lift()");break;
      case "rest":P.push(ind+"robot.rest("+b.n+")");break;
      case "wait":P.push(ind+"robot.wait("+b.n+")");break;
      case "build":P.push(ind+'robot.build("'+b.opt+'")');break;
      case "faceNearest":P.push(ind+'robot.face_nearest("'+b.opt+'")');break;
      case "goNear":P.push(ind+'robot.walk_to_nearest("'+b.opt+'")');break;
      case "goHome":P.push(ind+"robot.go_home()");break;
      case "sellAll":P.push(ind+"robot.sell_all()");break;
      case "bankAll":P.push(ind+"robot.bank_all()");break;
      case "claim":P.push(ind+"robot.call_it()");break;
      case "broadcast":P.push(ind+'team.tell("'+b.opt+'")');break;
      case "goTo":P.push(ind+'robot.go_to(team.get("'+b.opt+'"))');break;
      case "give":P.push(ind+"robot.give_bag_to_robot_ahead()");break;
      case "repeat":
        P.push(ind+"for i in range("+(b.src?b.src:b.n)+"):");
        P.push(b.body.length?toPy(b.body,ind+"    "):ind+"    pass");break;
      case "countLoop":
        P.push(ind+"for "+b.name+" in range(1, "+((b.to|0)+1)+"):");
        P.push(b.body.length?toPy(b.body,ind+"    "):ind+"    pass");break;
      case "setVar":P.push(ind+b.name+" = "+pyVal(b.val));break;
      case "changeVar":
        if(b.n&&typeof b.n==="object")P.push(ind+b.name+" = "+b.name+" + "+pyVal(b.n));
        else P.push(ind+b.name+" = "+b.name+(b.n<0?" - "+(-b.n):" + "+b.n));
        break;
      case "say":P.push(ind+"robot.say("+pyVal(b.val)+")");break;
      case "read":P.push(ind+b.name+" = "+pyRead(b.src,b.opt));break;
      case "call":{
        const args=(b.args||[]).map(pyVal).join(", ");
        const c="routine_"+String(b.fn).toLowerCase()+"("+args+")";
        const outs=(typeof callOuts==="function")?callOuts(b):(b.out?[b.out]:[]);
        P.push(ind+(outs.length?outs.join(", ")+" = "+c:c));break;}
      case "ret":{
        const vs=(typeof retVals==="function")?retVals(b):(b.val!==undefined?[b.val]:[]);
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
function pyVal(v){
  if(!v)return "0";
  if(v.k==="num")return String(v.n);
  if(v.k==="str")return JSON.stringify(v.s);
  return v.name;
}
function pyRead(src,opt){
  if(src==="price")return 'market.price("'+(opt||"wood")+'")';
  return src==="held"?"robot.holding()":src==="x"?"robot.x":src==="y"?"robot.y":
    src==="ahead"?"robot.read_ahead()":"robot.read()";
}
function pyCond(c){
  // the right side is a value: a number, or another variable
  if(c&&typeof c==="object")return c.var+" "+(c.op==="="?"==":c.op)+" "+
    ((c.val&&typeof c.val==="object")?pyVal(c.val):c.val);
  switch(c){
    case "treeAhead":return 'robot.sees("tree")';
    case "rockAhead":return 'robot.sees("rock")';
    case "ironAhead":return 'robot.sees("iron")';
    case "waterAhead":return 'robot.sees("water")';
    case "blocked":return "robot.is_blocked()";
    case "bagFull":return "robot.bag_full()";
    case "bagEmpty":return "robot.bag_empty()";
    case "tired":return "robot.is_tired()";
    case "taken":return "team.already_called()";
    case "wallAhead":return 'robot.sees("wall")';
    case "pitAhead":return 'robot.sees("pit")';
    case "doorAhead":return 'robot.sees("door")';
    case "keyAhead":return 'robot.sees("key")';
    case "gateAhead":return 'robot.sees("gate")';
    case "onPlate":return "robot.on_plate()";
    case "brickHere":return "robot.on_block()";
    case "onTarget":return "robot.on_target()";
    case "holding":return "robot.is_holding()";
  } return "True";
}
function renderPy(){
  const r=R();
  // routines come out as real function definitions, above the main program
  let defs="";
  if(typeof ROUTINE_IDS!=="undefined"&&r.routines){
    for(const id of ROUTINE_IDS){
      const f=(typeof routineOf==="function")?routineOf(r,id):{params:[],body:r.routines[id]||[]};
      if(!f.body.length)continue;
      defs+="def routine_"+id.toLowerCase()+"("+(f.params||[]).join(", ")+"):\n"+toPy(f.body,"    ")+"\n\n";
    }
  }
  const src = "# "+r.name+" — program\n" + defs +
    (r.program.length?toPy(r.program,""):"# (no blocks yet — build something in the Blocks tab!)");
  if(window.CC_EXTRAS)$("pyCode").innerHTML=CC_EXTRAS.hl(src);else $("pyCode").textContent=src;
}

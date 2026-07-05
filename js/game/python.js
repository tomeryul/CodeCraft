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
      case "rest":P.push(ind+"robot.rest("+b.n+")");break;
      case "wait":P.push(ind+"robot.wait("+b.n+")");break;
      case "build":P.push(ind+'robot.build("'+b.opt+'")');break;
      case "faceNearest":P.push(ind+'robot.face_nearest("'+b.opt+'")');break;
      case "goHome":P.push(ind+"robot.go_home()");break;
      case "sellAll":P.push(ind+"robot.sell_all()");break;
      case "bankAll":P.push(ind+"robot.bank_all()");break;
      case "repeat":
        P.push(ind+"for i in range("+(b.src?b.src:b.n)+"):");
        P.push(b.body.length?toPy(b.body,ind+"    "):ind+"    pass");break;
      case "countLoop":
        P.push(ind+"for "+b.name+" in range(1, "+((b.to|0)+1)+"):");
        P.push(b.body.length?toPy(b.body,ind+"    "):ind+"    pass");break;
      case "setVar":P.push(ind+b.name+" = "+pyVal(b.val));break;
      case "changeVar":P.push(ind+b.name+" = "+b.name+(b.n<0?" - "+(-b.n):" + "+b.n));break;
      case "say":P.push(ind+"robot.say("+pyVal(b.val)+")");break;
      case "forever":
        P.push(ind+"while True:");
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
function pyCond(c){
  if(c&&typeof c==="object")return c.var+" "+(c.op==="="?"==":c.op)+" "+c.val;
  switch(c){
    case "treeAhead":return 'robot.sees("tree")';
    case "rockAhead":return 'robot.sees("rock")';
    case "ironAhead":return 'robot.sees("iron")';
    case "waterAhead":return 'robot.sees("water")';
    case "blocked":return "robot.is_blocked()";
    case "bagFull":return "robot.bag_full()";
    case "bagEmpty":return "robot.bag_empty()";
    case "tired":return "robot.is_tired()";
  } return "True";
}
function renderPy(){
  const r=R();
  const src = "# "+r.name+" — program\n" + (r.program.length?toPy(r.program,""):"# (no blocks yet — build something in the Blocks tab!)");
  if(window.CC_EXTRAS)$("pyCode").innerHTML=CC_EXTRAS.hl(src);else $("pyCode").textContent=src;
}

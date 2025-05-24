// server.js – Coup WS com salas, pronto + LEAVE limpo
import { WebSocketServer } from 'ws';
import { v4 as uuid }      from 'uuid';

const PORT = 8080;
const MAX_PLAYERS = 6;
const wss  = new WebSocketServer({ port: PORT });

/* ───── salas ───── */
const rooms = {};   // roomId -> {status, players, deck}

/* util baralho */
const makeDeck = () => ['duke','assassin','captain','ambassador','contessa'].flatMap(c=>Array(3).fill(c));
const shuffle  = a => { for(let i=a.length-1;i;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const draw     = (room,n)=> room.deck.splice(0,n);

wss.on('connection', ws => {

  ws.on('message', raw => {
    const msg = safeJSON(raw); if(!msg) return;

    /* entrada / reconexão */
    if (msg.type==='join') return handleJoin(ws,msg);

    /* protegido – só depois de join */
    if (!ws._roomId || !ws._pid) return;
    const room = rooms[ws._roomId];
    const pid  = ws._pid;

    switch(msg.type){
      case 'leave':            handleLeave(ws._roomId, pid);             break; //  NEW 
      case 'ready':            setReady(room,pid,msg.ready);             break;
      case 'coinDelta':        handleCoins (room,pid,msg.delta);         break;
      case 'loseCard':         handleLose  (room,pid,msg.card);          break;
      case 'revealCard':       handleReveal(room,pid,msg.card);          break;
      case 'ambassadorDraw':   handleAmbDraw   (room,pid);               break;
      case 'ambassadorReturn': handleAmbReturn(room,pid,msg.return);     break;
    }
  });

  /* desconexão física mantém estado para reconectar */
  ws.on('close', () => {
    if(!ws._roomId || !ws._pid) return;
    const room=rooms[ws._roomId]; if(!room||!room.players[ws._pid]) return;
    room.players[ws._pid].socket = null;
    hist(room, `${room.players[ws._pid].name} desconectou`);
  });
});

/* ───── JOIN ───── */
function handleJoin(ws,msg){
  let roomId = msg.roomId;
  let room   = roomId ? rooms[roomId] : null;

  /* reconexão */
  if(room && msg.pid && room.players[msg.pid]){
    const pl = room.players[msg.pid];
    pl.socket = ws; ws._pid = msg.pid; ws._roomId = roomId;
    send(ws,{type:'welcome', roomId, pid:msg.pid, players:publicPlayers(room), hand:pl.hand});
    return;
  }

  /* sala nova ou vaga existente */
  if(!room){
    room = Object.values(rooms).find(r=>r.status==='waiting' && Object.keys(r.players).length<MAX_PLAYERS);
    if(!room){ roomId = uuid(); room = rooms[roomId] = {status:'waiting',players:{},deck:[],history:[]}; }
    else roomId = Object.entries(rooms).find(([,r])=>r===room)[0];
  }

  const pid = uuid();
  ws._pid   = pid;
  ws._roomId= roomId;
  room.players[pid] = { name:(msg.name||'').trim()||`P${Object.keys(room.players).length+1}`,
                        coins:2, hand:[], alive:true, ready:false, socket:ws };

  send(ws,{type:'welcome', roomId, pid, players:publicPlayers(room)});
  broadcastRoom(roomId,{type:'players',players:publicPlayers(room)},pid);
}

/* ───── LEAVE (novo) ───── */        //  NEW 
function handleLeave(roomId,pid){
  const room = rooms[roomId]; if(!room||!room.players[pid]) return;
  const name = room.players[pid].name;
  delete room.players[pid];

  /* notifica os que ficaram */
  broadcastRoom(roomId,{type:'players',players:publicPlayers(room)});
  hist(room, `${name} saiu da sala`);

  /* remove sala vazia */
  if(Object.keys(room.players).length===0) delete rooms[roomId];
}

/* ───── READY & START ───── */
function setReady(room,pid,flag){
  const p=room.players[pid]; if(!p) return;
  p.ready=!!flag;
  broadcastRoom(getRid(room),{type:'players',players:publicPlayers(room)});
  if(room.status==='waiting' && Object.values(room.players).length>=2 &&
     Object.values(room.players).every(pl=>pl.ready)){
    startGame(room);
  }
}
function startGame(room){
  room.status='playing';
  room.deck  = shuffle(makeDeck());
  for(const pl of Object.values(room.players)){
    pl.hand  = draw(room,2);
    pl.coins = 2; pl.alive=true;
    send(pl.socket,{type:'start',hand:pl.hand,players:publicPlayers(room)});
  }
  hist(room,'Partida iniciada');
}

/* ───── Ações do jogo ───── */
function handleCoins(room,pid,d){
  const p=room.players[pid]; if(!p||![1,-1].includes(d)||p.coins+d<0) return;
  p.coins+=d;
  broadcastRoom(getRid(room),{type:'coins',pid,coins:p.coins});
  hist(room,`${p.name} ${d>0?'+':'-'}1 moeda`);
}
function handleLose(room,pid,card){
  const p=room.players[pid]; if(!p||!p.hand.includes(card)) return;
  removeOnce(p.hand,card); if(!p.hand.length) p.alive=false;
  send(p.socket,{type:'hand',hand:p.hand});
  broadcastRoom(getRid(room),{type:'cards',pid,cards:p.hand.length,alive:p.alive});
  hist(room,`${p.name} perdeu ${card}`);
}
function handleReveal(room,pid,card){
  const p=room.players[pid]; if(!p||!p.hand.includes(card)) return;
  replaceCard(room,pid,card);
  broadcastRoom(getRid(room),{type:'reveal',pid});
  hist(room,`${p.name} revelou ${card} e trocou`);
}
function handleAmbDraw(room,pid){
  const p=room.players[pid]; if(!p) return;
  p.hand.push(...draw(room,2));
  send(p.socket,{type:'ambassador',hand:[...p.hand]});
  hist(room,`${p.name} iniciou troca (Embaixador)`);
}
function handleAmbReturn(room,pid,ret){
  const p=room.players[pid]; if(!p||ret.length!==2) return;
  ret.forEach(c=>removeOnce(p.hand,c)); deckReturn(room,ret);
  send(p.socket,{type:'hand',hand:p.hand});
  broadcastRoom(getRid(room),{type:'reveal',pid});
  hist(room,`${p.name} concluiu troca (Embaixador)`);
}

/* ───── helpers ───── */
function replaceCard(room,pid,old){
  deckReturn(room,[old]);
  room.players[pid].hand[room.players[pid].hand.indexOf(old)] = draw(room,1)[0];
  send(room.players[pid].socket,{type:'hand',hand:room.players[pid].hand});
}
function deckReturn(room,arr){room.deck.push(...arr);shuffle(room.deck);}
function removeOnce(arr,v){const i=arr.indexOf(v);if(i>-1)arr.splice(i,1);}
function publicPlayers(room){
  const o={}; for(const [id,p] of Object.entries(room.players))
    o[id]={name:p.name,coins:p.coins,cards:p.hand.length,alive:p.alive,ready:p.ready};
  return o;
}
function broadcastRoom(roomId,obj,exceptPid){
  const d=JSON.stringify(obj);
  for(const [pid,pl] of Object.entries(rooms[roomId].players)){
    if(pid===exceptPid) continue;
    if(pl.socket && pl.socket.readyState===1) pl.socket.send(d);
  }
}
function send(sock,obj){ sock && sock.readyState===1 && sock.send(JSON.stringify(obj)); }
function hist(room,text){ broadcastRoom(getRid(room),{type:'history',entry:{t:Date.now(),text}}); }
function safeJSON(r){try{return JSON.parse(r);}catch{return null;}}
function getRid(room){return Object.entries(rooms).find(([,r])=>r===room)[0];}

console.log(`Servidor Coup WS rodando em ws://localhost:${PORT}`);
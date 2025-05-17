// server.js – WebSocket server para Coup (inclui troca do Embaixador)
//
// cliente → servidor
// ────────────────────────────────────────────────────────────────
// { type:'join',            name? }          // entra na sala
// { type:'coinDelta',       delta:+1|-1 }
// { type:'loseCard',        card }
// { type:'revealCard',      card }
// { type:'ambassadorDraw' }                 // pega 2 cartas extras
// { type:'ambassadorReturn',return:[c1,c2]} // devolve 2 cartas
//
// servidor → todos
// ────────────────────────────────────────────────────────────────
// { type:'players',  players:{ pid:{name,coins,cards,alive} } }
// { type:'coins',    pid, coins }
// { type:'cards',    pid, cards, alive }
// { type:'reveal',   pid }                  // revelou OU concluiu troca
// { type:'history',  entry:{t,text} }
//
// servidor → dono
// ────────────────────────────────────────────────────────────────
// { type:'welcome',  pid, hand:[…], players:{…} }
// { type:'hand',     hand:[…] }             // mão atual
// { type:'ambassador', hand:[…] }           // mão de 4 cartas
//-----------------------------------------------------------------
import { WebSocketServer } from 'ws';
import { v4 as uuid }       from 'uuid';

const PORT = 8080;
const wss  = new WebSocketServer({ port: PORT });

/* ───────── estado ───────── */
const game = {
  players : {},                       // pid → {name,coins,hand,alive}
  deck    : shuffle(makeDeck()),      // 15 cartas
  history : []                        // [{t,text}]
};

/* ───────── conexão ───────── */
wss.on('connection', ws => {
  ws.once('message', raw => {                               // espera "join"
    const msg = safeJSON(raw);
    if (!msg || msg.type!=='join') return;

    const pid  = uuid();
    ws._pid    = pid;
    const name = (msg.name||'').trim() || `P${Object.keys(game.players).length+1}`;

    game.players[pid] = { name, coins:2, hand:draw(2), alive:true };

    send(ws, { type:'welcome', pid, hand:game.players[pid].hand, players:publicPlayers() });
    broadcastPlayers(pid);
    log(`${name} entrou na partida`);

    /* mensagens subsequentes */
    ws.on('message', raw2 => {
      const m = safeJSON(raw2); if(!m) return;
      switch (m.type) {
        case 'coinDelta'      : handleCoins(pid, m.delta);             break;
        case 'loseCard'       : handleLose (pid, m.card);              break;
        case 'revealCard'     : handleReveal(pid, m.card);             break;
        case 'ambassadorDraw' : handleAmbDraw(pid);                    break;
        case 'ambassadorReturn': handleAmbReturn(pid, m.return);       break;
      }
    });

    ws.on('close', () => {
      const p = game.players[pid]; if(!p) return;
      delete game.players[pid];
      broadcastPlayers();
      log(`${p.name} saiu da partida`);
    });
  });
});

/* ───────── handlers ───────── */
function handleCoins(pid, delta) {
  const p = game.players[pid]; if(!p || ![1,-1].includes(delta)) return;
  if (p.coins + delta < 0) return;
  p.coins += delta;
  broadcast({ type:'coins', pid, coins:p.coins });
  log(`${p.name} ${delta>0?'+':'-'}1 moeda`);
}

function handleLose(pid, card) {
  const p = game.players[pid]; if(!p||!p.hand.includes(card)) return;
  removeOnce(p.hand, card);
  if (!p.hand.length) p.alive = false;
  sendTo(pid, { type:'hand', hand:p.hand });
  broadcast({ type:'cards', pid, cards:p.hand.length, alive:p.alive });
  log(`${p.name} perdeu ${card}`);
}

function handleReveal(pid, card) {
  const p = game.players[pid]; if(!p||!p.hand.includes(card)) return;
  replaceCard(pid, card);
  broadcast({ type:'reveal', pid });
  log(`${p.name} revelou ${card} e pegou nova carta`);
}

/* ── Embaixador ── */
function handleAmbDraw(pid){
  const p = game.players[pid]; if(!p) return;
  p.hand.push(...draw(2));                       // agora 4 cartas
  sendTo(pid, { type:'ambassador', hand:[...p.hand] });
  log(`${p.name} iniciou troca (Embaixador)`);
}

function handleAmbReturn(pid, ret){
  const p = game.players[pid]; if(!p||!Array.isArray(ret)||ret.length!==2) return;

  // verifica se as cartas estão mesmo na mão (lidando com duplicatas)
  const temp=[...p.hand];
  for(const c of ret){
    const i=temp.indexOf(c);
    if(i===-1) return;           // carta inválida
    temp.splice(i,1);
  }
  // remove do hand definitivo
  ret.forEach(c=>removeOnce(p.hand,c));
  deckReturn(ret);
  sendTo(pid, { type:'hand', hand:p.hand });
  broadcast({ type:'reveal', pid });             // indica troca concluída
  log(`${p.name} concluiu troca (Embaixador)`);
}

/* ───────── util cartas ───────── */
function makeDeck(){
  return ['duke','assassin','captain','ambassador','contessa']
         .flatMap(c => Array(3).fill(c));
}
function shuffle(a){
  for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function draw(n){ return game.deck.splice(0,n); }
function deckReturn(arr){ Array.isArray(arr) ? game.deck.push(...arr) : game.deck.push(arr); shuffle(game.deck); }
function replaceCard(pid, oldCard){
  deckReturn(oldCard);
  game.players[pid].hand[game.players[pid].hand.indexOf(oldCard)] = draw(1)[0];
  sendTo(pid, { type:'hand', hand:game.players[pid].hand });
}
function removeOnce(arr,val){const i=arr.indexOf(val); if(i>-1) arr.splice(i,1);}

/* ───────── broadcast / helpers ───────── */
function publicPlayers(){
  const o={}; for(const [id,p] of Object.entries(game.players))
    o[id]={name:p.name,coins:p.coins,cards:p.hand.length,alive:p.alive};
  return o;
}
function broadcastPlayers(except){ broadcast({type:'players',players:publicPlayers()}, except); }

function send(ws,obj)            { ws.send(JSON.stringify(obj)); }
function broadcast(obj,except){ const d=JSON.stringify(obj);
  wss.clients.forEach(c=>c.readyState===1&&c._pid!==except&&c.send(d)); }
function sendTo(pid,obj){ [...wss.clients].find(c=>c._pid===pid)?.send(JSON.stringify(obj)); }

function log(text){ broadcast({type:'history',entry:{t:Date.now(),text}}); }

function safeJSON(raw){ try{return JSON.parse(raw);}catch{return null;} }

/* ───────── bootstrap ───────── */
console.log(`Servidor Coup WebSocket pronto em ws://localhost:${PORT}`);
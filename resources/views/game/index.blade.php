{{-- resources/views/coup/index.blade.php --}}
@extends('layouts.app')

@section('content')
@php
    // "duke" => "/storage/cards/duke.png", …
    $cardImages = $cards->pluck('image', 'title');
@endphp

<style>
body{font:15px/1.4 sans-serif;margin:2rem}
#join{display:flex;gap:.5rem}
#game{display:none}
button{margin:.25rem .5rem .25rem 0}
#players{display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem}
#players div{border:1px solid #888;border-radius:4px;padding:.5rem;min-width:120px}
.card{cursor:pointer;margin:4px;border:1px solid #444;border-radius:4px}
.card.sel{background:#ffe}
#history{border:1px solid #bbb;height:220px;overflow:auto;padding:.5rem;font-size:12px;margin-top:1rem}
#info{color:#c00;margin:.5rem 0;font-weight:bold}
</style>

<div id="join" class="mb-2">
    <input id="name" class="form-control d-inline w-auto" placeholder="Seu nome">
    <button id="btnJoin" class="btn btn-primary">Entrar</button>
</div>

<div id="game">
    <h2 id="me"></h2>
    <div id="hand" class="mb-2"></div>
    <div id="info"></div>

    <button id="add" class="btn btn-success btn-sm">+1 moeda</button>
    <button id="rem" class="btn btn-danger btn-sm">-1 moeda</button>
    <button id="lose" class="btn btn-warning btn-sm">Perder influência</button>
    <button id="reveal" class="btn btn-warning btn-sm">Revelar &amp; trocar</button>
    <button id="amb" class="btn btn-info btn-sm">Troca (Embaixador)</button>

    <h3 class="mt-3">Jogadores</h3>
    <section id="players" class="d-flex flex-wrap gap-2"></section>

    <h3 class="mt-3">Histórico</h3>
    <div id="history"></div>
</div>

<script>
const CARD_IMG = @json($cardImages);

/* globals */
let ws, pid, myName='', myHand=[], mode=null, pending=[];

/* connection */
document.getElementById('btnJoin').onclick = () => {
    if (ws) return;
    myName = document.getElementById('name').value.trim();
    ws     = new WebSocket('ws://localhost:8080');
    ws.onopen    = () => send({type:'join', name:myName});
    ws.onmessage = e   => handle(JSON.parse(e.data));
};

/* simple buttons */
document.getElementById('add').onclick = () => send({type:'coinDelta',delta:1});
document.getElementById('rem').onclick = () => send({type:'coinDelta',delta:-1});
document.getElementById('lose').onclick   = () => startSelect('lose','Escolha a carta a perder');
document.getElementById('reveal').onclick = () => startSelect('reveal','Clique na carta para revelar');
document.getElementById('amb').onclick    = () => send({type:'ambassadorDraw'});

/* ws messages */
function handle(m){
    switch(m.type){
        case 'welcome':
            pid=m.pid; myHand=m.hand;
            renderPlayers(m.players); renderHand(); showGame();
        break;
        case 'players': renderPlayers(m.players); break;
        case 'hand':    myHand=m.hand; renderHand(); clearMode(); break;
        case 'ambassador': myHand=m.hand; renderHand(); startSelect('amb','Selecione 2 cartas para devolver'); break;
        case 'coins':   updateCoins(m.pid,m.coins); break;
        case 'cards':   updateCards(m.pid,m.cards,m.alive); break;
        case 'history': addHistory(m.entry); break;
    }
}

/* selection */
function startSelect(newMode,msg){ mode=newMode; pending=[]; setInfo(msg); highlight(true); }
function cardClick(card,img){
    if(!mode) return;
    if(mode==='lose'||mode==='reveal'){
        send({type:mode==='lose'?'loseCard':'revealCard',card}); clearMode(); return;
    }
    // amb
    if(img.classList.contains('sel')){
        img.classList.remove('sel'); pending.splice(pending.indexOf(card),1);
    }else if(pending.length<2){ img.classList.add('sel'); pending.push(card); }
    if(pending.length===2){ send({type:'ambassadorReturn',return:pending}); clearMode(); }
}
function clearMode(){ mode=null; pending=[]; setInfo(''); highlight(false); }
function highlight(on){ document.querySelectorAll('#hand .card').forEach(el=>{ el.classList.remove('sel'); el.style.cursor=on?'pointer':'default'; }); }

/* render */
function renderHand(){
    const box=document.getElementById('hand'); box.innerHTML='';
    myHand.forEach(c=>{
        const img=document.createElement('img');
        img.src="/storage/" + CARD_IMG[c]||''; img.alt=c; img.width=80; img.className='card';
        img.onclick=()=>cardClick(c,img);
        box.appendChild(img);
    });
}
function renderPlayers(plys){
    const area=document.getElementById('players'); area.innerHTML='';
    Object.entries(plys).forEach(([id,p])=>{
        const d=document.createElement('div'); d.dataset.pid=id;
        d.innerHTML=`<strong>${p.name}${id===pid?' (você)':''}</strong><br>
                     moedas: <span class="coins">${p.coins}</span><br>
                     cartas: <span class="cards">${p.cards}</span><br>
                     vivo: ${p.alive}`;
        area.appendChild(d);
        if(id===pid) document.getElementById('me').textContent=`${p.name} – moedas: ${p.coins}`;
    });
}
function updateCoins(id,coins){
    const span=document.querySelector(`[data-pid="${id}"] .coins`);
    if(span) span.textContent=coins;
    if(id===pid) document.getElementById('me').textContent=`${myName||'Você'} – moedas: ${coins}`;
}
function updateCards(id,cards,alive){
    const wrap=document.querySelector(`[data-pid="${id}"]`); if(!wrap) return;
    wrap.querySelector('.cards').textContent=cards;
    wrap.innerHTML=wrap.innerHTML.replace(/vivo: .*/,`vivo: ${alive}`);
}
function addHistory(e){
    const h=document.getElementById('history'); const div=document.createElement('div');
    div.textContent=`[${new Date(e.t).toLocaleTimeString()}] ${e.text}`;
    h.appendChild(div); h.scrollTop=h.scrollHeight;
}

/* util */
function send(o){ ws&&ws.readyState===1&&ws.send(JSON.stringify(o)); }
function setInfo(t){ document.getElementById('info').textContent=t; }
function showGame(){ document.getElementById('join').style.display='none'; document.getElementById('game').style.display='block'; }
</script>
@endsection
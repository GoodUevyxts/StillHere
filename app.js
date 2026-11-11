/* Screen controller: game.js owns the rules; this file connects them to the HTML. */
const G = PebbleGame;
const $ = selector => document.querySelector(selector);
const KEY = 'stillhere-game-v2';
let state = G.fresh();
let storageAvailable = true;
try {
  const saved = localStorage.getItem(KEY);
  if (saved) state = G.restore(JSON.parse(saved));
  else {
    const old = JSON.parse(localStorage.getItem('stillhere-v1'));
    if (old) state = G.restore({ name: old.name, legacyInspections: old.count });
  }
} catch { storageAvailable = false; }
let operation = null;
let lastTick = performance.now();
let lastSaved = lastTick;
let holdFrame;
let hintTimer;
let rareTimer;
let lastAccepted = 0;
let rhythm = 0;
let shownLevel = 0;
let announcedCooldown = false;
const rock = $('#rock');
const arena = $('#arena');
const inspect = $('#inspect');
const phrases = ['Confirmed. Still exceptionally rock-like.', 'A masterclass in remaining here.', 'Your diligence has been noted. By nobody.', 'One small click. No leap for pebblekind.', 'Geological excellence, maintained.', 'Error 404: ambition not found. Pebble found.', 'Your rock would like to circle back on doing nothing.', 'Please allow 3–5 geological eras for delivery.', 'A rolling stone gathers no moss. This one has a pension.', 'The pebble has declined your meeting invitation.', 'You are now on a first-name basis with sediment.', 'Rock bottom? More like rock premium.', 'Productivity has left the chat.', 'The rock is thinking. This may take a continent.', 'Congratulations. You have successfully interrupted nothing.'];
const forms = ['River stone', 'Mossy pebble', 'Granite nugget', 'Slate shard', 'Amber aggregate', 'Moonstone'];
const shapes = ['48% 53% 39% 42% / 65% 61% 34% 31%', '32% 65% 40% 51% / 45% 38% 62% 55%', '60% 35% 56% 38% / 39% 65% 40% 54%', '21% 67% 25% 51% / 62% 27% 45% 38%', '41% 38% 63% 29% / 50% 67% 28% 42%', '64% 39% 45% 57% / 35% 60% 54% 45%'];
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageAvailable = true; }
  catch { storageAvailable = false; }
  $('#storage-note').textContent = storageAvailable ? 'Progress and cooldowns are saved in this browser.' : 'Saving unavailable. Progress lasts for this session only.';
}
function log(message) {
  const item = document.createElement('li');
  const time = document.createElement('time'); const now = new Date();
  time.dateTime = now.toISOString(); time.textContent = now.toLocaleTimeString([], { hour12:false });
  item.append(time, document.createTextNode(message)); $('#activity').prepend(item);
  if ($('#activity').children.length > 6) $('#activity').lastElementChild.remove();
}
function say(message) { $('#status').textContent = message; }
function achievements(earned) {
  if (earned.length) { log(`Achievement unlocked: ${earned.join(' · ')}`); say(`Achievement unlocked: ${earned.join(' · ')}`); }
}
// Badge elements are built once. Only their values and styles change during play.
const badgeElements = G.BADGES.map(([id, title, description, stat, goal]) => {
  const card = document.createElement('article'); card.className = 'badge-card';
  const icon = document.createElement('span'); icon.className='badge-icon'; icon.setAttribute('aria-hidden','true');
  const heading = document.createElement('h3'); heading.textContent=title;
  const detail = document.createElement('p'); detail.textContent=description;
  const progress = document.createElement('progress'); progress.max=goal; progress.setAttribute('aria-label',title);
  const label = document.createElement('small'); card.append(icon,heading,detail,progress,label); $('#badges').append(card);
  return {id,stat,goal,card,icon,progress,label};
});
function formatTime(ms) {
  const sec = Math.floor(ms/1000);
  return [Math.floor(sec/3600), Math.floor(sec/60)%60, sec%60].map(n=>String(n).padStart(2,'0')).join(':');
}
function render() {
  renderExtras();
  $('#pebble-name').textContent=state.name;
  rock.setAttribute('aria-label',`Find ${state.name}, your pebble. Activate for one accepted click.`);
  $('#count').textContent=state.clicks.toLocaleString();
  $('#level-count').textContent=`Level ${state.level}`;
  $('#level-title').textContent=`LEVEL ${state.level} / ${state.level === 1 ? 'THE BEGINNING' : 'INCREASINGLY INCONSPICUOUS'}`;
  $('#form-title').textContent=forms[(state.level-1)%forms.length].toUpperCase();
  $('#level-progress').value=state.progress;
  $('#level-detail').textContent=`${state.progress} / 100 accepted clicks`;
  $('#elapsed').textContent=formatTime(state.waitMs);
  $('#movement-count').textContent=`${state.moves} RARE MOVEMENT${state.moves===1?'':'S'}`;
  $('#badge-total').textContent=`${state.badges.length} / ${G.BADGES.length} earned`;
  for (const b of badgeElements) {
    const earned=state.badges.includes(b.id);
    b.card.classList.toggle('earned',earned); b.icon.textContent=earned?'✦':'◇';
    b.progress.value=Math.min(b.goal,state[b.stat]); b.label.textContent=earned?'EARNED':'IN PROGRESS';
  }
  const next=G.BADGES.find(b=>!state.badges.includes(b[0]));
  $('#next-badge').textContent=next ? `Next in the cabinet: ${next[2]}.` : 'Every badge earned. Thoroughly unnecessary. Impressive.';
  const remaining=Math.max(0,Math.ceil((state.cooldownUntil-Date.now())/1000));
  $('#cooldown').hidden=!remaining;
  if(remaining) $('#cooldown').textContent=`Pebble needs space. Try again in ${remaining}s. Current level progress reset; earned levels and badges kept.`;
  $('#system').textContent=remaining?'● Cooling down':state.moves?'● Geological history recorded':'● All systems still';
  for(const node of [rock,inspect,$('#hold'),$('#deep')]) node.setAttribute('aria-disabled',String(remaining>0 || !!operation));
  if(remaining) announcedCooldown=true;
  else if(announcedCooldown) { announcedCooldown=false; say('Cooldown complete. A fresh start for this level.'); }
  if(shownLevel!==state.level) { shownLevel=state.level; layoutField(); }
}
function layoutField() {
  const d=G.difficulty(state.level); const total=d.decoys+1;
  const columns=Math.min(4,Math.ceil(Math.sqrt(total))); const rows=Math.ceil(total/columns);
  const width=arena.clientWidth, height=arena.clientHeight-30;
  const cellW=width/columns, cellH=height/rows;
  const targetSlot=Math.floor(Math.random()*total);
  const size=Math.max(44,Math.min(d.size,cellW-12,cellH-12));
  arena.style.setProperty('--rock-color',`hsl(${(state.level*29+47)%360} 13% ${62-Math.min(state.level,13)}%)`);
  arena.style.setProperty('--rock-shape',shapes[(state.level-1)%shapes.length]);
  arena.style.setProperty('--rock-angle',`${(state.level*17)%40-20}deg`);
  $('#decoys').replaceChildren();
  for(let slot=0;slot<total;slot++) {
    const isTarget=slot===targetSlot;
    const element=isTarget?rock:document.createElement('span');
    const itemSize=isTarget?size:Math.max(34,Math.min(size*(.75+Math.random()*.2),cellW-12,cellH-12));
    element.style.width=`${itemSize}px`; element.style.height=`${itemSize}px`;
    const x=(slot%columns)*cellW+6+Math.random()*Math.max(0,cellW-itemSize-12);
    const y=Math.floor(slot/columns)*cellH+6+Math.random()*Math.max(0,cellH-itemSize-12);
    element.style.left=`${x}px`; element.style.top=`${y}px`;
    if(!isTarget) {
      element.className='decoy'; const art=document.createElement('span');art.className='rock-art';element.append(art);$('#decoys').append(element);
    } else element.style.opacity=d.contrast;
  }
}
function moveButton(keyboard=false) {
  if(state.calm || keyboard) return;
  const range=Math.max(0,$('#button-track').clientWidth-inspect.offsetWidth-12);
  const current=parseFloat(inspect.style.left)||range/2;
  let next=Math.random()*range;
  if(Math.abs(next-current)<range*.25) next=current<range/2?range:0;
  inspect.style.left=`${6+next}px`;
}
function cancelOperation(message) {
  if(!operation) return;
  operation=null; cancelAnimationFrame(holdFrame); $('#hold-progress').value=0;
  if(message) say(message); render();
}
function process(result, keyboard=false) {
  if(result.type==='cooldown') { say('The pebble is on a break. The countdown will not restart.'); return; }
  if(result.type==='penalty') {
    cancelOperation();rhythm=0;
    const message=`Too many attempts. ${result.duration/1000}s cooldown; this level’s progress resets to 0.`;
    say(message);log(message);
  } else if(result.type==='miss') { say('An excellent decoy. Look for the pale notch—or use Reveal.'); }
  else if(result.type==='accepted') {
    const now=performance.now();const gap=now-lastAccepted;rhythm=gap>=700 && gap<=2200?rhythm+1:1;lastAccepted=now;
    say(rhythm>=5?`Nice rhythm ×${rhythm}. Calm, considered, completely pointless.`:phrases[Math.floor(Math.random()*phrases.length)]);
    if(state.clicks%10===0) log(`${state.clicks.toLocaleString()} accepted clicks. A remarkable lack of urgency.`);
    achievements(result.earned);
    if(result.levelUp) { say(`Level ${state.level}! New stone, new hiding place. Find the pale notch.`);log(`Level ${state.level} reached. The pebble has changed its look.`); }
    if(result.moved) {
      say('IT MOVED. A 0.10% moment. Geological history is yours.');log('Rare movement! The pebble actually moved.');
      clearTimeout(rareTimer); rock.classList.remove('celebrate');void rock.offsetWidth;rock.classList.add('celebrate');arena.classList.add('rare');
      rareTimer=setTimeout(()=>{rock.classList.remove('celebrate');arena.classList.remove('rare');},4000);
    }
    inspect.classList.remove('click-pop'); void inspect.offsetWidth; inspect.classList.add('click-pop');
    moveButton(keyboard);
    maybeError(result.moved);
  }
  render(); save();
}
function play(correct=true, keyboard=false) {
  // Starting another action cannot bypass an in-progress timed inspection.
  if($('#blocks-dialog').open) return;
  if(operation) { const gate=G.attempt(state,Date.now()); if(gate.type==='allowed') say('Finish the current inspection first.'); else process(gate);save();return; }
  process(G.click(state,Date.now(),Math.random,correct),keyboard);
}
rock.addEventListener('click',e=>play(true,e.detail===0));
inspect.addEventListener('click',e=>play(true,e.detail===0));
arena.addEventListener('click',e=>{if(!rock.contains(e.target)) play(false,e.detail===0);});
// Holding and automatic deep inspection both award one click after a visible 3s wait.
function startOperation(kind) {
  if($('#blocks-dialog').open) return;
  if(operation) {
    const gate=G.attempt(state,Date.now());
    if(gate.type!=='allowed') process(gate);
    save(); return;
  }
  const gate=G.attempt(state,Date.now());
  if(gate.type!=='allowed') {process(gate);return;}
  operation={kind,started:performance.now()};
  say(kind==='hold'?'Hold steady… release early to cancel.':'Deep inspection underway. Three seconds of profound investigation.');render();save();
  function frame(now) {
    if(!operation) return;
    if(document.hidden) {cancelOperation('Inspection paused. Come back when you are ready.');return;}
    const fraction=Math.min(1,(now-operation.started)/3000);$('#hold-progress').value=fraction*100;
    if(fraction>=1) {operation=null;$('#hold-progress').value=0;process(G.reward(state),true);}
    else holdFrame=requestAnimationFrame(frame);
  }
  holdFrame=requestAnimationFrame(frame);
}
const hold=$('#hold');
hold.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();hold.focus();hold.setPointerCapture(e.pointerId);startOperation('hold');});
for(const event of ['pointerup','pointercancel','lostpointercapture']) hold.addEventListener(event,()=>{if(operation?.kind==='hold')cancelOperation('Released early. No click spent, no click earned.');});
hold.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)startOperation('hold');}});
hold.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(operation?.kind==='hold')cancelOperation('Released early. Try a steady three-second hold.');}});
hold.addEventListener('blur',()=>{if(operation?.kind==='hold')cancelOperation('Hold cancelled.');});
$('#deep').addEventListener('click',()=>startOperation('deep'));
$('#hint').addEventListener('click',()=>{arena.classList.add('revealed');clearTimeout(hintTimer);hintTimer=setTimeout(()=>arena.classList.remove('revealed'),2000);});
$('#calm').checked=state.calm;
$('#calm').addEventListener('change',()=>{state.calm=$('#calm').checked;inspect.style.left='calc(50% - 86px)';save();});
$('#name-input').value=state.name;
$('#name-form').addEventListener('submit',e=>{
  e.preventDefault();const input=$('#name-input');const name=input.value.trim();
  if(!name){input.setCustomValidity('Please give your pebble a name.');input.reportValidity();return;}
  state.name=name.slice(0,40);input.value=state.name;render();save();log('Name updated. Pebble remains indifferent.');
});
$('#name-input').addEventListener('input',()=>$('#name-input').setCustomValidity(''));
$('#report').addEventListener('click',()=>{
  const report=`STILLHERE — FIELD REPORT\nPebble: ${state.name}\nLevel: ${state.level}\nNext-level progress: ${state.progress}/100\nAccepted clicks: ${state.clicks}\nVisible-tab time: ${formatTime(state.waitMs)}\nScore: ${G.score(state)}\nRepaired errors: ${state.gamesWon}\nRare movements: ${state.moves}\nMovement odds: 0.10% per accepted click\nAchievements: ${state.badges.length}/${G.BADGES.length}\n${G.BADGES.filter(b=>state.badges.includes(b[0])).map(b=>' - '+b[1]).join('\n')}\nLegacy automatic/manual inspections: ${state.legacyInspections}\nGenerated: ${new Date().toISOString()}\n\nA fully unnecessary endeavour.\n`;
  const url=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='stillhere-report.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function tick() {
  const now=performance.now();achievements(G.wait(state,now-lastTick,!document.hidden));lastTick=now;render();
  if(now-lastSaved>=2000 && !document.hidden){save();lastSaved=now;}
}
setInterval(tick,250);
document.addEventListener('visibilitychange',()=>{lastTick=performance.now();if(document.hidden){cancelOperation();save();}});
window.addEventListener('pagehide',save);
window.addEventListener('storage',e=>{
  if(e.key!==KEY || !e.newValue)return;
  try {state=G.restore(JSON.parse(e.newValue));cancelOperation();$('#name-input').value=state.name;$('#calm').checked=state.calm;$('#goal-input').value=state.goal;render();}catch{}
});
window.addEventListener('resize',()=>{layoutField();inspect.style.left='calc(50% - 86px)';});
// Personalisation, goal calculations and a deliberately fictional error-repair game.
const errors = [
  'PEBBLE_418: Your rock insists it is a teapot.',
  'SEDIMENT_OVERFLOW: Too much nothing in the buffer.',
  'ROCK_NOT_ROLL: The geology department has misplaced the rhythm.',
  'MOSS_PROTOCOL_FAILURE: Please defragment your sediment.',
  'STONE_COLD_CACHE: The pebble has forgotten how to remember.',
  'UNEXPECTED_GRANITE: An unsolicited rock has entered the workflow.'
];
let puzzle = null;
let puzzlePaused = false;
let puzzleFrame = 0;
let puzzleLast = 0;
let puzzleFinished = false;
const puzzleDialog = $('#blocks-dialog');
const canvas = $('#blocks-canvas');
const ctx = canvas.getContext('2d');
function renderExtras() {
  document.body.dataset.theme=state.theme;
  $('#theme').value=state.theme;
  $('#score').textContent=G.score(state).toLocaleString();
  const calc=G.goalStats(state);
  $('#goal-remaining').textContent=calc.remaining.toLocaleString();
  $('#goal-odds').textContent=calc.remaining ? `${calc.chance.toFixed(2)}% chance of at least one movement over those remaining clicks.` : 'Goal reached. Set a new target whenever you like.';
  $('#goal-progress').max=state.goal;$('#goal-progress').value=Math.min(state.goal,state.clicks);
  $('#error-banner').hidden=!state.errorPending;
  $('#error-message').textContent=state.errorPending;
}
$('#theme').addEventListener('change',()=>{state.theme=$('#theme').value;render();save();});
$('#goal-input').value=state.goal;
$('#goal-form').addEventListener('submit',e=>{
  e.preventDefault();const value=Number($('#goal-input').value);
  if(!Number.isSafeInteger(value)||value<1||value>100000){$('#goal-feedback').textContent='Enter a whole number from 1 to 100,000.';return;}
  state.goal=value;$('#goal-feedback').textContent=`Goal saved: ${value.toLocaleString()} lifetime clicks.`;render();save();
});
function maybeError(moved) {
  if(moved || state.errorPending || state.clicks-state.lastErrorAt<20 || Math.random()>=.06)return;
  state.errorPending=errors[Math.floor(Math.random()*errors.length)];state.lastErrorAt=state.clicks;
  log('Fictional pebble error. Clear 10 puzzle points to repair it.');
  // The banner remains until a repair is completed. Opening the puzzle is optional.
}
$('#reset').addEventListener('click',()=>{$('#reset-dialog').showModal();$('#cancel-reset').focus();});
$('#cancel-reset').addEventListener('click',()=>$('#reset-dialog').close());
$('#confirm-reset').addEventListener('click',()=>{
  cancelOperation();stopPuzzle();if(puzzleDialog.open)puzzleDialog.close();puzzle=null;
  const {name,theme}=state;state=G.fresh();state.name=name;state.theme=theme;
  rhythm=0;lastAccepted=0;shownLevel=0;announcedCooldown=false;lastTick=performance.now();
  clearTimeout(rareTimer);clearTimeout(hintTimer);arena.classList.remove('rare','revealed');rock.classList.remove('celebrate');
  $('#calm').checked=false;$('#goal-input').value=state.goal;$('#goal-feedback').textContent='Choose between 1 and 100,000 clicks.';
  inspect.style.left='calc(50% - 86px)';$('#activity').replaceChildren();
  $('#reset-dialog').close();render();save();say('Fresh start. The pebble remembers nothing. Neither do the counters.');log('Progress manually reset.');
});
function stopPuzzle(){cancelAnimationFrame(puzzleFrame);puzzleFrame=0;}
function newPuzzle(){
  puzzle=PebbleBlocks.newGame(()=>.2); // An O block: a gentle, solvable opening.
  const gap=[0,2,4][Math.floor(Math.random()*3)];
  puzzle.board[9]=[1,1,1,1,1,1].map((v,i)=>i===gap||i===gap+1?0:v);
  puzzlePaused=false;puzzleFinished=false;$('#blocks-pause').textContent='Pause';
  $('#blocks-status').textContent='Fill the gap in the bottom row. One full row = 10 points.';
  $('#repair-form').hidden=true;$('#repair-answer').value='';$('#repair-feedback').textContent='';
  drawPuzzle();
}
function openPuzzle(){
  cancelOperation('Inspection cancelled to open the repair bench.');
  if(!puzzle||puzzleFinished)newPuzzle();
  puzzleDialog.showModal();canvas.focus();$('#blocks-later').textContent='Play later — keep the error';puzzlePaused=false;puzzleLast=performance.now();
  $('#blocks-pause').textContent='Pause';drawPuzzle();stopPuzzle();puzzleFrame=requestAnimationFrame(puzzleLoop);
}
$('#repair').addEventListener('click',openPuzzle);
$('#practice-blocks').addEventListener('click',openPuzzle);
$('#blocks-later').addEventListener('click',()=>puzzleDialog.close());
puzzleDialog.addEventListener('close',()=>{stopPuzzle();puzzlePaused=true;});
function finishRepair(){
  if(puzzleFinished)return;puzzleFinished=true;stopPuzzle();
  if(state.errorPending){state.errorPending='';state.gamesWon+=1;state.lastErrorAt=state.clicks;say('Geology repaired. +100 points. The pebble remains deeply ungrateful.');log('Pebble error repaired: +100 points.');$('#blocks-status').textContent='10 points! Error cleared. +100 to your main score.';}
  else $('#blocks-status').textContent='10 points! Practice complete. Real error repairs earn 100 main-game points.';
  $('#blocks-score').textContent='10 / 10';$('#blocks-later').textContent='Done — back to the pebble';render();save();
}
function drawPuzzle(){
  if(!puzzle)return;
  const colors=['#20342f','#a4c67c','#b8a0cf','#e4ad77','#88bfbd','#d193a4','#c3c866','#92accf'];
  ctx.fillStyle=colors[0];ctx.fillRect(0,0,240,400);
  function cell(x,y,color){ctx.fillStyle=colors[color];ctx.fillRect(x*40+2,y*40+2,36,36);ctx.fillStyle='#ffffff33';ctx.fillRect(x*40+4,y*40+4,32,4);}
  for(let y=0;y<10;y++)for(let x=0;x<6;x++){ctx.strokeStyle='#43574b';ctx.strokeRect(x*40,y*40,40,40);if(puzzle.board[y][x])cell(x,y,puzzle.board[y][x]);}
  if(!puzzle.won)puzzle.piece.matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v)cell(puzzle.piece.x+x,puzzle.piece.y+y,puzzle.piece.color);}));
  $('#blocks-score').textContent=`${puzzle.points} / 10`;
  if(puzzle.won){finishRepair();return;}
  if(puzzle.over){stopPuzzle();$('#blocks-status').textContent='The sediment reached the ceiling. Restart the puzzle and try again.';}
}
function puzzleLoop(now){
  if(!puzzleDialog.open||puzzleFinished||puzzle.over)return;
  if(!puzzlePaused&&!document.hidden&&now-puzzleLast>=700){PebbleBlocks.step(puzzle);puzzleLast=now;drawPuzzle();}
  if(puzzlePaused||document.hidden)puzzleLast=now;
  if(!puzzleFinished&&!puzzle.over)puzzleFrame=requestAnimationFrame(puzzleLoop);
}
function blockAction(action){
  if(!puzzleDialog.open||puzzlePaused||puzzleFinished||puzzle.over||document.hidden)return;
  if(action==='left')PebbleBlocks.move(puzzle,-1,0);
  if(action==='right')PebbleBlocks.move(puzzle,1,0);
  if(action==='rotate')PebbleBlocks.rotate(puzzle);
  if(action==='down')PebbleBlocks.step(puzzle);
  if(action==='drop')PebbleBlocks.drop(puzzle);
  puzzleLast=performance.now();drawPuzzle();
}
for(const button of document.querySelectorAll('[data-block]'))button.addEventListener('click',()=>blockAction(button.dataset.block));
puzzleDialog.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||(e.key===' '&&e.target.tagName==='BUTTON'))return;
  const action={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',' ':'drop'}[e.key];
  if(action){e.preventDefault();if(!e.repeat||action!=='drop')blockAction(action);}
});
$('#blocks-pause').addEventListener('click',()=>{puzzlePaused=!puzzlePaused;$('#blocks-pause').textContent=puzzlePaused?'Resume':'Pause';puzzleLast=performance.now();});
$('#blocks-restart').addEventListener('click',()=>{stopPuzzle();newPuzzle();$('#blocks-later').textContent='Play later — keep the error';puzzleLast=performance.now();puzzleFrame=requestAnimationFrame(puzzleLoop);});
$('#accessible-repair').addEventListener('click',()=>{puzzlePaused=true;$('#blocks-pause').textContent='Resume';$('#repair-form').hidden=false;$('#repair-answer').focus();});
$('#repair-form').addEventListener('submit',e=>{e.preventDefault();if(Number($('#repair-answer').value)!==10){$('#repair-feedback').textContent='Not quite. Add 4 + 6 and try again.';return;}puzzle.points=10;puzzle.won=true;finishRepair();$('#repair-feedback').textContent='Correct. Ten points earned. Repair complete.';});

render();
$('#storage-note').textContent=storageAvailable?'Progress and cooldowns are saved in this browser.':'Saved data unavailable. Using this session only.';
log('Field reopened. Your next geological chapter begins.');

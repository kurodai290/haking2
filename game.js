(() => {
  const $ = (id) => document.getElementById(id);
  // Fictional lab-only Storage clues used by selected cases; no answers are stored here.
  try { if (!localStorage.getItem('bb_cache_key')) localStorage.setItem('bb_cache_key','K3'); if (!localStorage.getItem('bb_archive_tag')) localStorage.setItem('bb_archive_tag','TAG9'); } catch {}
  const message = $('message');
  const answer = $('answer');
  const verify = $('verify');
  const stage = Number(document.body.dataset.stage || 0);
  const detour = Number(document.body.dataset.detour || 0);
  const say = (text, type='') => { if (!message) return; message.textContent=text; message.className='message '+type; };
  async function request(url, body) {
    const response = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify(body)});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'サーバーとの通信に失敗しました。');
    return data;
  }
  async function submit() {
    if (!answer || !verify) return;
    const value=answer.value.trim(); if (!value) { say('回答を入力してください。','error'); answer.focus(); return; }
    verify.disabled=true; say('サーバーで照合しています…');
    try {
      const data = detour ? await request('/api/verify-detour',{checkpoint:detour,answer:value}) : await request('/api/verify',{stage,answer:value});
      if (!data.ok) { say(data.message || '不正解です。','error'); answer.select(); return; }
      say(data.message || '認証成功','success');
      if (data.nextPath) { verify.textContent='移動中…'; window.location.assign(data.nextPath); }
    } catch (e) { say(e.message || 'サーバーとの接続に失敗しました。','error'); }
    finally { verify.disabled=false; }
  }
  if (verify) verify.addEventListener('click',submit);
  if (answer) answer.addEventListener('keydown',e=>{if(e.key==='Enter')submit();});
  const reset=$('reset'); if(reset) reset.addEventListener('click',async()=>{if(!confirm('このブラウザーの進行状況を最初からに戻しますか？'))return;reset.disabled=true;try{await request('/api/reset',{});window.location.assign('/index.html');}catch(e){say(e.message,'error');reset.disabled=false;}});
  async function loadProgress(){
    const grid=$('stageGrid'); if(!grid)return;
    try { const r=await fetch('/api/progress',{credentials:'same-origin',cache:'no-store'}); const p=await r.json(); const current=Number(p.stage||1); const done=Math.min(30,current-1); $('progressText').textContent=`${done} / 15`; $('progressBar').style.width=`${done/30*100}%`; for(let i=1;i<=30;i++){const d=document.createElement('div');d.className='stage-dot '+(i<current?'done':i===current?'current':'');d.textContent=String(i).padStart(2,'0');grid.appendChild(d);} }
    catch { grid.textContent='進行状況を読み込めません'; }
  }

  // Mode selector and lightweight room lobby (HTTP polling; no extra service required).
  const modeButtons=[...document.querySelectorAll('.mode-choice')];
  let selectedMode='solo';
  const roomControls=$('roomControls'), roomInfo=$('roomInfo');
  const playerName=$('playerName'), roomCode=$('roomCode');
  const secretAnswers=$('secretAnswers'), secretAnswerList=$('secretAnswerList');
  const secretStages=$('secretStages'), secretStageGrid=$('secretStageGrid');
  function chooseMode(mode){
    selectedMode=mode; modeButtons.forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
    if(roomControls) roomControls.hidden=mode==='solo';
    if(roomCode){roomCode.maxLength=mode==='battle'?40:6;roomCode.placeholder=mode==='battle'?'参加コード / 特別コード':'例：A1B2C3';}
    if(secretAnswers)secretAnswers.hidden=true;
    if(secretStages)secretStages.hidden=true;
    const start=$('soloStart'); if(start) start.querySelector('button').textContent=mode==='solo'?'一人で調査を開始 →':(mode==='team'?'チームルームを作成・参加して開始':'対戦ルームを作成・参加して開始');
  }
  modeButtons.forEach(b=>b.addEventListener('click',()=>chooseMode(b.dataset.mode)));
  const startLink=$('soloStart');
  if(startLink) startLink.addEventListener('click',async e=>{
    if(selectedMode==='solo') return;
    e.preventDefault();
    try{
      const d=await roomRequest('/api/rooms/current');
      if(!d.room){if(roomInfo)roomInfo.textContent='先にルームを作成するか、参加コードで参加してください。';return;}
      window.location.assign('/stage'+String(d.progress?.stage||1).padStart(2,'0')+'.html');
    }catch(err){if(roomInfo)roomInfo.textContent=err.message;}
  });
  async function roomRequest(path,body){
    const response=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:body?JSON.stringify(body):undefined});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.message||'ルーム通信に失敗しました。');
    return data;
  }
  function renderRoom(data){
    if(!roomInfo)return;
    if(!data.room){roomInfo.textContent='ルーム未参加';return;}
    const r=data.room, mode=r.mode==='team'?'チーム攻略':'人と対決';
    roomInfo.textContent=`${mode}ルーム：${r.code}\n参加者（${r.players.length}/8）：${r.players.map(p=>p.name).join('、')}\n${r.mode==='team'?'チーム共通の進行状況：ステージ '+r.stage:'各プレイヤーが個別に進行。最初に全30ステージを突破した人が勝者。'}${r.winner?'\n🏆 勝者：'+r.winner:''}`;
  }
  const createRoom=$('createRoom'), joinRoom=$('joinRoom');
  if(createRoom) createRoom.addEventListener('click',async()=>{
    createRoom.disabled=true;
    try{const d=await roomRequest('/api/rooms/create',{mode:selectedMode==='battle'?'battle':'team',name:playerName?.value||'プレイヤー'});renderRoom(d);if(roomCode)roomCode.value=d.room.code;roomInfo.textContent+='\nルームコードを友達に共有してください。';}
    catch(e){if(roomInfo)roomInfo.textContent=e.message;}finally{createRoom.disabled=false;}
  });
  if(joinRoom) joinRoom.addEventListener('click',async()=>{
    joinRoom.disabled=true;
    try{
      const enteredCode=roomCode?.value||'';
      if(selectedMode==='battle'){
        // Secret codes are verified by the server, not embedded in this client file.
        try {
          const jump=await roomRequest('/api/secret/stages',{code:enteredCode});
          if(jump.ok && Array.isArray(jump.stages)){
            if(secretStageGrid){secretStageGrid.replaceChildren();jump.stages.forEach(item=>{const button=document.createElement('button');button.type='button';button.textContent=item.label;button.addEventListener('click',async()=>{button.disabled=true;try{const moved=await roomRequest('/api/secret/jump',{code:enteredCode,stage:item.stage});if(moved.ok)window.location.assign(moved.nextPath);}catch(e){if(roomInfo)roomInfo.textContent=e.message;button.disabled=false;}});secretStageGrid.appendChild(button);});}
            if(secretStages)secretStages.hidden=false;
            if(secretAnswers)secretAnswers.hidden=true;
            if(roomInfo)roomInfo.textContent='ステージ移動コードを確認しました。移動先を選んでください。';
            return;
          }
        } catch (secretError) {
          if(secretError.message==='コードが違います。') { /* try the other special code, then normal room join */ }
          else throw secretError;
        }
        try {
          const secret=await roomRequest('/api/secret/answers',{code:enteredCode});
          if(secret.ok && Array.isArray(secret.answers)){
            if(secretAnswerList){secretAnswerList.replaceChildren();secret.answers.forEach(item=>{const li=document.createElement('li');li.textContent=`${item.case}：${item.answer}`;secretAnswerList.appendChild(li);});}
            if(secretAnswers)secretAnswers.hidden=false;
            if(roomInfo)roomInfo.textContent='特別コードを確認しました。正解一覧を表示します。';
            return;
          }
        } catch (secretError) {
          if(secretError.message==='コードが違います。') { /* continue as a normal room code */ }
          else throw secretError;
        }
      }
      const d=await roomRequest('/api/rooms/join',{code:enteredCode,name:playerName?.value||'プレイヤー'});renderRoom(d);if(roomInfo)roomInfo.textContent+='\nルームに参加しました。ステージ01から開始します。';window.location.assign('/stage01.html');
    } catch(e){if(roomInfo)roomInfo.textContent=e.message;}finally{joinRoom.disabled=false;}
  });
  if(createRoom){
    const originalText=createRoom.textContent;
    createRoom.addEventListener('click',()=>{createRoom.textContent='作成しました';setTimeout(()=>{createRoom.textContent=originalText;},1200);});
  }
  async function refreshRoom(){
    try{const d=await roomRequest('/api/rooms/current');if(d.room)renderRoom(d);}catch{}
  }
  refreshRoom();
  // Team members follow the shared server-side stage as soon as another teammate unlocks it.
  if(stage){
    setInterval(async()=>{
      try{
        const d=await roomRequest('/api/rooms/current');
        if(!d.room||d.room.mode!=='team'||!d.progress)return;
        const p=d.progress;
        if(p.detour && detour!==p.detour) window.location.assign('/detour'+String(p.detour).padStart(2,'0')+'.html');
        else if(!p.detour && p.stage!==stage && p.stage<=30) window.location.assign('/stage'+String(p.stage).padStart(2,'0')+'.html');
        else if(p.stage>30) window.location.assign('/complete.html');
      }catch{}
    },3000);
  }

  // Stage 13: generate a real, safe in-game request so learners can find it in DevTools Network.
  if (stage === 13) { fetch('/api/session_KS', {credentials:'same-origin', cache:'no-store'}).catch(() => {}); }

  loadProgress();
})();

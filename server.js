const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({limit:'2kb'}));
app.use(session({secret:process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'), resave:false, saveUninitialized:false, cookie:{httpOnly:true, sameSite:'lax', secure:'auto', maxAge: 1000*60*60*8}}));

// 正解はサーバー側にだけ保存。クライアントへは返しません。
const ANSWERS = {
  "1": "231ced6d606c13bd2546d9343615d70e430ee48f5ab437523a6d6fb1904511b6",
  "2": "e18bc4db63e3986645aa9887360d4d222f3f7925e38ee2c8202a7efb7ec1875a",
  "3": "7cc6f41f65ae829c10fb2701eab017d43650bcdefdcdd0363d9d347a321ffa5a",
  "4": "33c604aed594a9618f582adf5c78809254b81770ae3638d628e3c3b5012c357a",
  "5": "3abf4b3119a4ae580b677b746d03d9fa1620801bab466f9e5843059e404c712b",
  "6": "3a5e8ee3ff8e82c6a1f187e2df1eac027208d8f7b92dcaeeb95573ab5855fb00",
  "7": "21db98ac119ed289000cf0b434074132747077c255d22cb83d7065ba61054b55",
  "8": "d4a084f26e57caa6094c0f3658e9e185625ef680ad21ad9e244fff928978a5f9",
  "9": "537dc501540e8eb1fda29f845f086a47da4cea5be32c96404f086c01fd177b2d",
  "10": "bbe6b9b1a150c18a8d390d7521ecf91b8042651322b70c2b9f232be583cf1a8a",
  "11": "185c102b2470a0f77e9e1a5a74bf6b3c3c12407b36e4a678211d978adbfd7aca",
  "12": "4417f6ff4735a19f0f5cd07442dd4a357d5e0d17e61303dddb009fd5a2cb0f9c",
  "13": "b46a15e5296b47cd1c3037b45eab32fb624b2292a3e3e78b01b1af7471722fe6",
  "14": "2c19a80afad37e63607d8b9312b943cd09b578e55859bde7bd3d7a7f99fa7ad9",
  "15": "a275ed14d4eddac54280cd3bfb9bd751a0ab888f8c16fccdc000eda7475fd47e"
};
const DETOUR_ANSWERS = {
  "4": "396cdb8246d748977b2a2ba7258d0a916c7b9910ade620519684d35d33e87b5f",
  "8": "35fcdee9b9238f7ed41a17b8d4dfafdeb0577917191150eb43567d5163a20c72",
  "12": "9b21b03d9048a5e6799a5c7052283250a92ca32a7089203a0c37d113d9ee9c53"
};
const CHECKPOINTS = [4,8,12];
const normalize = value => String(value ?? '').trim().replace(/\s+/g,'').toUpperCase();
const digest = value => crypto.createHash('sha256').update(normalize(value)).digest('hex');
const equalHash = (a,b) => { try { return crypto.timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex')); } catch { return false; } };

// Rooms are intentionally in-memory for this prototype. A Railway restart clears rooms.
const rooms = new Map();
function state(req) {
  const room = req.session.roomCode && rooms.get(req.session.roomCode);
  if (room && room.mode === 'team') return room.progress;
  if (!req.session.progress) req.session.progress = {stage:1, detour:null, tries:0};
  return req.session.progress;
}
function publicRoom(room) {
  return {code:room.code, mode:room.mode, name:room.name, players:room.players.map(p=>({name:p.name,online:true,stage:room.mode==='team'?room.progress.stage:p.progress.stage})), stage:room.mode==='team'?room.progress.stage:null, winner:room.winner||null};
}
function roomPlayer(req, room) { return room.players.find(p=>p.id===req.sessionID); }

function jsonError(res,status,message) { return res.status(status).json({ok:false,message}); }

// Hidden answer-list unlock: only the hash of the unlock phrase is kept for comparison.
const ANSWER_LIST_KEY_HASH = '5775e512e69523c1f9c4e20d052ba4b8c3b198c39b9d8005b219aa434945ed15';
const ANSWER_LIST = [
  {case:'ステージ01', answer:'ORBIT-17'},
  {case:'ステージ02', answer:'08M4'},
  {case:'ステージ03', answer:'HTTP_R7'},
  {case:'ステージ04', answer:'0605'},
  {case:'追加調査04', answer:'0605-32'},
  {case:'ステージ05', answer:'TAG9-ZX'},
  {case:'ステージ06', answer:'BLUE24'},
  {case:'ステージ07', answer:'△○□'},
  {case:'ステージ08', answer:'XZ-12'},
  {case:'追加調査08', answer:'1751'},
  {case:'ステージ09', answer:'TAG9-09'},
  {case:'ステージ10', answer:'503/2'},
  {case:'ステージ11', answer:'ASH-04-RD'},
  {case:'ステージ12', answer:'18-QX'},
  {case:'追加調査12', answer:'2234'},
  {case:'ステージ13', answer:'/api/session_KS'},
  {case:'ステージ14', answer:'LBR04'},
  {case:'ステージ15', answer:'NOVA-17-03'}
];
app.post('/api/secret/answers',(req,res)=>{
  const submitted = crypto.createHash('sha256').update(String(req.body?.code ?? '').trim().toLowerCase()).digest('hex');
  if (!equalHash(submitted, ANSWER_LIST_KEY_HASH)) return jsonError(res,403,'コードが違います。');
  res.set('Cache-Control','no-store');
  res.set('Pragma','no-cache');
  return res.json({ok:true,title:'BLACKBOX 正解一覧',answers:ANSWER_LIST});
});

// Hidden stage-jump unlock: only the phrase hash is stored server-side.
const STAGE_JUMP_KEY_HASH = 'cffa22eb99d4f9ad190a58228e27e78be5432d97475e659ae1cc5f3ef40545e0';
app.post('/api/secret/stages',(req,res)=>{
  const submitted=crypto.createHash('sha256').update(String(req.body?.code ?? '').trim().toLowerCase()).digest('hex');
  if(!equalHash(submitted,STAGE_JUMP_KEY_HASH)) return jsonError(res,403,'コードが違います。');
  res.set('Cache-Control','no-store');
  return res.json({ok:true,stages:Array.from({length:15},(_,i)=>({stage:i+1,label:`ステージ ${String(i+1).padStart(2,'0')}`}))});
});
app.post('/api/secret/jump',(req,res)=>{
  const submitted=crypto.createHash('sha256').update(String(req.body?.code ?? '').trim().toLowerCase()).digest('hex');
  if(!equalHash(submitted,STAGE_JUMP_KEY_HASH)) return jsonError(res,403,'コードが違います。');
  const stage=Number(req.body?.stage);
  if(!Number.isInteger(stage)||stage<1||stage>15) return jsonError(res,400,'ステージ番号が不正です。');
  req.session.progress={stage,detour:null,tries:0};
  const room=req.session.roomCode&&rooms.get(req.session.roomCode);
  if(room&&room.mode==='team') room.progress={stage,detour:null,tries:0};
  res.set('Cache-Control','no-store');
  return res.json({ok:true,nextPath:`/stage${String(stage).padStart(2,'0')}.html`});
});


app.post('/api/rooms/create',(req,res)=>{
  const mode=String(req.body?.mode||'team');
  if (!['team','battle'].includes(mode)) return jsonError(res,400,'チームまたは対戦モードを選んでください。');
  const name=String(req.body?.name||'プレイヤー').trim().slice(0,20)||'プレイヤー';
  let code; do { code=crypto.randomBytes(3).toString('hex').toUpperCase(); } while(rooms.has(code));
  const room={code,mode,name,players:[],progress:{stage:1,detour:null,tries:0},winner:null,createdAt:Date.now()};
  rooms.set(code,room);
  req.session.roomCode=code; req.session.progress={stage:1,detour:null,tries:0};
  room.players.push({id:req.sessionID,name,progress:req.session.progress});
  res.json({ok:true,room:publicRoom(room)});
});
app.post('/api/rooms/join',(req,res)=>{
  const code=String(req.body?.code||'').trim().toUpperCase();
  const name=String(req.body?.name||'プレイヤー').trim().slice(0,20)||'プレイヤー';
  const room=rooms.get(code);
  if(!room) return jsonError(res,404,'ルームが見つかりません。コードを確認してください。');
  if(room.players.length>=8) return jsonError(res,409,'このルームは満員です（最大8人）。');
  if(room.players.some(p=>p.id===req.sessionID)) { req.session.roomCode=code; return res.json({ok:true,room:publicRoom(room)}); }
  req.session.roomCode=code; req.session.progress={stage:1,detour:null,tries:0};
  room.players.push({id:req.sessionID,name,progress:req.session.progress});
  res.json({ok:true,room:publicRoom(room)});
});
app.get('/api/rooms/current',(req,res)=>{
  const room=req.session.roomCode && rooms.get(req.session.roomCode);
  if(!room) return res.json({ok:true,room:null});
  res.set('Cache-Control','no-store'); res.json({ok:true,room:publicRoom(room),you:roomPlayer(req,room)?.name||'プレイヤー',progress:state(req)});
});
app.post('/api/rooms/leave',(req,res)=>{
  const code=req.session.roomCode, room=code&&rooms.get(code);
  if(room){room.players=room.players.filter(p=>p.id!==req.sessionID); if(!room.players.length) rooms.delete(code);}
  delete req.session.roomCode;
  res.json({ok:true});
});
app.get('/api/progress',(req,res)=>{ const p=state(req); res.set('Cache-Control','no-store'); res.json({ok:true,stage:p.stage,detour:p.detour,complete:p.stage>15}); });
app.post('/api/verify',(req,res)=>{
  const p=state(req); const stage=Number(req.body?.stage); const answer=normalize(req.body?.answer);
  res.set('Cache-Control','no-store');
  if (!Number.isInteger(stage) || stage!==p.stage || stage<1 || stage>15 || p.detour) return jsonError(res,409,'進行状態が一致しません。現在のステージを開き直してください。');
  if (answer.length<1 || answer.length>100) return jsonError(res,400,'回答を入力してください。');
  p.tries++;
  const expected=ANSWERS[String(stage)];
  if (!equalHash(digest(answer),expected)) return res.json({ok:false,message:'不正解です。記録をもう一度調査してください。'});
  const room=req.session.roomCode && rooms.get(req.session.roomCode);
  if (CHECKPOINTS.includes(stage)) { p.detour=stage; return res.json({ok:true,detour:true,nextPath:'/detour'+String(stage).padStart(2,'0')+'.html',message:'一次認証成功。別ページで調査を続けてください。'}); }
  p.stage=stage+1;
  if(room && room.mode==='battle' && p.stage>15 && !room.winner) room.winner=roomPlayer(req,room)?.name||'プレイヤー';
  const next=p.stage>15?'/complete.html':'/stage'+String(p.stage).padStart(2,'0')+'.html';
  return res.json({ok:true,detour:false,nextPath:next,message:room?.mode==='team'?'チームでステージを解除しました！':'認証成功'});
});
app.post('/api/verify-detour',(req,res)=>{
  const p=state(req); const checkpoint=Number(req.body?.checkpoint); const answer=normalize(req.body?.answer);
  res.set('Cache-Control','no-store');
  if (!p.detour || checkpoint!==p.detour || !CHECKPOINTS.includes(checkpoint)) return jsonError(res,409,'この調査ページはまだ解除されていません。');
  if (answer.length<1 || answer.length>100) return jsonError(res,400,'回答を入力してください。');
  p.tries++;
  if (!equalHash(digest(answer),DETOUR_ANSWERS[String(checkpoint)])) return res.json({ok:false,message:'照合失敗。関連ページをもう一度確認してください。'});
  p.stage=checkpoint+1; p.detour=null;
  const room=req.session.roomCode && rooms.get(req.session.roomCode); if(room && room.mode==='battle' && p.stage>15 && !room.winner) room.winner=roomPlayer(req,room)?.name||'プレイヤー';
  const next='/stage'+String(p.stage).padStart(2,'0')+'.html';
  return res.json({ok:true,nextPath:next,message:'URL照合成功。次のステージを解除しました。'});
});
app.post('/api/reset',(req,res)=>{ req.session.progress={stage:1,detour:null,tries:0}; res.set('Cache-Control','no-store'); res.json({ok:true}); });

// ステージURLの直接入力や detour の直アクセスをサーバー側で制限。
app.use((req,res,next)=>{
  const p=state(req); const stageMatch=req.path.match(/^\/stage(\d{2})\.html$/);
  const detourMatch=req.path.match(/^\/detour(\d{2})\.html$/);
  if (stageMatch) { const n=Number(stageMatch[1]); if (n!==p.stage || p.detour || n>15) return res.redirect('/index.html'); }
  if (detourMatch) { const n=Number(detourMatch[1]); if (p.detour!==n || !CHECKPOINTS.includes(n)) return res.redirect('/index.html'); }
  if (req.path==='/complete.html' && p.stage<=15) return res.redirect('/index.html');
  next();
});
app.use(express.static(path.join(__dirname),{extensions:['html'], etag:false, maxAge:0}));
app.get('/health',(req,res)=>res.json({ok:true,service:'BLACKBOX',stage:state(req).stage}));
app.get('*',(req,res)=>res.status(404).sendFile(path.join(__dirname,'404.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`BLACKBOX listening on ${PORT}`));

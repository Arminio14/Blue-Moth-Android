const $=id=>document.getElementById(id);
const CREATOR_KEY_HASH='073ac3b3c79c1d056284216f01ea4dd38dd1817e39e7f279bd3186420b8faf74';
const SYSTEMS=[['nes','NES'],['snes','SNES / Super Famicom'],['gb','Game Boy / Color'],['gba','Game Boy Advance'],['segaMD','Sega Mega Drive / Genesis'],['segaMS','Sega Master System'],['segaGG','Sega Game Gear'],['pce','PC Engine'],['n64','Nintendo 64'],['nds','Nintendo DS'],['psx','PlayStation 1']];
const SYS_EXT={nes:'nes',sfc:'snes',smc:'snes',gb:'gb',gbc:'gb',gba:'gba',md:'segaMD',gen:'segaMD',smd:'segaMD',gg:'segaGG',sms:'segaMS',pce:'pce',n64:'n64',z64:'n64',v64:'n64',nds:'nds',cue:'psx',pbp:'psx',chd:'psx'};
const enc=new TextEncoder();
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const unhex=h=>new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));
const sha256hex=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
async function pbkdf2(pw,salt){const k=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},k,256))}
const same=(a,b)=>{if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0};
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const uid=()=>crypto.randomUUID?crypto.randomUUID():hex(crypto.getRandomValues(new Uint8Array(16)));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){$('toast').textContent=m;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),3500)}
let user=null,items=[],filter='all',authMode='login',selectedGame=null;
const fails={};

/* Dateien (ROMs) in IndexedDB */
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('bluemoth',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function fileOp(mode,fn){const db=await idb();return new Promise((res,rej)=>{const t=db.transaction('files',mode);const r=fn(t.objectStore('files'));t.oncomplete=()=>res(r.result);t.onerror=()=>rej(t.error)})}

/* Konten (lokal auf dem Handy) */
const accounts=()=>load('bm_accounts',[]);
async function seed(){if(accounts().length)return;const salt=crypto.getRandomValues(new Uint8Array(16));save('bm_accounts',[{id:uid(),username:'mothy',salt:hex(salt),hash:await pbkdf2('blue777',salt)}])}
async function register(username,password){
  username=username.trim();
  if(!/^[\p{L}\p{N}_.-]{3,30}$/u.test(username))throw new Error('Benutzername: 3–30 Zeichen (Buchstaben, Zahlen, _ . -).');
  if(['creator','admin'].includes(username.toLowerCase()))throw new Error('Dieser Benutzername ist reserviert.');
  if(password.length<3)throw new Error('Das Passwort muss mindestens 3 Zeichen lang sein.');
  const a=accounts();if(a.some(x=>x.username.toLowerCase()===username.toLowerCase()))throw new Error('Dieser Benutzername ist schon vergeben.');
  const salt=crypto.getRandomValues(new Uint8Array(16));const acc={id:uid(),username,salt:hex(salt),hash:await pbkdf2(password,salt)};a.push(acc);save('bm_accounts',a);return acc}
async function login(username,password){
  const k=username.trim().toLowerCase(),f=fails[k]||{c:0,u:0};if(f.c>=5&&Date.now()<f.u)throw new Error('Zu viele Fehlversuche. Bitte warte 30 Sekunden.');
  const acc=accounts().find(x=>x.username.toLowerCase()===k);
  if(!acc||!acc.hash||!same(await pbkdf2(password,unhex(acc.salt)),acc.hash)){f.c++;if(f.c>=5)f.u=Date.now()+30000;fails[k]=f;throw new Error('Benutzername oder Passwort ist falsch.')}
  delete fails[k];return acc}
async function creatorLogin(file){
  const text=file?await file.text():'';if(!file||file.size>500)throw new Error('Kein gültiger Creator-Schlüssel.');
  const tok=text.trim().split(/\s+/).pop()||'';if(!same(await sha256hex(tok),CREATOR_KEY_HASH))throw new Error('Kein gültiger Creator-Schlüssel. Der Creator-Zugang ist nur für den Entwickler.');
  const a=accounts();let acc=a.find(x=>x.id==='creator-account');if(!acc){acc={id:'creator-account',username:'Creator',display:'Creator 👑'};a.push(acc);save('bm_accounts',a)}return acc}

/* Bibliothek */
const lib=()=>load('bm_lib_'+user.id,[]);const saveLib=()=>save('bm_lib_'+user.id,items);
const LABEL={web:'WEB-APP',game:'RETRO-SPIEL'},SYMBOL={web:'↗',game:'🎮'};
function render(){
  const shown=items.filter(x=>filter==='all'||x.kind===filter);
  $('count').textContent=`${items.length} ${items.length===1?'Eintrag':'Einträge'}`;$('empty').hidden=shown.length>0;
  $('grid').innerHTML=shown.map(x=>`<article class="card"><div class="symbol">${SYMBOL[x.kind]}</div><div class="kind">${LABEL[x.kind]}</div><h3>${esc(x.name)}</h3><p class="filename">${esc(x.filename||x.url||'')}</p><div class="cardActions"><button data-${x.kind==='game'?'game':'open'}="${x.id}" class="primary">${x.kind==='game'?'▶ Spielen':'Öffnen ↗'}</button><button data-delete="${x.id}" class="delete" title="Entfernen">×</button></div></article>`).join('')}
async function openUrl(url){const B=window.Capacitor?.Plugins?.Browser;if(B)await B.open({url});else window.open(url,'_blank')}
$('grid').addEventListener('click',async e=>{
  const o=e.target.closest('[data-open]'),d=e.target.closest('[data-delete]'),g=e.target.closest('[data-game]');
  try{
    if(o){const it=items.find(x=>x.id===o.dataset.open);await openUrl(it.url)}
    if(d&&confirm('Diesen Eintrag entfernen?')){const id=d.dataset.delete,it=items.find(x=>x.id===id);if(it?.kind==='game')await fileOp('readwrite',s=>s.delete(id));items=items.filter(x=>x.id!==id);saveLib();render();toast('Eintrag entfernt.')}
    if(g){selectedGame=g.dataset.game;const it=items.find(x=>x.id===selectedGame);$('gameName').textContent=it.filename||it.name;$('systemSelect').value=it.system||'';$('emulatorDialog').showModal()}
  }catch(err){toast(err.message||String(err))}});
$('addUrl').onclick=()=>$('urlDialog').showModal();
$('urlForm').onsubmit=e=>{e.preventDefault();try{const u=new URL($('urlValue').value);if(!['http:','https:'].includes(u.protocol))throw new Error('Nur http:// und https:// sind erlaubt.');items.unshift({id:uid(),name:$('urlName').value.trim(),kind:'web',url:u.href});saveLib();render();$('urlDialog').close();$('urlForm').reset();toast('Web-App hinzugefügt.')}catch(err){toast(err.message)}};
$('addUrlFile').onclick=()=>$('urlFileInput').click();
$('urlFileInput').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const m=/^URL=(.+)$/im.exec(await f.text());
  if(!/\.url$/i.test(f.name)||!m||!/^https?:\/\//i.test(m[1].trim()))return toast('Das ist keine gültige Internet-Verknüpfung (.url) mit http(s)-Adresse.');
  items.unshift({id:uid(),name:f.name.replace(/\.url$/i,''),kind:'web',url:new URL(m[1].trim()).href});saveLib();render();toast('Web-App hinzugefügt.')};
$('addGame').onclick=()=>$('romInput').click();
$('romInput').onchange=async e=>{const files=[...e.target.files];e.target.value='';let n=0;
  for(const f of files){const ext=f.name.split('.').pop().toLowerCase();if(['exe','msi','apk','lnk','bat'].includes(ext)){toast('EXE/Programme laufen auf dem Handy nicht: '+f.name);continue}
    const id=uid();await fileOp('readwrite',s=>s.put(f,id));items.unshift({id,name:f.name.replace(/\.[^.]+$/,''),kind:'game',filename:f.name,system:SYS_EXT[ext]||null});n++}
  if(n){saveLib();render();toast(n+' Spiel(e) hinzugefügt.')}};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('nav .tab').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('nav .tab').forEach(t=>t.classList.toggle('active',t===b));render()});
$('systemSelect').innerHTML='<option value="">Bitte System wählen …</option>'+SYSTEMS.map(([i,n])=>`<option value="${i}">${n}</option>`).join('');
$('playBuiltin').onclick=async()=>{
  const system=$('systemSelect').value;if(!system)return toast('Bitte zuerst das System auswählen.');
  const it=items.find(x=>x.id===selectedGame);it.system=system;saveLib();
  try{const blob=await fileOp('readonly',s=>s.get(it.id));if(!blob)throw new Error('Spieldatei nicht gefunden. Bitte neu hinzufügen.');
    const file=new File([blob],it.filename||'game',{type:'application/octet-stream'});
    $('emulatorDialog').close();$('emu').hidden=false;
    const DATA='https://cdn.emulatorjs.org/stable/data/';
    Object.assign(window,{EJS_player:'#game',EJS_core:system,EJS_gameUrl:URL.createObjectURL(file),EJS_gameName:it.name,EJS_pathtodata:DATA,EJS_startOnLoaded:true,EJS_color:'#2d83e6'});
    const s=document.createElement('script');s.src=DATA+'loader.js';s.onerror=()=>{$('game').textContent='Der Emulator konnte nicht geladen werden. Bitte Internetverbindung prüfen.'};document.body.appendChild(s)
  }catch(err){toast(err.message)}};
$('emuClose').onclick=()=>location.reload();

/* Anmeldung */
function setAuthMode(m){authMode=m;const r=m==='register';$('tabLogin').classList.toggle('active',!r);$('tabRegister').classList.toggle('active',r);$('pass2Row').hidden=!r;$('authPass2').required=r;$('authSubmit').textContent=r?'Konto erstellen':'Anmelden';$('authHint').textContent=r?'Erstelle dein Konto für dieses Handy.':'Melde dich an, um deine Bibliothek zu öffnen.';$('authMsg').textContent=''}
function enter(acc){user=acc;$('userName').textContent='👤 '+(acc.display||acc.username);items=lib();filter='all';document.querySelectorAll('nav .tab').forEach(t=>t.classList.toggle('active',t.dataset.filter==='all'));document.body.classList.remove('locked');render()}
$('tabLogin').onclick=()=>setAuthMode('login');$('tabRegister').onclick=()=>setAuthMode('register');
$('authForm').onsubmit=async e=>{e.preventDefault();$('authMsg').textContent='';const u=$('authUser').value,p=$('authPass').value;
  try{let acc;if(authMode==='register'){if(p!==$('authPass2').value)throw new Error('Die Passwörter stimmen nicht überein.');acc=await register(u,p)}else acc=await login(u,p);$('authForm').reset();enter(acc)}catch(err){$('authMsg').textContent=err.message}};
$('creatorBtn').onclick=()=>$('creatorInput').click();
$('creatorInput').onchange=async e=>{const f=e.target.files[0];e.target.value='';try{enter(await creatorLogin(f))}catch(err){$('authMsg').textContent=err.message}};
$('logout').onclick=()=>location.reload();
seed().then(()=>setAuthMode(accounts().length?'login':'register'));
setTimeout(()=>$('splash').classList.add('hide'),1500);

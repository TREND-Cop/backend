// Served at /docs. Reads /api/_routes, so it always matches the code.
export const DOCS_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trend API</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;700;800&display=swap">
<style>
:root{--bg:#EEF3F5;--panel:#fff;--ink:#14212B;--mute:#5B6B77;--line:#D5DEE3;--accent:#0F766E;--get:#1D6FB8;--post:#0F8A5F;--put:#B7791F;--delete:#C0392B;color-scheme:light}
@media(prefers-color-scheme:dark){:root{--bg:#10181D;--panel:#17222A;--ink:#E6EEF2;--mute:#92A3AE;--line:#2A3944;--accent:#3FC1B2;--get:#5AA9EC;--post:#46C28F;--put:#E0A94B;--delete:#EE7B6D;color-scheme:dark}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Figtree,system-ui,sans-serif}
code,pre,textarea,input{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}
header{position:sticky;top:0;z-index:5;background:var(--panel);border-bottom:1px solid var(--line);padding:12px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
header h1{margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}
.tok{flex:1;min-width:240px;display:flex;gap:8px}
input,textarea{width:100%;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:8px 10px}
input:focus,textarea:focus,button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
button{font:inherit;font-weight:700;cursor:pointer;border:0;border-radius:6px;padding:8px 14px;background:var(--accent);color:#fff}
button.ghost{background:transparent;color:var(--mute);border:1px solid var(--line)}
.wrap{display:grid;grid-template-columns:230px 1fr;gap:24px;max-width:1180px;margin:0 auto;padding:20px}
nav{position:sticky;top:76px;align-self:start;max-height:calc(100vh - 96px);overflow:auto}
nav a{display:flex;justify-content:space-between;color:var(--mute);text-decoration:none;padding:5px 10px;border-radius:6px;text-transform:capitalize}
nav a:hover{background:var(--panel);color:var(--ink)}
nav input{margin-bottom:10px}
.intro{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-bottom:22px}
.intro p{margin:.3em 0;color:var(--mute)}
h2{font-size:17px;margin:28px 0 10px;text-transform:capitalize}
.card{background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--mc);border-radius:8px;margin-bottom:8px}
.m-GET{--mc:var(--get)}.m-POST{--mc:var(--post)}.m-PUT{--mc:var(--put)}.m-DELETE{--mc:var(--delete)}
.head{width:100%;display:flex;gap:12px;align-items:center;text-align:left;background:none;color:var(--ink);padding:10px 14px;font-weight:500;flex-wrap:wrap}
.verb{color:var(--mc);font-weight:800;min-width:56px;font-family:ui-monospace,Menlo,monospace;font-size:13px}
.path{font-family:ui-monospace,Menlo,monospace;font-size:13px;font-weight:700}
.sum{color:var(--mute);flex:1;min-width:200px}
.pill{font-size:12px;border:1px solid var(--line);border-radius:99px;padding:1px 9px;color:var(--mute)}
.pill.lock{border-color:var(--mc);color:var(--mc)}
.body{display:none;padding:4px 14px 16px;border-top:1px solid var(--line)}
.card.open .body{display:block}
label{display:block;font-weight:700;margin:12px 0 4px;font-size:13px}
.row{display:flex;gap:8px;align-items:center}
textarea{min-height:130px;resize:vertical}
pre{margin:8px 0 0;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:10px;overflow:auto;max-height:340px;white-space:pre-wrap;word-break:break-word}
.status{font-weight:700;margin-top:12px}.ok{color:var(--post)}.err{color:var(--delete)}
.tabs{display:flex;gap:6px;margin-top:14px}
.hide{display:none}details{margin:8px 0}summary{cursor:pointer;font-weight:700}.intro code{background:var(--bg);padding:1px 5px;border-radius:4px}
@media(max-width:800px){.wrap{grid-template-columns:1fr}nav{display:none}}
</style></head><body>
<header>
  <h1>Trend API</h1>
  <div class="tok"><input id="base" aria-label="Base URL" style="max-width:260px"><input id="token" placeholder="Bearer token (filled in automatically after login or register)" aria-label="Token"><button class="ghost" id="clear">Clear</button></div>
</header>
<div class="wrap">
  <nav><input id="search" placeholder="Search routes" aria-label="Search routes"><div id="nav"></div></nav>
  <main>
    <div class="intro">
      <strong>How to use this page</strong>
      <p>1. Open <b>auth / register</b> or <b>login</b> and press Send. The token is saved here and used on every route after that.</p>
      <p>2. Open any route, fill the fields, press Send. Each route also shows a ready-to-copy fetch snippet for your frontend.</p>
      <p>3. Routes marked with a role (client, business, staff, admin) need a token from that kind of account. Staff tokens come from <b>auth / staff-login</b>.</p>
    </div>
    <div class="intro" id="gpanel">
      <strong>Continue with Google: how to implement and test</strong>
      <p>The frontend signs in with Google through Firebase, then sends the Firebase ID token to <b>POST /api/auth/google</b>. The API verifies it, creates the account if needed, and returns the normal Trend token.</p>
      <details><summary>Implementation guide</summary>
        <p><b>Setup (once).</b> Firebase console: Authentication, Sign-in method, turn on Google. Authentication, Settings, Authorized domains: add this site's domain. Put your Firebase project ID in <code>FIREBASE_PROJECT_ID</code> in wrangler.toml.</p>
        <p><b>Web build:</b></p>
        <pre>import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
const cred = await signInWithPopup(getAuth(), new GoogleAuthProvider());
const idToken = await cred.user.getIdToken();</pre>
        <p><b>Android and iOS (Expo):</b> use @react-native-google-signin/google-signin, then exchange its token with Firebase:</p>
        <pre>const { data } = await GoogleSignin.signIn();
const cred = GoogleAuthProvider.credential(data.idToken);
const user = (await signInWithCredential(getAuth(), cred)).user;
const idToken = await user.getIdToken();</pre>
        <p><b>Then call the API (both platforms):</b></p>
        <pre>const res = await fetch(API_URL + '/api/auth/google', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id_token: idToken, role: 'client' })  // 'business' for business sign-up
});
const { token, user, created } = await res.json();
// save token, then send it on every request: Authorization: Bearer token</pre>
        <p>Response: <code>200</code> for an existing account, <code>201</code> for a new one (<code>created: true</code>, so you can send new users to onboarding). Errors: <code>401</code> invalid token or unverified Google email.</p>
      </details>
      <label>Test it here: paste your Firebase web config (Project settings, Your apps)</label>
      <textarea id="gcfg" style="min-height:90px" spellcheck="false" placeholder='{"apiKey":"...","authDomain":"your-app.firebaseapp.com","projectId":"your-app"}'></textarea>
      <div class="row" style="margin-top:10px"><select id="grole" aria-label="Role for new accounts" style="background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:8px"><option>client</option><option>business</option></select><button id="gbtn">Continue with Google</button></div>
      <div class="status" id="gstat"></div>
    </div>
    <div id="routes"></div>
  </main>
</div>
<script>
(function(){
var NL=String.fromCharCode(10);
var base=document.getElementById('base'),tok=document.getElementById('token');
base.value=location.origin;tok.value=localStorage.getItem('trend_token')||'';
tok.addEventListener('input',function(){localStorage.setItem('trend_token',tok.value.trim())});
document.getElementById('clear').onclick=function(){tok.value='';localStorage.removeItem('trend_token')};
function h(t,a,k){var e=document.createElement(t);for(var x in a||{}){if(x==='class')e.className=a[x];else if(x==='text')e.textContent=a[x];else e.setAttribute(x,a[x])}(k||[]).forEach(function(c){e.appendChild(c)});return e}
function pretty(o){return JSON.stringify(o,null,2)}
function snippet(r,hasBody){
  var url='BASE'+r.path.replace(/:([A-Za-z_]+)/g,function(m,p){return '\${'+p+'}'});
  var hasP=/:[A-Za-z_]+/.test(r.path);
  var q=hasP?'\`'+url+'\`':"'"+url+"'";
  var s='const res = await fetch('+q+', {'+NL+"  method: '"+r.method+"',"+NL+"  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },";
  if(hasBody)s+=NL+'  body: JSON.stringify('+pretty(r.example).split(NL).join(NL+'  ')+'),';
  return s+NL+'});'+NL+'const data = await res.json();';
}
function card(r){
  var params=(r.path.match(/:[A-Za-z_]+/g)||[]).map(function(p){return p.slice(1)});
  var hasBody=!!r.example;
  var c=h('section',{class:'card m-'+r.method});
  var head=h('button',{class:'head','aria-expanded':'false'},[h('span',{class:'verb',text:r.method}),h('span',{class:'path',text:r.path}),h('span',{class:'sum',text:r.summary}),h('span',{class:'pill'+(r.auth==='-'?'':' lock'),text:r.auth==='-'?'public':r.auth})]);
  var body=h('div',{class:'body'});
  var pin={};
  params.forEach(function(p){body.appendChild(h('label',{text:'Path value: '+p}));pin[p]=h('input',{placeholder:p});body.appendChild(pin[p])});
  var qin=null;
  if(r.method==='GET'){body.appendChild(h('label',{text:'Query string (optional)'}));qin=h('input',{placeholder:'?status=pending&from=2026-01-01'});body.appendChild(qin)}
  var ta=null;
  if(hasBody){body.appendChild(h('label',{text:'JSON body'}));ta=h('textarea',{spellcheck:'false'});ta.value=pretty(r.example);body.appendChild(ta)}
  var fin=null;
  if(r.file){body.appendChild(h('label',{text:'File'}));fin=h('input',{type:'file'});body.appendChild(fin)}
  var send=h('button',{text:'Send'});var st=h('div',{class:'status'});var out=h('pre',{class:'hide'});
  var row=h('div',{class:'row',style:'margin-top:14px'},[send]);body.appendChild(row);body.appendChild(st);body.appendChild(out);
  var tabs=h('div',{class:'tabs'});var sn=h('button',{class:'ghost',text:'Show fetch snippet'});tabs.appendChild(sn);body.appendChild(tabs);
  var code=h('pre',{class:'hide'});code.textContent=snippet(r,hasBody);body.appendChild(code);
  sn.onclick=function(){code.classList.toggle('hide')};
  send.onclick=function(){
    var url=base.value.replace(/\\/$/,'')+r.path.replace(/:([A-Za-z_]+)/g,function(m,p){return encodeURIComponent(pin[p].value)});
    if(qin&&qin.value)url+=(qin.value.charAt(0)==='?'?'':'?')+qin.value;
    var o={method:r.method,headers:{}};
    if(tok.value.trim())o.headers.Authorization='Bearer '+tok.value.trim();
    if(fin){var f=fin.files[0];if(!f){st.className='status err';st.textContent='Choose a file first';return}var fd=new FormData();fd.append('file',f);o.body=fd}
    else if(ta){o.headers['Content-Type']='application/json';o.body=ta.value}
    st.className='status';st.textContent='Sending...';var t0=performance.now();
    fetch(url,o).then(function(res){return res.text().then(function(txt){
      var d;try{d=JSON.parse(txt)}catch(e){d=txt}
      st.className='status '+(res.ok?'ok':'err');st.textContent=res.status+' '+res.statusText+' - '+Math.round(performance.now()-t0)+' ms';
      out.classList.remove('hide');out.textContent=typeof d==='string'?d:pretty(d);
      if(d&&d.token){tok.value=d.token;localStorage.setItem('trend_token',d.token);st.textContent+=' - token saved'}
    })}).catch(function(e){st.className='status err';st.textContent='Network error: '+e.message});
  };
  head.onclick=function(){var o=c.classList.toggle('open');head.setAttribute('aria-expanded',o)};
  c.appendChild(head);c.appendChild(body);c._r=r;c._ta=ta;c._send=send;return c;
}
var gcfg=document.getElementById('gcfg'),gstat=document.getElementById('gstat');
gcfg.value=localStorage.getItem('trend_fb')||'';
function loadScript(src){return new Promise(function(ok,no){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=function(){no(new Error('Could not load '+src))};document.head.appendChild(s)})}
document.getElementById('gbtn').onclick=function(){
  var cfg;try{cfg=JSON.parse(gcfg.value)}catch(e){gstat.className='status err';gstat.textContent='Firebase config must be valid JSON';return}
  localStorage.setItem('trend_fb',gcfg.value);gstat.className='status';gstat.textContent='Opening Google...';
  var V='https://www.gstatic.com/firebasejs/10.12.2/';
  loadScript(V+'firebase-app-compat.js').then(function(){return loadScript(V+'firebase-auth-compat.js')}).then(function(){
    if(!firebase.apps.length)firebase.initializeApp(cfg);
    return firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
  }).then(function(r){return r.user.getIdToken()}).then(function(t){
    var c=window.__gcard;c._ta.value=pretty({id_token:t,role:document.getElementById('grole').value});
    c.classList.add('open');gstat.textContent='Got a Firebase token. Sending to /api/auth/google...';
    c._send.click();c.scrollIntoView({block:'center'});
  }).catch(function(e){gstat.className='status err';gstat.textContent=e.message+' (check the config and that this domain is in Firebase Authorized domains)'});
};
fetch('/api/_routes').then(function(x){return x.json()}).then(function(rs){
  var groups={},order=[];
  rs.forEach(function(r){var g=r.path.split('/')[2]||'root';if(!groups[g]){groups[g]=[];order.push(g)}groups[g].push(r)});
  var root=document.getElementById('routes'),nav=document.getElementById('nav'),cards=[];
  order.forEach(function(g){
    var hd=h('h2',{id:'g-'+g,text:g});root.appendChild(hd);
    nav.appendChild(h('a',{href:'#g-'+g},[h('span',{text:g}),h('span',{text:groups[g].length})]));
    groups[g].forEach(function(r){var c=card(r);root.appendChild(c);cards.push({c:c,r:r,hd:hd})});
  });
  cards.forEach(function(x){if(x.r.path==='/api/auth/google')window.__gcard=x.c});
  document.getElementById('search').addEventListener('input',function(e){
    var v=e.target.value.toLowerCase();
    cards.forEach(function(x){x.c.classList.toggle('hide',v&&(x.r.path+' '+x.r.summary+' '+x.r.method).toLowerCase().indexOf(v)<0)});
  });
});
})();
</script></body></html>`;

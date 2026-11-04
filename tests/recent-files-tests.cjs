// Recent files keep references and display metadata only, never configuration contents.
const assert=require('node:assert/strict'),R=require('../webview/recent_files.js');let checks=0;
function ok(v,m){checks++;assert.ok(v,m);}function eq(a,b,m){checks++;assert.deepEqual(a,b,m);}
function handle(name,body,options={}){const h={kind:'file',name,permission:options.permission||'granted',missing:false,
 async getFile(){if(h.missing)throw new Error('NotFoundError');return {name,size:body.length,text:async()=>body};},
 async isSameEntry(other){return other===h||other&&other.name===name&&other.folder===h.folder;},
 async queryPermission(){return h.permission;},async requestPermission(){h.asked=true;if(options.grant)h.permission='granted';return h.permission;}};h.folder=options.folder||'a';return h;}
(async()=>{
 let time=1000;const store=R.memoryStore(),picked=[];
 const local=new Map(),storage={getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)};
 const recent=R.create({store,storage,now:()=>time,picker:async options=>{picked.push(options);return [handle('core.conf','hostname core\n')];}});
 ok(recent.supported(),'supported with a store and a picker');
 ok(!R.create({store,picker:null}).supported(),'unsupported without a file picker');
 ok(!R.create({store:null,picker:async()=>[],storage:null}).supported(),'unsupported without storage');
 const chosen=await recent.choose(['.conf','.cfg','bad ext','.exp']);
 eq(picked[0].types[0].accept['text/plain'],['.conf','.cfg','.exp'],'picker receives only valid extensions');
 ok(picked[0].multiple&&picked[0].excludeAcceptAllOption===false,'multiple files and All files remain available');
 const a=chosen[0];time=2000;await recent.remember(a,{name:'core.conf',device:'CORE-SW1',vendor:'Cisco IOS / IOS-XE / NX-OS'});
 let list=await recent.list();eq(list.map(x=>[x.name,x.device,x.vendor,x.openedAt]),[['core.conf','CORE-SW1','Cisco IOS / IOS-XE / NX-OS',2000]],'remembered with display metadata');
 ok(list.every(x=>!('handle' in x)),'listing never exposes file handles');
 const raw=(await store.entries())[0];eq(Object.keys(raw).sort(),['device','id','name','openedAt','vendor'],'listed entries hold display metadata only');
 time=3000;await recent.remember(handle('core.conf','changed'),{name:'Core.conf',device:'core-sw1'});
 list=await recent.list();eq(list.length,1,'reopening the same file and device updates its entry instead of duplicating it');eq(list[0].openedAt,3000,'and moves it to the top');
 time=3500;await recent.remember(handle('core.conf','other',{folder:'b'}),{name:'core.conf',device:'BRANCH-SW1'});
 eq((await recent.list()).map(x=>x.device),['BRANCH-SW1','core-sw1'],'the same file name for another device is a separate entry, newest first');
 for(let i=0;i<15;i++){time=4000+i;await recent.remember(handle('site'+i+'.conf','x'),{name:'site'+i+'.conf'});}
 list=await recent.list();eq(list.length,R.LIMIT,'the list is limited');eq(list[0].name,'site14.conf','newest first');eq((await store.entries()).length,R.LIMIT,'older entries are deleted from storage');
 const opened=await recent.open(list[0].id);eq(await opened.file.text(),'x','opening reads the original file');
 const denied=handle('locked.conf','secret',{permission:'prompt'});time=9000;const deniedEntry=await recent.remember(denied,{name:'locked.conf'});
 await assert.rejects(recent.open(deniedEntry.id),/Permission to read locked\.conf was not granted/);checks++;ok(denied.asked,'permission is requested when needed');
 const allowed=handle('allowed.conf','ok',{permission:'prompt',grant:true});time=9100;const allowedEntry=await recent.remember(allowed,{name:'allowed.conf'});
 eq(await (await recent.open(allowedEntry.id)).file.text(),'ok','granted permission opens the file');
 const moved=handle('moved.conf','gone');time=9200;const movedEntry=await recent.remember(moved,{name:'moved.conf'});moved.missing=true;
 await assert.rejects(recent.open(movedEntry.id),/may have been moved, renamed or deleted/);checks++;
 await assert.rejects(recent.open('missing-id'),/no longer in the recent files list/);checks++;
 ok(await recent.remember({kind:'directory',name:'folder'},{})===null,'directories are ignored');
 await recent.remove(movedEntry.id);ok(!(await recent.list()).some(x=>x.id===movedEntry.id),'entries can be removed');
 await recent.clear();eq(await recent.list(),[],'the list can be cleared');
 await recent.remember(handle('a.conf','x'),{name:'a.conf'});await recent.destroy();eq(await recent.list(),[],'deleting stored data removes recent files');
 eq((await recent.remember(handle('long.conf','x'),{name:'n'.repeat(500),device:'d'.repeat(500)})).name.length,200,'display text is bounded');
 // An interrupted reopen turns the feature off instead of repeating the failure.
 time=10000;const crashing=await recent.remember(handle('crash.conf','x'),{name:'crash.conf'});
 const hang=R.create({store:{...store,handle:()=>new Promise(()=>{})},storage,now:()=>time,picker:async()=>[]});hang.open(crashing.id);await new Promise(r=>setTimeout(r,10));
 ok(local.get(R.PENDING_KEY)===crashing.id,'a reopen in progress is recorded');
 const restarted=R.create({store,storage,now:()=>time,picker:async()=>[]});
 ok(restarted.interrupted()&&!restarted.supported(),'after an interrupted reopen the feature is off');eq(await restarted.list(),[],'and nothing is listed or read');
 ok(await restarted.recover(),'recovery runs once');ok(!local.has(R.PENDING_KEY),'the marker is cleared');eq((await store.entries()).length,0,'stored references are removed');
 const fresh=R.create({store:R.memoryStore(),storage,picker:async()=>[]});ok(fresh.supported()&&!fresh.interrupted(),'the next start works normally');
 const pend=R.create({store:R.memoryStore(),storage,picker:async()=>[]});const e=await pend.remember(handle('ok.conf','fine'),{name:'ok.conf'});await pend.open(e.id);ok(!local.has(R.PENDING_KEY),'a completed reopen clears its marker');
 console.log(checks+' recent file checks passed');
})().catch(e=>{console.error(e);process.exit(1);});

// Recent files in a real browser. Part A uses real File System Access handles (origin
// private file system) in IndexedDB, served over HTTP because file:// pages cannot create
// private file handles. Listing must never read a stored handle back. Part B injects an
// in-memory store to drive reopening, removal and errors, because this headless Chromium
// stops the page when it deserializes a stored file handle.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const html=fs.readFileSync(path.resolve('webview/index.html'));
const config=name=>'version 15.2\nhostname '+name+'\ninterface GigabitEthernet1/0/1\n description Example port\n switchport access vlan 10\nvlan 10\n name USERS\n';
const files={'core-switch.conf':config('CORE-SW1'),'branch-switch.conf':config('BRANCH-SW1')};
(async()=>{
 const server=http.createServer((req,res)=>{if(req.url==='/'||req.url==='/index.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);}else{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 const welcome=page=>page.locator('.welcome [data-action="open-file"]');
 // Recent entries are written after the import completes; wait for the write before reloading.
 const saved=(page,count)=>page.waitForFunction(async n=>{try{const db=await new Promise((res,rej)=>{const r=indexedDB.open('config-inspector-recent-files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});if(!db.objectStoreNames.contains('entries')){db.close();return false;}const c=await new Promise(res=>{const g=db.transaction('entries').objectStore('entries').count();g.onsuccess=()=>res(g.result);});db.close();return c>=n;}catch(e){return false;}},count);
 try{
  // Part A: real handles and IndexedDB.
  let context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({files})=>{window.__nextPick=window.__nextPick||'core-switch.conf';window.showOpenFilePicker=async()=>{const dir=await navigator.storage.getDirectory(),name=window.__nextPick,h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write(files[name]);await w.close();return [h];};},{files});
  await page.goto(url);
  ok(await page.locator('.recent-files').count()===0,'no recent section before any file is opened');
  await welcome(page).click();await page.waitForFunction(()=>!document.querySelector('.welcome')&&document.body.innerText.includes('CORE-SW1'));
  ok(true,'the file picker opens and imports the chosen file');
  await saved(page,1);await page.reload();
  await page.locator('.recent-files').waitFor();
  const first=await page.locator('.recent-file-open').first().innerText();
  ok(first.includes('CORE-SW1')&&first.includes('core-switch.conf'),'after a reload the device and file name are listed: '+first);
  const stored=await page.evaluate(async()=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open('config-inspector-recent-files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
   const meta=await new Promise(res=>{const g=db.transaction('entries').objectStore('entries').getAll();g.onsuccess=()=>res(g.result);});
   const handles=await new Promise(res=>{const g=db.transaction('handles').objectStore('handles').count();g.onsuccess=()=>res(g.result);});return {meta,handles};});
  ok(stored.meta.length===1&&stored.handles===1,'one entry and one file reference are stored');
  ok(!/hostname|switchport|GigabitEthernet|USERS/.test(JSON.stringify(stored.meta)),'stored entries contain no configuration contents');
  await page.evaluate(()=>{window.__nextPick='branch-switch.conf';});await welcome(page).click();await page.waitForFunction(()=>document.body.innerText.includes('BRANCH-SW1'));
  await saved(page,2);await page.reload();await page.locator('.recent-files').waitFor();
  ok((await page.locator('.recent-file-open strong').allInnerTexts()).join()==='BRANCH-SW1,CORE-SW1','the newest file is listed first');
  ok(errors.length===0,errors.join('\n'));await context.close();

  // Part B: in-memory store with real File objects behind fake handles.
  context=await browser.newContext({viewport:{width:1280,height:900}});page=await context.newPage();errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({files})=>{window.__gone=new Set();const mk=name=>({kind:'file',name,queryPermission:async()=>'granted',getFile:async()=>{if(window.__gone.has(name))throw new DOMException('gone','NotFoundError');return new File([files[name]],name);}});
   window.__nextPick='core-switch.conf';window.showOpenFilePicker=async()=>[mk(window.__nextPick)];
   const entries=new Map(),handles=new Map();window.SWRecentFilesStore={entries:async()=>[...entries.values()].map(e=>({...e})),save:async(e,h)=>{entries.set(e.id,{...e});handles.set(e.id,h);},handle:async id=>handles.get(id),remove:async id=>{entries.delete(id);handles.delete(id);},clear:async()=>{entries.clear();handles.clear();},destroy:async()=>{entries.clear();handles.clear();}};},{files});
  await page.goto(url);
  const backToStart=async()=>{await page.locator('[data-remove-workspace]').first().click();await page.locator('.welcome').waitFor();};
  await welcome(page).click();await page.waitForFunction(()=>document.body.innerText.includes('CORE-SW1'));
  await backToStart();await page.locator('.recent-files').waitFor();
  await page.locator('.recent-file-open').first().click();await page.waitForFunction(()=>!document.querySelector('.welcome')&&document.body.innerText.includes('CORE-SW1'));
  ok(true,'a recent entry reopens the original file');
  await backToStart();await page.evaluate(()=>{window.__nextPick='branch-switch.conf';});await welcome(page).click();await page.waitForFunction(()=>document.body.innerText.includes('BRANCH-SW1'));
  await backToStart();ok((await page.locator('.recent-file-open strong').allInnerTexts()).join()==='BRANCH-SW1,CORE-SW1','both files are listed, newest first');
  await page.locator('.recent-file-remove').first().click();await page.waitForFunction(()=>document.querySelectorAll('.recent-file-open').length===1);
  ok((await page.locator('.recent-file-open strong').allInnerTexts()).join()==='CORE-SW1','an entry can be removed');
  await page.evaluate(()=>window.__gone.add('core-switch.conf'));await page.locator('.recent-file-open').first().click();
  await page.waitForFunction(()=>/moved, renamed or deleted/.test(document.getElementById('toast').textContent));ok(await page.locator('.welcome').count()===1,'a moved file shows a clear message and keeps the start screen');
  await page.locator('[data-action="recent-clear"]').click();await page.waitForFunction(()=>!document.querySelector('.recent-files'));ok(true,'the list can be cleared');
  ok(errors.length===0,errors.join('\n'));await context.close();

  // An interrupted reopen from a previous start turns the feature off with a notice.
  context=await browser.newContext();page=await context.newPage();await context.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('config-inspector-recent-pending','recent-x');sessionStorage.setItem('seeded','1');}window.showOpenFilePicker=async()=>[];});
  await page.goto(url);await page.waitForFunction(()=>/Recent files were turned off/.test(document.body.innerText));
  ok(await page.evaluate(()=>localStorage.getItem('config-inspector-recent-pending'))===null,'the interrupted marker is cleared after recovery');
  const chooser=page.waitForEvent('filechooser');await welcome(page).click();ok(await chooser,'after recovery the standard file chooser is used');
  await context.close();

  // Browsers without the File System Access picker keep the standard chooser.
  context=await browser.newContext();page=await context.newPage();await context.addInitScript(()=>{delete window.showOpenFilePicker;});
  await page.goto(url);const plain=page.waitForEvent('filechooser');await welcome(page).click();
  ok(await plain,'browsers without the file picker use the standard file chooser');ok(await page.locator('.recent-files').count()===0,'no recent section without picker support');
  await context.close();
  console.log(checks+' recent file browser checks passed');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

// Arranging the diagram (owner requests): Shift- or Ctrl-click selects several items, a Shift-drag keeps to the
// axis the drag started on, links are picked from a few pixels away (and light up first), devices get a size of
// their own or all together, the selection is placed beside another device with room for its links, and devices
// move to pages of their own with off-page references on the links between pages.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),zlib=require('node:zlib'),{demoSite}=require('./xlsx-writer.cjs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
function unzip(buf){const files={};let o=0;while(buf.readUInt32LE(o)===0x04034b50){const method=buf.readUInt16LE(o+8),size=buf.readUInt32LE(o+18),nl=buf.readUInt16LE(o+26),xl=buf.readUInt16LE(o+28),name=buf.slice(o+30,o+30+nl).toString(),data=buf.slice(o+30+nl+xl,o+30+nl+xl+size);files[name]=(method===8?zlib.inflateRawSync(data):data).toString();o+=30+nl+xl+size;}return files;}
const file=(name,buffer,type)=>({name,mimeType:type||'text/plain',buffer:Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer)});
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.DIAGRAM_SHOW_ALL=true;});
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles(file('example-site.xlsx',demoSite(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));await page.locator('.site-map').waitFor({timeout:15000});
  await page.locator('.nav-scroll [data-view="diagram"]').first().click();await page.locator('.diagram-scroll > svg').waitFor();
  await page.locator('[data-diagram-editmode]').first().click();await page.waitForTimeout(400);
  // Devices on the page (bounding boxes in drawing units) and their screen points.
  const devices=()=>page.evaluate(()=>[...document.querySelectorAll('.diagram-scroll [data-diagram-node]')].map(g=>{const b=g.getBBox(),r=g.getBoundingClientRect();return {key:g.getAttribute('data-diagram-node'),x:b.x,y:b.y,w:b.width,h:b.height,sx:r.left+r.width/2,sy:r.top+r.height/2,visible:r.width>0};}));
  const reveal=async key=>{await page.evaluate(k=>{const g=[...document.querySelectorAll('.diagram-scroll [data-diagram-node]')].find(x=>x.getAttribute('data-diagram-node')===k);g.scrollIntoView({block:'center',inline:'center'});},key);await page.waitForTimeout(150);return (await devices()).find(d=>d.key===key);};
  // A point on a device's body that is not a port or a line.
  const grip=async key=>page.evaluate(k=>{const g=[...document.querySelectorAll('.diagram-scroll [data-diagram-node]')].find(x=>x.getAttribute('data-diagram-node')===k),box=g.closest('.diagram-scroll').getBoundingClientRect();let r=g.getBoundingClientRect();if(r.top<box.top||r.bottom>box.bottom||r.left<box.left||r.right>box.right){g.scrollIntoView({block:'center',inline:'center'});r=g.getBoundingClientRect();}for(let fy=0.5;fy<0.95;fy+=0.08)for(let fx=0.06;fx<0.95;fx+=0.04){const x=r.left+r.width*fx,y=r.top+r.height*fy,e=document.elementFromPoint(x,y);if(e&&g.contains(e)&&!e.closest('[data-port]'))return {x,y};}return {x:r.left+r.width/2,y:r.top+r.height/2};},key);
  const sel=()=>page.evaluate(()=>[...document.querySelectorAll('.diagram-scroll .selected')].map(g=>g.getAttribute('data-diagram-node')||g.getAttribute('data-diagram-ep')));
  const edits=()=>page.evaluate(()=>{const all=JSON.parse(localStorage.getItem('config-inspector-diagram-edits')||'{}');return Object.values(all)[0]||{};});
  let devs=await devices();ok(devs.length>=3,'the example site has devices to arrange: '+devs.length);
  const [A,B,C]=devs.slice().sort((p,q)=>p.y-q.y||p.x-q.x);
  // Shift-click adds to the selection; Shift-click again (without moving) takes it out; Ctrl-click adds too.
  let p=await grip(A.key);await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);
  p=await grip(B.key);await page.keyboard.down('Shift');await page.mouse.click(p.x,p.y);await page.keyboard.up('Shift');await page.waitForTimeout(200);
  ok((await sel()).length===2,'Shift-click selects a second device: '+(await sel()).join(', '));
  ok(/2 selected/.test(await page.locator('.diagram-arrangebar').innerText()),'the edit bar counts the selection');
  p=await grip(B.key);await page.keyboard.down('Shift');await page.mouse.click(p.x,p.y);await page.keyboard.up('Shift');await page.waitForTimeout(200);
  ok((await sel()).length===1,'Shift-clicking a selected device takes it out of the selection');
  p=await grip(C.key);await page.keyboard.down('Control');await page.mouse.click(p.x,p.y);await page.keyboard.up('Control');await page.waitForTimeout(200);
  ok((await sel()).length===2,'Ctrl-click adds to the selection as well');
  // Shift-drag keeps to the axis the drag started on (horizontal here), even when the pointer then wanders.
  await page.mouse.click(5,5);
  const a0=await reveal(A.key);p=await grip(A.key);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.keyboard.down('Shift');
  await page.mouse.move(p.x+12,p.y+2,{steps:3});await page.mouse.move(p.x+40,p.y+70,{steps:6});
  ok(await page.locator('.snap-guide').count()>0,'a guide shows the axis the Shift-drag keeps to');
  await page.mouse.move(p.x+60,p.y+90,{steps:4});await page.mouse.up();await page.keyboard.up('Shift');await page.waitForTimeout(600);
  let mv=(await edits()).moves||{};ok(mv[A.key]&&mv[A.key][0]>0&&mv[A.key][1]===0,'the Shift-drag moved the device sideways only: '+JSON.stringify(mv[A.key]));
  const a1=(await devices()).find(d=>d.key===A.key);ok(Math.abs(a1.y-a0.y)<0.5&&a1.x>a0.x,'its height on the page is unchanged');
  // The same drag started vertically keeps to the vertical.
  p=await grip(A.key);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.keyboard.down('Shift');await page.mouse.move(p.x+1,p.y+14,{steps:3});await page.mouse.move(p.x+80,p.y+40,{steps:6});await page.mouse.up();await page.keyboard.up('Shift');await page.waitForTimeout(600);
  const m2=(await edits()).moves[A.key];ok(m2[0]===mv[A.key][0]&&m2[1]>0,'a Shift-drag that starts downward moves only down: '+JSON.stringify(m2));
  await page.locator('[data-diagram-undo]').click();await page.waitForTimeout(400);await page.locator('[data-diagram-undo]').click();await page.waitForTimeout(500);
  // Links are picked from a few pixels away, and light up when the pointer is near.
  const L=await page.evaluate(()=>{const svg=document.querySelector('.diagram-scroll svg.diagram-svg');for(const pl of svg.querySelectorAll('polyline[data-line]')){const r=pl.getAttribute('data-route').trim().split(/\s+/).map(q=>q.split(',').map(Number));for(let i=1;i<r.length-2;i++){const a=r[i],b=r[i+1];if(a[1]===b[1]&&Math.abs(a[0]-b[0])>=60)return {key:pl.getAttribute('data-line'),x:(a[0]+b[0])/2,y:a[1]};}}return null;});
  ok(L,'a link with a horizontal stretch');
  await page.evaluate(k=>{[...document.querySelectorAll('.diagram-scroll polyline[data-line]')].find(x=>x.getAttribute('data-line')===k).scrollIntoView({block:'center',inline:'center'});},L.key);await page.waitForTimeout(200);
  const near=await page.evaluate(([x,y])=>{const svg=document.querySelector('.diagram-scroll svg.diagram-svg'),m=svg.getScreenCTM(),q=svg.createSVGPoint();q.x=x;q.y=y;const s=q.matrixTransform(m);return {x:s.x,y:s.y+9};},[L.x,L.y]);
  await page.mouse.move(near.x,near.y);await page.waitForTimeout(150);await page.mouse.move(near.x+1,near.y);await page.waitForTimeout(150);
  ok(await page.locator('.diagram-scroll polyline.line-hover').count()===1,'the link 9 px away lights up before the click');
  await page.mouse.click(near.x,near.y);await page.waitForTimeout(300);ok(await page.locator('.line-handles').count()===1,'and a click there selects it');
  await page.keyboard.press('Escape');await page.waitForTimeout(150);
  // Size: with nothing selected the control sizes every device; with a selection, only those.
  await page.mouse.click(5,5);await page.waitForTimeout(100);
  ok(/all devices/.test(await page.locator('.diagram-arrangebar').innerText())&&(await page.locator('[data-diagram-size="0"]').innerText()).trim()==='100%','with nothing selected the size control is for every device, at 100%');
  const w0=(await devices()).reduce((s,d)=>s+d.w,0);await page.locator('[data-diagram-size="1"]').click();await page.waitForTimeout(800);
  ok(Math.abs(((await edits()).scaleAll||0)-1.1)<0.001&&(await page.locator('[data-diagram-size="0"]').innerText()).trim()==='110%','+ makes every device 10% larger');
  const w1=(await devices()).reduce((s,d)=>s+d.w,0);ok(w1>w0*1.05,'the drawings grow: '+Math.round(w0)+' -> '+Math.round(w1));
  await page.locator('[data-diagram-size="0"]').click();await page.waitForTimeout(800);ok(!(await edits()).scaleAll,'100% returns every device to its original size');
  const b0=await reveal(B.key);p=await grip(B.key);await page.mouse.click(p.x,p.y);await page.waitForTimeout(200);
  for(let i=0;i<3;i++){await page.locator('[data-diagram-size="1"]').click();await page.waitForTimeout(700);}
  const e3=await edits();ok(e3.scale&&Math.abs(e3.scale[B.key]-1.3)<0.001&&!e3.scaleAll,'with a device selected only its size changes: '+JSON.stringify(e3.scale));
  const b1=(await devices()).find(d=>d.key===B.key);ok(b1.w>b0.w*1.2,'the selected device is drawn larger: '+Math.round(b0.w)+' -> '+Math.round(b1.w));
  ok(/130%/.test(await page.locator('[data-diagram-size="0"]').innerText()),'the control shows its size');
  // Lines still end on the scaled device's ports.
  const ends=await page.evaluate(k=>{const out=[];document.querySelectorAll('.diagram-scroll polyline[data-line]').forEach(pl=>{const key=pl.getAttribute('data-line');if(key.indexOf(k+'|')<0)return;out.push(key);});return out.length;},B.key);ok(ends>0,'the scaled device keeps its links');
  for(let i=0;i<12;i++){if(await page.locator('[data-diagram-size="-1"]').isDisabled())break;await page.locator('[data-diagram-size="-1"]').click();await page.waitForTimeout(500);}
  const small=(await devices()).find(d=>d.key===B.key);ok(small.w<b0.w,'it can be made smaller than its original size: '+Math.round(small.w));
  await page.locator('[data-diagram-size="0"]').click();await page.waitForTimeout(700);ok(!((await edits()).scale||{})[B.key],'100% puts it back');
  // Place beside: the selection goes left of the clicked device, centred on it, with room for its links.
  const c0=await reveal(C.key);p=await grip(C.key);await page.mouse.click(p.x,p.y);await page.waitForTimeout(200);
  await page.locator('[data-diagram-place="left"]').click();await page.waitForTimeout(150);
  ok(await page.locator('.diagram-scroll.placing').count()===1&&/Click the device/.test(await page.locator('.diagram-arrangebar').innerText()),'Left of asks for the device to place it beside');
  const bnow=await reveal(B.key);p=await grip(B.key);await page.mouse.click(p.x,p.y);await page.waitForTimeout(900);
  const after=await devices(),cA=after.find(d=>d.key===C.key),bA=after.find(d=>d.key===B.key);
  ok(cA.x+cA.w<=bA.x-36,'the device now sits left of the other with room for links: '+Math.round(cA.x+cA.w)+' < '+Math.round(bA.x));
  ok(Math.abs((cA.y+cA.h/2)-(bA.y+bA.h/2))<=40,'centred on it: '+Math.round(cA.y+cA.h/2)+' / '+Math.round(bA.y+bA.h/2));
  ok(after.every(d=>d.key===C.key||d.x>=cA.x+cA.w||d.x+d.w<=cA.x||d.y>=cA.y+cA.h||d.y+d.h<=cA.y),'and overlaps no other device');
  // Below, by the device's right-click menu.
  p=await grip(C.key);await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);const bb=await reveal(B.key);p=await grip(B.key);await page.mouse.click(p.x,p.y,{button:'right'});await page.waitForTimeout(200);
  ok(await page.locator('[data-dev-ctx="down"]').count()===1&&await page.locator('[data-dev-ctx="page"]').count()===1,'right-clicking a device offers placing, size and page');
  await page.locator('[data-dev-ctx="down"]').click();await page.waitForTimeout(900);
  const after2=await devices(),cB=after2.find(d=>d.key===C.key),bB=after2.find(d=>d.key===B.key);ok(cB.y>=bB.y+bB.h+36,'the device now sits below the other: '+Math.round(cB.y)+' > '+Math.round(bB.y+bB.h));
  ok(Math.abs((cB.x+cB.w/2)-(bB.x+bB.w/2))<=40,'centred under it');
  await page.locator('[data-diagram-reset]').click();await page.waitForTimeout(700);
  // Pages: a device moved to a new page leaves the main page; links between the pages end at off-page references.
  const c1=await reveal(C.key);p=await grip(C.key);await page.mouse.click(p.x,p.y);await page.waitForTimeout(200);
  await page.locator('[data-diagram-topage]').click();await page.waitForTimeout(200);ok(await page.locator('[data-to-page="2"]').count()===1,'Move to page offers a new page');
  await page.locator('[data-to-page="2"]').click();await page.waitForTimeout(900);
  ok(!(await devices()).some(d=>d.key===C.key),'the device left the main page');
  const refs=await page.evaluate(()=>[...document.querySelectorAll('.diagram-scroll svg text')].map(t=>t.textContent).filter(t=>/See page 2/.test(t)));ok(refs.length>=1,'its links end at off-page references naming page 2: '+refs.length);
  const tab=page.locator('[data-diagram-tab="1"]');ok(/^Page 2/.test((await tab.innerText()).trim()),'a Page 2 tab follows the main page: '+(await tab.innerText()).trim());
  await tab.click();await page.waitForTimeout(600);
  ok((await devices()).some(d=>d.key===C.key),'page 2 shows the device');
  ok(await page.evaluate(()=>[...document.querySelectorAll('.diagram-scroll svg text')].some(t=>/See page 1/.test(t.textContent))),'and references back to page 1');
  ok(await page.locator('.diagram-editing').count()===1&&await page.locator('.diagram-arrangebar').count()===1,'page 2 can be edited too');
  // Downloads carry the page; Visio page names stay unique.
  const [v]=await Promise.all([page.waitForEvent('download'),page.locator('[data-diagram-export="vsdx"]').first().click()]),vf=unzip(fs.readFileSync(await v.path())),names=[...vf['visio/pages/pages.xml'].matchAll(/<Page [^>]*? NameU="([^"]+)"/g)].map(m=>m[1]);
  ok(names.some(n=>/^Page 2/.test(n))&&new Set(names).size===names.length,'the Visio download has the page, names unique: '+names.join(' | '));
  // Back to page 1: the device returns.
  p=await grip(C.key);await page.mouse.click(p.x,p.y);await page.waitForTimeout(200);await page.locator('[data-diagram-topage]').click();await page.waitForTimeout(200);await page.locator('[data-to-page="1"]').click();await page.waitForTimeout(900);
  if(await page.locator('[data-diagram-tab="0"]').count()){await page.locator('[data-diagram-tab="0"]').click();await page.waitForTimeout(500);}
  ok((await devices()).some(d=>d.key===C.key)&&!(await page.locator('.diagram-tab').allInnerTexts()).some(t=>/^Page 2/.test(t.trim())),'moved back, the device is on the main page and page 2 is gone');
  // Faceplates (a device and those below it): the same tools on drawn front panels.
  if(await page.locator('[data-diagram-reset]').isEnabled()){await page.locator('[data-diagram-reset]').click();await page.waitForTimeout(500);}await page.locator('[data-diagram-editmode]').first().click();await page.waitForTimeout(300);
  await page.evaluate(k=>{const g=[...document.querySelectorAll('.diagram-scroll [data-diagram-node]')].find(x=>x.getAttribute('data-diagram-node')===k);g.scrollIntoView({block:'center'});g.dispatchEvent(new MouseEvent('click',{bubbles:true}));},A.key);await page.waitForTimeout(900);
  await page.locator('[data-diagram-editmode]').first().click();await page.waitForTimeout(400);
  const plates=await devices();ok(plates.length>=2&&await page.evaluate(n=>document.querySelectorAll('.diagram-scroll [data-diagram-node] rect').length>n*10,plates.length),'a faceplate drawing: '+plates.length+' devices');
  const low=plates.slice().sort((p,q)=>q.y-p.y)[0],lw=low.w;p=await grip(low.key);await page.mouse.click(p.x,p.y);await page.waitForTimeout(200);
  await page.locator('[data-diagram-size="1"]').click();await page.waitForTimeout(900);await page.locator('[data-diagram-size="1"]').click();await page.waitForTimeout(900);
  const big=(await devices()).find(d=>d.key===low.key);ok(big&&big.w>lw*1.12,'a faceplate grows with its size: '+Math.round(lw)+' -> '+Math.round(big.w));
  ok(await page.evaluate(k=>[...document.querySelectorAll('.diagram-scroll polyline[data-line]')].some(pl=>pl.getAttribute('data-line').indexOf(k+'|')>=0),low.key),'its links still reach it');
  p=await grip(low.key);await page.mouse.click(p.x,p.y);await page.waitForTimeout(200);await page.locator('[data-diagram-topage]').click();await page.waitForTimeout(200);await page.locator('[data-to-page="2"]').click();await page.waitForTimeout(1200);
  ok(await page.evaluate(()=>[...document.querySelectorAll('.diagram-scroll [data-diagram-ep] text')].some(t=>/See page 2/.test(t.textContent))),'on faceplates the link ends at an off-page reference beside the port');
  const t2=page.locator('.diagram-tab',{hasText:/^Page 2/});await t2.click();await page.waitForTimeout(700);ok((await devices()).some(d=>d.key===low.key)&&await page.evaluate(()=>[...document.querySelectorAll('.diagram-scroll [data-diagram-ep] text')].some(t=>/See page 1/.test(t.textContent))),'page 2 has the device (still at its size) and a reference back');
  ok(Math.abs((await devices()).find(d=>d.key===low.key).w-big.w)<1,'the device keeps its size on its new page');
  ok(!errors.length,'no page errors: '+errors.join('; '));
  console.log(checks+' diagram arranging browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

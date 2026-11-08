// Link editing like NetworkDiagramStudio's, and paper sizes (owner requests): a selected link shows its
// bends, port ends and + buttons; bends are selected, dragged with snap guides, removed with Delete,
// nudged with the arrow keys and edited as numbers; the route resets. The paper size lays out the
// drawing and its downloads.
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
  await page.goto('file://'+path.resolve('webview/index.html')+'?labs=diagram');
  await page.locator('#import-file').setInputFiles(file('example-site.xlsx',demoSite(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));await page.locator('.site-map').waitFor({timeout:15000});
  await page.locator('.nav-scroll [data-view="diagram"]').first().click();await page.locator('.diagram-scroll > svg').waitFor();
  await page.locator('[data-diagram-editmode]').first().click();await page.waitForTimeout(400);
  // A link with a middle stretch long enough for a + button.
  const pick=async()=>page.evaluate(()=>{const svg=document.querySelector('.diagram-scroll svg.diagram-svg');for(const pl of svg.querySelectorAll('polyline[data-line]')){const r=pl.getAttribute('data-route').trim().split(/\s+/).map(q=>q.split(',').map(Number));for(let i=1;i<r.length-2;i++){const a=r[i],b=r[i+1];if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])>=60)return {key:pl.getAttribute('data-line'),route:r,i};}}return null;});
  const screen=async(x,y)=>page.evaluate(([x,y])=>{const svg=document.querySelector('.diagram-scroll svg.diagram-svg'),m=svg.getScreenCTM(),p=svg.createSVGPoint();p.x=x;p.y=y;const s=p.matrixTransform(m);return {x:s.x,y:s.y};},[x,y]);
  const route=async key=>page.evaluate(k=>{const pl=[...document.querySelectorAll('.diagram-scroll polyline[data-line]')].find(x=>x.getAttribute('data-line')===k);return pl&&pl.getAttribute('data-route').trim().split(/\s+/).map(q=>q.split(',').map(Number));},key);
  const L=await pick();ok(L,'a link with a middle stretch to edit');
  await page.evaluate(k=>{const pl=[...document.querySelectorAll('.diagram-scroll polyline[data-line]')].find(x=>x.getAttribute('data-line')===k);pl.scrollIntoView({block:'center',inline:'center'});},L.key);await page.waitForTimeout(200);
  const a=L.route[L.i],b=L.route[L.i+1],mid=await screen((a[0]+b[0])/2+(a[1]===b[1]?Math.sign(b[0]-a[0])*20:0),(a[1]+b[1])/2+(a[0]===b[0]?Math.sign(b[1]-a[1])*20:0));
  await page.mouse.click(mid.x,mid.y);await page.waitForTimeout(250);
  ok(await page.locator('.line-handles').count()===1,'clicking a link selects it and shows its handles');
  ok(await page.locator('.line-handles .line-bend').count()===L.route.length-2&&await page.locator('.line-handles .line-end').count()===2,'a square for each bend and a fixed dot on each port end');
  ok(await page.locator('.line-handles [data-add-seg]').count()>=1,'a + on each longer middle stretch');
  ok(/Drag a square to move a bend/.test(await page.locator('.diagram-line-info').innerText())&&await page.locator('[data-line-points]').isEnabled(),'the edit bar names the selection and offers its tools');
  // + adds four points (a rectangular bump).
  const before=(await route(L.key)).length;await page.locator('.line-handles [data-add-seg]').first().click();await page.waitForTimeout(500);
  ok((await route(L.key)).length===before+4,'+ adds bends to the stretch: '+before+' -> '+(await route(L.key)).length);
  ok(await page.locator('.line-handles').count()===1,'the link stays selected after the edit');
  // Select a bend: Delete removes it, the arrow keys nudge it.
  const r1=await route(L.key);await page.locator('.line-handles [data-bend="2"]').click();await page.waitForTimeout(250);
  ok(await page.locator('.line-handles .line-bend.selected').count()===1&&/Bend 2 selected/.test(await page.locator('.diagram-line-info').innerText()),'clicking a bend square selects it');
  const bx=r1[2][0];await page.keyboard.press('ArrowRight');await page.waitForTimeout(500);const r2=await route(L.key);
  ok(r2.some(q=>Math.abs(q[0]-(bx+9))<0.01&&Math.abs(q[1]-r1[2][1])<0.01),'the right arrow nudges the bend one grid step');
  ok(r2.every((q,i)=>!i||q[0]===r2[i-1][0]||q[1]===r2[i-1][1]),'the route stays at right angles');
  const n2=r2.length,pick1=page.locator('.line-handles .line-bend').nth(1);await pick1.dispatchEvent('pointerdown',{button:0,bubbles:true});await pick1.dispatchEvent('pointerup',{button:0,bubbles:true});await page.waitForTimeout(200);ok(await page.locator('.line-handles .line-bend.selected').count()===1,'another bend can be selected');await page.keyboard.press('Delete');await page.waitForTimeout(500);
  ok((await route(L.key)).length<n2,'Delete removes the selected bend');
  // Edit bend points as numbers.
  await page.locator('[data-line-points]').click();await page.locator('.bend-table').waitFor();const r3=await route(L.key);
  ok(await page.locator('.bend-table tbody tr').count()===r3.length&&await page.locator('[data-bend-x="0"]').isDisabled(),'the bend table lists every point, with the port ends attached');
  const y1=r3[1][1];await page.locator('[data-bend-y="1"]').fill(String(y1+18));await page.locator('[data-bend-y="1"]').dispatchEvent('change');await page.waitForTimeout(150);await page.locator('[data-bend-save]').click();await page.waitForTimeout(500);
  const r4=await route(L.key);ok(r4.some(q=>Math.abs(q[1]-(y1+18))<0.01)&&r4.every((q,i)=>!i||q[0]===r4[i-1][0]||q[1]===r4[i-1][1]),'a bend moved by number keeps the link at right angles');
  // Dragging a bend shows a snap guide when it lines up with another link or device.
  const sel=await route(L.key),bi=1,p0=await screen(sel[bi][0],sel[bi][1]);await page.locator('.line-handles [data-bend="'+bi+'"]').dispatchEvent('pointerdown',{button:0,clientX:p0.x,clientY:p0.y,bubbles:true});
  let guided=false;for(let s=1;s<=30&&!guided;s++){await page.mouse.move(p0.x+s*6,p0.y+s*3);guided=await page.locator('.snap-guide').count()>0;}
  await page.mouse.up();await page.waitForTimeout(400);ok(guided,'a snap guide shows while a dragged bend lines up with another link or device');ok(await page.locator('.snap-guide').count()===0,'and goes when the drag ends');
  // Reset route, Escape.
  await page.locator('[data-line-reset]').click();await page.waitForTimeout(500);ok(JSON.stringify(await route(L.key))===JSON.stringify(L.route),'Reset route puts the automatic route back');
  await page.keyboard.press('Escape');await page.waitForTimeout(200);ok(await page.locator('.line-handles').count()===0,'Escape clears the link selection');
  await page.locator('[data-diagram-editmode]').first().click();await page.waitForTimeout(300);
  // Paper size: the chip, the Visio page size and the printable page follow it.
  const chip=()=>page.locator('.diagram-paper').first().innerText();ok(/^Fit to drawing, [\d.]+ × [\d.]+ in$/.test(await chip()),'the page fits the drawing by default (as Visio does): '+await chip());
  // Fit to drawing: the Visio page is the drawing's own size, not a sheet.
  {const [v0]=await Promise.all([page.waitForEvent('download'),page.locator('[data-diagram-export="vsdx"]').first().click()]),f0=unzip(fs.readFileSync(await v0.path())),w0=[...f0['visio/pages/pages.xml'].matchAll(/<Cell N="PageWidth" V="([\d.]+)"/g)].map(m=>+m[1]),m0=(await chip()).match(/([\d.]+) × ([\d.]+)/);
   ok(w0.length&&Math.abs(w0[0]-Number(m0[1]))<0.06,'the Visio page is the fitted size: '+w0[0]+' in for '+m0[0]);}
  const docPop=async()=>{for(let t=0;t<3&&!await page.locator('[data-diagram-pop="document"][open]').count();t++){await page.locator('[data-diagram-pop="document"] summary').click();await page.waitForTimeout(200);}};await docPop();await page.locator('[data-diagram-pop="document"] #diagram-paper').selectOption('a3');await page.waitForTimeout(600);
  ok(/^A3, /.test(await chip()),'the paper chip follows the chosen size: '+await chip());
  const [v]=await Promise.all([page.waitForEvent('download'),page.locator('[data-diagram-export="vsdx"]').first().click()]),vf=unzip(fs.readFileSync(await v.path())),pw=[...vf['visio/pages/pages.xml'].matchAll(/<Cell N="PageWidth" V="([\d.]+)"/g)].map(m=>+m[1]);
  ok(pw.length&&pw.every(w=>Math.abs(w-16.54)<0.02||Math.abs(w-11.69)<0.02),'Visio pages are A3: '+pw.join(', '));
  await docPop();await page.locator('[data-diagram-pop="document"] #diagram-orient').selectOption('portrait');await page.waitForTimeout(600);ok(/^A3, portrait/.test(await chip()),'a chosen orientation is used: '+await chip());
  await docPop();await page.locator('[data-diagram-pop="document"] #diagram-paper').selectOption('letter');await page.waitForTimeout(400);ok(/^Letter, /.test(await chip()),'a print size can still be chosen: '+await chip());
  await docPop();await page.locator('[data-diagram-pop="document"] #diagram-paper').selectOption('fit');await docPop();await page.locator('[data-diagram-pop="document"] #diagram-orient').selectOption('auto');await page.waitForTimeout(400);
  ok(!errors.length,'no page errors: '+errors.join('; '));
  console.log(checks+' link editing and paper size browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

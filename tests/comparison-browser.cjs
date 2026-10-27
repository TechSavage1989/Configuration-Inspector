const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;const metrics=[];function ok(value,message){checks++;assert.ok(value,message);}
const timeout={timeout:5000};
function configuration(revision){return 'version 15.2\nhostname Example-Comparison\n'+Array.from({length:65},(_,i)=>`interface GigabitEthernet1/0/${i+1}\n description Example ${revision} port ${i+1} ${'long-configuration-value-'.repeat(8)}\n switchport access vlan 10\n switchport mode access\n speed auto\n duplex auto\n mtu 1500\n spanning-tree portfast\n spanning-tree bpduguard enable\n storm-control broadcast level 10.00\n storm-control multicast level 10.00\n storm-control unicast level 10.00\n logging event link-status\n load-interval 30\n no shutdown\n exit\n`).join('');}
function stateConfiguration(right){return `version 15.2\nhostname Example-States\nusername reader privilege 1 secret TEST_SECRET_ONLY_${right?'NEW':'OLD'}\ninterface GigabitEthernet1/0/1\n description unchanged port\n exit\ninterface GigabitEthernet1/0/2\n description ${right?'after':'before'} port\n exit\ninterface GigabitEthernet1/0/${right?4:3}\n description ${right?'added':'removed'} port\n exit\n`;}
function upload(name,text){return {name,mimeType:'text/plain',buffer:Buffer.from(text)};}
async function openComparison(page,left,right){
 await page.goto('file://'+path.resolve('webview/index.html'));
 await page.locator('[data-view="compare"]').first().click();
 await page.locator('#compare-left-file').setInputFiles(upload('example-left.conf',left));
 await page.locator('#modal').waitFor({state:'hidden'});
 await page.locator('#compare-file').setInputFiles(upload('example-right.conf',right));
 await page.locator('#modal').waitFor({state:'hidden'});
 await page.locator('.comparison-card').first().waitFor();
}
async function layout(page,label,resultSelector){
 const data=await page.evaluate(({label,resultSelector})=>{
  const content=document.querySelector('#content'),result=document.querySelector(resultSelector),rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
  return {label,viewport:{width:innerWidth,height:innerHeight},content:{...rect(content),clientHeight:content.clientHeight,scrollHeight:content.scrollHeight,scrollTop:content.scrollTop,overflowY:getComputedStyle(content).overflowY},result:rect(result),document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}};
 },{label,resultSelector});metrics.push(data);console.log('comparison-layout '+JSON.stringify(data));
 ok(data.content.scrollTop===0&&data.content.scrollHeight<=data.content.clientHeight+2,label+': outer comparison workspace does not scroll or clip overflowing controls');
 ok(data.document.width<=data.viewport.width&&data.document.height<=data.viewport.height+2,label+': app fits viewport');
 if(data.result){ok(data.result.height>=50&&data.result.top>=data.content.top-1&&data.result.bottom<=data.content.bottom+2,label+': result fills bounded usable space');}
 return data;
}
async function visibleControl(page,selector,label){
 const r=await page.locator(selector).first().boundingBox(),viewport=page.viewportSize();ok(r&&r.y>=0&&r.y+r.height<=viewport.height&&r.x>=0&&r.x+r.width<=viewport.width,label+' remains inside the window');
}
async function expandLoaders(page){if(await page.locator('#content').evaluate(el=>el.classList.contains('compare-loaders-collapsed')))await page.locator('[data-action="compare-loaders-toggle"]').click();}
async function collapseCheck(page,resultSelector,label){
 await expandLoaders(page);const before=await layout(page,label+' expanded',resultSelector);
 await page.locator('[data-action="compare-loaders-toggle"]').click();
 ok(await page.locator('#content').evaluate(el=>el.classList.contains('compare-loaders-collapsed')),'shared loader collapse state is applied');
 ok(await page.locator('.comparison-loaders').first().isHidden(),'expanded loaders stop reserving space');
 const summary=page.locator('.comparison-loader-summary').first();ok(await summary.isVisible()&&/Current/i.test(await summary.innerText())&&/Comparison/i.test(await summary.innerText()),'compact summary retains both side identities');
 const after=await layout(page,label+' collapsed',resultSelector);ok(after.result.height>before.result.height+20,'collapse gives space back to results rather than leaving a blank panel');
 await visibleControl(page,'[data-action="compare-loaders-toggle"]','loader toggle');
 return after;
}
async function wheel(page,selector,dy=500,targetSelector){
 const area=page.locator(selector);await area.evaluate(el=>{el.scrollTop=0;});
 const target=targetSelector?page.locator(targetSelector).first():area;await target.hover();await page.mouse.wheel(0,dy);
 await page.waitForFunction(selector=>document.querySelector(selector).scrollTop>0,selector,timeout);
 ok(await area.evaluate(el=>el.scrollTop>0),selector+' responds to wheel over '+(targetSelector||'result surface'));
 ok(await page.locator('#content').evaluate(el=>el.scrollTop===0),'wheel never moves outer comparison workspace');
}
async function nestedBoundaryWheel(page){
 const selector='.comparison-card details .comparison-scroll',nested=page.locator(selector).first();
 await nested.scrollIntoViewIfNeeded();ok(await nested.evaluate(el=>el.scrollHeight>el.clientHeight),'large original-settings table has genuine nested overflow');
 // End the previous wheel transaction and keyboard smooth scroll before starting
 // a separate boundary-chaining gesture; a nonzero scrollTop is not settlement.
 await page.mouse.move(page.viewportSize().width-8,8);await page.waitForTimeout(400);
 await nested.scrollIntoViewIfNeeded();await nested.evaluate(el=>{el.scrollTop=el.scrollHeight;});
 const settled=await page.evaluate(async selector=>{
  const child=document.querySelector(selector),parent=document.querySelector('.comparison-object-results');let last='',stable=0;
  for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);const box=child.getBoundingClientRect(),now=[child.scrollTop,parent.scrollTop,box.top,box.height].join(',');stable=now===last?stable+1:0;last=now;if(stable>=6)return true;}return false;
 },selector);ok(settled,'nested and parent scroll positions settle before boundary wheel');
 const point=await nested.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.comparison-object-results').getBoundingClientRect(),top=Math.max(a.top,b.top,0),bottom=Math.min(a.bottom,b.bottom,innerHeight);return {x:Math.max(a.left,b.left)+Math.min(20,a.width/2),y:(top+bottom)/2,visibleHeight:bottom-top};});
 ok(point.visibleHeight>20,'nested wheel target has a visible interior');await page.mouse.move(point.x,point.y);
 async function snapshot(){return page.evaluate(({selector,point})=>{
  const child=document.querySelector(selector),parent=document.querySelector('.comparison-object-results'),hit=document.elementFromPoint(point.x,point.y);
  function box(el){const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {node:el.tagName+'.'+el.className,top:el.scrollTop,max:el.scrollHeight-el.clientHeight,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},overflowY:s.overflowY,overscrollY:s.overscrollBehaviorY};}
  const ancestors=[];for(let el=hit;el&&ancestors.length<10;el=el.parentElement)ancestors.push(box(el));return {child:box(child),parent:box(parent),contentTop:document.querySelector('#content').scrollTop,hitWithinNested:child.contains(hit),hit:hit&&hit.tagName+'.'+hit.className,ancestors};
 },{selector,point});}
 const before=await snapshot();console.log('comparison-wheel-before '+JSON.stringify({point,before}));ok(before.hitWithinNested,'wheel is hit-tested inside the nested table');ok(before.child.top>=before.child.max-1,'nested table begins at its lower boundary');ok(before.parent.top<before.parent.max-1,'parent still has room to scroll');
 await page.mouse.wheel(0,500);let failure;
 try{await page.waitForFunction(before=>document.querySelector('.comparison-object-results').scrollTop>before,before.parent.top,timeout);}catch(error){failure=error;}
 const after=await snapshot(),report={label:'nested-boundary-wheel',point,before,after};metrics.push(report);console.log('comparison-wheel '+JSON.stringify(report));
 if(failure)throw failure;ok(after.parent.top>before.parent.top&&after.contentTop===0,'nested boundary chains to parent results, never outer workspace');
}
async function panesSynchronized(page){
 await page.waitForFunction(()=>{const a=document.querySelector('[data-stc-pane="left"]'),b=document.querySelector('[data-stc-pane="right"]');return a&&b&&Math.abs(a.scrollTop-b.scrollTop)<2&&Math.abs(a.scrollLeft-b.scrollLeft)<2;},null,timeout);checks++;
}
async function pasteText(page,side,text,name){
 await expandLoaders(page);await page.locator(`[data-stc-action="replace"][data-stc-side="${side}"]`).click();
 await page.locator('#stc-input-name').fill(name||'Example '+side);
 await page.locator('#stc-input-text').fill(text);
 await page.locator('#stc-unmasked-ack').check();
 await page.locator('[data-stc-action="save"]').click();
 await page.locator('.stc-editor').waitFor({state:'detached'});
}
async function textFile(page,side,text,name){
 await expandLoaders(page);await page.locator(`[data-stc-action="replace"][data-stc-side="${side}"]`).click();
 await page.locator('#stc-input-file').setInputFiles(upload(name,text));
 await page.waitForFunction(()=>document.querySelector('#stc-file-status')?.textContent.includes('bytes'),null,timeout);
 await page.locator('#stc-unmasked-ack').check();
 await page.locator('[data-stc-action="save"]').click();
 await page.locator('.stc-editor').waitFor({state:'detached'});
}
async function objectsAndScrolling(browser){
 for(const viewport of [{width:1440,height:960},{width:1000,height:650},{width:800,height:600}]){
  const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openComparison(page,configuration('current'),configuration('revised'));
  ok(await page.locator('.comparison-card').count()===40,'65 changed objects paginate');
  await collapseCheck(page,'.comparison-object-results','objects '+viewport.width);
  await wheel(page,'.comparison-object-results',350,'.comparison-card .detail-label');
  await wheel(page,'.comparison-object-results',350,'.comparison-card .object-side small');
  // A card gap / result padding must have the same wheel owner as card labels.
  const results=page.locator('.comparison-object-results');await results.evaluate(el=>{el.scrollTop=0;});const box=await results.boundingBox();await page.mouse.move(box.x+3,box.y+Math.min(30,box.height/2));await page.mouse.wheel(0,350);
  await page.waitForFunction(()=>document.querySelector('.comparison-object-results').scrollTop>0,null,timeout);checks++;
  await results.focus();await results.evaluate(el=>{el.scrollTop=0;});await results.press('PageDown');
  await page.waitForFunction(()=>document.querySelector('.comparison-object-results').scrollTop>0,null,timeout);checks++;
  const details=page.locator('.comparison-card details').first();await details.locator('summary').click();ok(await details.getAttribute('open')!==null,'original object settings expand');
  ok(await page.locator('.comparison-card').first().locator('.object-side').count()===2,'paired GUI object identities');
  ok(await page.locator('.comparison-object-group').evaluateAll(groups=>groups.length>0&&groups.every(group=>group.querySelector('h2,h3,[role="heading"]')&&group.querySelector('.comparison-card'))),'real non-empty category groups own the object cards');
  if(viewport.width===1440){
   await nestedBoundaryWheel(page);
   await results.evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:'test-results/comparison-objects.png'});
  }
  await visibleControl(page,'[aria-label="Next changes"]','object pagination');await page.locator('[aria-label="Next changes"]').click();ok(await page.locator('.comparison-card').count()===25,'all remaining objects reachable');
  await page.locator('[aria-label="Previous changes"]').click();ok(await page.locator('.comparison-card').count()===40,'return to first object page');
  await page.locator('[data-compare-mode="fields"]').click();await page.locator('.data-wrap tbody tr').first().waitFor();
  await layout(page,'original fields '+viewport.width,'.comparison-field-results');await wheel(page,'.comparison-field-results .data-wrap');
  const row=page.locator('.data-wrap tbody tr').first();await row.focus();await page.locator('.comparison-field-results .data-wrap').evaluate(el=>{el.scrollTop=0;});await row.press('PageDown');
  await page.waitForFunction(()=>document.querySelector('.comparison-field-results .data-wrap').scrollTop>0,null,timeout);checks++;
  await visibleControl(page,'[aria-label="Next page"]','field pagination');await page.locator('[aria-label="Next page"]').click();ok(await page.locator('[aria-label="Previous page"]').isEnabled(),'original field pagination reachable');
  await page.locator('[data-compare-mode="records"]').click();await wheel(page,'.comparison-object-results');
  await page.locator('[data-action="compare-swap"]').first().click();await wheel(page,'.comparison-object-results');
  await expandLoaders(page);await layout(page,'objects expanded again '+viewport.width,'.comparison-object-results');
  ok(errors.length===0,errors.join('\n'));await page.close();
 }
}
async function objectStates(browser){
 const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await openComparison(page,stateConfiguration(false),stateConfiguration(true));
 for(const kind of ['Added','Removed','Changed','Unchanged']){
  await page.selectOption('#table-filter',kind);const kinds=await page.locator('.comparison-card').evaluateAll(els=>els.map(el=>el.dataset.objectKind));ok(kinds.length>0&&kinds.every(k=>k===kind),kind+' filter exposes only requested objects');
 }
 await page.selectOption('#table-filter','Changed');const secret=page.locator('.comparison-card').filter({has:page.locator('h3',{hasText:'reader'})});
 ok(await secret.count()===1,'secret-only change remains a changed object');await secret.locator('summary').click();
 ok((await secret.innerText()).includes('[REDACTED]'),'secrets masked in paired original settings');
 ok(!(await page.locator('#content').innerHTML()).includes('TEST_SECRET_ONLY_'),'secret payload absent from rendered comparison');
 await page.selectOption('#table-filter','all-items');await page.selectOption('#compare-category','interfaces');
 ok((await page.locator('.comparison-card .detail-label').allTextContents()).every(x=>x.startsWith('GigabitEthernet')),'object category filter');
 await page.locator('#table-query').fill('unchanged port');ok(await page.locator('.comparison-card').count()===1,'object search includes retained settings');
 await page.locator('#table-query').fill('');await page.selectOption('#compare-category','all');
 await page.locator('[data-comparison-record]').first().click();await page.locator('#modal').waitFor({state:'visible'});await page.locator('#modal [data-action="close-modal"]').first().click();ok(await page.locator('#modal').isHidden(),'object detail closes back to comparison');
 const drop=await page.evaluateHandle(({name,text})=>{const transfer=new DataTransfer();transfer.items.add(new File([text],name,{type:'text/plain'}));return transfer;},{name:'identical.conf',text:stateConfiguration(false)});
 await page.locator('[data-comparison-drop="comparison"]').dispatchEvent('drop',{dataTransfer:drop});await drop.dispose();await page.locator('#modal').waitFor({state:'hidden'});
 ok((await page.locator('[data-comparison-drop="comparison"]').innerText()).includes('identical.conf')&&(await page.locator('[data-comparison-drop="compare-left"]').innerText()).includes('example-left.conf'),'drop targets only the selected object side');
 ok(await page.locator('#table-filter').inputValue()==='all-items','replacement preserves selected object filter');await page.selectOption('#table-filter','all');
 ok(await page.locator('.comparison-card').count()===0,'identical configs show no changed objects');await page.selectOption('#table-filter','Unchanged');ok(await page.locator('.comparison-card').count()>0,'identical objects remain accessible');
 await expandLoaders(page);
 const objectStyle=await page.locator('.comparison-loaders .compare-file').first().evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderRadius,s.padding,s.fontFamily];});
 await page.locator('[data-compare-mode="text"]').click();const textStyle=await page.locator('.comparison-loaders .compare-file').first().evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderRadius,s.padding,s.fontFamily];});ok(JSON.stringify(objectStyle)===JSON.stringify(textStyle),'object and text loaders share visual styles');await page.locator('[data-compare-mode="records"]').click();
 await page.locator('[data-action="compare-clear-left"]').click();ok((await page.locator('.comparison-loaders').innerText()).includes('identical.conf'),'clearing current config preserves comparison input');ok(await page.locator('[data-action="compare-left"]').first().isEnabled()&&await page.locator('[data-action="compare-import"]').first().isEnabled(),'both object inputs remain replaceable when current side is empty');await layout(page,'object current input cleared','.comparison-empty-results');
 await page.locator('[data-action="compare-left"]').first().click();await page.locator('#paste-config').fill(stateConfiguration(false));await page.locator('[data-action="import-paste"]').click();await page.locator('#modal').waitFor({state:'hidden'});ok(await page.locator('#compare-category').count()===1,'parsed paste restores object comparison');
 await page.locator('[data-action="compare-clear-right"]').click();ok((await page.locator('.comparison-loaders').innerText()).includes('Pasted'),'clearing comparison preserves pasted current config');
 await page.locator('#compare-left-file').setInputFiles(upload('many-left.conf',configuration('current')));await page.locator('#modal').waitFor({state:'hidden'});
 await page.locator('#compare-file').setInputFiles(upload('many-right.conf',configuration('revised')+'username example-reader privilege 1 secret TEST_SECRET_ONLY_ADDED\n'));await page.locator('#modal').waitFor({state:'hidden'});await page.selectOption('#table-filter','all-items');
 const categories=await page.locator('#compare-category option').evaluateAll(options=>options.map(option=>option.value).filter(value=>value!=='all')),seen=new Set();
 for(let pageIndex=0;pageIndex<5;pageIndex++){for(const category of await page.locator('.comparison-object-group').evaluateAll(groups=>groups.map(group=>group.dataset.comparisonCategory)))seen.add(category);if(!await page.locator('[aria-label="Next changes"]').isEnabled())break;await page.locator('[aria-label="Next changes"]').click();}
 ok(!await page.locator('[aria-label="Next changes"]').isEnabled()&&categories.every(category=>seen.has(category)),'every eligible category remains reachable across object pages');
 await page.selectOption('#compare-category','identities');await page.locator('[data-action="compare-loaders-toggle"]').click();ok(await page.locator('#compare-category').inputValue()==='identities','collapse preserves category filter');await page.locator('[data-action="compare-swap"]').click();await layout(page,'object swap filtered','.comparison-object-results');
 ok(errors.length===0,errors.join('\n'));await page.close();
}
async function textComparison(browser){
 const page=await browser.newPage({viewport:{width:1000,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+path.resolve('webview/index.html'));
 await page.locator('[data-view="compare"]').first().click();await page.locator('[data-compare-mode="text"]').click();
 ok(await page.locator('.sw-text-comparison').isVisible(),'direct text mode works without a parsed configuration');await layout(page,'text no loaded inputs','.stc-empty');
 await page.locator('[data-stc-action="replace"][data-stc-side="left"]').click();await page.locator('#stc-input-text').fill('Discarded draft');await page.locator('[data-stc-action="cancel"]').click();
 ok(await page.locator('.stc-editor').count()===0,'paste cancellation closes editor without replacing input');
 const left=Array.from({length:620},(_,i)=>`line ${String(i+1).padStart(4,'0')} = ${i===0?'<img src=x onerror=alert(1)>':'example'} ${'wide-config-value-'.repeat(12)}`);
 const right=left.slice();right[7]=right[7].replace('example','changed');right[560]=right[560].replace('example','revised');right.splice(70,0,'inserted right-only line');right.splice(121,1);
 await pasteText(page,'left',left.join('\n'),'Example <left>');await textFile(page,'right',right.join('\n'),'example-right.txt');
 ok(await page.locator('[data-stc-pane="left"] .stc-line').count()===500,'bounded 500-row text page');
 ok(await page.locator('.sw-text-comparison img').count()===0,'raw text markup is escaped');ok((await page.locator('[data-stc-pane="left"]').innerText()).includes('<img src=x onerror=alert(1)>'),'literal markup retained');
 ok(await page.locator('.stc-added').count()>1&&await page.locator('.stc-removed').count()>1&&await page.locator('.stc-changed').count()>1,'added, removed and changed lines highlighted');
 await collapseCheck(page,'[data-stc-pane="left"]','text1000');
 const map=page.locator('.stc-minimap'),mapView=page.locator('.stc-map-viewport');ok(await map.isVisible()&&await map.getAttribute('role')==='slider','full-file change map is accessible');
 ok(await page.locator('.stc-map-marker').count()>0&&await page.locator('.stc-map-marker').count()<=480,'change-map DOM stays bounded');
 for(const kind of ['added','removed','changed'])ok(await page.locator('.stc-map-marker[data-stc-map-kind="'+kind+'"]').count()>0,'map displays '+kind+' lines from full file');
 const mapTop=await mapView.evaluate(el=>el.style.top);
 const pane='[data-stc-pane="left"]';await wheel(page,pane);await panesSynchronized(page);
 await page.waitForFunction(top=>document.querySelector('.stc-map-viewport').style.top!==top,mapTop,timeout);checks++;
 await wheel(page,'[data-stc-pane="right"]',800);await panesSynchronized(page);
 await page.locator(pane).evaluate(el=>{el.scrollTop=0;});await page.locator(pane).focus();await page.locator(pane).press('PageDown');await page.waitForFunction(()=>document.querySelector('[data-stc-pane="left"]').scrollTop>0,null,timeout);await panesSynchronized(page);
 await page.locator(pane).hover();await page.mouse.wheel(450,0);await page.waitForFunction(()=>document.querySelector('[data-stc-pane="left"]').scrollLeft>0,null,timeout);await panesSynchronized(page);
 await page.locator('[data-stc-action="next"]').click();ok(await page.locator('.stc-active').count()>0,'next difference highlights a block');
 for(let step=0;step<3;step++)await page.locator('[data-stc-action="next"]').click();
 ok(await page.locator('[data-stc-action="next"]').isDisabled(),'last difference bounds navigation');
 ok(Number(await page.locator('[data-stc-pane="left"] .stc-active').first().getAttribute('data-stc-row'))>=500,'difference navigation crosses aligned-row pages');
 await page.locator('[data-stc-action="previous"]').click();ok(Number(await page.locator('[data-stc-pane="left"] .stc-active').first().getAttribute('data-stc-row'))<500,'previous difference returns across pages');
 await page.locator('[data-stc-action="page-next"]').click();ok(await page.locator('[data-stc-pane="left"] .stc-line').count()<500,'remaining aligned rows are reachable');await page.locator('[data-stc-action="page-previous"]').click();
 const distantRow=await page.locator('.stc-map-marker').evaluateAll(markers=>Number(markers.find(marker=>Number(marker.dataset.stcMapRow)>=500)?.dataset.stcMapRow));ok(distantRow>=500,'map includes a changed block beyond the rendered page');
 await page.locator('.stc-map-marker[data-stc-map-row="'+distantRow+'"]').first().click();await panesSynchronized(page);
 ok(Number(await page.locator('[data-stc-pane="left"] .stc-line').first().getAttribute('data-stc-row'))>=500,'clicking the map jumps both panes to a different page');
 await map.press('Home');ok(await page.locator('[data-stc-pane="left"] .stc-line').first().getAttribute('data-stc-row')==='0','map Home returns to first aligned row page');
 await map.press('End');ok(Number(await page.locator('[data-stc-pane="left"] .stc-line').first().getAttribute('data-stc-row'))>=500,'map End reaches last aligned page');await panesSynchronized(page);await map.press('Home');
 await page.locator('[data-stc-action="swap"]').click();ok((await page.locator('.stc-pane-title').first().innerText()).includes('example-right.txt'),'swap changes text side ownership');
 await page.locator('[data-compare-mode="records"]').click();await page.locator('[data-compare-mode="text"]').click();ok((await page.locator('.stc-pane-title').first().innerText()).includes('example-right.txt'),'direct text survives mode switching');
 for(const size of [{width:1440,height:960},{width:800,height:600}]){await page.setViewportSize(size);await collapseCheck(page,'[data-stc-pane="left"]','text '+size.width);await panesSynchronized(page);await visibleControl(page,'[data-stc-action="next"]','text difference controls');const m=await page.locator('.stc-map-viewport').boundingBox(),b=await map.boundingBox();ok(m&&b&&m.height>0&&m.y>=b.y-1&&m.y+m.height<=b.y+b.height+2,'minimap viewport marker remains bounded after resize');}
 await layout(page,'text compact final','[data-stc-pane="left"]');
 await page.locator('[data-stc-pane="left"]').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/comparison-text.png'});
 await pasteText(page,'left','same\n','Same left');await pasteText(page,'right','same\n','Same right');ok((await page.locator('.sw-text-comparison').innerText()).includes('No text differences'),'identical direct text reports no differences');
 ok(await page.locator('[data-stc-action="next"]').isDisabled(),'no next difference on identical text');
 await expandLoaders(page);await page.locator('[data-stc-action="replace"][data-stc-side="right"]').click();await page.locator('#stc-input-text').fill('never committed');await page.locator('[data-stc-action="save"]').click();ok((await page.locator('.stc-error').innerText()).includes('Confirm'),'unmasked direct text requires acknowledgment');await page.locator('.stc-editor').press('Escape');ok(await page.locator('.stc-editor').count()===0,'Escape cancels text editor');
 await page.locator('[data-stc-action="clear"][data-stc-side="left"]').click();ok((await page.locator('.comparison-loaders').innerText()).includes('Same right'),'clearing left text preserves right input');ok(await page.locator('[data-stc-action="replace"][data-stc-side="left"]').isEnabled(),'empty text side stays replaceable');
 await textFile(page,'left','same\n','restored-left.txt');ok((await page.locator('.sw-text-comparison').innerText()).includes('No text differences'),'file replacement restores equal comparison');await page.locator('[data-stc-action="clear"][data-stc-side="right"]').click();ok((await page.locator('.comparison-loaders').innerText()).includes('restored-left.txt'),'clearing right text preserves left input');
 ok(errors.length===0,errors.join('\n'));await page.close();
}
(async()=>{
 fs.mkdirSync('test-results',{recursive:true});const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})}),failures=[];
 try{
  for(const [name,run] of [['objects-scrolling',objectsAndScrolling],['object-states',objectStates],['text-comparison',textComparison]]){
   try{await run(browser);console.log('comparison-scenario '+name+' passed');}
   catch(error){
    failures.push({name,error});console.error('comparison-scenario '+name+' failed: '+(error.stack||error));
    for(const [i,page] of browser.contexts().flatMap(context=>context.pages()).entries()){await page.screenshot({path:`test-results/comparison-${name}-failure-${i}.png`}).catch(()=>{});fs.writeFileSync(`test-results/comparison-${name}-failure-${i}.html`,await page.content().catch(()=>''));}
    // Later scenarios start in clean pages even if an earlier assertion failed.
    for(const context of browser.contexts())await context.close().catch(()=>{});
   }
  }
  fs.writeFileSync('test-results/comparison-scenarios.json',JSON.stringify({checks,failures:failures.map(({name,error})=>({name,message:error.message,stack:error.stack}))},null,2));
  if(failures.length)throw new AggregateError(failures.map(item=>item.error),failures.map(item=>item.name).join(', ')+' failed');
  console.log(checks+' comparison browser checks passed');
 }finally{fs.writeFileSync('test-results/comparison-layout-metrics.json',JSON.stringify(metrics,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});

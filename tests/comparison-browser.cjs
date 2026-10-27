const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;const metrics=[];function ok(value,message){checks++;assert.ok(value,message);}
const timeout={timeout:5000};
function configuration(revision){return 'version 15.2\nhostname Example-Comparison\n'+Array.from({length:65},(_,i)=>`interface GigabitEthernet1/0/${i+1}\n description Example ${revision} port ${i+1} ${'long-configuration-value-'.repeat(8)}\n switchport access vlan 10\n switchport mode access\n speed auto\n duplex auto\n mtu 1500\n spanning-tree portfast\n spanning-tree bpduguard enable\n storm-control broadcast level 10.00\n storm-control multicast level 10.00\n storm-control unicast level 10.00\n logging event link-status\n load-interval 30\n no shutdown\n exit\n`).join('');}
function stateConfiguration(right){return `version 15.2\nhostname Example-States\nusername reader privilege 1 secret TEST_SECRET_ONLY_${right?'NEW':'OLD'}\ninterface GigabitEthernet1/0/1\n description unchanged port\n exit\ninterface GigabitEthernet1/0/2\n description ${right?'after':'before'} port\n exit\ninterface GigabitEthernet1/0/${right?4:3}\n description ${right?'added':'removed'} port\n exit\n`;}
function navigationConfiguration(right){return stateConfiguration(right)+Array.from({length:12},(_,i)=>`interface GigabitEthernet1/0/${i+10}\n description ${right?'revised':'current'} navigation port ${i+10} ${'variable-long-value-'.repeat(i%4*6)}\n${i%2?' speed auto\n duplex auto\n mtu 1500\n switchport mode access\n switchport access vlan 10\n spanning-tree portfast\n':''} no shutdown\n exit\n`).join('');}
function fieldConfiguration(right){return stateConfiguration(right)+Array.from({length:65},(_,i)=>`interface GigabitEthernet1/0/${i+10}\n description ${right?'revised':'current'} field ${i+10} ${'variable-field-value-'.repeat(i%4*8)}\n no shutdown\n exit\n`).join('');}
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
async function swapControl(page,label){
 const selector=await page.locator('.sw-text-comparison').count()?'[data-stc-action="swap"]':'[data-action="compare-swap"]',button=page.locator(selector+':visible');
 ok(await button.count()===1,label+': exactly one swap control is visible');ok(await button.getAttribute('aria-label')==='Swap sides',label+': swap has a clear accessible name');
 const collapsed=await page.locator('#content').evaluate(el=>el.classList.contains('compare-loaders-collapsed')),sides=page.locator(collapsed?'.comparison-loader-summary > span':'.comparison-loaders .compare-file');
 const left=await sides.first().boundingBox(),right=await sides.last().boundingBox(),swap=await button.boundingBox();
 ok(left&&right&&swap&&Math.abs(swap.x+swap.width/2-(left.x+left.width+right.x)/2)<=3,label+': swap arrow is centered between the two side identities');
 await visibleControl(page,selector+':visible',label+' swap');
}
async function collapseCheck(page,resultSelector,label){
 await expandLoaders(page);const before=await layout(page,label+' expanded',resultSelector);await swapControl(page,label+' expanded');
 await page.locator('[data-action="compare-loaders-toggle"]').click();
 ok(await page.locator('#content').evaluate(el=>el.classList.contains('compare-loaders-collapsed')),'shared loader collapse state is applied');
 ok(await page.locator('.comparison-loaders').first().isHidden(),'expanded loaders stop reserving space');
 const summary=page.locator('.comparison-loader-summary').first();ok(await summary.isVisible()&&/Current/i.test(await summary.innerText())&&/Comparison/i.test(await summary.innerText()),'compact summary retains both side identities');
 const after=await layout(page,label+' collapsed',resultSelector);ok(after.result.height>before.result.height+20,'collapse gives space back to results rather than leaving a blank panel');
 await swapControl(page,label+' collapsed');
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
function mapSelectors(mode){return {text:mode==='text',mapSelector:mode==='text'?'.stc-minimap':mode==='fields'?'.comparison-field-minimap':'.comparison-object-minimap',thumbSelector:mode==='text'?'.stc-map-viewport':'.comparison-object-map-viewport',markerSelector:mode==='text'?'.stc-map-marker':'.comparison-object-map-marker',scrollSelector:mode==='text'?'[data-stc-pane="left"]':mode==='fields'?'.comparison-field-results .data-wrap':'.comparison-object-results',dragAttribute:mode==='text'?'data-stc-dragging':'data-object-map-dragging'};}
async function mapDrag(page,mode){
 const {text,mapSelector,thumbSelector,scrollSelector,dragAttribute}=mapSelectors(mode),map=page.locator(mapSelector),handle=await map.elementHandle();
 async function position(){return page.evaluate(({mapSelector,scrollSelector})=>{const map=document.querySelector(mapSelector),area=document.querySelector(scrollSelector);return {top:area.scrollTop,max:area.scrollHeight-area.clientHeight,page:Number(area.querySelector('[data-stc-row]')?.dataset.stcRow||0),value:map.getAttribute('aria-valuenow'),capture:map.hasPointerCapture(map.__comparisonTestPointerId||-1),dragging:map.hasAttribute('data-stc-dragging')||map.hasAttribute('data-object-map-dragging')};},{mapSelector,scrollSelector});}
 async function begin(){
  await map.evaluate(el=>el.addEventListener('pointerdown',event=>{el.__comparisonTestPointerId=event.pointerId;},{once:true,capture:true}));
  const thumb=await page.locator(thumbSelector).boundingBox();ok(thumb&&thumb.height>0,mode+' map has a draggable viewport');await page.mouse.move(thumb.x+thumb.width/2,thumb.y+thumb.height/2);await page.mouse.down();
  await page.waitForFunction(({mapSelector,dragAttribute})=>{const el=document.querySelector(mapSelector);return el.hasAttribute(dragAttribute)&&el.hasPointerCapture(el.__comparisonTestPointerId);},{mapSelector,dragAttribute},timeout);checks++;
 }
 await map.press('Home');await page.waitForFunction(({scrollSelector,text})=>{const el=document.querySelector(scrollSelector);return el.scrollTop<=2&&(!text||el.querySelector('[data-stc-row]')?.dataset.stcRow==='0');},{scrollSelector,text},timeout);
 await begin();const box=await map.boundingBox(),outsideX=Math.max(1,box.x-35),lowerY=Math.min(page.viewportSize().height-1,box.y+box.height+20),upperY=Math.max(1,box.y-20),observations=[];
 for(const [direction,y] of [['down',lowerY],['up',upperY],['down',lowerY]]){
  await page.mouse.move(outsideX,y,{steps:6});
  try{await page.waitForFunction(({scrollSelector,text,direction})=>{const el=document.querySelector(scrollSelector),first=Number(el.querySelector('[data-stc-row]')?.dataset.stcRow||0);return direction==='up'?el.scrollTop<=2&&(!text||first===0):el.scrollTop>=el.scrollHeight-el.clientHeight-2&&(!text||first>=500);},{scrollSelector,text,direction},timeout);}catch(error){const failed={label:mode+' map drag failed',direction,point:{x:outsideX,y},...await position()};metrics.push(failed);console.error('comparison-map-drag '+JSON.stringify(failed));throw error;}
  ok(await handle.evaluate((el,selector)=>el.isConnected&&document.querySelector(selector)===el&&el.hasPointerCapture(el.__comparisonTestPointerId),mapSelector),mode+' drag keeps its map and pointer capture while moving '+direction+' beyond map bounds');
  observations.push({direction,...await position()});if(text)await panesSynchronized(page);
 }
 await page.mouse.up();await page.waitForFunction(({mapSelector,dragAttribute})=>{const el=document.querySelector(mapSelector);return !el.hasAttribute(dragAttribute)&&!el.hasPointerCapture(el.__comparisonTestPointerId);},{mapSelector,dragAttribute},timeout);checks++;
 await wheel(page,scrollSelector,350);if(text)await panesSynchronized(page);
 await map.press('Home');await begin();await page.mouse.move(box.x+box.width/2,box.y+box.height*.45,{steps:4});await page.waitForFunction(selector=>document.querySelector(selector).scrollTop>0,scrollSelector,timeout);
 const pointerId=await map.evaluate(el=>el.__comparisonTestPointerId);await map.dispatchEvent('pointercancel',{pointerId,pointerType:'mouse',isPrimary:true,bubbles:true});
 ok(await map.evaluate((el,attribute)=>!el.hasAttribute(attribute)&&!el.hasPointerCapture(el.__comparisonTestPointerId),dragAttribute),mode+' pointer cancellation releases capture and drag state');
 const cancelled=await position();await page.mouse.move(outsideX,upperY,{steps:3});await page.mouse.up();await page.evaluate(()=>new Promise(requestAnimationFrame));const released=await position();
 ok(cancelled.page===released.page&&Math.abs(cancelled.top-released.top)<2,mode+' cancelled drag does not keep scrolling after pointer movement');
 await wheel(page,scrollSelector,350);if(text)await panesSynchronized(page);await map.press('Home');
 const report={label:mode+' map captured drag',observations,cancelled,released};metrics.push(report);console.log('comparison-map-drag '+JSON.stringify(report));await handle.dispose();
}
async function mapAnyPointDrag(page,mode){
 const contract=mapSelectors(mode),{text,mapSelector,thumbSelector,markerSelector,scrollSelector,dragAttribute}=contract,map=page.locator(mapSelector),observations=[];
 async function snapshot(){return page.evaluate(({mapSelector,scrollSelector,dragAttribute})=>{const map=document.querySelector(mapSelector),area=document.querySelector(scrollSelector);return {top:area.scrollTop,max:area.scrollHeight-area.clientHeight,page:Number(area.querySelector('[data-stc-row]')?.dataset.stcRow||0),capture:map.hasPointerCapture(map.__comparisonTestPointerId||-1),dragging:map.hasAttribute(dragAttribute)};},contract);}
 for(const start of ['track','marker']){
  await map.press('Home');
  const point=await page.evaluate(({mapSelector,thumbSelector,markerSelector,start})=>{
   const map=document.querySelector(mapSelector),box=map.getBoundingClientRect(),thumb=map.querySelector(thumbSelector),markers=[...map.querySelectorAll(markerSelector)];
   function usable(x,y,marker){const hit=document.elementFromPoint(x,y);return hit&&map.contains(hit)&&!thumb.contains(hit)&&(marker?hit.closest(markerSelector):!hit.closest(markerSelector));}
   if(start==='marker'){for(const marker of markers.slice().reverse()){const r=marker.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(y>box.top+box.height*.2&&y<box.bottom-3&&usable(x,y,true))return {x,y,kind:marker.className};}}
   else for(const fy of [.6,.4,.8])for(const fx of [1.5,box.width/2,box.width-1.5]){const x=box.left+fx,y=box.top+box.height*fy;if(usable(x,y,false))return {x,y,kind:document.elementFromPoint(x,y).className};}
   return null;
  },{mapSelector,thumbSelector,markerSelector,start});ok(point,mode+' map exposes a hit-tested '+start+' drag origin outside the viewport');
  const handle=await map.elementHandle();await map.evaluate(el=>el.addEventListener('pointerdown',event=>{el.__comparisonTestPointerId=event.pointerId;},{once:true,capture:true}));await page.mouse.move(point.x,point.y);await page.mouse.down();
  await page.waitForFunction(({mapSelector,dragAttribute,scrollSelector})=>{const map=document.querySelector(mapSelector),area=document.querySelector(scrollSelector);return map.hasAttribute(dragAttribute)&&map.hasPointerCapture(map.__comparisonTestPointerId)&&(area.scrollTop>0||Number(area.querySelector('[data-stc-row]')?.dataset.stcRow)>0);},contract,timeout);checks++;
  ok(await handle.evaluate((el,selector)=>el.isConnected&&document.querySelector(selector)===el&&el.hasPointerCapture(el.__comparisonTestPointerId),mapSelector),mode+' '+start+' press jumps immediately without replacing the captured map');
  const pressed=await snapshot(),box=await map.boundingBox();await page.mouse.move(box.x-20,Math.max(1,box.y-20),{steps:5});await page.waitForFunction(({scrollSelector,text})=>{const area=document.querySelector(scrollSelector);return area.scrollTop<=2&&(!text||area.querySelector('[data-stc-row]')?.dataset.stcRow==='0');},contract,timeout);checks++;
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.55,{steps:5});await page.waitForFunction(selector=>document.querySelector(selector).scrollTop>0,scrollSelector,timeout);if(text)await panesSynchronized(page);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const beforeRelease=await snapshot();
  if(start==='track'){const pointerId=await map.evaluate(el=>el.__comparisonTestPointerId);await map.dispatchEvent('pointercancel',{pointerId,pointerType:'mouse',isPrimary:true,bubbles:true});await page.mouse.move(box.x-20,box.y-10);}
  await page.mouse.up();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const afterRelease=await snapshot();
  ok(!afterRelease.capture&&!afterRelease.dragging,mode+' '+start+' drag releases capture/state after '+(start==='track'?'cancellation':'pointerup'));
  ok(beforeRelease.page===afterRelease.page&&Math.abs(beforeRelease.top-afterRelease.top)<2,mode+' '+start+' drag does not jump again on release/click');
  observations.push({start,point,pressed,beforeRelease,afterRelease});await handle.dispose();
 }
 await wheel(page,scrollSelector,350);if(text)await panesSynchronized(page);await map.press('Home');const report={label:mode+' any-point map drag',observations};metrics.push(report);console.log('comparison-map-any-point '+JSON.stringify(report));
}
async function objectNavigationGeometry(page,label){
 await page.waitForFunction(()=>{const map=document.querySelector('.comparison-object-minimap'),area=document.querySelector('.comparison-object-results');return map&&area&&Number(map.dataset.objectMapTotal)===area.scrollHeight&&[...map.querySelectorAll('.comparison-object-map-marker')].reduce((count,marker)=>count+Number(marker.dataset.objectMapCount||1),0)===area.querySelectorAll('.comparison-card').length;},null,timeout);
 const data=await page.evaluate(label=>{
  const area=document.querySelector('.comparison-object-results'),map=document.querySelector('.comparison-object-minimap'),rect=area.getBoundingClientRect(),thumb=map.querySelector('.comparison-object-map-viewport').getBoundingClientRect(),mapRect=map.getBoundingClientRect(),cards=[...area.querySelectorAll('.comparison-card')],markers=[...map.querySelectorAll('.comparison-object-map-marker')],groups=[...area.querySelectorAll('.comparison-object-group')],bookmarks=[...document.querySelectorAll('[data-comparison-section]')];
  return {label,top:area.scrollTop,total:area.scrollHeight,clientHeight:area.clientHeight,mapHeight:mapRect.height,thumbHeight:thumb.height,thumbBounded:thumb.height>0&&thumb.top>=mapRect.top-1&&thumb.bottom<=mapRect.bottom+2,groups:groups.map(group=>group.dataset.comparisonCategory),bookmarks:bookmarks.map(button=>button.dataset.comparisonSection),active:bookmarks.filter(button=>button.getAttribute('aria-current')==='location').map(button=>button.dataset.comparisonSection),cards:cards.length,markers:markers.length,represented:markers.reduce((count,marker)=>count+Number(marker.dataset.objectMapCount||1),0),aggregates:markers.filter(marker=>marker.dataset.objectMapCollapsed==='true').length,maxMarkerOffset:Math.max(0,...markers.map(marker=>{const card=cards[Number(marker.dataset.objectMapIndex)],target=marker.dataset.objectMapCollapsed==='true'?card.closest('.comparison-object-group'):card;return Math.abs(Number(marker.dataset.objectMapTop)-(target.getBoundingClientRect().top-rect.top-area.clientTop+area.scrollTop));})),kindsMatch:markers.every(marker=>{const card=cards[Number(marker.dataset.objectMapIndex)],group=card.closest('.comparison-object-group'),kind=marker.dataset.objectMapKind;return kind===card.dataset.objectKind.toLowerCase()&&(marker.dataset.objectMapCollapsed==='true'?!group.open&&Number(marker.dataset.objectMapCount)===[...group.querySelectorAll('.comparison-card')].filter(item=>item.dataset.objectKind.toLowerCase()===kind).length:group.tagName!=='DETAILS'||group.open);}),cardHeights:[...new Set(cards.filter(card=>card.getClientRects().length).map(card=>Math.round(card.getBoundingClientRect().height)))]};
 },label);metrics.push(data);console.log('comparison-object-navigation '+JSON.stringify(data));
 ok(JSON.stringify(data.bookmarks)===JSON.stringify(data.groups),label+': bookmarks represent exactly the current rendered category sections');ok(data.cards===data.represented&&data.markers<=data.cards&&data.cards<=40&&data.kindsMatch,label+': bounded object map represents current-page cards/states with honest collapsed aggregates');
 ok(data.maxMarkerOffset<=2,label+': map positions use measured card heights');ok(data.thumbBounded,label+': map viewport remains bounded');ok(data.active.length===(data.groups.length?1:0),label+': one actual section is active when results exist');return data;
}
async function fieldNavigationGeometry(page,label){
 await page.waitForFunction(()=>{const map=document.querySelector('.comparison-field-minimap'),area=document.querySelector('.comparison-field-results .data-wrap');return map&&area&&Number(map.dataset.objectMapTotal)===area.scrollHeight&&map.querySelectorAll('.comparison-field-map-marker').length===area.querySelectorAll('[data-field-diff-kind]').length;},null,timeout);
 const data=await page.evaluate(label=>{const area=document.querySelector('.comparison-field-results .data-wrap'),map=document.querySelector('.comparison-field-minimap'),rows=[...area.querySelectorAll('[data-field-diff-kind]')],markers=[...map.querySelectorAll('.comparison-field-map-marker')],a=area.getBoundingClientRect(),m=map.getBoundingClientRect(),thumb=map.querySelector('.comparison-object-map-viewport').getBoundingClientRect();return {label,rows:rows.length,markers:markers.length,total:area.scrollHeight,top:area.scrollTop,pageSize:Number(document.querySelector('#page-size').value),keys:rows.map(row=>row.dataset.diffKey),kinds:[...new Set(rows.map(row=>row.dataset.fieldDiffKind.toLowerCase()))],heights:[...new Set(rows.map(row=>Math.round(row.getBoundingClientRect().height)))],maxMarkerOffset:Math.max(0,...markers.map((marker,i)=>Math.abs(Number(marker.dataset.objectMapTop)-(rows[i].getBoundingClientRect().top-a.top-area.clientTop+area.scrollTop)))),kindsMatch:markers.every((marker,i)=>marker.dataset.fieldMapKind===rows[i].dataset.fieldDiffKind.toLowerCase()),thumbBounded:thumb.height>0&&thumb.top>=m.top-1&&thumb.bottom<=m.bottom+2,scope:map.getAttribute('aria-label')};},label);metrics.push(data);console.log('comparison-field-navigation '+JSON.stringify({...data,keys:data.keys.length}));
 ok(data.rows===data.markers&&data.rows<=data.pageSize&&data.kindsMatch,label+': original-field map contains exactly the rendered rows and states');ok(data.maxMarkerOffset<=2,label+': original-field map uses actual row geometry');ok(data.thumbBounded&&/current page/i.test(data.scope),label+': original-field map viewport is bounded and declares its page scope');return data;
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
   ok(await page.locator('.comparison-card > .comparison-scroll').first().evaluate(el=>getComputedStyle(el).maxHeight)==='none'&&await details.locator('.comparison-scroll').first().evaluate(el=>getComputedStyle(el).maxHeight)==='300px','collapsible category details do not accidentally constrain normal properties; only technical settings have a300px nested viewport');
   await nestedBoundaryWheel(page);
   await results.evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:'test-results/comparison-objects.png'});
  }
  await visibleControl(page,'[aria-label="Next changes"]','object pagination');await page.locator('[aria-label="Next changes"]').click();ok(await page.locator('.comparison-card').count()===25,'all remaining objects reachable');
  await page.locator('[aria-label="Previous changes"]').click();ok(await page.locator('.comparison-card').count()===40,'return to first object page');
  await page.locator('[data-compare-mode="fields"]').click();await page.locator('.data-wrap tbody tr').first().waitFor();
  await layout(page,'original fields '+viewport.width,'.comparison-field-results');await fieldNavigationGeometry(page,'original fields '+viewport.width);await wheel(page,'.comparison-field-results .data-wrap');
  const row=page.locator('.data-wrap tbody tr').first();await row.focus();await page.locator('.comparison-field-results .data-wrap').evaluate(el=>{el.scrollTop=0;});await row.press('PageDown');
  await page.waitForFunction(()=>document.querySelector('.comparison-field-results .data-wrap').scrollTop>0,null,timeout);checks++;
  await visibleControl(page,'[aria-label="Next page"]','field pagination');await page.locator('[aria-label="Next page"]').click();ok(await page.locator('[aria-label="Previous page"]').isEnabled(),'original field pagination reachable');
  await page.locator('[data-compare-mode="records"]').click();await wheel(page,'.comparison-object-results');
  await page.locator('[data-action="compare-swap"]:visible').click();await wheel(page,'.comparison-object-results');
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
 for(let pageIndex=0;pageIndex<5;pageIndex++){await objectNavigationGeometry(page,'object page '+(pageIndex+1));for(const category of await page.locator('.comparison-object-group').evaluateAll(groups=>groups.map(group=>group.dataset.comparisonCategory)))seen.add(category);if(!await page.locator('[aria-label="Next changes"]').isEnabled())break;await page.locator('[aria-label="Next changes"]').click();}
 ok(!await page.locator('[aria-label="Next changes"]').isEnabled()&&categories.every(category=>seen.has(category)),'every eligible category remains reachable across object pages');
 await page.selectOption('#compare-category','identities');await page.locator('[data-action="compare-loaders-toggle"]').click();ok(await page.locator('#compare-category').inputValue()==='identities','collapse preserves category filter');await page.locator('[data-action="compare-swap"]:visible').click();await layout(page,'object swap filtered','.comparison-object-results');
 ok(errors.length===0,errors.join('\n'));await page.close();
}
async function objectNavigation(browser){
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await openComparison(page,navigationConfiguration(false),navigationConfiguration(true));await page.selectOption('#table-filter','all-items');
 await collapseCheck(page,'.comparison-object-results','object navigation');const initial=await objectNavigationGeometry(page,'navigation initial');ok(initial.groups.length>=2&&initial.cardHeights.length>1,'navigation fixture has multiple real categories and variable-height cards');
 const neutral=await page.locator('.comparison-object-map-marker[data-object-map-kind="unchanged"]').count();ok(neutral>0&&neutral===await page.locator('.comparison-card[data-object-kind="Unchanged"]').count(),'all-objects map includes each unchanged object');const mapColors=await page.locator('.comparison-object-map-marker').evaluateAll(markers=>Object.fromEntries(markers.map(marker=>[marker.dataset.objectMapKind,getComputedStyle(marker).backgroundColor])));ok(new Set(Object.values(mapColors)).size===4,'unchanged markers use a distinct neutral color from the three change states');
 await page.selectOption('#table-filter','all');await objectNavigationGeometry(page,'all-changes map filter');ok(await page.locator('.comparison-object-map-marker[data-object-map-kind="unchanged"]').count()===0,'all-changes filter intentionally excludes unchanged map markers');await page.selectOption('#table-filter','all-items');await objectNavigationGeometry(page,'all-objects map restored');ok(await page.locator('.comparison-object-map-marker[data-object-map-kind="unchanged"]').count()===neutral,'restoring all objects restores neutral unchanged markers');
 for(const group of await page.locator('.comparison-object-group').all())await group.locator(':scope > summary').click();const allClosed=await objectNavigationGeometry(page,'all object sections collapsed');ok(allClosed.total<=allClosed.clientHeight+2,'all collapsed headings fit in the result viewport');ok(await page.locator('.comparison-object-minimap').getAttribute('aria-disabled')==='false','a fitted map remains actionable when collapsed items can expand');
 const fittedAggregate=page.locator('.comparison-object-map-aggregate[data-object-map-group="interfaces"][data-object-map-kind="unchanged"]'),fittedIndex=Number(await fittedAggregate.getAttribute('data-object-map-index')),fittedPoint=await fittedAggregate.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,hitsMarker:hit===el||el.contains(hit),hit:hit&&hit.className};});ok(fittedPoint.hitsMarker,'neutral aggregate is hit-testable above the full-height viewport indicator: '+fittedPoint.hit);await page.mouse.click(fittedPoint.x,fittedPoint.y);
 await page.waitForFunction(index=>{const area=document.querySelector('.comparison-object-results'),card=area.querySelectorAll('.comparison-card')[index],a=area.getBoundingClientRect(),r=card.getBoundingClientRect();return card.closest('.comparison-object-group').open&&r.top>=a.top-2&&r.top<a.bottom;},fittedIndex,timeout);checks++;metrics.push({label:'fitted collapsed aggregate click',...fittedPoint});
 for(const group of await page.locator('.comparison-object-group').all())if(await group.getAttribute('open')===null)await group.locator(':scope > summary').click();await objectNavigationGeometry(page,'all object sections restored');
 const section=page.locator('.comparison-object-group[data-comparison-category="interfaces"]');await section.locator(':scope > summary').click();const closed=await objectNavigationGeometry(page,'collapsed interface section');ok(await section.getAttribute('open')===null&&await section.locator('.comparison-card').first().isHidden()&&closed.total<initial.total,'category collapse hides cards and reclaims their actual scrolling height');ok(closed.aggregates>0&&closed.markers<closed.cards,'closed category is represented by labeled state aggregates rather than fake hidden-card positions');
 await page.locator('[data-compare-mode="fields"]').click();await page.locator('[data-compare-mode="text"]').click();await page.locator('[data-compare-mode="records"]').click();ok(await section.getAttribute('open')===null,'category collapse survives comparison mode switches');await page.selectOption('#table-filter','Changed');await objectNavigationGeometry(page,'collapsed changed section');await page.selectOption('#table-filter','all-items');ok(await section.getAttribute('open')===null,'category collapse survives filtering and restoring all objects');await objectNavigationGeometry(page,'collapsed section restored');
 const aggregate=page.locator('.comparison-object-map-aggregate[data-object-map-kind="unchanged"]').first(),containedIndex=Number(await aggregate.getAttribute('data-object-map-index'));ok(/collapsed/i.test(await aggregate.getAttribute('title')),'collapsed neutral marker explains its aggregate meaning');await page.locator('.comparison-object-minimap').press('End');await aggregate.click();await page.waitForFunction(index=>{const area=document.querySelector('.comparison-object-results'),card=area.querySelectorAll('.comparison-card')[index],a=area.getBoundingClientRect(),r=card.getBoundingClientRect();return card.closest('.comparison-object-group').open&&r.top>=a.top-2&&r.top<a.bottom;},containedIndex,timeout);checks++;await objectNavigationGeometry(page,'aggregate expanded contained object');
 await section.locator(':scope > summary').click();await objectNavigationGeometry(page,'section collapsed again');await page.locator('[data-comparison-section="interfaces"]').click();ok(await section.getAttribute('open')!==null,'bookmark expands its collapsed section before navigating');await objectNavigationGeometry(page,'bookmark reopened section');
 const bookmarks=page.locator('[data-comparison-section]'),first=await bookmarks.first().getAttribute('data-comparison-section'),last=await bookmarks.last().getAttribute('data-comparison-section'),area=page.locator('.comparison-object-results'),map=page.locator('.comparison-object-minimap');
 await bookmarks.last().click();await page.waitForFunction(category=>document.querySelector('[data-comparison-section="'+category+'"]').getAttribute('aria-current')==='location',last,timeout);checks++;
 const heading=await page.locator('.comparison-object-group[data-comparison-category="'+last+'"] .comparison-group-heading').boundingBox(),result=await area.boundingBox();ok(heading&&heading.y>=result.y-2&&heading.y<result.y+result.height,'bookmark click scrolls to its real section heading');
 await area.evaluate(el=>{el.scrollTop=0;});await page.waitForFunction(category=>document.querySelector('[data-comparison-section="'+category+'"]').getAttribute('aria-current')==='location',first,timeout);checks++;
 await map.press('End');await page.waitForFunction(()=>{const el=document.querySelector('.comparison-object-results');return el.scrollTop>=el.scrollHeight-el.clientHeight-2;},null,timeout);ok(await bookmarks.last().getAttribute('aria-current')==='location','active section follows map/scroll navigation');
 await map.press('Home');await map.press('PageDown');await page.waitForFunction(()=>document.querySelector('.comparison-object-results').scrollTop>0,null,timeout);const down=await area.evaluate(el=>el.scrollTop);await map.press('ArrowUp');await page.waitForFunction(before=>document.querySelector('.comparison-object-results').scrollTop<before,down,timeout);checks++;
 await map.press('Home');const marker=page.locator('.comparison-object-map-marker').nth(Math.floor(initial.cards*.6)),index=Number(await marker.getAttribute('data-object-map-index'));await marker.click();
 await page.waitForFunction(index=>{const area=document.querySelector('.comparison-object-results'),card=area.querySelectorAll('.comparison-card')[index],a=area.getBoundingClientRect(),b=card.getBoundingClientRect();return b.top>=a.top-2&&b.top<a.bottom;},index,timeout);checks++;
 const beforeExpand=await area.evaluate(el=>el.scrollHeight);await page.locator('.comparison-card').nth(index).locator('details summary').click();const expanded=await objectNavigationGeometry(page,'expanded variable object');ok(expanded.total>beforeExpand,'expanding original settings updates actual minimap content geometry');
 await mapDrag(page,'object');await mapAnyPointDrag(page,'object');await objectNavigationGeometry(page,'object after captured drag');await page.screenshot({path:'test-results/comparison-object-navigation.png'});
 for(const viewport of [{width:1000,height:650},{width:800,height:600}]){await page.setViewportSize(viewport);await collapseCheck(page,'.comparison-object-results','object navigation '+viewport.width);await objectNavigationGeometry(page,'object navigation resized '+viewport.width);await visibleControl(page,'.comparison-bookmarks','section sidebar');await visibleControl(page,'.comparison-object-minimap','object map');}
 await page.locator('[data-action="compare-swap"]:visible').click();await objectNavigationGeometry(page,'object navigation swapped');ok((await page.locator('.comparison-loader-summary > span').first().innerText()).includes('example-right.conf'),'centered object swap changes side ownership');
 await page.selectOption('#table-filter','Added');await objectNavigationGeometry(page,'added object filter');ok(await page.locator('.comparison-object-map-marker').evaluateAll(markers=>markers.length>0&&markers.every(marker=>marker.dataset.objectMapKind==='added')),'object filter refreshes map states');
 await page.locator('#table-query').fill('no-synthetic-object-matches');await page.waitForFunction(()=>!document.querySelector('.comparison-card'),null,timeout);ok(await bookmarks.count()===0&&await page.locator('.comparison-object-map-marker').count()===0,'empty results leave no stale section bookmark or object marker');await layout(page,'navigation empty search','.comparison-object-results');
 await page.locator('#table-query').fill('');await page.selectOption('#table-filter','all-items');await page.locator('#compare-file').setInputFiles(upload('matching-navigation.conf',navigationConfiguration(true)));await page.locator('#modal').waitFor({state:'hidden'});await objectNavigationGeometry(page,'object navigation replacement');ok(await page.locator('.comparison-object-map-marker').evaluateAll(markers=>markers.length>0&&markers.every(marker=>marker.dataset.objectMapKind==='unchanged')),'replacing the opposite side refreshes map to unchanged objects');
 await expandLoaders(page);await page.locator('[data-action="compare-clear-right"]').click();ok(await bookmarks.count()===0&&await page.locator('.comparison-object-map-marker').count()===0,'clearing a side removes stale object navigation');ok(errors.length===0,errors.join('\n'));await page.close();
}
async function fieldNavigation(browser){
 const page=await browser.newPage({viewport:{width:1000,height:650}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await openComparison(page,fieldConfiguration(false),fieldConfiguration(true));await page.locator('[data-compare-mode="fields"]').click();await collapseCheck(page,'.comparison-field-results .data-wrap','original field navigation');
 const initial=await fieldNavigationGeometry(page,'field map initial');ok(initial.rows===40&&initial.heights.length>1,'original-field fixture has a full page of variable-height rows');
 await mapDrag(page,'fields');await mapAnyPointDrag(page,'fields');const map=page.locator('.comparison-field-minimap');await map.press('End');await page.waitForFunction(()=>{const area=document.querySelector('.comparison-field-results .data-wrap');return area.scrollTop>=area.scrollHeight-area.clientHeight-2;},null,timeout);await map.press('Home');await map.press('PageDown');await page.waitForFunction(()=>document.querySelector('.comparison-field-results .data-wrap').scrollTop>0,null,timeout);checks++;
 await page.locator('[aria-label="Next page"]').click();const second=await fieldNavigationGeometry(page,'field map page two');ok(second.rows===40&&!second.keys.some(key=>initial.keys.includes(key)),'field map follows the newly rendered page rather than stale rows');
 await page.selectOption('#page-size','100');const larger=await fieldNavigationGeometry(page,'field map100 rows');ok(larger.rows>40&&larger.rows<=100,'field map remains bounded by the selected100-row page');
 for(const kind of ['Added','Removed','Changed']){await page.selectOption('#table-filter',kind);const filtered=await fieldNavigationGeometry(page,'field map '+kind);ok(filtered.rows>0&&filtered.kinds.length===1&&filtered.kinds[0]===kind.toLowerCase(),'original-field '+kind+' filter refreshes map states');}
 await page.selectOption('#table-filter','all');await page.setViewportSize({width:800,height:600});await fieldNavigationGeometry(page,'field map small');await layout(page,'field map small','.comparison-field-results .data-wrap');await visibleControl(page,'.comparison-field-minimap','original-field map');await page.screenshot({path:'test-results/comparison-field-navigation.png'});
 await page.locator('#table-query').fill('no-synthetic-field-matches');const empty=await fieldNavigationGeometry(page,'field map empty filter');ok(empty.rows===0,'empty field filter clears map markers');
 await page.locator('#table-query').fill('');await page.locator('#compare-file').setInputFiles(upload('identical-fields.conf',fieldConfiguration(false)));await page.locator('#modal').waitFor({state:'hidden'});const same=await fieldNavigationGeometry(page,'field map identical inputs');ok(same.rows===0&&await map.getAttribute('aria-disabled')==='true','identical inputs leave no stale field map or active scroll range');ok(errors.length===0,errors.join('\n'));await page.close();
}
async function unifiedComparisonInputs(browser){
 const page=await browser.newPage({viewport:{width:1000,height:650}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await openComparison(page,stateConfiguration(false),stateConfiguration(true));
 async function snapshot(){return page.evaluate(()=>{const collapsed=document.querySelector('#content').classList.contains('compare-loaders-collapsed'),container=document.querySelector(collapsed?'.comparison-loader-summary':'.comparison-loaders .compare-files'),sides=[...container.querySelectorAll(collapsed?':scope > span':'.compare-file')],swap=container.querySelector('.comparison-swap'),s=getComputedStyle(swap);function rect(el){const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}return {collapsed,container:rect(container),sides:sides.map(rect),swap:rect(swap),swapStyle:[s.backgroundColor,s.color,s.border,s.borderRadius,s.padding],icon:swap.querySelector('svg')?.innerHTML};});}
 function sameGeometry(a,b,label,crossMode=false){for(const name of ['container','swap']){const keys=crossMode?(name==='swap'?['x','width','height']:['x','y','width']):['x','y','width','height'];ok(keys.every(key=>Math.abs(a[name][key]-b[name][key])<=2),label+' '+name+' position/dimensions are stable: '+JSON.stringify([a[name],b[name]]));}for(let i=0;i<2;i++)ok((crossMode?['x','y','width']:['x','y','width','height']).every(key=>Math.abs(a.sides[i][key]-b.sides[i][key])<=2),label+' side '+i+' position/dimensions are stable: '+JSON.stringify([a.sides[i],b.sides[i]]));}
 for(const collapsed of [false,true]){
  if(collapsed)await page.locator('[data-action="compare-loaders-toggle"]').click();let reference;
  for(const mode of ['records','fields','text']){
   await page.locator('[data-compare-mode="'+mode+'"]').click();const before=await snapshot();ok(before.collapsed===collapsed,'mode switching preserves loader expansion state');await swapControl(page,'shared '+mode+(collapsed?' collapsed':' expanded'));
   if(reference){sameGeometry(reference,before,'cross-mode '+mode,true);ok(JSON.stringify(reference.swapStyle)===JSON.stringify(before.swapStyle)&&reference.icon===before.icon,'all modes share swap styling and arrow design');}else reference=before;
   if(mode==='text')ok(await page.locator('.stc-toolbar .stc-mask-toggle[data-action="toggle-sensitive"]').count()===1&&await page.locator('.comparison-text-mask').count()===0,'loaded-source secrets control lives in the text toolbar, not above the inputs');
   ok(!(await page.locator('#content').innerHTML()).includes('TEST_SECRET_ONLY_'),mode+' starts with loaded secrets masked');await page.locator('#content [data-action="toggle-sensitive"]:visible').first().click();ok((await page.locator('#content').innerHTML()).includes('TEST_SECRET_ONLY_'),mode+' reveal action still shows the loaded synthetic secret');sameGeometry(before,await snapshot(),mode+' secret toggle');
   await page.locator('#content [data-action="toggle-sensitive"]:visible').first().click();ok(!(await page.locator('#content').innerHTML()).includes('TEST_SECRET_ONLY_'),mode+' hides loaded secrets again');metrics.push({label:'unified inputs '+mode+(collapsed?' collapsed':' expanded'),...before});
  }
  if(!collapsed)await page.screenshot({path:'test-results/comparison-unified-inputs-expanded.png'});
 }
 ok(errors.length===0,errors.join('\n'));await page.close();
}
async function textComparison(browser){
 const page=await browser.newPage({viewport:{width:1000,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+path.resolve('webview/index.html'));
 await page.locator('[data-view="compare"]').first().click();await page.locator('[data-compare-mode="text"]').click();
 ok(await page.locator('.sw-text-comparison').isVisible(),'direct text mode works without a parsed configuration');await layout(page,'text no loaded inputs','.stc-empty');
 await page.locator('[data-stc-action="replace"][data-stc-side="left"]').click();await page.locator('#stc-input-text').fill('Discarded draft');await page.locator('[data-stc-action="cancel"]').click();
 ok(await page.locator('.stc-editor').count()===0,'paste cancellation closes editor without replacing input');
 const left=Array.from({length:620},(_,i)=>`line ${String(i+1).padStart(4,'0')} = ${i===0?'<img src=x onerror=alert(1)>':i===1?'TEST_SECRET_ONLY_DIRECT_TEXT':'example'} ${'wide-config-value-'.repeat(12)}`);
 const right=left.slice();right[7]=right[7].replace('example','changed');right[560]=right[560].replace('example','revised');right.splice(70,0,'inserted right-only line');right.splice(121,1);
 await pasteText(page,'left',left.join('\n'),'Example <left>');await textFile(page,'right',right.join('\n'),'example-right.txt');
 ok(await page.locator('[data-stc-pane="left"] .stc-line').count()===500,'bounded 500-row text page');
 ok(await page.locator('.sw-text-comparison img').count()===0,'raw text markup is escaped');ok((await page.locator('[data-stc-pane="left"]').innerText()).includes('<img src=x onerror=alert(1)>'),'literal markup retained');
 await page.locator('.stc-mask-toggle').click();ok((await page.locator('[data-stc-pane="left"]').innerText()).includes('TEST_SECRET_ONLY_DIRECT_TEXT'),'loaded-source secrets toggle does not replace or silently redact acknowledged direct text');await page.locator('.stc-mask-toggle').click();
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
 await mapDrag(page,'text');await mapAnyPointDrag(page,'text');
 await map.press('F7');await map.press('F7');const keyboardRow=Number(await page.locator('[data-stc-pane="left"] .stc-active').first().getAttribute('data-stc-row'));await map.press('Shift+F7');ok(Number(await page.locator('[data-stc-pane="left"] .stc-active').first().getAttribute('data-stc-row'))<keyboardRow,'F7 and Shift+F7 still navigate differences after dragging');
 await page.locator('[data-stc-action="swap"]:visible').click();ok((await page.locator('.stc-pane-title').first().innerText()).includes('example-right.txt'),'swap changes text side ownership');
 await page.locator('[data-compare-mode="records"]').click();await page.locator('[data-compare-mode="text"]').click();ok((await page.locator('.stc-pane-title').first().innerText()).includes('example-right.txt'),'direct text survives mode switching');
 for(const size of [{width:1440,height:960},{width:800,height:600}]){await page.setViewportSize(size);await collapseCheck(page,'[data-stc-pane="left"]','text '+size.width);await panesSynchronized(page);await visibleControl(page,'[data-stc-action="next"]','text difference controls');const m=await page.locator('.stc-map-viewport').boundingBox(),b=await map.boundingBox();ok(m&&b&&m.height>0&&m.y>=b.y-1&&m.y+m.height<=b.y+b.height+2,'minimap viewport marker remains bounded after resize');}
 await layout(page,'text compact final','[data-stc-pane="left"]');
 await page.locator('[data-stc-pane="left"]').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/comparison-text.png'});
 await pasteText(page,'left','same\n','Same left');await pasteText(page,'right','same\n','Same right');ok((await page.locator('.sw-text-comparison').innerText()).includes('No text differences'),'identical direct text reports no differences');
 ok(await page.locator('.stc-map-marker').count()===0,'text replacement removes stale changed-line markers');
 ok(await page.locator('[data-stc-action="next"]').isDisabled(),'no next difference on identical text');
 await expandLoaders(page);await page.locator('[data-stc-action="replace"][data-stc-side="right"]').click();await page.locator('#stc-input-text').fill('never committed');await page.locator('[data-stc-action="save"]').click();ok((await page.locator('.stc-error').innerText()).includes('Confirm'),'unmasked direct text requires acknowledgment');await page.locator('.stc-editor').press('Escape');ok(await page.locator('.stc-editor').count()===0,'Escape cancels text editor');
 await page.locator('[data-stc-action="clear"][data-stc-side="left"]').click();ok((await page.locator('.comparison-loaders').innerText()).includes('Same right'),'clearing left text preserves right input');ok(await page.locator('[data-stc-action="replace"][data-stc-side="left"]').isEnabled(),'empty text side stays replaceable');
 await textFile(page,'left','same\n','restored-left.txt');ok((await page.locator('.sw-text-comparison').innerText()).includes('No text differences'),'file replacement restores equal comparison');await page.locator('[data-stc-action="clear"][data-stc-side="right"]').click();ok((await page.locator('.comparison-loaders').innerText()).includes('restored-left.txt'),'clearing right text preserves left input');
 ok(errors.length===0,errors.join('\n'));await page.close();
}
(async()=>{
 fs.mkdirSync('test-results',{recursive:true});const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})}),failures=[];
 try{
  for(const [name,run] of [['objects-scrolling',objectsAndScrolling],['object-states',objectStates],['object-navigation',objectNavigation],['field-navigation',fieldNavigation],['unified-inputs',unifiedComparisonInputs],['text-comparison',textComparison]]){
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

const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(value,message){checks++;assert.ok(value,message);}
const timeout={timeout:5000};
function configuration(revision){return 'version 15.2\nhostname Example-Comparison\n'+Array.from({length:65},(_,i)=>`interface GigabitEthernet1/0/${i+1}\n description Example ${revision} port ${i+1}\n switchport access vlan 10\n exit\n`).join('');}
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
async function wheel(page,selector,dy=500){
 const area=page.locator(selector);await area.scrollIntoViewIfNeeded();
 await area.evaluate(el=>{el.scrollTop=0;});await area.hover();await page.mouse.wheel(0,dy);
 await page.waitForFunction(selector=>document.querySelector(selector).scrollTop>0,selector,timeout);
 ok(await area.evaluate(el=>el.scrollTop>0),selector+' responds to wheel');
}
async function panesSynchronized(page){
 await page.waitForFunction(()=>{const a=document.querySelector('[data-stc-pane="left"]'),b=document.querySelector('[data-stc-pane="right"]');return a&&b&&Math.abs(a.scrollTop-b.scrollTop)<2&&Math.abs(a.scrollLeft-b.scrollLeft)<2;},null,timeout);checks++;
}
async function pasteText(page,side,text,name){
 await page.locator(`[data-stc-action="paste"][data-stc-side="${side}"]`).click();
 await page.locator('#stc-input-name').fill(name||'Example '+side);
 await page.locator('#stc-input-text').fill(text);
 await page.locator('#stc-unmasked-ack').check();
 await page.locator('[data-stc-action="save"]').click();
 await page.locator('.stc-editor').waitFor({state:'detached'});
}
async function textFile(page,side,text,name){
 await page.locator(`[data-stc-action="file"][data-stc-side="${side}"]`).click();
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
  ok(await page.locator('#content').evaluate(el=>el.scrollHeight>el.clientHeight&&getComputedStyle(el).overflowY==='auto'),'comparison owns vertical overflow');
  await wheel(page,'#content');
  const mode=page.locator('[data-compare-mode="records"]');await mode.focus();await page.locator('#content').evaluate(el=>{el.scrollTop=0;});await mode.press('PageDown');
  await page.waitForFunction(()=>document.querySelector('#content').scrollTop>0,null,timeout);checks++;
  const details=page.locator('.comparison-card details').first();await details.locator('summary').click();ok(await details.getAttribute('open')!==null,'original object settings expand');
  ok(await page.locator('.comparison-card').first().locator('.object-side').count()===2,'paired GUI object identities');
  if(viewport.width===1440){await page.locator('.comparison-card').first().scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/comparison-objects.png'});}
  await page.locator('[aria-label="Next changes"]').click();ok(await page.locator('.comparison-card').count()===25,'bottom pagination reachable');
  await page.locator('[aria-label="Previous changes"]').click();ok(await page.locator('.comparison-card').count()===40,'return to first object page');
  await page.locator('[data-compare-mode="fields"]').click();await page.locator('.data-wrap tbody tr').first().waitFor();
  await wheel(page,'#content .data-wrap');
  const row=page.locator('.data-wrap tbody tr').first();await row.focus();await page.locator('.data-wrap').evaluate(el=>{el.scrollTop=0;});await row.press('PageDown');
  await page.waitForFunction(()=>document.querySelector('.data-wrap').scrollTop>0,null,timeout);checks++;
  await page.locator('[aria-label="Next page"]').click();ok(await page.locator('[aria-label="Previous page"]').isEnabled(),'original field pagination reachable');
  await page.locator('[data-compare-mode="records"]').click();await wheel(page,'#content');
  await page.locator('[data-action="compare-swap"]').click();await wheel(page,'#content');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'comparison stays within viewport');ok(errors.length===0,errors.join('\n'));await page.close();
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
 await page.locator('#compare-file').setInputFiles(upload('identical.conf',stateConfiguration(false)));await page.locator('#modal').waitFor({state:'hidden'});
 ok(await page.locator('.comparison-card').count()===0,'identical configs show no changed objects');await page.selectOption('#table-filter','Unchanged');ok(await page.locator('.comparison-card').count()>0,'identical objects remain accessible');
 ok(errors.length===0,errors.join('\n'));await page.close();
}
async function textComparison(browser){
 const page=await browser.newPage({viewport:{width:1000,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+path.resolve('webview/index.html'));
 await page.locator('[data-view="compare"]').first().click();await page.locator('[data-compare-mode="text"]').click();
 ok(await page.locator('.sw-text-comparison').isVisible(),'direct text mode works without a parsed configuration');
 await page.locator('[data-stc-action="paste"][data-stc-side="left"]').click();await page.locator('#stc-input-text').fill('Discarded draft');await page.locator('[data-stc-action="cancel"]').click();
 ok(await page.locator('.stc-editor').count()===0,'paste cancellation closes editor without replacing input');
 const left=Array.from({length:620},(_,i)=>`line ${String(i+1).padStart(4,'0')} = ${i===0?'<img src=x onerror=alert(1)>':'example'} ${'wide-config-value-'.repeat(12)}`);
 const right=left.slice();right[7]=right[7].replace('example','changed');right[560]=right[560].replace('example','revised');right.splice(70,0,'inserted right-only line');right.splice(121,1);
 await pasteText(page,'left',left.join('\n'),'Example <left>');await textFile(page,'right',right.join('\n'),'example-right.txt');
 ok(await page.locator('[data-stc-pane="left"] .stc-line').count()===500,'bounded 500-row text page');
 ok(await page.locator('.sw-text-comparison img').count()===0,'raw text markup is escaped');ok((await page.locator('[data-stc-pane="left"]').innerText()).includes('<img src=x onerror=alert(1)>'),'literal markup retained');
 ok(await page.locator('.stc-added').count()>1&&await page.locator('.stc-removed').count()>1&&await page.locator('.stc-changed').count()>1,'added, removed and changed lines highlighted');
 const pane='[data-stc-pane="left"]';await wheel(page,pane);await panesSynchronized(page);
 await wheel(page,'[data-stc-pane="right"]',800);await panesSynchronized(page);
 await page.locator(pane).evaluate(el=>{el.scrollTop=0;});await page.locator(pane).focus();await page.locator(pane).press('PageDown');await page.waitForFunction(()=>document.querySelector('[data-stc-pane="left"]').scrollTop>0,null,timeout);await panesSynchronized(page);
 await page.locator(pane).hover();await page.mouse.wheel(450,0);await page.waitForFunction(()=>document.querySelector('[data-stc-pane="left"]').scrollLeft>0,null,timeout);await panesSynchronized(page);
 await page.locator('[data-stc-action="next"]').click();ok(await page.locator('.stc-active').count()>0,'next difference highlights a block');
 for(let step=0;step<3;step++)await page.locator('[data-stc-action="next"]').click();
 ok(await page.locator('[data-stc-action="next"]').isDisabled(),'last difference bounds navigation');
 ok(Number(await page.locator('[data-stc-pane="left"] .stc-active').first().getAttribute('data-stc-row'))>=500,'difference navigation crosses aligned-row pages');
 await page.locator('[data-stc-action="previous"]').click();ok(Number(await page.locator('[data-stc-pane="left"] .stc-active').first().getAttribute('data-stc-row'))<500,'previous difference returns across pages');
 await page.locator('[data-stc-action="page-next"]').click();ok(await page.locator('[data-stc-pane="left"] .stc-line').count()<500,'remaining aligned rows are reachable');await page.locator('[data-stc-action="page-previous"]').click();
 await page.locator('[data-stc-action="swap"]').click();ok((await page.locator('.stc-pane-title').first().innerText()).includes('example-right.txt'),'swap changes text side ownership');
 await page.locator('[data-compare-mode="records"]').click();await page.locator('[data-compare-mode="text"]').click();ok((await page.locator('.stc-pane-title').first().innerText()).includes('example-right.txt'),'direct text survives mode switching');
 await page.setViewportSize({width:800,height:600});ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'two text panes fit small window');
 await page.locator('[data-stc-pane="left"]').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/comparison-text.png'});
 await pasteText(page,'left','same\n','Same left');await pasteText(page,'right','same\n','Same right');ok((await page.locator('.sw-text-comparison').innerText()).includes('No text differences'),'identical direct text reports no differences');
 ok(await page.locator('[data-stc-action="next"]').isDisabled(),'no next difference on identical text');
 await page.locator('[data-stc-action="paste"][data-stc-side="right"]').click();await page.locator('#stc-input-text').fill('never committed');await page.locator('[data-stc-action="save"]').click();ok((await page.locator('.stc-error').innerText()).includes('Confirm'),'unmasked direct text requires acknowledgment');await page.locator('.stc-editor').press('Escape');ok(await page.locator('.stc-editor').count()===0,'Escape cancels text editor');
 ok(errors.length===0,errors.join('\n'));await page.close();
}
(async()=>{
 fs.mkdirSync('test-results',{recursive:true});const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{await objectsAndScrolling(browser);await objectStates(browser);await textComparison(browser);console.log(checks+' comparison browser checks passed');}
 catch(error){for(const [i,page] of browser.contexts().flatMap(context=>context.pages()).entries()){await page.screenshot({path:`test-results/comparison-failure-${i}.png`}).catch(()=>{});fs.writeFileSync(`test-results/comparison-failure-${i}.html`,await page.content().catch(()=>''));}throw error;}
 finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});

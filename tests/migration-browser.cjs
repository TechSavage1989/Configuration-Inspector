// Migration validation stays responsive on large switch exports.
const assert=require('node:assert/strict'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
function cfg(revised){
 const L=['version 16.12','hostname MIGRATE-SW1','spanning-tree mode rapid-pvst'];
 [[10,'USERS'],[20,'VOICE'],[30,'PRINTERS'],[99,'MANAGEMENT']].concat(revised?[[50,'CAMERAS']]:[]).forEach(([v,n])=>L.push('vlan '+v,' name '+n));
 for(let m=1;m<=4;m++)for(let p=1;p<=48;p++){L.push('interface GigabitEthernet'+m+'/0/'+p);if(p<=40)L.push(' description Workstation '+m+'-'+p,' switchport mode access',' switchport access vlan '+(revised&&m===1&&p===14?30:10),' switchport voice vlan 20');}
 for(let m=1;m<=4;m++)L.push('interface TenGigabitEthernet'+m+'/1/1',' description Uplink to DEMO-CORE',' switchport mode trunk',' switchport trunk allowed vlan 10,20,30,'+(revised?'50,':'')+'99',' channel-group 1 mode active');
 L.push('interface Port-channel1',' switchport mode trunk',' switchport trunk allowed vlan 10,20,30,'+(revised?'50,':'')+'99');
 L.push('ip access-list extended '+(revised?'MGMT-NEW':'MGMT-OLD'),' permit tcp 10.0.99.0 0.0.0.255 any eq 22');
 L.push('interface Vlan99',' ip address 10.0.99.10 255.255.255.0','ip default-gateway 10.0.99.1');
 return L.join('\n')+'\n';
}
const file=(name,text)=>({name,mimeType:'text/plain',buffer:Buffer.from(text)});
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('[data-view="compare"]').first().click();
  await page.locator('#compare-left-file').setInputFiles(file('original.conf',cfg(false)));await page.locator('#modal').waitFor({state:'hidden'});
  await page.locator('#compare-file').setInputFiles(file('migrated.conf',cfg(true)));await page.locator('#modal').waitFor({state:'hidden'});
  const started=Date.now();await page.locator('[data-compare-mode="migration"]').click();await page.locator('.migration-review').waitFor({timeout:15000});const elapsed=Date.now()-started;
  ok(elapsed<5000,'migration view opens quickly for 200 ports: '+elapsed+' ms');
  ok((await page.locator('.migration-intro').innerText()).includes('original'),'the view explains what it is for');
  const pills=await page.locator('[data-migration-filter]').allInnerTexts();ok(pills[0].startsWith('Needs attention'),'Needs attention is the first filter: '+pills.join(' | '));
  ok(await page.locator('[data-migration-filter="attention"]').getAttribute('aria-pressed')==='true','attention items are shown by default');
  const shown=await page.locator('.migration-item').count();ok(shown>0&&shown<=50,'at most one page of items is rendered: '+shown);
  ok(await page.locator('.migration-item select').count()===0,'item details are not built until opened');
  ok(await page.locator('.migration-item .chip').evaluateAll(cs=>cs.every(c=>!/Same settings/.test(c.textContent))),'matching objects are hidden in Needs attention');
  const port=page.locator('.migration-item').filter({hasText:'GigabitEthernet1/0/14'}).first();ok(await port.count()===1,'the changed port needs attention');
  await port.locator('summary').click();await port.locator('.migration-body table').waitFor();
  ok((await port.locator('tr.migration-diff').allInnerTexts()).some(t=>/Untagged VLANs\t10\t30/.test(t.replace(/\s*\t\s*/g,'\t'))),'the difference is shown with readable labels');
  const acl=page.locator('.migration-item').filter({hasText:'MGMT-OLD'}).first();await acl.locator('summary').click();await acl.locator('select').waitFor();
  const options=await acl.locator('select option').allInnerTexts();ok(options.includes('MGMT-NEW'),'a renamed object can be matched manually');
  await acl.locator('select').selectOption({label:'MGMT-NEW'});await page.waitForTimeout(300);
  ok(await page.locator('.migration-item').filter({hasText:'MGMT-OLD → MGMT-NEW'}).count()===1,'the manual match is applied');
  await page.locator('[data-migration-filter="all"]').click();
  ok(await page.locator('.migration-item').count()===50&&await page.locator('[data-migration-page]').count()===2,'all objects are paged');
  await page.locator('[data-migration-page="2"]').click();ok((await page.locator('.migration-review .pagination').innerText()).includes('2 /'),'second page');
  const clicks=Date.now();await page.locator('[data-migration-filter="attention"]').click();ok(Date.now()-clicks<2000,'switching filters reuses the cached analysis');
  ok(errors.length===0,errors.join('\n'));
  console.log(checks+' migration validation browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

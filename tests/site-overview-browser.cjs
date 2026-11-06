// Site overview view with several open configurations.
const assert=require('node:assert/strict'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const base=(host,o)=>'version 16.12\nhostname '+host+'\nntp server '+(o.ntp||'192.0.2.123')+'\nip name-server 192.0.2.53\n'+(o.log===false?'':'logging host 192.0.2.5\n')+'username admin privilege 15 secret TEST_SECRET_ONLY\n'+(o.extraUser?'username contractor privilege 1 secret TEST_SECRET_ONLY\n':'')+
 'spanning-tree mode '+(o.stp||'rapid-pvst')+'\nvlan 10\n name '+(o.vlan10||'USERS')+'\nvlan 99\n name MANAGEMENT\n'+o.body;
const files=[
 ['core-sw1.conf',base('CORE-SW1',{body:'interface GigabitEthernet1/0/1\n description Uplink to ACCESS-SW2 Gi1/0/48\n switchport mode trunk\ninterface Vlan99\n ip address 10.0.99.1 255.255.255.0\n'})],
 ['access-sw2.conf',base('ACCESS-SW2',{body:'interface GigabitEthernet1/0/48\n description Uplink to CORE-SW1 Gi1/0/1\n switchport mode trunk\ninterface Vlan99\n ip address 10.0.99.12 255.255.255.0\n'})],
 ['access-sw3.conf',base('ACCESS-SW3',{ntp:'192.0.2.124',log:false,extraUser:true,stp:'pvst',vlan10:'STAFF',body:'interface GigabitEthernet1/0/48\n description Uplink to CORE-SW1 Gi1/0/2\n switchport mode trunk\ninterface Vlan99\n ip address 10.0.99.12 255.255.255.0\n'})]
].map(([name,text])=>({name,mimeType:'text/plain',buffer:Buffer.from(text)}));
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles(files.slice(0,1));await page.waitForFunction(()=>document.querySelectorAll('[data-remove-workspace]').length===1);
  ok(await page.locator('[data-view="site"]').count()===0,'no Site overview with a single configuration');
  await page.locator('#import-file').setInputFiles(files.slice(1));await page.waitForFunction(()=>document.querySelectorAll('[data-remove-workspace]').length===3);
  await page.locator('[data-view="site"]').first().click();await page.locator('.site-summary').waitFor();
  const chips=await page.locator('.site-summary .chip').allInnerTexts();
  ok(chips.join('|')==='3 devices|3 settings differ|1 duplicate address|1 VLAN name differs|1 shared subnet','summary chips: '+chips.join('|'));
  const tabs=await page.locator('[data-site-tab]').allInnerTexts();
  ok(tabs.map(t=>t.replace(/\s+/g,' ')).join('|')==='Settings 5|VLANs 2|Duplicate addresses 1|Shared subnets 1|Device mentions 3','one tab per section with counts: '+tabs.join('|'));
  ok(await page.locator('.site-panel').count()===1&&await page.locator('[data-site-tab="settings"][aria-pressed="true"]').count()===1,'settings open first, one section at a time');
  const status=key=>page.locator('[data-site-setting="'+key+'"]').getAttribute('data-site-status');
  ok(await status('ntp')==='differs'&&await status('dns')==='same'&&await status('syslog')==='partial'&&await status('users')==='differs'&&await status('stp')==='differs','setting statuses');
  ok((await page.locator('[data-site-setting="ntp"] td.site-odd').allInnerTexts()).join()==='192.0.2.124','only the minority NTP value is highlighted');
  ok((await page.locator('[data-site-setting="syslog"] td.site-missing').innerText())==='Not in export','a missing setting is labeled, not treated as different');
  await page.locator('[data-site-tab="vlans"]').click();
  ok(await page.locator('[data-site-vlan="10"]').getAttribute('data-site-status')==='name-differs','VLAN 10 name difference');
  ok((await page.locator('[data-site-vlan="10"] td.site-odd').innerText()).startsWith('STAFF'),'the minority VLAN name is highlighted');
  await page.locator('[data-site-tab="duplicates"]').click();
  ok((await page.locator('[data-site-duplicate="10.0.99.12"] td').innerText()).includes('ACCESS-SW2 / Vlan99')&&(await page.locator('[data-site-duplicate="10.0.99.12"] td').innerText()).includes('ACCESS-SW3 / Vlan99'),'duplicate address lists both devices');
  await page.locator('[data-site-tab="subnets"]').click();
  ok(await page.locator('[data-site-subnet="10.0.99.0/24"]').count()===1,'shared management subnet');
  await page.locator('[data-site-tab="mentions"]').click();
  ok(await page.locator('[data-site-mention]').count()===3,'three descriptions name another device');
  ok(!(await page.locator('#content').innerText()).includes('TEST_SECRET_ONLY'),'no secrets on the page');
  await page.locator('[data-site-tab="settings"]').click();
  const layout=await page.evaluate(()=>{const c=document.getElementById('content');return {list:c.classList.contains('list-view'),panels:[...document.querySelectorAll('.site-panel')].every(p=>p.getBoundingClientRect().height>80),nested:[...c.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return /auto|scroll/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+1;}).length};});
  ok(!layout.list&&layout.panels&&layout.nested===0,'the page scrolls as one with no scroll areas inside it: '+JSON.stringify(layout));
  const pins=await page.evaluate(()=>{const c=document.getElementById('content'),bar=c.querySelector('.site-tabs'),panels=[...c.querySelectorAll('.site-panel')];return panels.map(p=>{const h=p.querySelector(':scope > .panel-head'),t=p.querySelector('thead');return [h&&h.getAttribute('data-pinned'),t&&t.getAttribute('data-pinned'),t&&h?parseFloat(t.style.top)===h.offsetHeight+bar.offsetHeight:null,bar.getAttribute('data-pinned')];});});
  ok(pins.length&&pins.every(x=>x[3]==='true'&&x[0]==='true'&&(x[1]===null||x[1]==='true')&&x[2]!==false),'the tab row, panel title and column headings stay pinned while scrolling: '+JSON.stringify(pins));
  // Devices named in the overview link to their configuration at the named interface.
  await page.locator('[data-site-tab="duplicates"]').click();await page.waitForTimeout(300);
  const dl=await page.locator('[data-site-duplicate="10.0.99.12"] .entity-link').allInnerTexts();
  ok(dl.includes('ACCESS-SW2')&&dl.includes('ACCESS-SW3')&&!dl.includes('10.0.99.12'),'device names link; an address on two devices does not: '+dl.join(','));
  await page.locator('[data-site-duplicate="10.0.99.12"] .entity-link').filter({hasText:'ACCESS-SW2'}).click();await page.locator('#drawer[open]').waitFor();
  const opened={h1:await page.locator('h1').innerText(),drawer:(await page.locator('#drawer').innerText()).slice(0,200),heading:await page.locator('#page-heading').innerText()};
  ok(opened.h1==='Interfaces'&&opened.drawer.includes('Vlan99')&&opened.heading.includes('ACCESS-SW2'),'a device link opens its configuration at the interface: '+JSON.stringify(opened));
  await page.keyboard.press('Escape');await page.locator('[data-view="site"]').first().click();await page.locator('.site-summary').waitFor();
  await page.locator('[data-remove-workspace="2"]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-remove-workspace]').length===2);
  await page.locator('[data-view="site"]').first().click();await page.locator('.site-summary').waitFor();
  ok((await page.locator('.site-summary .chip').allInnerTexts()).join('|')==='2 devices|Common settings match|No duplicate addresses|VLAN names match|1 shared subnet','the overview updates when a configuration is closed: '+(await page.locator('.site-summary .chip').allInnerTexts()).join('|'));
  await page.locator('[data-remove-workspace="1"]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-remove-workspace]').length===1);
  ok(await page.locator('[data-view="site"]').count()===0,'the nav item disappears with one configuration');
  ok(errors.length===0,errors.join('\n'));
  console.log(checks+' site overview browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

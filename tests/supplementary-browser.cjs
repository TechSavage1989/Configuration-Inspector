// Supplementary data in the app: site map, live interface data and the data page.
const assert=require('node:assert/strict'),path=require('node:path'),{demoSite}=require('./xlsx-writer.cjs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const L=['version 16.12','hostname EXAMPLE-ACCESS1','vlan 10',' name USERS','vlan 30',' name WIRELESS'];
for(let p=1;p<=8;p++)L.push('interface GigabitEthernet1/0/'+p,' switchport mode access',' switchport access vlan '+(p===1?30:10));
L.push('interface TenGigabitEthernet1/1/1',' switchport mode trunk','interface Vlan99',' ip address 10.0.99.11 255.255.255.0');
const cfg=L.join('\n')+'\n';
const SHOW='EXAMPLE-ACCESS1#show interfaces status\n\nPort      Name               Status       Vlan       Duplex  Speed Type\nGi1/0/4   Desk 4             connected    10         a-full a-1000 10/100/1000BaseTX\n';
const file=(name,buffer,type)=>({name,mimeType:type||'text/plain',buffer:Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer)});
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  // Supplementary data alone builds a site map.
  await page.locator('#import-file').setInputFiles(file('example-site.xlsx',demoSite(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
  await page.locator('.site-map').waitFor({timeout:15000});
  ok((await page.locator('h1').innerText())==='Site map','a site export opens the site map');
  const nav=await page.locator('[data-nav-group="workspace"] [data-view]').evaluateAll(n=>n.map(x=>x.dataset.view));
  ok(nav.includes('sitemap')&&nav.includes('evidence'),'site map and supplementary data in the sidebar: '+nav.join(','));
  ok(await page.locator('.site-node').count()===5,'infrastructure devices are drawn');
  const y=name=>page.locator('.site-node').filter({hasText:name}).first().evaluate(n=>n.getBoundingClientRect().top);
  ok(await y('EXAMPLE-FW1')<await y('EXAMPLE-CORE')&&await y('EXAMPLE-CORE')<await y('EXAMPLE-ACCESS1'),'tiers from the firewall down');
  ok((await page.locator('.site-node').filter({hasText:'EXAMPLE-ACCESS1'}).textContent()).includes('1 AP · 1 device'),'attached access points and devices are summarized');
  ok(await page.locator('.site-edge').count()===4,'links between infrastructure devices');
  await page.locator('#sitemap-access').check();ok(await page.locator('.site-node').count()===7,'access points can be shown');await page.locator('#sitemap-access').uncheck();
  await page.locator('.site-node').filter({hasText:'EXAMPLE-CORE'}).click();await page.locator('.site-map-detail').waitFor();
  const detail=await page.locator('.site-map-detail').innerText();ok(detail.includes('EXAMPLE-CORE-0001')&&detail.includes('TenGigabitEthernet1/0/11'),'device details list its connections');
  ok(await page.locator('.site-map-detail table').count()===0&&await page.locator('.site-map-detail .device-info-row').count()>=3&&await page.locator('.site-map-detail .site-link-row').count()===4,'the device panel uses the standard side panel rows, with one row per connection');
  await page.locator('.site-map-detail [data-sitemap-node="exampleaccess2"]').click();ok((await page.locator('.site-map-detail .panel-title').first().innerText()).includes('EXAMPLE-ACCESS2'),'connections link to the neighboring device');
  await page.locator('#sitemap-query').fill('access3');ok(await page.locator('.site-node.match').count()===1&&await page.locator('.site-node.dim').count()===4,'find a device');await page.locator('#sitemap-query').fill('');
  // The configuration joins with the export by name.
  await page.locator('#import-file').setInputFiles(file('example-access1.conf',cfg));
  await page.waitForFunction(()=>document.querySelectorAll('[data-remove-workspace]').length===1);await page.waitForTimeout(400);
  const facts=await page.locator('.device-summary-facts').innerText();ok(/Links up \(live\)\s+3 of 5 reported interfaces/i.test(facts),'overview shows live link state: '+facts);
  ok(await page.locator('.interface-badge.live-up').count()===3&&await page.locator('.interface-badge.live-down').count()===2,'port tiles show live link state');
  ok((await page.locator('.interface-badge.live-up').first().getAttribute('title')).includes('Live link: Up'),'tile tooltips include live data');
  await page.locator('.nav-scroll [data-view="interfaces"]').click();await page.waitForTimeout(400);
  const headers=await page.locator('table.data thead th').allInnerTexts();ok(headers[1].includes('Link (live)')&&headers[2].includes('Connected to'),'live columns follow the interface name: '+headers.join(','));
  const ap=page.locator('tr').filter({hasText:'GigabitEthernet1/0/1'}).first();const apText=await ap.innerText();ok(apText.includes('EXAMPLE-AP1 · eth0')&&apText.includes('1 MAC'),'neighbor and devices seen on the port: '+apText);
  const printer=page.locator('tr').filter({hasText:'GigabitEthernet1/0/7'}).first();ok((await printer.innerText()).includes('10.0.10.50'),'ARP from the firewall names the device behind a switch port');
  await printer.click();await page.locator('#drawer .live-panel').waitFor();const live=await page.locator('#drawer .live-panel').innerText();ok(live.includes('Printer')&&live.includes('00:00:5e:00:53:a1')&&live.includes('100 Mb/s'),'interface details show live data: '+live);
  ok(await page.locator('#drawer .live-panel td [data-copy-value="00:00:5e:00:53:a1"]').count()===1&&await page.locator('#drawer .live-panel td [data-copy-value="10.0.10.50"]').count()===1,'MAC and IP addresses on a port can be copied');
  ok((await page.locator('#drawer .live-copy-all').getAttribute('data-copy-value')).includes('00:00:5e:00:53:a1\t10.0.10.50'),'all devices on a port can be copied at once');
  await page.keyboard.press('Escape');
  // The network map shows live link state and connected devices.
  await page.locator('.nav-scroll [data-view="topology"]').click();await page.waitForTimeout(500);
  ok(await page.locator('.map-interface .live-dot.up').count()>=3,'live link dots on the network map');
  ok((await page.locator('[data-map-interface]').filter({hasText:'TenGigabitEthernet1/1/1'}).first().innerText()).includes('EXAMPLE-CORE'),'map rows name the neighbor');
  const connected=await page.locator('.live-neighbors-panel').innerText();ok(connected.includes('EXAMPLE-CORE')&&connected.includes('EXAMPLE-AP1'),'connected devices on the map: '+connected);
  await page.locator('#map-query').fill('example-core');await page.waitForTimeout(400);ok(await page.locator('[data-map-interface]').count()===1,'map search finds interfaces by neighbor name');await page.locator('#map-query').fill('');await page.waitForTimeout(300);
  // Neighbor details.
  await page.locator('.live-neighbors-panel [data-neighbor-device="EXAMPLE-CORE"]').click();await page.locator('.neighbor-details').waitFor();
  const nd=await page.locator('#modal').innerText();ok(['EXAMPLE-CORE','10.0.99.2','EXAMPLE-CORE-0001','TenGigabitEthernet1/1/1','TenGigabitEthernet1/0/11','00:00:5e:00:53:12'].every(t=>nd.includes(t)),'neighbor details show hostname, address, serial, both ports and the remote MAC: '+nd);
  ok(await page.locator('#modal td [data-copy-value="TenGigabitEthernet1/0/11"]').count()===1&&await page.locator('#modal td [data-copy-value="00:00:5e:00:53:12"]').count()===1,'neighbor ports and MAC addresses can be copied');
  await page.locator('#modal [data-neighbor-sitemap]').click();await page.locator('.site-map-detail').waitFor();ok((await page.locator('.site-map-detail .panel-title').first().innerText()).includes('EXAMPLE-CORE'),'show on site map');
  await page.locator('[data-workspace="0"]').first().click();await page.waitForTimeout(400);
  // Live tabs in the sections they belong to.
  await page.locator('.nav-scroll [data-view="switching"]').click();await page.waitForTimeout(400);
  const subs=await page.locator('.nav-subsections .nav-subsection').allInnerTexts();ok(subs.some(t=>t.startsWith('Neighbors (live)'))&&subs.some(t=>t.startsWith('MAC address table (live)')),'Switching has live neighbor and MAC tabs: '+subs.join(' | '));
  await page.locator('.nav-subsection').filter({hasText:'MAC address table (live)'}).click();await page.waitForTimeout(300);
  ok((await page.locator('[data-live-tab="live-mac"]').innerText()).includes('10.0.10.50'),'MAC table with IP addresses from ARP');
  await page.locator('.nav-subsection').filter({hasText:'Neighbors (live)'}).click();await page.waitForTimeout(300);
  await page.locator('[data-live-tab] [data-neighbor-device="EXAMPLE-AP1"]').first().click();await page.locator('.neighbor-details').waitFor();ok((await page.locator('#modal').innerText()).includes('10.0.30.21'),'neighbors in section tabs open details');await page.keyboard.press('Escape');
  await page.locator('.nav-scroll [data-view="system"]').click();await page.waitForTimeout(300);
  if(await page.locator('.nav-subsection').filter({hasText:'Monitoring data (live)'}).count())await page.locator('.nav-subsection').filter({hasText:'Monitoring data (live)'}).click();await page.waitForTimeout(300);
  ok((await page.locator('[data-live-tab="live-device"]').innerText()).includes('Example Access 48P'),'collected device facts under System & management');
  // Command output pasted for the open configuration.
  await page.locator('.workspace-add [data-action="paste-settings"]').click();await page.locator('#paste-config').fill(SHOW);await page.locator('#paste-submit').click();await page.waitForTimeout(500);
  ok(!(await page.locator('#modal').evaluate(m=>m.open)),'pasted command output is accepted');
  await page.locator('.nav-scroll [data-view="interfaces"]').click();await page.waitForTimeout(400);
  ok((await page.locator('tr').filter({hasText:'GigabitEthernet1/0/4'}).first().innerText()).includes('Up'),'show interfaces status updates the port');
  // Supplementary data page.
  await page.locator('[data-view="evidence"]').first().click();await page.waitForTimeout(400);
  const tabs=await page.locator('[data-evidence-tab]').allInnerTexts();
  ok(['Files','Neighbors','Interface state','Network devices','Past last support date','Known vulnerabilities'].every(t=>tabs.some(x=>x.startsWith(t))),'each table has its own tab: '+tabs.join(' | '));
  ok(await page.locator('[data-evidence-tab][aria-pressed="true"]').innerText().then(t=>t.startsWith('Neighbors')),'the first table opens by default');
  ok(await page.locator('.evidence-panel').count()===1,'one table at a time');
  const nested=await page.evaluate(()=>[...document.querySelectorAll('#content *')].filter(e=>{const s=getComputedStyle(e);return /auto|scroll/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+1;}).map(e=>e.className));
  ok(nested.length===0,'no scroll areas inside the page: '+nested.join(','));
  await page.setViewportSize({width:1440,height:520});await page.evaluate(()=>{const c=document.getElementById('content');c.scrollTop=c.scrollHeight;});await page.waitForTimeout(200);
  const pinned=await page.evaluate(()=>{const c=document.getElementById('content').getBoundingClientRect(),t=document.querySelector('.evidence-tabs').getBoundingClientRect(),scrolled=document.getElementById('content').scrollTop;return {scrolled,top:t.top-c.top,height:t.height};});
  ok(pinned.scrolled>0&&pinned.top>=-1&&pinned.top<4,'the section tabs stay at the top while the page scrolls: '+JSON.stringify(pinned));
  await page.locator('[data-evidence-tab="ports"]').click();await page.setViewportSize({width:1440,height:420});await page.evaluate(()=>{const c=document.getElementById('content'),p=document.querySelector('.evidence-panel');c.scrollTop=p.offsetTop+60;});await page.waitForTimeout(200);
  const head=await page.evaluate(()=>{const t=document.querySelector('.evidence-tabs'),ph=document.querySelector('.evidence-panel .panel-head'),th=document.querySelector('.evidence-panel thead');return {tabs:[t.style.position,t.style.top,t.offsetHeight],panel:[ph.style.position,parseFloat(ph.style.top),ph.offsetHeight],head:[getComputedStyle(th).position,parseFloat(th.style.top)],panelTop:ph.getBoundingClientRect().top,tabsBottom:t.getBoundingClientRect().bottom,filter:!!ph.querySelector('#evidence-query')};});
  ok(head.tabs[0]==='sticky'&&head.panel[0]==='sticky'&&head.panel[1]===head.tabs[2]&&head.head[0]==='sticky'&&head.head[1]===head.tabs[2]+head.panel[2]&&Math.abs(head.panelTop-head.tabsBottom)<2&&head.filter,'tabs, the title row with its filter and the column headings stay stacked at the top: '+JSON.stringify(head));
  await page.locator('[data-evidence-tab="neighbors"]').click();
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{document.getElementById('content').scrollTop=0;});
  await page.locator('[data-evidence-tab="ports"]').click();await page.locator('#evidence-query').fill('1/0/7');await page.waitForTimeout(300);
  ok(await page.locator('[data-evidence-section="ports"] tbody tr').count()===1&&(await page.locator('#evidence-query').evaluate(e=>document.activeElement===e)),'a tab filters its table and keeps focus');
  ok((await page.locator('[data-evidence-section] [data-copy-value^="Interface"]').getAttribute('data-copy-value')).split('\n')[0]==='Interface\tLink\tSpeed\tDescription reported\tDevices seen','tables can be copied with their column names');
  ok(await page.locator('[data-evidence-section] tbody td [data-copy-value]').count()>0,'table values can be copied');
  await page.locator('[data-evidence-tab="files"]').click();await page.waitForTimeout(300);
  ok(await page.locator('.evidence-file').count()===2,'both imports are listed');
  await page.locator('[data-evidence-file] [data-remove-evidence]').last().click();await page.waitForTimeout(300);ok(await page.locator('.evidence-file').count()===1,'an import can be removed');
  // Compare configs does not accept supplementary data.
  await page.locator('[data-view="compare"]').first().click();await page.locator('#compare-left-file').setInputFiles(file('example-site.xlsx',demoSite()));await page.waitForTimeout(500);
  ok((await page.locator('#import-error').innerText()).includes('main workspace'),'compare explains where supplementary data goes');
  ok(errors.length===0,errors.join('\n'));
  console.log(checks+' supplementary data browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

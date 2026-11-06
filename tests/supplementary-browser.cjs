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
  await page.setViewportSize({width:1440,height:560});await page.waitForTimeout(300);const mh0=await page.evaluate(()=>document.querySelector('.site-map-scroll').getBoundingClientRect().height);
  await page.locator('.site-node').filter({hasText:'EXAMPLE-CORE'}).click();await page.locator('.site-map-detail').waitFor();
  const mh1=await page.evaluate(()=>document.querySelector('.site-map-scroll').getBoundingClientRect().height);ok(Math.abs(mh1-mh0)<3,'selecting a device with a long panel keeps the map height: '+mh0+' -> '+mh1);
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(300);
  const detail=await page.locator('.site-map-detail').innerText();ok(detail.includes('EXAMPLE-CORE-0001')&&detail.includes('TenGigabitEthernet1/0/11'),'device details list its connections');
  ok(await page.locator('.site-map-detail table').count()===0&&await page.locator('.site-map-detail .device-info-row').count()>=3&&await page.locator('.site-map-detail .site-link-row').count()===4,'the device panel uses the standard side panel rows, with one row per connection');
  await page.setViewportSize({width:1440,height:420});await page.waitForTimeout(200);
  const side=await page.locator('.site-map-detail').boundingBox();await page.mouse.move(side.x+side.width/2,side.y+Math.min(side.height-10,120));await page.mouse.wheel(0,400);await page.waitForTimeout(300);
  const own=await page.evaluate(()=>{const d=document.querySelector('.site-map-detail'),c=document.getElementById('content');return {overflow:getComputedStyle(d).overflowY,scrollable:d.scrollHeight>d.clientHeight,panel:d.scrollTop,page:c.scrollTop,fits:d.getBoundingClientRect().height<=c.clientHeight};});
  ok(own.overflow==='auto'&&own.scrollable&&own.panel>0&&own.page===0&&own.fits,'the site map device panel scrolls on its own without moving the page: '+JSON.stringify(own));
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(200);
  const fits=await page.evaluate(()=>{const c=document.getElementById('content');return {scroll:c.scrollHeight,client:c.clientHeight};});
  ok(fits.scroll<=fits.client+1,'the site map page fits the window, so only the device panel scrolls: '+JSON.stringify(fits));
  await page.locator('.site-map-detail [data-sitemap-node=""]').click();await page.waitForTimeout(300);
  const fits2=await page.evaluate(()=>{const c=document.getElementById('content');return {scroll:c.scrollHeight,client:c.clientHeight};});
  ok(fits2.scroll<=fits2.client+1,'and without the device panel: '+JSON.stringify(fits2));
  await page.locator('.site-node').filter({hasText:'EXAMPLE-CORE'}).click();await page.locator('.site-map-detail').waitFor();
  await page.locator('.site-map-detail [data-sitemap-node="exampleaccess2"]').click();ok((await page.locator('.site-map-detail .panel-title').first().innerText()).includes('EXAMPLE-ACCESS2'),'connections link to the neighboring device');
  await page.locator('#sitemap-query').fill('access3');ok(await page.locator('.site-node.match').count()===1&&await page.locator('.site-node.dim').count()===4,'find a device');await page.locator('#sitemap-query').fill('');
  // Clicking a link between two devices shows that connection.
  await page.locator('[data-sitemap-edge="edge:examplecore~examplefw1"] path.edge-hit').click({force:true});await page.waitForTimeout(300);
  const conn=await page.locator('.site-map-detail').innerText();
  ok(/EXAMPLE-CORE ↔ EXAMPLE-FW1/.test(conn)&&conn.includes('TenGigabitEthernet1/0/1')&&conn.includes('port1')&&conn.includes('00:00:5e:00:53:11')&&conn.includes('10 Gb/s'),'a link opens its connection details with both ports: '+conn);
  ok(await page.locator('.site-edge.selected[data-sitemap-edge="edge:examplecore~examplefw1"]').count()===1,'the selected link is highlighted');
  ok(await page.evaluate(()=>{const c=document.getElementById('content');return c.scrollHeight<=c.clientHeight+1;}),'the page still fits the window with a connection open');
  await page.locator('.site-map-detail [data-sitemap-node="examplefw1"]').click();await page.waitForTimeout(300);ok((await page.locator('.site-map-detail .panel-title').innerText())==='EXAMPLE-FW1','from a connection to one of its devices');
  // Zoom with the buttons and the mouse wheel, and drag to move the map.
  await page.locator('[data-sitemap-node=""]').first().click().catch(()=>{});await page.waitForTimeout(200);
  const w0=Number(await page.locator('svg.site-map').getAttribute('width'));
  await page.locator('[data-sitemap-zoom="in"]').click();ok((await page.locator('.zoom-level').innerText())==='120%'&&Number(await page.locator('svg.site-map').getAttribute('width'))>w0,'zoom in with the button');
  const box=await page.locator('.site-map-scroll').boundingBox(),pageTop=await page.evaluate(()=>document.getElementById('content').scrollTop);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-600);await page.waitForTimeout(200);
  const zoomed=await page.evaluate(()=>({zoom:document.querySelector('.zoom-level').innerText,page:document.getElementById('content').scrollTop}));
  ok(parseInt(zoomed.zoom)>120&&zoomed.page===pageTop,'the mouse wheel zooms the map instead of scrolling the page: '+JSON.stringify(zoomed));
  const before=await page.evaluate(()=>{const b=document.querySelector('.site-map-scroll');return [b.scrollLeft,b.scrollTop];});
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+150,box.y+box.height/2+80,{steps:6});await page.mouse.up();await page.waitForTimeout(150);
  const after=await page.evaluate(()=>{const b=document.querySelector('.site-map-scroll');return [b.scrollLeft,b.scrollTop];});
  ok(after[0]<before[0]&&after[1]<before[1],'dragging moves the map: '+JSON.stringify([before,after]));
  ok(await page.locator('.site-map-detail').count()===0,'a drag does not select a device');
  await page.locator('[data-sitemap-zoom="fit"]').click();const fit=await page.evaluate(()=>{const b=document.querySelector('.site-map-scroll'),s=b.querySelector('svg');return {sw:s.getBoundingClientRect().width,bw:b.clientWidth,sh:s.getBoundingClientRect().height,bh:b.clientHeight};});
  ok(fit.sw<=fit.bw&&fit.sh<=fit.bh,'Fit shows the whole map: '+JSON.stringify(fit));
  await page.locator('[data-sitemap-zoom="reset"]').click();ok((await page.locator('.zoom-level').innerText())==='100%','back to actual size');
  // Network diagram: opens on the selected configuration's device; whole site; click a
  // device to draw from it down; choose what to include, zoom and pan, and every download.
  await page.locator('.nav-scroll [data-view="diagram"]').click();await page.locator('.diagram-scroll svg').waitFor();
  const dtext=()=>page.locator('.diagram-scroll').textContent();
  ok((await page.locator('.diagram-panel .panel-title').innerText())==='Example Organization - Existing Topology'&&await page.locator('.diagram-toolbar [data-diagram-scope="site"][aria-pressed="true"]').count()===1,'with no configuration open the diagram shows the whole site');
  const dfit=await page.evaluate(()=>{const b=document.querySelector('.diagram-scroll'),s=b.querySelector('svg');return {sw:s.getBoundingClientRect().width,bw:b.clientWidth,sh:s.getBoundingClientRect().height,bh:b.clientHeight,page:document.getElementById('content').scrollHeight-document.getElementById('content').clientHeight};});
  ok(dfit.sw<=dfit.bw+1&&dfit.sh<=dfit.bh+1&&dfit.page<=1,'a new diagram is fitted to the window: '+JSON.stringify(dfit));
  await page.locator('.diagram-scroll [data-diagram-node="examplecore"]').first().click();await page.waitForTimeout(300);
  ok((await page.locator('.diagram-panel .panel-title').innerText())==='EXAMPLE-CORE and below','clicking a device draws the diagram from it down');
  ok((await dtext()).includes('EXAMPLE-AP1')&&(await dtext()).includes('EXAMPLE-ACCESS1')&&(await dtext()).includes('EXAMPLE-FW1'),'the device, its upstream device, switches and access points are drawn');
  ok(await page.locator('.diagram-trail [data-diagram-focus]').count()>=1&&(await page.locator('.diagram-trail').innerText()).includes('Whole site'),'a path leads back up');
  ok(await page.evaluate(()=>[...document.querySelectorAll('.diagram-scroll text')].some(t=>t.textContent==='1')&&[...document.querySelectorAll('.diagram-scroll text')].some(t=>t.textContent==='2')),'faceplate ports are numbered');
  await page.locator('[data-diagram-option="aps"]').uncheck();await page.waitForTimeout(300);ok(!(await dtext()).includes('EXAMPLE-AP1'),'access points can be left out');
  await page.locator('[data-diagram-option="aps"]').check();await page.waitForTimeout(300);
  await page.locator('.diagram-choose summary').click();await page.locator('[data-diagram-device="exampleaccess1"]').uncheck();await page.waitForTimeout(300);
  ok(!(await dtext()).includes('EXAMPLE-ACCESS1')&&/\d+ of \d+ shown/.test(await page.locator('.diagram-choose summary').innerText()),'a device can be removed from the list');
  await page.locator('.diagram-scroll [data-diagram-node="exampleaccess2"]').first().click({button:'right'});await page.waitForTimeout(300);ok(!(await dtext()).includes('EXAMPLE-ACCESS2'),'right-clicking a device removes it');
  await page.locator('[data-diagram-showall]').click();await page.waitForTimeout(300);ok((await dtext()).includes('EXAMPLE-ACCESS1')&&(await dtext()).includes('EXAMPLE-ACCESS2'),'and both come back');
  await page.locator('#diagram-focus').selectOption('exampleaccess3');await page.waitForTimeout(300);ok((await page.locator('.diagram-panel .panel-title').innerText())==='EXAMPLE-ACCESS3 and below'&&!(await dtext()).includes('EXAMPLE-ACCESS2'),'another device');
  await page.locator('[data-diagram-device="exampleaccess2"]').check();await page.waitForTimeout(300);ok((await dtext()).includes('EXAMPLE-ACCESS2'),'a device from elsewhere can be added');
  await page.locator('[data-diagram-showall]').click();await page.waitForTimeout(300);await page.locator('#diagram-focus').selectOption('examplecore');await page.waitForTimeout(300);
  await page.locator('.diagram-toolbar [data-diagram-scope="neighbors"]').click();await page.waitForTimeout(300);ok((await page.locator('.diagram-panel .panel-title').innerText())==='EXAMPLE-CORE - Connections','device connections view');
  await page.locator('.diagram-toolbar [data-diagram-scope="downstream"]').click();await page.waitForTimeout(300);
  const dz0=await page.locator('.diagram-page-view .zoom-level').innerText(),dbox=await page.locator('.diagram-scroll').boundingBox();
  await page.mouse.move(dbox.x+dbox.width/2,dbox.y+dbox.height/2);await page.mouse.wheel(0,-400);await page.waitForTimeout(150);
  ok((await page.locator('.diagram-page-view .zoom-level').innerText())!==dz0,'the mouse wheel zooms the diagram');
  await page.locator('.diagram-page-view [data-sitemap-zoom="reset"]').click();ok((await page.locator('.diagram-page-view .zoom-level').innerText())==='100%','actual size');
  const dbefore=await page.evaluate(()=>{const b=document.querySelector('.diagram-scroll');b.scrollLeft=200;b.scrollTop=200;return [b.scrollLeft,b.scrollTop];});
  await page.mouse.move(dbox.x+dbox.width/2,dbox.y+dbox.height/2);await page.mouse.down();await page.mouse.move(dbox.x+dbox.width/2+120,dbox.y+dbox.height/2+60,{steps:6});await page.mouse.up();await page.waitForTimeout(150);
  const dafter=await page.evaluate(()=>{const b=document.querySelector('.diagram-scroll');return [b.scrollLeft,b.scrollTop];});
  ok(dafter[0]<dbefore[0]&&dafter[1]<dbefore[1]&&(await page.locator('.diagram-panel .panel-title').innerText())==='EXAMPLE-CORE and below','dragging pans the diagram without selecting a device: '+JSON.stringify([dbefore,dafter]));
  const fs2=require('node:fs');
  const [vsdx]=await Promise.all([page.waitForEvent('download'),page.locator('[data-diagram-export="vsdx"]').click()]);ok(/^EXAMPLE-CORE-and-below\.vsdx$/.test(vsdx.suggestedFilename())&&fs2.readFileSync(await vsdx.path()).slice(0,2).toString()==='PK','Visio download of this diagram: '+vsdx.suggestedFilename());
  const [svgFile]=await Promise.all([page.waitForEvent('download'),page.locator('[data-diagram-export="svg"]').click()]);ok(/\.svg$/.test(svgFile.suggestedFilename()),'SVG download');
  const [htmlFile]=await Promise.all([page.waitForEvent('download'),page.locator('[data-diagram-export="html"]').click()]);ok(fs2.readFileSync(await htmlFile.path(),'utf8').includes('Print or save as PDF'),'printable HTML download');
  const [book]=await Promise.all([page.waitForEvent('download'),page.locator('[data-diagram-export="book"]').click()]);ok(/site-book\.vsdx$/.test(book.suggestedFilename()),'site book download: '+book.suggestedFilename());
  const [stencil]=await Promise.all([page.waitForEvent('download'),page.locator('[data-diagram-export="library"]').click()]);ok(/device-library\.vsdx$/.test(stencil.suggestedFilename())&&fs2.readFileSync(await stencil.path()).slice(0,2).toString()==='PK','device library download');
  await page.locator('.diagram-toolbar [data-diagram-scope="site"]').click();await page.waitForTimeout(300);await page.locator('#diagram-title').fill('Example Campus');await page.waitForTimeout(500);
  ok((await dtext()).includes('Example Campus - Existing Topology'),'the site name updates the diagram as you type');
  await page.locator('.nav-scroll [data-view="sitemap"]').click();await page.locator('.nav-scroll [data-view="diagram"]').click();ok((await page.locator('#diagram-title').inputValue())==='Example Campus','the site name is kept');
  // Search works on supplementary data alone, grouped by type.
  await page.locator('#global-search').fill('example-access');await page.waitForTimeout(500);
  ok(await page.locator('.gs-sup-group[data-sup-group="devices"] .gs-sup-item').count()===3,'devices found by name without a configuration open');
  await page.locator('#global-search').fill('10.0.99.2');await page.waitForTimeout(500);
  ok((await page.locator('.gs-sup-group[data-sup-group="devices"]').innerText()).includes('EXAMPLE-CORE'),'a device is found by its IP address');
  await page.locator('#global-search').fill('');await page.waitForTimeout(400);
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
  await page.locator('.nav-scroll [data-view="diagram"]').click();await page.locator('.diagram-scroll svg').waitFor();
  ok((await page.locator('.diagram-panel .panel-title').innerText())==='EXAMPLE-ACCESS1 and below'&&(await page.locator('#diagram-focus').inputValue())==='exampleaccess1','with a configuration selected the diagram opens on its device');
  ok((await page.locator('.diagram-scroll').textContent()).includes('EXAMPLE-CORE')&&(await page.locator('.diagram-scroll').textContent()).includes('EXAMPLE-AP1'),'with its upstream device and access points');
  // The network map shows live link state and connected devices.
  await page.locator('.nav-scroll [data-view="topology"]').click();await page.waitForTimeout(500);
  ok(await page.locator('.live-neighbors-panel.collapsed').count()===1,'connected devices start collapsed like the other map groups');
  await page.locator('[data-map-collapse-all="expand"]').first().click();await page.waitForTimeout(300);
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
  // Search with a configuration open: configuration results plus supplementary data by type.
  await page.locator('#global-search').fill('00:00:5e:00:53:a1');await page.waitForTimeout(800);
  const types=await page.locator('[data-gs-type]').allInnerTexts();ok(types.some(t=>t.startsWith('Supplementary data')),'type tabs include supplementary data: '+types.join(' | '));
  const groups=await page.locator('.gs-sup-group').evaluateAll(g=>g.map(x=>x.dataset.supGroup));ok(groups.includes('mac')&&groups.includes('arp'),'a MAC address is found in the MAC table and ARP: '+groups.join(','));
  await page.locator('#global-search').fill('0000.5e00.53a1');await page.waitForTimeout(800);
  ok(await page.locator('.gs-sup-group[data-sup-group="mac"] .gs-sup-item').count()===1,'Cisco MAC notation matches too');
  await page.locator('[data-gs-type="supplementary"]').click();await page.waitForTimeout(300);
  ok(await page.locator('.global-search-page.gs-sup-only').count()===1&&await page.locator('.gs-result:visible').count()===0,'the supplementary tab shows only supplementary matches');
  await page.locator('.gs-sup-group[data-sup-group="mac"] [data-sup-interface]').first().click();await page.locator('#drawer .live-panel').waitFor();
  ok((await page.locator('#drawer h2').first().innerText()).includes('GigabitEthernet1/0/7'),'a MAC table match opens its interface');
  await page.keyboard.press('Escape');await page.locator('#global-search').fill('');await page.waitForTimeout(400);
  await page.locator('.nav-scroll [data-view="overview"]').click();await page.waitForTimeout(300);
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

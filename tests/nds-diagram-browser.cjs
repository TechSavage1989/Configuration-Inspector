// Network diagram (preview): pages drawn by NetworkDiagramStudio's engine from the files the app has open.
// Off by default; App settings > Preview features turns it on. Fictional data only.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{demoSite}=require('./xlsx-writer.cjs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const L=['version 16.12','hostname EXAMPLE-ACCESS1','vlan 10',' name USERS','vlan 30',' name WIRELESS'];
for(let p=1;p<=8;p++)L.push('interface GigabitEthernet1/0/'+p,' switchport mode access',' switchport access vlan '+(p===1?30:10));
L.push('interface TenGigabitEthernet1/1/1',' description Uplink to core',' switchport mode trunk','interface Vlan99',' ip address 10.0.99.11 255.255.255.0');
const file=(name,buffer,type)=>({name,mimeType:type||'text/plain',buffer:Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer)});
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles([file('example-access1.txt',L.join('\n')+'\n'),file('example-site.xlsx',demoSite(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')]);
  await page.locator('.nav-scroll [data-view="sitemap"]').first().waitFor({timeout:15000});
  ok(await page.locator('.nav-scroll [data-view="netdiagram"]').count()===0,'the preview diagram is off by default');
  ok(await page.evaluate(()=>!window.NDSEngine),'the engine is not started until a diagram is drawn');
  // App settings turns it on.
  await page.locator('[data-action="app-settings"]').first().click();await page.locator('#app-settings-nds').check();
  ok(await page.evaluate(()=>/nds/.test(localStorage.getItem('config-inspector-labs')||'')),'the choice is remembered');
  await page.locator('#modal [data-action="close-modal"]').first().click();
  await page.locator('.nav-scroll [data-view="netdiagram"]').first().click();
  await page.locator('.nds-svg').waitFor({timeout:120000});
  const tabs=await page.locator('.nds-tab').allInnerTexts();
  ok(tabs.length>=3&&/network/i.test(tabs[0])&&tabs.some(t=>/site map/i.test(t))&&tabs.some(t=>/port map/i.test(t)),'network, site map and port map pages: '+tabs.join(' | '));
  const first=await page.evaluate(()=>{const s=document.querySelector('.nds-svg'),b=document.querySelector('.nds-scroll').getBoundingClientRect();return {text:s.textContent,w:s.getBoundingClientRect().width,h:s.getBoundingClientRect().height,bw:b.width,bh:b.height};});
  ok(first.text.includes('EXAMPLE-ACCESS1'),'the configured switch is drawn on the network page');
  ok(first.w<=first.bw+2&&first.h<=first.bh+2&&first.w>200,'a page opens fitted to the window: '+JSON.stringify([first.w,first.h,first.bw,first.bh]));
  ok(/of \d+ devices/.test(await page.locator('.nds-panel .panel-count').innerText()),'the heading counts the devices drawn');
  // Other pages, zoom and scope.
  const pm=tabs.findIndex(t=>/port map/i.test(t));await page.locator('[data-nds-page="'+pm+'"]').click();await page.waitForTimeout(300);
  ok(await page.locator('.nds-tab.active').innerText()===tabs[pm]&&(await page.locator('.nds-svg').textContent()).includes('EXAMPLE-ACCESS1'),'a port map page opens');
  const z0=await page.locator('.nds-viewport .zoom-level').innerText();await page.locator('.nds-viewport [data-sitemap-zoom="in"]').click();ok(await page.locator('.nds-viewport .zoom-level').innerText()!==z0,'zoom works on a page');
  const count0=await page.locator('.nds-panel .panel-count').innerText();await page.locator('#nds-others').check();
  await page.waitForFunction(c=>{const e=document.querySelector('.nds-panel .panel-count');return e&&e.textContent!==c&&document.querySelector('.nds-svg');},count0,{timeout:120000});
  ok((await page.locator('.nds-panel .panel-count').innerText())!==count0,'every other device can be added: '+await page.locator('.nds-panel .panel-count').innerText());
  // Downloads.
  const save=async kind=>{const [d]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.locator('[data-nds-save="'+kind+'"]').click()]);return {name:d.suggestedFilename(),data:fs.readFileSync(await d.path())};};
  const visio=await save('visio');ok(/\.vsdx$/.test(visio.name)&&visio.data.slice(0,2).toString()==='PK'&&visio.data.includes('visio/pages/pages.xml'),'Visio download is a drawing package');
  const svg=await save('svg');ok(/\.svg$/.test(svg.name)&&svg.data.toString().startsWith('<svg'),'this page downloads as SVG');
  const print=await save('print');ok(/\.html$/.test(print.name)&&/<svg/.test(print.data.toString()),'printable pages download as one HTML file');
  const project=JSON.parse((await save('project')).data.toString());ok(project.format==='NetworkDiagramStudio'&&project.project.devices.some(d=>d.name==='EXAMPLE-ACCESS1'),'the project file opens in NetworkDiagramStudio');
  // Turning it off again removes it.
  await page.locator('[data-action="app-settings"]').first().click();await page.locator('#app-settings-nds').uncheck();await page.locator('#modal [data-action="close-modal"]').first().click();
  ok(await page.locator('.nav-scroll [data-view="netdiagram"]').count()===0&&await page.locator('.nds-panel').count()===0,'turning the preview off removes the page');
  ok(!errors.length,'no page errors: '+errors.join('; '));
  console.log(checks+' network diagram preview browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

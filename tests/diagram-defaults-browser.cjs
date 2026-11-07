// The network diagram's default view (owner request): the selected configuration's device and the
// devices below it that also have imported configurations, plus WAN circuits; access points, other
// devices and switches without a configuration only when Show includes them.
const assert=require('node:assert/strict'),path=require('node:path'),{demoSite}=require('./xlsx-writer.cjs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
function cisco(host,ports,ip){const L=['version 16.12','hostname '+host,'vlan 10',' name USERS'];ports.forEach(p=>L.push('interface '+p,' switchport mode trunk'));L.push('interface Vlan99',' ip address '+ip+' 255.255.255.0');return L.join('\n')+'\n';}
const file=(name,buffer,type)=>({name,mimeType:type||'text/plain',buffer:Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer)});
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles(file('example-site.xlsx',demoSite(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
  await page.locator('.site-map').waitFor({timeout:15000});
  await page.locator('#import-file').setInputFiles([file('access1.txt',cisco('EXAMPLE-ACCESS1',['GigabitEthernet1/0/1','TenGigabitEthernet1/1/1'],'10.0.99.11')),file('core.txt',cisco('EXAMPLE-CORE',['TenGigabitEthernet1/0/1','TenGigabitEthernet1/0/11','TenGigabitEthernet1/0/12','TenGigabitEthernet1/0/13'],'10.0.99.2'))]);
  await page.waitForTimeout(1500);
  // Draw from the core switch's configuration.
  await page.locator('.config-tab, [data-workspace]').filter({hasText:'EXAMPLE-CORE'}).first().click().catch(()=>{});
  await page.locator('.nav-scroll [data-view="diagram"]').first().click();await page.locator('.diagram-scroll > svg').waitFor();
  if(await page.locator('#diagram-focus').count())await page.locator('#diagram-focus').selectOption('examplecore');await page.waitForTimeout(400);
  const text=()=>page.locator('.diagram-scroll').textContent();
  let t=await text();
  ok(t.includes('EXAMPLE-CORE')&&t.includes('EXAMPLE-ACCESS1'),'the device and the configured switch below it are drawn');
  ok(!t.includes('EXAMPLE-ACCESS2')&&!t.includes('EXAMPLE-ACCESS3'),'switches below without a configuration are not drawn by default');
  ok(!t.includes('EXAMPLE-AP1')&&!t.includes('EXAMPLE-PRINTER'),'access points and other devices are not drawn by default');
  ok(!t.includes('EXAMPLE-FW1'),'the upstream device is not drawn by default');
  const opt=async k=>{await page.locator('[data-diagram-pop="show"] summary').click();await page.locator('[data-diagram-option="'+k+'"]').check();await page.waitForTimeout(400);if(await page.locator('[data-diagram-pop="show"][open]').count())await page.locator('[data-diagram-pop="show"] summary').click();};
  await opt('unconfigured');t=await text();ok(t.includes('EXAMPLE-ACCESS2')&&t.includes('EXAMPLE-ACCESS3'),'Show > Switches without a configuration adds them');
  await opt('aps');t=await text();ok(t.includes('EXAMPLE-AP1'),'Show > Access points adds them');
  await opt('others');t=await text();ok(t.includes('EXAMPLE-PRINTER'),'Show > Other devices adds them');
  ok(!errors.length,'no page errors: '+errors.join('; '));
  console.log(checks+' diagram default view browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

// Client report export and comparison change summary in the real page.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const cfg=(host,o={})=>'version 15.2\nhostname '+host+'\nusername admin privilege 15 secret '+(o.secret||'TEST_SECRET_ONLY')+'\nsnmp-server community TEST_COMMUNITY_ONLY RO\nvlan 10\n name USERS\nvlan 30\n name PRINTERS\n'+
 'interface GigabitEthernet1/0/1\n description Example desk\n switchport mode access\n switchport access vlan '+(o.access||10)+'\n'+
 'interface GigabitEthernet1/0/2\n shutdown\n'+'interface GigabitEthernet1/0/3\n'+
 'interface GigabitEthernet1/0/48\n description Example uplink\n switchport mode trunk\n'+
 (o.extra?'interface GigabitEthernet1/0/20\n description Example AP\n switchport mode access\n switchport access vlan 10\n':'')+
 'interface Vlan10\n ip address 10.0.10.2 255.255.255.0\n';
const file=(name,text)=>({name,mimeType:'text/plain',buffer:Buffer.from(text)});
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles([file('core-sw1.conf',cfg('CORE-SW1')),file('branch-sw2.conf',cfg('BRANCH-SW2',{access:30}))]);
  await page.waitForFunction(()=>document.querySelectorAll('[data-remove-workspace]').length===2);
  await page.locator('[data-view="exports"]').first().click();await page.locator('[data-export-format="client"]').first().waitFor();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export-format="client"]').first().click()]);
  ok(download.suggestedFilename()==='Config_Inspector_client_report.html','multi-device report filename: '+download.suggestedFilename());
  const html=fs.readFileSync(await download.path(),'utf8');
  ok(html.includes('<title>Network configuration report</title>'),'multi-device title');
  ok(html.includes('<h2>CORE-SW1</h2>')&&html.includes('<h2>BRANCH-SW2</h2>'),'a section for each open configuration');
  ok(/GigabitEthernet1\/0\/1<\/td><td>In use<\/td><td>Access<\/td><td>Untagged 10<\/td><td>Example desk/.test(html),'used port row with mode, VLAN and description');
  ok(/GigabitEthernet1\/0\/2<\/td><td>(?:Disabled|Unconfigured)<\/td>/.test(html),'shut down port is not listed as in use');
  ok(/GigabitEthernet1\/0\/3<\/td><td>Unconfigured<\/td>/.test(html),'empty port is unconfigured');
  ok(/Untagged 30/.test(html),'second device keeps its own VLAN assignment');
  ok(/<td>10<\/td><td>USERS<\/td>/.test(html),'VLAN table');
  ok(/<td>Vlan10<\/td><td>10\.0\.10\.2 \/ 255\.255\.255\.0<\/td><td>10\.0\.10\.0\/24<\/td>/.test(html),'IP address table');
  ok(html.includes('Trunks carry every VLAN'),'review findings are included');
  ok(!/TEST_SECRET_ONLY|TEST_COMMUNITY_ONLY/.test(html),'secrets are never included');
  ok(!/>undefined<|>null</.test(html),'no placeholder values');
  ok(await page.locator('[data-remove-workspace]').count()===2,'the workspace is unchanged after the report');
  const glance=await page.evaluate(()=>document.querySelector('.workspace-file.active, [data-remove-workspace]')!==null);ok(glance,'the active configuration is restored');

  // Change summary in the object comparison.
  await page.locator('[data-view="compare"]').first().click();
  await page.locator('#compare-left-file').setInputFiles(file('before.conf',cfg('ACCESS-SW')));await page.locator('#modal').waitFor({state:'hidden'});
  await page.locator('#compare-file').setInputFiles(file('after.conf',cfg('ACCESS-SW',{access:30,extra:true,secret:'TEST_SECRET_NEW'})));await page.locator('#modal').waitFor({state:'hidden'});
  await page.locator('.comparison-card').first().waitFor();
  await page.locator('[data-action="change-summary"]').click();await page.locator('.change-summary').waitFor();
  const text=await page.locator('.change-summary').innerText();
  ok(text.startsWith('Configuration changes: ACCESS-SW → ACCESS-SW'),'summary header');
  ok(/Changed GigabitEthernet1\/0\/1: [^\n]*Untagged VLANs: 10 → 30/.test(text),'VLAN move uses readable labels: '+text);
  ok(/Added GigabitEthernet1\/0\/20 \("Example AP"\)/.test(text),'added port');
  ok(!/TEST_SECRET/.test(text),'secrets are masked in the summary');
  const [txt]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="download-change-summary"]').click()]);
  ok(fs.readFileSync(await txt.path(),'utf8')===text.replace(/\r/g,''),'download matches the shown summary');
  await page.locator('[data-action="copy-change-summary"]').click();await page.waitForFunction(()=>/Copied|copy/i.test(document.getElementById('toast').textContent));ok(true,'copy reports success');
  ok(errors.length===0,errors.join('\n'));
  console.log(checks+' client report and change summary browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

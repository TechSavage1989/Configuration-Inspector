// App-wide layout: engineer-facing facts first, technical detail behind Source & export.
const assert=require('node:assert/strict'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const L=['version 16.12','hostname SUMMARY-SW1','switch 1 provision ws-c3650-48pd','switch 2 provision ws-c3650-48pd','ip name-server 192.0.2.53','ip domain name example.com','ntp server 192.0.2.123','logging host 192.0.2.5','clock timezone EST -5 0','vlan 10',' name USERS','vlan 99',' name MANAGEMENT'];
for(let m=1;m<=2;m++)for(let p=1;p<=48;p++){L.push('interface GigabitEthernet'+m+'/0/'+p);if(p<=20)L.push(' description Workstation '+m+'-'+p,' switchport mode access',' switchport access vlan 10');}
L.push('interface Vlan99',' ip address 10.0.99.10 255.255.255.0','ip default-gateway 10.0.99.1');
const cfg=L.join('\n')+'\n';
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  ok(await page.locator('.heading-actions [data-action="open-file"]').count()===1,'before a file is open, the header offers Open configuration file');
  await page.locator('#import-file').setInputFiles({name:'summary-sw1.conf',mimeType:'text/plain',buffer:Buffer.from(cfg)});
  await page.waitForFunction(()=>document.querySelectorAll('[data-remove-workspace]').length===1);await page.waitForTimeout(600);
  // Header and file line.
  ok(await page.locator('.heading-actions button').count()===0,'with a file open, the header has no duplicate import or compare buttons');
  ok(await page.locator('.workspace-add [data-action="open-file"]').count()===1&&await page.locator('.workspace-add [data-action="paste-settings"]').count()===1,'Add files and Paste sit with the open files');
  // Overview.
  const facts=await page.locator('.device-summary-facts div').allInnerTexts(),text=facts.join(' | ');
  for(const expected of ['SUMMARY-SW1','2 × WS-C3650-48PD (stack of 2)','10.0.99.10/24 on Vlan99','10.0.99.1','192.0.2.53','192.0.2.123','192.0.2.5','example.com'])ok(text.includes(expected),'device summary shows '+expected+': '+text);
  ok((await page.locator('.device-summary-stats').innerText()).includes('40 / 96'),'ports in use are counted on physical ports');
  const order=await page.locator('#content [data-overview-section]').evaluateAll(s=>s.map(x=>x.dataset.overviewSection));
  ok(order[0]==='device'&&order[1]==='findings'&&order[2]==='interfaces','overview order: '+order.join(','));
  ok(!order.includes('network')&&!order.includes('totals')&&!order.includes('notes')&&!order.includes('gateways'),'no duplicate map, totals, DNS card or parser notes on the overview');
  ok(await page.locator('#content .section-source').count()===0,'no source panel on the overview');
  // Source is a button on the file line, opened on demand.
  await page.locator('.nav-scroll [data-view="vlans"]').click();await page.waitForTimeout(500);
  ok(await page.locator('#content .section-source').count()===0,'source panel is closed by default');
  await page.locator('.notice [data-action="toggle-section-source"]').click();await page.locator('#content .section-source').waitFor();
  ok((await page.locator('.notice [data-action="toggle-section-source"]').innerText()).includes('Hide source'),'the file line button opens the source');
  await page.locator('.notice [data-action="toggle-section-source"]').click();await page.waitForTimeout(300);ok(await page.locator('#content .section-source').count()===0,'and closes it');
  // Tables: compact port ranges, no repeated columns, no single-tab sub-items.
  const untagged=await page.locator('.port-list').first().innerText();
  ok(/^40\s+Gi1\/0\/1-20, Gi2\/0\/1-20$/.test(untagged.trim()),'VLAN ports read as ranges with a count: '+untagged);
  ok((await page.locator('.port-list').first().getAttribute('title')).includes('GigabitEthernet1/0/20'),'the full list stays in the tooltip');
  const headers=await page.locator('table.data thead th').allInnerTexts();
  ok(!headers.some(h=>/Member ports/.test(h))&&!headers.some(h=>/Configured state/.test(h)),'no duplicate member list or uninformative state column: '+headers.join(','));
  ok(await page.locator('.nav-subsections').count()===0,'no single sub-item repeated under the sidebar entry');
  // Device information.
  await page.locator('.nav-scroll [data-view="deviceinfo"]').click();await page.waitForTimeout(500);
  ok(await page.locator('.device-summary').count()===1&&await page.locator('.device-summary-stats').count()===0,'device information shows one summary without repeated tiles');
  ok(await page.locator('details.technical-section').count()>=1&&await page.locator('details.technical-section[open]').count()===0,'original device fields and file details are collapsed');
  ok(errors.length===0,errors.join('\n'));
  console.log(checks+' app layout browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

// Network diagrams from configurations alone: links the configurations imply, WAN
// circuits, and links and devices added by hand (with undo and redo). Fictional configs.
const assert=require('node:assert/strict'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const core=['version 16.12','hostname EXAMPLE-CORE','vlan 10',' name USERS',
 'interface GigabitEthernet1/0/1',' description Downlink to EXAMPLE-EDGE',' switchport mode trunk',
 'interface GigabitEthernet1/0/2',' switchport mode access',' switchport access vlan 10',
 'interface Vlan10',' ip address 10.0.10.1 255.255.255.0'].join('\n')+'\n';
const edge=['version 16.12','hostname EXAMPLE-EDGE','vlan 10',' name USERS',
 'interface GigabitEthernet1/0/24',' description Uplink to EXAMPLE-CORE',' switchport mode trunk',
 'interface GigabitEthernet1/0/3',' switchport mode access',' switchport access vlan 10',
 'interface Vlan10',' ip address 10.0.10.2 255.255.255.0','ip default-gateway 10.0.10.1'].join('\n')+'\n';
const file=(name,text)=>({name,mimeType:'text/plain',buffer:Buffer.from(text)});
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles([file('example-core.conf',core),file('example-edge.conf',edge)]);await page.waitForTimeout(1500);
  ok(await page.locator('.nav-scroll [data-view="diagram"]').count()===1,'the network diagram is offered with configurations alone');
  await page.locator('.nav-scroll [data-view="diagram"]').click();await page.locator('.diagram-scroll > svg').waitFor();
  await page.locator('.diagram-toolbar [data-diagram-scope="site"]').click();await page.waitForTimeout(400);
  const text=()=>page.locator('.diagram-scroll').textContent();
  ok((await text()).includes('EXAMPLE-CORE')&&(await text()).includes('EXAMPLE-EDGE'),'both devices are drawn');
  ok(await page.locator('.diagram-scroll polyline[data-line]').count()===1,'the link their port descriptions imply is drawn');
  await page.locator('[data-diagram-editmode]').click();await page.waitForTimeout(300);
  await page.locator('[data-site-links]').click();await page.waitForTimeout(300);const links=await page.locator('#modal .modal-body').innerText();
  ok(/From the configurations/.test(links)&&/Gi1\/0\/1/.test(links)&&/Gi1\/0\/24/.test(links),'the link says where it comes from, with both ports: '+links.split('\n')[0]);
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  await page.locator('[data-site-add="device"]').click();await page.locator('[data-add-dev="name"]').fill('EXAMPLE-ISP');await page.locator('[data-add-dev="type"]').selectOption('Router');await page.locator('[data-add-dev-save]').click();await page.waitForTimeout(400);
  ok((await text()).includes('EXAMPLE-ISP'),'a device can be added by hand');
  await page.locator('[data-site-add="link"]').click();await page.locator('[data-add-link-dev="0"]').selectOption('EXAMPLE-ISP');await page.locator('[data-add-link-dev="1"]').selectOption('EXAMPLE-CORE');await page.locator('[data-add-link-port="1"]').fill('GigabitEthernet1/0/2');await page.locator('[data-add-link-save]').click();await page.waitForTimeout(400);
  ok(await page.locator('.diagram-scroll polyline[data-line]').count()===2,'a link can be added by hand');
  await page.keyboard.press('Control+z');await page.waitForTimeout(300);ok(await page.locator('.diagram-scroll polyline[data-line]').count()===1,'Ctrl+Z undoes it');
  await page.keyboard.press('Control+Shift+z');await page.waitForTimeout(300);ok(await page.locator('.diagram-scroll polyline[data-line]').count()===2,'Ctrl+Shift+Z redoes it');
  // A bend added from the link's menu, then removed by undo.
  const pts=async()=>Math.max(...await page.locator('.diagram-scroll polyline[data-line]').evaluateAll(ls=>ls.map(l=>l.getAttribute('data-route').split(' ').length)));const before=await pts();
  await page.evaluate(()=>{const ls=[...document.querySelectorAll('.diagram-scroll polyline[data-line]')].sort((a,b)=>b.getAttribute('data-route').split(' ').length-a.getAttribute('data-route').split(' ').length),l=ls[0],r=l.getAttribute('data-route').split(' ').map(q=>q.split(',').map(Number)),i=Math.floor((r.length-2)/2),m=[(r[i][0]+r[i+1][0])/2,(r[i][1]+r[i+1][1])/2],svg=l.ownerSVGElement,p=svg.createSVGPoint();p.x=m[0];p.y=m[1];const c=p.matrixTransform(svg.getScreenCTM());l.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:c.x,clientY:c.y,button:2}));});
  await page.locator('.diagram-ctx [data-ctx="bend"]').click();await page.waitForTimeout(300);ok(await pts()>before,'a bend can be added to a link');
  await page.keyboard.press('Control+z');await page.waitForTimeout(300);ok(await pts()===before,'and undone');
  await page.locator('[data-site-links]').click();await page.waitForTimeout(200);await page.locator('#modal [data-site-link-remove][data-manual="0"]').first().click();await page.waitForTimeout(300);await page.keyboard.press('Escape');await page.waitForTimeout(200);
  ok(await page.locator('.diagram-scroll polyline[data-line]').count()===1,'a wrong link from the configurations can be removed');
  ok(!errors.length,'no page errors: '+errors.join('; '));
  console.log(checks+' configuration-only diagram browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

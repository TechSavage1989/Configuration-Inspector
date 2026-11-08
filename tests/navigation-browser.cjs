// Collapsible sidebar sections and network map groups.
const assert=require('node:assert/strict'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
const cfg='version 16.12\nhostname MAP-SW1\nspanning-tree mode rapid-pvst\nvlan 10\n name USERS\n'+Array.from({length:12},(_,i)=>'interface GigabitEthernet1/0/'+(i+1)+'\n description Example desk '+(i+1)+'\n switchport mode access\n switchport access vlan 10\n').join('')+
 'interface Port-channel1\n switchport mode trunk\ninterface GigabitEthernet1/0/24\n switchport mode trunk\n channel-group 1 mode active\ninterface Vlan10\n ip address 10.0.10.2 255.255.255.0\n';
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles({name:'map-sw1.conf',mimeType:'text/plain',buffer:Buffer.from(cfg)});
  await page.waitForFunction(()=>document.querySelectorAll('[data-remove-workspace]').length===1);
  ok(await page.locator('#modal').evaluate(m=>!m.open),'import completes without an error dialog');
  // Sidebar structure.
  const groups=await page.locator('.nav-group').evaluateAll(gs=>gs.map(g=>g.dataset.navGroup));
  ok(groups[0]==='workspace'&&groups.includes('network')&&groups[groups.length-1]==='source-export','sidebar sections: '+groups.join(','));
  ok(await page.locator('[data-nav-group="workspace"] [data-view="compare"]').count()===1,'Compare configs sits with the workspace items');
  ok(await page.locator('.inspector-nav-sections').count()===0,'the duplicate section list is gone from the sidebar');
  // The Network diagram is turned off in releases (owner request): no sidebar item, while the Site map stays.
  ok(await page.locator('.nav-scroll [data-view="diagram"]').count()===0&&await page.locator('.nav-scroll [data-view="sitemap"]').count()===1,'the Network diagram is turned off; the Site map stays');
  ok(await page.locator('[data-nav-toggle="workspace"]').count()===0,'the workspace section is always open');
  ok((await page.locator('[data-view="interfaces"]').first().getAttribute('title'))!=null,'items describe their page on hover');
  // Collapse a section and keep it across reloads.
  await page.locator('[data-nav-toggle="switching"]').click();
  ok(await page.locator('[data-nav-group="switching"] .nav-group-items').isHidden(),'a section collapses from its heading');
  ok(await page.locator('[data-nav-toggle="switching"]').getAttribute('aria-expanded')==='false','collapsed state is announced');
  await page.reload();await page.locator('#import-file').setInputFiles({name:'map-sw1.conf',mimeType:'text/plain',buffer:Buffer.from(cfg)});await page.waitForFunction(()=>document.querySelectorAll('[data-remove-workspace]').length===1);
  ok(await page.locator('[data-nav-group="switching"] .nav-group-items').isHidden(),'the collapsed section is remembered');
  await page.locator('[data-nav-toggle="network"]').click();
  ok(await page.locator('[data-nav-group="network"] .nav-group-items').isHidden(),'network section collapses');
  await page.evaluate(()=>document.querySelector('[data-view="topology"]').click());await page.waitForTimeout(600);
  ok(await page.locator('[data-nav-group="network"] .nav-group-items').isVisible(),'the section holding the current page stays open');
  await page.locator('[data-nav-toggle="network"]').click();ok(await page.locator('[data-nav-group="network"] .nav-group-items').isVisible(),'it cannot hide the current page');
  ok(await page.locator('.network-map-panel > .panel-head[data-pinned]').count()===1&&await page.locator('.network-map-panel > .map-toolbar[data-pinned]').count()===1,'the map title and its search and filter toolbar stay pinned');
  // Detailed map groups start collapsed.
  const panels=await page.locator('.map-zone-panel').count();
  ok(panels>0&&await page.locator('.map-zone-panel.collapsed').count()===panels&&await page.locator('.map-zone-panel .interface-map-grid').count()===0,'every map group starts collapsed');
  const zone=page.locator('[data-map-collapse^="zone:"]').first(),name=await zone.innerText();
  ok(await zone.getAttribute('aria-expanded')==='false','collapsed group is announced');
  await zone.click();
  ok(await page.locator('.map-zone-panel').first().locator('.interface-map-grid button').count()>0,'a group opens to list its interfaces: '+name);
  ok(await page.locator('[data-map-collapse^="zone:"]').first().getAttribute('aria-expanded')==='true','open group is announced');
  ok(await page.evaluate(()=>document.activeElement&&document.activeElement.hasAttribute('data-map-collapse')),'focus stays on the toggle');
  await page.locator('[data-map-collapse^="zone:"]').first().click();ok(await page.locator('.map-zone-panel').first().locator('.interface-map-grid').count()===0,'and closes again');
  await page.locator('[data-map-collapse-all="expand"]').first().click();
  ok(await page.locator('.map-zone-panel.collapsed').count()===0&&await page.locator('.map-zone-panel .interface-map-grid').count()>0,'Expand all opens every group');
  await page.locator('[data-map-collapse-all="collapse"]').first().click();
  ok(await page.locator('.map-zone-panel .interface-map-grid').count()===0,'Collapse all closes every group');
  await page.locator('#map-query').fill('Example desk 3');await page.waitForTimeout(400);
  ok(await page.locator('.map-zone-panel .interface-map-grid button').count()>0,'a search opens the groups with matches');
  await page.locator('#map-query').fill('');await page.waitForTimeout(300);ok(await page.locator('.map-zone-panel .interface-map-grid').count()===0,'clearing the search returns to collapsed groups');
  // Compact map groups start collapsed too.
  await page.locator('[data-map-mode="compact"]').click();await page.locator('.compact-zone').first().waitFor();
  ok(await page.locator('.compact-zone .compact-interface').count()===0,'compact groups start collapsed');
  await page.locator('.compact-zone [data-map-collapse]').first().click();
  ok(await page.locator('.compact-zone').first().locator('.compact-interface').count()>0,'a compact group opens');
  await page.locator('[data-map-collapse-all="expand"]').first().click();ok(await page.locator('.compact-zone.collapsed').count()===0,'compact Expand all');
  await page.locator('[data-map-collapse-all="collapse"]').first().click();ok(await page.locator('.compact-zone .compact-interface').count()===0,'compact Collapse all');
  // Delete stored data forgets collapsed sections.
  ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('config-inspector-nav-collapsed')||'[]').includes('switching')),'collapsed sections are stored locally');
  const icons=await page.evaluate(()=>{const seen={};document.querySelectorAll('.nav-scroll .nav-item[data-view]').forEach(n=>{const v=n.getAttribute('data-view'),svg=n.querySelector('svg.icon');if(svg&&!(v in seen))seen[v]=svg.innerHTML;});return seen;});
  const dupes=Object.entries(icons).filter(([v,svg])=>Object.entries(icons).some(([w,o])=>w!==v&&o===svg)).map(([v])=>v);
  ok(Object.keys(icons).length>=10&&dupes.length===0,'every tool in the navigation has its own icon: '+(dupes.join(', ')||Object.keys(icons).length+' tools'));
  ok(errors.length===0,errors.join('\n'));
  console.log(checks+' navigation and map collapse browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

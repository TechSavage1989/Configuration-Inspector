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
  // These checks were written for the full view (every device type shown); the default view is checked separately.
  await page.addInitScript(()=>{window.DIAGRAM_SHOW_ALL=true;});
  await page.goto('file://'+path.resolve('webview/index.html')+'?labs=diagram');
  await page.locator('#import-file').setInputFiles([file('example-core.conf',core),file('example-edge.conf',edge)]);await page.waitForTimeout(1500);
  ok(await page.locator('.nav-scroll [data-view="diagram"]').count()===1,'the network diagram is offered with configurations alone');
  await page.locator('.nav-scroll [data-view="diagram"]').click();await page.locator('.diagram-scroll > svg').waitFor();
  await page.locator('.diagram-toolbar [data-diagram-scope="site"]').click();await page.waitForTimeout(400);
  const text=()=>page.locator('.diagram-scroll').textContent();
  ok((await text()).includes('EXAMPLE-CORE')&&(await text()).includes('EXAMPLE-EDGE'),'both devices are drawn');
  ok(await page.locator('.diagram-scroll polyline[data-line]').count()===1,'the link their port descriptions imply is drawn');
  await page.locator('[data-diagram-editmode]').click();await page.waitForTimeout(300);
  await page.locator('.diagram-page-view [data-sitemap-zoom="in"]').click();await page.locator('.diagram-page-view [data-sitemap-zoom="in"]').click();await page.waitForTimeout(200);const zoomed=await page.locator('.diagram-page-view .zoom-level').innerText();
  await page.locator('[data-site-links]').click();await page.waitForTimeout(300);const links=await page.locator('#modal .modal-body').innerText();
  ok(/From the configurations/.test(links)&&/Gi1\/0\/1/.test(links)&&/Gi1\/0\/24/.test(links),'the link says where it comes from, with both ports: '+links.split('\n')[0]);
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  await page.locator('[data-site-add="device"]').click();await page.locator('[data-add-dev="name"]').fill('EXAMPLE-ISP');await page.locator('[data-add-dev="type"]').selectOption('Router');await page.locator('[data-add-dev-save]').click();await page.waitForTimeout(400);
  ok((await text()).includes('EXAMPLE-ISP'),'a device can be added by hand');
  ok(await page.locator('.diagram-page-view .zoom-level').innerText()===zoomed,'an edit keeps the zoom ('+zoomed+'), the view does not reset');
  await page.locator('.diagram-page-view [data-sitemap-zoom="fit"]').click();await page.waitForTimeout(200);
  // A box drawn on empty space selects the devices inside it.
  const sb=await page.locator('.diagram-scroll > svg').boundingBox();await page.mouse.move(sb.x+sb.width-3,sb.y+sb.height-3);await page.mouse.down();await page.mouse.move(sb.x+3,sb.y+3,{steps:5});await page.mouse.up();await page.waitForTimeout(200);
  ok(await page.locator('.diagram-scroll .selected').count()>=2&&/selected/i.test(await page.locator('.diagram-editbar .pop-label').first().innerText()),'a selection box selects several devices: '+(await page.locator('.diagram-scroll .selected').count())+' '+(await page.locator('.diagram-editbar .pop-label').first().innerText())+' handles '+(await page.locator('.line-handles').count()));
  await page.locator('[data-site-add="link"]').click();await page.locator('[data-add-link-dev="0"]').selectOption('EXAMPLE-ISP');await page.locator('[data-add-link-dev="1"]').selectOption('EXAMPLE-CORE');await page.locator('[data-add-link-port="1"]').fill('GigabitEthernet1/0/2');await page.locator('[data-add-link-save]').click();await page.waitForTimeout(400);
  ok(await page.locator('.diagram-scroll polyline[data-line]').count()===2,'a link can be added by hand');
  await page.keyboard.press('Control+z');await page.waitForTimeout(300);ok(await page.locator('.diagram-scroll polyline[data-line]').count()===1,'Ctrl+Z undoes it');
  await page.keyboard.press('Control+Shift+z');await page.waitForTimeout(300);ok(await page.locator('.diagram-scroll polyline[data-line]').count()===2,'Ctrl+Shift+Z redoes it');
  // A bend added from the link's menu, then removed by undo.
  const pts=async()=>Math.max(...await page.locator('.diagram-scroll polyline[data-line]').evaluateAll(ls=>ls.map(l=>l.getAttribute('data-route').split(' ').length)));const before=await pts();
  await page.evaluate(()=>{const ls=[...document.querySelectorAll('.diagram-scroll polyline[data-line]')].sort((a,b)=>b.getAttribute('data-route').split(' ').length-a.getAttribute('data-route').split(' ').length),l=ls[0],r=l.getAttribute('data-route').split(' ').map(q=>q.split(',').map(Number)),i=Math.floor((r.length-2)/2),m=[(r[i][0]+r[i+1][0])/2,(r[i][1]+r[i+1][1])/2],svg=l.ownerSVGElement,p=svg.createSVGPoint();p.x=m[0];p.y=m[1];const c=p.matrixTransform(svg.getScreenCTM());l.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:c.x,clientY:c.y,button:2}));});
  await page.locator('.diagram-ctx [data-ctx="bend"]').click();await page.waitForTimeout(300);ok(await pts()>before,'a bend can be added to a link');
  await page.keyboard.press('Control+z');await page.waitForTimeout(300);ok(await pts()===before,'and undone');
  // A stretch dragged onto the line of another stretch snaps to it and merges.
  const routeOf=()=>page.locator('.diagram-scroll polyline[data-line]').evaluateAll(ls=>ls.map(l=>l.getAttribute('data-route')).sort((a,b)=>b.split(' ').length-a.split(' ').length)[0]);const r0=await routeOf();
  await page.evaluate(()=>{const ls=[...document.querySelectorAll('.diagram-scroll polyline[data-line]')].sort((a,b)=>b.getAttribute('data-route').split(' ').length-a.getAttribute('data-route').split(' ').length),l=ls[0],r=l.getAttribute('data-route').split(' ').map(q=>q.split(',').map(Number)),i=Math.floor((r.length-2)/2),m=[(r[i][0]+r[i+1][0])/2,(r[i][1]+r[i+1][1])/2],svg=l.ownerSVGElement,p=svg.createSVGPoint();p.x=m[0];p.y=m[1];const c=p.matrixTransform(svg.getScreenCTM());l.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:c.x,clientY:c.y,button:2}));});
  await page.locator('.diagram-ctx [data-ctx="bend"]').click();await page.waitForTimeout(300);const r1=await routeOf();
  const drag=await page.evaluate(([a,b])=>{const P=s=>s.split(' ').map(q=>q.split(',').map(Number)),old=new Set(a.split(' ')),nr=P(b),fresh=nr.filter(p=>!old.has(p.join(',')));if(fresh.length<4)return null;const h=fresh[1][1]===fresh[2][1],mid=[(fresh[1][0]+fresh[2][0])/2,(fresh[1][1]+fresh[2][1])/2],to=h?[mid[0],fresh[0][1]]:[fresh[0][0],mid[1]];
    const svg=document.querySelector('.diagram-scroll > svg'),M=svg.getScreenCTM(),sc=q=>{const p=svg.createSVGPoint();p.x=q[0];p.y=q[1];const c=p.matrixTransform(M);return [c.x,c.y];};return [sc(mid),sc(to)];},[r0,r1]);
  ok(drag,'the bend adds a jog to drag');
  await page.mouse.move(drag[0][0],drag[0][1]);await page.mouse.down();await page.mouse.move((drag[0][0]+drag[1][0])/2,(drag[0][1]+drag[1][1])/2+1,{steps:3});await page.mouse.move(drag[1][0]+1,drag[1][1]+1,{steps:3});await page.mouse.up();await page.waitForTimeout(400);
ok((await routeOf()).split(' ').length===r0.split(' ').length,'dragging the jog back onto the line merges it: '+(await routeOf()));
  // Ctrl+click on a link adds a point (a jog to drag), Ctrl+click on a corner removes it.
  const mid2=await page.evaluate(()=>{const ls=[...document.querySelectorAll('.diagram-scroll polyline[data-line]')].sort((a,b)=>b.getAttribute('data-route').split(' ').length-a.getAttribute('data-route').split(' ').length),r=ls[0].getAttribute('data-route').split(' ').map(q=>q.split(',').map(Number));let k=0,best=0;for(let i=0;i<r.length-1;i++){const d=Math.abs(r[i][0]-r[i+1][0])+Math.abs(r[i][1]-r[i+1][1]);if(i>0&&i<r.length-2&&d>best){best=d;k=i;}}if(!best)k=Math.floor((r.length-2)/2);const m=[(r[k][0]+r[k+1][0])/2,(r[k][1]+r[k+1][1])/2],svg=ls[0].ownerSVGElement,p=svg.createSVGPoint();p.x=m[0];p.y=m[1];const c=p.matrixTransform(svg.getScreenCTM());return [c.x,c.y];});
  await page.keyboard.down('Control');await page.mouse.click(mid2[0],mid2[1]);await page.keyboard.up('Control');await page.waitForTimeout(300);ok((await routeOf()).split(' ').length>r0.split(' ').length,'Ctrl+click adds a point to a link');
  await page.keyboard.press('Control+z');await page.waitForTimeout(300);
  await page.locator('[data-site-links]').click();await page.waitForTimeout(200);await page.locator('#modal [data-site-link-remove][data-manual="0"]').first().click();await page.waitForTimeout(300);await page.keyboard.press('Escape');await page.waitForTimeout(200);
  ok(await page.locator('.diagram-scroll polyline[data-line]').count()===1,'a wrong link from the configurations can be removed');
  // One link given its own type: its color changes and the legend gains its entry.
  await page.evaluate(()=>{const l=document.querySelector('.diagram-scroll polyline[data-line]'),r=l.getAttribute('data-route').split(' ').map(q=>q.split(',').map(Number)),m=[(r[0][0]+r[1][0])/2,(r[0][1]+r[1][1])/2],svg=l.ownerSVGElement,p=svg.createSVGPoint();p.x=m[0];p.y=m[1];const c=p.matrixTransform(svg.getScreenCTM());l.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:c.x,clientY:c.y,button:2}));});
  await page.locator('.diagram-ctx [data-ctx="style"]').click();await page.locator('[data-link-style="label"]').fill('10 Gbps SFP+ DAC');await page.locator('[data-link-style="color"]').evaluate(e=>{e.value='#000000';});await page.locator('[data-link-style-save]').click();await page.waitForTimeout(400);
  ok((await page.locator('.diagram-scroll polyline[data-line]').evaluateAll(ls=>ls.map(l=>l.getAttribute('stroke')))).includes('#000000')&&(await page.locator('.diagram-scroll text[data-kind]').allTextContents()).includes('10 Gbps SFP+ DAC'),'one link can be given its own type, with its own legend entry');
  await page.keyboard.press('Control+z');await page.waitForTimeout(300);
  // The connection types legend: editable on hover, with options on right-click.
  {const entry=page.locator('.diagram-scroll text[data-kind]').first();await entry.scrollIntoViewIfNeeded();await entry.hover();
   {const st=await entry.evaluate(e=>[getComputedStyle(e).cursor,getComputedStyle(e).textDecorationLine,!!e.querySelector('title'),e.outerHTML.slice(0,200)]);ok(st[0]==='pointer'&&st[1].includes('underline')&&st[2],'a legend entry shows that it can be edited: '+JSON.stringify(st));}
   const kind=await entry.getAttribute('data-kind');await entry.click({button:'right'});
   const opts=await page.locator('[data-legend-menu] [data-legend-ctx]').allInnerTexts();ok(opts.some(t=>/color, name and thickness/.test(t))&&opts.some(t=>/Highlight/.test(t)),'right-click opens its options: '+opts.join(' | '));
   await page.locator('[data-legend-ctx="highlight"]').click();const dim=await page.locator('.diagram-scroll polyline[data-line]').evaluateAll((ls,k)=>ls.map(l=>[l.getAttribute('data-kind')===k,l.style.opacity]),kind);
   ok(dim.some(d=>d[0]&&d[1]==='')&&dim.every(d=>d[0]||d[1]==='0.15'),'highlighting dims every other type of link');
   await entry.click({button:'right'});await page.locator('[data-legend-ctx="style"]').click();ok(await page.locator('[data-link-style="label"]').count()===1&&await page.locator('[data-link-style="width"]').count()===1,'and changes its color, name and thickness');
   await page.locator('[data-link-style="width"]').selectOption('4');await page.locator('[data-link-style="dash"]').selectOption('1');await page.locator('[data-link-style-save]').click();await page.waitForTimeout(500);
   const st=await page.evaluate(k=>{const q=s=>[...document.querySelectorAll(s)];return {lines:q('.diagram-scroll polyline[data-line][data-kind="'+k+'"]').map(l=>[l.getAttribute('stroke-width'),l.getAttribute('stroke-dasharray')]),legend:q('.diagram-scroll polyline[data-kind="'+k+'"]:not([data-line])').map(l=>[l.getAttribute('stroke-width'),l.getAttribute('stroke-dasharray')])};},kind);
   ok(st.lines.length&&st.legend.length&&st.lines.concat(st.legend).every(x=>x[0]==='4'&&!!x[1]),'a thickness and line change in the legend reaches every link of the type and the legend: '+JSON.stringify(st));
   await entry.click({button:'right'});await page.locator('[data-legend-ctx="style"]').click();await page.locator('[data-link-style="swatch"],[data-link-swatch]').first().waitFor();
   ok(await page.locator('[data-link-swatch]').count()>=40,'the Link type dialog offers a broad set of base colors');await page.locator('[data-link-swatch="#7030a0"]').click();ok((await page.locator('[data-link-style="color"]').inputValue())==='#7030a0','a base color sets the color');
   ok(await page.locator('[data-link-style="module"]').inputValue()==='auto'&&(await page.locator('[data-link-style="module"] option').allTextContents()).some(t=>/DAC cable end/.test(t)),'the Link type dialog offers a port module, automatic by default');
   const cables=await page.locator('#link-cables option').evaluateAll(o=>o.map(x=>x.value));ok(['SFP+ DAC','QSFP28 DAC','Breakout DAC (QSFP to 4x SFP)','Active DAC (ACC)','AOC','OM4 multimode fiber','OS2 single-mode fiber','Cat6A copper','Other'].every(c=>cables.includes(c))&&cables.length>=50,'the cable type list offers DACs, fiber grades, copper and other cables: '+cables.length);
   await page.locator('[data-link-style="speed"]').fill('25 Gbps');await page.locator('[data-link-style="cable"]').fill('SR fiber');
   const auto=await page.locator('[data-link-style="label"]').inputValue();await page.locator('[data-link-style-save]').click();await page.waitForTimeout(500);
   const lg=await page.locator('.diagram-scroll text[data-kind="'+kind+'"]').allTextContents(),tt=await page.locator('.diagram-scroll polyline[data-line][data-kind="'+kind+'"] title').allTextContents();
   ok(auto==='25 Gbps SR fiber'&&lg.includes('25 Gbps SR fiber')&&tt.length&&tt.every(x=>/25 Gbps, SR fiber/.test(x)),'speed and cable type name the type and reach every link of it: '+JSON.stringify({auto,lg,tt:tt.slice(0,2)}));
   await entry.click({button:'right'});await page.locator('[data-legend-ctx="reset"]').click();await page.waitForTimeout(400);}
  const theme=()=>page.locator('html').getAttribute('data-theme');const t0=await theme();await page.locator('#theme-choice').click();ok(await theme()!==t0&&await page.locator('#theme-choice').getAttribute('aria-pressed')===String(await theme()==='dark'),'the theme is one button that switches light and dark');await page.locator('#theme-choice').click();ok(await theme()===t0,'and back');
  ok(!errors.length,'no page errors: '+errors.join('; '));
  console.log(checks+' configuration-only diagram browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

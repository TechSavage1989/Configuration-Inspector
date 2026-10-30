const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('playwright'),{configuration}=require('./cisco-3650-tests.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles({name:'example-3650.conf',mimeType:'text/plain',buffer:Buffer.from(configuration())});
  await page.locator('#modal').waitFor({state:'hidden'});
  await page.locator('.hardware-chassis[data-hardware-member="1"]').waitFor();
  for(const member of ['1','2']){
   const frame=page.locator('.hardware-chassis[data-hardware-member="'+member+'"]');
   assert.equal(await frame.locator('.hardware-port-cell').count(),52,'all ports displayed by default');
   assert.match(await frame.locator('[data-unused-section]').textContent(),/^Hide unused/);
   assert.equal(await frame.locator('[data-unused-section]').getAttribute('aria-expanded'),'true');
   assert.equal(await frame.locator('[data-connector="RJ45"] .hardware-port-cell').count(),48);
   assert.equal(await frame.locator('[data-connector="SFP"] .hardware-port-cell').count(),2);
   assert.equal(await frame.locator('[data-connector="SFP+"] .hardware-port-cell').count(),2);
   const uplinks=await frame.locator('[data-connector^="SFP"] .hardware-port-cell').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));
   assert.ok(uplinks.every(y=>Math.abs(y-uplinks[0])<1),'four uplinks share a physical row');
  }
  for(const width of [1280,960]){
   await page.setViewportSize({width,height:900});
   const layout=await page.locator('.hardware-chassis').evaluateAll(frames=>frames.map(frame=>{
    const face=frame.querySelector('.hardware-face-scroll'),cells=[...frame.querySelectorAll('.hardware-port-cell')].map(e=>e.getBoundingClientRect());
    return {fits:face.scrollWidth<=face.clientWidth+1,overlap:cells.some((a,i)=>cells.slice(i+1).some(b=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)),labels:[...frame.querySelectorAll('.glance-port-name')].every(e=>e.getBoundingClientRect().right<=e.closest('.interface-badge').getBoundingClientRect().right+1)};
   }));
   assert.ok(layout.every(x=>x.fits&&!x.overlap&&x.labels),'port layout fits without collisions at '+width);
  }
  await page.setViewportSize({width:1280,height:900});
  const second=page.locator('.hardware-chassis[data-hardware-member="2"]');
  await second.locator('[data-action="identify-hardware"]').click();
  await page.locator('#hardware-model-input').fill('Cisco WS-C3650-48FD-L');
  await page.locator('[data-action="save-hardware-model"]').click();
  assert.match(await second.locator('h3').textContent(),/WS-C3650-48FD-L/);
  assert.equal(await second.locator('.hardware-port-cell').count(),52,'exact FD model keeps all sockets');
  await second.locator('[data-unused-section]').click();
  assert.equal(await second.locator('.hardware-port-cell').count(),2,'hide unused compacts visible ports');
  assert.equal(await second.locator('.hardware-face').getAttribute('data-port-layout'),'compact');
  assert.match(await second.locator('[data-unused-section]').textContent(),/^Show unused/);
  assert.equal(await second.locator('[data-unused-section]').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('.hardware-chassis[data-hardware-member="1"] .hardware-port-cell').count(),52,'visibility changes only the selected group');
  await second.locator('[data-unused-section]').click();
  assert.equal(await second.locator('.hardware-port-cell').count(),52,'show unused restores every port');
  assert.equal(await second.locator('.hardware-face').getAttribute('data-port-layout'),'physical');
  fs.mkdirSync('test-results',{recursive:true});
  await page.locator('.interface-glance').screenshot({path:'test-results/cisco-3650-stack.png'});
  await second.locator('[data-unused-section]').click();
  // A new import resets an explicit hide choice, including logical interface groups.
  const next=configuration().replace('end\n','interface Vlan30\n shutdown\n!\ninterface Port-channel9\n shutdown\n!\ninterface Loopback9\n shutdown\n!\nend\n');
  await page.locator('#import-file').setInputFiles({name:'example-all-interfaces.conf',mimeType:'text/plain',buffer:Buffer.from(next)});
  await page.locator('#modal').waitFor({state:'hidden'});
  await page.waitForFunction(()=>[...document.querySelectorAll('.interface-glance .glance-port-name')].some(e=>e.textContent==='Loopback9'));
  const expected=await page.evaluate(text=>window.SWCore.parse(text,{}).categories.interfaces.map(r=>r.id).sort(),next);
  const visible=await page.locator('.interface-glance .interface-badge').evaluateAll(es=>es.map(e=>e.dataset.record).sort());
  assert.deepEqual(visible,expected,'every imported physical and logical interface is visible');
  const vlans=page.locator('.glance-group').filter({hasText:'VLANs and subinterfaces'});
  assert.equal(await vlans.locator('.interface-badge').count(),2,'unused VLAN visible by default');
  await vlans.locator('[data-unused-section]').click();
  assert.equal(await vlans.locator('.interface-badge').count(),1,'logical group supports hiding unused');
  assert.equal(await page.locator('.hardware-port-cell').count(),104,'logical toggle leaves physical ports visible');
  await vlans.locator('[data-unused-section]').click();
  assert.equal(await vlans.locator('.interface-badge').count(),2,'logical group supports showing all again');
  assert.deepEqual(errors,[]);console.log('Cisco 3650 browser layout and model-selection checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

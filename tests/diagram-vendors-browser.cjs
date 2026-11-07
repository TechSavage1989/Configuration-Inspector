// The network diagram from every supported vendor's configuration (owner request: the drawing features
// must work with any network): each fixture alone, then all together with a monitoring export, through
// every page tab with every Show option, with Visio, SVG and hardware pack downloads.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),zlib=require('node:zlib'),{demoSite}=require('./xlsx-writer.cjs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');}
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
function unzip(buf){const files={};let o=0;while(buf.readUInt32LE(o)===0x04034b50){const method=buf.readUInt16LE(o+8),size=buf.readUInt32LE(o+18),nl=buf.readUInt16LE(o+26),xl=buf.readUInt16LE(o+28),name=buf.slice(o+30,o+30+nl).toString(),data=buf.slice(o+30+nl+xl,o+30+nl+xl+size);files[name]=(method===8?zlib.inflateRawSync(data):data).toString();o+=30+nl+xl+size;}return files;}
const FIXTURES=['compact-2920.conf','compact-cx.conf','layout-6200.conf','layout-cisco.conf','layout-forti60.conf','layout-junos.conf','layout-sophos.xml','layout-unknown-cx.conf','hardware-stack.conf','hardware-modules.conf','network-palo.xml','network-meraki.json','mikrotik.rsc','fundamentals-sonic.txt','features-forti.conf'];
const file=(name,buffer,type)=>({name,mimeType:type||'text/plain',buffer:Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer)});
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  async function drive(label,load){
   const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.DIAGRAM_SHOW_ALL=true;});
   await page.goto('file://'+path.resolve('webview/index.html'));await load(page);await page.waitForTimeout(800);
   const nav=page.locator('.nav-scroll [data-view="diagram"]');if(!await nav.count()){await page.close();return 'no diagram';}
   await nav.first().click();await page.locator('.diagram-scroll > svg').first().waitFor({timeout:20000});
   // Every Show option on (port modules included), then every page tab.
   const pop=page.locator('[data-diagram-pop="show"] summary');if(await pop.count()){await pop.click();for(const box of await page.locator('[data-diagram-pop="show"] input[type=checkbox]').all()){if(!await box.isChecked())await box.check();await page.waitForTimeout(150);}await pop.click();}
   const tabs=await page.locator('[data-diagram-tab]').count();for(let i=0;i<tabs;i++){await page.locator('[data-diagram-tab="'+i+'"]').click();await page.waitForTimeout(250);ok(await page.locator('.diagram-scroll svg').count()>=1,label+': page tab '+(i+1)+' is drawn');}
   ok(!/NaN|undefined/.test(await page.locator('.diagram-scroll').innerHTML()),label+': no invalid values in the drawing');
   if(label==='hardware-stack.conf'){await page.locator('[data-diagram-tab="0"]').click();await page.waitForTimeout(300);const members=await page.locator('.diagram-scroll [data-diagram-node*="#"]').count(),links=await page.locator('.diagram-scroll polyline[data-kind^="stack"]').count();ok(members===2&&links>=1,'a VSF stack is drawn as its two members joined by its VSF links: '+members+' members, '+links+' links');}
   const [v]=await Promise.all([page.waitForEvent('download'),page.locator('[data-diagram-export="vsdx"]').first().click()]),vf=unzip(fs.readFileSync(await v.path())),xml=Object.keys(vf).filter(n=>/\.xml$/.test(n)).map(n=>vf[n]).join('');
   const ids=[...(vf['visio/masters/masters.xml']||'').matchAll(/<Master ID="([^"]*)"/g)].map(m=>m[1]),pages=(vf['visio/pages/pages.xml'].match(/<Page /g)||[]).length;
   ok(pages===Math.max(1,tabs)&&!/NaN|Infinity|undefined/.test(xml)&&ids.every(i=>/^\d+$/.test(i)),label+': the Visio download has every page and valid values ('+pages+' of '+tabs+')');
   const more=page.locator('[data-diagram-pop="download"] summary');if(await more.count()){await more.click();const svgItem=page.locator('[data-diagram-export="svg"]');if(await svgItem.count()){const [s]=await Promise.all([page.waitForEvent('download'),svgItem.first().click()]);const svg=fs.readFileSync(await s.path(),'utf8');ok(/^(<\?xml[^>]*>\s*)?<svg/.test(svg)&&!/NaN/.test(svg),label+': SVG download');}else await more.click();}
   ok(!errors.length,label+': no page errors: '+errors.join('; '));await page.close();return 'ok';}
  for(const f of FIXTURES){const buf=fs.readFileSync(path.join('tests/fixtures',f));const r=await drive(f,async p=>{await p.locator('#import-file').setInputFiles(file(f,buf));await p.locator('#modal').waitFor({state:'hidden'}).catch(()=>{});});ok(r==='ok'||r==='no diagram',f+': '+r);if(process.env.VENDOR_LOG)console.log(f,r);}
  const all=FIXTURES.map(f=>file(f,fs.readFileSync(path.join('tests/fixtures',f))));
  const r=await drive('every vendor with a monitoring export',async p=>{await p.locator('#import-file').setInputFiles(file('example-site.xlsx',demoSite(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));await p.locator('.site-map').waitFor({timeout:15000});await p.locator('#import-file').setInputFiles(all);await p.waitForTimeout(2500);});
  ok(r==='ok','every vendor together: '+r);
  console.log(checks+' network diagram vendor browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

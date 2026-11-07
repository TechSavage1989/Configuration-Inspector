// In-app dropdowns and clear buttons (owner request): selects and suggestion lists open a menu in
// the app's own style instead of the native popups, a suggestion list shows every choice even
// when the box already holds text, and text boxes get a clear button while they hold text.
const assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright'),{configuration}=require('./cisco-3650-tests.cjs');
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CI_CHROME_PATH?{executablePath:process.env.CI_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('webview/index.html'));
  await page.locator('#import-file').setInputFiles({name:'example-3650.conf',mimeType:'text/plain',buffer:Buffer.from(configuration())});
  await page.locator('#modal').waitFor({state:'hidden'});await page.locator('.hardware-chassis[data-hardware-member="1"]').waitFor();
  ok(await page.locator('input[list]').count()===0,'no box uses the native suggestion popup');
  // Suggestion box: every choice even with text in the box, typing narrows, choosing fills it.
  await page.locator('.hardware-chassis[data-hardware-member="2"] [data-action="identify-hardware"]').click();
  const box=page.locator('#hardware-model-input');await box.waitFor();ok(await box.evaluate(e=>e.classList.contains('pick-combo')),'the model box uses the in-app suggestion menu');
  const total=await page.locator('#hardware-model-options option').count();
  await box.fill('WS-C3650-48FD-L');await page.keyboard.press('Escape');await page.locator('.pick-menu').waitFor({state:'hidden'});
  const menu=page.locator('.pick-menu');await box.click();await menu.waitFor({state:'visible'});ok(await menu.locator('.pick-option').count()===total&&total>20,'with text in the box, clicking it still lists every model: '+total);
  await box.fill('');await box.pressSequentially('9300');await page.waitForTimeout(100);const narrowed=await menu.locator('.pick-option').allTextContents();
  ok(narrowed.length>0&&narrowed.length<total&&narrowed.every(t=>t.includes('9300')),'typing narrows the list: '+narrowed.length);
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');ok((await box.inputValue()).includes('9300')&&!(await menu.isVisible()),'the keyboard picks a model and closes the menu');
  await box.click();await menu.waitFor({state:'visible'});const first=await menu.locator('.pick-option').first().textContent();await menu.locator('.pick-option').first().click();const got=await box.inputValue();ok(got&&first.startsWith(got),'a mouse click on a suggestion fills the box inside a dialog: '+JSON.stringify([got,first]));
  // Clear button on a text box that holds text.
  await box.focus();const clear=page.locator('.input-clear');await clear.waitFor({state:'visible'});
  const bb=await box.boundingBox(),cb=await clear.boundingBox();ok(cb.x>bb.x+bb.width/2&&cb.x+cb.width<=bb.x+bb.width&&cb.y>=bb.y&&cb.y+cb.height<=bb.y+bb.height,'the clear button sits inside the right end of the box');
  await clear.click();ok((await box.inputValue())===''&&await box.evaluate(e=>document.activeElement===e),'the clear button empties the box and keeps it focused');
  ok(!(await clear.isVisible()),'the clear button hides once the box is empty');
  await page.keyboard.press('Escape');
  const search=page.locator('input[type=search]:visible, .table-search:visible').first();if(await search.count()){await search.fill('Gi');await search.hover();await clear.waitFor({state:'visible'});await clear.click();ok((await search.inputValue())==='','search boxes get the clear button too');}
  // A select opens the in-app menu; choosing an option changes it like the native list would.
  await page.locator('.nav-scroll [data-view="diagram"]').first().click();const sel=page.locator('#diagram-depth');await sel.waitFor();
  const opts=await sel.evaluate(s=>Array.from(s.options).filter(o=>!o.hidden).map(o=>o.value)),before=await sel.inputValue();
  await sel.click();await menu.waitFor({state:'visible'});
  ok(await menu.locator('.pick-option').count()===opts.length,'the menu lists every option of the select');
  ok(await menu.locator('.pick-option.selected').count()===1,'the current choice is marked');
  const other=opts.find(v=>v!==before);if(other!=null){const changed=sel.evaluate(s=>new Promise(r=>s.addEventListener('change',()=>r(s.value),{once:true})));await menu.locator('.pick-option').nth(opts.indexOf(other)).click();ok(await changed===other,'choosing an option sets the select and fires change');}
  await page.keyboard.press('Escape');
  ok(!errors.length,'no page errors: '+errors.join('; '));
  console.log(checks+' in-app dropdown and clear button browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

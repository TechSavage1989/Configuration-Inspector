const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {boot}=require('./harness.cjs');let checks=0;function ok(value,message){checks++;assert.ok(value,message)}
function moduleUnderTest(){const ctx={TextEncoder,Map,JSON,console};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('webview/updates.js','utf8'),ctx);return ctx.SWUpdates;}
(async()=>{
const U=moduleUnderTest();ok(!U.manager.native);assert.throws(()=>U.manager.request('update-check'));checks++;
const sent=[],listeners=[],bridge={postMessage:x=>sent.push(x),addEventListener:(name,f)=>listeners.push(f)},u=U.create({bridge});let status,restored,error;
u.start({change:v=>status=v,restore:async data=>{restored=data;},error:e=>error=e});ok(sent[0]==='update-ui-ready');u.request('update-check');ok(sent.at(-1)==='update-check');assert.throws(()=>u.request('shell-execute'));checks++;
await listeners[0]({data:{type:'config-inspector-updates',state:'evil',message:'x',busy:false,automatic:true}});ok(!status);
await listeners[0]({data:{type:'config-inspector-updates',state:'ready',message:'Ready',busy:false,automatic:true,ready:true,available:true,version:'5.17.0'}});ok(status.ready);ok(u.state().version==='5.17.0');
u.install('{"schema":1,"models":[]}');ok(sent.at(-1).startsWith('update-install\n'));assert.throws(()=>u.install('{}'));checks++;
await listeners[0]({data:{type:'config-inspector-updates',state:'error',message:'Locked file',busy:false,automatic:true}});ok(!u.installing());
await listeners[0]({data:{type:'config-inspector-update-workspace',workspace:{schema:1}}});ok(restored.schema===1);ok(sent.at(-1)==='update-restored');
await listeners[0]({data:{type:'config-inspector-update-workspace',workspace:{schema:2}}});ok(restored.schema===1,'duplicate restoration message ignored');
const broken=U.create({bridge});broken.start({restore:()=>{throw Error('test');},error:e=>error=e});await listeners[1]({data:{type:'config-inspector-update-workspace',workspace:{}}});ok(error.includes('previous version'));ok(sent.at(-1)==='update-restore-failed');
const {ctx,load}=boot();const models=[];
for(const file of ['tests/fixtures/fundamentals-forti.conf','tests/fixtures/fundamentals-cisco.conf','tests/fixtures/fundamentals-sophos.xml','tests/fixtures/review-palo.xml','tests/fixtures/fundamentals-meraki.json']){if(fs.existsSync(file))models.push(load(file));}
models.push(ctx.SWCore.parse('firewallName=Example&iface_name_0=X0&iface_ip_0=10.0.0.1',{filename:'example.exp'}));
const state={model:models[1],comparison:models[2],view:'routes',scope:'global',categoryTabs:{routes:'routes'},showUnassigned:true,showEmpty:false};
const encoded=U.snapshot(ctx.SWCore,models,state),data=JSON.parse(encoded),decoded=await U.decodeWorkspace(data,(text,options)=>ctx.SWCore.parse(text,options));
ok(decoded.models.length===models.length);ok(decoded.model===decoded.models[1]);ok(decoded.comparison===decoded.models[2]);ok(decoded.view==='routes');ok(decoded.showUnassigned);ok(decoded.categoryTabs.routes==='routes');
models.forEach((m,i)=>{const actual=decoded.models[i];ok(actual.meta.filename===m.meta.filename);ok(actual.meta.vendorId===m.meta.vendorId);ok(actual.decodedText===m.decodedText);assert.deepEqual(JSON.parse(JSON.stringify(actual.entries.map(e=>[e.key,e.value]))),JSON.parse(JSON.stringify(m.entries.map(e=>[e.key,e.value]))));checks++;});
const separate=models[0],small=JSON.parse(U.snapshot(ctx.SWCore,[models[1]],{model:models[1],comparison:separate,view:'compare'}));const out=await U.decodeWorkspace(small,t=>ctx.SWCore.parse(t));ok(out.models.length===1);ok(out.comparison.meta.vendorId===separate.meta.vendorId);
for(const bad of [{}, {...data,selected:999}, {...data,count:-1}, {...data,comparison:1.5}, {...data,models:[{}]}]){await assert.rejects(()=>U.decodeWorkspace(bad,t=>ctx.SWCore.parse(t)));checks++;}
const empty=await U.decodeWorkspace(JSON.parse(U.snapshot(ctx.SWCore,[],{model:null,comparison:null,view:'overview'})),()=>{});ok(!empty.model&&empty.models.length===0);
await assert.rejects(()=>U.decodeWorkspace(data,()=>{throw Error('Broken snapshot');}));checks++;
console.log(checks+' updater bridge and workspace checks passed');
})().catch(e=>{console.error(e);process.exit(1)});

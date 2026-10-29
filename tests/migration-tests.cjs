const assert=require('node:assert/strict');const M=require('../webview/migration.js');
const r=(id,name,category,summary)=>({id,name,category,summary,scope:'global',fields:[],references:{}}),model=records=>({records});
const a=r('a','Old LAN','interfaces',{ip:'192.0.2.1',mask:'/24'}),b=r('b','New LAN','interfaces',{ip:'192.0.2.1',mask:'/24'});let out=M.analyze(model([a]),model([b]));assert.equal(out.items[0].status,'Verified match');assert.equal(out.items[0].target,b);
b.summary.ip='192.0.2.2';out=M.analyze(model([a]),model([b]),{a:'b'});assert.equal(out.items[0].status,'Difference');assert.equal(out.items[0].rows.find(x=>x.key==='ip').equal,false);
assert.equal(M.analyze(model([a]),model([])).items[0].status,'Missing');assert.equal(M.analyze(model([]),model([b])).items[0].status,'Additional');
const c=r('c','policy','policies',{action:'Allow',source:'Any',destination:'Any'});assert.equal(M.analyze(model([c]),model([{...c,id:'d'}])).items[0].status,'Needs review');
const empty=r('e','Empty','interfaces',{status:'Enabled'});assert.equal(M.analyze(model([empty]),model([{...empty,id:'f'}])).items[0].status,'Needs review');
const snapshot=JSON.stringify([a,b]);M.analyze(model([a]),model([b]));assert.equal(JSON.stringify([a,b]),snapshot);
console.log('9 migration validation checks passed');

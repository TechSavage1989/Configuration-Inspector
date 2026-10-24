const fs=require('fs'),assert=require('assert'),{boot}=require('./harness.cjs');
const current=boot(),previous=boot('tests/baseline-5.6.0.html');let checks=0;
function ok(value,message){checks++;assert(value,message);}
const expected={junos:['web','app','files','email','inspection','ips','groups'],forti:['web','app','files','ips','inspection','dns','email','data','webserver','groups'],palo:['web','app','files','ips','inspection','data','groups'],sophos:['web','app','files','ips','inspection','email'],sonic:['web','app','files','ips','inspection','email','network']};
for(const [vendor,types] of Object.entries(expected)){
 const name=fs.readdirSync('tests/fixtures').find(n=>n.startsWith('security-'+vendor+'.')),file='tests/fixtures/'+name,m=current.load(file),old=previous.load(file),{ctx}=current,a=ctx.audit,security=a.records('security'),features=security.filter(r=>r.summary.securityFeature);
 ok(JSON.stringify(m.entries.map(e=>[e.key,e.value,e.recordId,e.category]))===JSON.stringify(old.entries.map(e=>[e.key,e.value,e.recordId,e.category])),vendor+' preserves original values and field ownership');
 ok(ctx.SWCore.readable(m,false)===previous.ctx.SWCore.readable(old,false),vendor+' readable source export unchanged');
 ok(ctx.SWCore.report(m,false).replace(/<section id="manufacturer-hardware">[\s\S]*?<\/section>/,'').replace(/<section id="filter-category-actions">[\s\S]*?<\/section>/,'')===previous.ctx.SWCore.report(old,false),vendor+' HTML source report unchanged');
 ok(features.length>0&&security.every(r=>r.summary.securityFeature),vendor+' main security pages contain typed configurations');
 for(const type of types)ok(features.some(r=>r.family==='security-'+type),vendor+' '+type+' available');
 a.state.view='security';const children=a.availableTabs('security');
 ok(children.every(t=>t.id.startsWith('feature-security-')),vendor+' generic profiles page hidden');
 ok(!children.some(t=>t.id==='related'),vendor+' empty related settings hidden');
 for(const child of children){a.state.categoryTabs.security=child.id;const spec=a.tableSpec();ok(spec.rows.length>0&&spec.rows.every(r=>a.recordTab(r)===child.id),vendor+' '+child.label+' contains its type only');}
 for(const r of features){
  ok(r.fields.length&&r.fields.every(e=>m.entries.includes(e)),vendor+' '+r.name+' points to original source entries');
  ok(ctx.SWImporters.recordConfigurationText(m,r,true).text.trim(),vendor+' '+r.name+' has source');
  ok(a.friendlyDetails(r).facts.length,vendor+' '+r.name+' has readable details');
 }
 ok(a.records('certificates').every(r=>!r.summary.securityFeature),vendor+' certificate objects remain separate');
 if(vendor==='junos'){
  ok(ctx.SWFeatures.facts(features.find(r=>r.name==='Staff')).some(f=>f.label==='Default action'&&f.value==='Block'),'Junos default web action presented');
  ok(a.friendlyDetails(features.find(r=>r.name==='Mixed')).facts.some(f=>f.ref&&f.ref.name==='Staff'),'Junos UTM group links to web profile');
 }
 if(vendor==='forti'){
  const ssl=features.find(r=>r.summary.securityKind==='SSL/SSH inspection profile'),av=features.find(r=>r.summary.securityKind==='Antivirus profile'&&r.name==='Shared'),policy=m.records.find(r=>r.category==='policies'&&r.name==='Internet'),group=features.find(r=>r.summary.securityKind==='Security profile group');
  ok(policy.references.security.includes(ssl.id)&&policy.references.security.includes(av.id),'typed references resolve identical names to correct profiles');
  ok(ssl.references.policies.includes(policy.id),'inspection profile links back to policy');
  ok(group.references.security.includes(ssl.id)&&group.references.security.includes(av.id),'profile group retains typed members');
  ok(a.friendlyDetails(policy).extra.includes(ssl.id),'policy details link to security profiles');
  ok(a.friendlyDetails(ssl).facts.some(f=>f.ref&&f.ref.name==='RootCA'),'inspection profile links to actual certificate');
  ok(ctx.SWFeatures.facts(ssl).some(f=>f.value==='Certificate inspection'),'certificate inspection is not reported as decryption');
  ok(features.find(r=>r.name==='certificate-looking-antivirus').family==='security-files','profile type determined by source rather than name');
  const file=features.find(r=>r.name==='Files'),facts=ctx.SWFeatures.facts(file);
  ok(facts.some(f=>f.label==='Rule Executables'&&f.value.includes('Block')&&f.value.includes('exe')&&!f.value.includes('pdf')),'file rule keeps match and action together');
  ok(facts.some(f=>f.label==='Rule Documents'&&f.value.includes('Log')&&f.value.includes('pdf')&&!f.value.includes('exe')),'second file rule remains separate');
  ok(facts.some(f=>f.value==='Disabled'),'explicitly disabled profile remains visible');
  ok(ctx.SWFeatures.facts(features.find(r=>r.name==='Web')).some(f=>f.value.includes('52')&&f.value.includes('Block')),'nested web category actions retained');
  a.state.view='certificates';ok(a.availableTabs('certificates').some(t=>t.id==='authorities'),'certificate authorities have their own page');
 }
 if(vendor==='palo'){
  ok(features.find(r=>r.name==='certificate-looking-antivirus').family==='security-files','PAN source type takes precedence over profile name');
  const profile=features.find(r=>r.name==='Inspect'),rule=features.find(r=>r.name==='Inspect outbound'),policy=m.records.find(r=>r.category==='policies'&&r.name==='Internet');
  ok(a.friendlyDetails(rule).facts.some(f=>f.ref&&f.ref.id===profile.id),'decryption rule links to shared inspection profile');
  ok(policy.references.security.length===2,'PAN policy links to shared profiles');
  ok(ctx.SWFeatures.facts(profile).some(f=>f.label==='Untrusted issuers'&&f.value==='Do not block'),'disabled certificate check has exact meaning');
 }
 if(vendor==='sophos'){
  const rule=features.find(r=>r.name==='Inspect outbound');ok(a.friendlyDetails(rule).facts.some(f=>f.label==='Configured state'&&f.value==='Disabled'),'Sophos Enable flag correctly represented');
  ok(a.friendlyDetails(rule).facts.some(f=>f.label==='Source zones'&&f.value==='LAN'),'Sophos nested source zones are readable');
 }
 if(vendor==='sonic'){
  const ssl=features.find(r=>r.name==='Client TLS inspection');
  ok(a.friendlyDetails(ssl).facts.some(f=>f.ref&&f.ref.name==='RootCA'),'Sonic inspection links to native certificate');
  ok(features.some(r=>r.name==='Certificate checks'),'OCSP belongs to inspection page');
  const protection=features.filter(r=>r.name.startsWith('Spoofing protection'));ok(protection.length===2&&protection.some(r=>r.name.endsWith('X0'))&&protection.some(r=>r.name.endsWith('X1')),'Sonic interface protection remains separate and uses port names');
  ok(protection.every(r=>r.fields.some(e=>e.base==='macIpSpoofIface')),'interface protection source includes its interface association');
  ok(features.some(r=>r.name==='Default action')&&features.some(r=>r.name==='Allowed sites'),'multiple object types sharing a native family remain separate');
  ok(a.friendlyDetails(features.find(r=>r.name==='Staff web policy')).facts.some(f=>f.ref&&f.ref.name==='Staff web profile'),'Sonic web policy links to its profile');
 }
 const json=vendor==='sonic'?ctx.SWCore.exportJSON(m,false):ctx.SWImporters.exportJSON(m,false),reopened=ctx.SWCore.parse(json,{});
 ok(JSON.stringify(reopened.entries.map(e=>[e.key,e.value,e.recordId]))===JSON.stringify(m.entries.map(e=>[e.key,e.value,e.recordId])),vendor+' snapshot preserves original entries');
 ok(reopened.records.filter(r=>r.summary.securityFeature).length===features.length,vendor+' snapshot rebuilds security views once');
 ok(reopened.records.filter(r=>r.summary.securityFeature).every(r=>features.some(f=>f.id===r.id)),vendor+' stable derived IDs');
}
current.load('tests/fixtures/security-cisco.conf');let a=current.ctx.audit;a.state.view='acls';ok(a.records('acls').length===1&&a.records('acls').every(r=>r.family==='access-list'),'switch ACLs keep their dedicated root');ok(a.records('security').length===0,'switch ACLs are separate from security profiles');ok(a.records('acls')[0].aclEntries.length===2,'switch ACLs preserve ordered entries');ok(a.friendlyDetails(a.records('acls')[0]).extra.includes('GigabitEthernet1/0/1'),'switch ACLs preserve interface attachments');
current.load('tests/fixtures/features-palo.xml');a=current.ctx.audit;a.state.view='security';ok(a.availableTabs('security').length===0,'unconfigured security pages remain hidden');
fs.writeFileSync('tests/security-results.json',JSON.stringify({checks,vendors:Object.keys(expected)},null,2));console.log(checks+' functional security checks passed');

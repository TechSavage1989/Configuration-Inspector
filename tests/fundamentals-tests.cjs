const fs=require('fs'),assert=require('assert'),{boot}=require('./harness.cjs');
const next=boot(),before=boot('tests/baseline-5.5.2.html');let checks=0;
function ok(value,message){checks++;assert(value,message)}
const expected={forti:['time','access','syslog','sflow','netflow','ddns','tracking','ha','sip','advanced','routefilter','options','provisioning'],aos:['time','access','syslog','sflow','snmp','snooping','discovery','qos','options','provisioning','advanced','voice'],cisco:['time','access','syslog','netflow','qos','fhrp','snooping','routefilter','options','provisioning','sip','voice'],junos:['time','access','syslog','sflow','snooping','discovery','vrf','aaa','sip','voice'],palo:['time','access','syslog'],sophos:['time','syslog','snmp','sip','ddns'],meraki:['syslog','sflow','snmp','voice'],sonic:['time','access','syslog','netflow','sip','h323','advanced','failover','ha','ddns']};
for(const [name,topics] of Object.entries(expected)){
 const file='tests/fixtures/'+fs.readdirSync('tests/fixtures').find(n=>n.startsWith('fundamentals-'+name+'.'));
 const m=next.load(file),old=before.load(file),{ctx}=next,a=ctx.audit,features=m.records.filter(r=>r.summary.featureRoot);
 ok(JSON.stringify(m.entries.map(e=>[e.key,e.value,e.recordId]))===JSON.stringify(old.entries.map(e=>[e.key,e.value,e.recordId])),name+' original fields and ownership unchanged');
 ok(ctx.SWCore.readable(m,false)===before.ctx.SWCore.readable(old,false),name+' readable export unchanged');
 ok(ctx.SWCore.report(m,false).replace(/<section id="manufacturer-hardware">[\s\S]*?<\/section>/,'')===before.ctx.SWCore.report(old,false),name+' raw HTML report unchanged');
 for(const topic of topics)ok(features.some(r=>r.family==='feature-'+topic),name+' '+topic+' presented');
 ok(features.every(r=>r.fields.length&&r.sourceFieldKeys.length),name+' features have original source');
 ok(features.every(r=>ctx.SWImporters.recordConfigurationText(m,r,true).text.trim()),name+' source is readable');
 ok(features.every(r=>a.friendlyDetails(r).facts.length),name+' features have readable details');
 ok(!JSON.stringify(features.map(r=>r.summary)).includes('EXAMPLE-SECRET'),name+' summaries contain no SNMP secret');
 for(const root of new Set(features.map(r=>r.summary.featureRoot))){a.state.view=root;const tabs=a.availableTabs(root);for(const tab of tabs.filter(t=>t.id.startsWith('feature-'))){a.state.categoryTabs[root]=tab.id;const spec=a.tableSpec();ok(spec.rows.length>0&&spec.rows.every(r=>r.summary.featureSection===tab.id),name+' '+root+' isolated '+tab.id);}}
 if(name==='sonic'){
  ok(features.filter(r=>r.family==='feature-syslog').length===1,'Equivalent SonicWall syslog destinations merged');
  ok(ctx.SWFeatures.facts(features.find(r=>r.family==='feature-sip')).some(f=>f.label==='SIP transformations'&&f.value==='Disabled'),'Explicitly disabled SIP is visible');
  ok(a.relatedSettingGroups('routes').flatMap(g=>g.rows).length===0,'Empty per-interface routing templates stay hidden');
 }
 if(name==='forti'){
  ok(ctx.SWFeatures.facts(features.find(r=>r.name==='Time zone')).some(f=>f.value==='Eastern Time (US & Canada)'),'FortiOS time-zone code decoded');
  ok(features.find(r=>r.name==='SIP inspection').references.policies.length===1,'VoIP profile links to policy');
 }
 const snapshot=name==='sonic'?ctx.SWCore.exportJSON(m,false):ctx.SWImporters.exportJSON(m,false),reopened=ctx.SWCore.parse(snapshot,{});
 ok(JSON.stringify(reopened.entries.map(e=>[e.key,e.value]))===JSON.stringify(m.entries.map(e=>[e.key,e.value])),name+' JSON retains all original values');
 ok(reopened.records.filter(r=>r.summary.featureRoot).length===features.length,name+' feature snapshot count');
 ok(reopened.records.filter(r=>r.summary.featureRoot).every(r=>r.fields.length),name+' snapshot restores feature sources');
}
fs.writeFileSync('tests/fundamentals-results.json',JSON.stringify({checks,formats:Object.keys(expected)},null,2));console.log(checks+' fundamental feature checks passed across '+Object.keys(expected).length+' fixtures');

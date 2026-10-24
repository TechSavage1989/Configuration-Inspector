const fs=require('fs'),assert=require('assert'),{boot}=require('./harness.cjs');
const current=boot(),previous=boot('tests/baseline-5.14.0.html');let checks=0;
function ok(value,message){checks++;assert(value,message);}
function eq(value,expected,message){checks++;assert.deepStrictEqual(JSON.parse(JSON.stringify(value)),JSON.parse(JSON.stringify(expected)),message);}
function visible(a,r){return a.tableSpec().columns.map(c=>a.rowValue(r,c,true)).join(' | ');}
const fixtures=['features-cisco.conf','features-forti.conf','features-junos.conf','features-palo.xml','features-sonic.txt','features-sophos.xml','mikrotik.rsc','dns-cisco.conf','dns-palo.xml'];
for(const file of fixtures){
  const m=current.load('tests/fixtures/'+file),old=previous.load('tests/fixtures/'+file),a=current.ctx.audit;
  eq(m.entries.map(e=>[e.key,e.value,e.recordId,e.category]),old.entries.map(e=>[e.key,e.value,e.recordId,e.category]),file+' original field values and ownership preserved');
  eq(m.records.map(r=>[r.id,r.summary,r.references]),old.records.map(r=>[r.id,r.summary,r.references]),file+' imported summaries, IDs and references preserved');
  const before=JSON.stringify(m.records);a.state.view='dns';
  for(const tab of a.availableTabs('dns').filter(t=>['servers','forwarding','zones'].includes(t.id))){
    a.state.categoryTabs.dns=tab.id;
    for(const r of a.tableSpec().rows){
      const shown=visible(a,r),details=a.friendlyDetails(r);
      const servers=details.facts.filter(f=>/^(?:(?:Primary|Secondary|Tertiary) DNS server|DNS server \d+)$/.test(f.label));
      ok(servers.length>0||r.family==='dns-zone',file+' '+r.name+' has explicit server facts');
      for(const f of servers)ok(shown.includes(f.value),file+' '+r.name+' server visible without opening details: '+f.value);
      eq(new Set(servers.map(f=>f.value)).size,servers.length,file+' '+r.name+' individual server facts are distinct');
      ok(!details.facts.some(f=>/^(?:DNS servers|IPv6 DNS servers|Servers|Additional DNS)$/.test(f.label)),file+' '+r.name+' no duplicate combined list in details');
      ok(!a.tableSpec().columns.some(c=>/transport|cache|proxy/i.test(c.key)),file+' secondary controls do not displace addressing');
    }
  }
  eq(JSON.stringify(m.records),before,file+' presentation does not mutate imported model');
  const snapshot=m.meta.vendorId==='sonicwall'?current.ctx.SWCore.exportJSON(m,false):current.ctx.SWImporters.exportJSON(m,false);
  const reopened=current.ctx.SWCore.parse(snapshot,{});
  eq(reopened.entries.map(e=>[e.key,e.value,e.recordId]),m.entries.map(e=>[e.key,e.value,e.recordId]),file+' snapshot field preservation');
}
let m=current.load('tests/fixtures/dns-cisco.conf'),a=current.ctx.audit;a.state.view='dns';a.state.categoryTabs.dns='servers';
let r=a.tableSpec().rows[0],s=a.displaySummary(r);
eq(s.dns,'192.0.2.53, 192.0.2.54, 198.51.100.53, 198.51.100.54','Cisco all four IPv4 resolvers visible');
eq(s.dns6,'2001:db8::53, 2001:db8::54','Cisco IPv6 resolvers separated correctly');
ok(visible(a,r).includes('example.test'),'Configured domain retained');
ok(visible(a,r).includes('branch.example.test'),'Configured search domains visible');
ok(!visible(a,r).includes('192.0.2.1'),'Interface IP is not a DNS server');
ok(!visible(a,r).includes('192.0.2.67'),'DHCP relay address is not a DNS server');
const baseline=previous.ctx.audit;baseline.state.view='dns';baseline.state.categoryTabs.dns='servers';previous.load('tests/fixtures/dns-cisco.conf');
ok(!visible(baseline,baseline.tableSpec().rows[0]).includes('192.0.2.53'),'Cisco fixture reproduces previous missing primary DNS cells');
m=current.load('tests/fixtures/dns-palo.xml');a=current.ctx.audit;a.state.view='dns';a.state.categoryTabs.dns='servers';
r=a.tableSpec().rows.find(r=>r.family==='dns');ok(visible(a,r).includes('192.0.2.53')&&visible(a,r).includes('2001:db8::53'),'PAN management resolver addresses visible');
const proxy=a.tableSpec().rows.find(r=>r.name==='Branch DNS relay');
ok(visible(a,proxy).includes('192.0.2.54')&&visible(a,proxy).includes('2001:db8::54'),'DNS relay upstream addresses visible');
ok(a.tableSpec().columns.some(c=>c.key==='interfaces'),'DNS relay interface column present');
ok(a.friendlyDetails(proxy).extra.includes(m.categories.interfaces[0].id),'DNS relay interface remains linked');
const inherited=a.tableSpec().rows.find(r=>r.name==='Inherited resolver');
ok(visible(a,inherited).includes('Inherited from ethernet1/1; current value unavailable'),'Inherited server source is not replaced with a guessed IP');
a.state.categoryTabs.dns='forwarding';r=a.tableSpec().rows[0];
ok(visible(a,r).includes('198.51.100.53')&&visible(a,r).includes('2001:db8:1::53')&&visible(a,r).includes('branch.example.test'),'Forwarding targets and domain visible');
ok(r.relatedRecordId===proxy.id,'Forwarding parent link preserved');
a.state.categoryTabs.dns='hosts';r=a.tableSpec().rows[0];ok(visible(a,r).includes('192.0.2.25'),'Host answer kept in host records');
ok(!a.tableSpec().columns.some(c=>c.key==='dns'||c.key==='dns6'),'Host answer is not shown as an upstream DNS server');
// Normalized snapshot aliases are used only within DNS records, including
// older imports whose record names contain relay or helper.
const original=m.records.find(r=>r.family==='dns');
for(const [name,summary,expected]of[
  ['DNS relay',{relayServers:['192.0.2.60','2001:db8::60']},['192.0.2.60','2001:db8::60']],
  ['DNS helper',{server:'resolver.example.test',secondaryServer:'192.0.2.61'},['resolver.example.test','192.0.2.61']],
  ['DNS servers',{dns:'0.0.0.0, ::',primary:'0.0.0.0',servers:'::'},[]],
  ['DNS servers',{dns:'192.0.2.62; 2001:db8::62',servers:['192.0.2.62','2001:DB8::62']},['192.0.2.62','2001:db8::62']]
]){
  const row={...original,name,summary:{name,...summary}},before=JSON.stringify(row);a.state.categoryTabs.dns='servers';
  const projection=a.displaySummary(row),values=a.friendlyDetails(row).facts.filter(f=>/DNS server(?: \d+)?$/.test(f.label)).map(f=>f.value);
  for(const value of expected){ok((projection.dns+', '+projection.dns6).includes(value),name+' canonical server projection');ok(values.includes(value),name+' individual detail parity');}
  eq(values.length,expected.length,name+' no duplicate or unset endpoints');
  eq(a.primaryRecord(row),expected.length>0,name+' unconfigured endpoints do not create primary rows');
  eq(JSON.stringify(row),before,name+' original snapshot stays intact');
}
const v6Source={...original,summary:{dns6:'Inherited from WAN; current value unavailable'}};
eq(a.displaySummary(v6Source).dns,'','IPv6 source description not mislabeled as IPv4');
eq(a.displaySummary(v6Source).dns6,v6Source.summary.dns6,'IPv6 source description retained');
const dhcp={...original,family:'dhcp-relay',name:'DNS office relay',summary:{servers:'192.0.2.67'}};
m.categories.network.push(dhcp);ok(a.allRecords('dhcp').includes(dhcp),'DHCP family stays in DHCP even when named DNS');
ok(!a.allRecords('dns').includes(dhcp),'DHCP relay not mixed into DNS by its display name');
fs.writeFileSync('tests/dns-results.json',JSON.stringify({checks,fixtures},null,2));console.log(checks+' DNS presentation checks passed');

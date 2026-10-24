const fs=require('fs'),assert=require('assert'),{boot}=require('./harness.cjs');
const {ctx,load}=boot();let checks=0;function ok(value,message){checks++;assert(value,message)}
for(const file of fs.readdirSync('tests/fixtures').filter(n=>n.startsWith('features-'))){
  const m=load('tests/fixtures/'+file),a=ctx.audit;
  for(const id of ['routes','sdwan','switching','vpn','dns','dhcp','authentication','identities','deviceusers','interfaces','policies','zones']){
    a.state.view=id;
    const primary=a.sectionPrimaryRecords(id),groups=a.relatedSettingGroups(id),secondary=groups.flatMap(g=>g.rows);
    ok(secondary.every(r=>!primary.some(p=>p.id===r.id)),file+' '+id+' main and related objects are separate');
    ok(a.allRecords(id).every(r=>a.contextSourceSpec().rows.some(s=>s.id===r.id)),file+' '+id+' full source retained');
    ok(secondary.every(r=>a.recordById(r.id)),file+' '+id+' related details resolve');
    if(id==='routes'){
      ok(a.availableTabs(id).every(t=>['routes','related'].includes(t.id)||t.id.startsWith('feature-')),file+' routing exposes child views only');
      ok(a.tableSpec().rows.every(r=>a.recordTab(r)===(a.state.categoryTabs.routes||a.availableTabs('routes')[0]?.id)),file+' routing table contains routes only');
    }
    if(groups.length){const previous=a.state.categoryTabs[id];a.state.categoryTabs[id]='related';ok(a.relatedSettingsPanel(groups,primary.length>0).includes('Related settings'),file+' '+id+' has related section');a.state.categoryTabs[id]=previous;}
    else ok(!a.availableTabs(id).some(t=>t.id==='related'),file+' '+id+' empty related section hidden');
  }
  if(m.meta.vendorId==='fortigate'){
    a.state.view='routes';ok(a.records('routes').filter(r=>r.summary.featureSection==='feature-network-ospf').map(r=>r.name).join()==='OSPF','Unconfigured BGP stays hidden');
  }
  if(m.meta.vendorId==='paloalto'){
    ok(a.sectionPrimaryRecords('vpn').some(r=>r.summary.featureSection==='feature-network-ipsec-settings'&&r.name==='Partner gateway'),'IKE gateways accessible beneath tunnels');
    ok(a.sectionPrimaryRecords('authentication').length===1,'Authentication server presented first');
    ok(a.relatedSettingGroups('authentication').flatMap(g=>g.rows).length===1,'Authentication profile moved below server');
  }
}
fs.writeFileSync('tests/section-layout-results.json',JSON.stringify({checks},null,2));console.log(checks+' section layout checks passed');

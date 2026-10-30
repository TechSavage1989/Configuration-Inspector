const assert=require('node:assert/strict'),{boot}=require('./harness.cjs');
// Synthetic, public test input. No supplied configuration data is included.
function configuration(models=['ws-c3650-48fd-l','ws-c3650-48pd']){
 return 'version 16.9\nhostname Example-3650\n'+models.map((model,i)=>`switch ${i+1} provision ${model}\n`).join('')+
 'vlan 20\n name Example-LAN\n exit\n'+models.map((_,i)=>{
  const member=i+1;
  return Array.from({length:48},(_,n)=>`interface GigabitEthernet${member}/0/${n+1}\n${n===0?' switchport mode access\n switchport access vlan 20\n':' shutdown\n'}!\n`).join('')+
   [1,2,3,4].map(n=>`interface ${n<3?'GigabitEthernet':'TenGigabitEthernet'}${member}/1/${n}\n${n===3?' switchport mode trunk\n switchport trunk allowed vlan 20\n':' shutdown\n'}!\n`).join('');
 }).join('')+'interface Vlan20\n ip address 192.0.2.1 255.255.255.0\n!\nip route 0.0.0.0 0.0.0.0 192.0.2.254\nend\n';
}
function run(){
 const b=boot(),C=b.ctx.SWCore,HW=b.ctx.SWHardware;let checks=0;
 const eq=(x,y,msg)=>{checks++;assert.deepEqual(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),msg);};
 const ok=(x,msg)=>{checks++;assert.ok(x,msg);};
 for(const kind of ['FD','PD'])for(const suffix of ['','-L','-S','-E']){
  const sku='WS-C3650-48'+kind+suffix,p=HW.profile('Cisco '+sku);
  ok(p,sku+' recognized');
  eq(p.banks.map(x=>[x.names.length,x.form,x.rate,x.rows]),[[48,'RJ45','1G',2],[2,'SFP','1G',1],[2,'SFP+','10G',1]],sku+' complete fixed port specification');
 }
 ok(!HW.profile('WS-C3650-12X48FD-L'),'multigigabit model not mistaken for 48FD');
 ok(!HW.profile('WS-C3650-48FQ-L'),'different uplink model not guessed');
 const source=configuration(),m=C.parse(source,{filename:'example-3650.conf'});
 eq(m.meta.vendorId,'cisco');eq(m.meta.firmware,'16.9','no invented patch version');
 eq(HW.inventory(m).members.map(x=>x.id),['1','2']);
 for(const member of [1,2]){
  const ports=m.categories.interfaces.filter(r=>new RegExp('Ethernet'+member+'/').test(r.name));
  eq(ports.length,52,'52 front-panel ports per member');
  for(const r of ports){
   const port=HW.port(m,r),n=Number(r.name.split('/').at(-1)),uplink=r.name.includes('/1/');
   ok(port,r.name+' mapped');eq([port.form,port.rate],uplink?(n<=2?['SFP','1G']:['SFP+','10G']):['RJ45','1G'],r.name+' media/capacity');
   eq(HW.position(port.layout.bank,port.layout.index),uplink?{row:2,column:n<=2?n:n-2}:{row:n%2?1:2,column:Math.ceil(n/2)},r.name+' physical position');
  }
 }
 const fields=JSON.stringify(m.entries),count=m.records.length;
 HW.identify(m,{scope:'global',member:'2',slot:''},'Cisco WS-C3650-48FD-L');
 eq(m.records.length,count,'model annotation adds no duplicate ports');eq(JSON.stringify(m.entries),fields,'original fields unchanged');
 eq(b.ctx.SWImporters.configurationText(m,false),source,'exact original configuration retained');
 const reopened=C.parse(b.ctx.SWImporters.exportJSON(m,false),{});
 eq(HW.inventory(reopened).members[1].model,'Cisco WS-C3650-48FD-L','snapshot retains exact identified model');
 const banner='Cisco IOS Software [Fuji], Catalyst L3 Switch Software (CAT3K_CAA-UNIVERSALK9-M), Version 16.9.6, RELEASE SOFTWARE (fc2)\n';
 const full=C.parse(banner+source,{});
 eq(full.meta.firmware,'16.9.6','explicit IOS patch version takes precedence over config syntax version');
 ok(full.categories.system.some(r=>r.summary.firmware==='16.9.6'),'full version in device details');
 eq(full.categories.routes.length,m.categories.routes.length,'banner does not disrupt route parsing');
 console.log(checks+' Cisco 3650 checks passed');
}
module.exports={configuration};
if(require.main===module)run();

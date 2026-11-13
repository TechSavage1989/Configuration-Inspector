// Site overview across several open configurations.
const assert=require('node:assert/strict'),{boot}=require('./harness.cjs'),Site=require('../webview/site_overview.js');
const {ctx}=boot(),C=ctx.SWCore;let checks=0;
function ok(v,m){checks++;assert.ok(v,m);}function eq(a,b,m){checks++;assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),m);}
const core=C.parse(`version 15.2
hostname CORE-SW1
ntp server 192.0.2.123
ip name-server 192.0.2.53
logging host 192.0.2.5
username admin privilege 15 secret TEST_SECRET_ONLY
spanning-tree mode rapid-pvst
vlan 10
 name USERS
vlan 20
 name VOICE
interface GigabitEthernet1/0/1
 description Uplink to ACCESS-SW2 port 48
 switchport mode trunk
 switchport trunk allowed vlan 10,20
interface Vlan10
 ip address 10.0.10.1 255.255.255.0
interface Vlan99
 ip address 10.0.99.1 255.255.255.0
`,{filename:'core.conf'});
const access=C.parse(`version 15.2
hostname ACCESS-SW2
ntp server 192.0.2.123
ip name-server 192.0.2.54
logging host 192.0.2.5
username admin privilege 15 secret TEST_SECRET_ONLY
username tech privilege 1 secret TEST_SECRET_ONLY
spanning-tree mode rapid-pvst
vlan 10
 name STAFF
vlan 30
 name PRINTERS
interface GigabitEthernet1/0/48
 description Uplink to core-sw1
 switchport mode trunk
interface GigabitEthernet1/0/2
 description Not core-sw10 and not xcore-sw1x
interface Vlan10
 ip address 10.0.10.2 255.255.255.0
interface Vlan99
 ip address 10.0.99.1 255.255.255.0
`,{filename:'access.conf'});
const huawei=C.parse(`!Software Version V200R019C10SPC500
#
sysname BRANCH-HW3
#
vlan batch 10 20
#
vlan 10
 description USERS
#
ntp-service unicast-server 192.0.2.124
dns server 192.0.2.53
info-center loghost 192.0.2.5
stp mode mstp
#
interface Vlanif10
 ip address 10.0.20.1 255.255.255.0
#
return
`,{filename:'branch.cfg'});
const forti=C.parse(`config system global
 set hostname "EDGE-FW"
end
config system ntp
 set ntpsync enable
 config ntpserver
  edit 1
   set server "192.0.2.123"
  next
 end
end
config system interface
 edit "port1"
  set ip 10.0.10.254 255.255.255.0
 next
end
`,{filename:'edge.conf'});
const r=Site.build([core,access,huawei,forti]);
eq(r.devices.map(d=>d.name),['CORE-SW1','ACCESS-SW2','BRANCH-HW3','EDGE-FW'],'every open configuration is a device');
const s=k=>r.settings.find(x=>x.key===k);
eq(s('ntp').status,'differs','NTP differs');eq(s('ntp').groups,[{value:'192.0.2.123',devices:[0,1,3]},{value:'192.0.2.124',devices:[2]}],'NTP groups the majority first, across vendors');
eq(s('dns').groups.map(g=>[g.value,g.devices]),[['192.0.2.53',[0,2]],['192.0.2.54',[1]]],'DNS servers differ');ok(s('dns').missing.includes(3),'a device without DNS settings is listed as missing, not different');
eq(s('syslog').status,'partial','syslog matches where present but is missing on one device');
eq(s('users').groups.map(g=>g.value),['admin','admin, tech'],'local user lists are compared as sets');
eq(s('stp').groups.map(g=>g.value),['rapid-pvst','mstp'],'spanning-tree modes');
ok(!JSON.stringify(r).includes('TEST_SECRET_ONLY'),'no secrets appear in the overview');
const v10=r.vlans.find(v=>v.id==='10');eq(v10.status,'name-differs','VLAN 10 names differ');eq(v10.names.sort(),['STAFF','USERS'],'names compared without the empty description');
eq(r.vlans.find(v=>v.id==='30').status,'single','VLAN 30 exists on one device');eq(r.vlans.find(v=>v.id==='20').entries.map(e=>e.device),[0,2],'VLAN 20 on two devices');
eq(r.duplicates.map(d=>[d.address,d.entries.map(e=>e.device+':'+e.interface)]),[['10.0.99.1',['0:Vlan99','1:Vlan99']]],'the same address on two devices is a duplicate');
ok(r.subnets.some(x=>x.network==='10.0.10.0/24'&&x.entries.map(e=>e.device).sort().join()==='0,1,3'),'shared subnet across three devices and vendors');
ok(!r.subnets.some(x=>x.network==='10.0.20.0/24'),'a subnet on one device is not shared');
eq(r.mentions.map(m=>[m.device,m.interface,m.mentions]),[[0,'GigabitEthernet1/0/1',1],[1,'GigabitEthernet1/0/48',0]],'descriptions naming another device, case-insensitive whole names only');
const one=Site.build([core]);eq(one.duplicates,[],'one device has no cross-device duplicates');eq(one.mentions,[],'and no mentions');ok(one.settings.every(x=>x.status==='same'),'a single device is consistent with itself');
eq(Site.build([]).devices,[],'empty workspace');
// Checks across links: both ends of a cable compared (native VLAN, tagged VLANs, link aggregation, spanning-tree root).
{const A=C.parse('hostname EX-CORE\nspanning-tree vlan 1-100 priority 8192\ninterface GigabitEthernet1/0/1\n switchport mode trunk\n switchport trunk native vlan 5\n switchport trunk allowed vlan 10,20,30\n channel-group 1 mode active\ninterface GigabitEthernet1/0/2\n switchport mode trunk\n channel-group 1 mode active\ninterface Port-channel1\n switchport mode trunk\n',{filename:'a.conf'});
 const B=C.parse('hostname EX-ACC\nspanning-tree vlan 1-100 priority 4096\ninterface GigabitEthernet1/0/48\n switchport mode trunk\n switchport trunk native vlan 1\n switchport trunk allowed vlan 10,20\n',{filename:'b.conf'});
 const r=Site.linkChecks([A,B],[{a:0,b:1,aPort:'Gi1/0/1',bPort:'GigabitEthernet1/0/48'}]),kinds=r.findings.map(f=>f.kind);
 eq(kinds,['native','trunk','lag'],'link checks: native VLAN, trunk VLANs and aggregation mismatches');ok(r.checked===1&&/VLAN 30 only on EX-CORE/.test(r.findings[1].detail)&&/Port-channel1/.test(r.findings[2].detail),'link checks name the device and port of each end');
 const same=Site.linkChecks([B,B],[{a:0,b:1,aPort:'Gi1/0/48',bPort:'Gi1/0/48'}]);ok(same.findings.length===1&&same.findings[0].kind==='stp'&&/share the lowest priority/.test(same.findings[0].detail),'matching ends raise nothing; a shared root priority is reported');
 ok(Site.linkChecks([A,B],[]).findings.length===0&&Site.linkChecks([A,B],[{a:0,b:1,aPort:'Gi9/9/9',bPort:'x'}]).checked===0,'unknown ports are not compared');}
console.log(checks+' site overview checks passed');

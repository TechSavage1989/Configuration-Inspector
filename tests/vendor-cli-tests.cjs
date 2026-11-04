// Arista EOS and Huawei VRP CLI exports: detection, interpreted views, masking and
// downstream modules. Fixtures are synthetic (documentation addresses, TEST markers).
const assert=require('node:assert/strict'),fs=require('node:fs'),{boot}=require('./harness.cjs');
const {ctx,load}=boot(),C=ctx.SWCore;let checks=0;
function ok(value,message){checks++;assert.ok(value,message);}
function eq(value,expected,message){checks++;assert.deepEqual(JSON.parse(JSON.stringify(value)),JSON.parse(JSON.stringify(expected)),message);}
function rec(model,family,name){const found=model.records.filter(r=>r.family===family&&r.name===name);eq(found.length,1,family+' '+name+' is recognized once');return found[0];}
const secrets=['TEST_SECRET_ONLY','TEST_CIPHER_ONLY','TEST_COMMUNITY_ONLY','TEST_SHARED_KEY_ONLY'];
function masked(model,label){
 const outputs={readable:C.readable(model,true),payload:C.payload(model,true),report:C.report(model,true),snapshot:ctx.SWImporters.exportJSON(model,true)};
 for(const [kind,text] of Object.entries(outputs))ok(secrets.every(s=>!text.includes(s)),label+' '+kind+' export redacts credentials');
}

// Arista EOS
let source=fs.readFileSync('tests/fixtures/vendor-arista.conf','utf8'),m=load('tests/fixtures/vendor-arista.conf');
eq([m.meta.vendorId,m.meta.vendor,m.meta.name,m.meta.model,m.meta.firmware,m.meta.deviceType],['arista-eos','Arista EOS','leaf-example','DCS-7050SX3-48YC8','4.30.1F','switch'],'Arista identity and export header');
let p=rec(m,'switch-port','Ethernet1').summary;eq([p.portMode,p.untaggedVLANs,p.comment],['Access','10','Example access port'],'Arista access port');
p=rec(m,'switch-port','Ethernet2').summary;eq([p.portMode,p.taggedVLANs,p.aggregate],['Trunk','10, 20','Port-Channel1'],'Arista trunk member keeps EOS Port-Channel spelling');
ok(!m.records.some(r=>/^Port-channel/.test(r.name)),'no Cisco-style Port-channel duplicate is created');
eq(rec(m,'interface-bundle','Port-Channel1').summary.protocol,'LACP','Arista LACP bundle');
p=rec(m,'management','Management1').summary;eq([p.ip,p.network,p.vrf],['192.0.2.10','192.0.2.0/24','MGMT'],'Arista CIDR management address and VRF');
eq(rec(m,'vlan-interface','Vlan10').summary.network,'10.0.10.0/24','Arista SVI address');
eq(rec(m,'vlan','10').summary.vlanName,'users','Arista VLAN name');
eq(m.records.filter(r=>r.family==='static-route').map(r=>[r.summary.destination,r.summary.gateway,r.summary.vrf]).sort(),[['0.0.0.0/0','10.0.10.254',''],['0.0.0.0/0','192.0.2.1','MGMT']],'Arista default and VRF static routes');
p=rec(m,'dns','DNS settings').summary;eq([p.servers,p.domain],['192.0.2.53','example.com'],'Arista VRF name server and dns domain');
eq(rec(m,'time','Time synchronization').summary.ntpServers,'192.0.2.123','Arista VRF NTP server is the address, not the VRF keyword');
eq(rec(m,'logging','System logging').summary.destinations,'192.0.2.5','Arista VRF logging host');
eq(rec(m,'user','admin').summary.privilege,'15','Arista local user');
eq(rec(m,'feature-time','NTP synchronization').summary.featureData,JSON.stringify([{label:'NTP servers',value:'192.0.2.123',ref:'',critical:true}]),'Arista NTP feature uses the server address');
ok(!m.records.some(r=>r.family==='feature-vrf'&&r.name==='instance'),'vrf instance is not read as a context named instance');
rec(m,'vrf','VRF MGMT');
masked(m,'Arista');

// Huawei VRP
m=load('tests/fixtures/vendor-huawei.cfg');
eq([m.meta.vendorId,m.meta.vendor,m.meta.name,m.meta.firmware,m.meta.deviceType],['huawei-vrp','Huawei VRP','Example-S5735','V200R019C10SPC500','switch'],'Huawei identity from sysname and software version');
ok(JSON.stringify(m.meta.importNotes).includes('VRP defaults that are not exported are not inferred'),'Huawei scope note is shown');
eq(m.records.filter(r=>r.family==='vlan').map(r=>r.name),['10','20','30','31','32'],'vlan batch ranges with "to" create every VLAN');
eq(rec(m,'vlan','10').summary.comment,'users','Huawei VLAN description');
p=rec(m,'vlan-interface','Vlanif10').summary;eq([p.interfaceType,p.vlan,p.ip,p.network],['VLAN interface','10','10.0.10.1','10.0.10.0/24'],'Vlanif is a VLAN interface');
eq(rec(m,'vlan','10').summary.network,'10.0.10.0/24, 10.0.11.0/24','sub keyword is a secondary address');
eq(rec(m,'dhcp-relay','Vlanif10 DHCP relay').summary.servers,'192.0.2.67','Huawei DHCP relay server');
eq(rec(m,'management','MEth0/0/1').summary.ip,'192.0.2.10','MEth is the management interface');
p=rec(m,'switch-port','GigabitEthernet0/0/1').summary;eq([p.portMode,p.untaggedVLANs,p.edgePort],['Access','10','Enabled'],'Huawei access port with edge port');
p=rec(m,'aggregate','Eth-Trunk1').summary;eq([p.interfaceType,p.portMode,p.taggedVLANs,p.allowedVLANs,p.comment],['Link aggregation','Trunk','10, 20','10, 20','Example LAG'],'Eth-Trunk is an aggregate trunk; undo allow-pass vlan 1 is not an addition');
eq([rec(m,'interface-bundle','Eth-Trunk1').summary.members,rec(m,'interface-bundle','Eth-Trunk1').summary.protocol],['GigabitEthernet0/0/2','LACP'],'eth-trunk member and LACP mode');
eq(rec(m,'switch-port','GigabitEthernet0/0/2').summary.taggedVLANs,'10, 20','member port inherits Eth-Trunk VLANs');
p=rec(m,'switch-port','GigabitEthernet0/0/3').summary;eq([p.portMode,p.nativeVLAN,p.untaggedVLANs,p.taggedVLANs],['Hybrid','30','30','31, 32'],'hybrid tagged/untagged VLANs');
p=rec(m,'switch-port','GigabitEthernet0/0/4').summary;eq([p.portMode,p.taggedVLANs,p.allowedVLANs],['Trunk','','Not listed in export'],'a trunk without allow-pass does not infer every VLAN');
ok(!rec(m,'vlan','10').summary.ports.includes('GigabitEthernet0/0/4'),'unlisted trunk is not a VLAN member');
eq(rec(m,'switch-port','GigabitEthernet0/0/5').summary.status,'Disabled','shutdown port');
eq(rec(m,'switch-port','LoopBack0').summary.interfaceType,'Loopback','LoopBack interface');
p=rec(m,'static-route','Example-default').summary;eq([p.destination,p.gateway,p.administrativeDistance],['0.0.0.0/0','10.0.10.254','70'],'route-static preference and description');
p=rec(m,'static-route','Route to 0.0.0.0/0').summary;eq([p.destination,p.gateway,p.vrf],['0.0.0.0/0','192.0.2.1','MGMT'],'route-static vpn-instance with prefix length');
p=rec(m,'dns','DNS settings').summary;eq([p.servers,p.domain],['192.0.2.53','example.com'],'Huawei DNS server and domain');
eq(rec(m,'time','Time synchronization').summary.ntpServers,'192.0.2.123','ntp-service unicast-server');
eq(rec(m,'logging','System logging').summary.destinations,'192.0.2.5','info-center loghost');
eq(rec(m,'snmp','SNMP management').summary.location,'Example lab','snmp-agent location');
eq(rec(m,'spanning-tree','Spanning tree').summary.mode,'rstp','stp mode');
p=rec(m,'user','admin').summary;eq([p.privilege,p.authMethod],['15','Local credential configured'],'local-user lines merge without losing the credential state');
source=fs.readFileSync('tests/fixtures/vendor-huawei.cfg','utf8');eq(m.entries.filter(e=>/^line\[/.test(e.key)).length,source.split(/\r?\n/).length,'every original line is retained');
masked(m,'Huawei');
const cipherLine=m.entries.find(e=>e.value.includes('TEST_CIPHER_ONLY'));ok(cipherLine&&/secret/.test(cipherLine.key),'irreversible-cipher line is classified as sensitive');
const sharedKey=m.entries.find(e=>e.value.includes('TEST_SHARED_KEY_ONLY'));ok(sharedKey&&/secret/.test(sharedKey.key),'shared-key line is classified as sensitive');

// Downstream modules run without vendor-specific Cisco checks.
for(const file of ['tests/fixtures/vendor-arista.conf','tests/fixtures/vendor-huawei.cfg']){
 const model=load(file),review=C.analyzeConfiguration(model,{now:'2026-10-24T16:00:00Z'});
 ok(Array.isArray(review.findings)&&Array.isArray(review.checks),file+' review completes');
 ok(!review.checks.some(c=>c.evaluated&&['credential-storage','management-timeout','source-routing','directed-broadcast'].includes(c.id)),file+' Cisco-only review checks are not applied');
 const again=C.parse(ctx.SWImporters.exportJSON(model,false),{});eq(again.meta.vendorId,model.meta.vendorId,file+' snapshot reopens with its vendor');
 eq(again.records.map(r=>r.id).sort(),model.records.map(r=>r.id).sort(),file+' snapshot keeps every record');
}

// Detection guards: neighbouring dialects keep their existing vendor.
const guard=(text,vendor,label)=>eq(C.parse(text,{filename:'guard.conf'}).meta.vendorId,vendor,label);
guard('version 15.2\nhostname Example\ninterface GigabitEthernet1/0/1\n switchport access vlan 10\n','cisco','Cisco IOS stays Cisco');
guard('hostname Example\ninterface Ethernet1/1\n switchport mode trunk\n','cisco','NX-OS-style text without EOS markers stays Cisco');
guard('! device: spine (DCS-7280SR-48C6, EOS-4.31.0F)\nhostname spine\ninterface Ethernet1\n','arista-eos','EOS device header');
guard('hostname Example\ndaemon TerminAttr\n   no shutdown\ninterface Ethernet1\n','arista-eos','TerminAttr marker');
guard('sysname Example\n#\ninterface GigabitEthernet0/0/1\n port link-type access\n','huawei-vrp','sysname with port link-type');
guard('#\ninterface Eth-Trunk2\n mode lacp\n','huawei-vrp','Eth-Trunk marker');
console.log(checks+' Arista EOS and Huawei VRP checks passed');

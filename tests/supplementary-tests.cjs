// Supplementary data: monitoring exports, neighbor tables and show-command output.
const assert=require('node:assert/strict'),E=require('../webview/evidence.js'),Map_=require('../webview/site_map.js'),{xlsx,demoSite}=require('./xlsx-writer.cjs');
let checks=0;function ok(v,m){checks++;assert.ok(v,m);}function eq(a,b,m){checks++;assert.deepEqual(a,b,m);}
const SHOW=`EXAMPLE-SW1#show ip route
Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP
Gateway of last resort is 10.0.99.1 to network 0.0.0.0

S*    0.0.0.0/0 [1/0] via 10.0.99.1
      10.0.0.0/8 is variably subnetted, 4 subnets, 2 masks
C        10.0.10.0/24 is directly connected, Vlan10
L        10.0.10.2/32 is directly connected, Vlan10
O IA     10.0.20.0/24 [110/2] via 10.0.99.3, 00:01:02, Vlan99
                      [110/2] via 10.0.99.4, 00:01:02, Vlan99
EXAMPLE-SW1#show interfaces status

Port      Name               Status       Vlan       Duplex  Speed Type
Gi1/0/1   Desk 1             connected    10         a-full a-1000 10/100/1000BaseTX
Gi1/0/2                      notconnect   10           auto   auto 10/100/1000BaseTX
Gi1/0/3   Printer            disabled     10           auto   auto 10/100/1000BaseTX
Te1/1/1   Uplink to CORE     connected    trunk        full    10G SFP-10GBase-SR
EXAMPLE-SW1#show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
Vlan10                 10.0.10.2       YES NVRAM  up                    up
GigabitEthernet1/0/3   unassigned      YES unset  administratively down down
EXAMPLE-SW1#show lldp neighbors
Capability codes:
    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device
Device ID           Local Intf     Hold-time  Capability      Port ID
EXAMPLE-CORE        Te1/1/1        120        B,R             Te1/0/24
EXAMPLE-AP1         Gi1/0/1        120        B               eth0

Total entries displayed: 2
EXAMPLE-SW1#show cdp neighbors
Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge
Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID
EXAMPLE-CORE.example.com
                 Ten 1/1/1         155             R S I  C9300-48P Ten 1/0/24
EXAMPLE-PHONE    Gig 1/0/5         140              H P   IP Phone  Port 1
EXAMPLE-SW1#show mac address-table
          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
  10    0000.5e00.5301    DYNAMIC     Gi1/0/1
  10    0000.5e00.5302    DYNAMIC     Gi1/0/1
  99    0000.5e00.53ff    DYNAMIC     Te1/1/1
 All    0100.0ccc.cccc    STATIC      CPU
EXAMPLE-SW1#show ip arp
Protocol  Address          Age (min)  Hardware Addr   Type   Interface
Internet  10.0.10.50              0   0000.5e00.5301  ARPA   Vlan10
EXAMPLE-SW1#show interfaces GigabitEthernet1/0/1
GigabitEthernet1/0/1 is up, line protocol is up (connected)
  Hardware is Gigabit Ethernet, address is 0000.5e00.5310 (bia 0000.5e00.5310)
  Description: Desk 1
  Full-duplex, 1000Mb/s, media type is 10/100/1000BaseTX
     5 input errors, 3 CRC, 0 frame, 0 overrun, 0 ignored
     0 output errors, 0 collisions, 1 interface resets
`;
(async()=>{
 // Interface and device name normalization.
 eq(E.interfaceKey('GigabitEthernet1/0/1'),E.interfaceKey('Gi1/0/1'),'Gi abbreviation');
 eq(E.interfaceKey('Gig 1/0/5'),E.interfaceKey('GigabitEthernet1/0/5'),'CDP spacing');
 eq(E.interfaceKey('TenGigabitEthernet1/1/1 (Uplink)'),E.interfaceKey('Te1/1/1'),'descriptions in parentheses are ignored');
 eq(E.interfaceKey('TwentyFiveGigE1/0/2'),E.interfaceKey('Twe1/0/2'),'25G');
 eq(E.interfaceKey('Et1'),E.interfaceKey('Ethernet1'),'Arista');
 eq(E.interfaceKey('Port-channel7'),E.interfaceKey('Po7'),'port channel');
 eq(E.deviceKey('EXAMPLE-SW1.example.com'),E.deviceKey('example-sw1'),'domain and case');
 ok(E.genericDevice('Device@10.0.10.50')&&E.genericDevice('Unidentified Device')&&!E.genericDevice('EXAMPLE-SW1'),'placeholder device names');

 // Show commands.
 const ev=E.fromText(SHOW,'show.txt');
 eq(ev.source,'Show command output');eq(ev.device,'EXAMPLE-SW1','device name from the prompt');
 eq(ev.routes.length,5,'routes, including an equal-cost path');
 eq(ev.routes.map(r=>r.protocol),['Static','Connected','Local','OSPF IA','OSPF IA']);
 eq([ev.routes[0].nextHop,ev.routes[0].distance,ev.routes[0].metric],['10.0.99.1','1','0']);
 eq(ev.routes[4].nextHop,'10.0.99.4','continuation line keeps its prefix');
 const gi1=ev.interfaces.find(i=>E.interfaceKey(i.name)===E.interfaceKey('Gi1/0/1'));
 eq([gi1.oper,gi1.description,gi1.speed,gi1.inputErrors,gi1.crc],['Up','Desk 1','1000Mb/s',5,3],'show interfaces detail merged with status');
 eq(gi1.neighbor.device,'EXAMPLE-AP1','LLDP neighbor on the port');
 const gi3=ev.interfaces.find(i=>E.interfaceKey(i.name)===E.interfaceKey('Gi1/0/3'));eq(gi3.admin,'Down','disabled port is administratively down');
 const te=ev.interfaces.find(i=>E.interfaceKey(i.name)==='te1/1/1');eq(te.neighbor.port,'Ten 1/0/24','CDP wraps a long device ID to its own line');
 ok(ev.links.some(l=>l.b.device==='EXAMPLE-PHONE'&&l.b.port==='Port 1'),'CDP brief neighbor');
 eq(ev.mac.length,3,'MAC table without CPU entries');eq(ev.mac[0].mac,'00:00:5e:00:53:01');
 eq(ev.arp.map(a=>[a.ip,a.iface]),[['10.0.10.50','Vlan10']]);
 eq(E.fromText('hostname EXAMPLE\ninterface GigabitEthernet1/0/1\n switchport mode access\n','x.cfg'),null,'configurations are not supplementary data');
 eq(E.fromText('ip route 0.0.0.0 0.0.0.0 10.0.0.1\n','x.txt'),null,'a configuration line is not a routing table');

 // Other dialects.
 const nx=E.fromText('nx1# show ip route\n10.1.0.0/24, ubest/mbest: 1/0, attached\n    *via 10.1.0.1, Vlan100, [0/0], 3w2d, direct\n0.0.0.0/0, ubest/mbest: 1/0\n    *via 10.1.0.254, [1/0], 3w2d, static\nnx1# show lldp neighbors detail\nChassis id: 0000.5e00.5399\nPort id: Ethernet1/2\nLocal Port id: Eth1/1\nSystem Name: nx2\nManagement Address: 10.1.0.2\n','nx.txt');
 eq(nx.routes.map(r=>[r.prefix,r.protocol,r.nextHop,r.iface]),[['10.1.0.0/24','Connected','10.1.0.1','Vlan100'],['0.0.0.0/0','Static','10.1.0.254','']],'NX-OS routes');
 eq([nx.links[0].a.port,nx.links[0].b.device,nx.links[0].b.port],['Eth1/1','nx2','Ethernet1/2'],'NX-OS LLDP detail');
 const iosd=E.fromText('sw9#show lldp neighbors detail\n------------------------------------------------\nLocal Intf: Gi1/0/48\nChassis id: 0000.5e00.5398\nPort id: Gi0/1\nPort Description: Uplink\nSystem Name: sw10.example.com\n\nSystem Description:\nExample IOS Software\n\nManagement Addresses:\n    IP: 10.3.0.10\n------------------------------------------------\nLocal Intf: Gi1/0/47\nChassis id: 0000.5e00.5397\nPort id: eth0\nSystem Name: ap-9\n','d.txt');
 eq(iosd.links.map(l=>[l.a.port,l.b.device,l.b.port]),[['Gi1/0/48','sw10.example.com','Gi0/1'],['Gi1/0/47','ap-9','eth0']],'IOS LLDP detail');eq(iosd.interfaces[0].neighbor.ip,'10.3.0.10','management address');
 const arid=E.fromText('ar1#show lldp neighbors detail\nInterface Ethernet1 detected 1 LLDP neighbors:\n\n  Neighbor 0000.5e00.5301/"Ethernet7", age 7 seconds\n  Discovered 1 day, 2:03:04 ago; Last changed 1 day, 2:03:04 ago\n  - Chassis ID type: MAC address (4)\n    Chassis ID     : 0000.5e00.5301\n  - Port ID type: Interface name (5)\n    Port ID        : "Ethernet7"\n  - System Name: "ar3"\n','ad.txt');
 eq(arid.links.map(l=>[l.a.port,l.b.device,l.b.port]),[['Ethernet1','ar3','Ethernet7']],'Arista LLDP detail');
 const ari=E.fromText('ar1#show lldp neighbors\nPort          Neighbor Device ID       Neighbor Port ID    TTL\nEt1           ar2                      Ethernet1           120\n','a.txt');eq([ari.links[0].a.port,ari.links[0].b.device],['Et1','ar2'],'Arista LLDP');
 const cx=E.fromText('cx1# show lldp neighbor-info\nLOCAL-PORT  CHASSIS-ID         PORT-ID   PORT-DESC   TTL   SYS-NAME\n1/1/49      00:00:5e:00:53:77  1/1/50    uplink      120   cx2\n','c.txt');eq([cx.links[0].a.port,cx.links[0].b.device,cx.links[0].b.port],['1/1/49','cx2','1/1/50'],'AOS-CX LLDP');
 const fg=E.fromText('FG-EXAMPLE # get router info routing-table all\nCodes: K - kernel, C - connected, S - static, R - RIP, B - BGP\n\nS*      0.0.0.0/0 [10/0] via 192.0.2.1, wan1, [1/0]\nC       10.4.0.0/24 is directly connected, port1\n','fg.txt');
 eq(fg.routes.map(r=>[r.protocol,r.prefix,r.nextHop,r.iface,r.distance]),[['Static','0.0.0.0/0','192.0.2.1','wan1','10'],['Connected','10.4.0.0/24','','port1','']],'FortiGate routing table');eq(fg.device,'FG-EXAMPLE','FortiGate prompt');
 const cxr=E.fromText('cx1# show ip route\n\nDisplaying ipv4 routes selected for forwarding\n\n0.0.0.0/0, vrf default\n\tvia  10.5.0.1,  [1/0],  static\n10.5.0.0/24, vrf default\n\tvia  vlan5,  [0/0],  connected\n','cxr.txt');
 eq(cxr.routes.map(r=>[r.prefix,r.nextHop,r.iface,r.protocol]),[['0.0.0.0/0','10.5.0.1','','Static'],['10.5.0.0/24','','vlan5','Connected']],'AOS-CX routing table');
 const lx=E.fromText('default via 192.0.2.1 dev eth0 proto static metric 100\n10.2.0.0/24 dev eth1 proto kernel scope link src 10.2.0.5\n','r.txt');eq(lx.routes.map(r=>[r.prefix,r.nextHop,r.iface,r.protocol]),[['0.0.0.0/0','192.0.2.1','eth0','Static'],['10.2.0.0/24','','eth1','Connected']],'Linux ip route');

 // Spreadsheet export (XLSX) with site devices and interfaces.
 const site=await E.load(new Uint8Array(demoSite()),'example-site.xlsx');
 eq([site.source,site.scope,site.created],['Auvik site export','site','2025-12-09 12:00'],'site export recognized with its creation date');
 eq(site.devices.length,8,'devices');eq(site.devices.find(d=>d.name==='EXAMPLE-FW1').ips,['192.0.2.1','10.0.99.1']);
 eq(site.interfaces.length,10);const up=site.interfaces.find(i=>i.name==='TenGigabitEthernet1/1/1'&&i.device==='EXAMPLE-ACCESS1');eq([up.description,up.speed,up.vlans.map(v=>v.id)],['Uplink to core','10 Gb/s',['10','99']],'interface description, speed and VLANs');
 const printer=site.links.find(l=>l.b.device==='EXAMPLE-PRINTER');eq(printer.b.port,'','placeholder port names are dropped');
 eq(site.links.length,7,'links are deduplicated across both directions and the device list: '+site.links.map(l=>l.a.device+':'+l.a.port+'-'+l.b.device+':'+l.b.port).join(' | '));
 eq(site.routes.length,2);eq(site.mac.length,3);eq(site.lifecycle[0].lastSupport,'2020-01-31');eq(site.vulnerabilities[0].cve,'CVE-0000-0001');eq(site.alerts.warning,1);
 // Device report and CSV.
 const report=await E.load(new Uint8Array(xlsx([{name:'Summary',rows:[['Example Organization - EXAMPLE-ACCESS1 Summary','']]},{name:'Interfaces',rows:[['INTERFACES'],['Admin Status','Oper Status','Interface Name','MAC Address','Type','Parent Device','Negotiated Speed','Connected To','Configuration Details'],['Up','Up','GigabitEthernet1/0/1','','Ethernet','EXAMPLE-ACCESS1','1.0 Gbit/s','eth0  on EXAMPLE-AP1',0]]},{name:'Top Interfaces by Bandwidth',rows:[['TOP'],['Interface Name','High','Low','Average','Connected To'],['GigabitEthernet1/0/1',1,1,1,'eth0  on EXAMPLE-AP1']]}])),'EXAMPLE-ACCESS1.xlsx');
 eq([report.source,report.scope,report.device,report.interfaces.length],['Auvik device report','device','EXAMPLE-ACCESS1',1],'device report; summary tables are not counted as interfaces');
 const csv=await E.load(new TextEncoder().encode('Device,Local Port,Remote Device,Remote Port\nEXAMPLE-SW1,Gi1/0/48,EXAMPLE-CORE,Te1/0/5\n'),'neighbors.csv');
 eq([csv.links.length,csv.links[0].a.device,csv.links[0].b.port],[1,'EXAMPLE-SW1','Te1/0/5'],'generic neighbor CSV');
 await assert.rejects(()=>E.load(new TextEncoder().encode('a,b\n1,2\n'),'other.csv'),/no recognized columns/,'unrecognized CSV is explained');checks++;
 eq(await E.load(new TextEncoder().encode('hostname X\ninterface Gi1/0/1\n shutdown\n'),'x.cfg'),null,'configuration files fall through to the configuration importer');

 // Site map layout.
 const devices=E.deviceList(site).map(d=>Object.assign(d,{open:-1}));
 const links=site.links.map(l=>({a:E.deviceKey(l.a.device),b:E.deviceKey(l.b.device),aPort:l.a.port,bPort:l.b.port,source:l.source}));
 const map=Map_.layout(devices,links,{});
 const byName=n=>map.nodes.find(x=>x.name===n);
 eq(map.nodes.map(n=>n.name).sort(),['EXAMPLE-ACCESS1','EXAMPLE-ACCESS2','EXAMPLE-ACCESS3','EXAMPLE-CORE','EXAMPLE-FW1'],'infrastructure only by default');
 ok(byName('EXAMPLE-FW1').y<byName('EXAMPLE-CORE').y&&byName('EXAMPLE-CORE').y<byName('EXAMPLE-ACCESS1').y,'firewall on top, then core, then access');
 eq(byName('EXAMPLE-ACCESS1').attached.map(a=>a.name).sort(),['EXAMPLE-AP1','EXAMPLE-PRINTER'],'endpoints summarized on their switch');
 eq(map.edges.length,4);
 const withAPs=Map_.layout(devices,links,{showAccess:true});ok(withAPs.nodes.some(n=>n.name==='EXAMPLE-AP1')&&!withAPs.nodes.some(n=>n.name==='EXAMPLE-PRINTER'),'access points on request, endpoints stay summarized');
 eq(Map_.role({name:'EXAMPLE-FW9',type:''}),'firewall');eq(Map_.role({name:'branch-sw2',type:''}),'switch');eq(Map_.role({name:'Device@10.0.0.9',type:'',generic:true}),'endpoint');
 console.log(checks+' supplementary data checks passed');
})().catch(e=>{console.error(e);process.exit(1);});

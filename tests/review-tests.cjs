const fs=require('fs'),assert=require('assert'),{boot}=require('./harness.cjs');
const current=boot(),baseline=boot('tests/baseline-5.14.0.html'),{ctx}=current,C=ctx.SWCore,R=ctx.SWReview,NOW='2026-10-24T16:00:00Z',assessed=new Set(),detected=new Set(),vendors=new Set();let checks=0;
function ok(v,m){checks++;assert(v,m);}function eq(v,w,m){checks++;assert.deepStrictEqual(JSON.parse(JSON.stringify(v)),JSON.parse(JSON.stringify(w)),m);}
function review(m,now=NOW){var r=C.analyzeConfiguration(m,{now});r.checks.filter(c=>c.evaluated).forEach(c=>assessed.add(c.id));r.findings.forEach(f=>detected.add(f.check));return r;}
function parse(s){return C.parse(s,{filename:'review-example.txt'});}
function has(r,id){return r.findings.some(f=>f.check===id&&f.kind!=='Retained setting');}
const expected={
 'review-aruba.conf':['snmp-default','bpdu-filter'],
 'review-cisco.conf':['credential-storage','snmp-write','snmp-default','management-cleartext','ssh-version','management-timeout','logging-disabled','ntp-disabled','source-routing','directed-broadcast','bpdu-filter','edge-guard'],
 'review-forti.conf':['duplicate-ip','certificate-validity','dhcp-gateway','dhcp-reservation','nat-range','group-cycle','route-next-hop','route-prefix','gateway-self','route-disabled','admin-mfa','ldap-verification','ldap-cleartext','dhcp-boundary','snmp-default','management-source','management-cleartext','management-timeout','snmp-v3-security','broad-allow','policy-conflict','tls-legacy','vpn-ike-version','vpn-weak-dh','vpn-weak-crypto','logging-transport','object-reference','policy-duplicate','ntp-disabled'],
 'review-junos.conf':['root-ssh','snmp-write','snmp-default','management-cleartext','ssh-version','vpn-weak-dh','vpn-weak-crypto'],
 'review-mikrotik.rsc':['dns-recursion','management-source','management-cleartext','ntp-disabled'],
 'review-palo.xml':['certificate-validity','ldap-verification','ldap-cleartext','tls-legacy'],
 'review-sonic.txt':['certificate-validity','snmp-default','ntp-disabled','management-cleartext'],
 'review-sophos.xml':['certificate-validity','ldap-verification','ldap-cleartext'],
 'review-switch.conf':['host-address','overlap','native-vlan','lag-settings','stp-disabled']
};
for(const [file,ids]of Object.entries(expected)){
 const m=current.load('tests/fixtures/'+file),before=JSON.stringify(m),r=review(m),again=review(m);vendors.add(m.meta.vendorId);r.checks.filter(c=>c.evaluated).forEach(c=>assessed.add(c.id));r.findings.forEach(f=>detected.add(f.check));
 for(const id of ids)ok(has(r,id),file+' detects '+id);
 eq(JSON.stringify(m),before,file+' review is read-only');eq(r,again,file+' deterministic review at a fixed time');
 eq(new Set(r.findings.map(f=>f.id)).size,r.findings.length,file+' stable unique finding identifiers');
 ok(r.findings.every(f=>f.recordIds.length&&f.recordIds.every(id=>m.records.some(r=>r.id===id))),file+' every finding links to real imported records');
 ok(r.findings.every(f=>f.resolution.length>=2&&f.verification.length&&f.evidence.length&&f.locations.length),file+' findings have concrete resolution, verification and evidence');
 ok(r.findings.every(f=>f.resolution[0].includes(m.meta.vendor)),file+' resolution identifies imported vendor');
 ok(r.findings.every(f=>['Issue','Recommendation','Retained setting'].includes(f.kind)),file+' findings distinguish issues and advice');
 ok(r.checks.every(c=>c.status!=='Passed'&&c.status!=='Compliant'),file+' no unsupported compliance claim');
 for(const format of ['json','text','html']){
  const output=R.report(r,m.records,format);
  ok(!/NEVER_EXPORT|LDAP_SECRET_NEVER_EXPORT/.test(output),file+' '+format+' excludes credential values');
  ok(output.includes('Recommended resolution')||output.includes('"resolution"'),file+' '+format+' includes resolution');
  ok(output.includes('Guidance')||output.includes('"references"'),file+' '+format+' includes guidance');
 }
 const snapshot=m.meta.vendorId==='sonicwall'?C.exportJSON(m,false):ctx.SWImporters.exportJSON(m,false),reopened=C.parse(snapshot,{});
 eq(reopened.entries.map(e=>[e.key,e.value,e.recordId]),m.entries.map(e=>[e.key,e.value,e.recordId]),file+' original snapshot fields preserved');
 eq(review(reopened).findings.map(f=>[f.id,f.check,f.kind,f.recordIds]),r.findings.map(f=>[f.id,f.check,f.kind,f.recordIds]),file+' snapshot review parity');
}
let m=current.load('tests/fixtures/review-forti.conf'),r=review(m),raw=fs.readFileSync('tests/fixtures/review-forti.conf','utf8');
let cert=r.findings.find(f=>f.check==='certificate-validity');ok(cert&&cert.severity==='High','Embedded PEM expiry is high priority for a referenced certificate');ok(cert.evidence.some(e=>e.includes('2020-01-01')),'DER validity sequence interpreted');
eq(review(m,'2026-10-24T16:01:00Z').findings.map(f=>f.id),r.findings.map(f=>f.id),'Finding identities do not change solely with the review clock');
ok(cert.recordIds.some(id=>m.records.find(r=>r.id===id).name==='Expired-Test'),'Expired certificate link');
ok(r.findings.some(f=>f.kind==='Retained setting'&&f.check==='disabled-rule'),'Disabled rule is retained information');
ok(r.findings.find(f=>f.check==='ntp-disabled').kind==='Recommendation','Explicit NTP disablement remains an actionable recommendation');
ok(r.findings.find(f=>f.check==='dhcp-gateway').recommendation.includes('10.10.10.0/24'),'DHCP resolution uses the actual client subnet');
ok(r.findings.find(f=>f.check==='policy-duplicate').recordIds.length===2,'Only equal allow definitions are duplicate candidates');
ok(r.findings.find(f=>f.check==='tls-legacy').references.some(r=>r.url.includes('rfc9325')),'TLS finding links to the relevant standard');
ok(r.findings.find(f=>f.check==='tls-legacy').sourceEvidence.every(e=>e.key.includes('config ')),'Original setting location is readable FortiOS context');
// Invalid addresses and masks must not vanish simply because they cannot be parsed.
for(const [address,mask]of [['192.0.2.999','255.255.255.0'],['192.0.2.1','255.0.255.0'],['2001:db8::1/129',''],['224.0.0.1','255.255.255.0']]){
 const s='version 15.2\nhostname invalid\ninterface Vlan10\n ip address '+address+' '+mask+'\n exit\n';
 ok(has(review(parse(s)),'address-mask'),'Invalid explicit interface address / mask: '+address+' '+mask);
}
// Correct /31 and /32 interfaces, link-local IPv6 and separate VRFs are allowed.
for(const address of ['192.0.2.0 255.255.255.254','192.0.2.1 255.255.255.254','192.0.2.0 255.255.255.255'])ok(!has(review(parse('version 15.2\nhostname point\ninterface Vlan10\n ip address '+address+'\n exit\n')),'host-address'),'Valid point-to-point or host prefix '+address);
const vrfs='version 15.2\nhostname contexts\ninterface Vlan10\n vrf forwarding RED\n ip address 192.0.2.1 255.255.255.0\n exit\ninterface Vlan20\n vrf forwarding BLUE\n ip address 192.0.2.1 255.255.255.0\n exit\n';
ok(!has(review(parse(vrfs)),'duplicate-ip'),'Same address in distinct VRFs is not a conflict');
// Raw service names or TCP port numbers are insufficient to infer insecurity.
let safe=fs.readFileSync('tests/fixtures/review-palo.xml','utf8').replace('<ssl>no</ssl>','<ssl>yes</ssl>').replace('<verify-server-certificate>no</verify-server-certificate>','<verify-server-certificate>yes</verify-server-certificate>').replace('<min-version>tls1-0</min-version>','<min-version>tls1-2</min-version>');
r=review(parse(safe));ok(!has(r,'ldap-cleartext'),'LDAP TLS on port 389 is secure StartTLS, not a plaintext finding');ok(!has(r,'ldap-verification'),'Enabled LDAP verification is not flagged');ok(!has(r,'tls-legacy'),'TLS 1.2 is not obsolete');
safe='firewallName=Safe\nldapServer=192.0.2.20\nldapSrvrUseTls=0\nldapSrvrNegTls=1\n';ok(!has(review(parse(safe)),'ldap-cleartext'),'SonicOS StartTLS can protect LDAP with direct TLS disabled');
safe='version 15.2\nhostname safe\nip ssh version 2\nno ip http server\nno ip source-route\nno logging console\nntp server 192.0.2.10\nusername admin privilege 15 secret 9 EXAMPLE_SECRET_HASH\n';r=review(parse(safe));for(const id of ['ssh-version','management-cleartext','credential-storage','logging-disabled','source-routing','ntp-disabled'])ok(!has(r,id),'Explicit secure alternative: '+id);
safe=raw.replace('set ike-version 1','set ike-version 2').replace('3des-sha1 aes256-sha256','aes256gcm-prfsha384').replace('set dhgrp 2 14','set dhgrp 19 20').replace('tlsv1-0 tlsv1-2','tlsv1-2 tlsv1-3').replace('set ssl-min-proto-ver tls1-1','set ssl-min-proto-ver tls1-2');r=review(parse(safe));for(const id of ['vpn-ike-version','vpn-weak-crypto','vpn-weak-dh','tls-legacy'])ok(!has(r,id),'Modern FortiOS alternative: '+id);
safe=safe.replace('set proposal aes256gcm-prfsha384','set proposal aes256gcm-prfsha384\n  set authentication-algorithm none');ok(!has(review(parse(safe)),'vpn-weak-crypto'),'AEAD with no separate integrity algorithm is not unencrypted VPN traffic');
// Disabled tunnels retain a reviewable setting without implying current use.
let disabled=raw.replace('set remote-gw 198.51.100.2','set status disable\n  set remote-gw 198.51.100.2');r=review(parse(disabled));ok(!has(r,'vpn-ike-version'),'Disabled IKEv1 tunnel not an active recommendation');ok(r.findings.some(f=>f.check==='vpn-ike-version'&&f.kind==='Retained setting'),'Disabled VPN issue still inspectable');
// Deletion / deactivation in Junos must not resurrect the removed service.
for(const tail of ['delete system services telnet','deactivate system services','deactivate system services telnet']){
 r=review(parse('set system host-name safe\nset system services telnet\n'+tail+'\n'));
 ok(!r.findings.some(f=>f.check==='management-cleartext'&&f.kind!=='Retained setting'),'Removed or inactive Junos Telnet: '+tail);
}
r=review(parse('set system host-name safe\nset system services telnet\ndeactivate system services telnet\nactivate system services telnet\n'));ok(has(r,'management-cleartext'),'Explicitly reactivated Junos service is reviewed');
// DHCP exclusions can protect a pool address; an exclusion elsewhere cannot.
let cisco=fs.readFileSync('tests/fixtures/review-cisco.conf','utf8');m=parse(cisco);m.categories.network.find(r=>r.family==='dhcppool').summary.ranges='192.0.2.1 to 192.0.2.200';r=review(m);ok(!has(r,'dhcp-local'),'Known DHCP exclusions suppress a false local-address conflict in an explicitly bounded pool');
m=parse(cisco.replace('192.0.2.1 192.0.2.10','192.0.2.100 192.0.2.110'));m.categories.network.find(r=>r.family==='dhcppool').summary.ranges='192.0.2.1 to 192.0.2.200';r=review(m);ok(has(r,'dhcp-local'),'Unrelated exclusion does not suppress local pool conflict');
// Reservation identity is scoped to one server and binding action.
safe=raw.replace('set ip 10.10.10.20\n    set mac 02:00:00:00:00:02','set ip 10.10.10.21\n    set mac 02:00:00:00:00:02');ok(!has(review(parse(safe)),'dhcp-reservation'),'Distinct reservation IPs are allowed');
safe=raw.replace('set mac 02:00:00:00:00:02','set mac 02:00:00:00:00:02\n    set action block');ok(!has(review(parse(safe)),'dhcp-reservation'),'Blocked client binding is not an allocated reservation');
// Unknown exports, missing metadata and partial exports are not passed audits.
m=parse('set system host-name partial\nset system services ssh\n');m.meta.partial=true;r=review(m);ok(r.partial,'Partial import status retained');ok(r.checks.some(c=>c.status==='Not assessed'),'Unassessable checks identified');ok(!has(r,'object-reference'),'Partial imports do not manufacture missing-object findings');
let partial=current.load('tests/fixtures/review-forti.conf');partial.meta.partial=true;ok(!has(review(partial),'object-reference'),'Partial object groups do not imply broken references');
let noData={meta:{vendor:'Unknown',vendorId:'unknown'},records:[],entries:[],categories:{interfaces:[],routes:[],policies:[]}};r=review(noData);ok(r.checks.every(c=>c.status==='Not assessed'),'Empty input is unassessed rather than passed');eq(r.findings.length,0,'Empty input has no invented issues');
// Groups are a graph, not a recursion depth limit. A DAG is not circular.
safe=raw.replace('set member "Cycle-A"','set member "Office"');ok(!has(review(parse(safe)),'group-cycle'),'Acyclic nested groups do not trigger a cycle');
// Rule comparisons include all explicit match/profile fields and context.
safe=raw.replace('set name "All-Traffic-Opposite"','set groups "Different-Users"\n  set name "All-Traffic-Opposite"');ok(!has(review(parse(safe)),'policy-conflict'),'Different user-group criteria are not an opposing-match finding');
safe=raw.replace('set name "All-Traffic-Duplicate"','set utm-status enable\n  set name "All-Traffic-Duplicate"');ok(!has(review(parse(safe)),'policy-duplicate'),'Different security profile settings prevent a duplicate claim');
// Well-formed NAT ranges and non-applicable inherited values are not errors.
safe=raw.replace('8443-8440','8440-8443');ok(!has(review(parse(safe)),'nat-range'),'Ascending NAT port range is valid');
const pool='\nconfig firewall ippool\n edit "Invalid-Pool"\n set startip 203.0.113.20\n set endip 203.0.113.10\n next\nend\n';ok(has(review(parse('#config-version=FGT100F-7.4.8\nconfig system global\n set hostname pools\nend\n'+pool)),'nat-range'),'Separate NAT pool endpoints checked');
const pair='\nconfig system virtual-wire-pair\n edit "Broken-Pair"\n set member "wan1"\n next\nend\n';ok(has(review(parse(raw+pair)),'wire-pair'),'Virtual wire pair needs two distinct interfaces');
ok(has(review(parse(raw.replace('set device "wan1"','set device "Missing-Port"'))),'route-interface'),'Unresolved explicit route interface is reviewable');
m=current.load('tests/fixtures/review-forti.conf');const originalPool=m.categories.network.find(r=>r.family==='dhcppool'),extraPool=JSON.parse(JSON.stringify(originalPool));extraPool.id='test:overlapping-pool';extraPool.name='Second bounded pool';m.records.push(extraPool);m.categories.network.push(extraPool);ok(has(review(m),'dhcp-overlap'),'Overlapping explicit pools in the same binding are reviewed');
// A contradictory membership projection is also checked independently of the
// parser, because some vendor exports retain both tagged and untagged lists.
m=current.load('tests/fixtures/review-switch.conf');m.categories.interfaces[0].summary.untaggedVLANs='10, 20';m.categories.interfaces[0].summary.taggedVLANs='10';ok(has(review(m),'vlan-membership'),'Contradictory tagged and untagged membership is reviewed');
// RouterOS service enablement must be explicit, and a local input policy does
// not justify claiming that a recursively enabled resolver is internet exposed.
let mt=fs.readFileSync('tests/fixtures/review-mikrotik.rsc','utf8');r=review(parse(mt));ok(r.findings.find(f=>f.check==='dns-recursion').detail.includes('does not show'),'DNS recursion finding does not assert external reachability');
r=review(parse(mt.replace(/disabled=no/g,'disabled=yes')));ok(!has(r,'management-cleartext'),'Disabled RouterOS services are not active findings');
const mtvpn='\n/ip ipsec peer\nadd name=Legacy address=198.51.100.2 exchange-mode=main\n/ip ipsec profile\nadd name=Weak hash-algorithm=md5 enc-algorithm=3des dh-group=modp1024\n';r=review(parse(mt+mtvpn));for(const id of ['vpn-ike-version','vpn-weak-crypto','vpn-weak-dh'])ok(has(r,id),'RouterOS recognized VPN setting '+id);
// Certificate checks honor the review date, state, context and parse limits.
m=current.load('tests/fixtures/review-palo.xml');r=review(m);ok(r.findings.some(f=>f.title==='Certificate is not valid yet'),'Future validity recognized');ok(r.findings.some(f=>f.title==='Certificate expires within 30 days'),'Renewal window recognized');
ok(!review(m,'2018-01-01T00:00:00Z').findings.some(f=>f.title==='Certificate validity has expired'),'Expiry evaluated against supplied review time');
safe=fs.readFileSync('tests/fixtures/review-palo.xml','utf8').replace('2020-01-01T00:00:00Z','01/02/2020');r=review(parse(safe));ok(!r.findings.some(f=>f.title==='Certificate validity has expired'),'Ambiguous date is not guessed');
safe=fs.readFileSync('tests/fixtures/review-palo.xml','utf8').replace('2020-01-01T00:00:00Z','2020-02-31T00:00:00Z');r=review(parse(safe));ok(!r.findings.some(f=>f.title==='Certificate validity has expired'),'Invalid calendar date is not normalized into a guessed date');
safe=fs.readFileSync('tests/fixtures/review-palo.xml','utf8').replace('<min-version>tls1-0</min-version>','<min-version>tls1-3</min-version>');ok(review(parse(safe)).findings.some(f=>f.title==='TLS minimum version exceeds the maximum'&&f.kind==='Issue'),'Incompatible TLS minimum and maximum are a configuration issue');
safe=raw.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/,'-----BEGIN CERTIFICATE-----\nMDA=\n-----END CERTIFICATE-----');r=review(parse(safe));ok(!has(r,'certificate-validity'),'Malformed certificate is not assigned invented dates');
safe=raw.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/,fs.readFileSync('tests/fixtures/review-certificate-future.pem','utf8').trim());r=review(parse(safe));ok(r.findings.some(f=>f.check==='certificate-validity'&&f.evidence.some(e=>e.includes('2051-01-01'))),'X.509 GeneralizedTime after 2049 is decoded correctly');
let large='#config-version=FGT100F-7.4.8\nconfig system global\n set hostname graph\nend\nconfig firewall address\n edit END\n set subnet 192.0.2.1 255.255.255.255\n next\nend\nconfig firewall addrgrp\n';for(let i=0;i<1200;i++)large+=' edit G'+i+'\n set member '+(i===1199?'END':'G'+(i+1))+'\n next\n';large+='end\n';ok(!has(review(parse(large)),'group-cycle'),'Deep object graph is reviewed without recursion failure or a false cycle');
// Review export must escape data and cannot execute injected config text.
m=current.load('tests/fixtures/review-forti.conf');m.meta.name='<script>bad()</script>';m.records.find(r=>r.name==='Cycle-A').name='<img src=x onerror=bad()>';r=review(m);const html=R.report(r,m.records,'html');ok(!html.includes('<script>'),'Report escapes hostile title');ok(!html.includes('<img src=x'),'Report escapes hostile record name');ok(html.includes('&lt;script&gt;'),'Escaped title retained');
ok(!html.includes('NEVER_EXPORT'),'Report excludes private settings');
// Review model references and original exports remain unchanged across vendors.
for(const file of ['features-cisco.conf','features-forti.conf','features-junos.conf','features-palo.xml','features-sonic.txt','features-sophos.xml','fundamentals-aos.conf','features-meraki.json','mikrotik.rsc']){
 const m=current.load('tests/fixtures/'+file),old=baseline.load('tests/fixtures/'+file),before=JSON.stringify(m.entries.map(e=>[e.key,e.value,e.recordId,e.category]));review(m);
 eq(m.entries.map(e=>[e.key,e.value,e.recordId,e.category]),old.entries.map(e=>[e.key,e.value,e.recordId,e.category]),file+' importer source ownership unchanged');eq(JSON.stringify(m.entries.map(e=>[e.key,e.value,e.recordId,e.category])),before,file+' analysis does not change source');
}
// UI filtering keeps inactive settings separate and preserves scope and links.
m=current.load('tests/fixtures/review-forti.conf');let a=ctx.audit;a.state.review=review(m);a.state.view='findings';a.state.scope='';a.state.findingsKind='attention';a.state.findingsQuery='';a.state.findingsSeverity='all';a.state.findingsArea='all';
ok(a.filteredFindings().every(f=>f.kind!=='Retained setting'),'Inactive settings hidden in default findings');a.state.findingsKind='retained';ok(a.filteredFindings().every(f=>f.kind==='Retained setting')&&a.filteredFindings().length>0,'Retained settings accessible');a.state.findingsKind='issues';ok(a.filteredFindings().every(f=>f.kind==='Issue'),'Issue-only filter');a.state.findingsKind='all';a.state.findingsQuery='RFC 9325';ok(a.filteredFindings().every(f=>f.check==='tls-legacy')&&a.filteredFindings().length>0,'Guidance searchable');
a.state.findingsQuery='';const ui=a.findingsPage();ok(ui.indexOf('Source configuration')<ui.indexOf('Review of '),'Source configuration remains first');ok(ui.includes('Recommended resolution')&&ui.includes('Where to change')&&ui.includes('Verify the resolution'),'Review UI contains practical resolution sections');ok(ui.includes('Not assessed'),'Coverage discloses unsupported inputs');
const json=JSON.parse(R.report({...a.state.review,selection:{context:'VDOM root',kind:'issues'}},m.records,'json',a.filteredFindings()));eq(json.selection,{context:'VDOM root',kind:'issues'},'Export selection metadata retained');eq(json.findings.length,a.filteredFindings().length,'Filtered export includes full result set');
eq([...new Set(R.checks.map(c=>c.id))].length,R.checks.length,'Check identifiers are unique');eq(R.checks.filter(c=>!detected.has(c.id)).map(c=>c.id),[],'Every registered check has a positive detection case');
fs.writeFileSync('tests/review-results.json',JSON.stringify({checks,ruleCount:R.checks.length,detectedChecks:[...detected].sort(),assessedChecks:[...assessed].sort(),fixtures:Object.keys(expected),vendors:[...vendors].sort(),referenceTime:NOW},null,2));console.log(checks+' configuration review checks passed across '+vendors.size+' vendors and '+Object.keys(expected).length+' fixtures');

// Client report rendering and plain-language change summaries.
const assert=require('node:assert/strict'),{boot}=require('./harness.cjs'),Report=require('../webview/client_report.js'),Summary=require('../webview/change_summary.js');
const {ctx}=boot(),C=ctx.SWCore;let checks=0;
function ok(v,m){checks++;assert.ok(v,m);}function eq(a,b,m){checks++;assert.deepEqual(a,b,m);}

// Client report
const device={name:'CORE<script>alert(1)</script>',vendor:'Cisco IOS / IOS-XE / NX-OS',model:'C9300-48P',firmware:'17.9',serial:'',filename:'core.conf',
 ports:[{name:'Gi1/0/1',state:'used',mode:'Access',vlans:'Untagged 10',description:'Desk "A" & B',speed:''},{name:'Gi1/0/2',state:'unconfigured',mode:'',vlans:'',description:'',speed:''},{name:'Gi1/0/3',state:'disabled',mode:'Access',vlans:'Untagged 1',description:'',speed:''}],
 logical:[{name:'Vlan10',type:'VLAN interface',addresses:'10.0.10.1 / 255.255.255.0',vlan:'10',description:''}],
 vlans:[{id:'10',name:'USERS',ports:'1 (Gi1/0/1)',address:'10.0.10.1'}],addresses:[{interface:'Vlan10',address:'10.0.10.1 / 255.255.255.0',network:'10.0.10.0/24',context:'VLAN 10'}],
 findings:[{severity:'Info',kind:'Recommendation',title:'Trunks carry every VLAN',detail:'d',recommendation:'r',evidence:['Trunks: Gi1/0/48']},{severity:'High',kind:'Issue',title:'Weak <b>password</b>',detail:'x',recommendation:'',evidence:[]}]};
let html=Report.build([device,{name:'EMPTY-SW',vendor:'Aruba AOS-CX',ports:[],vlans:[],addresses:[],findings:[]}],{title:'Example & Co report',preparedFor:'Example Client',redacted:true,appVersion:'9.9.9',date:new Date('2026-11-04T10:00:00Z')});
ok(html.startsWith('<!doctype html>')&&html.includes('</html>'),'standalone HTML document');
ok(!html.includes('<script>alert(1)')&&html.includes('CORE&lt;script&gt;'),'device names are escaped');
ok(!html.includes('Weak <b>password</b>')&&html.includes('Weak &lt;b&gt;password&lt;/b&gt;'),'finding text is escaped');
ok(html.includes('Desk &quot;A&quot; &amp; B'),'descriptions are escaped');
ok(html.includes('<title>Example &amp; Co report</title>')&&html.includes('Prepared for Example Client'),'title and recipient');
ok(html.includes('<strong>1 / 3</strong><span>Physical ports in use</span>'),'cover counts ports in use across devices');
ok(html.includes('<strong>2</strong><span>Review findings</span>')&&html.includes('<strong>1</strong><span>High severity</span>'),'cover counts findings and high severity');
ok(html.indexOf('Weak &lt;b&gt;')<html.indexOf('Trunks carry every VLAN'),'findings are ordered by severity');
ok(html.includes('No physical ports are recorded in this export.')&&html.includes('No VLANs are recorded in this export.'),'empty sections say so');
ok(html.includes('No issues or recommendations were found'),'a device without findings says so');
ok(html.includes('Sensitive values:</b> masked'),'masking is stated');
ok(html.includes('window.print()')&&html.includes('@media print'),'printable with a print button hidden on paper');
ok(!/undefined|null|NaN/.test(html.replace(/<style>[\s\S]*?<\/style>/,'')),'no placeholder values leak into the report');
ok(html.includes('Unconfigured</td>')&&html.includes('Disabled</td>')&&html.includes('In use</td>'),'port states are labeled');

// Change summary from real parsed configurations
const cfg=(o)=>'version 15.2\nhostname '+(o.host||'SW1')+'\nvlan 10\n name USERS\nvlan 30\n name PRINTERS\n'+(o.vlan50?'vlan 50\n name OLD\n':'')+
 'interface GigabitEthernet1/0/14\n description '+(o.desc||'Desk 14')+'\n switchport mode access\n switchport access vlan '+(o.access||10)+'\n'+
 (o.newPort?'interface GigabitEthernet1/0/20\n description New AP\n switchport mode access\n switchport access vlan 10\n':'')+
 'ip access-list extended '+(o.acl||'WEB-OLD')+'\n permit tcp any host 192.0.2.10 eq 443\n'+
 'username admin privilege 15 secret '+(o.secret||'TEST_SECRET_ONE')+'\n';
const left=C.parse(cfg({vlan50:true}),{filename:'before.conf'}),right=C.parse(cfg({access:30,desc:'Printer',newPort:true,acl:'WEB-IN',secret:'TEST_SECRET_TWO'}),{filename:'after.conf'});
const result=C.compareRecords(left,right,true,{});
const out=Summary.build(result,{left:{name:'SW1',filename:'before.conf'},right:{name:'SW1',filename:'after.conf'},label:k=>({untaggedVLANs:'Untagged VLANs',comment:'Description',nativeVLAN:'Native / PVID'})[k]||k,categoryLabel:c=>c.toUpperCase(),appVersion:'9.9.9',date:new Date('2026-11-04T10:00:00Z')});
const t=out.text;
ok(t.startsWith('Configuration changes: SW1 → SW1\nFiles: before.conf → after.conf'),'header names both sides');
ok(t.includes('Sensitive values masked'),'masking is stated');
ok(/Changed GigabitEthernet1\/0\/14: [^\n]*Untagged VLANs: 10 → 30/.test(t),'port VLAN move is described: '+t);
ok(/Changed GigabitEthernet1\/0\/14: [^\n]*Description: "Desk 14" → Printer/.test(t),'description change is described');
ok(/- Added GigabitEthernet1\/0\/20 \("New AP"\)\./.test(t),'added port with its description');
ok(/- Removed VLAN 50 \(OLD\)\./.test(t),'removed VLAN with its number and name');
ok(t.includes('Possible rename: WEB-OLD → WEB-IN'),'possible rename is described once');
ok(!/- (?:Added WEB-IN|Removed WEB-OLD)/.test(t),'renamed objects are not also listed as plain additions and removals');
ok(!t.includes('TEST_SECRET_ONE')&&!t.includes('TEST_SECRET_TWO'),'secrets never appear');
ok(/\nINTERFACES\n- /.test(t),'changes are grouped by category');
eq(out.counts,{Added:2,Removed:2,Changed:out.counts.Changed},'counts include renamed objects as additions and removals');
ok(/Summary: \d+ objects? changed, 2 added, 2 removed; 1 possible rename noted\./.test(t),'summary line: '+t.split('\n')[4]);
const same=Summary.build(C.compareRecords(left,left,true,{}),{});ok(same.text.includes('No object changes were found.'),'identical configurations');
const many=Summary.build({items:[{kind:'Changed',before:{name:'X',category:'interfaces'},after:{name:'X',category:'interfaces'},summaryChanges:Array.from({length:9},(_,i)=>({key:'k'+i,kind:'Changed',before:'a',after:'b'})),fieldChanges:[]}]},{perObject:3});
ok(many.text.includes('and 6 more properties'),'long change lists are shortened');
const fieldOnly=Summary.build({items:[{kind:'Changed',before:{name:'Y',category:'other'},after:{name:'Y',category:'other'},summaryChanges:[],fieldChanges:[{},{}]}]},{});
ok(fieldOnly.text.includes('Changed Y: 2 original settings changed.'),'source-only changes are counted');
const lists=Summary.build({items:[{kind:'Changed',before:{name:'Gi1/0/48',category:'interfaces'},after:{name:'Gi1/0/48',category:'interfaces'},summaryChanges:[{key:'taggedVLANs',kind:'Changed',before:'10, 20, 100',after:'10, 20, 30'},{key:'allowedVLANs',kind:'Changed',before:'10, 20',after:'20, 10'}],fieldChanges:[]}]},{label:k=>k});
ok(lists.text.includes('taggedVLANs: added 30, removed 100; allowedVLANs: order changed.'),'list values are described as additions and removals: '+lists.text);
const blanks=Summary.build({items:[{kind:'Changed',before:{name:'Z',category:'interfaces'},after:{name:'Z',category:'interfaces'},summaryChanges:[{key:'comment',kind:'Changed',before:'',after:'Uplink'},{key:'speed',kind:'Changed',before:'1000',after:''}],fieldChanges:[]}]},{label:k=>k});
ok(blanks.text.includes('comment: set to Uplink; speed: cleared (was 1000).'),'empty values read as set or cleared: '+blanks.text);
console.log(checks+' client report and change summary checks passed');

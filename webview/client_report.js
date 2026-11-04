(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SWClientReport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Renders a standalone, printable client report from data the app has already
 // collected and masked. It never reads configuration source, so redaction is
 // decided once by the caller and the report cannot add unmasked values.
 function text(v){return v===undefined||v===null?'':String(v);}
 function h(v){return text(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function plural(n,one,many){return n+' '+(n===1?one:many||one+'s');}
 function table(headers,rows,empty){
  if(!rows.length)return '<p class="empty">'+h(empty||'None recorded in this export.')+'</p>';
  return '<table><thead><tr>'+headers.map(function(x){return '<th scope="col">'+h(x)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+(text(c).trim()?h(c):'<span class="none">—</span>')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';
 }
 var STATE_LABELS={used:'In use',configured:'Configured, not in use',disabled:'Disabled',unconfigured:'Unconfigured'};
 function portCounts(ports){var c={used:0,configured:0,disabled:0,unconfigured:0};ports.forEach(function(p){if(c[p.state]!==undefined)c[p.state]++;});return c;}
 function severityRank(s){return {High:0,Warning:1,Info:2}[s]===undefined?3:{High:0,Warning:1,Info:2}[s];}
 function device(d,i){
  var counts=portCounts(d.ports),physical=d.ports.length,findings=(d.findings||[]).slice().sort(function(a,b){return severityRank(a.severity)-severityRank(b.severity)||text(a.title).localeCompare(text(b.title));});
  var facts=[['Vendor',d.vendor],['Model',d.model],['Firmware',d.firmware],['Serial number',d.serial],['Source file',d.filename]].filter(function(f){return text(f[1]).trim();});
  return '<section class="device" id="device-'+(i+1)+'"><h2>'+h(d.name||'Device '+(i+1))+'</h2>'+
   '<dl class="facts">'+facts.map(function(f){return '<div><dt>'+h(f[0])+'</dt><dd>'+h(f[1])+'</dd></div>';}).join('')+'</dl>'+
   '<div class="tiles"><div><strong>'+physical+'</strong><span>Physical ports</span></div><div><strong>'+counts.used+'</strong><span>In use</span></div><div><strong>'+(counts.configured+counts.disabled)+'</strong><span>Configured, disabled or idle</span></div><div><strong>'+counts.unconfigured+'</strong><span>Unconfigured</span></div><div><strong>'+d.vlans.length+'</strong><span>VLANs</span></div><div><strong>'+findings.length+'</strong><span>Review findings</span></div></div>'+
   '<h3>Port usage</h3>'+table(['Port','State','Mode','VLANs','Description','Speed'],d.ports.map(function(p){return [p.name,STATE_LABELS[p.state]||p.state,p.mode,p.vlans,p.description,p.speed];}),'No physical ports are recorded in this export.')+
   (d.logical&&d.logical.length?'<h3>Logical interfaces</h3>'+table(['Interface','Type','Addresses','VLAN','Description'],d.logical.map(function(p){return [p.name,p.type,p.addresses,p.vlan,p.description];})):'')+
   '<h3>VLANs</h3>'+table(['VLAN','Name','Ports','Interface address'],d.vlans.map(function(v){return [v.id,v.name,v.ports,v.address];}),'No VLANs are recorded in this export.')+
   '<h3>IP addresses</h3>'+table(['Interface','Address','Network','VLAN / context'],d.addresses.map(function(a){return [a.interface,a.address,a.network,a.context];}),'No interface addresses are recorded in this export.')+
   '<h3>Review findings</h3>'+(findings.length?'<ol class="findings">'+findings.map(function(f){return '<li class="sev-'+h(text(f.severity).toLowerCase())+'"><div class="finding-head"><span class="severity">'+h(f.severity)+'</span><span class="kind">'+h(f.kind)+'</span><strong>'+h(f.title)+'</strong></div><p>'+h(f.detail)+'</p>'+(f.recommendation?'<p class="rec"><b>Recommended:</b> '+h(f.recommendation)+'</p>':'')+(f.evidence&&f.evidence.length?'<p class="evidence">'+h(f.evidence.slice(0,3).join(' · '))+'</p>':'')+'</li>';}).join('')+'</ol>':'<p class="empty">No issues or recommendations were found by the checks that apply to this export.</p>')+
   '</section>';
 }
 function build(devices,options){
  options=options||{};devices=devices||[];
  var title=text(options.title).trim()||'Network configuration report',prepared=options.preparedFor?text(options.preparedFor).trim():'',date=options.date||new Date(),stamp=date.toLocaleString?date.toLocaleString([], {dateStyle:'long',timeStyle:'short'}):String(date);
  var totals=devices.reduce(function(t,d){var c=portCounts(d.ports);t.ports+=d.ports.length;t.used+=c.used;t.findings+=(d.findings||[]).length;t.high+=(d.findings||[]).filter(function(f){return f.severity==='High';}).length;return t;},{ports:0,used:0,findings:0,high:0});
  var summary=table(['Device','Vendor','Model','Ports in use','VLANs','Findings'],devices.map(function(d){var c=portCounts(d.ports);return [d.name,d.vendor,d.model,d.ports.length?c.used+' of '+d.ports.length:'—',String(d.vlans.length),String((d.findings||[]).length)];}));
  var css='*{box-sizing:border-box}body{font:13px/1.55 "Segoe UI",Calibri,Arial,sans-serif;color:#1f2a3d;background:#f5f7fb;margin:0}main{max-width:1080px;margin:0 auto;padding:32px 28px 60px}.cover{background:#fff;border:1px solid #dde3ee;border-radius:12px;padding:34px 36px;margin-bottom:24px}.cover h1{font-size:28px;margin:0 0 6px;letter-spacing:-.3px}.cover .sub{color:#5b6680;margin:0 0 18px}.cover .meta{display:flex;flex-wrap:wrap;gap:8px 24px;color:#5b6680;font-size:12px}.cover .meta b{color:#1f2a3d}.totals{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0 4px}.totals div,.tiles div{background:#f3f5fa;border-radius:8px;padding:10px 12px}.totals strong,.tiles strong{display:block;font-size:20px;color:#2d3e9a}.totals span,.tiles span{font-size:11px;color:#5b6680}.note{font-size:11px;color:#5b6680;margin:14px 0 0}.device{background:#fff;border:1px solid #dde3ee;border-radius:12px;padding:26px 30px;margin:22px 0;break-before:page}.device:first-of-type{break-before:auto}h2{font-size:21px;margin:0 0 12px}h3{font-size:14px;margin:24px 0 8px;color:#2d3e9a;border-bottom:1px solid #e6eaf2;padding-bottom:5px}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 20px;margin:0 0 14px}.facts dt{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#7a849b}.facts dd{margin:0;font-weight:600;overflow-wrap:anywhere}.tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}table{width:100%;border-collapse:collapse;table-layout:auto;font-size:12px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e9edf4;vertical-align:top;overflow-wrap:anywhere}th{background:#f3f5fa;font-weight:600;color:#3b4660}tr{break-inside:avoid}.empty{color:#7a849b;font-style:italic}.none{color:#b3bacb}.findings{list-style:none;padding:0;margin:0;display:grid;gap:8px}.findings li{border:1px solid #e3e8f1;border-left:4px solid #8a94ab;border-radius:6px;padding:9px 12px;break-inside:avoid}.findings li.sev-high{border-left-color:#c2413a}.findings li.sev-warning{border-left-color:#d48a1c}.findings li.sev-info{border-left-color:#4b67c9}.finding-head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}.severity,.kind{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#5b6680;background:#f0f2f7;border-radius:4px;padding:1px 6px}.findings p{margin:5px 0 0}.rec{color:#2b3550}.evidence{font-size:11px;color:#6b7590;overflow-wrap:anywhere}.toolbar{display:flex;justify-content:flex-end;margin-bottom:12px}.toolbar button{font:inherit;border:1px solid #c9d1e2;background:#fff;border-radius:6px;padding:6px 14px;cursor:pointer}footer{color:#7a849b;font-size:11px;margin-top:30px}@media print{body{background:#fff}main{padding:0;max-width:none}.toolbar{display:none}.cover,.device{border:0;padding:0;border-radius:0}.device{margin:0}a{color:inherit}}@media(max-width:760px){.totals,.tiles{grid-template-columns:repeat(2,1fr)}.facts{grid-template-columns:1fr 1fr}}';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+h(title)+'</title><style>'+css+'</style></head><body><main>'+
   '<div class="toolbar"><button type="button" onclick="window.print()">Print or save as PDF</button></div>'+
   '<section class="cover"><h1>'+h(title)+'</h1>'+(prepared?'<p class="sub">Prepared for '+h(prepared)+'</p>':'<p class="sub">Configuration summary</p>')+
   '<div class="meta"><span><b>Generated:</b> '+h(stamp)+'</span><span><b>Devices:</b> '+devices.length+'</span><span><b>Sensitive values:</b> '+(options.redacted?'masked':'included')+'</span>'+(options.appVersion?'<span><b>Config Inspector</b> '+h(options.appVersion)+'</span>':'')+'</div>'+
   '<div class="totals"><div><strong>'+devices.length+'</strong><span>'+(devices.length===1?'Device':'Devices')+'</span></div><div><strong>'+totals.used+' / '+totals.ports+'</strong><span>Physical ports in use</span></div><div><strong>'+totals.findings+'</strong><span>Review findings</span></div><div><strong>'+totals.high+'</strong><span>High severity</span></div></div>'+
   '<h3>Devices</h3>'+summary+
   '<p class="note">Built from saved configuration exports, not live device state. Ports, VLANs and findings reflect only what each export contains. Confirm against the devices and vendor documentation before making changes.</p></section>'+
   devices.map(device).join('')+
   '<footer>'+h(plural(devices.length,'device'))+' · '+h(stamp)+(options.appVersion?' · Config Inspector '+h(options.appVersion):'')+'</footer></main></body></html>';
 }
 return {build:build,STATE_LABELS:STATE_LABELS};
});

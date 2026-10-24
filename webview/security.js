(function installSecurityFeatures(root){
  'use strict';
  var C=root.SWCore;
  // Functional views are derived from original fields. Native records, field
  // ownership and vendor syntax remain authoritative for source and exports.
  var sections=[
    ['web','Web & URL filtering'],['app','Application control'],
    ['files','Files & malware'],['ips','Intrusion prevention'],
    ['inspection','SSL/TLS & certificate inspection'],['email','Email security'],
    ['dns','DNS security'],['data','Data protection'],
    ['webserver','Web application protection'],['network','Network protection'],
    ['groups','Profile groups']
  ];
  function text(v){return v===undefined||v===null?'':String(v).trim();}
  function has(v){return text(v)!==''&&!/^(?:not specified|unknown|null|undefined|n\/a)$/i.test(text(v));}
  function uniq(a){return Array.from(new Set(a.filter(has).map(text)));}
  function join(a){return uniq(a).join(', ');}
  function words(v){return (text(v).match(/"(?:\\.|[^"])*"|\S+/g)||[]).map(function(s){return s.replace(/^"|"$/g,'');});}
  function state(v){return /^(?:1|yes|on|true|t|enable|enabled)$/i.test(text(v))?'Enabled':/^(?:0|no|off|false|f|disable|disabled)$/i.test(text(v))?'Disabled':text(v);}
  function readable(v){return ({'deep-inspection':'Decrypt and inspect','certificate-inspection':'Certificate inspection','no-inspection':'No inspection','no-decrypt':'Do not decrypt',decrypt:'Decrypt',block:'Block',allow:'Allow',monitor:'Monitor',pass:'Allow',exempt:'Exempt',log:'Log',permit:'Allow',deny:'Deny','drop-packet':'Drop packet','log-and-permit':'Log and allow',proxy:'Proxy',flow:'Flow',default:'Vendor default','reset-both':'Reset both directions'})[text(v)]||text(v);}
  function fact(label,value,ref,critical){return {label:label,value:text(value),ref:ref||'',critical:critical!==false};}
  function reader(es){
    return {all:function(names){var keys=(Array.isArray(names)?names:[names]).map(function(n){return n.toLowerCase();});return es.filter(function(e){return keys.includes((e.base||'').toLowerCase())&&has(e.value);}).map(function(e){return e.value;});},get:function(names){for(var n of Array.isArray(names)?names:[names]){var e=es.find(function(e){return (e.base||'').toLowerCase()===n.toLowerCase()&&has(e.value);});if(e)return e.value;}return '';}};
  }
  function enrich(model){
    if(!model||!model.entries)return model;
    var originals=model.records.filter(function(r){return !r.summary.securityFeature;}),native=originals.filter(function(r){return !r.summary.featureRoot;}),owners=new Map(native.map(function(r){return [r.id,r];})),rows=[],byId=new Map(),replaced=new Set();
    function scope(es){var e=es[0],r=e&&owners.get(e.recordId);return e&&e.scope||r&&r.scope||'global';}
    function add(section,name,es,values,kind,identity,selectedScope){
      es=Array.from(new Set(es));if(!es.length)return null;
      values=values.filter(function(f){return has(f.value)&&!C.secretKey(f.label)&&!(/address|mail server|responder/i.test(f.label)&&/^(?:0\.0\.0\.0|::)$/.test(f.value));});
      if(!values.length)return null;
      var context=selectedScope||scope(es),id='security:'+section+':'+encodeURIComponent(context)+':'+encodeURIComponent(identity||name);
      if(byId.has(id))return byId.get(id);
      var label=(sections.find(function(s){return s[0]===section;})||[])[1];if(!label)return null;
      var r={id:id,category:'security',family:'security-'+section,index:String(rows.length),name:name,scope:context,derived:true,fields:es,sourceFieldKeys:es.map(function(e){return e.key;}),sourceRecordIds:uniq(es.map(function(e){return e.recordId;})),members:[],matches:{},references:{},notes:[],summary:{name:name,featureRoot:'security',featureSection:'feature-security-'+section,featureLabel:label,featureData:JSON.stringify(values),securityFeature:'Yes',securityKind:kind||label,fields:String(es.length)}};
      var configured=values.find(function(f){return /^(?:Configured state|Policy state)$/.test(f.label);});if(configured)r.summary.status=configured.value;
      rows.push(r);byId.set(id,r);
      es.forEach(function(e){var owner=owners.get(e.recordId);if(owner&&['security','certificates'].includes(owner.category))replaced.add(owner.id);});
      return r;
    }
    function grouped(fn){var map=new Map();model.entries.forEach(function(e){var key=fn(e);if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(e);});return Array.from(map,function(p){return {path:p[0],entries:p[1],read:reader(p[1])};});}
    function fortiGroups(table,individual){var needle='config['+encodeURIComponent(table)+']';return grouped(function(e){var parts=e.key.split('/'),i=parts.indexOf(needle);if(i<0)return '';var end=i+1;if(individual){if(!/^edit\[/.test(parts[end]||''))return '';end++;}else if(/^edit\[/.test(parts[end]||''))return '';return parts.slice(0,end).join('/');}).map(function(g){var match=g.path.match(/edit\[([^\]]*)\]$/);g.name=match?decodeURIComponent(match[1]):table;return g;});}
    function childRules(g){
      var map=new Map();g.entries.forEach(function(e){var rest=e.key.slice(g.path.length),m=rest.match(/^((?:\/config\[[^\]]+\])+)\/edit\[([^\]]+)\]/);if(!m)return;var key=m[0];if(!map.has(key))map.set(key,{name:decodeURIComponent(m[2]),table:decodeURIComponent(m[1]),entries:[]});map.get(key).entries.push(e);});
      return Array.from(map.values()).map(function(rule){var v=reader(rule.entries),action=v.get('action'),type=v.get(['file-type','filetype']),protocol=v.get('protocol'),category=v.get('category'),apps=v.get('application'),url=v.get(['url','pattern']),severity=v.get('severity'),mode=v.get('status'),direction=v.get('direction');
        var details=[action&&readable(action),type&&'File types: '+type,url&&'URL: '+url,category&&'Category IDs: '+category,apps&&'Application IDs: '+apps,severity&&'Severity: '+severity,protocol&&'Protocols: '+protocol,direction&&'Direction: '+direction,mode&&'State: '+state(mode)].filter(Boolean);
        return fact('Rule '+rule.name,details.join(' / '));
      }).filter(function(f){return has(f.value);});
    }
    var fortiTables=[
      ['webfilter profile','web','Web filter profile'],['webfilter urlfilter','web','URL filter list'],['webfilter ftgd-local-cat','web','Custom URL category'],['webfilter ftgd-local-rating','web','URL category override'],
      ['application list','app','Application control profile'],['application custom','app','Custom application'],['application group','app','Application group'],
      ['antivirus profile','files','Antivirus profile'],['file-filter profile','files','File filter profile'],
      ['ips sensor','ips','IPS profile'],['ips custom','ips','Custom IPS signature'],
      ['firewall ssl-ssh-profile','inspection','SSL/SSH inspection profile'],['ssl-ssh-profile','inspection','SSL/SSH inspection profile'],['ssh-filter profile','inspection','SSH inspection profile'],
      ['emailfilter profile','email','Email filter profile'],['dnsfilter profile','dns','DNS filter profile'],['dnsfilter domain-filter','dns','DNS domain filter list'],
      ['dlp sensor','data','DLP sensor'],['dlp profile','data','DLP profile'],['waf profile','webserver','Web application firewall profile'],
      ['firewall profile-group','groups','Security profile group']
    ];
    function forti(){
      fortiTables.forEach(function(spec){fortiGroups(spec[0],true).forEach(function(g){var v=g.read,direct=reader(g.entries.filter(function(e){return !e.key.slice(g.path.length).includes('/config[');})),values=[];
        function put(label,names,ref,critical,transform){var value=join(v.all(names));if(transform)value=transform(value);values.push(fact(label,value,ref,critical));}
        // Rule-level actions stay paired with their match instead of flattening
        // unrelated actions, categories and file types into misleading lists.
        values=values.concat(childRules(g));
        if(spec[1]==='inspection'){
          ['https','ftps','imaps','pop3s','smtps','ssh','ssl'].forEach(function(proto){var es=g.entries.filter(function(e){return e.key.startsWith(g.path+'/config['+proto+']/');}),p=reader(es),mode=p.get('status');if(mode)values.push(fact(proto.toUpperCase()+' inspection',readable(mode)));});
          put('Inspection certificate authority','caname','certificates');put('Server certificate','server-cert','certificates');
          put('Inspection mode',['inspect-all','ssl-exemption-ip-rating-id'],'',false);
          put('Untrusted certificate action','untrusted-cert','','',readable);put('Expired certificate action','expired-server-cert','','',readable);
          put('Minimum TLS version','min-allowed-ssl-version','',false);put('Maximum TLS version','max-allowed-ssl-version','',false);
        }else if(spec[1]==='files'){
          ['http','ftp','imap','pop3','smtp','mapi','smb','cifs'].forEach(function(proto){var p=reader(g.entries.filter(function(e){return e.key.startsWith(g.path+'/config['+proto+']/');})),mode=p.get(['av-scan','options']);if(mode)values.push(fact(proto.toUpperCase()+' scanning',readable(state(mode))));});
          put('File filtering','feature-set','',false);put('Sandbox scanning','fortisandbox-mode');
        }else if(spec[1]==='web'){
          put('URL filter list','urlfilter-table','security');put('Blocked URLs',['url','pattern']);put('FortiGuard category options','options','',false);
          if(spec[2]==='Custom URL category'){values.push(fact('Category name',g.name));put('Category ID','id','',false);}
          if(spec[2]==='URL category override'){values.push(fact('URL / domain',g.name));put('Assigned category IDs','rating','',false);}
        }else if(spec[1]==='dns'){
          put('DNS domain filter list','domain-filter-table','security');put('Botnet domain blocking','block-botnet','','',state);put('Redirect address','redirect-portal');
        }else if(spec[1]==='ips'){
          put('Malicious URL blocking','block-malicious-url','','',state);
        }
        if(spec[1]==='groups')g.entries.forEach(function(e){var kind=kindForField(e.base);if(kind)values.push(fact(kind,e.value,'security'));});
        var action=direct.get('action');if(action)values.unshift(fact('Action',readable(action)));
        if(direct.get('status'))values.push(fact('Configured state',state(direct.get('status'))));
        if(direct.get('comment')||direct.get('comments'))values.push(fact('Description',direct.get(['comment','comments']),'',false));
        values.push(fact('Profile type',spec[2],'',false));
        add(spec[1],g.name,g.entries,values,spec[2],g.path);
      });});
      [['antivirus settings','files',[['Machine learning detection','machine-learning-detection'],['Grayware scanning','grayware']]],['ips global','ips',[['Intrusion prevention','status']]]].forEach(function(spec){fortiGroups(spec[0],false).forEach(function(g){var v=g.read,values=spec[2].map(function(p){return fact(p[0],state(v.get(p[1])));});add(spec[1],spec[0]==='antivirus settings'?'Malware protection settings':'Intrusion prevention settings',g.entries,values,spec[0],g.path);});});
    }
    var paloTypes={
      'url-filtering':['web','URL filtering profile'],'custom-url-category':['web','Custom URL category'],
      'virus':['files','Antivirus profile'],'file-blocking':['files','File blocking profile'],'wildfire-analysis':['files','WildFire analysis profile'],
      'spyware':['ips','Anti-spyware profile'],'vulnerability':['ips','Vulnerability protection profile'],
      'decryption':['inspection','Decryption profile'],'data-filtering':['data','Data filtering profile'],'dns-security':['dns','DNS security profile']
    };
    function palo(){
      var groups=grouped(function(e){var p=e.key.split('/'),at=p.findIndex(function(s){return /^profiles\[/.test(s);});if(at<0)return '';var type=(p[at+1]||'').replace(/\[.*$/,'');if(!paloTypes[type]||!/^entry\[/.test(p[at+2]||''))return '';return p.slice(0,at+3).join('/');});
      groups.forEach(function(g){var parts=g.path.split('/'),kind=paloTypes[parts[parts.length-2].replace(/\[.*$/,'')],name=decodeURIComponent(g.path.match(/entry\[([^\]]*)\]$/)[1]),values=[];
        ['block','allow','alert','continue','override'].forEach(function(action){var targets=g.entries.filter(function(e){return new RegExp('/'+action+'\\[\\d+\\]/member\\[').test(e.key);}).map(function(e){return e.value;});if(targets.length)values.push(fact(readable(action)+' categories',join(targets)));});
        var rules=new Map();g.entries.forEach(function(e){var m=e.key.slice(g.path.length).match(/^\/rules\[\d+\]\/entry\[([^\]]+)\]/);if(!m)return;if(!rules.has(m[1]))rules.set(m[1],[]);rules.get(m[1]).push(e);});
        rules.forEach(function(es,key){var v=reader(es),action=v.get('action'),details=[];if(!action){var actionField=es.find(function(e){return /\/action\[\d+\]\/[^/]+/.test(e.key);});if(actionField)action=(actionField.key.match(/\/action\[\d+\]\/([^\[]+)/)||[])[1];}if(action)details.push(readable(action));[['File types','file-type'],['Applications','application'],['Direction','direction'],['Severity','severity']].forEach(function(p){var terms=es.filter(function(e){return new RegExp('/'+p[1]+'\\[\\d+\\](?:/member\\[\\d+\\])?$').test(e.key);}).map(function(e){return e.value;});if(terms.length)details.push(p[0]+': '+join(terms));});if(details.length)values.push(fact('Rule '+decodeURIComponent(key),details.join(' / ')));});
        [['Expired certificates','block-expired-certificate'],['Untrusted issuers','block-untrusted-issuer'],['Certificate status timeout','block-timeout-cert'],['Unsupported protocols','block-unsupported-version']].forEach(function(p){var value=g.read.get(p[1]);if(value)values.push(fact(p[0],state(value)==='Enabled'?'Block':state(value)==='Disabled'?'Do not block':value));});
        [['Minimum TLS version','min-version'],['Maximum TLS version','max-version']].forEach(function(p){values.push(fact(p[0],g.read.get(p[1]),'',false));});
        values.push(fact('Profile type',kind[1],'',false));add(kind[0],name,g.entries,values,kind[1],g.path);
      });
      grouped(function(e){var p=e.key.split('/'),i=p.findIndex(function(s){return /^decryption\[/.test(s);});if(i<0||!/^rules\[/.test(p[i+1]||'')||!/^entry\[/.test(p[i+2]||''))return '';return p.slice(0,i+3).join('/');}).forEach(function(g){var v=g.read,name=decodeURIComponent(g.path.match(/entry\[([^\]]+)\]$/)[1]),values=[fact('Action',readable(v.get('action'))),fact('Inspection profile',v.get('profile'),'security'),fact('Server certificate',v.get('certificate'),'certificates')];
        [['Source zones','from','zones'],['Destination zones','to','zones'],['Source addresses','source','addresses'],['Destination addresses','destination','addresses'],['URL categories','category','']].forEach(function(p){var es=g.entries.filter(function(e){return new RegExp('/'+p[1]+'\\[\\d+\\]/member\\[').test(e.key);});es.forEach(function(e,i){values.push(fact(p[0]+(es.length>1?' '+(i+1):''),e.value,p[2]));});});if(v.get('disabled'))values.push(fact('Configured state',state(v.get('disabled'))==='Enabled'?'Disabled':'Enabled'));add('inspection',name,g.entries,values,'Decryption rule',g.path);
      });
      grouped(function(e){var p=e.key.split('/'),i=p.findIndex(function(s){return /^profile-group\[/.test(s);});return i>=0&&/^entry\[/.test(p[i+1]||'')?p.slice(0,i+2).join('/'):'';}).forEach(function(g){var name=decodeURIComponent(g.path.match(/entry\[([^\]]+)\]$/)[1]),values=g.entries.filter(function(e){return e.base==='member';}).map(function(e){var type=e.key.slice(g.path.length).split('/')[1].replace(/\[.*$/,'');return fact((paloTypes[type]||[null,type])[1],e.value,'security');});values.push(fact('Profile type','Security profile group','',false));add('groups',name,g.entries,values,'Security profile group',g.path);});
      grouped(function(e){var p=e.key.split('/'),i=p.findIndex(function(s){return /^(?:application|application-group|application-filter)\[/.test(s);});return i>=0&&/^entry\[/.test(p[i+1]||'')?p.slice(0,i+2).join('/'):'';}).forEach(function(g){var type=g.path.split('/').slice(-2)[0].replace(/\[.*$/,''),name=decodeURIComponent(g.path.match(/entry\[([^\]]+)\]$/)[1]),values=[fact('Members',join(g.entries.filter(function(e){return /\/members\[\d+\]\/member\[/.test(e.key);}).map(function(e){return e.value;})),'security'),fact('Category',g.read.get('category')),fact('Subcategory',g.read.get('subcategory')),fact('Technology',g.read.get('technology')),fact('Risk',g.read.get('risk'),'',false),fact('Profile type',type==='application-group'?'Application group':type==='application-filter'?'Application filter':'Custom application','',false)];add('app',name,g.entries,values,type,g.path);});
    }
    var sophosTypes={WebFilterURLGroup:['web','URL group'],WebFilterCategory:['web','Web category'],ApplicationObject:['app','Custom application'],IPSCustomSignature:['ips','Custom IPS signature'],IPSSwitch:['ips','Intrusion prevention'],ATP:['network','Advanced threat protection'],AntiVirusFTP:['files','FTP malware scanning'],AntiVirusHTTPScanningRule:['files','HTTP malware scanning'],AntiVirusHTTPsConfiguration:['files','HTTPS malware scanning'],AntiVirusMailSMTPScanningRules:['email','SMTP malware scanning'],WebFilterPolicy:['web','Web filter policy'],WebFilterException:['web','Web filter exception'],URLGroup:['web','URL group'],WebCategory:['web','Web category'],ApplicationFilterPolicy:['app','Application filter policy'],ApplicationFilter:['app','Application filter'],Application:['app','Custom application'],FileType:['files','File type'],MalwareProtection:['files','Malware protection'],AntiVirus:['files','Antivirus'],IPSPolicy:['ips','IPS policy'],SSLTLSInspectionRule:['inspection','SSL/TLS inspection rule'],SSLTLSInspectionSettings:['inspection','SSL/TLS inspection settings'],DecryptionProfile:['inspection','Decryption profile'],SSLInspectionRule:['inspection','SSL/TLS inspection rule'],SMTPPolicy:['email','SMTP policy'],SMTPScanningPolicy:['email','SMTP scanning policy'],SMTPMalwareScanningPolicy:['email','SMTP malware scanning policy'],POPIMAPScanningPolicy:['email','POP/IMAP scanning policy'],DataControlList:['data','Data control list'],ProtectionPolicy:['webserver','Web server protection policy'],AdvancedThreatProtection:['network','Advanced threat protection'],DoSSettings:['network','Denial-of-service protection']};
    function sophos(){
      grouped(function(e){var p=e.key.split('/'),i=p.findIndex(function(s){return Object.hasOwn(sophosTypes,s.replace(/\[.*$/,''));});return i>=0?p.slice(0,i+1).join('/'):'';}).forEach(function(g){var type=g.path.split('/').pop().replace(/\[.*$/,''),spec=sophosTypes[type],v=g.read,name=v.get(['Name','PolicyName'])||spec[1],values=[];
        [['Action',['Action','DecryptAction'],''],['Source zones',['SourceZone'],'zones'],['Destination zones',['DestinationZone'],'zones'],['Source networks',['SourceNetwork'],'addresses'],['Destination networks',['DestinationNetwork'],'addresses'],['Inspection profile',['DecryptionProfile','SSLDecryptionProfile'],'security'],['Certificate',['Certificate','SigningCertificate'],'certificates'],['Web categories',['Category','CategoryName'],''],['Applications',['Application','ApplicationName'],''],['File types',['FileType','FileExtension'],''],['Exceptions',['Domain','URL','Pattern'],'']].forEach(function(p){v.all(p[1]).forEach(function(value,i){if(value)values.push(fact(p[0]+(i?' '+(i+1):''),p[0]==='Action'?readable(value):value,p[2]));});});
        [['Source zones','SourceZones/Zone','zones'],['Destination zones','DestinationZones/Zone','zones'],['Source networks','SourceNetworks/Network','addresses'],['Destination networks','DestinationNetworks/Network','addresses'],['Services','Services/Service','services']].forEach(function(p){g.entries.filter(function(e){return e.key.slice(g.path.length).replace(/\[\d+\]/g,'')==='/'+p[1];}).forEach(function(e,i){values.push(fact(p[0]+(i?' '+(i+1):''),e.value,p[2]));});});
        [['Configured state',['Status','Enable','Enabled']],['HTTPS decryption',['DecryptHTTPS']],['Malware scanning',['ScanHTTP','ScanHTTPS','ScanFTP']],['Block untrusted certificates',['BlockUntrustedCertificate']]].forEach(function(p){values.push(fact(p[0],state(v.get(p[1]))));});values.push(fact('Profile type',spec[1],'',false));add(spec[0],name,g.entries,values,spec[1],g.path);
      });
    }
    function junos(){
      var groups=new Map(),specs={'web-filtering':['web','Web filter profile'],'anti-virus':['files','Antivirus profile'],'content-filtering':['files','File filter profile'],'anti-spam':['email','Email filter profile']};
      model.entries.filter(function(e){return /^junos\//.test(e.key);}).forEach(function(e){var t=words(e.value),operation=t.shift(),i=t.findIndex(function(w){return w==='security'||w==='services';});if(i<0||!['set','deactivate','activate'].includes(operation))return;t=t.slice(i);var spec,name,rest,at;
        if(t[0]==='security'&&t[1]==='utm'&&t[2]==='feature-profile'&&specs[t[3]]&&(at=t.indexOf('profile',4))>=0){spec=specs[t[3]];name=t[at+1];rest=t.slice(at+2);}
        else if(t.slice(0,4).join(' ')==='services ssl proxy profile'){spec=['inspection','SSL proxy profile'];name=t[4];rest=t.slice(5);}
        else if(t.slice(0,3).join(' ')==='security idp idp-policy'){spec=['ips','IPS policy'];name=t[3];rest=t.slice(4);}
        else if(t.slice(0,3).join(' ')==='security application-firewall rule-sets'){spec=['app','Application control rule set'];name=t[3];rest=t.slice(4);}
        else if(t.slice(0,3).join(' ')==='security utm utm-policy'){spec=['groups','Security profile group'];name=t[3];rest=t.slice(4);}
        if(!spec||!name)return;var key=scope([e])+'|'+spec[0]+'|'+name,g=groups.get(key);if(!g){g={spec:spec,name:name,entries:[],values:[],key:key};groups.set(key,g);}g.entries.push(e);
        if(operation==='deactivate'){g.values.push(fact('Configured state','Inactive'));return;}
        var tail=rest.join(' '),m;
        if((m=tail.match(/^default(?:-rule)?\s+(\S+)/)))g.values.push(fact('Default action',readable(m[1])));
        else if((m=tail.match(/^category\s+(\S+)\s+action\s+(.+)/)))g.values.push(fact('Category '+m[1],readable(m[2])));
        else if((m=tail.match(/^(root-ca|server-certificate|trusted-ca)\s+(.+)/)))g.values.push(fact(m[1]==='server-certificate'?'Server certificate':'Certificate authority',m[2],'certificates'));
        else if((m=tail.match(/^protocol-version\s+(.+)/)))g.values.push(fact('TLS version',m[1],'',false));
        else if(/^actions ignore-server-auth-failure$/.test(tail))g.values.push(fact('Server authentication failures','Ignore'));
        else if((m=tail.match(/^(?:block-extension|block-mime)\s+(.+)/)))g.values.push(fact(tail.startsWith('block-mime')?'Blocked MIME types':'Blocked file extensions',m[1]));
        else if((m=tail.match(/^rulebase-ips rule (\S+) then action (.+)/)))g.values.push(fact('Rule '+m[1]+' action',readable(m[2])));
        else if((m=tail.match(/^rulebase-ips rule (\S+) match attacks (.+)/)))g.values.push(fact('Rule '+m[1]+' signatures',m[2].replace(/^predefined-attack-groups /,'')));
        else if((m=tail.match(/^(web-filtering|anti-virus|anti-spam|content-filtering)\s+(?:\S+\s+)?(?:\S*-profile)\s+(\S+)/))&&spec[0]==='groups')g.values.push(fact(specs[m[1]][1],m[2],'security'));
      });groups.forEach(function(g){g.values.push(fact('Profile type',g.spec[1],'',false));add(g.spec[0],g.name,g.entries,g.values,g.spec[1],g.key);});
    }
    var sonicNames={cfsPolicyName:['web','Web filter policy'],cfsProfileObjId:['web','Web filter profile'],cfsActionObjId:['web','Web filter action'],cfsUrlListObjId:['web','URL list'],appControlPolicyName:['app','Application control policy'],appRuleName:['app','Application rule']};
    function sonic(){
      native.filter(function(r){return ['security','certificates'].includes(r.category);}).forEach(function(r){var all=reader(r.fields);Object.keys(sonicNames).filter(function(k){return has(all.get(k));}).forEach(function(named){
        var spec=sonicNames[named],prefix=named.replace(/(?:Name|ObjId)$/,''),es=r.fields.filter(function(e){return e.base.startsWith(prefix)||named==='cfsActionObjId'&&e.base.startsWith('cfsAct');}),v=reader(es),values=[];
        [['Source zone','cfsPolicySrcZone','zones'],['Destination zone','cfsPolicyDstZone','zones'],['Source addresses','cfsPolicyInclusionAO','addresses'],['Excluded addresses','cfsPolicyExclusionAO','addresses'],['Web filter profile','cfsPolicyProfileObj','security'],['Action profile','cfsPolicyActionObj','security'],['Schedule','cfsPolicySchedObj','system'],['Allowed URL list','cfsProfileAllowedUrlsObj','security'],['Blocked URL list','cfsProfileForbiddenUrlsObj','security']].forEach(function(p){var value=v.get(p[1]);if(value&&!/^(?:-1|4294967295)$/.test(value))values.push(fact(p[0],value,p[2]));});
        [['HTTPS filtering','cfsProfileEnableHttpsFlting'],['Safe search','cfsProfileEnableSafeSearch'],['Policy state','cfsPolicyEnabled']].forEach(function(p){var value=v.get(p[1]);if(value)values.push(fact(p[0],state(value)));});
        values.push(fact('Profile type',spec[1],'',false));add(spec[0],all.get(named),es,values,spec[1],r.id+':'+named,r.scope);
      });});
      var settings=[
        ['web','Content filtering',[['Content filtering',['cfsEnabled','cfsEnable']]]],
        ['app','Application control',[['Application control',['appControlEnabled','appControlEnable','appFirewallEnabled']]]],
        ['files','Gateway antivirus',[['Antivirus scanning',['gavEnableScanning','gavEnabled']],['HTTP scanning',['gavEnableHTTP','gavScanHttp']],['FTP scanning',['gavEnableFTP','gavScanFtp']],['SMTP scanning',['gavEnableSMTP','gavScanSmtp']],['Excluded addresses',['gavExclusionObj'],'addresses']]],
        ['files','Sandbox analysis',[['Sandbox analysis',['gavCloudEnableSbox','captureATPEnabled','captureEnabled']]]],
        ['files','Anti-spyware scanning',[['Anti-spyware scanning',['asEnableScanning']],['HTTP scanning',['asEnableHTTP']],['FTP scanning',['asEnableFTP']]]],
        ['ips','Intrusion prevention',[['Intrusion prevention',['idpEnable','ipsEnabled']],['High priority threats',['idpPreventHighPriority']],['Medium priority threats',['idpPreventMediumPriority']],['Low priority threats',['idpPreventLowPriority']]]],
        ['inspection','Client TLS inspection',[['Client TLS inspection',['sslSpyEnabled']],['Certificate authority',['sslSpyProxyCACertName','sslSpyCert','sslSpyClientCert'],'certificates'],['Excluded addresses',['sslSpyPolObjExID','sslSpyExclusionAO'],'addresses'],['Included addresses',['sslSpyPolObjInID'],'addresses'],['Block untrusted certificates',['sslSpyCliBlkUntrust']]]],
        ['inspection','Server TLS inspection',[['Server TLS inspection',['sslSpyServerEnabled']],['Server certificate',['sslSpyServerCert'],'certificates']]],
        ['inspection','SSH inspection',[['SSH inspection',['DpiSshEnabled']]]],
        ['inspection','Certificate checks',[['Certificate filtering',['certblockEnable','certblockEnabled']],['Online certificate status checks',['EnableOcspCheck']],['OCSP responder',['OcspResponderUrl']],['Client certificate status checks',['EnableClntCertOcspCheck']],['Client OCSP responder',['ClntCertOcspResponderUrl']]]],
        ['email','Email protection',[['Email protection',['aspEnableService','aspEnable','aspEnabled']],['Reputation block list',['rblEnable','rblEnabled']],['Public mail server',['aspDstMailServerPublicAddr']],['Private mail server',['aspDstMailServerPrivateAddr']]]],
        ['network','Botnet protection',[['Botnet blocking',['botnetBlock','botnetEnabled']]]],
        ['network','Spoofing protection',[['IP spoofing checks',['ipSpoofChecking']],['MAC/IP spoofing protection',['macIpSpoofEnable','macIpSpoofEnabled']]]],
        ['network','Flood protection',[['SYN flood protection',['synFloodEnable']],['UDP flood protection',['udpFloodEnable']],['ICMP flood protection',['icmpFloodEnable']]]]
      ];
      settings.forEach(function(spec){var wanted=new Set(spec[2].flatMap(function(p){return p[1];}).map(function(k){return k.toLowerCase();})),es=model.entries.filter(function(e){return wanted.has((e.base||'').toLowerCase());}),scopes=new Map();es.forEach(function(e){var owner=owners.get(e.recordId),key=scope([e])+':'+(owner&&owner.index!=='global'?owner.id:'global');if(!scopes.has(key))scopes.set(key,[]);scopes.get(key).push(e);});scopes.forEach(function(fields,key){var v=reader(fields),values=spec[2].map(function(p){var value=v.get(p[1]);return fact(p[0],p[2]?value:state(value),p[2]);}),owner=owners.get(fields[0].recordId),iface=owner&&reader(owner.fields).get(['macIpSpoofIface','macIpv6SpoofIface']);if(iface){var port=C.resolve(model,'interfaces',iface,'',scope(fields));iface=port?port.name:iface;values.unshift(fact('Interface',iface,'interfaces'));fields=Array.from(new Set(fields.concat(owner.fields.filter(function(e){return /^(?:macIpSpoofIface|macIpv6SpoofIface)$/.test(e.base);}))));}add(spec[0],spec[1]+(iface?' / '+iface:''),fields,values,spec[1],spec[1]+':'+key);});});
    }
    if(model.meta.vendorId==='fortigate')forti();else if(model.meta.vendorId==='paloalto')palo();else if(model.meta.vendorId==='sophos')sophos();else if(model.meta.vendorId==='juniper')junos();else if(!model.meta.vendorId||model.meta.vendorId==='sonicwall')sonic();
    native.filter(function(r){return r.family==='default-security-rule';}).forEach(function(r){add('network',r.name,r.fields,[fact('Rule action',r.summary.action),fact('Configured state',r.summary.status)],'Default security rule override',r.id,r.scope);});
    // Resolve typed profile references to IDs. Different profile types can share
    // a name; ambiguous references remain text rather than pointing at a guess.
    function resolveProfile(name,context,kind){var scopes=[context].concat(model.scopeParents&&model.scopeParents[context]||[]);for(var s of scopes){var candidates=rows.filter(function(r){return r.scope===s&&r.name===name&&(!kind||r.summary.securityKind===kind);});if(candidates.length===1)return candidates[0];if(candidates.length>1)return null;}return null;}
    function kindForField(base){return {'av-profile':'Antivirus profile','webfilter-profile':'Web filter profile','application-list':'Application control profile','ips-sensor':'IPS profile','ssl-ssh-profile':'SSL/SSH inspection profile','file-filter-profile':'File filter profile','dnsfilter-profile':'DNS filter profile','emailfilter-profile':'Email filter profile','dlp-sensor':'DLP sensor','dlp-profile':'DLP profile','waf-profile':'Web application firewall profile','profile-group':'Security profile group'}[base]||'';}
    rows.forEach(function(r){var values=root.SWFeatures.facts(r);values.forEach(function(f){
      if(!['security','certificates'].includes(f.ref))return;
      var match=null;
      if(f.ref==='security'){var kind=Object.values(paloTypes).some(function(p){return p[1]===f.label;})||fortiTables.some(function(p){return p[2]===f.label;})?f.label:'';match=resolveProfile(f.value,r.scope,kind);}
      else {var candidates=native.filter(function(c){return c.category==='certificates'&&(c.name===f.value||c.id===f.value);}),scopes=[r.scope].concat(model.scopeParents&&model.scopeParents[r.scope]||[]);for(var s of scopes){var local=candidates.filter(function(c){return (c.scope||'global')===s;});if(local.length){if(local.length===1)match=local[0];break;}}}
      if(match&&match.id!==r.id){f.value=match.id;if(!r.references[f.ref])r.references[f.ref]=[];r.references[f.ref].push(match.id);}
    });r.summary.featureData=JSON.stringify(values);});
    native.filter(function(r){return r.category==='policies';}).forEach(function(policy){var links=[];policy.fields.forEach(function(e){var kind=kindForField(e.base),palo=e.key.match(/\/profile-setting\[\d+\]\/profiles\[\d+\]\/([^\[]+)\[\d+\]\/member\[/),group=/\/profile-setting\[\d+\]\/group\[\d+\]\/member\[/.test(e.key);if(palo)kind=(paloTypes[palo[1]]||[])[1]||'';if(group)kind='Security profile group';if(!kind)return;words(e.value).forEach(function(name){var match=resolveProfile(name,policy.scope,kind);if(match){links.push(match.id);if(!match.references.policies)match.references.policies=[];match.references.policies.push(policy.id);}});});if(links.length)policy.references.security=uniq(links);});
    model.records=originals.concat(rows);C.CATEGORIES.forEach(function(c){model.categories[c.id]=model.records.filter(function(r){return r.category===c.id;});});model.securitySourceIds=replaced;model.meta.securityModel='functional-1';
    // SonicWall's resolver uses the native lookup table. Only ID lookups are
    // added; native name collisions are never overwritten.
    if(model.lookup){if(!model.lookup.security)model.lookup.security=Object.create(null);rows.forEach(function(r){model.lookup.security[r.id]=r.id;});if(!model.lookup.certificates)model.lookup.certificates=Object.create(null);native.filter(function(r){return r.category==='certificates';}).forEach(function(r){model.lookup.certificates[r.id]=r.id;});}
    return model;
  }
  root.SWSecurity={enrich:enrich,sections:sections,replaces:function(model,r){return !!(model.securitySourceIds&&model.securitySourceIds.has(r.id));}};
  root.SWSecurityFactory=installSecurityFeatures.toString();
  var parse=C.parse;C.parse=function(input,options){return enrich(parse(input,options));};
})(typeof globalThis!=='undefined'?globalThis:this);

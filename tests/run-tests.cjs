const fs=require('node:fs'),{spawnSync}=require('node:child_process');
for(const file of fs.readdirSync('tests').filter(n=>n.endsWith('-tests.cjs')&&n!=='run-tests.cjs').sort()){
 const result=spawnSync(process.execPath,['tests/'+file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}

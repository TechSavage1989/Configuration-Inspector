#define NOMINMAX
#include "../webview/native_updates.h"
using namespace ci_update;
int wmain(int argc,wchar_t** argv){try{
 if(argc==4&&std::wstring(argv[1])==L"--apply-update")return ci_update::apply(full(argv[2]),utf8(argv[3]));
 if(argc==4&&(std::wstring(argv[1])==L"--update-resume"||std::wstring(argv[1])==L"--update-rollback")){
  auto p=readPlan(full(argv[2]),utf8(argv[3]));bool rollback=std::wstring(argv[1])==L"--update-rollback";
  if(!rollback&&exists(parent(p.dir)+L"\\fail-startup"))return 2;
  require(hashFile(exePath())==(rollback?p.oldHash:p.newHash),"Wrong restart executable.");
  require(decryptedWorkspace(p.dir+L"\\workspace.bin")=="{\"schema\":1,\"example\":\"TEST-CONFIG-SECRET\"}","Workspace was not preserved.");
  writeFile(p.dir+(rollback?L"\\rollback-restored":L"\\workspace-restored"),"ok");
  if(!rollback)writeFile(p.dir+L"\\healthy",p.nonce);DeleteFileW((p.dir+L"\\workspace.bin").c_str());Sleep(1500);return 0;
 }
 if(argc==3&&std::wstring(argv[1])==L"--test-host"){
  auto cache=full(argv[2]);Plan p;p.target=exePath();p.working=parent(p.target);p.nonce=nonce();p.oldHash=hashFile(p.target);p.newHash=hashFile(cache+L"\\candidate.exe");p.version="5.17.0";p.size=readFile(cache+L"\\candidate.exe",maxBinary).size();p.pid=GetCurrentProcessId();p.dir=cache+L"\\transaction-"+wide(p.nonce);directory(p.dir);
  encryptedWorkspace(p.dir+L"\\workspace.bin","{\"schema\":1,\"example\":\"TEST-CONFIG-SECRET\"}");writeFile(p.dir+L"\\plan.json",dump(planJSON(p)));writeFile(cache+L"\\transaction-path.txt",utf8(p.dir));
  wincheck(CopyFileW(p.target.c_str(),(p.dir+L"\\installer.exe").c_str(),TRUE),"Cannot prepare test helper");FileHandle helper(launch(p.dir+L"\\installer.exe",{L"--apply-update",p.dir,wide(p.nonce)},p.working,true));writeFile(cache+L"\\helper-pid",std::to_string(GetProcessId(helper.h)));
  for(int i=0;i<100;i++){if(exists(p.dir+L"\\helper-ready"))return 0;if(WaitForSingleObject(helper.h,100)==WAIT_OBJECT_0)break;}return 3;
 }
 return 4;
 }catch(const std::exception& e){OutputDebugStringA(e.what());return 5;}}

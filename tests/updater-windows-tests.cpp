#define NOMINMAX
#include "../webview/native_updates.h"
#include <iostream>
#include <filesystem>
using namespace ci_update;
unsigned checks=0;
void ok(bool b,const char* message){checks++;require(b,message);}
template<class F>void rejects(F f){bool threw=false;try{f();}catch(const Error&){threw=true;}ok(threw,"Expected update rejection.");}
int wmain(int argc,wchar_t** argv){try{
 require(argc==3,"Expected old and new update fixture paths.");auto old=full(argv[1]),fresh=full(argv[2]);wchar_t temp[32768];GetTempPathW(32768,temp);auto root=full(std::wstring(temp)+L"ci-update-tests-"+wide(nonce().substr(0,16)));directory(root);
 ok(hashText("abc")=="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad","SHA-256 implementation.");
 auto protectedFile=root+L"\\workspace.bin";encryptedWorkspace(protectedFile,"{\"secret\":\"TEST-NO-PLAINTEXT\"}");ok(readFile(protectedFile,1024*1024).find("TEST-NO-PLAINTEXT")==std::string::npos,"Workspace is encrypted on disk.");ok(decryptedWorkspace(protectedFile)=="{\"secret\":\"TEST-NO-PLAINTEXT\"}","DPAPI workspace roundtrip.");writeFile(protectedFile,"corrupt",false);rejects([&]{decryptedWorkspace(protectedFile);});
 validateExecutable(old,"5.16.0");checks++;validateExecutable(fresh,"5.17.0");checks++;rejects([&]{validateExecutable(fresh,"5.16.0");});rejects([&]{hashFile(fresh,1);});writeFile(root+L"\\bad.exe","MZbad");rejects([&]{validateExecutable(root+L"\\bad.exe","5.17.0");});rejects([&]{plainPath(root+L"\\..\\bad.exe",true);});rejects([&]{plainPath(root,true);});
 auto sourceHash=hashFile(old),newHash=hashFile(fresh);
 for(bool fail:{false,true}){
  auto dir=root+(fail?L"\\rollback case":L"\\successful case"),cache=dir+L"\\cache",target=dir+L"\\Custom Inspector & 100% \u4e2d\u6587.exe";directory(cache);wincheck(CopyFileW(old.c_str(),target.c_str(),TRUE),"Cannot copy old fixture");wincheck(CopyFileW(fresh.c_str(),(cache+L"\\candidate.exe").c_str(),TRUE),"Cannot copy new fixture");if(fail)writeFile(cache+L"\\fail-startup","yes");
  FileHandle host(launch(target,{L"--test-host",cache},dir));ok(WaitForSingleObject(host.h,15000)==WAIT_OBJECT_0,"Host closes after helper acknowledgement.");DWORD code=0;GetExitCodeProcess(host.h,&code);ok(code==0,"Host prepared update.");auto txn=wide(readFile(cache+L"\\transaction-path.txt",65536));auto p=readPlan(txn,utf8(txn.substr(txn.size()-64)));ok(p.oldHash==sourceHash&&p.newHash==newHash,"Plan preserves both hashes.");rejects([&]{readPlan(txn,std::string(64,'0'));});
  auto helperPID=std::stoul(readFile(cache+L"\\helper-pid",64));FileHandle helper(OpenProcess(SYNCHRONIZE|PROCESS_TERMINATE,FALSE,DWORD(helperPID)));if(helper.h){if(WaitForSingleObject(helper.h,120000)!=WAIT_OBJECT_0){TerminateProcess(helper.h,1);throw Error("Update helper timed out.");}}
  for(int i=0;i<50&&!exists(txn+(fail?L"\\rollback-restored":L"\\workspace-restored"));i++)Sleep(100);
  ok(exists(txn+(fail?L"\\rollback-restored":L"\\workspace-restored")),"Workspace restored after restart.");ok(!exists(txn+L"\\workspace.bin"),"Temporary workspace removed after restoration.");ok(hashFile(target)==(fail?sourceHash:newHash),"Correct executable remains at original custom path.");
  if(!fail){ok(hashFile(cache+L"\\previous.exe")==sourceHash,"Previous executable retained and verified.");ok(exists(cache+L"\\previous.json"),"Recovery metadata retained.");}
  else ok(readFile(txn+L"\\result.txt",65536).find("previous version was restored")!=std::string::npos,"Failed startup records rollback.");
 }
 // Fixtures exit shortly after reporting health. Allow file handles to close.
 Sleep(1800);std::filesystem::remove_all(root);std::cout<<checks<<" Windows updater checks passed, including real process replacement and failed-startup rollback.\n";return 0;
 }catch(const std::exception& e){std::cerr<<e.what()<<"\n";return 1;}}

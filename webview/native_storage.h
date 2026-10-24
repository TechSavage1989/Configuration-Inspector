#pragma once
#include <windows.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <shlwapi.h>
#include <string>
#include <cstring>

// Only the application-owned Profile and placement file are managed. The
// selected parent folder, imported configurations and exports are never erased.
struct InspectorStorage {
 std::wstring current,defaultFolder,notice;
 bool resetPlacement=false;
 static constexpr const wchar_t* registry=L"Software\\ConfigInspector";
 static std::wstring canonical(const std::wstring& value){
  if(value.empty()||PathIsRelativeW(value.c_str())||value.size()>32000)return L"";
  wchar_t buffer[32768]={};DWORD n=GetFullPathNameW(value.c_str(),32768,buffer,nullptr);
  if(!n||n>=32768)return L"";std::wstring p(buffer);while(p.size()>3&&p.back()==L'\\')p.pop_back();return p;
 }
 static bool equal(const std::wstring& a,const std::wstring& b){return _wcsicmp(a.c_str(),b.c_str())==0;}
 static bool inside(const std::wstring& value,const std::wstring& parent){return equal(value,parent)||(value.size()>parent.size()&&_wcsnicmp(value.c_str(),parent.c_str(),parent.size())==0&&value[parent.size()]==L'\\');}
 static std::wstring executableFolder(){wchar_t path[32768]={};GetModuleFileNameW(nullptr,path,32768);PathRemoveFileSpecW(path);return canonical(path);}
 static bool outsideExecutable(const std::wstring& value){auto exe=executableFolder();return !value.empty()&&!equal(value,exe)&&(exe.size()<=3||!inside(value,exe));}
 static std::wstring readSetting(const wchar_t* name){wchar_t value[32768]={};DWORD bytes=sizeof(value);if(RegGetValueW(HKEY_CURRENT_USER,registry,name,RRF_RT_REG_SZ,nullptr,value,&bytes)!=ERROR_SUCCESS)return L"";return value;}
 static bool writeSetting(const wchar_t* name,const std::wstring& value){HKEY key;bool ok=false;if(RegCreateKeyExW(HKEY_CURRENT_USER,registry,0,nullptr,0,KEY_SET_VALUE,nullptr,&key,nullptr)==ERROR_SUCCESS){ok=RegSetValueExW(key,name,0,REG_SZ,(const BYTE*)value.c_str(),DWORD((value.size()+1)*sizeof(wchar_t)))==ERROR_SUCCESS;RegCloseKey(key);}return ok;}
 static void removeSetting(const wchar_t* name){HKEY key;if(RegOpenKeyExW(HKEY_CURRENT_USER,registry,0,KEY_SET_VALUE,&key)==ERROR_SUCCESS){RegDeleteValueW(key,name);RegCloseKey(key);}}
 static bool exists(const std::wstring& path){return GetFileAttributesW(path.c_str())!=INVALID_FILE_ATTRIBUTES;}
 static bool plainDirectory(const std::wstring& path){DWORD attrs=GetFileAttributesW(path.c_str());return attrs!=INVALID_FILE_ATTRIBUTES&&(attrs&FILE_ATTRIBUTE_DIRECTORY)&&!(attrs&FILE_ATTRIBUTE_REPARSE_POINT);}
 static bool marker(const std::wstring& root,bool create=false){
  const char expected[]="Config Inspector app data v1\n";auto path=root+L"\\ConfigInspector.storage";
  if(exists(path)){char bytes[80]={};DWORD read=0;HANDLE h=CreateFileW(path.c_str(),GENERIC_READ,FILE_SHARE_READ,nullptr,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr);if(h==INVALID_HANDLE_VALUE)return false;bool ok=ReadFile(h,bytes,sizeof(bytes),&read,nullptr)&&read==sizeof(expected)-1&&memcmp(bytes,expected,sizeof(expected)-1)==0;CloseHandle(h);return ok;}
  if(!create)return false;HANDLE h=CreateFileW(path.c_str(),GENERIC_WRITE,FILE_SHARE_READ,nullptr,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,nullptr);if(h==INVALID_HANDLE_VALUE)return false;DWORD written=0;bool ok=WriteFile(h,expected,sizeof(expected)-1,&written,nullptr)&&written==sizeof(expected)-1;CloseHandle(h);return ok;
 }
 bool prepare(const std::wstring& root){
  if(!outsideExecutable(root))return false;int code=SHCreateDirectoryExW(nullptr,root.c_str(),nullptr);if(code!=ERROR_SUCCESS&&code!=ERROR_ALREADY_EXISTS&&code!=ERROR_FILE_EXISTS)return false;
  if(!plainDirectory(root))return false;
  if(!marker(root)&&!equal(root,defaultFolder)&&(exists(root+L"\\Profile")||exists(root+L"\\WindowPlacement.bin")))return false;
  return marker(root,true);
 }
 static bool copyTree(const std::wstring& from,const std::wstring& to,unsigned depth=0){
  if(depth>32||!plainDirectory(from))return false;int code=SHCreateDirectoryExW(nullptr,to.c_str(),nullptr);if(code!=ERROR_SUCCESS&&code!=ERROR_ALREADY_EXISTS&&code!=ERROR_FILE_EXISTS)return false;if(!plainDirectory(to))return false;
  WIN32_FIND_DATAW item;HANDLE search=FindFirstFileW((from+L"\\*").c_str(),&item);if(search==INVALID_HANDLE_VALUE)return GetLastError()==ERROR_FILE_NOT_FOUND;bool ok=true;
  do{if(wcscmp(item.cFileName,L".")==0||wcscmp(item.cFileName,L"..")==0)continue;if(item.dwFileAttributes&FILE_ATTRIBUTE_REPARSE_POINT){ok=false;break;}auto src=from+L"\\"+item.cFileName,dst=to+L"\\"+item.cFileName;
   if(item.dwFileAttributes&FILE_ATTRIBUTE_DIRECTORY){if(!copyTree(src,dst,depth+1)){ok=false;break;}}
   else if(!CopyFileW(src.c_str(),dst.c_str(),TRUE)){ok=false;break;}
  }while(FindNextFileW(search,&item));if(ok&&GetLastError()!=ERROR_NO_MORE_FILES)ok=false;FindClose(search);return ok;
 }
 static bool removeOwnedTree(const std::wstring& root,const std::wstring& path,unsigned depth=0){
  if(depth>32||!marker(root)||!inside(path,root)||equal(path,root))return false;DWORD attrs=GetFileAttributesW(path.c_str());if(attrs==INVALID_FILE_ATTRIBUTES)return true;
  if(attrs&FILE_ATTRIBUTE_REPARSE_POINT){if(attrs&FILE_ATTRIBUTE_DIRECTORY)return RemoveDirectoryW(path.c_str())!=0;return DeleteFileW(path.c_str())!=0;}
  if(!(attrs&FILE_ATTRIBUTE_DIRECTORY)){SetFileAttributesW(path.c_str(),FILE_ATTRIBUTE_NORMAL);return DeleteFileW(path.c_str())!=0;}
  WIN32_FIND_DATAW item;HANDLE search=FindFirstFileW((path+L"\\*").c_str(),&item);bool ok=true;
  if(search!=INVALID_HANDLE_VALUE){do{if(wcscmp(item.cFileName,L".")==0||wcscmp(item.cFileName,L"..")==0)continue;if(!removeOwnedTree(root,path+L"\\"+item.cFileName,depth+1))ok=false;}while(FindNextFileW(search,&item));FindClose(search);}
  if(!RemoveDirectoryW(path.c_str()))ok=false;return ok;
 }
 bool initialize(){
  PWSTR local=nullptr;if(FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData,0,nullptr,&local)))return false;defaultFolder=canonical(std::wstring(local)+L"\\ConfigInspectorWebView");CoTaskMemFree(local);
  if(!outsideExecutable(defaultFolder)){PWSTR roaming=nullptr;if(FAILED(SHGetKnownFolderPath(FOLDERID_RoamingAppData,0,nullptr,&roaming)))return false;defaultFolder=canonical(std::wstring(roaming)+L"\\ConfigInspectorData");CoTaskMemFree(roaming);}
  current=canonical(readSetting(L"DataFolder"));if(current.empty())current=defaultFolder;if(!prepare(current)){notice=L"The selected data folder is unavailable. The default app data folder is being used.";current=defaultFolder;if(!prepare(current))return false;}
  auto cleanup=canonical(readSetting(L"DeleteProfileIn"));
  if(!cleanup.empty()&&outsideExecutable(cleanup)&&marker(cleanup)){
   bool ok=removeOwnedTree(cleanup,cleanup+L"\\Profile");auto placement=cleanup+L"\\WindowPlacement.bin";if(exists(placement)&&!DeleteFileW(placement.c_str()))ok=false;removeSetting(L"WindowPlacement");if(ok)removeSetting(L"DeleteProfileIn");else notice=L"Some app data is still in use. Close other copies and reopen to finish clearing it.";
  }
  auto source=canonical(readSetting(L"DataFolderSource"));
  if(!source.empty()&&!equal(source,current)&&marker(source)&&outsideExecutable(source)){
   // Migration copies into a staging folder, so an interrupted copy can never
   // make a partial profile look like a successful migration on the next run.
   if(!exists(current+L"\\Profile")&&exists(source+L"\\Profile")){
    auto staging=current+L"\\Profile.migrating";if(exists(staging))removeOwnedTree(current,staging);
    if(!copyTree(source+L"\\Profile",staging)||!MoveFileExW(staging.c_str(),(current+L"\\Profile").c_str(),MOVEFILE_WRITE_THROUGH)){
     removeOwnedTree(current,staging);notice=L"The data folder change could not be completed. Close other copies of the app and reopen to retry. Current settings are retained.";current=source;
    }else removeSetting(L"DataFolderSource");
   }else removeSetting(L"DataFolderSource");
   if(!equal(source,current)&&!exists(current+L"\\WindowPlacement.bin"))CopyFileW((source+L"\\WindowPlacement.bin").c_str(),(current+L"\\WindowPlacement.bin").c_str(),TRUE);
  }
  return true;
 }
 std::wstring pending()const{auto p=canonical(readSetting(L"DataFolder"));return !p.empty()&&!equal(p,current)?p:L"";}
 bool select(const std::wstring& folder){auto root=canonical(folder);if(!prepare(root)){notice=L"Choose a writable app data folder outside the executable folder. Existing unrelated data will not be adopted.";return false;}
  if(!writeSetting(L"DataFolderSource",current)||!writeSetting(L"DataFolder",root)){notice=L"The app data location could not be saved.";return false;}if(equal(root,current))removeSetting(L"DataFolderSource");notice=equal(root,current)?L"The current data folder is selected.":L"The selected folder will be used next time you open the app. Existing settings are copied when the new folder has no app profile. The old folder is retained.";return true;
 }
 bool browse(HWND owner,bool& canceled){canceled=false;IFileOpenDialog* picker=nullptr;HRESULT hr=CoCreateInstance(CLSID_FileOpenDialog,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&picker));if(FAILED(hr))return false;DWORD flags=0;picker->GetOptions(&flags);picker->SetOptions(flags|FOS_PICKFOLDERS|FOS_FORCEFILESYSTEM|FOS_PATHMUSTEXIST|FOS_NOCHANGEDIR);picker->SetTitle(L"Choose a parent folder for Config Inspector app data");hr=picker->Show(owner);if(hr==HRESULT_FROM_WIN32(ERROR_CANCELLED)){canceled=true;picker->Release();return true;}std::wstring chosen;
  if(SUCCEEDED(hr)){IShellItem* item=nullptr;if(SUCCEEDED(picker->GetResult(&item))){PWSTR path=nullptr;if(SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH,&path))){chosen=path;CoTaskMemFree(path);}item->Release();}}picker->Release();if(chosen.empty())return false;
  auto root=canonical(chosen);if(!marker(root)&&!equal(root,defaultFolder))root+=L"\\ConfigInspector";return select(root);
 }
 bool loadPlacement(WINDOWPLACEMENT& p){HANDLE h=CreateFileW((current+L"\\WindowPlacement.bin").c_str(),GENERIC_READ,FILE_SHARE_READ,nullptr,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr);DWORD read=0;bool ok=false;if(h!=INVALID_HANDLE_VALUE){ok=ReadFile(h,&p,sizeof(p),&read,nullptr)&&read==sizeof(p)&&p.length==sizeof(p);CloseHandle(h);}if(ok)return true;DWORD bytes=sizeof(p);return RegGetValueW(HKEY_CURRENT_USER,registry,L"WindowPlacement",RRF_RT_REG_BINARY,nullptr,&p,&bytes)==ERROR_SUCCESS&&bytes==sizeof(p);}
 void savePlacement(const WINDOWPLACEMENT& p){if(resetPlacement)return;HANDLE h=CreateFileW((current+L"\\WindowPlacement.bin").c_str(),GENERIC_WRITE,FILE_SHARE_READ,nullptr,CREATE_ALWAYS,FILE_ATTRIBUTE_NORMAL,nullptr);if(h==INVALID_HANDLE_VALUE)return;DWORD written=0;if(WriteFile(h,&p,sizeof(p),&written,nullptr)&&written==sizeof(p))removeSetting(L"WindowPlacement");CloseHandle(h);}
 bool clearPlacement(){resetPlacement=true;removeSetting(L"WindowPlacement");auto file=current+L"\\WindowPlacement.bin";return !exists(file)||DeleteFileW(file.c_str())!=0;}
 bool queueProfileCleanup(){return writeSetting(L"DeleteProfileIn",current);}
};

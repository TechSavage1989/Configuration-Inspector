// Verify the built EXE contains every exact ICO frame and Windows can select it.
#include <windows.h>
#include <fstream>
#include <iostream>
#include <iterator>
#include <vector>
#include <cstring>
#include <stdexcept>
static int checks=0;
static void ok(bool v){++checks;if(!v)throw std::runtime_error("Icon check failed "+std::to_string(checks));}
static unsigned u16(const unsigned char* p){return p[0]|(p[1]<<8);}
static unsigned u32(const unsigned char* p){return u16(p)|(u16(p+2)<<16);}
int wmain(int argc,wchar_t** argv){try{
 ok(argc==3);std::ifstream file(argv[2],std::ios::binary);std::vector<unsigned char> ico((std::istreambuf_iterator<char>(file)),{});
 ok(ico.size()>6);auto count=u16(ico.data()+4);ok(count==9&&ico.size()>=6+16*count);
 HMODULE module=LoadLibraryExW(argv[1],nullptr,LOAD_LIBRARY_AS_DATAFILE|LOAD_LIBRARY_AS_IMAGE_RESOURCE);ok(module!=nullptr);
 HRSRC resource=FindResourceW(module,MAKEINTRESOURCEW(1),RT_GROUP_ICON);ok(resource!=nullptr);auto group=(const unsigned char*)LockResource(LoadResource(module,resource));ok(group&&SizeofResource(module,resource)==6+14*count);ok(u16(group+4)==count);
 for(unsigned i=0;i<count;i++){
  auto entry=ico.data()+6+16*i;auto compiled=group+6+14*i;auto length=u32(entry+8),offset=u32(entry+12);ok(offset<=ico.size()&&length<=ico.size()-offset);ok(std::memcmp(entry,compiled,12)==0);
  auto frame=FindResourceW(module,MAKEINTRESOURCEW(u16(compiled+12)),RT_ICON);ok(frame&&SizeofResource(module,frame)==length);ok(std::memcmp(LockResource(LoadResource(module,frame)),ico.data()+offset,length)==0);
 }
 for(int size:{16,20,24,32,40,48,64,128,256}){
  HICON icon=(HICON)LoadImageW(module,MAKEINTRESOURCEW(1),IMAGE_ICON,size,size,0);ok(icon!=nullptr);ICONINFO info={};ok(GetIconInfo(icon,&info)!=FALSE);BITMAP bitmap={};ok(GetObjectW(info.hbmColor,sizeof(bitmap),&bitmap)==sizeof(bitmap));ok(bitmap.bmWidth==size&&bitmap.bmHeight==size);DeleteObject(info.hbmColor);DeleteObject(info.hbmMask);DestroyIcon(icon);
 }
 FreeLibrary(module);std::cout<<checks<<" compiled icon resource checks passed\n";return 0;
}catch(const std::exception& e){std::cerr<<e.what()<<"\n";return 1;}}

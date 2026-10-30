#include "../webview/update_protocol.h"
#include <iostream>
#include <functional>
using namespace ci_update;
int checks=0;
void ok(bool b){++checks;if(!b)throw Error("Test failed at check "+std::to_string(checks));}
void rejects(const std::function<void()>& f){bool threw=false;try{f();}catch(const Error&){threw=true;}ok(threw);}
Json fixture(){Json a=Json::obj();a.fields={{"name",Json(assetName)},{"browser_download_url",Json(std::string(repositoryURL)+"/releases/download/v5.17.0/Config_Inspector.exe")},{"size",Json::num(2000000)},{"digest",Json("sha256:"+std::string(64,'a'))}};Json list=Json::list();list.items={a};Json j=Json::obj();j.fields={{"tag_name",Json("v5.17.0")},{"draft",Json(false)},{"prerelease",Json(false)},{"body",Json("Example notes")},{"assets",list}};return j;}
int main(){try{
 UpdateMenuGate menu;ok(!menu.request());ok(!menu.request());ok(menu.ready());ok(!menu.ready());ok(menu.request());ok(menu.request());
 ok(parse(updateMenuMessage).at("type").str()=="config-inspector-update-open");
 ok(updateCheckInterval==120);

 ok(newer("5.17.0","5.16.99"));ok(!newer("5.16.0","5.16.0"));ok(newer("10.0.0","9.99.99"));ok(!newer("5.9.0","5.10.0"));
 for(auto s:{"","v5.16.0","5.16","5.16.0.0","5.16.0-beta","05.16.0","5.-1.0","65536.0.0","5.16.0 ","5.16.0\n","5.16.+1"})rejects([&]{version(s);});
 ok(version("65535.0.0")[0]==65535);ok(parse("{\"x\":[true,false,null,1,-1,1.5,1e3]}").at("x").items.size()==7);
 for(auto s:{"", "{", "[", "{\"x\":1,\"x\":2}", "{\"x\":01}","true false","{\"x\":NaN}","[1,]","{\"x\":1,}","\"\\ud800\"","\"\\udc00\"","\"\\u000g\"","\"\\x00\"","\"\n\"","1.","1e", "--1"})rejects([&]{parse(s);});
 ok(parse("\"\\ud83d\\ude80\"").str()=="\xf0\x9f\x9a\x80");ok(parse(quote("a\n\"\\")).str()=="a\n\"\\");
 for(auto s:{std::string("\"\xc0\xaf\""),std::string("\"\xed\xa0\x80\""),std::string("\"\xf4\x90\x80\x80\"")})rejects([&]{parse(s);});
 rejects([]{parse(std::string(70,'[')+std::string(70,']'));});rejects([]{parse("null",3);});rejects([]{parse("-1").integer();});rejects([]{parse("1.0").integer();});rejects([]{parse("18446744073709551615").integer();});
 ok(digest(std::string(64,'a')));ok(!digest(std::string(64,'A')));ok(!digest(std::string(63,'a')));
 for(auto host:{"api.github.com","github.com","release-assets.githubusercontent.com","objects.githubusercontent.com"})ok(safeURL(std::string("https://")+host+"/example?a=1&b=2"));
 for(auto s:{"http://github.com/x","https://evil.example/x","https://github.com.evil.example/x","https://github.com@evil.example/x","https://evil@github.com/x","https://github.com:443/x","https://github.com/x#fragment","https://github.com\\evil/x","https://github.com/x\r\nCookie:secret","file:///x","https://github.com"})ok(!safeURL(s));
 auto j=fixture();auto r=release(dump(j));ok(r.version=="5.17.0"&&r.size==2000000&&r.sha256==std::string(64,'a'));
 // Portable archives/checksums must never become updater payloads, even first.
 {auto x=j;Json zip=Json::obj();zip.fields={{"name",Json("Config_Inspector_Portable.zip")}};
 x.fields["assets"].items.insert(x.fields["assets"].items.begin(),zip);
 Json checksum=Json::obj();checksum.fields={{"name",Json("Config_Inspector_Portable.zip.sha256")}};
 x.fields["assets"].items.push_back(checksum);
 auto selected=release(dump(x));ok(selected.url==r.url&&selected.sha256==r.sha256&&selected.size==r.size);
 x.fields["assets"].items.erase(x.fields["assets"].items.begin()+1);rejects([&]{release(dump(x));});}
 for(auto key:{"draft","prerelease"}){auto x=j;x.fields[key]=Json(true);rejects([&]{release(dump(x));});}
 for(auto tag:{"5.17.0","v5.17.0-beta","v5.17.0/../v5.16.0"}){auto x=j;x.fields["tag_name"]=Json(tag);rejects([&]{release(dump(x));});}
 for(auto url:{"https://github.com/other/repo/releases/download/v5.17.0/Config_Inspector.exe","https://evil.example/Config_Inspector.exe","https://github.com/TechSavage1989/Configuration-Inspector/releases/download/v5.16.0/Config_Inspector.exe"}){auto x=j;x.fields["assets"].items[0].fields["browser_download_url"]=Json(url);rejects([&]{release(dump(x));});}
 for(auto size:{uint64_t(0),uint64_t(65535),maxBinary+1}){auto x=j;x.fields["assets"].items[0].fields["size"]=Json::num(size);rejects([&]{release(dump(x));});}
 for(auto hash:{"", "sha256:abc", "md5:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}){auto x=j;x.fields["assets"].items[0].fields["digest"]=Json(hash);rejects([&]{release(dump(x));});}
 {auto x=j;x.fields["assets"].items.push_back(x.fields["assets"].items[0]);rejects([&]{release(dump(x));});}
 {auto x=j;x.fields["assets"].items.clear();rejects([&]{release(dump(x));});}
 {auto x=j;x.fields["body"]=Json(std::string(20000,'x'));ok(release(dump(x)).notes.size()==16000);}
 ok(windowsArgument("C:\\Apps & Files\\Inspector.exe")=="\"C:\\Apps & Files\\Inspector.exe\"");ok(windowsArgument("C:\\folder\\")=="\"C:\\folder\\\\\"");ok(windowsArgument("a\"b")=="\"a\\\"b\"");
 std::cout<<checks<<" update protocol checks passed\n";return 0;
 }catch(const std::exception& e){std::cerr<<e.what()<<"\n";return 1;}}

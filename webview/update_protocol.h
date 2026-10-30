#pragma once
// Small, bounded JSON reader used only for release metadata and update plans.
// Independent of Windows so malformed-feed tests run on every development host.
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

namespace ci_update {
inline constexpr const char* repository="TechSavage1989/Configuration-Inspector";
inline constexpr const char* repositoryURL="https://github.com/TechSavage1989/Configuration-Inspector";
inline constexpr const char* feedURL="https://api.github.com/repos/TechSavage1989/Configuration-Inspector/releases/latest";
inline constexpr const char* assetName="Config_Inspector.exe";
inline constexpr uint64_t maxBinary=64ull*1024*1024;
inline constexpr uint64_t maxWorkspace=96ull*1024*1024;

// Native Help menu requests do not depend on a currently rendered DOM button.
inline constexpr const char* updateMenuMessage=R"({"type":"config-inspector-update-open"})";
struct UpdateMenuGate {
 bool uiReady=false,pending=false;
 bool flush(){if(!uiReady||!pending)return false;pending=false;return true;}
 bool request(){pending=true;return flush();}
 bool ready(){uiReady=true;return flush();}
};
inline constexpr uint64_t updateCheckInterval=2*60;


struct Error:std::runtime_error { using std::runtime_error::runtime_error; };
inline void require(bool ok,const char* message){if(!ok)throw Error(message);}
struct Json {
 enum Kind {null,boolean,number,string,array,object} kind=null;
 std::string text;bool flag=false;std::vector<Json> items;std::map<std::string,Json> fields;
 Json()=default;explicit Json(std::string s):kind(string),text(std::move(s)){}
 explicit Json(const char* s):Json(std::string(s)){} explicit Json(bool b):kind(boolean),flag(b){}
 static Json num(uint64_t n){Json j;j.kind=number;j.text=std::to_string(n);return j;}
 static Json obj(){Json j;j.kind=object;return j;} static Json list(){Json j;j.kind=array;return j;}
 const Json& at(const std::string& key)const{auto i=fields.find(key);require(kind==object&&i!=fields.end(),"Required update metadata is missing.");return i->second;}
 const Json* find(const std::string& key)const{auto i=fields.find(key);return kind==object&&i!=fields.end()?&i->second:nullptr;}
 std::string str()const{require(kind==string,"Invalid text in update metadata.");return text;}
 bool bit()const{require(kind==boolean,"Invalid flag in update metadata.");return flag;}
 uint64_t integer()const{require(kind==number&&!text.empty()&&text.find_first_not_of("0123456789")==std::string::npos&&text.size()<20,"Invalid size in update metadata.");uint64_t n=0;for(char c:text){require(n<=(UINT64_MAX-(c-'0'))/10,"Invalid number.");n=n*10+(c-'0');}return n;}
};
inline std::string quote(const std::string& s){std::string out="\"";const char* h="0123456789abcdef";for(unsigned char c:s){if(c=='"'||c=='\\'){out+='\\';out+=char(c);}else if(c<32){out+="\\u00";out+=h[c>>4];out+=h[c&15];}else out+=char(c);}return out+'"';}
inline std::string dump(const Json& j){switch(j.kind){case Json::null:return "null";case Json::boolean:return j.flag?"true":"false";case Json::number:return j.text;case Json::string:return quote(j.text);case Json::array:{std::string s="[";for(auto& v:j.items){if(s.size()>1)s+=',';s+=dump(v);}return s+"]";}case Json::object:{std::string s="{";for(auto& p:j.fields){if(s.size()>1)s+=',';s+=quote(p.first)+":"+dump(p.second);}return s+"}";}}throw Error("Invalid JSON.");}
class JsonReader {
 const std::string& s;size_t p=0,nodes=0;
 void ws(){while(p<s.size()&&(s[p]==' '||s[p]=='\n'||s[p]=='\r'||s[p]=='\t'))p++;}
 char take(){require(p<s.size(),"Incomplete update metadata.");return s[p++];}
 unsigned hex4(){unsigned v=0;for(int i=0;i<4;i++){char c=take();int h=c>='0'&&c<='9'?c-'0':c>='a'&&c<='f'?c-'a'+10:c>='A'&&c<='F'?c-'A'+10:-1;require(h>=0,"Invalid JSON escape.");v=v*16+h;}return v;}
 void utf8(std::string& out,unsigned c){if(c<128)out+=char(c);else if(c<2048){out+=char(192|(c>>6));out+=char(128|(c&63));}else if(c<65536){out+=char(224|(c>>12));out+=char(128|((c>>6)&63));out+=char(128|(c&63));}else{out+=char(240|(c>>18));out+=char(128|((c>>12)&63));out+=char(128|((c>>6)&63));out+=char(128|(c&63));}}
 std::string stringValue(){require(take()=='"',"Invalid JSON string.");std::string out;while(true){unsigned char c=take();if(c=='"')return out;require(c>=32,"Invalid JSON string.");if(c=='\\'){char e=take();switch(e){case '"':case '\\':case '/':out+=e;break;case 'b':out+='\b';break;case 'f':out+='\f';break;case 'n':out+='\n';break;case 'r':out+='\r';break;case 't':out+='\t';break;case 'u':{unsigned v=hex4();if(v>=0xd800&&v<=0xdbff){require(take()=='\\'&&take()=='u',"Invalid Unicode pair.");unsigned low=hex4();require(low>=0xdc00&&low<=0xdfff,"Invalid Unicode pair.");v=0x10000+((v-0xd800)<<10)+(low-0xdc00);}else require(v<0xdc00||v>0xdfff,"Invalid Unicode pair.");utf8(out,v);break;}default:throw Error("Invalid JSON escape.");}}else if(c<128)out+=char(c);else {unsigned count=c>=0xc2&&c<=0xdf?1:c>=0xe0&&c<=0xef?2:c>=0xf0&&c<=0xf4?3:0;require(count>0,"Invalid UTF-8.");unsigned value=c&((1<<(6-count))-1);std::string bytes(1,char(c));for(unsigned i=0;i<count;i++){unsigned char d=take();require((d&192)==128,"Invalid UTF-8.");value=(value<<6)|(d&63);bytes+=char(d);}require((count!=1||value>=128)&&(count!=2||value>=2048)&&(count!=3||value>=65536)&&value<=0x10ffff&&(value<0xd800||value>0xdfff),"Invalid UTF-8.");out+=bytes;}}}
 Json value(unsigned depth){require(depth<=64&&++nodes<=3000000,"Update metadata is too complex.");ws();char c=p<s.size()?s[p]:0;
  if(c=='"')return Json(stringValue());
  if(c=='{'||c=='['){p++;bool object=c=='{';Json j=object?Json::obj():Json::list();ws();if(p<s.size()&&s[p]==(object?'}':']')){p++;return j;}while(true){ws();std::string key;if(object){key=stringValue();ws();require(take()==':',"Invalid JSON object.");}auto v=value(depth+1);if(object)require(j.fields.emplace(key,std::move(v)).second,"Duplicate update metadata key.");else j.items.push_back(std::move(v));ws();char end=take();if(end==(object?'}':']'))return j;require(end==',',"Invalid JSON separator.");}}
  for(auto literal:{"true","false","null"}){std::string t=literal;if(s.compare(p,t.size(),t)==0){p+=t.size();return t=="null"?Json():Json(t=="true");}}
  size_t begin=p;if(c=='-')p++;require(p<s.size()&&s[p]>='0'&&s[p]<='9',"Invalid JSON number.");if(s[p]=='0')p++;else while(p<s.size()&&s[p]>='0'&&s[p]<='9')p++;
  if(p<s.size()&&s[p]=='.'){p++;size_t b=p;while(p<s.size()&&s[p]>='0'&&s[p]<='9')p++;require(p>b,"Invalid JSON number.");}
  if(p<s.size()&&(s[p]=='e'||s[p]=='E')){p++;if(p<s.size()&&(s[p]=='+'||s[p]=='-'))p++;size_t b=p;while(p<s.size()&&s[p]>='0'&&s[p]<='9')p++;require(p>b,"Invalid JSON number.");}
  Json j;j.kind=Json::number;j.text=s.substr(begin,p-begin);return j;
 }
 public:explicit JsonReader(const std::string& input):s(input){} Json read(){auto j=value(0);ws();require(p==s.size(),"Trailing update metadata.");return j;}
};
inline Json parse(const std::string& s,size_t limit=2*1024*1024){require(s.size()<=limit,"Update metadata exceeds its size limit.");return JsonReader(s).read();}
inline std::array<unsigned,3> version(const std::string& s){std::array<unsigned,3> v{};size_t p=0;for(int i=0;i<3;i++){size_t start=p;while(p<s.size()&&s[p]>='0'&&s[p]<='9'){require(p-start<5,"Invalid update version.");v[i]=v[i]*10+(s[p++]-'0');}require(p>start&&v[i]<=65535&&(p-start==1||s[start]!='0'),"Invalid update version.");if(i<2)require(p<s.size()&&s[p++]=='.',"Invalid update version.");}require(p==s.size(),"Invalid update version.");return v;}
inline bool newer(const std::string& a,const std::string& b){return version(a)>version(b);}
inline bool digest(const std::string& s){return s.size()==64&&s.find_first_not_of("0123456789abcdef")==std::string::npos;}
inline bool safeURL(const std::string& s){
 if(s.compare(0,8,"https://")!=0||s.find_first_of("\r\n\t\\ #")!=std::string::npos)return false;
 size_t p=s.find('/',8);if(p==std::string::npos)return false;auto host=s.substr(8,p-8);
 return host=="api.github.com"||host=="github.com"||host=="release-assets.githubusercontent.com"||host=="objects.githubusercontent.com";
}
struct Release {std::string version,url,sha256,notes;uint64_t size=0;};
inline Release release(const std::string& data){auto j=parse(data);require(!j.at("draft").bit()&&!j.at("prerelease").bit(),"The update feed did not return a stable release.");auto tag=j.at("tag_name").str();require(tag.size()>1&&tag[0]=='v',"Invalid release tag.");Release r;r.version=tag.substr(1);version(r.version);if(auto b=j.find("body")){if(b->kind!=Json::null)r.notes=b->str().substr(0,16000);}auto& assets=j.at("assets");require(assets.kind==Json::array,"Invalid release assets.");
 for(auto& a:assets.items){if(a.at("name").str()!=assetName)continue;require(r.url.empty(),"Duplicate update executable.");r.url=a.at("browser_download_url").str();require(r.url==std::string(repositoryURL)+"/releases/download/"+tag+"/"+assetName,"The update URL does not belong to the official repository.");r.size=a.at("size").integer();require(r.size>=65536&&r.size<=maxBinary,"Invalid update executable size.");auto h=a.at("digest").str();require(h.compare(0,7,"sha256:")==0&&digest(h.substr(7)),"The release is missing its GitHub SHA-256 digest.");r.sha256=h.substr(7);}
 require(!r.url.empty(),"This release has no Windows x64 update executable.");return r;
}
inline std::string windowsArgument(const std::string& arg){std::string out="\"";unsigned slashes=0;for(char c:arg){if(c=='\\'){slashes++;continue;}if(c=='"')out.append(slashes*2+1,'\\');else out.append(slashes,'\\');slashes=0;out+=c;}out.append(slashes*2,'\\');return out+'"';}
}

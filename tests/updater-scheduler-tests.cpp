#define NOMINMAX
#include "../webview/native_updates.h"
#include <filesystem>
#include <iostream>
using namespace ci_update;
unsigned checks=0;
void ok(bool value,const char* message){++checks;require(value,message);}
std::string feed(const std::string& v){
 Json a=Json::obj();a.fields={{"name",Json(assetName)},{"browser_download_url",Json(std::string(repositoryURL)+"/releases/download/v"+v+"/Config_Inspector.exe")},{"size",Json::num(2000000)},{"digest",Json("sha256:"+std::string(64,'a'))}};
 Json list=Json::list();list.items={a};Json j=Json::obj();j.fields={{"tag_name",Json("v"+v)},{"draft",Json(false)},{"prerelease",Json(false)},{"body",Json("Synthetic scheduler test")},{"assets",list}};return dump(j);
}
struct Harness {
 std::atomic<uint64_t> time{1000};std::atomic<unsigned> requests{0},errors{0};std::atomic<bool> blocked{false};
 std::mutex mutex;std::map<std::wstring,uint64_t> preferences;std::string response=feed("99.0.0");Json last;
 UpdateServices services(){UpdateServices s;
  s.clock=[this]{return time.load();};
  s.read=[this](const wchar_t* key,uint64_t fallback){std::lock_guard<std::mutex> lock(mutex);auto it=preferences.find(key);return it==preferences.end()?fallback:it->second;};
  s.save=[this](const wchar_t* key,uint64_t value){std::lock_guard<std::mutex> lock(mutex);preferences[key]=value;};
  s.feed=[this](std::atomic<bool>& stop){++requests;while(blocked&&!stop)Sleep(1);require(!stop,"Cancelled scheduler test.");if(errors){--errors;throw Error("Synthetic offline failure");}std::lock_guard<std::mutex> lock(mutex);return response;};return s;
 }
 void receive(std::string value){std::lock_guard<std::mutex> lock(mutex);last=parse(value);}
 Json status(Updater& u){u.status();std::lock_guard<std::mutex> lock(mutex);return last;}
 Json settled(Updater& u){for(unsigned i=0;u.active()&&i<5000;++i)Sleep(1);ok(!u.active(),"Updater worker completes within the test deadline.");return status(u);}
 void nextFeed(const std::string& v){std::lock_guard<std::mutex> lock(mutex);response=feed(v);}
};
int wmain(){std::wstring root;try{
 wchar_t temp[32768];GetTempPathW(32768,temp);root=full(std::wstring(temp)+L"ci-scheduler-tests-"+wide(nonce().substr(0,16)));directory(root);
 ok(updateVersionKey("99.0.0")!=updateVersionKey("99.0.1"),"Snooze identities distinguish patch versions.");
 ok(updateVersionKey("1.2.3")!=updateVersionKey("1.3.2"),"Snooze identity is not a lossy sum.");
 {
  Harness h;Updater u(root,[&](std::string s){h.receive(std::move(s));},h.services());
  h.time=1100;u.tick();ok(h.requests==0,"Startup never checks before the UI-ready handshake.");
  u.ready();ok(h.status(u).at("nextCheck").integer()==1115,"First check is scheduled from UI readiness, not process construction.");
  h.time=1101;u.ready();ok(h.status(u).at("nextCheck").integer()==1115,"Repeated UI-ready does not postpone detection.");
  h.time=1114;u.tick();ok(h.requests==0,"Startup delay is honored.");
  h.time=1115;u.tick();auto v=h.settled(u);ok(h.requests==1,"Startup performs an automatic feed request without manual check.");
  ok(v.at("state").str()=="available"&&v.at("available").bit()&&!v.at("snoozed").bit(),"Startup publishes an unsolicited available-update notice.");
  ok(v.at("lastCheck").integer()==1115&&v.at("nextCheck").integer()==1415,"A successful automatic check schedules five-minute polling.");
  h.time=1414;u.tick();ok(h.requests==1,"No request before the five-minute deadline.");
  h.time=1415;u.tick();v=h.settled(u);ok(h.requests==2,"A running app discovers releases on the next poll.");
  u.later();ok(h.status(u).at("snoozed").bit(),"Later suppresses the current release.");
  h.time=v.at("nextCheck").integer();u.tick();v=h.settled(u);ok(v.at("snoozed").bit(),"Repeated checks preserve a reminder for the same release.");
  h.nextFeed("99.0.1");h.time=v.at("nextCheck").integer();u.tick();v=h.settled(u);
  ok(v.at("version").str()=="99.0.1"&&!v.at("snoozed").bit(),"A newer release is not hidden by an older release's Later choice.");
  u.later();ok(h.status(u).at("snoozed").bit(),"The new release can independently be deferred.");
  u.setAutomatic(false);auto before=h.requests.load();h.time+=24*60*60;u.tick();v=h.status(u);
  ok(h.requests==before&&!v.at("automatic").bit()&&v.at("nextCheck").integer()==0,"Disabled automatic checks stay disabled.");
  ok(!v.at("snoozed").bit(),"Timer expiry publishes the notice without waiting for a network check.");
  u.later();u.check();v=h.settled(u);ok(h.requests==before+1&&!v.at("snoozed").bit()&&!v.at("automatic").bit(),"Manual checks clear Later without enabling automatic checks.");
  h.nextFeed(CI_VERSION);u.check();v=h.settled(u);ok(v.at("state").str()=="current"&&!v.at("available").bit(),"An installed current version does not advertise itself.");
  h.nextFeed("99.0.1");u.setAutomatic(true);h.errors=1;h.time+=15;u.tick();v=h.settled(u);
  ok(v.at("state").str()=="error"&&v.at("error").bit(),"Automatic network errors are reported in status.");
  ok(v.at("nextCheck").integer()==h.time+30,"An initial transient error retries after thirty seconds.");
  h.time+=30;u.tick();v=h.settled(u);ok(v.at("available").bit()&&!v.at("error").bit(),"Automatic retry recovers without user interaction.");
  h.blocked=true;h.time=v.at("nextCheck").integer();auto prior=h.requests.load();u.tick();
  for(unsigned i=0;h.requests==prior&&i<5000;++i)Sleep(1);
  auto inFlight=h.requests.load();ok(inFlight==prior+1,"The held request reaches the feed boundary.");u.tick();u.check();ok(u.active()&&h.requests==inFlight,"Repeated timer/manual requests do not overlap an active worker.");
  h.blocked=false;h.settled(u);
  u.later();u.setAutomatic(false);
  {Updater reopened(root,[&](std::string s){h.receive(std::move(s));},h.services());reopened.ready();h.time+=1000;reopened.tick();ok(h.requests==inFlight,"Reopening preserves automatic-check disable preference.");reopened.check();v=h.settled(reopened);ok(!v.at("snoozed").bit(),"A reopened manual check clears the saved reminder.");}
 }
 {
  Harness h;h.preferences[L"UpdateSnoozeUntil"]=999999;h.preferences[L"UpdateSnoozeVersion"]=updateVersionKey("99.0.0");
  Updater u(root,[&](std::string s){h.receive(std::move(s));},h.services());u.ready();h.time+=15;u.tick();auto v=h.settled(u);
  ok(v.at("snoozed").bit(),"A saved release-specific Later choice survives reopening.");
  h.nextFeed("99.0.1");h.time=v.at("nextCheck").integer();u.tick();v=h.settled(u);
  ok(!v.at("snoozed").bit(),"Reopened polling still reveals a subsequent newer release.");
 }
 {
  Harness h;h.preferences[L"UpdateSnoozeUntil"]=999999; // Legacy global delay has no known release identity.
  Updater u(root,[&](std::string s){h.receive(std::move(s));},h.services());u.ready();h.time+=15;u.tick();auto v=h.settled(u);
  ok(!v.at("snoozed").bit(),"An unscoped legacy delay cannot conceal an unrelated newer release.");
  u.later();u.reset();v=h.status(u);ok(v.at("automatic").bit()&&!v.at("available").bit()&&!v.at("snoozed").bit(),"Reset clears notification state and restores the default preference.");
 }
 std::filesystem::remove_all(root);std::cout<<checks<<" native updater scheduling checks passed (real Updater; isolated clock/feed/preferences).\n";return 0;
 }catch(const std::exception& e){std::cerr<<e.what()<<"\n";return 1;}}

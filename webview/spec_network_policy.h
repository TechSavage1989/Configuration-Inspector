#pragma once
#include <string>
// Read-only catalog endpoints. No configuration data or device identifiers are
// sent: requests contain a manufacturer directory or an immutable catalog SHA.
inline bool allowSpecificationRequest(const std::wstring& uri,const std::wstring& method){
 if(method!=L"GET")return false;
 const std::wstring base=L"https://api.github.com/repos/netbox-community/devicetype-library/";
 if(uri.compare(0,base.size(),base)!=0)return false;
 const auto path=uri.substr(base.size());
 if(path==L"contents/device-types")return true;
 std::wstring sha;
 if(path.compare(0,10,L"git/trees/")==0)sha=path.substr(10);
 else if(path.compare(0,10,L"git/blobs/")==0)sha=path.substr(10);
 else return false;
 if(sha.size()!=40)return false;
 for(auto c:sha)if(!((c>=L'0'&&c<=L'9')||(c>=L'a'&&c<=L'f')))return false;
 return true;
}

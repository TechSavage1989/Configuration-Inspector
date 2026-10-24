#include <cassert>
#include <iostream>
#include "../webview/spec_network_policy.h"
int main(){
 const std::wstring base=L"https://api.github.com/repos/netbox-community/devicetype-library/",sha(40,L'a');
 assert(allowSpecificationRequest(base+L"contents/device-types",L"GET"));
 assert(allowSpecificationRequest(base+L"git/trees/"+sha,L"GET"));
 assert(allowSpecificationRequest(base+L"git/blobs/"+sha,L"GET"));
 for(auto path:{L"git/trees/master",L"contents/device-types/Fortinet",L"../another-repository",L"contents/device-types?data=example",L"contents/device-types#fragment"})assert(!allowSpecificationRequest(base+path,L"GET"));
 for(auto method:{L"POST",L"PUT",L"DELETE",L"PATCH",L"OPTIONS",L"HEAD"})assert(!allowSpecificationRequest(base+L"contents/device-types",method));
 assert(!allowSpecificationRequest(base+L"git/blobs/"+sha+L"?upload=config",L"GET"));
 assert(!allowSpecificationRequest(base+L"git/blobs/"+sha+L"/extra",L"GET"));
 assert(!allowSpecificationRequest(L"https://api.github.com.evil.example/repos/netbox-community/devicetype-library/contents/device-types",L"GET"));
 assert(!allowSpecificationRequest(L"https://user@api.github.com/repos/netbox-community/devicetype-library/contents/device-types",L"GET"));
 assert(!allowSpecificationRequest(L"http://api.github.com/repos/netbox-community/devicetype-library/contents/device-types",L"GET"));
 std::cout<<"Native catalog request policy checks passed\n";
}

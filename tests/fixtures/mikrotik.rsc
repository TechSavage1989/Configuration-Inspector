# 2026-01-01 12:00:00 by RouterOS 7.20.6
# model = CRS326-24S+2Q+RM
# serial number = EXAMPLE-SYNTHETIC
/system identity
set name="Example MikroTik"
/interface ethernet
set [ find default-name=ether1 ] name=management
set [ find default-name=sfp-sfpplus1 ] comment="Fiber uplink" auto-negotiation=no speed=10G-baseSR-LR
set [ find default-name=sfp-sfpplus2 ] disabled=yes
/interface bridge
add name=core vlan-filtering=yes protocol-mode=rstp
add name=guest vlan-filtering=no
/interface bridge port
add bridge=core interface=sfp-sfpplus1 pvid=10 frame-types=admit-all ingress-filtering=yes
add bridge=core interface=management pvid=10 frame-types=admit-only-untagged-and-priority-tagged
add bridge=core interface=sfp-sfpplus2 disabled=yes pvid=20
/interface bridge vlan
add bridge=core vlan-ids=10 tagged=core untagged=management
add bridge=core vlan-ids=20 tagged=core,sfp-sfpplus1
/interface vlan
add name="Staff VLAN" interface=core vlan-id=10
add name="Guest VLAN" interface=core vlan-id=20
/interface bonding
add name=bond-uplink mode=802.3ad slaves=ether2,ether3
/interface list
add name=WAN
add name=LAN
/interface list member
add list=WAN interface=sfp-sfpplus1
add list=LAN interface=core
/ip address
add address=192.0.2.1/24 interface=management
add address=10.10.10.1/24 interface="Staff VLAN"
add address=10.10.20.1/24 interface="Guest VLAN"
add address=10.99.1.1/24 interface=management disabled=yes
/ipv6 address
add address=2001:db8:10::1/64 interface="Staff VLAN"
/ip pool
add name=staff ranges=10.10.10.100-10.10.10.199
/ip dhcp-server
add name=staff-dhcp interface="Staff VLAN" address-pool=staff lease-time=8h
/ip dhcp-server network
add address=10.10.10.0/24 gateway=10.10.10.1 dns-server=192.0.2.53,192.0.2.54 domain=example.test
/ip dhcp-server lease
add address=10.10.10.25 mac-address=02:00:00:00:00:25 server=staff-dhcp comment=Printer
/ip dhcp-client
add interface=sfp-sfpplus1 use-peer-dns=no add-default-route=no default-route-distance=7
/ip dhcp-relay
add name=guest-relay interface="Guest VLAN" dhcp-server=192.0.2.67 local-address=10.10.20.1
/ip dns
set servers=192.0.2.53,192.0.2.54 allow-remote-requests=yes
/ip dns static
add name=printer.example.test address=10.10.10.25 type=A
add name=alias.example.test cname=printer.example.test type=CNAME
/ip route
add dst-address=0.0.0.0/0 gateway=192.0.2.254 distance=1
add dst-address=198.51.100.0/24 gateway=10.10.10.254 distance=5 disabled=yes
/ipv6 route
add dst-address=::/0 gateway=2001:db8:10::fe
/routing table
add name=tenant fib=yes
/ip firewall address-list
add list=Trusted address=10.10.10.0/24
add list=Trusted address=192.0.2.5
/ip firewall filter
add chain=forward src-address-list=Trusted dst-address=203.0.113.10 protocol=tcp dst-port=443 action=accept comment="Allow HTTPS"
add chain=input in-interface-list=WAN action=drop comment="Drop WAN input"
/ip firewall nat
add chain=dstnat in-interface=sfp-sfpplus1 dst-address=203.0.113.10 protocol=tcp dst-port=8443 action=dst-nat to-addresses=10.10.10.25 to-ports=443 comment="Printer HTTPS"
/user group
add name=operators policy=read,winbox
/user
add name=example-admin group=operators password="TEST_SECRET_ONLY"
/radius
add address=192.0.2.181 service=login authentication-port=1812 secret="RADIUS_TEST_SECRET"
/user aaa
set use-radius=yes default-group=operators
/ip service
set telnet disabled=yes
set ssh address=192.0.2.0/24 port=2222 disabled=no
/system clock
set time-zone-name=Etc/UTC
/system ntp client
set enabled=yes servers=time.example.test
/system logging action
add name=remote-log target=remote remote=192.0.2.60 remote-port=514
/snmp
set enabled=yes contact="Example operator" location="Example rack"
/ip cloud
set ddns-enabled=yes
/ip neighbor discovery-settings
set discover-interface-list=LAN
/interface wireguard
add name=wg-office listen-port=51820 private-key="WIREGUARD_TEST_SECRET"
/interface wireguard peers
add name=branch interface=wg-office endpoint-address=203.0.113.2 endpoint-port=51820 allowed-address=10.20.0.0/16 public-key="EXAMPLE_PUBLIC_KEY"
/ip ipsec peer
add name=site-b address=198.51.100.2/32 exchange-mode=ike2
/ip ipsec policy
add src-address=10.10.10.0/24 dst-address=10.30.0.0/24 tunnel=yes peer=site-b
/system script
add name=ignored source={ :put "This must never execute"; /system reset-configuration }

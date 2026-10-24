# oct/24/2026 12:00:00 by RouterOS 7.20
/system identity
set name=Review-RouterOS
/interface ethernet
set [ find default-name=ether1 ] name=ether1
/ip address
add address=192.0.2.1/24 interface=ether1
/ip service
set telnet disabled=no address=0.0.0.0/0
set www disabled=no
set ssh disabled=no address=192.0.2.0/24
/ip dns
set servers=192.0.2.53 allow-remote-requests=yes
/system ntp client
set enabled=no servers=time.example.test
/ip firewall filter
add chain=input action=drop in-interface=ether1 protocol=udp dst-port=53

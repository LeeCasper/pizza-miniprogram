import paramiko, os
HOST = os.environ.get('PIZZA_HOST'); USER = os.environ.get('PIZZA_USER', 'root'); PASS = os.environ.get('PIZZA_PASS')
ssh = paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy()); ssh.connect(HOST, username=USER, password=PASS, port=22, timeout=15)
def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd + ' 2>&1', get_pty=False)
    print(stdout.read().decode('utf-8', errors='replace').encode('ascii', errors='replace').decode('ascii'))

# Search for deny/allow directives
run("grep -rn 'deny' /www/server/nginx/conf/nginx.conf 2>/dev/null")
run("grep -rn 'deny' /www/server/panel/vhost/nginx/artaides.com.conf 2>/dev/null")
# Check for any geo blocking
run("grep -rn 'geo' /www/server/nginx/conf/nginx.conf 2>/dev/null")
# Check if it's iptables blocking this IP
run("iptables -L -n -v 2>/dev/null | grep -E '42.239|DROP.*all' | head -10")
# Check baota firewall
run("/etc/init.d/bt status 2>/dev/null && bt 14 2>/dev/null | grep -i '42.239\|block\|deny' | head -10")
# Let's also try adding our external test IP to see if it's specifically 42.239 getting blocked
run("curl -sk -w 'HTTP:%{http_code}' -X POST https://artaides.com/api/v1/pay/recharge -H 'Content-Type: application/json' -H 'X-Forwarded-For: 42.239.54.197' -d '{\"amount\":10}'")
ssh.close()

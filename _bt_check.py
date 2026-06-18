import paramiko, os
HOST = os.environ.get('PIZZA_HOST'); USER = os.environ.get('PIZZA_USER', 'root'); PASS = os.environ.get('PIZZA_PASS')
ssh = paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy()); ssh.connect(HOST, username=USER, password=PASS, port=22, timeout=15)
def run(cmd, desc=''):
    stdin, stdout, stderr = ssh.exec_command(cmd + ' 2>&1', get_pty=False)
    out = stdout.read().decode('utf-8', errors='replace')
    print('=== ' + desc + ' ===')
    print(out.encode('ascii', errors='replace').decode('ascii'))

# Check Baota system firewall
run('bt 14 2>/dev/null', 'Baota system firewall')
# Check if there's a Nginx WAF that logs blocks
run('ls /www/server/btwaf/ 2>/dev/null && ls /www/server/btwaf/rule/ 2>/dev/null | head -10', 'BT WAF rules')
run('grep -rn "42.239" /www/server/btwaf/ 2>/dev/null | head -5', '42.239 in BT WAF')
# Check iptables ipset for blocked IPs
run('ipset list in_bt_user_drop_ipset 2>/dev/null | head -20', 'iptables drop ipset')
run('ipset list out_bt_user_drop_ipset 2>/dev/null | head -20', 'iptables out drop ipset')
# Check if it's baota's free WAF (not nginx WAF)
run('ls /www/server/panel/plugin/btwaf/ 2>/dev/null && ls /www/server/panel/plugin/btwaf/rules/ 2>/dev/null | head -10', 'BT free WAF plugin')
run('ls /www/server/panel/plugin/ 2>/dev/null | grep -i "waf\|firewall\|security"', 'Security plugins')
# Check nginx lua waf status
run('cat /www/server/nginx/conf/luawaf.conf 2>/dev/null', 'luawaf.conf content')
run('grep "include.*luawaf\|include.*waf" /www/server/nginx/conf/nginx.conf 2>/dev/null', 'luawaf include status')
ssh.close()

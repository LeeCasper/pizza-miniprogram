import paramiko, os
HOST = os.environ.get('PIZZA_HOST'); USER = os.environ.get('PIZZA_USER', 'root'); PASS = os.environ.get('PIZZA_PASS')
ssh = paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy()); ssh.connect(HOST, username=USER, password=PASS, port=22, timeout=15)
def run(cmd, desc=''):
    stdin, stdout, stderr = ssh.exec_command(cmd + ' 2>&1', get_pty=False)
    out = stdout.read().decode('utf-8', errors='replace')
    print('=== ' + desc + ' ===')
    print(out.encode('ascii', errors='replace').decode('ascii'))

# Check 0.default.conf
run('cat /www/server/panel/vhost/nginx/0.default.conf 2>/dev/null', '0.default.conf')
# Search for ALL return 403 across ALL nginx configs
run('grep -rn "return 403" /www/server/panel/vhost/nginx/ 2>/dev/null', 'All return 403 in vhost')
run('grep -rn "return 403" /www/server/nginx/conf/ 2>/dev/null', 'All return 403 in nginx conf')
# Check for any lua or waf modules active
run('grep -rn "access_by_lua\|content_by_lua\|body_filter_by_lua\|header_filter_by_lua" /www/server/nginx/conf/ /www/server/panel/vhost/nginx/ 2>/dev/null', 'Lua hooks')
# Check ALL conf files in vhost for POST-related rules
run('grep -rn "POST\|limit_except\|if.*method\|if.*request" /www/server/panel/vhost/nginx/*.conf 2>/dev/null', 'POST/method rules in vhost confs')
# Check artaides.com.conf extension files
run('cat /www/server/panel/vhost/nginx/extension/artaides.com/admin.conf', 'Admin extension')
run('cat /www/server/panel/vhost/nginx/extension/artaides.com/site_total.conf', 'Site total extension')
ssh.close()

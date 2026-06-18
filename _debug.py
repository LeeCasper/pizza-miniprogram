import paramiko, os

HOST = os.environ.get('PIZZA_HOST')
USER = os.environ.get('PIZZA_USER', 'root')
PASS = os.environ.get('PIZZA_PASS')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, port=22, timeout=15)

def run(cmd, desc=''):
    print('=== ' + desc + ' ===')
    stdin, stdout, stderr = ssh.exec_command(cmd + ' 2>&1', get_pty=False)
    out = stdout.read().decode('utf-8', errors='replace')
    safe = out.encode('ascii', errors='replace').decode('ascii')
    print(safe)
    return out

# Check error log with specific timing
run('grep "02:01" /www/wwwlogs/artaides.com.error.log 2>/dev/null', 'Error log at 02:01')
run('grep "pay\|recharge\|403" /www/wwwlogs/artaides.com.error.log 2>/dev/null | tail -20', 'Error log pay/403')
run('tail -50 /www/wwwlogs/artaides.com.error.log 2>/dev/null', 'Last 50 error log lines')

# Also check: is there an ip restriction somewhere?
run('grep -rn "42.239\|deny\|allow" /www/server/panel/vhost/nginx/artaides.com.conf 2>/dev/null', 'IP restrictions in site config')
run('grep -rn "42.239\|deny\|allow" /www/server/nginx/conf/nginx.conf 2>/dev/null | head -10', 'IP restrictions in main config')

ssh.close()

import paramiko, os
HOST = os.environ.get('PIZZA_HOST'); USER = os.environ.get('PIZZA_USER', 'root'); PASS = os.environ.get('PIZZA_PASS')
ssh = paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy()); ssh.connect(HOST, username=USER, password=PASS, port=22, timeout=15)
def run(cmd, desc=''):
    stdin, stdout, stderr = ssh.exec_command(cmd + ' 2>&1', get_pty=False)
    out = stdout.read().decode('utf-8', errors='replace')
    print('=== ' + desc + ' ===')
    print(out.encode('ascii', errors='replace').decode('ascii'))

# Get the actual 403 response from the external perspective
# Use --resolve to hit the external IP as if from outside
run("curl -v -sk -X POST https://artaides.com/api/v1/pay/recharge -H 'Content-Type: application/json' -H 'Origin: https://servicewechat.com' -d '{\"amount\":10}' --connect-to artaides.com:443:39.107.77.26:443 2>&1 | head -50", 'Full response from external IP perspective')

# Check what the actual nginx 403 error page looks like
run("cat /www/server/nginx/html/403.html 2>/dev/null || echo 'no 403.html'", '403 error page')
run("ls /www/server/nginx/html/*.html 2>/dev/null", 'nginx html dir')

# Also check if there's a default nginx error page
run("nginx -V 2>&1 | grep -o 'error-page\|error_log' | head -5", 'nginx error page path')

ssh.close()

import paramiko, os

HOST = os.environ.get('PIZZA_HOST')
USER = os.environ.get('PIZZA_USER', 'root')
PASS = os.environ.get('PIZZA_PASS')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, port=22, timeout=15)

def run(cmd, desc=''):
    stdin, stdout, stderr = ssh.exec_command(cmd + ' 2>&1', get_pty=False)
    out = stdout.read().decode('utf-8', errors='replace')
    print('=== ' + desc + ' ===')
    safe = out.encode('ascii', errors='replace').decode('ascii')
    print(safe)
    return out

# Test 1: Without Referer
run('curl -sk -w "\\nHTTP:%{http_code}" -X POST https://artaides.com/api/v1/pay/recharge -H "Content-Type: application/json" -d \'{"amount":10}\'', '1. No Referer')

# Test 2: With servicewechat Referer
run('curl -sk -w "\\nHTTP:%{http_code}" -X POST https://artaides.com/api/v1/pay/recharge -H "Content-Type: application/json" -H "Referer: https://servicewechat.com/wx06b8f02feceac089/devtools/page-frame.html" -d \'{"amount":10}\'', '2. servicewechat Referer')

# Test 3: Check if Baota Nginx WAF is enabled
run('cat /www/server/btwaf/config.json 2>/dev/null || echo "No btwaf config"', '3. BT WAF check')
run('ls /www/server/btwaf/ 2>/dev/null || echo "No btwaf dir"', '4. BT WAF dir')
run('grep -rn "waf" /www/server/nginx/conf/nginx.conf 2>/dev/null', '5. WAF in nginx.conf')

ssh.close()

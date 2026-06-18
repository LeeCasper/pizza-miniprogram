import paramiko, os

HOST = os.environ.get('PIZZA_HOST')
USER = os.environ.get('PIZZA_USER', 'root')
PASS = os.environ.get('PIZZA_PASS')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, port=22, timeout=15)

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd + ' 2>&1', get_pty=False)
    out = stdout.read().decode('utf-8', errors='replace')
    print(out.encode('ascii', errors='replace').decode('ascii'))
    return stdout.channel.recv_exit_status()

print('=== Clear nginx cache ===')
run('rm -rf /www/server/nginx/proxy_cache_dir/*')
print('Done')

print('=== Reload nginx ===')
run('nginx -s reload')
print('Done')

print('=== Test API ===')
run('curl -sk -w "\\nHTTP:%{http_code}" -X POST https://artaides.com/api/v1/pay/recharge -H "Content-Type: application/json" -d \'{"amount":10}\'')

ssh.close()

import paramiko, os
HOST = os.environ.get('PIZZA_HOST'); USER = os.environ.get('PIZZA_USER', 'root'); PASS = os.environ.get('PIZZA_PASS')
ssh = paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy()); ssh.connect(HOST, username=USER, password=PASS, port=22, timeout=15)
def run(cmd, desc=''):
    stdin, stdout, stderr = ssh.exec_command(cmd + ' 2>&1', get_pty=False)
    out = stdout.read().decode('utf-8', errors='replace')
    print('=== ' + desc + ' ===')
    safe = out.encode('ascii', errors='replace').decode('ascii')
    print(safe)

# Let's check the full nginx.conf to see if there's any other security module
run('cat /www/server/nginx/conf/nginx.conf', 'Full nginx.conf')

ssh.close()

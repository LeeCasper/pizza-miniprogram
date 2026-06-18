import paramiko, os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = os.environ.get('PIZZA_HOST', '')
USER = os.environ.get('PIZZA_USER', 'root')
PASS = os.environ.get('PIZZA_PASS', '')
PORT = int(os.environ.get('PIZZA_PORT', '22'))

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, port=PORT, timeout=15)

stdin, stdout, stderr = ssh.exec_command('pm2 logs pizza-server --lines 15 --nostream 2>&1')
out = stdout.read().decode('utf-8', errors='replace')
print(out)
ssh.close()

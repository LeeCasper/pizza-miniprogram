# -*- coding: utf-8 -*-
import paramiko, os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = os.environ.get('PIZZA_HOST', '')
USER = os.environ.get('PIZZA_USER', 'root')
PASS = os.environ.get('PIZZA_PASS', '')
PORT = int(os.environ.get('PIZZA_PORT', '22'))

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, port=PORT, timeout=15)
env_path = '/opt/pizza-server/pizza-server/.env'

# 1. Check current printer config
print('[1/4] Current printer config:')
stdin, stdout, stderr = ssh.exec_command(f'grep "PRINTER_" {env_path} || echo "(none)"')
print(stdout.read().decode('utf-8', errors='replace'))

# 2. Remove any existing printer lines and add fresh
print('[2/4] Updating printer config...')
ssh.exec_command(f"sed -i '/^PRINTER_/d' {env_path}")
# Use echo to append
lines = [
    '# Cloud Printer (商鹏云打印)',
    'PRINTER_ENABLED=true',
    'PRINTER_APPID=',
    'PRINTER_APPSECRET=',
    'PRINTER_SN=1553606742',
    'PRINTER_PKEY=',
    'PRINTER_API_BASE=https://open.spyun.net',
    'PRINTER_COPIES=1',
]
for line in lines:
    ssh.exec_command(f"echo '{line}' >> {env_path}")

# 3. Verify
print('[3/4] Updated printer config:')
stdin, stdout, stderr = ssh.exec_command(f'grep "PRINTER_" {env_path}')
print(stdout.read().decode('utf-8', errors='replace'))

# 4. Restart PM2
print('[4/4] Restarting PM2...')
stdin, stdout, stderr = ssh.exec_command('pm2 restart pizza-server')
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))

ssh.close()
print('Done!')

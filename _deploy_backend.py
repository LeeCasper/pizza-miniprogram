# -*- coding: utf-8 -*-
import paramiko, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

s = paramiko.SSHClient()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', port=22, timeout=15)

def run(cmd):
    i, o, e = s.exec_command(cmd + ' 2>&1')
    out = o.read().decode('utf-8', errors='replace')
    if out.strip():
        print(out.strip())

print('=== git log (local HEAD) ===')
run('cd /opt/pizza-server && git log --oneline -3')

print()
print('=== git pull ===')
run('cd /opt/pizza-server && git pull origin master')

print()
print('=== git log (after pull) ===')
run('cd /opt/pizza-server && git log --oneline -3')

print()
print('=== pm2 restart ===')
run('pm2 restart pizza-server')

print()
print('=== verify ===')
run('pm2 status')

s.close()

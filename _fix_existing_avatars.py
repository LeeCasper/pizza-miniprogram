# -*- coding: utf-8 -*-
"""Fix existing users with NULL avatar by assigning a random default avatar."""
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

mysql = 'mysql -u pizza -plicongLee2003 pizza'

print('=== Before: users with NULL/empty avatar ===')
run(mysql + " -e \"SELECT id, name, phone, avatar FROM users WHERE avatar IS NULL OR avatar = ''\"")

print()
print('=== Assigning random default avatars to users without one ===')
# Pick a random default avatar URL and assign it to all users with NULL avatar
run(mysql + " -e \"UPDATE users SET avatar = (SELECT url FROM default_avatars ORDER BY RAND() LIMIT 1) WHERE avatar IS NULL OR avatar = ''\"")

print()
print('=== After: all users ===')
run(mysql + " -e \"SELECT id, name, phone, LEFT(avatar,60) as av FROM users\"")

s.close()

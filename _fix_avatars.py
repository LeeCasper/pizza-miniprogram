import paramiko

s = paramiko.SSHClient()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', port=22, timeout=15)

def run(cmd):
    i, o, e = s.exec_command(cmd + ' 2>&1')
    return o.read().decode()

mysql = "mysql -u pizza -plicongLee2003 pizza"

# Show all user avatars
print("=== Current user avatars ===")
print(run(mysql + " -e \"SELECT id, name, phone, avatar FROM users WHERE avatar IS NOT NULL AND avatar != '' ORDER BY id\""))

# Find avatars NOT using CDN URL (relative path = broken in COS mode)
print("\n=== Broken avatars (not CDN) ===")
print(run(mysql + " -e \"SELECT id, name, avatar FROM users WHERE avatar IS NOT NULL AND avatar != '' AND avatar NOT LIKE 'https://img.artaides.com/%'\""))

# Fix: clear broken avatars so they fall back to random default
print("\n=== Fixing... ===")
print(run(mysql + " -e \"UPDATE users SET avatar = '' WHERE avatar IS NOT NULL AND avatar != '' AND avatar NOT LIKE 'https://img.artaides.com/%'\""))

# Verify
print("\n=== After fix ===")
print(run(mysql + " -e \"SELECT id, name, phone, avatar FROM users WHERE avatar IS NOT NULL AND avatar != '' ORDER BY id\""))

s.close()

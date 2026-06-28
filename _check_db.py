import paramiko

s = paramiko.SSHClient()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', port=22, timeout=15)

def run(cmd):
    i, o, e = s.exec_command(cmd + ' 2>&1')
    return o.read().decode()

# 1. Get DB credentials from .env
print("=== DB Config ===")
env = run('cat /opt/pizza-server/pizza-server/.env | grep DB_')
print(env)

# Parse DB_PASSWORD
db_pass = ''
for line in env.split('\n'):
    if line.startswith('DB_PASSWORD='):
        db_pass = line.split('=', 1)[1].strip()
        break

# 2. Check COS config
print("=== COS/Storage Config ===")
print(run('cat /opt/pizza-server/pizza-server/.env | grep -i cos'))

# 3. Query users with uploads avatars
print("=== Users with uploads/ avatars ===")
mysql_cmd = 'mysql -u root'
if db_pass:
    mysql_cmd += ' -p' + db_pass
print(run(mysql_cmd + """ pizza -e "SELECT id, name, phone, LEFT(avatar, 60) as avatar FROM users WHERE avatar IS NOT NULL AND avatar != '' ORDER BY id DESC LIMIT 20;" 2>&1"""))

# 4. Count total users with uploads avatars
print("=== Count of users with uploads/ avatars ===")
print(run(mysql_cmd + """ pizza -e "SELECT COUNT(*) FROM users WHERE avatar LIKE '%uploads/%';" 2>&1"""))

# 5. Check system_config storage
print("=== system_config storage ===")
print(run(mysql_cmd + """ pizza -e "SELECT config_key, LEFT(config_value, 100) as val FROM system_config WHERE config_key LIKE 'cos_%';" 2>&1"""))

# 6. Check if COS is actually used
print("=== COS configured? ===")
print(run(mysql_cmd + """ pizza -e "SELECT config_key, CASE WHEN config_value IS NOT NULL AND config_value != '' THEN 'SET' ELSE 'EMPTY' END as status FROM system_config WHERE config_key IN ('cos_SecretId','cos_SecretKey','cos_Bucket','cos_Region');" 2>&1"""))

s.close()

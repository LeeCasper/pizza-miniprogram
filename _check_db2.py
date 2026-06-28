import paramiko

s = paramiko.SSHClient()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', port=22, timeout=15)

def run(cmd):
    i, o, e = s.exec_command(cmd + ' 2>&1')
    return o.read().decode()

# Get DB password from .env
env = run('cat /opt/pizza-server/pizza-server/.env | grep DB_PASSWORD')
db_pass = 'licongLee2003'
mysql = 'mysql -u pizza -p' + db_pass + ' pizza'

# 1. Check default_avatars table
print("=== default_avatars table ===")
print(run(mysql + """ -e "SELECT * FROM default_avatars;" 2>&1"""))

# 2. Show tables to find where avatars are stored
print("=== Tables with 'avatar' columns ===")
print(run(mysql + """ -e "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='pizza' AND COLUMN_NAME LIKE '%avatar%';" 2>&1"""))

# 3. Check if img.artaides.com resolves to this server
print("=== DNS: img.artaides.com ===")
print(run('nslookup img.artaides.com 2>&1 || host img.artaides.com 2>&1 || dig img.artaides.com 2>&1'))

# 4. Check Nginx for img.artaides.com
print("=== Nginx sites ===")
print(run('ls /www/server/panel/vhost/nginx/ 2>/dev/null'))
print(run('grep -rl "img.artaides" /www/server/panel/vhost/nginx/ 2>/dev/null'))
print(run('grep -rl "img" /www/server/panel/vhost/nginx/ 2>/dev/null'))

# 5. Check for any files matching the 404 UUIDs anywhere on the server
print("=== Search for 404 files ===")
for f in ['1c51b690', 'eca2d6d7', 'c14f986a', '759a2ec1']:
    result = run('find / -name "' + f + '*" 2>/dev/null')
    if result.strip():
        print(f + ': FOUND - ' + result.strip())
    else:
        print(f + ': NOT FOUND')

# 6. Check all Nginx configs for uploads/img handling
print("=== Nginx uploads/img handling ===")
print(run('grep -r "uploads\|img\." /www/server/panel/vhost/nginx/ 2>/dev/null'))

s.close()

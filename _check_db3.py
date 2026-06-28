import paramiko

s = paramiko.SSHClient()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', port=22, timeout=15)

def run(cmd):
    i, o, e = s.exec_command(cmd + ' 2>&1')
    return o.read().decode()

mysql = 'mysql -u pizza -plicongLee2003 pizza'

# 1. All system_config entries
print("=== ALL system_config ===")
print(run(mysql + " -e \"SELECT config_key, LEFT(config_value,80) as val, updated_at FROM system_config ORDER BY config_key;\""))

# 2. Check .env for storage type and base URL
print("=== .env storage/img config ===")
print(run('grep -i "storage\\|cos\\|img\\|base.*url\\|cdn" /opt/pizza-server/pizza-server/.env 2>/dev/null || echo "(none)"'))

# 3. Check Nginx pizza config
print("=== Nginx pizza config ===")
print(run('cat /www/server/panel/vhost/nginx/pizza.artaides.com.conf 2>/dev/null'))

# 4. Check for any PNGs/JPGs in pizza-server
print("=== PNG/JPG files in pizza-server ===")
print(run('find /opt/pizza-server -name "*.png" -o -name "*.jpg" 2>/dev/null | head -20 || echo "(none)"'))

s.close()

import paramiko

s = paramiko.SSHClient()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', port=22, timeout=15)

def run(cmd):
    i, o, e = s.exec_command(cmd + ' 2>&1')
    return o.read().decode()

# 1. Check proxy config
print("=== Nginx proxy configs ===")
print(run('ls /www/server/panel/vhost/nginx/proxy/pizza.artaides.com/ 2>/dev/null'))
print(run('cat /www/server/panel/vhost/nginx/proxy/pizza.artaides.com/*.conf 2>/dev/null'))

# 2. Check if COS is reachable from the server
print("=== COS reachability ===")
print(run('curl -sI https://pizza-1325218051.cos.ap-guangzhou.myqcloud.com/ 2>&1 | head -10'))

# 3. Check PM2 logs for COS upload errors
print("=== PM2 logs (last 50 lines, COS-related) ===")
print(run('pm2 logs pizza-server --lines 50 --nostream 2>&1 | grep -i "cos\|upload\|error" | tail -20 || echo "(no pm2)"'))

# 4. Check www root uploads
print("=== wwwroot ===")
print(run('ls -la /www/wwwroot/pizza.artaides.com/ 2>/dev/null'))

# 5. Check if CDN is reachable
print("=== CDN reachability ===")
print(run('curl -sI https://img.artaides.com/uploads/7e19c7f2-6c91-4324-805f-79432a1ad48b.png 2>&1 | head -10'))

s.close()

import paramiko

s = paramiko.SSHClient()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', port=22, timeout=15)

def run(cmd):
    i, o, e = s.exec_command(cmd + ' 2>&1')
    return o.read().decode()

print("=== Uploads directory ===")
print(run('ls -la /opt/pizza-server/pizza-server/uploads/ | head -40'))
print("Count:", run('ls /opt/pizza-server/pizza-server/uploads/ | wc -l').strip())
print("Size:", run('du -sh /opt/pizza-server/pizza-server/uploads/').strip())

print()
print("=== Missing files check ===")
for f in ['1c51b690-9ae8-4d58-86f0-cfc92c04f917.png', 'eca2d6d7-0373-4a97-b3b7-f14d4d6594cc.png', 'c14f986a-4068-4abf-88dd-ab664b449567.png', '759a2ec1-10c4-42cd-8036-584bca398a9c.png']:
    print(f, run('test -f /opt/pizza-server/pizza-server/uploads/' + f + ' && echo EXISTS || echo MISSING').strip())

print()
print("=== .env UPLOAD_DIR ===")
print(run('cat /opt/pizza-server/pizza-server/.env | grep -i upload'))

print()
print("=== Nginx uploads config ===")
print(run('grep -r uploads /www/server/panel/vhost/nginx/ 2>/dev/null'))

print()
print("=== Disk usage ===")
print(run('df -h / | tail -1'))

s.close()

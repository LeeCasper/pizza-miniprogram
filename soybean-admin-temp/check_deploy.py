import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('39.107.77.26', username='root', password='licongLee2003', port=22)

stdin, stdout, stderr = ssh.exec_command("grep -A 10 'location /admin' /www/server/panel/vhost/nginx/artaides.com.conf 2>/dev/null || grep -A 10 'location /admin' /www/server/panel/vhost/nginx/*.conf 2>/dev/null || echo 'No /admin location found in nginx configs'")
print(stdout.read().decode())

stdin, stdout, stderr = ssh.exec_command("ls -la /opt/pizza-admin/ | head -10")
print(stdout.read().decode())

stdin, stdout, stderr = ssh.exec_command("cat /opt/pizza-admin/index.html | head -5")
print(stdout.read().decode())

ssh.close()

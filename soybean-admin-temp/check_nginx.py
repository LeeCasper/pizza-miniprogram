import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('39.107.77.26', username='root', password='licongLee2003', port=22)

# Find the actual nginx config
stdin, stdout, stderr = ssh.exec_command("grep -rn 'admin' /www/server/panel/vhost/nginx/ --include='*.conf' 2>/dev/null | grep -v '.well-known' | grep -v '#'")
print("=== Nginx admin configs ===")
print(stdout.read().decode())

# Check if Express serves admin static files from /opt/pizza-admin
stdin, stdout, stderr = ssh.exec_command("grep -rn 'pizza-admin' /opt/pizza-server/ --include='*.js' 2>/dev/null")
print("=== pizza-admin refs in server code ===")
print(stdout.read().decode())

# Check how Express routes /admin
stdin, stdout, stderr = ssh.exec_command("grep -n 'admin' /opt/pizza-server/src/app.js 2>/dev/null")
print("=== Express app.js admin lines ===")
print(stdout.read().decode())

ssh.close()

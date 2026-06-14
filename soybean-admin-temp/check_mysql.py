import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('39.107.77.26', username='root', password='licongLee2003', port=22)

# Get PM2 env to find DB_PASSWORD
stdin, stdout, stderr = ssh.exec_command('pm2 env 0 2>/dev/null | grep DB_ || pm2 show pizza-server 2>/dev/null | grep -E "DB_|env"')
print("PM2 env:", stdout.read().decode())
print("PM2 err:", stderr.read().decode())

ssh.close()

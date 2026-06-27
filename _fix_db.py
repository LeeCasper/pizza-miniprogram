import paramiko, time
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', timeout=10)

# Restart PM2
stdin, stdout, stderr = ssh.exec_command('pm2 restart pizza-server 2>&1')
print(stdout.read().decode().strip())

# Verify
time.sleep(2)
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print('HEALTH:', stdout.read().decode().strip())

ssh.close()

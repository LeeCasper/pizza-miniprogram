import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', timeout=10)

# Verify health via localhost
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print('HEALTH:', stdout.read().decode().strip())

# Verify via domain (HTTPS)
stdin, stdout, stderr = ssh.exec_command('curl -sk https://pizza.artaides.com/health')
print('HTTPS:', stdout.read().decode().strip())

# Verify nginx admin page
stdin, stdout, stderr = ssh.exec_command('curl -sk -o /dev/null -w "%{http_code}" https://pizza.artaides.com/admin/')
print('ADMIN HTTP:', stdout.read().decode().strip())

# Verify frontend files
stdin, stdout, stderr = ssh.exec_command('ls /opt/pizza-admin/index.html && echo FRONTEND_OK')
print('FRONTEND:', stdout.read().decode().strip())

# Verify cert auto-renewal
stdin, stdout, stderr = ssh.exec_command('systemctl status certbot.timer 2>/dev/null | head -5')
print('CERT_RENEW:', stdout.read().decode().strip()[:200])

ssh.close()

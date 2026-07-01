import os, paramiko

HOST = os.environ.get('PIZZA_HOST', '103.236.67.179')
PASS = os.environ.get('PIZZA_PASS', 'YVVRLz2CiPCG0JtB')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username='root', password=PASS, port=22, timeout=15)

# Check Nginx access log for upload
stdin, stdout, stderr = ssh.exec_command('grep "upload" /www/wwwlogs/pizza.artaides.com.log 2>/dev/null | tail -5', get_pty=False)
print('=== Access log upload entries ===')
print(stdout.read().decode('utf-8', 'replace').strip() or 'none')

# Check PM2 stdout for recent upload errors
stdin, stdout, stderr = ssh.exec_command('cat /var/log/pizza/out-0.log 2>/dev/null | tail -30', get_pty=False)
print('\n=== PM2 stdout log ===')
print(stdout.read().decode('utf-8', 'replace').strip()[:2000] or 'none')

# Check PM2 stderr
stdin, stdout, stderr = ssh.exec_command('cat /var/log/pizza/err-0.log 2>/dev/null | tail -30', get_pty=False)
print('\n=== PM2 stderr log ===')
print(stdout.read().decode('utf-8', 'replace').strip()[:2000] or 'none')

# Upload a real test file to the actual endpoint from server itself
cmd = """cd /tmp && echo iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg== | base64 -d > /tmp/test.png 2>/dev/null
curl -sk -X POST https://127.0.0.1/api/v1/admin/upload -F "file=@/tmp/test.png;type=image/png" 2>&1"""
stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=False)
print('\n=== Test upload response ===')
print(stdout.read().decode('utf-8', 'replace').strip()[:500])
ssh.close()

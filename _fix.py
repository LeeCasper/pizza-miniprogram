import os, paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', port=22, timeout=15)

# Fix the Nginx config: remove broken alias location, deploy to the actual root
# The pizza.artaides.com root is /www/wwwroot/pizza.artaides.com
# So /admin/ files should be at /www/wwwroot/pizza.artaides.com/admin/

# 1. Remove the broken admin extension
ssh.exec_command('rm -f /www/server/panel/vhost/nginx/extension/pizza.artaides.com/admin.conf', get_pty=False)
print('Removed old admin extension')

# 2. Update the main pizza config to use a proper admin location BEFORE proxy
# Read current config
stdin, stdout, stderr = ssh.exec_command('cat /www/server/panel/vhost/nginx/pizza.artaides.com.conf', get_pty=False)
conf = stdout.read().decode('utf-8', 'replace')

# Replace the existing /admin/ location with one that uses root properly
old_loc = '''    location /admin/ {
        try_files $uri $uri/ /admin/index.html;
    }'''
new_loc = '''    location /admin/ {
        root /www/wwwroot/pizza.artaides.com;
        try_files $uri $uri/ /admin/index.html;
        index index.html;
    }'''
conf = conf.replace(old_loc, new_loc)

# Write back
sftp = ssh.open_sftp()
with sftp.file('/www/server/panel/vhost/nginx/pizza.artaides.com.conf', 'w') as f:
    f.write(conf)
sftp.close()
print('Updated /admin/ location')

# 3. Test and reload
stdin, stdout, stderr = ssh.exec_command('nginx -t 2>&1 && nginx -s reload 2>&1 && echo RELOADED', get_pty=False)
out = stdout.read().decode('utf-8', 'replace')
print(f'nginx: {out.strip()[:200]}')

# 4. Now deploy the latest dist to the correct directory
# First, check if the local dist has the latest build
import subprocess
result = subprocess.run(['head', '-4', r'D:\Code\Pizza\soybean-admin-temp\dist\index.html'], capture_output=True, text=True, shell=True)
print(f'\nLocal dist buildTime: {result.stdout}')

ssh.close()

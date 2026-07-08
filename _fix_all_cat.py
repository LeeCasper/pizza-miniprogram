import paramiko, os
pw = os.environ.get('PIZZA_PASS')
host = os.environ.get('PIZZA_HOST', '103.236.67.179')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username='root', password=pw, timeout=15)

# Delete stale 'all' category
cmd = 'mysql -u root -p"' + pw + '" pizza -e "DELETE FROM points_categories WHERE \\`key\\` = \'all\';" 2>&1'
stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=False)
out = stdout.read().decode('utf-8', 'replace').strip()
err = stderr.read().decode('utf-8', 'replace').strip()
print(out or 'Deleted OK')
if err and 'Warning' not in err: print('ERR:', err[:200])
ssh.close()

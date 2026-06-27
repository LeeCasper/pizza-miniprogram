import paramiko, os, sys

DIST = r'D:\Code\Pizza\soybean-admin-temp\dist'
REMOTE = '/opt/pizza-admin'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', timeout=10)

sftp = ssh.open_sftp()

# Clean remote
stdin, stdout, stderr = ssh.exec_command(f'rm -rf {REMOTE}/* 2>&1')
stdout.read()

file_count = 0
for root, dirs, files in os.walk(DIST):
    for filename in files:
        local_path = os.path.join(root, filename)
        rel = os.path.relpath(local_path, DIST).replace('\\', '/')
        remote_path = f"{REMOTE}/{rel}"

        # Ensure remote dir
        remote_dir = os.path.dirname(remote_path).replace('\\', '/')
        try:
            sftp.lstat(remote_dir)
        except FileNotFoundError:
            stdin, stdout, stderr = ssh.exec_command(f'mkdir -p {remote_dir} 2>&1')
            stdout.read()

        sftp.put(local_path, remote_path)
        file_count += 1
        if file_count % 10 == 0:
            print(f'  Uploaded {file_count} files...')

print(f'Total: {file_count} files uploaded')
sftp.close()

# Verify
stdin, stdout, stderr = ssh.exec_command(f'ls {REMOTE}/index.html 2>&1')
print('Verify:', 'OK' if 'index.html' in stdout.read().decode() else 'FAIL')

ssh.close()
print('Done!')

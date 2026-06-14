import paramiko
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('39.107.77.26', username='root', password='licongLee2003', port=22)

sftp = ssh.open_sftp()
REMOTE_DIR = '/opt/pizza-admin/'
LOCAL_DIR = r'D:\Code\Pizza\soybean-admin-temp\dist'

# Remove old files
try:
    for f in sftp.listdir(REMOTE_DIR):
        path = f'{REMOTE_DIR}/{f}'
        try:
            sftp.listdir(path)
            stdin, stdout, stderr = ssh.exec_command(f'rm -rf {path}')
            stdout.read()
        except:
            sftp.remove(path)
    print('Old files removed')
except Exception as e:
    print(f'Cleanup info: {e}')

# Upload new files
def upload_dir(local, remote):
    for item in os.listdir(local):
        local_path = os.path.join(local, item)
        remote_path = f'{remote}/{item}'.replace('\\', '/')
        if os.path.isdir(local_path):
            try:
                sftp.mkdir(remote_path)
            except:
                pass
            upload_dir(local_path, remote_path)
        else:
            sftp.put(local_path, remote_path)

upload_dir(LOCAL_DIR, REMOTE_DIR)

sftp.close()
ssh.close()
print('Deploy complete!')

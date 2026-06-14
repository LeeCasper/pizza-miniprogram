#!/usr/bin/env python3
"""Deploy file-management feature to production server."""
import paramiko
import os
import sys

HOST = os.environ.get('PIZZA_HOST', '')
USER = os.environ.get('PIZZA_USER', 'root')
PASS = os.environ.get('PIZZA_PASS', '')
PORT = int(os.environ.get('PIZZA_PORT', '22'))

SERVER_BASE = '/opt/pizza-server/pizza-server'  # PM2 runs from nested dir
ADMIN_BASE = '/opt/pizza-admin'  # Nginx alias target (no /dist subdir)
LOCAL_SERVER = r'D:\Code\Pizza\pizza-server'
LOCAL_ADMIN_DIST = r'D:\Code\Pizza\soybean-admin-temp\dist'

# ── Backend files to upload ──────────────────────────
BACKEND_FILES = [
    'src/config/multer.js',
    'src/routes/upload.js',
    'src/controllers/uploadController.js',
    'src/routes/adminApi.js',
]

ssh = None

def deploy_backend():
    print("=" * 60)
    print("Deploying BACKEND files...")
    print("=" * 60)

    global ssh
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, port=PORT, timeout=15)
    sftp = ssh.open_sftp()

    for rel_path in BACKEND_FILES:
        local_path = os.path.join(LOCAL_SERVER, rel_path)
        remote_path = os.path.join(SERVER_BASE, rel_path).replace('\\', '/')

        if not os.path.exists(local_path):
            print(f"  SKIP (not found): {rel_path}")
            continue

        # Ensure remote directory exists
        remote_dir = os.path.dirname(remote_path).replace('\\', '/')
        try:
            sftp.lstat(remote_dir)
        except FileNotFoundError:
            # Create directory recursively
            stdin, stdout, stderr = ssh.exec_command(
                f'mkdir -p {remote_dir} 2>&1', get_pty=False
            )
            stdout.read()

        sftp.put(local_path, remote_path)
        local_size = os.path.getsize(local_path)
        remote_size = sftp.stat(remote_path).st_size
        status = "OK" if local_size == remote_size else "SIZE MISMATCH"
        print(f"  {status}  {rel_path}  ({local_size} bytes)")

    sftp.close()

    # ── Restart PM2 ───────────────────────────────────
    print("\nRestarting pizza-server via PM2...")
    stdin, stdout, stderr = ssh.exec_command(
        'pm2 restart pizza-server 2>&1',
        get_pty=False
    )
    output = stdout.read().decode('utf-8', errors='replace')
    print("  " + output.strip())


def deploy_frontend():
    print("=" * 60)
    print("Deploying FRONTEND dist...")
    print("=" * 60)

    if not os.path.exists(LOCAL_ADMIN_DIST):
        print(f"  ERROR: dist not found at {LOCAL_ADMIN_DIST}")
        print("  Run: cd pizza-admin && npm run build")
        return

    global ssh
    if ssh is None:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(HOST, username=USER, password=PASS, port=PORT, timeout=15)

    sftp = ssh.open_sftp()

    # Clean old dist
    print("  Cleaning old dist...")
    stdin, stdout, stderr = ssh.exec_command(
        f'rm -rf {ADMIN_BASE}/* 2>&1',
        get_pty=False
    )
    stdout.read()

    # Upload all files recursively
    file_count = 0
    for root, dirs, files in os.walk(LOCAL_ADMIN_DIST):
        for filename in files:
            local_path = os.path.join(root, filename)
            rel_path = os.path.relpath(local_path, LOCAL_ADMIN_DIST).replace('\\', '/')
            remote_path = f"{ADMIN_BASE}/{rel_path}"

            # Ensure remote directory exists
            remote_dir = os.path.dirname(remote_path).replace('\\', '/')
            try:
                sftp.lstat(remote_dir)
            except FileNotFoundError:
                stdin, stdout, stderr = ssh.exec_command(
                    f'mkdir -p {remote_dir} 2>&1', get_pty=False
                )
                stdout.read()

            sftp.put(local_path, remote_path)
            file_count += 1
            if file_count % 10 == 0:
                print(f"  Uploaded {file_count} files...")

    print(f"  Total: {file_count} files uploaded")
    sftp.close()

    # Verify
    stdin, stdout, stderr = ssh.exec_command(
        f'ls {ADMIN_BASE}/index.html 2>&1',
        get_pty=False
    )
    output = stdout.read().decode('utf-8', errors='replace')
    print(f"  Verify index.html: {'OK' if 'index.html' in output else 'MISSING'}")

    # Check for new files page chunk
    stdin, stdout, stderr = ssh.exec_command(
        f'ls {ADMIN_BASE}/assets/ | grep -i "imageupload\|upload\|files" 2>&1',
        get_pty=False
    )
    output = stdout.read().decode('utf-8', errors='replace')
    print(f"  New modules found:\n    {output.strip()}")


if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else 'both'

    try:
        if arg in ('backend', 'both'):
            deploy_backend()
        if arg in ('frontend', 'both'):
            deploy_frontend()

        if ssh:
            ssh.close()

        print("=" * 60)
        print("Deploy complete!")
        print("=" * 60)
    except Exception as e:
        print(f"\nERROR: {e}")
        if ssh:
            ssh.close()
        sys.exit(1)

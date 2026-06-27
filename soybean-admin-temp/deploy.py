#!/usr/bin/env python3
"""Deploy to production server."""
import paramiko
import os
import sys

HOST = os.environ.get('PIZZA_HOST', '')
USER = os.environ.get('PIZZA_USER', 'root')
PASS = os.environ.get('PIZZA_PASS', '')
PORT = int(os.environ.get('PIZZA_PORT', '22'))

SERVER_REPO = '/opt/pizza-server'  # Git repo root
ADMIN_BASE = '/www/wwwroot/pizza.artaides.com/admin'  # Nginx root + /admin/
LOCAL_ADMIN_DIST = r'D:\Code\Pizza\soybean-admin-temp\dist'

ssh = None

def deploy_backend():
    """Full backend deploy: git pull -> npm install -> run migrations -> pm2 restart"""
    print("=" * 60)
    print("Deploying BACKEND (git pull + migrate + restart)...")
    print("=" * 60)

    global ssh
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, port=PORT, timeout=15)

    def run_cmd(cmd, desc=''):
        if desc:
            print(f"  {desc}...")
        stdin, stdout, stderr = ssh.exec_command(f'{cmd} 2>&1', get_pty=False)
        output = stdout.read().decode('utf-8', errors='replace')
        for line in output.strip().split('\n'):
            print(f"    {line}")
        exit_code = stdout.channel.recv_exit_status()
        if exit_code != 0:
            print(f"  WARN: Exit code: {exit_code}")
        return output

    # 1. Git pull
    run_cmd(f'cd {SERVER_REPO} && git pull origin master', '[1/6] Git pull')

    # 2. Install dependencies
    run_cmd(f'cd {SERVER_REPO}/pizza-server && npm install --production', '[2/6] npm install')

    # 3. Run migrations
    print("  [3/6] Running DB migrations...")
    migrations = [
        'pizza-server/db/migrate_membership.sql',
        'pizza-server/db/migrate_balance_history.sql',
        'pizza-server/db/fix_missed_orders_0607.sql',
        'pizza-server/db/migrate_phase0_legal.sql',
        'pizza-server/db/migrate_phase3_business.sql',
        'pizza-server/db/migrate_birthday.sql',
        'pizza-server/db/migrate_product_soft_delete.sql',
        'pizza-server/db/migrate_category_key_nullable.sql',
        'pizza-server/db/migrate_store_pickup_notice.sql',
        'pizza-server/db/migrate_coupon_claimable.sql',
        'pizza-server/db/migrate_lucky_wheel.sql',
        'pizza-server/db/migrate_coupon_template_images.sql',
        'pizza-server/db/migrate_coupon_template_product_id.sql',
        'pizza-server/db/migrate_backfill_coupon_redeem_product.sql',
        'pizza-server/db/migrate_redeem_coupon_order.sql',
        'pizza-server/db/migrate_shop_module.sql',
        'pizza-server/db/migrate_shop_payment_enum.sql',
        'pizza-server/db/migrate_shop_refund.sql',
        'pizza-server/db/migrate_default_avatars.sql',
    ]
    for m in migrations:
        stdin, stdout, stderr = ssh.exec_command(
            f'cd {SERVER_REPO} && '
            f'source pizza-server/.env 2>/dev/null; '
            f'mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < {m} 2>&1',
            get_pty=False
        )
        output = stdout.read().decode('utf-8', errors='replace')
        if output.strip():
            print("    " + output.strip())
        exit_code = stdout.channel.recv_exit_status()
        if exit_code == 0:
            print(f"    {m}: OK")
        else:
            print(f"  WARN: {m} exit: {exit_code} (may already be applied)")

    # 4. Verify .env exists
    run_cmd(f'test -f {SERVER_REPO}/pizza-server/.env && echo "OK" || echo "MISSING"', '[4/6] .env check')

    # 5. Restart PM2
    run_cmd('pm2 restart pizza-server', '[6/6] PM2 restart')

    print("\n  Backend deploy complete")


def deploy_frontend():
    print("=" * 60)
    print("Deploying FRONTEND dist...")
    print("=" * 60)

    if not os.path.exists(LOCAL_ADMIN_DIST):
        print(f"  ERROR: dist not found at {LOCAL_ADMIN_DIST}")
        print("  Run: cd soybean-admin-temp && pnpm build")
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

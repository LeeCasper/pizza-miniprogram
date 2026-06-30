import os
import sys
import paramiko

# ── Config ─────────────────────────────────────
HOST = os.environ.get('PIZZA_HOST', '103.263.67.179')
USER = os.environ.get('PIZZA_USER', 'root')
PASS = os.environ.get('PIZZA_PASS', '')
PORT = int(os.environ.get('PIZZA_PORT', '22'))

SERVER_REPO = '/opt/pizza-server'  # Git repo root
ADMIN_BASES = [
    '/opt/pizza-admin',                            # pizza.artaides.com Nginx admin alias
]
LOCAL_ADMIN_DIST = r'D:\Code\Pizza\soybean-admin-temp\dist'

ssh = None


# ── Helpers ────────────────────────────────────
def ssh_exec(cmd):
    """Execute command on remote server, return stdout string."""
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=False)
    return stdout.read().decode('utf-8', errors='replace').strip()


# ── Backend Deploy ─────────────────────────────
def deploy_backend():
    print("=" * 60)
    print("Deploying BACKEND (git pull + migrate + restart)...")
    print("=" * 60)

    global ssh
    if ssh is None:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(HOST, username=USER, password=PASS, port=PORT, timeout=15)

    # 1. Git pull
    print("  [1/6] Git pull...")
    out = ssh_exec(f'cd {SERVER_REPO} && git pull 2>&1')
    for line in out.split('\n'):
        print(f"    {line}")

    # 2. npm install
    print("  [2/6] npm install...")
    out = ssh_exec(f'cd {SERVER_REPO} && npm install --production 2>&1')
    for line in out.split('\n')[-3:]:
        if line.strip():
            print(f"    {line.strip()}")

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
        'pizza-server/db/migrate_shop_banners.sql',
        'pizza-server/db/migrate_banner_shop_product.sql',
        'pizza-server/db/migrate_drop_tier_colors.sql',
        'pizza-server/db/migrate_drop_accent_color.sql',
    ]
    for m in migrations:
        stdin, stdout, stderr = ssh.exec_command(
            f'cd {SERVER_REPO} && '
            f'source pizza-server/.env 2>/dev/null; '
            f'mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < {m} 2>&1',
            get_pty=False
        )
        err = stderr.read().decode('utf-8', errors='replace').strip()
        out = stdout.read().decode('utf-8', errors='replace').strip()
        if err and 'Warning' not in err:
            print(f"  WARN: {m} exit: {err[:80]} (may already be applied)")
        else:
            print(f"    {m}: OK")

    # 4. .env check
    print("  [4/6] .env check...")
    out = ssh_exec(f'ls {SERVER_REPO}/.env 2>&1')
    print(f"    {'OK' if '.env' in out else 'MISSING!'}")

    # 5. PM2 restart
    print("  [6/6] PM2 restart...")
    out = ssh_exec(f'cd {SERVER_REPO} && pm2 restart pizza-server 2>&1')
    print(f"    {out[:200]}")

    print("\n  Backend deploy complete")


# ── Frontend Deploy ────────────────────────────
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

    for ADMIN_BASE in ADMIN_BASES:
        print(f"\n  --- Deploying to {ADMIN_BASE} ---")

        # Clean old dist
        print("  Cleaning old dist...")
        ssh_exec(f'rm -rf {ADMIN_BASE}/* 2>&1')

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
                    ssh_exec(f'mkdir -p {remote_dir} 2>&1')

                sftp.put(local_path, remote_path)
                file_count += 1
                if file_count % 10 == 0:
                    print(f"  Uploaded {file_count} files...")

        print(f"  Total: {file_count} files uploaded")

        # Verify
        output = ssh_exec(f'ls {ADMIN_BASE}/index.html 2>&1')
        print(f"  Verify index.html: {'OK' if 'index.html' in output else 'MISSING'}")

    sftp.close()
    print("=" * 60)
    print("Deploy complete!")
    print("=" * 60)


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
        print(f"\n  ERROR: {e}")
        if ssh:
            ssh.close()
        sys.exit(1)

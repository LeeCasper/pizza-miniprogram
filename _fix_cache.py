import paramiko, os

HOST = os.environ.get('PIZZA_HOST')
USER = os.environ.get('PIZZA_USER', 'root')
PASS = os.environ.get('PIZZA_PASS')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, port=22, timeout=15)

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd + ' 2>&1', get_pty=False)
    out = stdout.read().decode('utf-8', errors='replace')
    safe = out.encode('ascii', errors='replace').decode('ascii')
    print(safe)
    return stdout.channel.recv_exit_status()

# Add proxy_cache off to the main location block
# The location block currently is:
#   location / {
#       proxy_pass http://127.0.0.1:3000;
#       ...
#   }
# We need to add proxy_cache off; inside it

print('=== Current location / block ===')
run("sed -n '/location \/ {/,/^    }/p' /www/server/panel/vhost/nginx/artaides.com.conf")

print('\n=== Adding proxy_cache off ===')
# Use sed to insert proxy_cache off after proxy_pass line
cmd = """sed -i '/proxy_pass http:\\/\\/127.0.0.1:3000;/a\\        proxy_cache off;' /www/server/panel/vhost/nginx/artaides.com.conf"""
run(cmd)

print('\n=== Verify ===')
run("sed -n '/location \/ {/,/^    }/p' /www/server/panel/vhost/nginx/artaides.com.conf")

print('\n=== Test nginx config ===')
run('nginx -t')

print('\n=== Reload nginx ===')
run('nginx -s reload')

ssh.close()

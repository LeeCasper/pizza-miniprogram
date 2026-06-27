import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.236.67.179', username='root', password='YVVRLz2CiPCG0JtB', timeout=10)

nginx_conf = r"""server {
    listen 80;
    server_name pizza.artaides.com;
    root /opt/pizza-admin;

    # ACME 验证
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
    }

    # 管理后台 SPA
    location /admin {
        alias /opt/pizza-admin;
        try_files $uri $uri/ /admin/index.html;
        index index.html;
    }

    # 反向代理到 Node
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
    }

    location ~* (\.env|\.git|node_modules|ecosystem\.config\.js)$ {
        return 404;
    }

    access_log /www/wwwlogs/pizza.artaides.com.log;
    error_log /www/wwwlogs/pizza.artaides.com.error.log;
}"""

cmd = "cat > /www/server/panel/vhost/nginx/pizza.artaides.com.conf << 'NF'\n" + nginx_conf + "\nNF"
stdin, stdout, stderr = ssh.exec_command(cmd)
print('Config updated')

stdin, stdout, stderr = ssh.exec_command('mkdir -p /var/www/letsencrypt/.well-known/acme-challenge && nginx -t 2>&1 && nginx -s reload && echo NGINX_OK')
print(stdout.read().decode().strip())

# Retry certbot with webroot
stdin, stdout, stderr = ssh.exec_command('certbot certonly --webroot -w /var/www/letsencrypt -d pizza.artaides.com --non-interactive --agree-tos -m admin@artaides.com 2>&1')
out = stdout.read().decode().strip()
print(out)
err = stderr.read().decode().strip()[:500]
if err: print('ERR:', err)

ssh.close()

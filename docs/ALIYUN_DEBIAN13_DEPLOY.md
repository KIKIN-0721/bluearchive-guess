# 阿里云 Debian 13.4 测试服务器部署说明

本文档用于在阿里云 Debian 13.4 服务器上部署“白一把”的测试环境。当前项目仍是纯前端静态版本，可以用 nginx 直接托管 `dist/`；后续开发联机功能时，可以继续复用同一台服务器，将前端交给 nginx，将联机后端作为独立 systemd 服务运行。

## 1. 服务器与安全组

推荐测试配置：

- 系统：Debian 13.4 x86_64
- CPU/内存：1 vCPU / 1 GB 起步；联机测试建议 2 vCPU / 2 GB
- 磁盘：20 GB 起步
- 入站安全组：
  - TCP 22：SSH，仅允许自己的固定 IP 更安全
  - TCP 80：HTTP
  - TCP 443：HTTPS，后续申请证书时使用
  - TCP 3000：预留给联机后端测试；正式使用时建议只允许本机 nginx 反代访问

以下命令默认使用具有 sudo 权限的普通用户执行。如果你直接使用 root 登录，可以去掉命令前的 `sudo`。

## 2. 首次登录与系统更新

```bash
ssh root@你的服务器公网IP
apt update
apt full-upgrade -y
apt install -y curl wget git vim ufw ca-certificates gnupg unzip nginx
reboot
```

重启后重新登录：

```bash
ssh root@你的服务器公网IP
```

## 3. 创建部署用户

建议不要长期使用 root 运行项目：

```bash
adduser deploy
usermod -aG sudo deploy
```

把你的 SSH 公钥复制给 `deploy` 用户：

```bash
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

之后使用 `deploy` 登录：

```bash
ssh deploy@你的服务器公网IP
```

## 4. 配置基础防火墙

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

如果后续临时直连测试后端：

```bash
sudo ufw allow 3000/tcp
```

正式反向代理后，建议关闭公网直连后端端口：

```bash
sudo ufw delete allow 3000/tcp
```

## 5. 安装 Node.js 24 与 pnpm

项目使用 Vite、React 与 TypeScript。服务器构建建议使用 Node.js 24。

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

启用 Corepack 并准备 pnpm：

```bash
sudo corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

如果 `corepack` 权限异常，可以改用：

```bash
sudo npm install -g pnpm
pnpm -v
```

## 6. 拉取项目

```bash
cd /srv
sudo mkdir -p /srv/bluearchive-guess
sudo chown deploy:deploy /srv/bluearchive-guess
git clone https://github.com/KIKIN-0721/bluearchive-guess.git /srv/bluearchive-guess
cd /srv/bluearchive-guess
```

切换到联机测试分支：

```bash
git fetch origin
git switch test-online
```

如果远端还没有 `test-online` 分支，可以先使用 `main`，等本地分支推送后再切换。

## 7. 安装依赖与构建前端

```bash
cd /srv/bluearchive-guess
pnpm install --frozen-lockfile
pnpm build
```

构建成功后，静态产物位于：

```text
/srv/bluearchive-guess/dist
```

本项目在普通服务器根路径部署时不需要设置 `GITHUB_PAGES=true`。这个环境变量只用于 GitHub Pages 的 `/bluearchive-guess/` 子路径部署。

## 8. 用 nginx 托管静态前端

创建 nginx 配置：

```bash
sudo vim /etc/nginx/sites-available/bluearchive-guess
```

写入以下内容，将 `server_name` 替换为你的域名；如果暂时没有域名，可以先写服务器公网 IP。

```nginx
server {
    listen 80;
    server_name 你的域名或公网IP;

    root /srv/bluearchive-guess/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        try_files $uri =404;
    }
}
```

启用站点并检查配置：

```bash
sudo ln -s /etc/nginx/sites-available/bluearchive-guess /etc/nginx/sites-enabled/bluearchive-guess
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

检查服务状态：

```bash
systemctl status nginx --no-pager
```

浏览器访问：

```text
http://你的服务器公网IP
```

## 9. 更新发布流程

每次代码更新后：

```bash
cd /srv/bluearchive-guess
git fetch origin
git switch test-online
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build
sudo nginx -t
sudo systemctl reload nginx
```

如果只是前端静态文件变化，通常不需要重启 nginx，`reload` 已足够。

## 10. 临时使用 Vite Preview 测试

不推荐长期用 Vite Preview 暴露公网，但可以临时确认构建结果：

```bash
cd /srv/bluearchive-guess
pnpm build
pnpm preview -- --host 0.0.0.0 --port 4173
```

如果要从公网访问，需要在阿里云安全组和 ufw 中临时放行 4173：

```bash
sudo ufw allow 4173/tcp
```

测试结束后关闭端口：

```bash
sudo ufw delete allow 4173/tcp
```

## 11. 后续联机后端预留方案

当项目加入联机后端后，推荐结构如下：

```text
/srv/bluearchive-guess
├── dist/                  # 前端静态产物，nginx 托管
├── server/                # 后续联机后端目录
└── .env                   # 后端环境变量，不提交到 git
```

后端建议只监听本机地址：

```text
HOST=127.0.0.1
PORT=3000
NODE_ENV=production
```

创建 systemd 服务文件：

```bash
sudo vim /etc/systemd/system/bluearchive-guess-online.service
```

示例内容，后续需要按真实后端入口文件调整 `ExecStart`：

```ini
[Unit]
Description=Blue Archive Guess Online Server
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/srv/bluearchive-guess
EnvironmentFile=/srv/bluearchive-guess/.env
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable bluearchive-guess-online
sudo systemctl start bluearchive-guess-online
sudo systemctl status bluearchive-guess-online --no-pager
```

查看日志：

```bash
journalctl -u bluearchive-guess-online -f
```

nginx 反向代理示例：

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

修改 nginx 后：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 12. HTTPS 证书

绑定域名并解析到服务器后，可以使用 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

检查自动续期：

```bash
sudo systemctl status certbot.timer --no-pager
sudo certbot renew --dry-run
```

## 13. 常见排查

查看 nginx 错误日志：

```bash
sudo tail -n 100 /var/log/nginx/error.log
```

查看访问日志：

```bash
sudo tail -n 100 /var/log/nginx/access.log
```

检查端口监听：

```bash
sudo ss -lntp
```

检查前端资源是否构建：

```bash
ls -la /srv/bluearchive-guess/dist
```

如果页面空白，优先检查：

- `pnpm build` 是否成功
- nginx `root` 是否指向 `/srv/bluearchive-guess/dist`
- 浏览器开发者工具中 JS/CSS 是否 404
- 是否错误地带了 `GITHUB_PAGES=true` 构建，导致资源路径变成 `/bluearchive-guess/assets/...`


# 阿里云 ECS 部署指南

## 资源规划

| 服务 | 规格 | 用途 |
|------|------|------|
| ECS | 2C4G | 运行 Docker 容器（API + Worker + DB + Redis + Frontend）|
| 数据盘 | 40GB | Docker 数据卷持久化 |
| 弹性公网 IP | 1 | 对外访问 |

推荐实例规格：**ECS ecs.s6-c1m2.small**（2vCPU, 4GB, 40GB) 或以上。

---

## 一、ECS 初始化

### 1.1 创建实例

阿里云控制台 → ECS → 创建实例：
- **镜像**: Ubuntu 22.04 LTS
- **规格**: 2C4G 或以上
- **系统盘**: 40GB
- **安全组放行**:
  - `22/tcp` — SSH
  - `80/tcp` — HTTP (可选，配合 Nginx 反代)
  - `443/tcp` — HTTPS (可选，配合 SSL)
  - `5173/tcp` — 直接访问前端（如不配域名）

### 1.2 SSH 登录

```bash
ssh root@<ECS_公网IP>
```

### 1.3 安装 Docker

```bash
# 安装依赖
apt update && apt install -y ca-certificates curl

# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 安装 Docker Compose v2
apt install -y docker-compose-plugin

# 验证
docker --version && docker compose version
```

### 1.4 克隆项目

```bash
mkdir -p /opt/virtual-team && cd /opt/virtual-team
# 方式一：git clone（推荐）
git clone <你的仓库地址> .

# 方式二：scp 上传（如无仓库）
scp -r /path/to/项目\ 7：虚拟软件外包团队/* root@<ECS_IP>:/opt/virtual-team/
```

---

## 二、环境变量配置

### 2.1 创建 .env 文件

```bash
cp .env.example .env
vim .env
```

关键变量：

```bash
# ── LLM API ──────────────────────────────────────────
# DeepSeek（或其他兼容 OpenAI API 的提供商）
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat

# ── 数据库 ────────────────────────────────────────────
POSTGRES_PASSWORD=your-strong-password-here

# ── API Key 加密密钥 ──────────────────────────────────
# 生成方法: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
KEY_VAULT_SECRET=your-fernet-key-here

# ── 可选: Web 代理（如服务器需通过代理访问 LLM API）───
# HTTP_PROXY=http://your-proxy:port
# HTTPS_PROXY=http://your-proxy:port
```

### 2.2 生成必要的密钥

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## 三、部署启动

### 3.1 构建并启动

```bash
cd /opt/virtual-team
docker compose -f docker-compose.local.yml up -d --build
```

首次启动会自动：
1. 构建后端 API + Worker 镜像
2. 拉起 PostgreSQL + Redis
3. 运行数据库迁移
4. 构建并启动前端 Nginx 容器

### 3.2 验证

```bash
# 确认所有容器运行
docker ps --format "table {{.Names}}\t{{.Status}}"

# 预期输出
# virtual-team-frontend   Up (healthy)
# virtual-team-api        Up (healthy)
# virtual-team-worker     Up (healthy)
# virtual-team-redis      Up (healthy)
# virtual-team-db         Up (healthy)

# 测试后端 API
curl -s http://localhost:8080/api/models
# 预期: 返回可用模型列表（至少包含 deepseek-chat）

# 测试前端可访问
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# 预期: 200
```

### 3.3 查看日志

```bash
# API 日志
docker logs virtual-team-api -f

# Worker 日志
docker logs virtual-team-worker -f

# 前端日志
docker logs virtual-team-frontend -f
```

---

## 四、配置域名和 HTTPS（推荐）

### 4.1 方式一：Nginx 反代（简单）

在宿主机安装 Nginx：

```bash
apt install -y nginx
vim /etc/nginx/sites-available/virtual-team
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }
}
```

### 4.2 申请 SSL 证书（Certbot）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

### 4.3 安全组放行

阿里云 ECS 安全组 → 添加规则：
- `80/tcp` — HTTP
- `443/tcp` — HTTPS

此时即可通过 `https://your-domain.com` 访问。

---

## 五、数据备份

### 5.1 数据库备份

```bash
# 创建备份目录
mkdir -p /opt/backups

# 备份 PostgreSQL
docker exec virtual-team-db pg_dump -U postgres virtual_team > /opt/backups/db_$(date +%Y%m%d).sql

# 定期备份（crontab）
# 0 3 * * * docker exec virtual-team-db pg_dump -U postgres virtual_team > /opt/backups/db_$(date +\%Y\%m\%d).sql
```

### 5.2 数据卷备份

```bash
# 备份 Docker 数据卷
tar czf /opt/backups/volumes_$(date +%Y%m%d).tar.gz /var/lib/docker/volumes/virtual-team_*
```

---

## 六、运维命令速查

```bash
# 重启所有服务
docker compose -f docker-compose.local.yml restart

# 更新代码后重新构建
git pull
docker compose -f docker-compose.local.yml up -d --build

# 查看实时日志
docker compose -f docker-compose.local.yml logs -f

# 停止服务
docker compose -f docker-compose.local.yml down

# 清理未使用的镜像
docker image prune -a

# 进入容器调试
docker exec -it virtual-team-api bash
docker exec -it virtual-team-db psql -U postgres -d virtual_team
```

---

## 七、注意事项

1. **API Key 安全**：`DEEPSEEK_API_KEY` 等敏感信息通过 `.env` 文件注入，不要写死在 docker-compose 中
2. **资源限制**：当前 `mem_limit` 配置合理，Worker 2GB、API 1GB、DB 512MB
3. **时区**：服务默认使用 `Asia/Shanghai`，如需修改在 `.env` 中设置 `TZ=Asia/Shanghai`
4. **日志轮转**：Docker 日志默认不轮转，建议在 `/etc/docker/daemon.json` 中配置：
   ```json
   {
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "10m",
       "max-file": "3"
     }
   }
   ```
5. **数据库迁移**：首次启动自动执行 alembic 迁移；后续升级如遇模型变更，重启容器即可自动迁移

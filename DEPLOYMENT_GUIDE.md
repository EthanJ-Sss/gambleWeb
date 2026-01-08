# 前端项目自动化部署指南

> 本文档详细记录了如何将 Vite/React 前端项目自动化部署到 Linux 服务器的完整流程，可作为其他项目的参考模板。

## 目录

- [概述](#概述)
- [前置条件](#前置条件)
- [部署架构](#部署架构)
- [快速开始](#快速开始)
- [详细步骤](#详细步骤)
- [自动化脚本](#自动化脚本)
- [常见问题](#常见问题)

---

## 概述

本指南适用于以下场景：
- **项目类型**: Vite + React/Vue 等前端项目
- **本地环境**: Windows (PowerShell)
- **服务器**: Ubuntu/Debian Linux
- **部署方式**: 静态文件托管

## 前置条件

### 本地环境
- Node.js 和 npm
- Python 3.x（用于自动化脚本）
- paramiko 库：`pip install paramiko`

### 服务器环境
- Ubuntu/Debian Linux
- Node.js 和 npm
- sudo 权限

## 部署架构

```
┌─────────────────┐         SSH/SFTP          ┌─────────────────┐
│   本地开发机     │  ─────────────────────▶   │   Linux 服务器   │
│                 │                            │                 │
│  npm run build  │                            │  /var/www/xxx   │
│      dist/      │                            │     serve       │
└─────────────────┘                            └─────────────────┘
```

## 快速开始

### 1. 安装依赖

```powershell
# Windows PowerShell
pip install paramiko
```

### 2. 配置部署脚本

将下方的 `auto_deploy.py` 脚本复制到项目根目录，修改配置参数：

```python
# 服务器配置 - 根据实际情况修改
SERVER = "你的服务器IP"
PORT = 22
USERNAME = "ubuntu"
PASSWORD = "你的密码"
REMOTE_PATH = "/var/www/你的项目名"
WEB_PORT = 4173  # 想要使用的端口
```

### 3. 一键部署

```powershell
# 构建并部署
npm run build
python auto_deploy.py
```

---

## 详细步骤

### 步骤 1：构建项目

```powershell
# 进入项目目录
cd 项目路径

# 构建生产版本
npm run build
```

构建完成后会生成 `dist/` 目录，包含所有静态文件。

### 步骤 2：连接服务器

使用 SSH 连接到服务器：

```bash
ssh username@server_ip
```

### 步骤 3：准备服务器目录

```bash
# 创建部署目录
sudo mkdir -p /var/www/项目名

# 设置权限
sudo chown -R ubuntu:ubuntu /var/www/项目名
```

### 步骤 4：上传文件

可以使用 SCP 或 SFTP：

```powershell
# Windows PowerShell (需要输入密码)
scp -r dist/* username@server_ip:/var/www/项目名/
```

### 步骤 5：安装托管工具

```bash
# 在服务器上安装 serve
sudo npm install -g serve
```

### 步骤 6：启动服务

**临时运行（测试用）**：
```bash
cd /var/www/项目名
serve -s . -l 4173
```

**后台运行**：
```bash
nohup serve -s . -l 4173 > /dev/null 2>&1 &
```

### 步骤 7：配置 systemd 服务（推荐）

创建服务文件：

```bash
sudo nano /etc/systemd/system/项目名.service
```

内容：

```ini
[Unit]
Description=项目名 Web Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/项目名
ExecStart=/usr/bin/serve -s . -l 4173
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启用并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable 项目名
sudo systemctl start 项目名
sudo systemctl status 项目名
```

---

## 自动化脚本

### auto_deploy.py - 一键部署脚本

将此脚本保存到项目根目录：

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动化部署脚本 - 适用于 Vite/React 前端项目
使用方法: python auto_deploy.py
"""
import paramiko
import os
import sys
import io

# Windows 控制台编码修复
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ============================================================
# 配置区域 - 根据实际情况修改以下参数
# ============================================================
SERVER = "服务器IP地址"           # 例如: "192.168.1.100"
PORT = 22                         # SSH 端口，默认 22
USERNAME = "ubuntu"               # SSH 用户名
PASSWORD = "你的密码"             # SSH 密码
REMOTE_PATH = "/var/www/项目名"   # 服务器上的部署路径
LOCAL_DIST = "dist"               # 本地构建输出目录
WEB_PORT = 4173                   # Web 服务端口
# ============================================================

def upload_directory(sftp, local_path, remote_path):
    """递归上传目录"""
    for item in os.listdir(local_path):
        local_item = os.path.join(local_path, item)
        remote_item = f"{remote_path}/{item}"
        
        if os.path.isfile(local_item):
            print(f"  Uploading: {item}")
            sftp.put(local_item, remote_item)
        elif os.path.isdir(local_item):
            try:
                sftp.mkdir(remote_item)
            except:
                pass
            upload_directory(sftp, local_item, remote_item)

def main():
    print("=" * 50)
    print("  Auto Deploy Script")
    print("=" * 50)
    print(f"\nServer: {SERVER}")
    print(f"Target Port: {WEB_PORT}")
    print(f"Remote Path: {REMOTE_PATH}")
    print()
    
    # 检查 dist 目录
    if not os.path.exists(LOCAL_DIST):
        print("Error: dist directory not found!")
        print("Please run 'npm run build' first.")
        return False
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # 连接服务器
        print("Connecting to server...")
        ssh.connect(SERVER, PORT, USERNAME, PASSWORD, timeout=30)
        print("[OK] Connected!")
        
        # 准备远程目录
        print("\nPreparing remote directory...")
        ssh.exec_command(f"sudo mkdir -p {REMOTE_PATH}")
        ssh.exec_command(f"sudo chown -R {USERNAME}:{USERNAME} {REMOTE_PATH}")
        print("[OK] Directory ready!")
        
        # 清理旧文件
        print("\nCleaning old files...")
        stdin, stdout, stderr = ssh.exec_command(f"rm -rf {REMOTE_PATH}/*")
        stdout.read()
        print("[OK] Cleaned!")
        
        # 上传文件
        print("\nUploading files...")
        sftp = ssh.open_sftp()
        
        # 创建必要的目录
        for subdir in ['', 'assets']:
            try:
                sftp.mkdir(f"{REMOTE_PATH}/{subdir}")
            except:
                pass
        
        upload_directory(sftp, LOCAL_DIST, REMOTE_PATH)
        sftp.close()
        print("[OK] Upload complete!")
        
        # 停止旧服务
        print("\nStopping old services...")
        ssh.exec_command(f"pkill -f 'serve.*{WEB_PORT}' 2>/dev/null || true")
        ssh.exec_command(f"pkill -f 'python.*http.server.*{WEB_PORT}' 2>/dev/null || true")
        import time
        time.sleep(2)
        
        # 配置服务
        print("\nConfiguring web service...")
        
        # 检查 serve 是否安装
        stdin, stdout, stderr = ssh.exec_command("which serve")
        serve_path = stdout.read().decode().strip()
        
        if not serve_path:
            print("Installing 'serve'...")
            stdin, stdout, stderr = ssh.exec_command("sudo npm install -g serve 2>&1")
            stdout.read()
        
        # 启动服务
        print("Starting service...")
        cmd = f"cd {REMOTE_PATH} && nohup serve -s . -l {WEB_PORT} > /tmp/serve.log 2>&1 &"
        ssh.exec_command(cmd)
        time.sleep(3)
        
        # 验证服务
        print("\nVerifying service...")
        stdin, stdout, stderr = ssh.exec_command(f"ss -tlnp | grep {WEB_PORT}")
        result = stdout.read().decode()
        
        if str(WEB_PORT) in result:
            print("[OK] Service is running!")
        else:
            print("[WARN] Service may not be running properly")
        
        print("\n" + "=" * 50)
        print("  DEPLOYMENT COMPLETE!")
        print(f"  URL: http://{SERVER}:{WEB_PORT}")
        print("=" * 50)
        return True
            
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        ssh.close()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
```

### setup_service.py - 配置持久化服务

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置 systemd 服务，实现开机自启和持久化运行
使用方法: python setup_service.py
"""
import paramiko
import sys
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ============================================================
# 配置区域 - 根据实际情况修改
# ============================================================
SERVER = "服务器IP地址"
PORT = 22
USERNAME = "ubuntu"
PASSWORD = "你的密码"
REMOTE_PATH = "/var/www/项目名"
WEB_PORT = 4173
SERVICE_NAME = "项目名"  # systemd 服务名称
# ============================================================

SERVICE_CONTENT = f"""[Unit]
Description={SERVICE_NAME} Web Service
After=network.target

[Service]
Type=simple
User={USERNAME}
WorkingDirectory={REMOTE_PATH}
ExecStart=/usr/bin/serve -s . -l {WEB_PORT}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""

def main():
    print("Setting up persistent service...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(SERVER, PORT, USERNAME, PASSWORD, timeout=30)
        print("[OK] Connected!")
        
        # 创建服务文件
        print("Creating systemd service...")
        sftp = ssh.open_sftp()
        with sftp.file(f"/tmp/{SERVICE_NAME}.service", "w") as f:
            f.write(SERVICE_CONTENT)
        sftp.close()
        
        # 安装并启动服务
        commands = [
            f"sudo mv /tmp/{SERVICE_NAME}.service /etc/systemd/system/{SERVICE_NAME}.service",
            "sudo systemctl daemon-reload",
            f"pkill -f 'serve.*{WEB_PORT}' 2>/dev/null || true",
            f"sudo systemctl enable {SERVICE_NAME}",
            f"sudo systemctl restart {SERVICE_NAME}",
        ]
        
        for cmd in commands:
            print(f"Running: {cmd}")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            stdout.read()
        
        import time
        time.sleep(2)
        
        # 检查服务状态
        stdin, stdout, stderr = ssh.exec_command(f"sudo systemctl status {SERVICE_NAME} --no-pager")
        status = stdout.read().decode()
        print(f"\nService status:\n{status}")
        
        print("\n" + "=" * 50)
        print("  SERVICE CONFIGURED!")
        print(f"  URL: http://{SERVER}:{WEB_PORT}")
        print("  Service will auto-start on reboot")
        print("=" * 50)
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
```

---

## package.json 脚本配置

可以在 `package.json` 中添加部署命令：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && python auto_deploy.py",
    "deploy:service": "python setup_service.py"
  }
}
```

然后使用：

```powershell
npm run deploy           # 构建并部署
npm run deploy:service   # 配置持久化服务
```

---

## 常见问题

### Q1: paramiko 安装失败

```powershell
# 尝试使用 py 命令
py -m pip install paramiko

# 或指定 Python 版本
python3 -m pip install paramiko
```

### Q2: SSH 连接超时

检查：
- 服务器防火墙是否开放 22 端口
- 服务器 IP 是否正确
- 网络是否可达

```bash
# 在服务器上检查 SSH 服务
sudo systemctl status sshd
```

### Q3: 端口无法访问

检查服务器防火墙：

```bash
# Ubuntu/Debian
sudo ufw allow 4173
sudo ufw status

# 或使用 iptables
sudo iptables -A INPUT -p tcp --dport 4173 -j ACCEPT
```

### Q4: serve 命令找不到

```bash
# 确保 npm 全局目录在 PATH 中
export PATH=$PATH:$(npm config get prefix)/bin

# 或使用完整路径
/usr/local/bin/serve -s . -l 4173
```

### Q5: systemd 服务启动失败

```bash
# 查看详细日志
sudo journalctl -u 服务名 -f

# 检查服务文件语法
sudo systemctl status 服务名
```

### Q6: 文件上传后网站显示空白

可能原因：
1. 路由问题 - 确保使用 `serve -s` 参数启用 SPA 模式
2. 资源路径问题 - 检查 `vite.config.ts` 中的 `base` 配置

---

## 服务管理命令

```bash
# 启动服务
sudo systemctl start 服务名

# 停止服务
sudo systemctl stop 服务名

# 重启服务
sudo systemctl restart 服务名

# 查看状态
sudo systemctl status 服务名

# 查看日志
sudo journalctl -u 服务名 -f

# 禁用开机自启
sudo systemctl disable 服务名

# 启用开机自启
sudo systemctl enable 服务名
```

---

## 安全建议

1. **使用 SSH 密钥认证**：避免在脚本中存储明文密码
2. **配置防火墙**：只开放必要的端口
3. **使用 HTTPS**：生产环境建议配置 Nginx 反向代理 + SSL
4. **定期更新**：保持服务器软件更新

---

## 高级配置：Nginx 反向代理

如果需要使用 Nginx 作为反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:4173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2025-12-25 | 1.0 | 初始版本 |

---

*本文档基于 LifeKline 项目部署实践编写*


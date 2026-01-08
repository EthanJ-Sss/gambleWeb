# -*- coding: utf-8 -*-
import paramiko

SERVER = "43.173.170.5"
USER = "ubuntu"
PASSWD = "MTc1MjA0NDQ0MQ"
PORT = 4175

print("Connecting...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER, username=USER, password=PASSWD, timeout=60)
print("Connected!\n")

# 检查进程
print("=== Checking process ===")
stdin, stdout, stderr = ssh.exec_command("ps aux | grep http.server | grep -v grep")
print(stdout.read().decode())

# 检查端口监听
print("=== Checking port listening ===")
stdin, stdout, stderr = ssh.exec_command(f"netstat -tlnp 2>/dev/null | grep {PORT} || ss -tlnp | grep {PORT}")
print(stdout.read().decode())

# 检查防火墙状态
print("=== Checking firewall (ufw) ===")
stdin, stdout, stderr = ssh.exec_command("sudo ufw status 2>/dev/null || echo 'ufw not available'")
print(stdout.read().decode())

# 检查iptables
print("=== Checking iptables ===")
stdin, stdout, stderr = ssh.exec_command(f"sudo iptables -L -n 2>/dev/null | head -20 || echo 'iptables check failed'")
print(stdout.read().decode())

# 本地curl测试
print("=== Local curl test ===")
stdin, stdout, stderr = ssh.exec_command(f"curl -v http://127.0.0.1:{PORT}/ 2>&1 | head -20")
print(stdout.read().decode())

# 检查文件
print("=== Checking files ===")
stdin, stdout, stderr = ssh.exec_command("ls -la /home/ubuntu/gamble/")
print(stdout.read().decode())

ssh.close()


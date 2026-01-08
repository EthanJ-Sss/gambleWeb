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

# 添加防火墙规则
print(f"Adding firewall rule for port {PORT}...")
stdin, stdout, stderr = ssh.exec_command(f"sudo ufw allow {PORT}/tcp")
print(stdout.read().decode())
print(stderr.read().decode())

# 重新加载防火墙
print("Reloading firewall...")
stdin, stdout, stderr = ssh.exec_command("sudo ufw reload")
print(stdout.read().decode())

# 验证
print("\nVerifying firewall rule...")
stdin, stdout, stderr = ssh.exec_command(f"sudo ufw status | grep {PORT}")
print(stdout.read().decode())

# 外部访问测试
print("\nTesting external access...")
stdin, stdout, stderr = ssh.exec_command(f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{PORT}/")
print(f"Local test: {stdout.read().decode()}")

ssh.close()
print(f"\nDone! Try accessing: http://{SERVER}:{PORT}")


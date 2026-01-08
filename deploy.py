#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动部署脚本 - 将竞猜平台部署到远程服务器
"""
import paramiko
import os
import sys
import time

# 服务器配置
SERVER = "43.173.170.5"
USERNAME = "ubuntu"
PASSWORD = "MTc1MjA0NDQ0MQ"
PORT = 4175
REMOTE_DIR = "/home/ubuntu/gamble"

# 本地文件
LOCAL_FILES = ["index.html", "style.css", "app.js"]

def main():
    print("[*] Starting deployment...")
    
    # 创建SSH客户端
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"[*] Connecting to server {SERVER}...")
        ssh.connect(SERVER, username=USERNAME, password=PASSWORD, timeout=30)
        print("[+] Connected successfully!")
        
        # 创建目录
        print(f"[*] Creating directory {REMOTE_DIR}...")
        stdin, stdout, stderr = ssh.exec_command(f"mkdir -p {REMOTE_DIR}")
        stdout.read()
        
        # 使用SFTP传输文件
        print("[*] Uploading files...")
        sftp = ssh.open_sftp()
        
        local_dir = os.path.dirname(os.path.abspath(__file__))
        for filename in LOCAL_FILES:
            local_path = os.path.join(local_dir, filename)
            remote_path = f"{REMOTE_DIR}/{filename}"
            print(f"    {filename} -> {remote_path}")
            sftp.put(local_path, remote_path)
        
        sftp.close()
        print("[+] Files uploaded successfully!")
        
        # 停止旧进程
        print("[*] Stopping old process...")
        stdin, stdout, stderr = ssh.exec_command(f"pkill -f 'python.*http.server.*{PORT}' 2>/dev/null; sleep 1")
        stdout.read()
        stdin, stdout, stderr = ssh.exec_command(f"fuser -k {PORT}/tcp 2>/dev/null; sleep 1")
        stdout.read()
        
        time.sleep(2)
        
        # 启动HTTP服务器
        print(f"[*] Starting HTTP server on port {PORT}...")
        
        start_cmd = f"cd {REMOTE_DIR} && nohup python3 -m http.server {PORT} --bind 0.0.0.0 > /tmp/gamble_server.log 2>&1 &"
        stdin, stdout, stderr = ssh.exec_command(start_cmd)
        stdout.read()
        
        time.sleep(3)
        
        # 验证服务器是否启动
        stdin, stdout, stderr = ssh.exec_command(f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{PORT}/ 2>/dev/null || echo 'failed'")
        status = stdout.read().decode().strip()
        
        # 检查进程
        stdin, stdout, stderr = ssh.exec_command(f"pgrep -f 'http.server.*{PORT}' || echo 'no process'")
        pid = stdout.read().decode().strip()
        
        print(f"[*] HTTP Status: {status}, Process: {pid}")
        
        if status == "200" or (pid and pid != "no process"):
            print("[+] Server started successfully!")
            print("")
            print("=" * 50)
            print(f"  Gamble Platform Deployed!")
            print(f"  URL: http://{SERVER}:{PORT}")
            print("=" * 50)
        else:
            # 尝试查看日志
            stdin, stdout, stderr = ssh.exec_command("cat /tmp/gamble_server.log 2>/dev/null | tail -5")
            log = stdout.read().decode().strip()
            print(f"[!] Server may not have started properly")
            print(f"[*] Log: {log}")
            print(f"[*] Try visiting: http://{SERVER}:{PORT}")
        
    except Exception as e:
        print(f"[-] Deployment failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        ssh.close()
        print("[*] Connection closed.")

if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
Node.js 项目部署脚本 - 将竞猜平台部署到远程服务器
"""
import paramiko
import os
import stat
import time

# 服务器配置
SERVER = "43.173.170.5"
USER = "ubuntu"
PASSWD = "MTc1MjA0NDQ0MQ"
PORT = 4175
DIR = "/home/ubuntu/gamble"

# 需要上传的目录和文件
DIRS_TO_UPLOAD = ["server", "client", "data"]
FILES_TO_UPLOAD = ["package.json", "package-lock.json", "BettingPresets.csv", "LevelBossConfig.csv", "SkillConfig.csv"]

def upload_directory(sftp, local_dir, remote_dir):
    """递归上传目录"""
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        sftp.mkdir(remote_dir)
    
    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = f"{remote_dir}/{item}"
        
        if os.path.isdir(local_path):
            upload_directory(sftp, local_path, remote_path)
        else:
            print(f"    {local_path} -> {remote_path}")
            sftp.put(local_path, remote_path)

def main():
    print("[*] Starting Node.js deployment...")
    
    # 创建SSH客户端
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"[*] Connecting to server {SERVER}...")
        ssh.connect(SERVER, username=USER, password=PASSWD, timeout=60)
        print("[+] Connected successfully!")
        
        # 停止旧进程
        print("[*] Stopping old process...")
        ssh.exec_command(f"pkill -f 'node.*server/index.js' 2>/dev/null || true")
        ssh.exec_command(f"pkill -f 'node.*gamble' 2>/dev/null || true")
        ssh.exec_command(f"fuser -k {PORT}/tcp 2>/dev/null || true")
        time.sleep(2)
        
        # 清理并创建目录
        print(f"[*] Preparing directory {DIR}...")
        stdin, stdout, stderr = ssh.exec_command(f"rm -rf {DIR} && mkdir -p {DIR}")
        stdout.read()
        
        # 使用SFTP传输文件
        print("[*] Uploading files...")
        sftp = ssh.open_sftp()
        
        local_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 上传目录
        for dir_name in DIRS_TO_UPLOAD:
            local_path = os.path.join(local_dir, dir_name)
            if os.path.exists(local_path):
                print(f"  [*] Uploading directory: {dir_name}/")
                upload_directory(sftp, local_path, f"{DIR}/{dir_name}")
        
        # 上传文件
        for filename in FILES_TO_UPLOAD:
            local_path = os.path.join(local_dir, filename)
            if os.path.exists(local_path):
                print(f"    {filename} -> {DIR}/{filename}")
                sftp.put(local_path, f"{DIR}/{filename}")
        
        sftp.close()
        print("[+] Files uploaded successfully!")
        
        # 安装依赖
        print("[*] Installing npm dependencies...")
        stdin, stdout, stderr = ssh.exec_command(f"cd {DIR} && npm install --production 2>&1")
        output = stdout.read().decode()
        errors = stderr.read().decode()
        if errors:
            print(f"  npm stderr: {errors[:500]}")
        print("[+] Dependencies installed!")
        
        # 启动Node.js服务器
        print(f"[*] Starting Node.js server on port {PORT}...")
        start_cmd = f"cd {DIR} && nohup env PORT={PORT} node server/index.js > /tmp/gamble_node.log 2>&1 &"
        stdin, stdout, stderr = ssh.exec_command(start_cmd)
        stdout.read()
        
        time.sleep(3)
        
        # 验证服务器是否启动
        stdin, stdout, stderr = ssh.exec_command(f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{PORT}/ 2>/dev/null || echo 'failed'")
        status = stdout.read().decode().strip()
        
        # 检查进程
        stdin, stdout, stderr = ssh.exec_command(f"pgrep -f 'node.*server/index.js' || echo 'no process'")
        pid = stdout.read().decode().strip()
        
        print(f"[*] HTTP Status: {status}, Process PID: {pid}")
        
        if status == "200" or status == "302" or (pid and pid != "no process"):
            print("[+] Server started successfully!")
            print("")
            print("=" * 60)
            print(f"  🎮 对战竞猜平台已部署!")
            print(f"")
            print(f"  主页:     http://{SERVER}:{PORT}")
            print(f"  庄家端:   http://{SERVER}:{PORT}/dealer")
            print(f"  玩家端:   http://{SERVER}:{PORT}/player")
            print("=" * 60)
        else:
            # 查看日志
            stdin, stdout, stderr = ssh.exec_command("cat /tmp/gamble_node.log 2>/dev/null | tail -10")
            log = stdout.read().decode().strip()
            print(f"[!] Server may not have started properly")
            print(f"[*] Log:\n{log}")
            print(f"[*] Try visiting: http://{SERVER}:{PORT}")
        
    except Exception as e:
        print(f"[-] Deployment failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()
        print("[*] Connection closed.")

if __name__ == "__main__":
    main()

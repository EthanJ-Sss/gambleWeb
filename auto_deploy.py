#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动化部署脚本 - Node.js Socket.IO 项目
使用方法: python auto_deploy.py
"""
import paramiko
import os
import sys
import io
import time

# Windows 控制台编码修复
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ============================================================
# 配置区域
# ============================================================
SERVER = "43.173.170.5"
PORT = 22
USERNAME = "ubuntu"
PASSWORD = "MTc1MjA0NDQ0MQ"
REMOTE_PATH = "/home/ubuntu/gamble"
WEB_PORT = 4175

# 需要上传的目录和文件
DIRS_TO_UPLOAD = ["server", "client", "data"]
FILES_TO_UPLOAD = ["package.json", "package-lock.json", "BettingPresets.csv", "LevelBossConfig.csv", "SkillConfig.csv"]
# ============================================================

def upload_directory(sftp, local_path, remote_path):
    """递归上传目录"""
    try:
        sftp.stat(remote_path)
    except FileNotFoundError:
        sftp.mkdir(remote_path)
    
    for item in os.listdir(local_path):
        local_item = os.path.join(local_path, item)
        remote_item = f"{remote_path}/{item}"
        
        if os.path.isfile(local_item):
            print(f"    {item}")
            sftp.put(local_item, remote_item)
        elif os.path.isdir(local_item):
            try:
                sftp.mkdir(remote_item)
            except:
                pass
            upload_directory(sftp, local_item, remote_item)

def main():
    print("=" * 60)
    print("  Node.js 项目自动部署脚本")
    print("=" * 60)
    print(f"\n服务器: {SERVER}")
    print(f"端口: {WEB_PORT}")
    print(f"目标路径: {REMOTE_PATH}")
    print()
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # 连接服务器
        print("[*] 连接服务器...")
        ssh.connect(SERVER, PORT, USERNAME, PASSWORD, timeout=60)
        print("[OK] 连接成功!")
        
        # 停止旧进程
        print("\n[*] 停止旧进程...")
        ssh.exec_command(f"pkill -f 'node.*server/index.js' 2>/dev/null || true")
        ssh.exec_command(f"pkill -f 'node.*gamble' 2>/dev/null || true")
        ssh.exec_command(f"fuser -k {WEB_PORT}/tcp 2>/dev/null || true")
        time.sleep(2)
        print("[OK] 旧进程已停止!")
        
        # 清理并创建目录
        print("\n[*] 准备远程目录...")
        stdin, stdout, stderr = ssh.exec_command(f"rm -rf {REMOTE_PATH} && mkdir -p {REMOTE_PATH}")
        stdout.read()
        print("[OK] 目录已准备!")
        
        # 上传文件
        print("\n[*] 上传文件...")
        sftp = ssh.open_sftp()
        
        local_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 上传目录
        for dir_name in DIRS_TO_UPLOAD:
            local_path = os.path.join(local_dir, dir_name)
            if os.path.exists(local_path):
                print(f"  [目录] {dir_name}/")
                upload_directory(sftp, local_path, f"{REMOTE_PATH}/{dir_name}")
        
        # 上传文件
        print("  [文件]")
        for filename in FILES_TO_UPLOAD:
            local_path = os.path.join(local_dir, filename)
            if os.path.exists(local_path):
                print(f"    {filename}")
                sftp.put(local_path, f"{REMOTE_PATH}/{filename}")
        
        sftp.close()
        print("[OK] 文件上传完成!")
        
        # 安装依赖
        print("\n[*] 安装 npm 依赖...")
        stdin, stdout, stderr = ssh.exec_command(f"cd {REMOTE_PATH} && npm install --production 2>&1")
        output = stdout.read().decode()
        print("[OK] 依赖安装完成!")
        
        # 启动 Node.js 服务器
        print(f"\n[*] 启动 Node.js 服务器 (端口 {WEB_PORT})...")
        start_cmd = f"cd {REMOTE_PATH} && nohup env PORT={WEB_PORT} node server/index.js > /tmp/gamble_node.log 2>&1 &"
        ssh.exec_command(start_cmd)
        time.sleep(3)
        
        # 验证服务
        print("\n[*] 验证服务...")
        stdin, stdout, stderr = ssh.exec_command(f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{WEB_PORT}/ 2>/dev/null || echo 'failed'")
        status = stdout.read().decode().strip()
        
        stdin, stdout, stderr = ssh.exec_command(f"pgrep -f 'node.*server/index.js' || echo ''")
        pid = stdout.read().decode().strip()
        
        print(f"    HTTP 状态: {status}")
        print(f"    进程 PID: {pid if pid else '未找到'}")
        
        if status in ["200", "302", "304"] or pid:
            print("\n[OK] 服务启动成功!")
            print("\n" + "=" * 60)
            print("  🎮 对战竞猜平台已部署!")
            print("")
            print(f"  主页:     http://{SERVER}:{WEB_PORT}")
            print(f"  庄家端:   http://{SERVER}:{WEB_PORT}/dealer")
            print(f"  玩家端:   http://{SERVER}:{WEB_PORT}/player")
            print("=" * 60)
        else:
            # 查看日志
            stdin, stdout, stderr = ssh.exec_command("cat /tmp/gamble_node.log 2>/dev/null | tail -15")
            log = stdout.read().decode().strip()
            print("\n[!] 服务可能未正常启动")
            print(f"[*] 日志:\n{log}")
            print(f"\n[*] 尝试访问: http://{SERVER}:{WEB_PORT}")
        
        return True
            
    except Exception as e:
        print(f"\n[错误] 部署失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        ssh.close()
        print("\n[*] 连接已关闭")

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

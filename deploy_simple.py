# -*- coding: utf-8 -*-
import paramiko
import os

SERVER = "43.173.170.5"
USER = "ubuntu"
PASSWD = "MTc1MjA0NDQ0MQ"
PORT = 4175
DIR = "/home/ubuntu/gamble"

print("Connecting...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER, username=USER, password=PASSWD, timeout=60)
print("Connected!")

print("Creating directory...")
ssh.exec_command(f"mkdir -p {DIR}")

print("Uploading files...")
sftp = ssh.open_sftp()
base = os.path.dirname(os.path.abspath(__file__))
for f in ["index.html", "style.css", "app.js", "BettingPresets.csv"]:
    print(f"  Uploading {f}...")
    sftp.put(os.path.join(base, f), f"{DIR}/{f}")
sftp.close()
print("Files uploaded!")

print("Stopping old server...")
ssh.exec_command(f"pkill -f 'http.server.*{PORT}' || true")
ssh.exec_command(f"fuser -k {PORT}/tcp || true")

import time
time.sleep(2)

print(f"Starting server on port {PORT}...")
cmd = f"cd {DIR} && nohup python3 -m http.server {PORT} --bind 0.0.0.0 > /dev/null 2>&1 &"
ssh.exec_command(cmd)

time.sleep(2)
print("Verifying...")
stdin, stdout, stderr = ssh.exec_command(f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{PORT}/")
code = stdout.read().decode().strip()
print(f"HTTP code: {code}")

ssh.close()
print("Done!")
print(f"\nAccess URL: http://{SERVER}:{PORT}")


#!/usr/bin/env python3
import subprocess
import re
import time
import sys
import os
import urllib.request

URL_FILE = os.path.abspath('active_tunnel.txt')
JSON_FILE = os.path.abspath('public/active_tunnel.json')

def run_supervisor():
    print('[Supervisor] Starting Cloudflare Tunnel Auto-Healer...')
    
    while True:
        print('[Supervisor] Launching fresh cloudflared tunnel (HTTP/2)...')
        cmd = [
            'cloudflared',
            'tunnel',
            '--url', 'http://127.0.0.1:3000',
            '--protocol', 'http2'
        ]
        
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        current_url = None
        consecutive_failures = 0
        last_check_time = time.time()
        
        while True:
            # Check if process died
            ret = proc.poll()
            if ret is not None:
                print(f'[Supervisor] cloudflared exited with code {ret}. Restarting in 2s...')
                time.sleep(2)
                break
                
            # Read available output without blocking forever
            line = proc.stdout.readline()
            if line:
                line_str = line.strip()
                # Check for tunnel URL
                match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line_str)
                if match:
                    current_url = match.group(0)
                    print(f'\n======================================================')
                    print(f'🚀 [TUNNEL READY]: {current_url}')
                    print(f'======================================================\n')
                    with open(URL_FILE, 'w') as f:
                        f.write(current_url)
                    with open(JSON_FILE, 'w') as f:
                        f.write(f'{{"url": "{current_url}"}}')
                    sys.stdout.flush()
                
                # Check for fatal revoked tunnel error
                if 'Unauthorized: Tunnel not found' in line_str or 'tunnel not found' in line_str.lower():
                    print('[Supervisor] Detected revoked quick tunnel! Killing and refreshing...')
                    proc.kill()
                    proc.wait()
                    time.sleep(1)
                    break

            # Periodically test health if we have a URL
            if current_url and (time.time() - last_check_time > 40):
                last_check_time = time.time()
                try:
                    req = urllib.request.Request(
                        f'{current_url}/bkk',
                        headers={'User-Agent': 'Mozilla/5.0'}
                    )
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        if resp.status == 200:
                            consecutive_failures = 0
                        else:
                            consecutive_failures += 1
                except Exception as e:
                    consecutive_failures += 1
                    print(f'[Supervisor] Health check failed ({consecutive_failures}/3): {e}')
                    
                if consecutive_failures >= 3:
                    print('[Supervisor] 3 consecutive health check failures! Re-spawning tunnel...')
                    proc.kill()
                    proc.wait()
                    time.sleep(1)
                    break

if __name__ == '__main__':
    run_supervisor()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import threading
import queue
import re
import os
import json
import asyncio
import time
import sys

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DownloadRequest(BaseModel):
    url: str
    filename: str = "livestream"
    quality: str = "best"
    is_live: bool = True

download_queue = queue.Queue()
active_processes = {}

def run_download(process_id: str, command: list, ws_queue: queue.Queue):
    """
    Runs the download subprocess and pipes output to a queue for the websocket.
    """
    print(f"Starting download process {process_id}: {' '.join(command)}")
    try:
        # Use Popen to capture stdout/stderr creatively
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        active_processes[process_id] = process

        for line in iter(process.stdout.readline, ''):
            if process_id not in active_processes:
                 # Process was likely killed manually
                break
            ws_queue.put({"type": "log", "message": line.strip()})
            # Attempt to parse progress if possible (yt-dlp specific)
            if "[download]" in line and "%" in line:
                 ws_queue.put({"type": "progress", "raw": line.strip()})
        
        process.stdout.close()
        return_code = process.wait()
        
        if return_code == 0:
            ws_queue.put({"type": "status", "status": "completed"})
        else:
            ws_queue.put({"type": "status", "status": "failed", "code": return_code})

    except Exception as e:
        ws_queue.put({"type": "error", "message": str(e)})
    finally:
        if process_id in active_processes:
            del active_processes[process_id]
        ws_queue.put(None) # Signal end of stream

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    
    # Get the running loop to interact with it from threads
    loop = asyncio.get_running_loop()
    
    # Create a unique queue for this connection
    ws_queue = asyncio.Queue()
    
    # Initial Connection Log
    await websocket.send_json({"type": "log", "message": "[SYSTEM] Uplink established. Ready for input."})
    
    # FFmpeg Logic Check
    import shutil
    if not shutil.which("ffmpeg"):
        await websocket.send_json({"type": "log", "message": "[WARN] FFmpeg binaries not detected in PATH. Merging may fail."})
    else:
        await websocket.send_json({"type": "log", "message": "[SYSTEM] FFmpeg detected. Audio/Video merging enabled."})

    try:
        while True:
            try:
                # Check for incoming messages with a timeout
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                    message = json.loads(data)
                    
                    if message['action'] == 'start_download':
                        url = message['url']
                        quality = message.get('quality', 'best')
                        
                        # Generate timestamp for filename (using . instead of : for Windows compatibility)
                        time_str = time.strftime("[%H.%M]")

                        # Command construction
                        cmd = [
                            sys.executable, "-m", "yt_dlp",
                            url,
                            "-o", f"downloads/%(title)s {time_str}.%(ext)s",
                            "--no-part", 
                            "--restrict-filenames",
                        ]
                        
                        if quality == 'worst':
                            cmd.extend(["-f", "worst"])
                        
                        print(f"[SYSTEM] Executing: {' '.join(cmd)}")
                        await websocket.send_json({"type": "log", "message": f"[CMD] Initializing capture sequence..."})
                        
                        # Ensure download dir exists
                        os.makedirs("downloads", exist_ok=True)
                        
                        try:
                            # Start process with DEVNULL stdin to prevent interactive hangs
                            process = subprocess.Popen(
                                cmd,
                                stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL,
                                text=True,
                                bufsize=1,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                            )
                            
                            active_processes[client_id] = process
                            
                            # Start a background task to read stdout and push to queue
                            def read_stream(proc, q, loop_ref):
                                try:
                                    for line in iter(proc.stdout.readline, ''):
                                        if line:
                                            # Safely dispatch to async loop
                                            asyncio.run_coroutine_threadsafe(q.put({"type": "log", "message": line.strip()}), loop_ref)
                                    proc.stdout.close()
                                    ret = proc.wait()
                                    asyncio.run_coroutine_threadsafe(q.put({"type": "status", "status": "completed" if ret == 0 else "failed"}), loop_ref)
                                except Exception as err:
                                    asyncio.run_coroutine_threadsafe(q.put({"type": "log", "message": f"[ERROR] Stream reader: {err}"}), loop_ref)

                            thread = threading.Thread(target=read_stream, args=(process, ws_queue, loop))
                            thread.daemon = True
                            thread.start()
                            
                        except Exception as e:
                            print(f"[FATAL] Could not start subprocess: {e}")
                            await websocket.send_json({"type": "log", "message": f"[FATAL] Startup failed: {str(e)}"})
                            await websocket.send_json({"type": "status", "status": "failed"})

                    elif message['action'] == 'stop_download':
                        if client_id in active_processes:
                            p = active_processes[client_id]
                            try:
                                if os.name == 'nt':
                                    subprocess.call(['taskkill', '/F', '/T', '/PID', str(p.pid)])
                                else:
                                    p.terminate()
                            except Exception as e:
                                print(f"Error killing process: {e}")
                            
                            if client_id in active_processes:
                                del active_processes[client_id]
                                
                            await websocket.send_json({"type": "status", "status": "stopped"})
                            await websocket.send_json({"type": "log", "message": "[SYSTEM] Sequence terminated by user."})
                
                except asyncio.TimeoutError:
                    pass
                
                # Check for outgoing messages in the queue
                while not ws_queue.empty():
                    msg = await ws_queue.get()
                    await websocket.send_json(msg)
                    
            except WebSocketDisconnect:
                break
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if client_id in active_processes:
            try:
                active_processes[client_id].terminate()
                del active_processes[client_id]
            except:
                pass
        
@app.post("/open_folder")
def open_folder():
    path = os.path.abspath("downloads")
    if not os.path.exists(path):
        os.makedirs(path)
    
    if os.name == 'nt':  # Windows
        os.startfile(path)
    elif os.name == 'posix':  # macOS/Linux
        subprocess.call(['open', path] if sys.platform == 'darwin' else ['xdg-open', path])
    return {"status": "opened"}

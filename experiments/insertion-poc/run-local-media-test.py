#!/usr/bin/env python3
"""Own the localhost server for exactly one test process (portable across CI steps)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import subprocess,sys,threading
root=Path(__file__).resolve().parent
if len(sys.argv)<2:raise SystemExit('Usage: run-local-media-test.py test-script.py [arguments]')
with ThreadingHTTPServer(('127.0.0.1',8765),partial(SimpleHTTPRequestHandler,directory=str(root/'dist'))) as server:
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        result=subprocess.run([sys.executable,str(root/sys.argv[1]),*sys.argv[2:]])
    finally:
        server.shutdown();thread.join(timeout=5)
raise SystemExit(result.returncode)

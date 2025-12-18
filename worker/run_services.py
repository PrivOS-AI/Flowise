#!/usr/bin/env python3
"""
Script to run both FastAPI Queue Service and Worker
This script starts both services concurrently using subprocess
"""

import subprocess
import sys
import os
import signal
import time
from pathlib import Path
from colorama import Fore, Style, init

# Initialize colorama
init()

# Get the worker directory
worker_dir = Path(__file__).parent

def signal_handler(sig, frame):
    """Handle Ctrl+C to terminate both processes"""
    print(f"\n{Fore.YELLOW}🛑 Shutting down services...{Style.RESET_ALL}")
    sys.exit(0)

def run_services():
    """Run both FastAPI and Worker services"""

    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)

    print(f"""
╔══════════════════════════════════════════════════════════╗
║              STARTING FILE PROCESSING SERVICES           ║
╚══════════════════════════════════════════════════════════╝

{Fore.GREEN}🚀 Starting FastAPI Queue Service and Worker...{Style.RESET_ALL}
""")

    # Define service paths
    fastapi_path = worker_dir / "src" / "main.py"
    worker_path = worker_dir / "apps" / "main.py"

    # Check if files exist
    if not fastapi_path.exists():
        print(f"{Fore.RED}❌ FastAPI main.py not found at {fastapi_path}{Style.RESET_ALL}")
        sys.exit(1)

    if not worker_path.exists():
        print(f"{Fore.RED}❌ Worker main.py not found at {worker_path}{Style.RESET_ALL}")
        sys.exit(1)

    # Start FastAPI service
    print(f"{Fore.BLUE}📡 Starting FastAPI Queue Service...{Style.RESET_ALL}")
    fastapi_env = os.environ.copy()
    fastapi_env.update({
        "PYTHONPATH": str(worker_dir / "src"),
        "ENV_FILE": str(worker_dir / ".env.fastapi")
    })

    fastapi_process = subprocess.Popen(
        [sys.executable, "src/main.py"],
        env=fastapi_env,
        cwd=str(worker_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        bufsize=1
    )

    # Start Worker service
    print(f"{Fore.BLUE}⚙️ Starting Worker Service...{Style.RESET_ALL}")
    worker_env = os.environ.copy()
    worker_env.update({
        "PYTHONPATH": str(worker_dir / "apps") + ":" + str(worker_dir),
        "ENV_FILE": str(worker_dir / ".env")
    })

    worker_process = subprocess.Popen(
        [sys.executable, "apps/main.py"],
        env=worker_env,
        cwd=str(worker_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        bufsize=1
    )

    print(f"{Fore.GREEN}✅ Both services started successfully!{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}Press Ctrl+C to stop both services{Style.RESET_ALL}")
    print(f"""
{Fore.CYAN}═ Service URLs:{Style.RESET_ALL}
  ├─ FastAPI API: http://localhost:8000
  ├─ FastAPI Docs: http://localhost:8000/docs
  └─ FastAPI Health: http://localhost:8000/health

{Fore.CYAN}═ Logs:{Style.RESET_ALL}
""")

    try:
        # Monitor both processes and print their output
        while True:
            # Check FastAPI output
            if fastapi_process.poll() is not None:
                print(f"{Fore.RED}❌ FastAPI service stopped with code {fastapi_process.returncode}{Style.RESET_ALL}")
                worker_process.terminate()
                break

            # Check Worker output
            if worker_process.poll() is not None:
                print(f"{Fore.RED}❌ Worker service stopped with code {worker_process.returncode}{Style.RESET_ALL}")
                fastapi_process.terminate()
                break

            # Read and print output from both services
            # FastAPI output (prefix with [API])
            line = fastapi_process.stdout.readline()
            if line:
                print(f"{Fore.CYAN}[API]{Style.RESET_ALL} {line.strip()}")

            # Worker output (prefix with [WORKER])
            line = worker_process.stdout.readline()
            if line:
                print(f"{Fore.GREEN}[WORKER]{Style.RESET_ALL} {line.strip()}")

            time.sleep(0.01)  # Small delay to prevent busy loop

    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}🛑 Stopping services...{Style.RESET_ALL}")

    finally:
        # Terminate both processes
        if fastapi_process.poll() is None:
            fastapi_process.terminate()
            fastapi_process.wait()

        if worker_process.poll() is None:
            worker_process.terminate()
            worker_process.wait()

        print(f"{Fore.GREEN}✅ All services stopped{Style.RESET_ALL}")

if __name__ == "__main__":
    run_services()
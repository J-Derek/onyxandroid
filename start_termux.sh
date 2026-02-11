#!/bin/bash

# Onyx Termux Master Startup Script
# --------------------------------
# Deployment: Desktop Build -> Mobile Serve
# Single Server: FastAPI (Port 8000)

# 1. Enable Wake Lock (Prevent CPU Sleep)
termux-wake-lock

# 2. Get Local IP for notification
LOCAL_IP=$(ip -4 addr show wlan0 | grep inet | awk '{print $2}' | cut -d/ -f1)

# 3. Send Notification
termux-notification --title "Onyx Server" --content "Starting at http://$LOCAL_IP:8000"

# 4. Cleanup & Restart tmux Session
tmux kill-session -t onyx 2>/dev/null

# 5. Start Uvicorn in tmux (Background)
# --host 0.0.0.0: Expose to Wi-Fi
# --workers 1: Save battery/RAM on mobile
# PYTHONUNBUFFERED=1: Ensure logs show up in tmux
tmux new-session -d -s onyx "cd ~/onyx-main/backend && PYTHONUNBUFFERED=1 uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"

# 6. Success Toast
termux-toast "Onyx Server started at http://$LOCAL_IP:8000"

echo "Onyx is now running in a tmux session named 'onyx'."
echo "Access it on your phone: http://localhost:8000"
echo "Access it on Wi-Fi: http://$LOCAL_IP:8000"
echo "To view logs, run: tmux attach -t onyx"

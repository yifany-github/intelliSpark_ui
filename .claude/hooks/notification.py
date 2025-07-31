#!/usr/bin/env python3

import sys
import json
import subprocess
import platform

def play_notification_sound():
    """Play a simple notification sound based on the operating system"""
    try:
        system = platform.system()
        
        if system == "Darwin":  # macOS
            # Play system notification sound
            subprocess.run(["afplay", "/System/Library/Sounds/Glass.aiff"], check=False)
        elif system == "Linux":
            # Try to play a system sound on Linux
            subprocess.run(["paplay", "/usr/share/sounds/alsa/Front_Left.wav"], check=False)
        elif system == "Windows":
            # Windows system beep
            import winsound
            winsound.MessageBeep(winsound.MB_ICONASTERISK)
        else:
            print("🔔 Notification!")
            
    except Exception as e:
        # Fallback: just print a notification
        print(f"🔔 Claude notification! ({e})")

def main():
    try:
        # Read input data (optional - we might not need it for simple sound)
        input_data = sys.stdin.read()
        
        # Play notification sound
        play_notification_sound()
        
        # Optional: print what triggered the notification
        if input_data.strip():
            try:
                data = json.loads(input_data)
                print(f"🔔 Claude needs attention!")
            except json.JSONDecodeError:
                print(f"🔔 Claude notification!")
        else:
            print(f"🔔 Claude notification!")
            
    except Exception as e:
        print(f"Notification hook error: {e}")
        sys.exit(0)  # Don't fail the main process

if __name__ == "__main__":
    main()
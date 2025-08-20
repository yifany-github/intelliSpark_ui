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
            pass  # Silent notification
            
    except Exception as e:
        # Silent fail to avoid interfering with Claude output
        pass

def main():
    try:
        # Read input data (optional - we might not need it for simple sound)
        input_data = sys.stdin.read()
        
        # Play notification sound
        play_notification_sound()
        
        # Don't print anything to avoid interfering with Claude output
            
    except Exception as e:
        # Silent fail to avoid interfering with Claude output
        sys.exit(0)  # Don't fail the main process

if __name__ == "__main__":
    main()
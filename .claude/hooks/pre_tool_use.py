#!/usr/bin/env python3

import sys
import json
import subprocess
import platform

def play_notification_sound():
    """Play a quick notification sound"""
    try:
        system = platform.system()
        
        if system == "Darwin":  # macOS
            # Play a sharp, quick dot sound
            subprocess.run(["afplay", "/System/Library/Sounds/Pop.aiff"], check=False)
        elif system == "Linux":
            subprocess.run(["paplay", "/usr/share/sounds/alsa/Front_Left.wav"], check=False)
        elif system == "Windows":
            import winsound
            winsound.MessageBeep(winsound.MB_ICONASTERISK)
            
    except Exception as e:
        # Silent fail - don't interrupt the main process
        pass

def main():
    try:
        # Read input data
        input_data = sys.stdin.read()
        if not input_data.strip():
            sys.exit(0)
        
        data = json.loads(input_data)
        
        # Get tool name
        tool_name = data.get('tool_name', 'Unknown')
        
        # Skip certain tools to avoid too many notifications
        skip_tools = ['LS', 'TodoWrite']
        if tool_name in skip_tools:
            sys.exit(0)
        
        # Debug: print when hook is triggered
        print(f"🔔 PreToolUse hook triggered for tool: {tool_name}")
        
        # Play a quick notification sound
        play_notification_sound()
        
    except Exception as e:
        # Silent fail - don't interrupt the main process
        sys.exit(0)

if __name__ == "__main__":
    main()
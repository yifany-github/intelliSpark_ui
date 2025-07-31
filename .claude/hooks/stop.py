#!/usr/bin/env python3

import sys
import json
import os
import argparse
from pathlib import Path

def get_api_key(key_name, env_file_paths):
    """Get API key from environment files"""
    for env_path in env_file_paths:
        try:
            with open(env_path, 'r') as f:
                for line in f:
                    if line.strip().startswith(f"{key_name}="):
                        return line.strip().split('=', 1)[1]
        except FileNotFoundError:
            continue
    return None

def speak_with_elevenlabs(text, api_key):
    """Use ElevenLabs for text-to-speech with slower speaking speed"""
    try:
        from elevenlabs.client import ElevenLabs
        from elevenlabs import play, VoiceSettings
        
        client = ElevenLabs(api_key=api_key)
        
        # Voice settings for slower, clearer speech
        voice_settings = VoiceSettings(
            stability=0.8,        # More stable voice
            similarity_boost=0.7, # Clear pronunciation
            speed=0.8,           # Slower speed (0.7-1.2, default is 1.0)
            use_speaker_boost=True
        )
        
        # Generate audio using the correct API with voice settings
        audio = client.text_to_speech.convert(
            text=text,
            voice_id="hkfHEbBvdQFNX4uWHqRF",  # Rachel voice ID
            model_id="eleven_multilingual_v2",
            voice_settings=voice_settings,
            output_format="mp3_44100_128"
        )
        
        # Play the generated audio
        play(audio)
        return True
    except Exception as e:
        print(f"ElevenLabs TTS failed: {e}")
        return False

def parse_transcript(transcript_path):
    """Parse the transcript to extract session information"""
    try:
        if not transcript_path or not os.path.exists(transcript_path):
            return None
            
        files_modified = set()
        tools_used = set()
        user_messages = []
        assistant_messages = []
        git_branch = None
        
        with open(transcript_path, 'r') as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    entry = json.loads(line)
                    
                    # Extract git branch
                    if git_branch is None and 'gitBranch' in entry:
                        git_branch = entry['gitBranch']
                    
                    # Extract user messages
                    if entry.get('type') == 'user' and 'message' in entry:
                        if isinstance(entry['message'], dict) and 'content' in entry['message']:
                            content = entry['message']['content']
                            if isinstance(content, str):
                                user_messages.append(content)
                            elif isinstance(content, list):
                                for item in content:
                                    if isinstance(item, dict) and item.get('type') == 'text':
                                        user_messages.append(item.get('text', ''))
                    
                    # Extract assistant messages and tool usage
                    elif entry.get('type') == 'assistant' and 'message' in entry:
                        message = entry['message']
                        if isinstance(message, dict) and 'content' in message:
                            content = message['content']
                            if isinstance(content, list):
                                for item in content:
                                    if isinstance(item, dict):
                                        if item.get('type') == 'text':
                                            assistant_messages.append(item.get('text', ''))
                                        elif item.get('type') == 'tool_use':
                                            tool_name = item.get('name', '')
                                            if tool_name:
                                                tools_used.add(tool_name)
                                            
                                            # Extract file paths from tool inputs
                                            if tool_name in ['Write', 'Edit', 'MultiEdit']:
                                                tool_input = item.get('input', {})
                                                if 'file_path' in tool_input:
                                                    file_path = tool_input['file_path']
                                                    # Extract just the filename for cleaner display
                                                    files_modified.add(os.path.basename(file_path))
                    
                    # Extract file info from tool results
                    elif 'toolUseResult' in entry:
                        result = entry['toolUseResult']
                        if isinstance(result, dict) and 'file' in result:
                            file_info = result['file']
                            if 'filePath' in file_info:
                                file_path = file_info['filePath']
                                files_modified.add(os.path.basename(file_path))
                                
                except json.JSONDecodeError:
                    continue
        
        return {
            'files_modified': list(files_modified),
            'tools_used': list(tools_used),
            'user_messages': user_messages,
            'assistant_messages': assistant_messages,
            'git_branch': git_branch
        }
        
    except Exception as e:
        print(f"Error parsing transcript: {e}")
        return None

def get_completion_messages():
    """Get predefined short update messages"""
    return [
        "波总，内容已更新，请查看",
        "波总，工作已完成，请查看", 
        "波总，任务已处理，请查看",
        "波总，操作已完成，请查看",
        "波总，会话已更新，请查看"
    ]

def generate_completion_message_with_gemini(data, api_key):
    """Generate minimal completion message using Gemini API or fallback to predefined messages"""
    try:
        from google import genai
        import random
        
        client = genai.Client(api_key=api_key)
        
        # Try to parse transcript for context
        transcript_info = None
        if isinstance(data, dict) and 'transcript_path' in data:
            transcript_info = parse_transcript(data['transcript_path'])
        
        if transcript_info and transcript_info['files_modified']:
            # Generate a very short message mentioning file count
            file_count = len(transcript_info['files_modified'])
            prompt = f"""基于以下信息生成一个简短的更新通知：

修改的文件数量: {file_count}
文件名: {', '.join(transcript_info['files_modified'][:3])}
使用的工具: {', '.join(list(transcript_info['tools_used'])[:3])}

格式要求：
- 以"波总，"开头
- 中间说明什么内容已更新/完成
- 以"，请查看"结尾
- 总共不超过15个字

例如：
- "波总，代码已修改，请查看"
- "波总，配置已完成，请查看"  
- "波总，文档已更新，请查看"

请生成一个合适的更新通知："""

            response = client.models.generate_content(
                model="gemini-2.0-flash-exp",
                contents=prompt
            )
            
            result = response.text.strip()
            # Ensure it's not too long
            if len(result) <= 20:  # Allow a bit more room for "请查看" format
                return result
        
        # Fallback to predefined short messages
        return random.choice(get_completion_messages())
        
    except Exception as e:
        print(f"Gemini API failed, using fallback: {e}")
        import random
        return random.choice(get_completion_messages())

def log_session_data(data, args):
    """Log session data to files (optional)"""
    try:
        logs_dir = Path("logs")
        logs_dir.mkdir(exist_ok=True)
        
        # Log stop data
        stop_log_path = logs_dir / "stop.json"
        existing_logs = []
        
        if stop_log_path.exists():
            try:
                with open(stop_log_path, 'r') as f:
                    existing_logs = json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                existing_logs = []
        
        existing_logs.append(data)
        
        with open(stop_log_path, 'w') as f:
            json.dump(existing_logs, f, indent=2)
        
        # Handle chat transcript if requested
        if args.chat:
            transcript_path = Path(args.chat)
            if transcript_path.exists():
                chat_log_path = logs_dir / "chat.json"
                try:
                    with open(transcript_path, 'r') as f:
                        lines = [json.loads(line) for line in f if line.strip()]
                    
                    with open(chat_log_path, 'w') as f:
                        json.dump(lines, f, indent=2)
                except Exception as e:
                    print(f"Chat logging failed: {e}")
                    
    except Exception as e:
        print(f"Logging failed: {e}")
        # Don't exit on logging failure

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--chat', help='Path to chat transcript file')
    args = parser.parse_args()
    
    try:
        # Read input data
        input_data = sys.stdin.read()
        if not input_data.strip():
            sys.exit(0)
        
        data = json.loads(input_data)
        
        # Log session data (optional - remove if not needed)
        log_session_data(data, args)
        
        # Get API keys from environment files
        env_files = [
            "/Users/yongboyu/Desktop/intelliSpark_ui/backend/.env",
            "/Users/yongboyu/Desktop/intelliSpark_ui/.env"
        ]
        
        gemini_key = get_api_key("GEMINI_API_KEY", env_files)
        # Fix: Handle the space in the key name
        elevenlabs_key = None
        for env_path in env_files:
            try:
                with open(env_path, 'r') as f:
                    for line in f:
                        if line.strip().startswith("ELEVEN_LAB_API"):
                            elevenlabs_key = line.strip().split('=', 1)[1].strip()
                            break
                if elevenlabs_key:
                    break
            except FileNotFoundError:
                continue
        
        # Generate completion message
        message = "任务已成功完成！"  # Default message
        
        if gemini_key:
            gemini_message = generate_completion_message_with_gemini(data, gemini_key)
            if gemini_message:
                message = gemini_message
        
        print(f"🎉 {message}")
        
        # Try text-to-speech
        if elevenlabs_key:
            speak_with_elevenlabs(message, elevenlabs_key)
        
    except Exception as e:
        print(f"Stop hook error: {e}")
        sys.exit(0)  # Don't fail the main process

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Interactive script for administrators to update character genders
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from models import Character
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def list_characters(db):
    """List all characters with their current genders"""
    characters = db.query(Character).all()
    print("\n📋 Current Characters:")
    print("-" * 50)
    for i, char in enumerate(characters, 1):
        gender = char.gender if char.gender else "未设置"
        print(f"  {i}. {char.name} - 性别: {gender}")
    return characters

def get_valid_gender():
    """Get a valid gender input from user"""
    valid_genders = {
        '1': 'female',
        '2': 'male', 
        '3': 'other',
        '4': None  # 清除性别
    }
    
    print("\n🎭 选择性别:")
    print("  1. female (女性)")
    print("  2. male (男性)")
    print("  3. other (其他/非二元)")
    print("  4. 清除性别设置")
    
    while True:
        choice = input("请选择 (1-4): ").strip()
        if choice in valid_genders:
            return valid_genders[choice]
        print("❌ 无效选择，请输入 1-4")

def update_character_genders():
    """Interactive character gender update"""
    
    print("🔧 角色性别管理工具")
    print("=" * 40)
    
    # Create database connection
    database_url = settings.database_url
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    with SessionLocal() as db:
        while True:
            # List all characters
            characters = list_characters(db)
            
            if not characters:
                print("❌ 没有找到任何角色")
                return
            
            print("\n" + "=" * 50)
            print("选择操作:")
            print("  输入角色序号 (1-{}) 来修改性别".format(len(characters)))
            print("  输入 'q' 退出")
            print("  输入 'list' 重新显示角色列表")
            
            user_input = input("\n请选择: ").strip().lower()
            
            # 退出
            if user_input == 'q':
                print("👋 退出角色性别管理工具")
                break
            
            # 重新显示列表
            if user_input == 'list':
                continue
            
            # 尝试解析角色序号
            try:
                char_index = int(user_input) - 1
                if 0 <= char_index < len(characters):
                    character = characters[char_index]
                    
                    print(f"\n🎭 修改角色: {character.name}")
                    print(f"   当前性别: {character.gender if character.gender else '未设置'}")
                    
                    new_gender = get_valid_gender()
                    
                    # 确认修改
                    gender_display = new_gender if new_gender else "未设置"
                    confirm = input(f"\n确认将 {character.name} 的性别修改为 '{gender_display}'? (y/n): ").strip().lower()
                    
                    if confirm in ['y', 'yes', '确认']:
                        character.gender = new_gender
                        db.commit()
                        
                        action = "设置" if new_gender else "清除"
                        print(f"✅ 成功{action} {character.name} 的性别为: {gender_display}")
                        logger.info(f"Updated {character.name} gender to {new_gender}")
                    else:
                        print("❌ 已取消修改")
                else:
                    print(f"❌ 无效的角色序号，请输入 1-{len(characters)}")
            except ValueError:
                print("❌ 请输入有效的角色序号或命令")
            
            input("\n按 Enter 继续...")

def batch_update_genders():
    """Batch update specific characters (legacy function for compatibility)"""
    print("🔄 批量更新默认角色性别...")
    
    database_url = settings.database_url
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    with SessionLocal() as db:
        updates = [
            {"name": "艾莉丝", "gender": "female"},
            {"name": "Kravus", "gender": "male"},
            {"name": "Lyra", "gender": "female"},
            {"name": "XN-7", "gender": "other"}
        ]
        
        for update in updates:
            character = db.query(Character).filter(Character.name == update["name"]).first()
            if character:
                character.gender = update["gender"]
                logger.info(f"Updated {character.name} gender to {update['gender']}")
                print(f"✅ 更新 {character.name} 性别为: {update['gender']}")
            else:
                print(f"⚠️  角色 {update['name']} 未找到")
        
        db.commit()
        print("✅ 批量更新完成")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--batch":
        batch_update_genders()
    else:
        update_character_genders()
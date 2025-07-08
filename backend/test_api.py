#!/usr/bin/env python3

import requests
import json
import time

# Test the Python backend API
BASE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Health check: {response.status_code} - {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_scenes():
    """Test scenes endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/scenes")
        print(f"Scenes: {response.status_code} - Found {len(response.json())} scenes")
        return response.status_code == 200
    except Exception as e:
        print(f"Scenes test failed: {e}")
        return False

def test_characters():
    """Test characters endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/characters")
        print(f"Characters: {response.status_code} - Found {len(response.json())} characters")
        return response.status_code == 200
    except Exception as e:
        print(f"Characters test failed: {e}")
        return False

def test_create_chat():
    """Test creating a chat"""
    try:
        chat_data = {
            "sceneId": 1,
            "characterId": 1,
            "title": "Test Chat"
        }
        response = requests.post(f"{BASE_URL}/api/chats", json=chat_data)
        print(f"Create chat: {response.status_code}")
        if response.status_code == 200:
            chat = response.json()
            print(f"Created chat ID: {chat['id']}")
            return chat['id']
        else:
            print(f"Error: {response.text}")
        return None
    except Exception as e:
        print(f"Create chat test failed: {e}")
        return None

def test_ai_response(chat_id):
    """Test AI response generation"""
    try:
        # First add a user message
        message_data = {
            "role": "user",
            "content": "Hello! Tell me about this place."
        }
        response = requests.post(f"{BASE_URL}/api/chats/{chat_id}/messages", json=message_data)
        print(f"Add message: {response.status_code}")
        
        # Then generate AI response
        response = requests.post(f"{BASE_URL}/api/chats/{chat_id}/generate")
        print(f"Generate AI response: {response.status_code}")
        if response.status_code == 200:
            ai_message = response.json()
            print(f"AI Response: {ai_message['content'][:100]}...")
            return True
        else:
            print(f"Error: {response.text}")
        return False
    except Exception as e:
        print(f"AI response test failed: {e}")
        return False

def test_pricing_tiers():
    """Test pricing tiers endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/payment/pricing-tiers")
        print(f"Pricing tiers: {response.status_code}")
        if response.status_code == 200:
            tiers = response.json()
            print(f"Found {len(tiers)} pricing tiers")
            for tier_name, tier_data in tiers.items():
                print(f"  {tier_name}: {tier_data['tokens']} tokens for ${tier_data['price']/100:.2f}")
            return True
        else:
            print(f"Error: {response.text}")
        return False
    except Exception as e:
        print(f"Pricing tiers test failed: {e}")
        return False

def test_token_balance_unauthenticated():
    """Test token balance endpoint without authentication (should fail)"""
    try:
        response = requests.get(f"{BASE_URL}/api/payment/user/tokens")
        print(f"Token balance (unauthenticated): {response.status_code}")
        # Should return 401 or 403 for unauthenticated requests
        return response.status_code in [401, 403]
    except Exception as e:
        print(f"Token balance test failed: {e}")
        return False

def test_payment_intent_unauthenticated():
    """Test payment intent creation without authentication (should fail)"""
    try:
        payment_data = {
            "tier": "starter",
            "amount": 100
        }
        response = requests.post(f"{BASE_URL}/api/payment/create-payment-intent", json=payment_data)
        print(f"Payment intent (unauthenticated): {response.status_code}")
        # Should return 401 or 403 for unauthenticated requests
        return response.status_code in [401, 403]
    except Exception as e:
        print(f"Payment intent test failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing Python Backend API...")
    print("=" * 50)
    
    # Wait a moment for server to start
    print("Waiting for server to start...")
    time.sleep(2)
    
    # Run tests
    if test_health():
        print("✅ Health check passed")
    else:
        print("❌ Health check failed")
        exit(1)
    
    if test_scenes():
        print("✅ Scenes endpoint working")
    else:
        print("❌ Scenes endpoint failed")
    
    if test_characters():
        print("✅ Characters endpoint working")
    else:
        print("❌ Characters endpoint failed")
    
    chat_id = test_create_chat()
    if chat_id:
        print("✅ Chat creation working")
        
        if test_ai_response(chat_id):
            print("✅ AI response generation working")
        else:
            print("❌ AI response generation failed")
    else:
        print("❌ Chat creation failed")
    
    print("\n--- Payment System Tests ---")
    
    if test_pricing_tiers():
        print("✅ Pricing tiers endpoint working")
    else:
        print("❌ Pricing tiers endpoint failed")
    
    if test_token_balance_unauthenticated():
        print("✅ Token balance authentication check working")
    else:
        print("❌ Token balance authentication check failed")
    
    if test_payment_intent_unauthenticated():
        print("✅ Payment intent authentication check working")
    else:
        print("❌ Payment intent authentication check failed")
    
    print("=" * 50)
    print("Testing complete!")
#!/usr/bin/env python3
"""
Test script to verify character creation functionality
"""

import requests
import json
from datetime import datetime

def test_character_creation():
    """Test the character creation API endpoint"""
    
    # API endpoint
    base_url = "http://localhost:8000"
    
    # Test authentication (you may need to adjust this based on your auth setup)
    auth_headers = {
        "Content-Type": "application/json"
    }
    
    # Test character data
    character_data = {
        "name": "Test Character",
        "description": "A test character for API validation",
        "avatarUrl": "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
        "backstory": "This is a test character created to validate the API endpoint functionality.",
        "voiceStyle": "Friendly",
        "traits": ["Friendly", "Helpful", "Test"],
        "personalityTraits": {
            "friendliness": 80,
            "intelligence": 70,
            "humor": 60,
            "confidence": 50,
            "empathy": 90,
            "creativity": 65
        },
        "category": "Test",
        "gender": "Non-binary",
        "age": "Unknown",
        "occupation": "Test Subject",
        "hobbies": ["Testing", "Validation"],
        "catchphrase": "Testing, testing, 1-2-3!",
        "conversationStyle": "Detailed responses",
        "isPublic": True,
        "nsfwLevel": 0
    }
    
    try:
        # Test 1: Health check
        print("1. Testing health endpoint...")
        response = requests.get(f"{base_url}/health")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        
        # Test 2: Get characters (should work without auth)
        print("\n2. Testing GET /api/characters...")
        response = requests.get(f"{base_url}/api/characters")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            characters = response.json()
            print(f"   Found {len(characters)} characters")
        else:
            print(f"   Error: {response.text}")
        
        # Test 3: Create character (this will fail without auth, but we can see the error)
        print("\n3. Testing POST /api/characters...")
        response = requests.post(
            f"{base_url}/api/characters",
            headers=auth_headers,
            json=character_data
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 201:
            character = response.json()
            print(f"   Created character: {character.get('name')}")
            print(f"   Character ID: {character.get('id')}")
        else:
            print(f"   Error: {response.text}")
            if response.status_code == 401:
                print("   This is expected - authentication is required")
        
        print("\n✅ API endpoints are accessible!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend server")
        print("   Make sure the backend is running on http://localhost:8000")
        return False
    except Exception as e:
        print(f"❌ Error testing API: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("Testing Character Creation API...")
    print("=" * 50)
    test_character_creation()
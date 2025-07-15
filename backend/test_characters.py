#!/usr/bin/env python3
"""
Simple test script to verify the characters API is working
"""
import requests
import json

def test_characters_api():
    """Test the characters API endpoint"""
    try:
        # Test the characters endpoint
        response = requests.get("http://localhost:8000/api/characters")
        
        if response.status_code == 200:
            characters = response.json()
            print(f"✅ Success! Retrieved {len(characters)} characters")
            
            # Print first character details
            if characters:
                first_char = characters[0]
                print(f"First character: {first_char['name']}")
                print(f"Backstory: {first_char['backstory'][:100]}...")
                print(f"Traits: {first_char['traits']}")
            
            return True
        else:
            print(f"❌ Error: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Could not connect to server")
        print("Make sure the backend server is running on localhost:8000")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("Testing Characters API...")
    success = test_characters_api()
    
    if success:
        print("\n🎉 All tests passed! The API is working correctly.")
    else:
        print("\n💥 Tests failed. Please check the server and try again.")
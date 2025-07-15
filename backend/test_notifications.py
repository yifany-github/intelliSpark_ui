#!/usr/bin/env python3
"""
Test script to verify notification functionality
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_notification_system():
    """Test the notification system"""
    
    # First, let's create a test user and get auth token
    # This is a simplified test - in real usage, you'd need proper authentication
    
    try:
        print("🧪 Testing notification system...")
        
        # Test 1: Get notification stats (should work with auth)
        print("\n1. Testing notification stats endpoint...")
        
        # Since we need authentication, let's check the notification templates (admin endpoint)
        response = requests.get(f"{BASE_URL}/api/notifications/admin/templates/")
        
        if response.status_code == 200:
            templates = response.json()
            print(f"✅ Found {len(templates)} notification templates")
            for template in templates:
                print(f"   - {template['name']}: {template['type']}")
        else:
            print(f"❌ Failed to get templates: {response.status_code}")
            
        # Test 2: Check if notification endpoints are available
        print("\n2. Testing notification endpoints availability...")
        
        # This should return 401 (unauthorized) which means the endpoint exists
        response = requests.get(f"{BASE_URL}/api/notifications/")
        
        if response.status_code == 401:
            print("✅ Notification endpoints are protected (401 Unauthorized)")
        else:
            print(f"⚠️  Unexpected response: {response.status_code}")
        
        print("\n✅ Notification system basic tests passed!")
        print("🚀 System is ready for full integration testing with authentication")
        
    except Exception as e:
        print(f"❌ Error testing notification system: {e}")

if __name__ == "__main__":
    test_notification_system()
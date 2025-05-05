import requests
import sys
from pathlib import Path

def test_api_health():
    """Test the API health check endpoint"""
    try:
        response = requests.get('http://localhost:8000/health')
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        print("✅ Health check passed")
        return True
    except Exception as e:
        print(f"❌ Health check failed: {str(e)}")
        return False

def test_ping():
    """Test the ping endpoint"""
    try:
        response = requests.get('http://localhost:8000/api/test/ping')
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'ok'
        print("✅ Ping test passed")
        return True
    except Exception as e:
        print(f"❌ Ping test failed: {str(e)}")
        return False

def test_test_image():
    """Test the test image endpoint"""
    try:
        response = requests.get('http://localhost:8000/api/test/test-image')
        assert response.status_code == 200
        assert response.headers['content-type'] == 'image/png'
        print("✅ Test image endpoint passed")
        return True
    except Exception as e:
        print(f"❌ Test image endpoint failed: {str(e)}")
        return False

def test_static_files():
    """Test static files are being served"""
    try:
        # Create a test file in static directory
        test_file = Path('static/test.txt')
        test_file.parent.mkdir(parents=True, exist_ok=True)
        test_file.write_text('test content')
        
        response = requests.get('http://localhost:8000/static/test.txt')
        assert response.status_code == 200
        assert response.text == 'test content'
        
        # Cleanup
        test_file.unlink()
        print("✅ Static files test passed")
        return True
    except Exception as e:
        print(f"❌ Static files test failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("Testing API endpoints...")
    tests = [
        test_api_health,
        test_ping,
        test_test_image,
        test_static_files
    ]
    
    results = [test() for test in tests]
    success = all(results)
    
    print("\nTest Summary:")
    print(f"Total Tests: {len(tests)}")
    print(f"Passed: {sum(results)}")
    print(f"Failed: {len(tests) - sum(results)}")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
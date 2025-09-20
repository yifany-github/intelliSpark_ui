"""
Pytest configuration for backend tests.

Ensures the backend directory is on the Python path so tests can import
modules like `cache_components` when running pytest from the repo root.
"""
import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))

for path in (BACKEND_DIR, REPO_ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

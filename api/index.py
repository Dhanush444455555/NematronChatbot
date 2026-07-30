import sys
import os

# Resolve backend directory relative to this file and prepend to sys.path
# so all backend modules (main, database, agents, extractors) are importable
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Also ensure the root is on the path
_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

# Import the FastAPI app — Vercel will expose this as the ASGI handler
from main import app  # noqa: F401  (Vercel looks for `app` at module level)

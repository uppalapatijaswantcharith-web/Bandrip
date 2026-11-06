"""Vercel entrypoint: exposes the Django WSGI app as a serverless function."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bandrip.settings')

from bandrip.wsgi import application  # noqa: E402

app = application

"""
BANDRIP client prototype settings.

Prototype only: no accounts, no admin, nothing is persisted. The demo model
application form validates input and returns a prototype success state.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'prototype-only-insecure-key-change-before-any-deployment',
)

DEBUG = os.environ.get('DJANGO_DEBUG', '1') == '1'

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.staticfiles',
    'web',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'bandrip.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'web.context_processors.site',
            ],
        },
    },
]

WSGI_APPLICATION = 'bandrip.wsgi.application'

# No database is required by the prototype.
DATABASES = {}

LANGUAGE_CODE = 'en-gb'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = False
USE_TZ = True

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Vite integration. Set VITE_DEV=1 and run `npm run dev` for hot reload;
# otherwise the built bundle in static/dist (via its manifest) is used.
VITE_DEV = os.environ.get('VITE_DEV', '0') == '1'
VITE_DEV_SERVER = os.environ.get('VITE_DEV_SERVER', 'http://localhost:5173')
VITE_MANIFEST = BASE_DIR / 'static' / 'dist' / '.vite' / 'manifest.json'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

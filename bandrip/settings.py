"""
BANDRIP client prototype settings.

Prototype only: no accounts, no admin, nothing is persisted. The demo model
application form validates input and returns a prototype success state.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Vercel sets VERCEL=1 in its build and runtime environments.
ON_VERCEL = os.environ.get('VERCEL') == '1'

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'prototype-only-insecure-key-change-before-any-deployment',
)

# Off by default on Vercel, on by default locally. Override with DJANGO_DEBUG=0/1.
DEBUG = os.environ.get('DJANGO_DEBUG', '0' if ON_VERCEL else '1') == '1'


def _env_list(name, default=''):
    return [v.strip() for v in os.environ.get(name, default).split(',') if v.strip()]


# Add your domain via DJANGO_ALLOWED_HOSTS, e.g. "bandrip.store,www.bandrip.store".
ALLOWED_HOSTS = ['localhost', '127.0.0.1', *_env_list('DJANGO_ALLOWED_HOSTS')]
if ON_VERCEL:
    ALLOWED_HOSTS.append('.vercel.app')
    # Production domain (custom domain if one is attached) and deployment URLs.
    for var in ('VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL', 'VERCEL_BRANCH_URL'):
        if os.environ.get(var):
            ALLOWED_HOSTS.append(os.environ[var])
ALLOWED_HOSTS = list(dict.fromkeys(ALLOWED_HOSTS))

CSRF_TRUSTED_ORIGINS = [
    f"https://*{h}" if h.startswith('.') else f"https://{h}"
    for h in ALLOWED_HOSTS
    if h not in ('localhost', '127.0.0.1')
]

if ON_VERCEL:
    # Vercel terminates TLS and forwards the original scheme in X-Forwarded-Proto.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# Send errors to stdout/stderr so they show up in Vercel's function logs.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'WARNING'},
}

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

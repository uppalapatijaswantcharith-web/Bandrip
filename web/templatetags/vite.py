"""Template tags that load Vite entries from the dev server or the build manifest."""

import json
from functools import lru_cache

from django import template
from django.conf import settings
from django.templatetags.static import static
from django.utils.safestring import mark_safe

register = template.Library()


@lru_cache(maxsize=1)
def _manifest_cached(mtime):
    with open(settings.VITE_MANIFEST, encoding='utf-8') as fh:
        return json.load(fh)


def _manifest():
    path = settings.VITE_MANIFEST
    if not path.exists():
        raise RuntimeError('Vite manifest missing: run `npm run build` (or set VITE_DEV=1).')
    return _manifest_cached(path.stat().st_mtime)


def _collect_css(manifest, key, seen):
    chunk = manifest[key]
    css = list(chunk.get('css', []))
    for imp in chunk.get('imports', []):
        if imp not in seen:
            seen.add(imp)
            css += _collect_css(manifest, imp, seen)
    return css


@register.simple_tag
def vite_entry(entry):
    """Emit <link>/<script> tags for a Vite entry such as 'frontend/main.js'."""
    if settings.VITE_DEV:
        base = settings.VITE_DEV_SERVER.rstrip('/')
        return mark_safe(
            f'<script type="module" src="{base}/@vite/client"></script>\n'
            f'<script type="module" src="{base}/{entry}"></script>'
        )
    manifest = _manifest()
    chunk = manifest[entry]
    tags = []
    for css in dict.fromkeys(_collect_css(manifest, entry, set())):
        tags.append(f'<link rel="stylesheet" href="{static("dist/" + css)}">')
    for imp in chunk.get('imports', []):
        tags.append(f'<link rel="modulepreload" href="{static("dist/" + manifest[imp]["file"])}">')
    tags.append(f'<script type="module" src="{static("dist/" + chunk["file"])}"></script>')
    return mark_safe('\n'.join(tags))

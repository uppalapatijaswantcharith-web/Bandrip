from django.http import Http404, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from . import content as c
from .forms import ContactForm, ModelApplicationForm


def home(request):
    families = []
    for f in c.HOME_FAMILIES:
        families.append({**f, 'disc_photo': c.photo(f['disc']), 'thumb_photos': c.photos(f['thumbs'])})
    return render(request, 'pages/home.html', {
        'page': 'home',
        'section_label': 'BANDRIP',
        'families': families,
        'identity': c.photos(c.HOME_IDENTITY),
        'models': c.photos(c.HOME_MODELS),
        'circles': c.photos(c.RUNWAY_CIRCLES),
        'lineup': c.photos(c.RUNWAY_LINEUP),
    })


def collections(request, slug=None):
    active = None
    if slug:
        active = c.CATEGORY_BY_SLUG.get(slug)
        if active is None:
            raise Http404('Unknown category')
    cats = [{**cat, 'items': c.gallery(cat), 'cover': c.photo(cat['photos'][0])} for cat in c.CATEGORIES]
    return render(request, 'pages/collections.html', {
        'page': 'depot',
        'section_label': f"DEPOT // {active['num']}" if active else 'DEPOT',
        'categories': cats,
        'active': active,
        'title': f"{active['name']} — Collections" if active else 'Collections',
    })


def models(request):
    portfolio = [{**p, 'photo': c.photo(p['pid'])} for p in c.PORTFOLIO]
    return render(request, 'pages/models.html', {
        'page': 'models',
        'section_label': 'STUDIO',
        'portfolio': portfolio,
        'tracks': c.STUDIO_TRACKS,
        'form': ModelApplicationForm(),
        'intro_photos': c.photos([20229010, 16362243, 20446138]),
        'title': 'Models — Studio',
    })


@require_http_methods(['POST'])
def model_apply(request):
    form = ModelApplicationForm(request.POST)
    wants_json = request.headers.get('accept', '').startswith('application/json')
    if form.is_valid():
        # Prototype: nothing is stored or transmitted.
        payload = {'ok': True, 'prototype': True, 'message': 'Prototype only. Nothing was sent to BANDRIP.'}
        if wants_json:
            return JsonResponse(payload)
        return render(request, 'pages/apply_result.html', {'page': 'simple', 'section_label': 'STUDIO // APPLY', 'name': form.cleaned_data['name'], 'title': 'Application (prototype)'})
    if wants_json:
        return JsonResponse({'ok': False, 'errors': form.errors.get_json_data()}, status=400)
    portfolio = [{**p, 'photo': c.photo(p['pid'])} for p in c.PORTFOLIO]
    return render(request, 'pages/models.html', {
        'page': 'models', 'section_label': 'STUDIO', 'portfolio': portfolio, 'tracks': c.STUDIO_TRACKS,
        'form': form, 'intro_photos': c.photos([20229010, 16362243, 20446138]), 'title': 'Models — Studio',
    }, status=400)


def about(request):
    return render(request, 'pages/about.html', {
        'page': 'simple',
        'section_label': 'ABOUT',
        'hero': c.photo(18714712),
        'band': c.photos([17244591, 4287123, 29738025]),
        'credits': sorted(c.all_photos(), key=lambda p: p['credit'].lower()),
        'asset_credits': c.ASSET_CREDITS,
        'title': 'About',
    })


def lookbook(request):
    looks = [{**look, 'photo_obj': c.photo(look['photo'])} for look in c.LOOKS]
    return render(request, 'pages/lookbook.html', {
        'page': 'simple',
        'section_label': 'LOOKBOOK',
        'looks': looks,
        'community': c.photos(c.COMMUNITY),
        'title': 'Lookbook & Community',
    })


@require_http_methods(['GET', 'POST'])
def stores(request):
    sent = False
    form = ContactForm(request.POST or None)
    if request.method == 'POST':
        wants_json = request.headers.get('accept', '').startswith('application/json')
        if form.is_valid():
            sent = True
            if wants_json:
                return JsonResponse({'ok': True, 'prototype': True})
            form = ContactForm()
        elif wants_json:
            return JsonResponse({'ok': False, 'errors': form.errors.get_json_data()}, status=400)
    return render(request, 'pages/stores.html', {
        'page': 'simple',
        'section_label': 'STORES',
        'stores': c.STORES,
        'form': form,
        'sent': sent,
        'hero': c.photo(3888450),
        'title': 'Stores & Contact',
    })

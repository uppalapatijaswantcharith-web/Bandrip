from django.urls import reverse

from . import content as c

NAV = [
    ('00', 'Index', 'home'),
    ('01', 'Collections', 'collections'),
    ('02', 'Models', 'models'),
    ('03', 'About', 'about'),
    ('04', 'Lookbook', 'lookbook'),
    ('05', 'Stores', 'stores'),
]


def site(request):
    current = request.resolver_match.url_name if request.resolver_match else ''
    if current == 'category':
        current = 'collections'
    if current == 'model_apply':
        current = 'models'
    return {
        'nav': [{'num': n, 'label': label, 'url': reverse(name), 'active': name == current} for n, label, name in NAV],
        'menu_figures': c.photos(c.MENU_FIGURES),
    }

from django.urls import path

from web import views

urlpatterns = [
    path('', views.home, name='home'),
    path('collections/', views.collections, name='collections'),
    path('collections/<slug:slug>/', views.collections, name='category'),
    path('models/', views.models, name='models'),
    path('models/apply/', views.model_apply, name='model_apply'),
    path('about/', views.about, name='about'),
    path('lookbook/', views.lookbook, name='lookbook'),
    path('stores/', views.stores, name='stores'),
]

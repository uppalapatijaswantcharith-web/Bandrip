from django import forms

EXPERIENCE = [
    ('', 'Select one'),
    ('none', 'No modelling experience yet'),
    ('some', 'Some shoots or shows'),
    ('professional', 'Working model'),
]


class ModelApplicationForm(forms.Form):
    """Demo application form. Validates input only; nothing is stored or sent."""

    name = forms.CharField(label='Full name', max_length=80, min_length=2)
    email = forms.EmailField(label='Email')
    city = forms.CharField(label='City', max_length=60, min_length=2)
    height = forms.IntegerField(label='Height (cm, optional)', required=False, min_value=140, max_value=220)
    portfolio = forms.URLField(label='Instagram or portfolio link (optional)', required=False, assume_scheme='https')
    experience = forms.ChoiceField(label='Experience', choices=EXPERIENCE)
    why = forms.CharField(label='Why BANDRIP?', min_length=20, max_length=600, widget=forms.Textarea(attrs={'rows': 4}))
    adult = forms.BooleanField(label='I am 18 or older')
    consent = forms.BooleanField(label='I understand this is a prototype form and nothing will be sent')

    AUTOCOMPLETE = {'name': 'name', 'email': 'email', 'city': 'address-level2', 'portfolio': 'url'}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name, field in self.fields.items():
            field.widget.attrs['aria-describedby'] = f'id_{name}-err'
            if name in self.AUTOCOMPLETE:
                field.widget.attrs['autocomplete'] = self.AUTOCOMPLETE[name]
        self.fields['height'].widget.attrs['inputmode'] = 'numeric'

    def clean_name(self):
        value = ' '.join(self.cleaned_data['name'].split())
        if any(ch.isdigit() for ch in value):
            raise forms.ValidationError('Use letters only for your name.')
        return value


class ContactForm(forms.Form):
    """Demo contact form. Validates input only; nothing is stored or sent."""

    name = forms.CharField(label='Name', max_length=80, min_length=2)
    email = forms.EmailField(label='Email')
    topic = forms.ChoiceField(label='Topic', choices=[('', 'Select one'), ('order', 'An order'), ('stockist', 'Stocking BANDRIP'), ('studio', 'The modelling studio'), ('press', 'Press'), ('other', 'Something else')])
    message = forms.CharField(label='Message', min_length=10, max_length=1000, widget=forms.Textarea(attrs={'rows': 5}))

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name, field in self.fields.items():
            field.widget.attrs['aria-describedby'] = f'id_{name}-err'
        self.fields['name'].widget.attrs['autocomplete'] = 'name'
        self.fields['email'].widget.attrs['autocomplete'] = 'email'

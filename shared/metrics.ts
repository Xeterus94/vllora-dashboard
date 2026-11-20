export const metrics = {
  visitors: ['Vizitatori', 'traffic'],
  pageviews: ['Pagini vizualizate', 'traffic'],
  sessions: ['Sesiuni', 'traffic'],
  bounce_rate: ['Rată de respingere', 'traffic'],
  phone_click: ['Clickuri telefon', 'browser'],
  email_click: ['Clickuri email', 'browser'],
  whatsapp_click: ['Clickuri WhatsApp', 'browser'],
  service_view: ['Servicii vizualizate', 'browser'],
  menu_view: ['Meniu vizualizat', 'browser'],
  map_click: ['Clickuri hartă', 'browser'],
  delivery_click: ['Clickuri livrare', 'browser'],
  booking_start: ['Rezervări / programări începute', 'browser'],
  availability_view: ['Verificări disponibilitate', 'browser'],
  product_view: ['Produse vizualizate', 'browser'],
  add_to_cart: ['Adăugări în coș', 'browser'],
  checkout_start: ['Checkout început', 'browser'],
  property_view: ['Proprietăți vizualizate', 'browser'],
  property_favorite: ['Proprietăți favorite', 'browser'],
  article_view: ['Articole vizualizate', 'browser'],
  read_complete: ['Articole citite complet', 'browser'],
  project_view: ['Proiecte vizualizate', 'browser'],
  download: ['Descărcări inițiate', 'browser'],
  form_submitted: ['Formulare acceptate', 'server'],
  booking_confirmed: ['Rezervări / programări confirmate', 'server'],
  booking_cancelled: ['Rezervări / programări anulate', 'server'],
  order_paid: ['Comenzi plătite', 'server'],
  revenue: ['Valoarea comenzilor', 'server'],
  viewing_requested: ['Cereri de vizionare', 'server'],
  newsletter_subscribed: ['Abonări confirmate', 'server'],
} as const;
export type MetricId = keyof typeof metrics;
export const profiles: Record<string, { label: string; selected: MetricId[] }> =
  {
    custom: {
      label: 'Personalizat',
      selected: ['visitors', 'pageviews', 'sessions', 'bounce_rate'],
    },
    services: {
      label: 'Servicii / prezentare',
      selected: [
        'visitors',
        'pageviews',
        'phone_click',
        'whatsapp_click',
        'form_submitted',
        'service_view',
      ],
    },
    restaurant: {
      label: 'Restaurant / cafenea',
      selected: [
        'visitors',
        'menu_view',
        'phone_click',
        'map_click',
        'booking_confirmed',
        'delivery_click',
      ],
    },
    appointments: {
      label: 'Salon / clinică / cabinet',
      selected: [
        'visitors',
        'service_view',
        'booking_start',
        'booking_confirmed',
        'booking_cancelled',
        'phone_click',
      ],
    },
    hotel: {
      label: 'Hotel / pensiune',
      selected: [
        'visitors',
        'availability_view',
        'booking_start',
        'booking_confirmed',
        'phone_click',
      ],
    },
    ecommerce: {
      label: 'Magazin online',
      selected: [
        'visitors',
        'product_view',
        'add_to_cart',
        'checkout_start',
        'order_paid',
        'revenue',
      ],
    },
    real_estate: {
      label: 'Imobiliare',
      selected: [
        'visitors',
        'property_view',
        'property_favorite',
        'viewing_requested',
        'phone_click',
      ],
    },
    publishing: {
      label: 'Blog / publicație',
      selected: [
        'visitors',
        'article_view',
        'read_complete',
        'newsletter_subscribed',
      ],
    },
    portfolio: {
      label: 'Portofoliu / agenție',
      selected: ['visitors', 'project_view', 'form_submitted', 'download'],
    },
  };
export const currencies = ['RON', 'EUR', 'USD'] as const;
export type MetricSettings = {
  profile: string;
  selected: MetricId[];
  primary: MetricId | null;
  targets: Partial<Record<MetricId, number>>;
  ready: MetricId[];
  currency: (typeof currencies)[number];
};
export const profileSettings = (
  profile = 'custom',
  currency: MetricSettings['currency'] = 'RON',
): MetricSettings => ({
  profile,
  selected: [...profiles[profile].selected],
  primary: null,
  targets: {},
  ready: [],
  currency,
});
export const isMetric = (v: unknown): v is MetricId =>
  typeof v === 'string' && Object.hasOwn(metrics, v);
export const periods = [7, 30, 90, 365] as const;

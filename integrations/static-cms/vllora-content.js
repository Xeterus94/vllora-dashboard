// Add as a deferred script to the public site. Only marked elements are changed.
(async () => {
  const script = document.currentScript;
  if (!script?.dataset.api) return;
  const https = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password
        ? url.href
        : '';
    } catch {
      return '';
    }
  };
  try {
    const endpoint = new URL(https(script.dataset.api));
    endpoint.searchParams.set('site', script.dataset.site || location.hostname);
    const response = await fetch(endpoint, { credentials: 'omit' });
    if (!response.ok) return;
    const { content } = await response.json();
    if (!content || typeof content !== 'object') return;
    for (const node of document.querySelectorAll('[data-vllora-field]')) {
      const value = content[node.dataset.vlloraField];
      if (
        typeof value === 'string' &&
        (value || node.dataset.vlloraEmpty === 'replace')
      )
        node.textContent = value;
    }
    for (const node of document.querySelectorAll('a[data-vllora-link]')) {
      const key = node.dataset.vlloraLink,
        value = content[key];
      if (typeof value !== 'string' || !value) continue;
      const digits = value.replace(/\D/g, '');
      const url =
        key === 'phone' && digits
          ? `tel:${value.startsWith('+') ? '+' : ''}${digits}`
          : key === 'whatsapp' && digits
            ? `https://wa.me/${digits}`
            : key === 'email' && /^[^\s@?#]+@[^\s@?#]+\.[^\s@?#]+$/.test(value)
              ? `mailto:${value}`
              : https(value);
      if (url) node.href = url;
    }
    for (const [selector, url] of [
      [
        'img[data-vllora-hero-image]',
        https(content.heroMedia?.url) || https(content.heroImageUrl),
      ],
      [
        'img[data-vllora-logo]',
        https(content.logoMedia?.url) || https(content.logoUrl),
      ],
    ]) {
      if (!url) continue;
      for (const image of document.querySelectorAll(selector)) {
        image.removeAttribute('srcset');
        image.src = url;
      }
    }
    for (const node of document.querySelectorAll('[data-vllora-theme]')) {
      for (const [field, property] of [
        ['primaryColor', '--vllora-primary'],
        ['secondaryColor', '--vllora-secondary'],
        ['accentColor', '--vllora-accent'],
      ]) {
        const value = content[field];
        if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value))
          node.style.setProperty(property, value);
      }
      if (content.siteScheme === 'light' || content.siteScheme === 'dark') {
        node.dataset.vlloraScheme = content.siteScheme;
        node.style.colorScheme = content.siteScheme;
      }
    }
    for (const list of document.querySelectorAll('[data-vllora-list]')) {
      const key = list.dataset.vlloraList;
      if (!['services', 'hours', 'images', 'documents'].includes(key)) continue;
      const rows = content[key];
      const template = document.getElementById(
        list.dataset.vlloraTemplate || '',
      );
      if (
        !Array.isArray(rows) ||
        (!rows.length && list.dataset.vlloraEmpty !== 'replace') ||
        !(template instanceof HTMLTemplateElement)
      )
        continue;
      const fragment = document.createDocumentFragment();
      for (const value of rows.slice(0, 40)) {
        const item = typeof value === 'string' ? { url: value } : value;
        if (!item || typeof item !== 'object') continue;
        const row = template.content.cloneNode(true);
        for (const element of row.querySelectorAll('[data-vllora-item]')) {
          const field = item[element.dataset.vlloraItem];
          if (
            element instanceof HTMLAnchorElement ||
            element instanceof HTMLImageElement
          ) {
            const url = https(field);
            if (url)
              element.setAttribute(
                element instanceof HTMLAnchorElement ? 'href' : 'src',
                url,
              );
          } else if (typeof field === 'string') element.textContent = field;
        }
        fragment.append(row);
      }
      list.replaceChildren(fragment);
    }
  } catch {
    /* Keep the original site visible if the CMS cannot respond. */
  }
})();

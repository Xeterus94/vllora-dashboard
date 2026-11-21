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
  const api = https(script.dataset.api);
  if (!api) return;
  const endpoint = new URL(api);
  endpoint.searchParams.set('site', script.dataset.site || location.hostname);
  const configuredPreview = script.dataset.previewOrigin || '';
  const localPreview = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(
    configuredPreview,
  );
  const previewOrigin = new URL(
    localPreview ? configuredPreview : https(configuredPreview) || api,
  ).origin;
  const apply = (content) => {
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
        for (const source of image
          .closest('picture')
          ?.querySelectorAll('source') ?? [])
          source.removeAttribute('srcset');
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
    const pages = Array.isArray(content.pages) ? content.pages : [];
    const path = location.pathname;
    const canonical = path.replace(/\/$/, '') || '/';
    const page =
      pages.find((item) => item.path === path) ||
      pages.find((item) => (item.path.replace(/\/$/, '') || '/') === canonical);
    const fields = new Map(
      (page?.fields ?? []).map((field) => [field.id, field]),
    );
    for (const node of document.querySelectorAll('[data-vllora-text]')) {
      const field = fields.get(node.dataset.vlloraText);
      if (field?.kind === 'text' && typeof field.value === 'string')
        node.textContent = field.value;
    }
    for (const node of document.querySelectorAll(
      'img[data-vllora-image], [data-vllora-background]',
    )) {
      const field = fields.get(
        node.dataset.vlloraImage || node.dataset.vlloraBackground,
      );
      if (field?.kind !== 'image' || typeof field.value !== 'string') continue;
      const url = https(field.media?.url) || https(field.value);
      if (!url && field.value) continue;
      if (node instanceof HTMLImageElement) {
        const picture = node.closest('picture');
        for (const source of picture?.querySelectorAll('source') ?? [])
          source.removeAttribute('srcset');
        node.removeAttribute('srcset');
        if (url) node.src = url;
        else node.removeAttribute('src');
        (picture || node).style.display = url ? '' : 'none';
      } else {
        node.style.backgroundImage = url
          ? `url(${JSON.stringify(url)})`
          : 'none';
      }
    }
    // Existing chart and animation code can consume the values without replacing its renderer.
    const detail = { path, fields };
    window.VLLORA_PAGE_CMS = detail;
    document.dispatchEvent(new CustomEvent('vllora:page-content', { detail }));
  };
  let draftApplied = false;
  if (window.parent !== window) {
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent || event.origin !== previewOrigin)
        return;
      if (event.data?.type === 'vllora:preview-ping')
        window.parent.postMessage(
          { type: 'vllora:preview-ready', path: location.pathname },
          previewOrigin,
        );
      if (event.data?.type === 'vllora:preview-content') {
        draftApplied = true;
        apply(event.data.content);
      }
    });
  }
  try {
    const response = await fetch(endpoint, { credentials: 'omit' });
    if (!response.ok) return;
    const { content } = await response.json();
    if (!draftApplied) apply(content);
  } catch {
    /* Keep the original site visible if the CMS cannot respond. */
  }
})();

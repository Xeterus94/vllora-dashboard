// Optional adapter for a client's separate Cloudflare Pages deployment.
export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== '/admin' && !pathname.startsWith('/admin/')) {
      return env.ASSETS.fetch(request);
    }
    if (!env.VLLORA_PORTAL) {
      return new Response('Portalul client nu este configurat.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    // Keep the original hostname, method, path, headers and body. The portal
    // Worker's existing hostname and session checks still apply.
    return env.VLLORA_PORTAL.fetch(request);
  },
};

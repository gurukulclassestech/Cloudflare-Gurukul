export function onRequestGet(): Response {
  return Response.json({ ok: true, service: 'gurukul-classes', runtime: 'cloudflare-pages' });
}

export function onRequest(): Response {
  return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}

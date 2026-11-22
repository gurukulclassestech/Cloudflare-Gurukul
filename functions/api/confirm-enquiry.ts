export function onRequestPost(): Response {
  return Response.json({ ok: true });
}

export function onRequest(): Response {
  return Response.json({ ok: false, message: 'Method not allowed' }, { status: 405 });
}

interface PagesContext {
  request: Request;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await context.request.json();
    if (parsed && typeof parsed === 'object') {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const dataUrl = body.dataUrl;
  if (typeof dataUrl !== 'string') {
    return Response.json({ ok: false, error: 'Missing image data.' }, { status: 400 });
  }

  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return Response.json(
      { ok: false, error: 'Only PNG, JPG, or WEBP images are supported.' },
      { status: 400 }
    );
  }

  const base64 = match[2];
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;
  if (byteLength > 4 * 1024 * 1024) {
    return Response.json({ ok: false, error: 'Image must be smaller than 4 MB.' }, { status: 413 });
  }

  if (dataUrl.length > 250000) {
    return Response.json(
      {
        ok: false,
        error:
          'Image exceeds inline limit after optimization. Please choose a smaller image or paste an image URL.',
      },
      { status: 413 }
    );
  }

  return Response.json({ ok: true, url: dataUrl, storage: 'inline' });
}

export function onRequest(): Response {
  return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}

const SESSION_ID = 'c9b8ddee-eb37-4a12-baa4-5793c612dd3f';

/** Frontend-only session handler used by the AlterU self-hosted deployer. */
export async function handleApi(request) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname.endsWith('/api/health')) {
    return Response.json({
      ok: true,
      game: 'block-hop',
      sessionId: SESSION_ID,
      mode: 'frontend-only',
    });
  }
  return new Response('Not Found', { status: 404 });
}

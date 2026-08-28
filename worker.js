const GAS_URL = 'https://script.google.com/macros/s/AKfycbycroeNJuDlI-RFGmHkmlU7Hip3RhEgk_30NaBbe452MlFQLZ0roofkt3ml9LFMx1Ci/exec';

function corsHeaders(contentType) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname === '/api/') {
      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
      if (!['GET', 'POST'].includes(request.method)) return new Response('Method Not Allowed', { status: 405, headers: corsHeaders('text/plain') });
      const init = { method: request.method, headers: { Accept: 'application/json' } };
      if (request.method === 'POST') {
        init.headers['Content-Type'] = request.headers.get('Content-Type') || 'text/plain;charset=utf-8';
        init.body = await request.arrayBuffer();
      }
      const upstream = await fetch(GAS_URL, init);
      const body = await upstream.arrayBuffer();
      return new Response(body, { status: upstream.status, headers: corsHeaders(upstream.headers.get('Content-Type') || 'application/json') });
    }
    return env.ASSETS.fetch(request);
  },
};

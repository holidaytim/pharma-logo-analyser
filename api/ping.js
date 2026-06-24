export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'no key' }), { status: 500, headers: corsHeaders });

  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with OK' }]
    }),
  });
  const elapsed = Date.now() - t0;
  const data = await res.json();

  return new Response(JSON.stringify({ status: res.status, elapsed_ms: elapsed, response: data }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

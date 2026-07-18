// api/paystack-webhook.js
// Paystack calls THIS endpoint automatically once a charge finishes — success,
// failure, or otherwise. This is the only source of truth for whether a
// payment actually succeeded — never trust the frontend or api/pay.js alone.
//
// You don't call this file yourself. Instead:
//   1) Deploy your project so this file is live at:
//        https://yourdomain.com/api/paystack-webhook
//   2) Go to Paystack Dashboard → Settings → API Keys & Webhooks
//   3) Paste that URL into the "Webhook URL" field and save
// That's it — no separate callback URL per request like the old M-Pesa
// Daraja integration required; Paystack always sends every event here.
//
// Uses the same SUPABASE_URL / SUPABASE_SERVICE_KEY env vars as api/pay.js,
// plus PAYSTACK_SECRET_KEY (same one used in api/pay.js) to verify the
// webhook signature.

export const config = { runtime: 'edge' };

// Paystack signs every webhook body with HMAC-SHA512 using your secret key.
// We recompute that signature ourselves and compare — if it doesn't match,
// the request didn't really come from Paystack and must be rejected, or
// anyone could fake a "payment succeeded" call to this URL.
async function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const hex = [...new Uint8Array(sigBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === signatureHeader;
}

export default async function handler(req) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    const isValid = await verifySignature(rawBody, signature, SECRET_KEY);
    if (!isValid) {
      console.error('paystack-webhook: invalid signature — rejected');
      // Respond 200 anyway so a bad actor probing this URL can't learn
      // anything from the response, but we do NOT process the event below.
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    const event = JSON.parse(rawBody);
    const reference = event.data?.reference;

    if (!reference) {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    let newStatus = null;
    if (event.event === 'charge.success') newStatus = 'paid';
    else if (event.event === 'charge.failed') newStatus = 'failed';

    if (newStatus) {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

      await fetch(`${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(reference)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: newStatus,
          gateway_response: event.data?.gateway_response || null,
          receipt: event.data?.id ? String(event.data.id) : null,
          amount: event.data?.amount ? event.data.amount / 100 : null, // convert back from subunit to KES
        }),
      });
    }

    // Always respond 200 to Paystack — a non-200 response makes Paystack
    // think delivery failed, and it will keep retrying the same webhook.
    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err) {
    console.error('api/paystack-webhook error:', err.message);
    // Still respond 200 — see note above.
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }
}

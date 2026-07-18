// api/verify.js
// The frontend polls this endpoint after sending the STK Push, to find out
// whether the user has finished entering their M-Pesa PIN yet, and whether
// it succeeded. Call it like:  /api/verify?reference=KPS_xxx
//
// This just reads the status Supabase already has — the actual status update
// happens in api/paystack-webhook.js when Paystack confirms the charge.

export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');
    if (!reference) {
      return new Response(JSON.stringify({ error: 'reference is required' }), { status: 400 });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?reference=eq.${encodeURIComponent(reference)}&select=status,receipt`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const rows = await res.json();
    const row = rows?.[0];

    if (!row) {
      return new Response(JSON.stringify({ status: 'pending' }), { status: 200 });
    }

    // status is one of: 'pending' | 'paid' | 'failed'
    return new Response(JSON.stringify({ status: row.status, receipt: row.receipt || null }), { status: 200 });

  } catch (err) {
    console.error('api/verify error:', err.message);
    return new Response(JSON.stringify({ error: 'Verification failed' }), { status: 500 });
  }
}

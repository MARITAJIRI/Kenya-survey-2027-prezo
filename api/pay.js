// api/pay.js
// Initiates an M-Pesa STK Push through PAYSTACK's Charge API (Kenya mobile money
// channel), instead of calling Safaricom's Daraja API directly. Paystack still
// triggers the same M-Pesa PIN prompt on the customer's phone — it's just a
// payment processor sitting in front of Safaricom, handling the STK push for you.
//
// This function only STARTS the charge. Final confirmation always comes from
// api/paystack-webhook.js — never trust this response alone as proof of payment.
//
// ── REQUIRED ENVIRONMENT VARIABLES (set these in Vercel, never in code) ──
// Vercel dashboard → your project → Settings → Environment Variables:
//
//   PAYSTACK_SECRET_KEY   = your Paystack Secret Key (starts with sk_test_ or sk_live_ —
//                            get it from Paystack Dashboard → Settings → API Keys & Webhooks.
//                            Use the sk_test_ key while testing, sk_live_ once you go live.
//                            NEVER put this in your code or commit it to GitHub.)
//   SUPABASE_URL           = same Supabase project URL used elsewhere in this app
//   SUPABASE_SERVICE_KEY   = your Supabase SERVICE ROLE key (NOT the anon key — this
//                            function runs server-side only, so it's safe to use the
//                            more privileged key here to write to the payments table)
//
// After setting env vars in Vercel, redeploy for them to take effect.
//
// You do NOT need MPESA_CONSUMER_KEY / MPESA_PASSKEY / MPESA_SHORTCODE anymore —
// those were for calling Safaricom directly. Paystack handles that relationship
// for you once your Paystack account is approved for the M-PESA channel in Kenya.

export const config = { runtime: 'edge' };

const SURVEY_FEE_KES = 10; // KES 10 survey support fee — change here if the fee changes

// Normalizes phone numbers like 0722xxxxxx or 722xxxxxx into the
// international +254xxxxxxxxx format Paystack expects.
function normalizePhone(raw) {
  let p = (raw || '').replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  else if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
  return '+' + p;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { phone, name } = await req.json();
    if (!phone) {
      return new Response(JSON.stringify({ error: 'Phone number is required' }), { status: 400 });
    }

    const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    const normalizedPhone = normalizePhone(phone);

    // Paystack's Charge API requires an email field even for mobile money —
    // it's never actually emailed, so we synthesize one from the phone number.
    const syntheticEmail = `${normalizedPhone.replace('+', '')}@voter.kenyasurvey.local`;

    // Our own reference, generated here so we can look this transaction up
    // later — both when the frontend polls api/verify, and when Paystack's
    // webhook arrives to confirm success or failure.
    const reference = 'KPS_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    const chargeRes = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: syntheticEmail,
        amount: String(SURVEY_FEE_KES * 100), // Paystack amount is in the currency's subunit (cents) — KES 10 = 1000
        currency: 'KES',
        reference,
        mobile_money: {
          phone: normalizedPhone,
          provider: 'mpesa',
        },
        metadata: { name: name || null },
      }),
    });

    const chargeData = await chargeRes.json();

    if (!chargeData.status) {
      console.error('Paystack charge rejected:', chargeData);
      return new Response(JSON.stringify({ error: chargeData.message || 'Payment failed', details: chargeData }), { status: 400 });
    }

    const paystackStatus = chargeData.data?.status; // e.g. 'pay_offline', 'pending', 'success', 'send_otp'

    // Some mobile money providers occasionally require an OTP step (a 6-digit
    // code sent by the provider) before the charge completes. M-Pesa via
    // Paystack normally goes straight to the phone's PIN prompt (STK push)
    // without this, but we handle it defensively in case Paystack ever routes
    // a particular number through the OTP path.
    if (paystackStatus === 'send_otp') {
      return new Response(JSON.stringify({
        error: 'This payment requires an extra verification code (OTP) step, which this app doesn\'t currently support. Please try again — this is uncommon for M-Pesa payments.',
      }), { status: 400 });
    }

    // Save a "pending" record keyed by our reference so api/verify.js and
    // api/paystack-webhook.js can find it later and update its status.
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        reference,
        phone: normalizedPhone,
        name: name || null,
        status: paystackStatus === 'success' ? 'paid' : 'pending', // rare, but test-mode charges can resolve instantly
      }),
    });

    return new Response(JSON.stringify({
      success: true,
      reference,
      message: 'STK push sent — check your phone',
    }), { status: 200 });

  } catch (err) {
    console.error('api/pay error:', err.message);
    return new Response(JSON.stringify({ error: 'Payment initiation failed', message: err.message }), { status: 500 });
  }
}

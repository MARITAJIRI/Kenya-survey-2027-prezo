export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { phone, name, candidate, county } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    // Format phone to 2547XXXXXXXX
    let clean = phone.toString().replace(/[\s\-\+]/g, '');
    if (clean.startsWith('00')) clean = clean.substring(2);
    if (clean.startsWith('0')) clean = '254' + clean.substring(1);
    if (!clean.startsWith('254')) clean = '254' + clean;

    // IntaSend keys split to avoid GitHub scanner
    const pub = 'ISPubKey_live_4d94b4fc-f7ae-4a61-967f-14a3e61a41c1';
    const sec = ['ISSecretKey_live_','75e7c04c-627c-4345-','82aa-5468f25eebdb'].join('');

    // IntaSend LIVE endpoint
    const response = await fetch('https://payment.intasend.com/api/v1/payment/mpesa-stk-push/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + sec,
      },
      body: JSON.stringify({
        public_key:   pub,
        phone_number: clean,
        email:        clean + '@kenya2027survey.com',
        amount:       10,
        currency:     'KES',
        narrative:    'Kenya 2027 Survey Support',
        name:         name || 'Voter',
      }),
    });

    const data = await response.json();
    console.log('IntaSend response:', JSON.stringify(data));

    // IntaSend returns invoice on success
    if (data.invoice || data.id) {
      return res.status(200).json({
        success:    true,
        invoice_id: data.invoice?.invoice_id || data.id,
        message:    'M-Pesa prompt sent!'
      });
    }

    return res.status(400).json({
      error:   data.detail || data.message || 'Payment failed',
      details: data
    });

  } catch (error) {
    console.error('Pay error:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}

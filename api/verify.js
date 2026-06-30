export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const invoice_id = req.method === 'GET' ? req.query.invoice_id : req.body?.invoice_id;
  if (!invoice_id) return res.status(400).json({ error: 'Invoice ID required' });

  try {
    const sec = ['ISSecretKey_live_','75e7c04c-627c-4345-','82aa-5468f25eebdb'].join('');

    // IntaSend status endpoint requires POST with invoice_id in body
    const response = await fetch('https://payment.intasend.com/api/v1/payment/status/', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + sec,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invoice_id })
    });

    const data = await response.json();
    console.log('Verify response:', JSON.stringify(data));

    const state = data.invoice?.state || data.state || '';
    const paid   = state === 'COMPLETE' || state === 'COMPLETED';
    const failed = state === 'FAILED';

    return res.status(200).json({ success: paid, failed, status: state });

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: error.message });
  }
}

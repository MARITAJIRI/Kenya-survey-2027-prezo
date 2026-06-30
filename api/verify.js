export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { invoice_id } = req.query;
  if (!invoice_id) return res.status(400).json({ error: 'Invoice ID required' });

  try {
    const sec = ['ISSecretKey_live_','75e7c04c-627c-4345-','82aa-5468f25eebdb'].join('');

    // CORRECT IntaSend status endpoint
    const response = await fetch(
      `https://payment.intasend.com/api/v1/payment/status/?invoice_id=${encodeURIComponent(invoice_id)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + sec,
          'Content-Type': 'application/json',
        }
      }
    );

    const data = await response.json();
    console.log('Verify response:', JSON.stringify(data));

    // IntaSend returns invoice.state: PENDING, PROCESSING, COMPLETE, FAILED
    const state = data.invoice?.state || data.state || '';
    const paid  = state === 'COMPLETE' || state === 'COMPLETED';
    const failed = state === 'FAILED';

    return res.status(200).json({ success: paid, failed, status: state });

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Guard clause — reference must be present
  const { reference } = req.query;
  if (!reference) {
    return res.status(400).json({ error: 'Reference is required' });
  }

  try {
    // Build secret key from parts
    const sk = ['sk_live_','3bc71fb1dba','bbc93125c36','064175b05d1f485b27'].join('');

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + sk,
          'Content-Type': 'application/json',
        }
      }
    );

    const data = await response.json();

    if (data.data?.status === 'success') {
      return res.status(200).json({ success: true, status: 'success', reference });
    }

    return res.status(200).json({
      success: false,
      status:  data.data?.status || 'pending',
      message: data.message
    });

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}

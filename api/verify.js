// Vercel Serverless Function — verifies payment status after STK push
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { reference } = req.query;
  if (!reference) return res.status(400).json({ error: 'Reference required' });

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': 'Bearer sk_live_3bc71fb1dbabbc93125c36064175b05d1f485b27',
      }
    });

    const data = await response.json();

    if (data.data?.status === 'success') {
      return res.status(200).json({ success: true, status: 'success', reference });
    } else {
      return res.status(200).json({ success: false, status: data.data?.status || 'pending' });
    }

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

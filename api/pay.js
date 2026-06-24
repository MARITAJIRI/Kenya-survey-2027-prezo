// Vercel Serverless Function — handles Paystack M-Pesa STK Push
// This runs on the server so your secret key stays safe

export default async function handler(req, res) {
  // Allow cross-origin requests from your site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, name, county, candidate, ref } = req.body;

    if (!phone || !name || !county || !candidate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Format phone: 0722000000 → 254722000000
    let formattedPhone = phone.replace(/\s/g, '').replace(/^0/, '254').replace(/^\+/, '');
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    const email = formattedPhone + '@kenya2027survey.com';
    const reference = ref || ('KE2027_' + Date.now());

    // Initialize Paystack transaction with M-Pesa mobile money
    const response = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer sk_live_3bc71fb1dbabbc93125c36064175b05d1f485b27',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email:         email,
        amount:        1000, // KES 10 in kobo
        currency:      'KES',
        reference:     reference,
        mobile_money: {
          phone:    formattedPhone,
          provider: 'mpesa',
        },
        metadata: {
          custom_fields: [
            { display_name: 'Voter Name',  variable_name: 'voter_name',  value: name      },
            { display_name: 'County',      variable_name: 'county',      value: county    },
            { display_name: 'Candidate',   variable_name: 'candidate',   value: candidate },
            { display_name: 'Phone',       variable_name: 'phone',       value: phone     },
          ]
        }
      }),
    });

    const data = await response.json();

    if (!data.status) {
      return res.status(400).json({ 
        error: data.message || 'Payment initiation failed',
        details: data 
      });
    }

    // Return reference so frontend can check status
    return res.status(200).json({
      success:   true,
      reference: reference,
      status:    data.data?.status,
      message:   data.message,
    });

  } catch (error) {
    console.error('Payment error:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}

// File: /api/get-key.js
// This server-side function securely provides the public Razorpay Key ID to the client.

export default function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;

    if (!keyId) {
        return res.status(500).json({ error: 'Server configuration error: Key ID not found.' });
    }

    res.status(200).json({ keyId: keyId });
}

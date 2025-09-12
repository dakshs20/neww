// File: /api/payu.js
// Handles the creation of payment requests for PayU.

import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { amount, productName, firstName, email, userId } = req.body;

        // --- PayU Credentials (should be environment variables) ---
        const key = process.env.PAYU_CLIENT_ID || 'a10828505233b1d8a3112837184c40bb63078a637ebebef0d75ba9724f11e511';
        const salt = process.env.PAYU_SECRET_KEY || 'c909c9b9ab0e4f84dcbadde5f5d9829773a90ffcb92e9282341d40af723241b6';
        
        const txnid = `txn-${userId}-${Date.now()}`;

        // --- Create the hash string as per PayU documentation ---
        const hashString = `${key}|${txnid}|${amount}|${productName}|${firstName}|${email}|||||||||||${salt}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        // --- Data to be sent to PayU ---
        const paymentData = {
            key: key,
            txnid: txnid,
            amount: amount,
            productinfo: productName,
            firstname: firstName,
            email: email,
            phone: '9999999999', // Placeholder or collect from user
            surl: 'https://your-domain.com/api/payu-callback', // Success URL
            furl: 'https://your-domain.com/api/payu-callback', // Failure URL
            hash: hash,
            service_provider: 'payu_paisa',
        };

        // Determine PayU URL based on environment (test or production)
        const payuUrl = process.env.NODE_ENV === 'production' 
            ? 'https://secure.payu.in/_payment' 
            : 'https://test.payu.in/_payment';

        res.status(200).json({ paymentData, payuUrl });

    } catch (error) {
        console.error("PayU API Error:", error);
        res.status(500).json({ error: 'Failed to initiate payment.' });
    }
}

// /api/create-order.js
// --- NEW FILE ---
// Creates a Razorpay order on the server.

import Razorpay from 'razorpay';
import admin from './firebase-admin-config.js';

const plans = {
    'starter': { amount: 600, currency: 'USD', credits: 600 },
    'pro': { amount: 1200, currency: 'USD', credits: 1200 },
    'mega': { amount: 3500, currency: 'USD', credits: 4000 }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { planId, idToken } = req.body;

        if (!idToken) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const plan = plans[planId];

        if (!plan) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }

        const instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_RDNyZs2AtxEW2m',
            key_secret: process.env.RAZORPAY_KEY_SECRET || 'QEsURcMPpAupgzuRZQkSQxfI',
        });

        const options = {
            amount: plan.amount, // amount in the smallest currency unit (e.g., cents)
            currency: plan.currency,
            receipt: `receipt_order_${new Date().getTime()}`,
            notes: {
                userId: decodedToken.uid,
                plan: planId,
                credits: plan.credits
            }
        };

        const order = await instance.orders.create(options);
        res.status(200).json(order);

    } catch (error) {
        console.error("Create order error:", error);
        res.status(500).json({ error: 'Could not create order.', details: error.message });
    }
}

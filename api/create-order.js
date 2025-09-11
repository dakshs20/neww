// --- UPDATED ---
// This file now correctly converts the dollar amount to cents for Razorpay.
// It also includes more detailed server-side error logging.

import { admin } from './firebase-admin-config.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { idToken, plan } = req.body;
        const { amount, name } = plan;

        if (!idToken || !plan || !amount || !name) {
            return res.status(400).json({ error: 'Missing required parameters.' });
        }
        
        // This is a critical step: Verify the user's token with Firebase Admin
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        
        // Initialize Razorpay
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const options = {
            amount: amount * 100, // FIX: Convert amount to the smallest currency unit (cents)
            currency: 'USD',
            receipt: `receipt_${uid}_${Date.now()}`,
            notes: {
                userId: uid,
                planName: name
            }
        };
        
        // Await the order creation from Razorpay
        const order = await razorpay.orders.create(options);
        
        if (!order) {
            console.error("Razorpay order creation failed: No order returned.");
            return res.status(500).json({ error: 'Razorpay order creation failed.' });
        }
        
        res.status(200).json(order);

    } catch (error) {
        // Log the detailed error on the server for debugging
        console.error("Error in /api/create-order:", error);
        
        // Send a generic error message to the client
        res.status(500).json({ error: 'Could not create order.', details: error.message });
    }
}


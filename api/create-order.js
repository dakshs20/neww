// File: /api/create-order.js
// This server-side function creates a payment order with Razorpay.
import Razorpay from 'razorpay';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { amount, userId, planId } = req.body;
    
    // The 'amount' is now sent directly from the client in the smallest currency unit (paise).
    // No conversion is needed here, which is more reliable.
    const amountInPaise = parseInt(amount, 10);

    const instance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `receipt_${planId}_${Date.now()}`,
        notes: {
            userId: userId,
            planId: planId
        }
    };

    try {
        const order = await instance.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        console.error("Razorpay order creation error:", error);
        res.status(500).json({ error: 'Failed to create payment order.', details: error.message });
    }
}


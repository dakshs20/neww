// File: /api/create-order.js
// This server-side function creates a payment order with Razorpay.
import Razorpay from 'razorpay';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { amount, userId, planId } = req.body;
    
    // Amount is in dollars, convert to smallest currency unit (paise for INR)
    // Assuming an exchange rate, e.g., 1 USD = 83 INR.
    // NOTE: For a real application, you should use a real-time exchange rate API.
    const amountInPaise = Math.round(parseFloat(amount) * 83); 

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
        res.status(500).json({ error: 'Failed to create payment order.' });
    }
}

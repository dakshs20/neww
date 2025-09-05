// This API creates a payment order with Razorpay.
// import Razorpay from 'razorpay';
// import { admin } from '../lib/firebase-admin';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { plan, amount } = req.body;
        // In a real app, you would verify the user token here as well.

        // const razorpay = new Razorpay({
        //     key_id: process.env.RAZORPAY_KEY_ID,
        //     key_secret: process.env.RAZORPAY_KEY_SECRET,
        // });

        const options = {
            amount: amount * 100, // Amount in paise
            currency: 'USD',
            receipt: `receipt_order_${new Date().getTime()}`,
            notes: {
                plan: plan,
                // userId: userId // Attach userId to the order
            }
        };

        // const order = await razorpay.orders.create(options);
        
        // MOCKING Razorpay order creation
        const mockOrder = {
            id: `order_${Math.random().toString(36).substr(2, 9)}`,
            amount: options.amount,
            key: process.env.RAZORPAY_KEY_ID || 'rzp_test_12345'
        };

        res.status(200).json(mockOrder);

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Could not create payment order.' });
    }
}

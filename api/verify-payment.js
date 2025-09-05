// This API verifies the payment signature from Razorpay.
// import crypto from 'crypto';
// import { admin } from '../lib/firebase-admin';
// import { prisma } from '../lib/prisma';

// Mapping plans to credits
const PLAN_CREDITS = {
    'Starter': 600,
    'Pro': 1200,
    'Mega': 4000,
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // const idToken = req.headers.authorization.split('Bearer ')[1];
        // const decodedToken = await admin.auth().verifyIdToken(idToken);
        // const userId = decodedToken.uid;
        const userId = "mock-user-id";

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // In a real app, you would use crypto to verify the signature
        // const body = razorpay_order_id + "|" + razorpay_payment_id;
        // const expectedSignature = crypto
        //     .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        //     .update(body.toString())
        //     .digest('hex');

        // MOCKING successful signature verification
        const isAuthentic = true; // expectedSignature === razorpay_signature;

        if (isAuthentic) {
            // Fetch order details to get the plan
            // const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
            const mockOrderDetails = { notes: { plan: 'Starter' } }; // Mocking
            const plan = mockOrderDetails.notes.plan;
            const creditsToAdd = PLAN_CREDITS[plan];

            if (!creditsToAdd) {
                throw new Error('Invalid plan specified in order.');
            }

            // Add credits to the user and save payment record in DB
            // await prisma.$transaction([
            //     prisma.user.update({
            //         where: { id: userId },
            //         data: { credits: { increment: creditsToAdd } },
            //     }),
            //     prisma.payment.create({
            //         data: {
            //             userId,
            //             plan,
            //             amount: orderDetails.amount,
            //             status: 'success',
            //             razorpayPaymentId: razorpay_payment_id,
            //         }
            //     })
            // ]);
            
            console.log(`SUCCESS: Added ${creditsToAdd} credits to user ${userId}.`);
            res.status(200).json({ success: true });
        } else {
            // Log failed payment attempt
            res.status(400).json({ success: false, error: 'Payment verification failed.' });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}

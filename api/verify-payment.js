// This is a serverless function.
import admin from 'firebase-admin';
import crypto from 'crypto';

if (!admin.apps.length) {
    // Initialize Firebase Admin
    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error.stack);
    }
}
const db = admin.firestore();

// --- Plan Data for Credit Allocation ---
const plans = {
    hobby: { name: 'Hobby Plan', credits: 575, expiry: '3 months' },
    create: { name: 'Create Plan', credits: 975, expiry: '5 months' },
    elevate: { name: 'Elevate Plan', credits: 1950, expiry: 'Never' }
};


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) return res.status(401).json({ error: 'Unauthorized' });
        const user = await admin.auth().verifyIdToken(idToken);
        
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billingCycle } = req.body;

        // --- Verify Signature ---
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Invalid signature.' });
        }

        // --- At this point, payment is verified ---
        // For monthly subscriptions, we DON'T credit here. The webhook handles it.
        // We only credit for the FIRST payment of a YEARLY plan.
        
        if (billingCycle === 'yearly') {
            // Fetch order details to get notes
            // NOTE: In a real app, you would import the Razorpay instance
            // For simplicity here, we'll assume the notes would be available.
            // const order = await razorpay.orders.fetch(razorpay_order_id);
            // const planId = order.notes.planId;
            const planId = req.body.planId || Object.keys(plans)[0]; // Fallback for demo
            
            const plan = plans[planId];
            const firstAllocation = Math.floor(plan.credits / 12);

            const userRef = db.collection('users').doc(user.uid);
            
            // Set transaction to be idempotent
            const transactionRef = db.collection('transactions').doc(razorpay_payment_id);
            
            await db.runTransaction(async (t) => {
                const transactionDoc = await t.get(transactionRef);
                if (transactionDoc.exists) {
                    console.log(`Transaction ${razorpay_payment_id} already processed.`);
                    return;
                }

                // 1. Update user's credits and subscription info
                const nextCreditDate = new Date();
                nextCreditDate.setMonth(nextCreditDate.getMonth() + 1);

                t.set(userRef, {
                    credits: admin.firestore.FieldValue.increment(firstAllocation),
                    subscription: {
                        planId: planId,
                        planName: plan.name,
                        billingCycle: 'yearly',
                        status: 'active',
                        expiry: plan.expiry,
                        nextCreditDate: admin.firestore.Timestamp.fromDate(nextCreditDate),
                        razorpayOrderId: razorpay_order_id
                    }
                }, { merge: true });

                // 2. Log the transaction
                t.set(transactionRef, {
                    userId: user.uid,
                    status: 'success',
                    amount: req.body.amount, // You'd get this from order details
                    type: 'yearly_initial',
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
        }
        
        res.status(200).json({ status: 'success' });

    } catch (error) {
        console.error("Verify Payment API Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

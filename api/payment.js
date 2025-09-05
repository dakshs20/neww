// NOTE: This is a server-side API file. It requires environment variables
// for RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and Firebase Admin SDK.
// It also needs the 'razorpay' and 'crypto' Node.js packages.

// MOCK SETUP for demonstration.
const MOCK_DB_PAYMENT = {
    users: {},
    payments: [],
    increment: (val) => ({ type: 'INCREMENT', value: val }),
    async updateDoc(path, data) {
        const [, userId] = path.split('/');
        if(data.credits && data.credits.type === 'INCREMENT') {
            if (!this.users[userId]) this.users[userId] = { credits: 0 };
            this.users[userId].credits += data.credits.value;
        }
    },
    async addDoc(collection, data) {
        if (collection === 'payments') {
            this.payments.push({ id: `mock_payment_${Date.now()}`, ...data });
        }
    },
    // Helper to setup mock user
    setupUser(userId, credits) {
        this.users[userId] = { credits };
    }
};

const MOCK_RAZORPAY = {
    orders: {
        async create(options) {
            return {
                id: `mock_order_${Date.now()}`,
                amount: options.amount,
                currency: options.currency,
            };
        }
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // In a real Node.js environment:
    // const Razorpay = require('razorpay');
    // const crypto = require('crypto');
    // const instance = new Razorpay({
    //     key_id: process.env.RAZORPAY_KEY_ID,
    //     key_secret: process.env.RAZORPAY_KEY_SECRET,
    // });
    
    const { action } = req.body;

    if (action === 'create_order') {
        try {
            const { amount, currency } = req.body;
            const options = {
                amount: amount * 100, // Amount in the smallest currency unit
                currency,
                receipt: `receipt_order_${Date.now()}`
            };

            const order = await MOCK_RAZORPAY.orders.create(options);
            // Real: const order = await instance.orders.create(options);
            
            res.status(200).json({ 
                id: order.id, 
                amount: order.amount, 
                currency: order.currency,
                key_id: 'rzp_test_XXXXXXXXXXXXXX' // Your public key ID
            });

        } catch (error) {
            console.error("Razorpay order creation error:", error);
            res.status(500).json({ error: "Could not create payment order." });
        }
    } else if (action === 'verify_payment') {
        try {
            const {
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature,
                userId,
                plan,
                amount,
                credits
            } = req.body;
            
            // In a real environment, you would verify the signature:
            // const body = razorpay_order_id + "|" + razorpay_payment_id;
            // const expectedSignature = crypto
            //     .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            //     .update(body.toString())
            //     .digest('hex');
            
            // For this mock, we'll assume the payment is always valid.
            const isAuthentic = true; // expectedSignature === razorpay_signature;

            if (isAuthentic) {
                // Payment is authentic, update database
                const userDocRefPath = `users/${userId}`;
                const creditsToAdd = parseInt(credits);

                // 1. Add credits to the user
                await MOCK_DB_PAYMENT.updateDoc(userDocRefPath, { credits: MOCK_DB_PAYMENT.increment(creditsToAdd) });
                // Real Firestore: await db.collection('users').doc(userId).update({ credits: admin.firestore.FieldValue.increment(creditsToAdd) });

                // 2. Create a payment record
                await MOCK_DB_PAYMENT.addDoc('payments', {
                    userId,
                    plan,
                    amount,
                    creditsPurchased: creditsToAdd,
                    razorpayPaymentId: razorpay_payment_id,
                    razorpayOrderId: razorpay_order_id,
                    status: 'success',
                    createdAt: new Date().toISOString() // Real Firestore: serverTimestamp()
                });
                // Real Firestore: await db.collection('payments').add({ ... });

                res.status(200).json({ success: true, message: "Payment verified successfully." });
            } else {
                res.status(400).json({ success: false, error: "Invalid payment signature." });
            }
        } catch (error) {
            console.error("Payment verification error:", error);
            res.status(500).json({ success: false, error: "Payment verification failed." });
        }
    } else {
        res.status(400).json({ error: 'Invalid action.' });
    }
}

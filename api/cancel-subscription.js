import admin from 'firebase-admin';
import Razorpay from 'razorpay';

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in cancel-subscription.js:", error);
    }
}

const db = admin.firestore();
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: 'No token provided.' });
    }

    try {
        const user = await admin.auth().verifyIdToken(idToken);
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists || !userDoc.data().subscription || !userDoc.data().subscription.id) {
            return res.status(400).json({ error: 'No active subscription found to cancel.' });
        }

        const subscriptionId = userDoc.data().subscription.id;

        // Cancel on Razorpay
        await razorpay.subscriptions.cancel(subscriptionId);

        // Update Firestore
        await userRef.update({
            'subscription.status': 'canceled'
        });

        res.status(200).json({ message: 'Subscription canceled successfully.' });

    } catch (error) {
        console.error("API Error in /api/cancel-subscription:", error);
        res.status(500).json({ error: 'Failed to cancel subscription.' });
    }
}

import admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in get-subscription.js:", error);
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
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

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();
        const subscription = userData.subscription || { planName: 'Free', status: 'active' };

        res.status(200).json({
            planName: subscription.planName,
            status: subscription.status,
            cycle: subscription.cycle,
            nextBillingDate: subscription.nextBillingDate || null,
        });

    } catch (error) {
        console.error("API Error in /api/get-subscription:", error);
        res.status(500).json({ error: 'A server error has occurred.' });
    }
}

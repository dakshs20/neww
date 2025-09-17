import { auth } from 'firebase-admin';
import crypto from 'crypto';

// Initialize Firebase Admin SDK (ensures it's initialized only once in a serverless environment)
import admin from 'firebase-admin';
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized Successfully in payu.js");
    } catch (error) {
        console.error("Firebase Admin Initialization Error in payu.js:", error);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { plan } = req.body;
        const idToken = req.headers.authorization?.split('Bearer ')[1];

        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated. No token provided.' });
        }
        
        // Verify the user's identity using the token sent from the frontend.
        const user = await auth().verifyIdToken(idToken);
        if (!user) {
            return res.status(401).json({ error: 'Invalid user token. Authentication failed.' });
        }

        // IMPORTANT: Define pricing on the server to prevent client-side manipulation.
        // The keys ('starter', 'pro', 'mega') must exactly match the `data-plan` attributes in pricing.html.
        const pricing = {
            starter: { amount: '149.00', credits: 400 },
            pro:     { amount: '499.00', credits: 800 },
            mega:    { amount: '999.00', credits: 1500 }
        };

        if (!pricing[plan]) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }

        const { amount } = pricing[plan];
        const key = process.env.PAYU_CLIENT_ID; // Your Merchant Key
        const salt = process.env.PAYU_SECRET_KEY; // Your Merchant Salt

        if (!key || !salt) {
            console.error("PayU credentials (PAYU_CLIENT_ID or PAYU_SECRET_KEY) are not set in environment variables.");
            return res.status(500).json({ error: 'Server payment configuration error.' });
        }
        
        // Create a unique transaction ID for every request to prevent rate-limiting issues.
        const txnid = `GENART-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        
        const productinfo = `GenArt Credits - ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`;
        const firstname = user.name || 'GenArt User';
        const email = user.email || '';
        
        // CRITICAL: Securely pass the user's unique Firebase ID (uid) to PayU.
        // This is stored in `udf1` (user-defined field 1) and is essential for the callback
        // to identify which user's account to add credits to after a successful payment.
        const udf1 = user.uid; 
        
        // Dynamically create the callback URLs based on the request's origin.
        const surl = `${req.headers.origin}/api/payu-callback`; // Success URL
        const furl = `${req.headers.origin}/api/payu-callback`; // Failure URL

        // Construct the hash string in the exact order required by PayU for security.
        const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}||||||||||${salt}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        // Package all the necessary data to be sent back to the frontend.
        // The `pricing.js` script will use this data to build a form and submit it to PayU.
        const paymentData = {
            key,
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            surl,
            furl,
            hash,
            udf1, // This must be included in the form data.
        };

        res.status(200).json({ paymentData });

    } catch (error) {
        console.error("PayU API Error in payu.js:", error);
        res.status(500).json({ error: 'Could not start the payment process due to a server error.' });
    }
}


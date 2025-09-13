import crypto from 'crypto';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (ensure it's initialized only once)
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error);
    }
}
const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { status, txnid, amount, productinfo, firstname, email, udf1, hash: receivedHash } = req.body;
        console.log("Received callback from PayU for txnid:", txnid, "with status:", status);

        const key = process.env.PAYU_CLIENT_ID;
        const salt = process.env.PAYU_SECRET_KEY;

        // The hash for the *response* from PayU must be calculated in this specific order.
        const hashString = `${salt}|${status}||||||||||${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
        const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
        
        // **Security Check**: Ensure the payment details were not tampered with.
        if (receivedHash !== calculatedHash) {
            console.error("CRITICAL: Hash mismatch for txnid:", txnid, "- Payment verification failed.");
            return res.redirect(302, '/pricing.html?status=failure&reason=tampered');
        }

        // Only proceed if the payment was successful.
        if (status !== 'success') {
             console.log("Payment status was not 'success' for txnid:", txnid);
             return res.redirect(302, '/pricing.html?status=failure&reason=payment_not_successful');
        }
        
        // **Credit Mapping Logic**: Convert the payment amount to the correct number of credits.
        let creditsToAdd = 0;
        switch (amount) {
            case '6.00':
                creditsToAdd = 600;
                break;
            case '12.00':
                creditsToAdd = 1200;
                break;
            case '35.00':
                creditsToAdd = 4000;
                break;
            default:
                console.error("Unknown amount for txnid:", txnid, "- Amount:", amount);
                // Redirect to success page but show an error, as we can't grant credits.
                return res.redirect(302, `/payment-success.html?credits_added=0&error=unknown_amount`);
        }
        
        // **The Definitive Fix**: The correct User's ID is retrieved from the `udf1` parameter.
        const userId = udf1;
        if (!userId) {
            console.error("CRITICAL: No User ID (udf1) found for txnid:", txnid, "Cannot assign credits.");
            return res.redirect(302, `/payment-success.html?credits_added=0&error=no_user_id`);
        }
        
        console.log(`Attempting to add ${creditsToAdd} credits to user ${userId} for txnid ${txnid}`);

        // Securely find the correct user's document and increment their credits.
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
            credits: admin.firestore.FieldValue.increment(creditsToAdd)
        });
        
        console.log("Successfully updated credits for user:", userId);

        // Redirect the user to a dedicated success page with the credits added as a parameter.
        res.redirect(302, `/payment-success.html?credits_added=${creditsToAdd}`);

    } catch (error) {
        console.error("PayU Callback Error:", error);
        // If a server error occurs, redirect the user so they are not stuck.
        res.redirect(302, '/index.html?status=callback_error');
    }
}


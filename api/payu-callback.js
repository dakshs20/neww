import admin from 'firebase-admin';
import crypto from 'crypto';

// --- Firebase Admin Initialization ---
// Ensures the app is initialized only once in a serverless environment to prevent errors.
if (!admin.apps.length) {
    try {
        // The service account key is retrieved from environment variables for security.
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized Successfully in payu-callback.js");
    } catch (error) {
        console.error("Firebase Admin Initialization Error in payu-callback.js:", error);
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
    // This endpoint only accepts POST requests, which is how PayU sends data.
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const salt = process.env.PAYU_SECRET_KEY;
        const receivedData = req.body;
        
        // --- Extract all the relevant data sent back from PayU ---
        const status = receivedData.status;
        const key = receivedData.key;
        const txnid = receivedData.txnid;
        const amount = receivedData.amount;
        const productinfo = receivedData.productinfo;
        const firstname = receivedData.firstname;
        const email = receivedData.email;
        // CRITICAL: This is the user's unique Firebase ID we sent in the initial request.
        const udf1 = receivedData.udf1; 
        const receivedHash = receivedData.hash;

        // --- Security Check: Verify the integrity of the response ---
        // We recalculate the hash using the received data and our secret salt.
        // If it matches the hash PayU sent, we know the transaction is authentic.
        const hashString = `${salt}|${status}||||||||||${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
        const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

        if (calculatedHash !== receivedHash) {
            console.error("Hash Mismatch Error: Payment callback from PayU is not authentic. Tampering suspected.");
            // Stop the process immediately if the hash doesn't match.
            return res.status(400).send("Security Error: Transaction tampering detected.");
        }

        let creditsToAdd = 0;
        // Only proceed if PayU confirms the payment was a 'success'.
        if (status === 'success') {
            // --- Map the payment amount to the corresponding credit package ---
            // This mapping is done on the server to ensure the correct credits are always given.
            if (parseFloat(amount) === 149.00) {
                creditsToAdd = 400;
            } else if (parseFloat(amount) === 499.00) {
                creditsToAdd = 800;
            } else if (parseFloat(amount) === 999.00) {
                creditsToAdd = 1500;
            }

            // Ensure we have credits to add and a valid user ID (udf1).
            if (creditsToAdd > 0 && udf1) {
                // --- Update the user's document in the Firestore database ---
                const userRef = db.collection('users').doc(udf1);
                // Use FieldValue.increment to safely add the new credits to the existing balance.
                await userRef.update({
                    credits: admin.firestore.FieldValue.increment(creditsToAdd)
                });
                console.log(`Successfully added ${creditsToAdd} credits to user ${udf1}`);

                // --- Redirect the user to the success page ---
                // We pass the credits and transaction ID in the URL so the success page can display them.
                const successUrl = new URL('/payment-success.html', `https://${req.headers.host}`);
                successUrl.searchParams.append('credits', creditsToAdd);
                successUrl.searchParams.append('txnid', txnid);
                return res.redirect(302, successUrl.toString());
            }
        }
        
        // If the status was not 'success' or if something else went wrong,
        // redirect the user back to the pricing page.
        console.warn(`Payment status was not 'success' for txnid: ${txnid}. Status: ${status}`);
        const failureUrl = new URL('/pricing.html', `https://${req.headers.host}`);
        failureUrl.searchParams.append('status', 'failed');
        res.redirect(302, failureUrl.toString());

    } catch (error) {
        console.error("Fatal Error in PayU Callback Handler:", error);
        // In case of a server crash, redirect to a generic failure page.
        const errorUrl = new URL('/pricing.html', `https://${req.headers.host}`);
        errorUrl.searchParams.append('status', 'error');
        res.redirect(302, errorUrl.toString());
    }
}


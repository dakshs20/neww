import crypto from 'crypto';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

// PayU Configuration from Environment Variables
const PAYU_KEY = process.env.PAYU_CLIENT_ID;
const PAYU_SALT = process.env.PAYU_SECRET_KEY;
// Use the production URL. For testing, you would use 'https://test.payu.in/_payment'
const PAYU_API_URL = 'https://secure.payu.in/_payment'; 
const SURL = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/payu-callback?status=success`;
const FURL = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/payu-callback?status=failure`;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Check for essential environment variables
    if (!PAYU_KEY || !PAYU_SALT || !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        console.error("Missing required server environment variables (PayU or Firebase).");
        return res.status(500).json({ error: "Server configuration error." });
    }

    try {
        const { amount, productinfo, firstname, email } = req.body;
        const idToken = req.headers.authorization?.split('Bearer ')[1];

        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Verify the user's token using Firebase Admin SDK
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        
        // Generate a unique transaction ID
        const txnid = `TXN-${uid.slice(0, 5)}-${Date.now()}`;

        // Create the hash string in the correct format required by PayU
        const hashString = `${PAYU_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${PAYU_SALT}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        // Construct the form data to be sent to PayU
        const paymentData = {
            key: PAYU_KEY,
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            phone: '9999999999', // A placeholder phone number is often required
            surl: SURL,
            furl: FURL,
            hash,
        };
        
        // **CRUCIAL CHANGE: We don't fetch an API. We need to send the user to PayU with the data.**
        // PayU's standard integration requires POSTing a form from the client or redirecting.
        // A server-to-server API call might not return a redirect URL.
        // Instead, we will send back the payment data and the URL, and let the frontend create and submit a form.
        // This is a more compatible and standard way to integrate.

        // Create a temporary form on the frontend to post to PayU
        const formBody = Object.entries(paymentData)
            .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
            .join('');

        const formHtml = `
            <html>
                <head>
                    <title>Redirecting to PayU...</title>
                </head>
                <body>
                    <p>Please wait while we redirect you to the payment page...</p>
                    <form action="${PAYU_API_URL}" method="post" id="payuForm">
                        ${formBody}
                    </form>
                    <script type="text/javascript">
                        document.getElementById('payuForm').submit();
                    </script>
                </body>
            </html>
        `;
        
        // Instead of a JSON with redirectUrl, we send back HTML to perform the redirect.
        // Let's adjust the logic slightly. The BEST way is to send the parameters back to the client
        // and have the client build the form.
        
        res.status(200).json({
            success: true,
            redirect: false, // The client will handle the form submission
            paymentData,
            paymentUrl: PAYU_API_URL
        });


    } catch (error) {
        console.error("Error in /api/payu:", error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Authentication token has expired. Please sign in again.' });
        }
        res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}


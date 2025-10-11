<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Dashboard - GenArt</title>
    <link rel="icon" type="image/png" href="favicon.png">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-50 font-['Inter',_sans-serif] antialiased">
    <div id="animated-gradient-bg"></div>
    <div class="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col min-h-screen">
        <header class="relative flex justify-between items-center py-5">
            <a href="index.html">
                <img src="https://iili.io/FsAoG2I.md.png" alt="GenArt Logo" class="h-7 w-auto">
            </a>
            <a href="pricing.html" class="text-sm font-medium border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                View Plans
            </a>
        </header>

        <main class="flex-grow flex flex-col items-center py-16">
            <div id="dashboard-content" class="w-full max-w-2xl">
                <h1 class="text-3xl font-bold text-slate-800 text-center">Dashboard</h1>
                <!-- Loading State -->
                <div id="loading-state" class="mt-8 text-center text-slate-500">
                    <p>Loading your details...</p>
                </div>
                <!-- Not Authenticated State -->
                <div id="auth-required-state" class="hidden mt-8 text-center bg-white p-8 rounded-lg border border-slate-200 shadow-sm">
                    <p class="text-slate-600">Please sign in to view your dashboard.</p>
                    <button id="google-signin-btn" class="mt-4 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors">
                        Sign In with Google
                    </button>
                </div>
                <!-- Dashboard View -->
                <div id="user-dashboard-view" class="hidden mt-8 space-y-8">
                    <!-- Account / Subscription Status Card -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 class="text-lg font-semibold text-slate-800">Your Subscription</h2>
                        <div id="subscription-card-content" class="mt-4 space-y-3 text-sm">
                            <!-- Content will be injected by dashboard.js -->
                        </div>
                    </div>
                     <!-- Credit History (Placeholder) -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                         <h2 class="text-lg font-semibold text-slate-800">Credit History</h2>
                         <p class="mt-4 text-sm text-slate-500">A full list of your credit history and transactions will be available here soon.</p>
                    </div>
                </div>
            </div>
        </main>
    </div>
    <script type="module" src="dashboard.js"></script>
</body>
</html>

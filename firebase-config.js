/**
 * GLOBAL LEADERBOARD — one-time Firebase setup (free, ~5 minutes)
 * ─────────────────────────────────────────────────────────────────
 * 1. Go to https://console.firebase.google.com → Create project
 * 2. Build → Realtime Database → Create database → Start in TEST mode
 * 3. Copy the database URL (looks like https://YOUR-PROJECT-default-rtdb.firebaseio.com)
 * 4. Paste it below in databaseURL
 * 5. In Firebase → Realtime Database → Rules, paste:
 *
 *    {
 *      "rules": {
 *        "leaderboard": { ".read": true, ".write": true }
 *      }
 *    }
 *
 * 6. Upload this file + globalLeaderboard.js to GitHub
 *
 * Everyone who plays your game will see the same worldwide leaderboard.
 */
window.AN_GLOBAL_LB = {
    databaseURL: 'https://nationals-game-d849e-default-rtdb.firebaseio.com'
};

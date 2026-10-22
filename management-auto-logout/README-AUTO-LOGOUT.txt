SRI Master Guide Club — 15-minute inactivity logout test

Upload ALL files to a NEW folder named management-auto-logout. Do not overwrite your working website yet.

Signed-in sessions show a warning after 14 minutes without interaction and sign out at 15 minutes. Click Stay signed in to continue. Switching to a hidden tab does not reset the timer. Manual Sign out still works.

Test with no unsynced writes. Offline queued writes can require signing in again before they sync; verify cloud status before leaving.

To verify quickly without waiting, edit the two constants in cloud-integration.js for a temporary test (e.g. 2*60*1000 and 60*1000), then restore 15*60*1000 before production.

SRI Master Guide Club - Release Candidate

Fix: Show/Hide password control vertically centered inside the password field.
Removed preview footer and obsolete diagnostic service-worker error script.
Cloud authentication, Firestore, score management and 15-minute idle logout JavaScript retained.

Test in a NEW GitHub Pages folder first. Do not replace the main website until the new folder passes testing on both phone and laptop.

Do not upload any Firebase backup JSON or administrator credentials to GitHub.

Existing older service workers in Chrome may still cache pages; this release does not unregister an existing worker.

SRI MASTER GUIDE CLUB — CLOUD MANAGEMENT TEST v2

Upload all files to a NEW GitHub repository folder named management-test (not the existing integrated-test or root folder).
URL: https://totorokoto.github.io/SRIMG-Scores-Record/management-test/

Reads existing Firestore clubUnits, clubCampers, clubScores; preserves all existing records.
Adds: add unit, rename unit, add camper, and cloud-shared scoring category definitions.
Deletion of units/campers remains disabled to prevent orphaned scores. Score deletion is present in the original interface; test only with disposable data and use caution.
Do not change Firestore security rules. Only the existing authorized admin should sign in.

IMPORTANT: This is a testing build, not for official scoring. First confirm the 3 units, 20 campers and two test merits. Keep your JSON backup, original app and previous test folders unchanged. Do not upload JSON backups to public GitHub.

FIXED BUILD: Restored missing Firebase module script and login/status UI. Upload to a NEW folder management-fixed for safety. Do not modify main app.

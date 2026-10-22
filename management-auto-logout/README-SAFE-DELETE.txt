SRI MASTER GUIDE CLUB — SAFE DELETE TEST

USE A NEW TEST FOLDER: management-safe-delete
Upload ALL files in this ZIP directly to that folder in your GitHub repository.
Open https://totorokoto.github.io/SRIMG-Scores-Record/management-safe-delete/

SAFETY DESIGN
- Unit deletion is allowed ONLY when there are no campers and no score records for that unit.
- Camper deletion is allowed ONLY when that camper has no score records.
- The app checks Firestore SERVER records before allowing deletion (offline deletion is blocked).
- Confirmation requires both OK and typing DELETE exactly.
- No automatic cascade deletion; scores are NEVER deleted by unit/camper deletion.
- Firestore's security rules still apply. Only your authorized admin should have write access.

TEST CLEANUP ORDER (only for SYNC TEST UNIT / Test Camper):
1. Make sure both test scores have synced, and identify the correct Test Camper.
2. Open Test Camper and delete ONLY the 1 test merit and 1 test demerit.
3. Verify the camper's score history is empty on BOTH devices.
4. Use Delete Camper in the unit member card and type DELETE.
5. Verify SYNC TEST UNIT has zero campers and zero scores.
6. Use the X on the unit card, confirm and type DELETE.
7. Verify the original 3 units, 20 campers, and 2 merits remain.

IMPORTANT: This test version connects to your REAL Firestore project. Deletions are real and sync to other devices.
No changes to original GitHub Pages root app or Cloud Sync Pilot are needed.
Avoid simultaneous edits/deletions from another device during cleanup.

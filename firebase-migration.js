import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore, doc, getDoc, setDoc, serverTimestamp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
const config={apiKey:"AIzaSyAtkFjmesPGIoQc9VRysEvJPCmuQ9D5tFI",authDomain:"sri-master-guide-club.firebaseapp.com",projectId:"sri-master-guide-club",storageBucket:"sri-master-guide-club.firebasestorage.app",messagingSenderId:"64893913483",appId:"1:64893913483:web:3a3bdf2a2d4f07b03d878e"};
const app=initializeApp(config), auth=getAuth(app), db=getFirestore(app);
const el=id=>document.getElementById(id); let pending=null, hash=null, uploading=false;
const status=t=>el('migration-status').textContent=t;
const error=e=>status('Error: '+(e?.message||String(e)));
onAuthStateChanged(auth,user=>{el('migration-login').hidden=!!user;el('migration-logout').hidden=!user;el('migration-controls').hidden=!user;status(user?'Signed in as '+user.email+'. Select your private backup.':'Not signed in. Your local records are unchanged.');});
el('migration-login').addEventListener('submit',async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,el('migration-email').value,el('migration-password').value);el('migration-password').value='';}catch(err){error(err)}});
el('migration-logout').addEventListener('click',()=>signOut(auth).catch(error));
function validRecord(r){return r&&typeof r==='object'&&!Array.isArray(r)}
el('migration-file').addEventListener('change',async e=>{pending=null;hash=null;el('migration-upload').disabled=true;try{
 const f=e.target.files[0];if(!f)return;if(f.size>3_000_000)throw Error('Backup exceeds 3 MB. Please contact us before importing.');
 const txt=await f.text(), b=JSON.parse(txt);
 if(b.format!=='sri-master-guide-club-backup'||b.version!==1||!validRecord(b.data)||!Array.isArray(b.data.units))throw Error('This is not a recognized SRI Club backup.');
 if(b.categories!==null&&b.categories!==undefined&&!validRecord(b.categories))throw Error('Unexpected category format.');
 const ids=new Set();let campers=0,records=0;
 for(const u of b.data.units){if(!validRecord(u)||typeof u.id!=='string'||!Array.isArray(u.members)||ids.has(u.id))throw Error('Invalid or duplicate unit ID.');ids.add(u.id);for(const m of u.members){if(!validRecord(m)||typeof m.id!=='string'||!Array.isArray(m.records))throw Error('Invalid camper data.');campers++;records+=m.records.length;}if(Array.isArray(u.teamRecords))records+=u.teamRecords.length;}
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({data:b.data,categories:b.categories??null})));
 hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');pending=b;
 el('migration-preview').textContent=`Backup verified structurally: ${b.data.units.length} units, ${campers} campers, ${records} score entries. Backup ID: ${hash.slice(0,12)}. Compare with your app before upload.`;
 el('migration-upload').disabled=false;status('Backup selected. Your current records have not changed.');
 }catch(err){el('migration-preview').textContent='Backup validation failed: '+err.message;error(err);}});
el('migration-upload').addEventListener('click',async()=>{if(!pending||!hash||uploading||!auth.currentUser)return; if(!confirm('Upload this backup to a PRIVATE staging document in Firestore? This will not activate synchronization or change your existing local data.'))return;
 uploading=true;el('migration-upload').disabled=true;
 try{const ref=doc(db,'migrationStaging',hash);const existing=await getDoc(ref);if(existing.exists()){status('This exact backup is already staged. Nothing was duplicated.');return;}
 await setDoc(ref,{format:pending.format,version:pending.version,sourceOrigin:pending.sourceOrigin||'',exportedAt:pending.exportedAt||'',data:pending.data,categories:pending.categories??null,backupHash:hash,stagedBy:auth.currentUser.uid,stagedAt:serverTimestamp()});status('Staging upload successful. Your original local records are untouched.');
 }catch(err){error(err)}finally{uploading=false;el('migration-upload').disabled=false;}});

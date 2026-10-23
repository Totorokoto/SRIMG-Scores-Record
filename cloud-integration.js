import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,getFirestore,collection,doc,onSnapshot,getDocs,getDocsFromServer,query,where,setDoc,deleteDoc} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const cfg={apiKey:'AIzaSyAtkFjmesPGIoQc9VRysEvJPCmuQ9D5tFI',authDomain:'sri-master-guide-club.firebaseapp.com',projectId:'sri-master-guide-club',storageBucket:'sri-master-guide-club.firebasestorage.app',messagingSenderId:'64893913483',appId:'1:64893913483:web:3a3bdf2a2d4f07b03d878e'};
const app=initializeApp(cfg),auth=getAuth(app);let db;try{db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});}catch{db=getFirestore(app)}
const el=id=>document.getElementById(id);let units=null,campers=null,scores=null,unsubs=[],ready=false,previous=new Map(),busy=false;
let categoryLoaded=false;
// Offline queue is scoped to the signed-in administrator and retained across sign-outs.
const QUEUE_PREFIX='sriClubOfflineScoresV1:';
let pendingScores=[],syncingQueue=false,queueOwner=null;
const queueKey=uid=>QUEUE_PREFIX+uid;
function readQueue(uid){try{const q=JSON.parse(localStorage.getItem(queueKey(uid))||'[]');return Array.isArray(q)?q.filter(x=>x&&x.record&&x.record.id):[]}catch{return []}}
function persistQueue(){if(!queueOwner)return;localStorage.setItem(queueKey(queueOwner),JSON.stringify(pendingScores))}
function queuedCount(){return pendingScores.length}
function showQueueStatus(message){status(message+(queuedCount()?' · '+queuedCount()+' score(s) pending sync':''))}
function overlayPending(){
  if(!queueOwner||!auth.currentUser||queueOwner!==auth.currentUser.uid)return;
  for(const item of pendingScores){
    const u=campData.units.find(x=>x.id===item.unitId);if(!u)continue;
    const list=item.targetType==='unit'?u.records:u.members.find(c=>c.id===item.targetId)?.records;
    if(list&&!list.some(r=>r.id===item.record.id))list.push({...item.record,pendingSync:true});
  }
}
async function syncQueue(){
  if(syncingQueue||!navigator.onLine||!auth.currentUser||!ready||!queueOwner||queueOwner!==auth.currentUser.uid)return;
  syncingQueue=true;
  try{
    for(const item of [...pendingScores]){
      if(!auth.currentUser||auth.currentUser.uid!==queueOwner||!navigator.onLine)break;
      try{
        // Stable document IDs make retries idempotent even after an uncertain connection failure.
        await setDoc(doc(db,'clubScores',item.record.id),item.payload);
        pendingScores=pendingScores.filter(x=>x.record.id!==item.record.id);
        persistQueue();
        showQueueStatus('Offline score synchronized to Firebase.');
      }catch(error){showQueueStatus('Sync paused: '+error.message);break}
    }
  }finally{syncingQueue=false;if(ready)apply()}
}
window.cloudPendingScoreCount=()=>queuedCount();

const status=t=>{el('cloud-status').textContent=t};
const gate=t=>{el('cloud-gate').hidden=false;el('cloud-gate').style.display='block';el('cloud-auth-status').textContent=t};
function maps(){const m=new Map();for(const u of campData.units){for(const r of u.records||[])m.set(r.id,{record:r,unitId:u.id,targetType:'unit',targetId:u.id});for(const c of u.members||[])for(const r of c.records||[])m.set(r.id,{record:r,unitId:u.id,targetType:'camper',targetId:c.id});}return m;}
function apply(){if(!ready||busy)return;const oldUnit=activeUnitId,oldMember=typeof activeMemberId!=='undefined'?activeMemberId:null;const arr=units.map(u=>({id:u.id,name:u.name,members:campers.filter(c=>c.unitId===u.id).map(c=>({id:c.id,name:c.name,records:[]})),records:[]}));for(const s of scores){const u=arr.find(x=>x.id===s.unitId);if(!u)continue;const r={id:s.id,type:s.type,points:s.points,date:s.date||String(s.clientCreatedAt||'').slice(0,10),reason:s.reason||''};if(s.targetType==='unit')u.records.push(r);else{const c=u.members.find(x=>x.id===s.targetId);if(c)c.records.push(r);}}campData={units:arr};overlayPending();previous=maps();try{localStorage.setItem('sriCloudIntegrationTestDataV1',JSON.stringify(campData))}catch{}renderDashboard();if(oldUnit&&arr.some(u=>u.id===oldUnit)){try{renderUnitPage()}catch{}}if(oldMember){try{renderMemberPage()}catch{}}status('Cloud loaded: '+arr.length+' units, '+campers.length+' campers, '+scores.length+' scores.');}
function subscribe(){status('Checking Firestore collections…');unsubs.forEach(f=>f());unsubs=[];ready=false;categoryLoaded=false;units=campers=scores=null;for(const [name,assign] of [['clubUnits',v=>units=v],['clubCampers',v=>campers=v],['clubScores',v=>scores=v]]){unsubs.push(onSnapshot(collection(db,name),{includeMetadataChanges:true},snap=>{assign(snap.docs.map(d=>({id:d.id,...d.data()})));if(units&&campers&&scores){ready=true;try{apply()}catch(e){console.error("Dashboard processing error",e);status("Dashboard error: "+e.message);return}showQueueStatus(snap.metadata.hasPendingWrites?'Changes waiting to sync…':snap.metadata.fromCache?'Showing cached data; server not confirmed.':'Cloud connected · '+scores.length+' scores');if(!snap.metadata.fromCache&&navigator.onLine)void syncQueue();}},err=>status('Firebase error: '+err.message)));}
unsubs.push(onSnapshot(doc(db,'clubSettings','scoreCategories'),{includeMetadataChanges:true},snapshot=>{
  if(!snapshot.exists()){categoryLoaded=true;return}
  const d=snapshot.data();if(!Array.isArray(d.merit)||!Array.isArray(d.demerit)||!d.merit.length||!d.demerit.length)return;
  scoreCategories={merit:d.merit,demerit:d.demerit};categoryLoaded=true;renderCategoryFields();
},err=>status('Category sync error: '+err.message)));
}
// Score records use explicit Firestore operations. Never infer deletions from a UI snapshot.
window.cloudSyncChange=()=>{console.warn('Legacy cloudSyncChange disabled: use cloudSaveScoreRecord/cloudDeleteScoreRecord.');};
window.cloudSaveScoreRecord=async (record,targetType,targetId,unitId)=>{
  if(!requireCloud())throw new Error('Sign in and wait for your club data to load.');
  if(!['unit','camper'].includes(targetType)||!record?.id||!unitId||!targetId)throw new Error('Invalid score target.');
  if(!queueOwner||queueOwner!==auth.currentUser.uid)throw new Error('Offline storage is not ready for this account.');
  const payload={targetType,targetId,unitId,type:record.type,points:Number(record.points),date:record.date||'',reason:record.reason||'',clientCreatedAt:new Date().toISOString(),createdBy:auth.currentUser.uid};
  const item={record:{id:record.id,type:record.type,points:Number(record.points),date:record.date||'',reason:record.reason||''},targetType,targetId,unitId,payload};
  if(pendingScores.some(x=>x.record.id===record.id))throw new Error('This score is already queued.');
  // Save locally first, before attempting network. Never claim cloud confirmation yet.
  pendingScores.push(item);
  try{persistQueue()}catch(error){pendingScores=pendingScores.filter(x=>x.record.id!==record.id);throw new Error('Unable to store offline score on this device: '+error.message)}
  apply();showQueueStatus('Score saved on this device. Pending Firebase sync.');
  if(navigator.onLine)void syncQueue();
  return {pending:true};
};
window.cloudDeleteScoreRecord=async recordId=>{
  if(!requireCloud()||!navigator.onLine)throw new Error('Sign in and connect to the internet before deleting scores.');
   if(pendingScores.some(x=>x.record.id===recordId))throw new Error('This score is pending sync. Wait until it is synchronized before deleting.');
  status('Deleting score from Firebase…');
  try {await deleteDoc(doc(db,'clubScores',recordId));status('Score deleted from Firebase. Waiting for dashboard update…');}
  catch(error){status('Score deletion failed: '+error.message);throw error;}
};
// Non-destructive entity management: each unit/camper is its own Firestore document.
// Deletion remains disabled until dependent scores can be handled safely.
function requireCloud(){if(!ready||!auth.currentUser||signingOutForIdle){alert('Wait for cloud data to load and sign in before editing.');return false}return true}
function saveEntity(path,id,data){status('Saving change to cloud…');setDoc(doc(db,path,id),data,{merge:true}).catch(e=>{status('Save error: '+e.message);alert('Cloud save failed: '+e.message)})}
window.addUnit=()=>{if(!requireCloud())return;openNameDialog('Add Unit','Enter the new unit name:','',name=>{const n=name.trim();if(!n)return 'Please enter a unit name.';if(units.some(u=>u.name.toLowerCase()===n.toLowerCase()))return 'A unit with this name already exists.';saveEntity('clubUnits',createId(),{name:n});})};
window.renameUnit=id=>{if(!requireCloud())return;const u=units.find(x=>x.id===id);if(!u)return;openNameDialog('Rename Unit','Enter the new unit name:',u.name,name=>{const n=name.trim();if(!n)return 'Please enter a unit name.';if(units.some(x=>x.id!==id&&x.name.toLowerCase()===n.toLowerCase()))return 'Another unit already uses that name.';saveEntity('clubUnits',id,{name:n});})};
window.addMember=unitId=>{if(!requireCloud())return;const u=units.find(x=>x.id===unitId);if(!u)return;openNameDialog('Add Camper',`Enter a camper's full name for ${u.name}:`,'',name=>{const n=name.trim();if(!n)return 'Please enter a camper name.';saveEntity('clubCampers',createId(),{name:n,unitId});})};
window.addMemberToActiveUnit=()=>{if(activeUnitId)window.addMember(activeUnitId)};
// Safety-first cleanup: delete ONLY empty campers, then empty units.
// Always verify the dependent collections against the SERVER before deletion.
let deleteInProgress=false;
async function verifiedEmptyDelete(kind,id){
  if(deleteInProgress)return;
  if(!requireCloud()||!navigator.onLine){alert('Deletion requires an online, signed-in connection.');return}
  const isUnit=kind==='unit';
  const item=isUnit?units.find(u=>u.id===id):campers.find(c=>c.id===id);
  if(!item){alert('This item no longer exists.');return}
  const name=item.name;
  const label=isUnit?'unit':'camper';
  const warning=isUnit
    ? `Delete unit "${name}"? Only an EMPTY unit can be deleted. All campers and scores must be removed first.`
    : `Delete camper "${name}"? Only a camper with NO score records can be deleted.`;
  if(!confirm(warning))return;
  const typed=prompt(`To confirm, type DELETE exactly to remove ${label} "${name}":`);
  if(typed!=='DELETE'){status('Deletion cancelled.');return}
  deleteInProgress=true;
  status(`Checking ${label} against the Firestore server…`);
  try{
    // Read directly from server, never trust a possibly stale offline cache.
    const collectionName=isUnit?'clubUnits':'clubCampers';
    const existing=await getDocsFromServer(query(collection(db,collectionName),where('__name__','==',id)));
    if(existing.empty){throw new Error('Item is already absent from the server. Refresh before retrying.')}
    const checks=isUnit
      ? [query(collection(db,'clubCampers'),where('unitId','==',id)),query(collection(db,'clubScores'),where('unitId','==',id))]
      : [query(collection(db,'clubScores'),where('targetType','==','camper'),where('targetId','==',id))];
    const results=await Promise.all(checks.map(q=>getDocsFromServer(q)));
    if(results.some(s=>!s.empty)){
      throw new Error(isUnit
        ? 'This unit still contains campers or scores. Remove its test scores and camper(s) first.'
        : 'This camper still has score records. Delete only the intended test scores first.');
    }
    // Final check that this item is still the same named entity.
    const current=existing.docs[0].data();
    if(current.name!==name)throw new Error('The name changed during deletion. Please try again.');
    await deleteDoc(doc(db,collectionName,id));
    status(`Deleted empty ${label} "${name}". Waiting for live synchronization…`);
  }catch(error){
    console.error('Safe delete failed',error);
    status('Deletion blocked: '+error.message);
    alert('No deletion completed: '+error.message);
  }finally{deleteInProgress=false}
}
window.deleteUnit=id=>verifiedEmptyDelete('unit',id);
window.deleteMember=id=>verifiedEmptyDelete('camper',id);
// Keep scoring category definitions synchronized as one shared Firestore document.
// The document is only written after the administrator explicitly edits categories.
window.manageCategories=()=>{if(!requireCloud()||!categoryLoaded){alert('Wait for categories to load.');return}
  const type=prompt('Which categories would you like to edit? Type MERIT or DEMERIT:');if(type===null)return;
  const key=type.trim().toLowerCase();if(key!=='merit'&&key!=='demerit'){showError('Please enter MERIT or DEMERIT.');return}
  const answer=prompt(`Edit ${key} categories. Enter one category per line:`,scoreCategories[key].join('\n'));if(answer===null)return;
  const categories=[...new Set(answer.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
  if(!categories.length||categories.some(x=>x.length>80)){showError('Keep at least one category; maximum 80 characters each.');return}
  saveEntity('clubSettings','scoreCategories',{[key]:categories});
};
el('cloud-login').addEventListener('submit',async e=>{e.preventDefault();explicitLoginPending=true;try{await signInWithEmailAndPassword(auth,el('cloud-email').value.trim(),el('cloud-password').value);el('cloud-password').value=''}catch(err){explicitLoginPending=false;gate('Sign in failed: '+err.message)}});
// Auto logout after 15 minutes without interaction. A warning appears during the last minute.
const IDLE_LIMIT_MS=15*60*1000;
const IDLE_WARNING_MS=60*1000;
let lastInteraction=0,idleTimer=null,warningVisible=false,signingOutForIdle=false,explicitLoginPending=false;
// Persist activity across Android app suspension and browser restarts.
const activityKey=uid=>'sriClubLastActivityV2:'+uid;
function storedActivity(uid){
  try {const n=Number(localStorage.getItem(activityKey(uid)));return Number.isFinite(n)&&n>0&&n<=Date.now()?n:0}
  catch{return 0}
}
function recordActivity(){
  lastInteraction=Date.now();
  try{if(auth.currentUser)localStorage.setItem(activityKey(auth.currentUser.uid),String(lastInteraction))}catch(error){console.warn('Could not persist session activity',error)}
}
function clearActivity(uid){try{if(uid)localStorage.removeItem(activityKey(uid))}catch{}}

const idleNotice=document.createElement('div');
idleNotice.id='idle-logout-warning';
idleNotice.setAttribute('role','alertdialog');
idleNotice.setAttribute('aria-modal','true');
idleNotice.setAttribute('aria-label','Automatic sign-out warning');
idleNotice.style.cssText='display:none;position:fixed;inset:0;z-index:100001;background:#071c32bb;align-items:center;justify-content:center;padding:16px';
idleNotice.innerHTML='<div style="background:white;color:#142b44;border-radius:16px;max-width:430px;width:100%;padding:24px;box-shadow:0 8px 35px #0003"><h2 style="margin:0 0 12px">You will be signed out soon</h2><p id="idle-warning-text" style="line-height:1.5">You have been inactive. For security, this session will end shortly.</p><button id="idle-stay-signed-in" type="button" style="background:#126b73;color:white;border:0;border-radius:8px;padding:12px 18px;font-weight:600;cursor:pointer">Stay signed in</button></div>';
document.body.appendChild(idleNotice);
function hideIdleWarning(){warningVisible=false;idleNotice.style.display='none'}
function markActivity(){
  if(!auth.currentUser||signingOutForIdle)return;
  // Mouse movement, scrolling, etc. only count as activity when the warning is not shown.
  // During the warning, require an explicit click on "Stay signed in".
  if(warningVisible)return;
  // Do not let a first tap after a long suspension renew an expired session.
  if(Date.now()-lastInteraction>=IDLE_LIMIT_MS){void idleCheck();return}
  recordActivity();
}
for(const eventName of ['pointerdown','keydown','touchstart','scroll','mousemove']){
  window.addEventListener(eventName,markActivity,{passive:true});
}
el('idle-stay-signed-in').addEventListener('click',()=>{
  if(Date.now()-lastInteraction>=IDLE_LIMIT_MS){void idleCheck();return}
  recordActivity();hideIdleWarning();status('Session extended. Automatic sign-out after 15 minutes of inactivity.');
});
async function idleCheck(){
  if(!auth.currentUser||signingOutForIdle)return;
  const remaining=IDLE_LIMIT_MS-(Date.now()-lastInteraction);
  if(remaining<=0){
    signingOutForIdle=true;hideIdleWarning();
    const uid=auth.currentUser.uid;clearActivity(uid);gate('Session expired after 15 minutes of inactivity. Sign in again.');
    // Sign-out never deletes local Firestore cache or queued offline writes.
    try{await signOut(auth);gate('Signed out after 15 minutes of inactivity. Sign in to continue.');}
    catch(error){signingOutForIdle=false;status('Automatic sign-out failed: '+error.message)}
  }else if(remaining<=IDLE_WARNING_MS){
    if(!warningVisible){warningVisible=true;idleNotice.style.display='flex'}
    const seconds=Math.max(1,Math.ceil(remaining/1000));
    el('idle-warning-text').textContent='For security, you will be signed out in '+seconds+' second'+(seconds===1?'':'s')+'. Select Stay signed in to continue.';
  }
}
function startIdleMonitor(user){
  signingOutForIdle=false;hideIdleWarning();
  if(explicitLoginPending){explicitLoginPending=false;recordActivity()}
  else lastInteraction=storedActivity(user.uid);
  if(idleTimer)clearInterval(idleTimer);
  if(!lastInteraction||Date.now()-lastInteraction>=IDLE_LIMIT_MS){
    // Never display cached private data before an expired session is signed out.
    lastInteraction=0;void idleCheck();return false;
  }
  idleTimer=setInterval(idleCheck,1000);
  return true;
}
function stopIdleMonitor(){if(idleTimer)clearInterval(idleTimer);idleTimer=null;hideIdleWarning();signingOutForIdle=false}
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(auth.currentUser&&lastInteraction)try{localStorage.setItem(activityKey(auth.currentUser.uid),String(lastInteraction))}catch{};return}void idleCheck()});
window.addEventListener('pageshow',()=>{void idleCheck();if(navigator.onLine)void syncQueue()});
window.addEventListener('online',()=>{void idleCheck();void syncQueue()});
window.addEventListener('focus',()=>{void idleCheck()});
el('cloud-signout').addEventListener('click',()=>{clearActivity(auth.currentUser?.uid);return signOut(auth)});
window.addEventListener('error',e=>{console.error('Diagnostic page error',e.error||e.message);status('Page error: '+(e.error?.message||e.message))});
window.addEventListener('unhandledrejection',e=>{console.error('Diagnostic async error',e.reason);status('Async error: '+(e.reason?.message||String(e.reason)))});
onAuthStateChanged(auth,user=>{if(user){if(!startIdleMonitor(user))return;queueOwner=user.uid;pendingScores=readQueue(user.uid);el('cloud-gate').style.display='none';el('cloud-bar').style.display='block';try{subscribe()}catch(e){console.error('Subscription startup error',e);status('Subscription error: '+e.message)}Promise.all(['clubUnits','clubCampers','clubScores'].map(n=>getDocs(collection(db,n)))).then(v=>{if(!ready)status('Direct Firestore read: '+v.map((s,i)=>['units','campers','scores'][i]+' '+s.size).join(', ')+'; live listener not ready')}).catch(e=>{status('Firestore read error: '+e.message);console.error(e)})}else{queueOwner=null;pendingScores=[];stopIdleMonitor();unsubs.forEach(f=>f());unsubs=[];ready=false;el('cloud-bar').style.display='none';el('cloud-login').hidden=false;gate('Sign in with your Firebase administrator account.')}});

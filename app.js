import { firebaseConfig } from "./firebase-config.js";

const FIREBASE_VERSION = "10.12.2";
const FIREBASE_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const state = {
  user: null, auth: null, db: null, f: null,
  memberships: [], activeMembership: null,
  chanda: [], kharcha: [], members: [], requests: [],
  editingChandaId: null, editingKharchaId: null,
  unsubscribers: [], membershipUnsubscribe: null
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  loading: $("#loading-overlay"), offlineBanner: $("#offline-banner"), configBanner: $("#config-banner"),
  toastContainer: $("#toast-container"), accountButton: $("#account-button"), logoutButton: $("#logout-button"),
  bottomNav: $("#bottom-nav"), screens: document.querySelectorAll(".screen"), navButtons: document.querySelectorAll(".nav-button"),
  workspaceBar: $("#workspace-bar"), workspaceName: $("#workspace-name"), workspaceRole: $("#workspace-role"),
  chandaAdminPanel: $("#chanda-admin-panel"), kharchaAdminPanel: $("#kharcha-admin-panel"),
  chandaForm: $("#chanda-form"), kharchaForm: $("#kharcha-form"), chandaList: $("#chanda-list"), kharchaList: $("#kharcha-list"),
  chandaSearch: $("#chanda-search"), kharchaSearch: $("#kharcha-search"), chandaCancel: $("#chanda-cancel"), kharchaCancel: $("#kharcha-cancel"),
  createTempleForm: $("#create-temple-form"), joinTempleForm: $("#join-temple-form"), templeSwitcher: $("#temple-switcher"),
  myTemplesCard: $("#my-temples-card"), activeTempleCard: $("#active-temple-card"), workspaceId: $("#workspace-id"),
  requestsCard: $("#requests-card"), requestsList: $("#requests-list"), membersCard: $("#members-card"), membersList: $("#members-list"), dangerZone: $("#danger-zone"), deleteTempleButton: $("#delete-temple-button")
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const formatCurrency = (value) => money.format(Number(value) || 0);
const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const formatDate = (value) => { const d = value?.toDate ? value.toDate() : new Date(value); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d); };
const inputDate = (value) => { const d = value?.toDate ? value.toDate() : new Date(value); if (Number.isNaN(d.getTime())) return today(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const canEdit = () => ["owner", "admin"].includes(state.activeMembership?.role);
const isOwner = () => state.activeMembership?.role === "owner";

function toast(message, type = "") {
  const node = document.createElement("div"); node.className = `toast ${type}`.trim(); node.textContent = message;
  elements.toastContainer.appendChild(node); setTimeout(() => node.remove(), 4000);
}
function busy(button, enabled, label) {
  if (!button) return;
  if (enabled) { button.dataset.label = button.textContent; button.textContent = label; button.disabled = true; }
  else { button.textContent = button.dataset.label || button.textContent; button.disabled = false; }
}
function showScreen(name) {
  if (!state.user && name !== "account") name = "account";
  if (state.user && !state.activeMembership && !["temple", "account"].includes(name)) name = "temple";
  elements.screens.forEach((screen) => screen.classList.toggle("active", screen.id === `${name}-screen`));
  elements.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.screen === name));
  elements.bottomNav.classList.toggle("hidden", !state.user || name === "account");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function firebaseConfigured() { return ["apiKey", "authDomain", "projectId", "appId"].every((key) => firebaseConfig[key] && !String(firebaseConfig[key]).startsWith("YOUR_")); }
function timestampFromInput(value) { return state.f.Timestamp.fromDate(new Date(`${value}T12:00:00`)); }
function membershipId(uid, templeId) { return `${uid}_${templeId}`; }

const editIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
const deleteIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>';

function renderDashboard() {
  const donations = state.chanda.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const expenses = state.kharcha.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const donors = new Set(state.chanda.map((x) => String(x.donorName || "").trim().toLowerCase()).filter(Boolean));
  $("#total-chanda").textContent = formatCurrency(donations); $("#total-kharcha").textContent = formatCurrency(expenses);
  $("#net-balance").textContent = formatCurrency(donations - expenses); $("#total-donors").textContent = donors.size; $("#total-expenses").textContent = state.kharcha.length;
}
function renderChanda() {
  const term = elements.chandaSearch.value.trim().toLowerCase();
  const rows = state.chanda.filter((x) => String(x.donorName || "").toLowerCase().includes(term));
  elements.chandaList.innerHTML = rows.length ? rows.map((x) => `<article class="entry-card"><div class="entry-main"><div class="entry-title-row"><h4 class="entry-title">${escapeHtml(x.donorName)}</h4><p class="entry-amount income">${formatCurrency(x.amount)}</p></div><div class="entry-meta"><span class="meta-chip">${formatDate(x.date)}</span><span class="meta-chip">${escapeHtml(x.paymentMode)}</span></div>${x.note ? `<p class="entry-note">${escapeHtml(x.note)}</p>` : ""}</div>${canEdit() ? `<div class="entry-actions"><button class="icon-button" data-action="edit-chanda" data-id="${x.id}" aria-label="Edit donation">${editIcon}</button><button class="icon-button delete" data-action="delete-chanda" data-id="${x.id}" aria-label="Delete donation">${deleteIcon}</button></div>` : ""}</article>`).join("") : `<div class="empty-state">${term ? "No matching donor found." : "No donation entries yet."}</div>`;
}
function renderKharcha() {
  const term = elements.kharchaSearch.value.trim().toLowerCase();
  const rows = state.kharcha.filter((x) => String(x.description || "").toLowerCase().includes(term));
  elements.kharchaList.innerHTML = rows.length ? rows.map((x) => `<article class="entry-card"><div class="entry-main"><div class="entry-title-row"><h4 class="entry-title">${escapeHtml(x.description)}</h4><p class="entry-amount outgoing">${formatCurrency(x.amount)}</p></div><div class="entry-meta"><span class="meta-chip">${formatDate(x.date)}</span><span class="meta-chip">${escapeHtml(x.category)}</span></div>${x.note ? `<p class="entry-note">${escapeHtml(x.note)}</p>` : ""}</div>${canEdit() ? `<div class="entry-actions"><button class="icon-button" data-action="edit-kharcha" data-id="${x.id}" aria-label="Edit expense">${editIcon}</button><button class="icon-button delete" data-action="delete-kharcha" data-id="${x.id}" aria-label="Delete expense">${deleteIcon}</button></div>` : ""}</article>`).join("") : `<div class="empty-state">${term ? "No matching expense found." : "No expense entries yet."}</div>`;
}
function renderWorkspace() {
  const active = state.activeMembership;
  elements.workspaceBar.classList.toggle("hidden", !active);
  elements.chandaAdminPanel.classList.toggle("hidden", !canEdit()); elements.kharchaAdminPanel.classList.toggle("hidden", !canEdit());
  elements.myTemplesCard.classList.toggle("hidden", !state.memberships.length);
  elements.activeTempleCard.classList.toggle("hidden", !active); elements.membersCard.classList.toggle("hidden", !active);
  elements.requestsCard.classList.toggle("hidden", !active || !isOwner());
  elements.dangerZone.classList.toggle("hidden", !active || !isOwner());
  if (active) { elements.workspaceName.textContent = active.templeName; elements.workspaceRole.textContent = active.role[0].toUpperCase() + active.role.slice(1); elements.workspaceId.textContent = active.templeId; }
  elements.templeSwitcher.innerHTML = state.memberships.map((m) => `<button class="temple-choice ${m.templeId === active?.templeId ? "active" : ""}" data-temple-id="${m.templeId}"><strong>${escapeHtml(m.templeName)}</strong><span>${escapeHtml(m.role)}</span></button>`).join("");
  elements.membersList.innerHTML = state.members.length ? state.members.map((m) => {
    const owner = m.role === "owner";
    const roleControl = isOwner() && !owner
      ? `<div class="member-controls"><select class="role-select" data-action="change-role" data-member-id="${m.id}" aria-label="Role for ${escapeHtml(m.displayName || m.email || "member")}"><option value="admin" ${m.role === "admin" ? "selected" : ""}>Admin</option><option value="viewer" ${m.role === "viewer" ? "selected" : ""}>Viewer</option></select><button class="icon-button delete" data-action="remove-member" data-member-id="${m.id}" aria-label="Remove member">×</button></div>`
      : `<span class="role-badge">${escapeHtml(m.role)}</span>`;
    return `<article class="member-row"><div><strong>${escapeHtml(m.displayName || m.email || "Member")}</strong><span>${escapeHtml(m.email || "")}</span></div>${roleControl}</article>`;
  }).join("") : '<div class="empty-state">No members found.</div>';
  elements.requestsList.innerHTML = state.requests.length ? state.requests.map((r) => `<article class="member-row"><div><strong>${escapeHtml(r.displayName || r.email || "User")}</strong><span>${escapeHtml(r.email || "")}</span></div><div class="approval-actions"><button class="primary-button compact" data-action="approve" data-role="admin" data-uid="${r.uid}">Approve Admin</button><button class="secondary-button compact" data-action="approve" data-role="viewer" data-uid="${r.uid}">Viewer</button><button class="icon-button delete" data-action="reject" data-uid="${r.uid}" aria-label="Reject request">×</button></div></article>`).join("") : '<div class="empty-state">No pending requests.</div>';
  renderDashboard(); renderChanda(); renderKharcha();
}
function renderAccount() {
  elements.accountButton.textContent = state.user ? (state.user.displayName || "My account") : "Sign in";
  elements.logoutButton.classList.toggle("hidden", !state.user);
  if (!state.user) { elements.workspaceBar.classList.add("hidden"); elements.bottomNav.classList.add("hidden"); }
}

function clearWorkspaceListeners() { state.unsubscribers.forEach((unsub) => unsub()); state.unsubscribers = []; state.chanda=[]; state.kharcha=[]; state.members=[]; state.requests=[]; }
function activateTemple(membership) {
  clearWorkspaceListeners(); state.activeMembership = membership || null; resetChanda(); resetKharcha(); renderWorkspace();
  if (!membership) { showScreen("temple"); elements.loading.classList.add("hidden"); return; }
  const tid = membership.templeId; const { collection, query, where, orderBy, onSnapshot } = state.f;
  state.unsubscribers.push(onSnapshot(query(collection(state.db, "temples", tid, "chanda"), orderBy("date", "desc")), (snap) => { state.chanda=snap.docs.map(d=>({id:d.id,...d.data()})); renderDashboard(); renderChanda(); }, firestoreError));
  state.unsubscribers.push(onSnapshot(query(collection(state.db, "temples", tid, "kharcha"), orderBy("date", "desc")), (snap) => { state.kharcha=snap.docs.map(d=>({id:d.id,...d.data()})); renderDashboard(); renderKharcha(); }, firestoreError));
  state.unsubscribers.push(onSnapshot(query(collection(state.db, "memberships"), where("templeId", "==", tid)), (snap) => { state.members=snap.docs.map(d=>({id:d.id,...d.data()})); renderWorkspace(); }, firestoreError));
  if (membership.role === "owner") state.unsubscribers.push(onSnapshot(collection(state.db, "temples", tid, "joinRequests"), (snap) => { state.requests=snap.docs.map(d=>({id:d.id,...d.data()})); renderWorkspace(); }, firestoreError));
  renderWorkspace(); elements.loading.classList.add("hidden");
}
function subscribeMemberships() {
  if (state.membershipUnsubscribe) state.membershipUnsubscribe();
  const q = state.f.query(state.f.collection(state.db, "memberships"), state.f.where("uid", "==", state.user.uid));
  state.membershipUnsubscribe = state.f.onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    state.memberships=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.templeName).localeCompare(String(b.templeName)));
    const selected = state.memberships.find(m=>m.templeId===state.activeMembership?.templeId) || state.memberships[0] || null;
    if (snap.metadata.hasPendingWrites && !state.activeMembership) { renderWorkspace(); return; }
    if (selected?.templeId !== state.activeMembership?.templeId || selected?.role !== state.activeMembership?.role) activateTemple(selected); else renderWorkspace();
    if (!selected) { elements.loading.classList.add("hidden"); showScreen("temple"); }
  }, firestoreError);
}
function firestoreError(error) { console.error(error); elements.loading.classList.add("hidden"); toast(error.code === "permission-denied" ? "You do not have permission to access this workspace." : "Cloud data could not be loaded.", "error"); }

async function initialize() {
  if (!firebaseConfigured()) { elements.configBanner.classList.add("show"); elements.loading.classList.add("hidden"); return; }
  try {
    const [appModule, fire, auth] = await Promise.all([import(`${FIREBASE_BASE}/firebase-app.js`), import(`${FIREBASE_BASE}/firebase-firestore.js`), import(`${FIREBASE_BASE}/firebase-auth.js`)]);
    const app=appModule.initializeApp(firebaseConfig); let db;
    try { db=fire.initializeFirestore(app,{localCache:fire.persistentLocalCache({tabManager:fire.persistentMultipleTabManager()})}); } catch { db=fire.getFirestore(app); }
    state.db=db; state.auth=auth.getAuth(app); state.f={...fire,...auth}; await auth.setPersistence(state.auth, auth.browserLocalPersistence);
    auth.onAuthStateChanged(state.auth, (user) => {
      state.user=user; renderAccount(); clearWorkspaceListeners();
      if (state.membershipUnsubscribe) { state.membershipUnsubscribe(); state.membershipUnsubscribe=null; }
      if (user) { elements.loading.classList.remove("hidden"); subscribeMemberships(); if ($("#account-screen").classList.contains("active")) showScreen("temple"); }
      else { state.memberships=[]; state.activeMembership=null; renderWorkspace(); elements.loading.classList.add("hidden"); showScreen("account"); }
    });
  } catch (error) { console.error(error); elements.loading.classList.add("hidden"); toast("Firebase could not start.","error"); }
}

async function googleSignIn() {
  const button=$("#google-signin-button"); busy(button,true,"Opening Google...");
  try {
    const provider=new state.f.GoogleAuthProvider(); provider.setCustomParameters({prompt:"select_account"});
    // Popup auth works across GitHub Pages, mobile browsers and installed PWAs.
    // Redirect auth can lose its session because the Firebase helper runs on a
    // different domain and modern browsers block that cross-site storage.
    await state.f.signInWithPopup(state.auth, provider);
  } catch(error) {
    console.error("Google sign-in error:", error.code, error.message);
    const messages = {
      "auth/operation-not-allowed": "Google login is not enabled in Firebase Authentication.",
      "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "The Firebase API key is incorrect. Copy the configuration again from Firebase Project Settings.",
      "auth/unauthorized-domain": "This website domain is not authorized in Firebase.",
      "auth/popup-blocked": "The browser blocked the Google login popup. Allow popups and try again.",
      "auth/popup-closed-by-user": "Google login was cancelled.",
      "auth/network-request-failed": "Network error. Check your internet connection and try again.",
      "auth/account-exists-with-different-credential": "This email already uses another login method."
    };
    toast(messages[error.code] || `Google sign-in failed (${error.code || "unknown error"}).`, "error");
  }
  finally { busy(button,false); }
}

async function createTemple(event) {
  event.preventDefault(); const button=event.submitter; const name=String(new FormData(event.currentTarget).get("templeName")).trim(); if(!name)return;
  busy(button,true,"Creating...");
  try {
    const templeRef=state.f.doc(state.f.collection(state.db,"temples")); const memberRef=state.f.doc(state.db,"memberships",membershipId(state.user.uid,templeRef.id)); const batch=state.f.writeBatch(state.db);
    batch.set(templeRef,{name,ownerUid:state.user.uid,createdAt:state.f.serverTimestamp()});
    batch.set(memberRef,{uid:state.user.uid,templeId:templeRef.id,templeName:name,displayName:state.user.displayName||"",email:state.user.email||"",role:"owner",createdAt:state.f.serverTimestamp()});
    await batch.commit(); event.currentTarget.reset(); toast("Temple workspace created.","success");
  } catch(error){console.error(error);toast("Workspace could not be created. Check Firestore rules.","error");} finally{busy(button,false);}
}
async function requestAccess(event) {
  event.preventDefault(); const button=event.submitter; const tid=String(new FormData(event.currentTarget).get("templeId")).trim(); busy(button,true,"Sending...");
  try {
    const templeSnap=await state.f.getDoc(state.f.doc(state.db,"temples",tid)); if(!templeSnap.exists()) throw new Error("not-found");
    if(state.memberships.some(m=>m.templeId===tid)) throw new Error("already-member");
    await state.f.setDoc(state.f.doc(state.db,"temples",tid,"joinRequests",state.user.uid),{uid:state.user.uid,displayName:state.user.displayName||"",email:state.user.email||"",requestedAt:state.f.serverTimestamp()});
    event.currentTarget.reset(); toast("Access requested. Ask the temple owner to approve you.","success");
  } catch(error){console.error(error);toast(error.message==="not-found"?"Workspace ID was not found.":error.message==="already-member"?"You already belong to this temple.":"Request could not be sent.","error");} finally{busy(button,false);}
}
async function approveRequest(uid,role) {
  const request=state.requests.find(x=>x.uid===uid); if(!request||!isOwner())return; const tid=state.activeMembership.templeId;
  try { const batch=state.f.writeBatch(state.db); batch.set(state.f.doc(state.db,"memberships",membershipId(uid,tid)),{uid,templeId:tid,templeName:state.activeMembership.templeName,displayName:request.displayName||"",email:request.email||"",role,createdAt:state.f.serverTimestamp()}); batch.delete(state.f.doc(state.db,"temples",tid,"joinRequests",uid)); await batch.commit(); toast(`Member approved as ${role}.`,"success"); } catch(error){console.error(error);toast("Member could not be approved.","error");}
}

async function changeMemberRole(memberId, role) {
  if (!isOwner() || !["admin", "viewer"].includes(role)) return;
  const member = state.members.find((item) => item.id === memberId);
  if (!member || member.role === "owner") return;
  try {
    await state.f.updateDoc(state.f.doc(state.db, "memberships", memberId), { role });
    toast(`${member.displayName || member.email || "Member"} is now ${role}.`, "success");
  } catch (error) {
    console.error(error);
    toast("Member role could not be changed.", "error");
    renderWorkspace();
  }
}

async function removeMember(memberId) {
  if (!isOwner()) return;
  const member = state.members.find((item) => item.id === memberId);
  if (!member || member.role === "owner") return;
  if (!confirm(`Remove ${member.displayName || member.email || "this member"} from the temple?`)) return;
  try {
    await state.f.deleteDoc(state.f.doc(state.db, "memberships", memberId));
    toast("Member removed.", "success");
  } catch (error) {
    console.error(error);
    toast("Member could not be removed.", "error");
  }
}

async function deleteCollectionDocuments(collectionRef) {
  const snapshot = await state.f.getDocs(collectionRef);
  for (let start = 0; start < snapshot.docs.length; start += 400) {
    const batch = state.f.writeBatch(state.db);
    snapshot.docs.slice(start, start + 400).forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

async function deleteTempleWorkspace() {
  if (!isOwner()) return;
  const temple = state.activeMembership;
  const typedName = prompt(`This permanently deletes everything in "${temple.templeName}".\n\nType the temple name exactly to confirm:`);
  if (typedName === null) return;
  if (typedName.trim() !== temple.templeName) {
    toast("Temple name did not match. Nothing was deleted.", "error");
    return;
  }
  if (!confirm("Final confirmation: permanently delete this workspace and all its records?")) return;
  busy(elements.deleteTempleButton, true, "Deleting...");
  const templeId = temple.templeId;
  try {
    clearWorkspaceListeners();
    await deleteCollectionDocuments(state.f.collection(state.db, "temples", templeId, "chanda"));
    await deleteCollectionDocuments(state.f.collection(state.db, "temples", templeId, "kharcha"));
    await deleteCollectionDocuments(state.f.collection(state.db, "temples", templeId, "joinRequests"));

    const membershipSnapshot = await state.f.getDocs(state.f.query(state.f.collection(state.db, "memberships"), state.f.where("templeId", "==", templeId)));
    const nonOwnerMembers = membershipSnapshot.docs.filter((document) => document.data().role !== "owner");
    for (let start = 0; start < nonOwnerMembers.length; start += 400) {
      const batch = state.f.writeBatch(state.db);
      nonOwnerMembers.slice(start, start + 400).forEach((document) => batch.delete(document.ref));
      await batch.commit();
    }

    const finalBatch = state.f.writeBatch(state.db);
    finalBatch.delete(state.f.doc(state.db, "temples", templeId));
    finalBatch.delete(state.f.doc(state.db, "memberships", membershipId(state.user.uid, templeId)));
    await finalBatch.commit();

    state.activeMembership = null;
    state.memberships = state.memberships.filter((item) => item.templeId !== templeId);
    renderWorkspace();
    showScreen("temple");
    toast("Temple workspace permanently deleted.", "success");
  } catch (error) {
    console.error(error);
    toast("Workspace deletion failed. Please try again.", "error");
    subscribeMemberships();
  } finally {
    busy(elements.deleteTempleButton, false);
  }
}
function resetChanda(){state.editingChandaId=null;elements.chandaForm.reset();$("#chanda-date").value=today();$("#chanda-form-title").textContent="Add Chanda";$("#chanda-submit").textContent="Save Chanda";elements.chandaCancel.classList.add("hidden");}
function resetKharcha(){state.editingKharchaId=null;elements.kharchaForm.reset();$("#kharcha-date").value=today();$("#kharcha-form-title").textContent="Add Kharcha";$("#kharcha-submit").textContent="Save Kharcha";elements.kharchaCancel.classList.add("hidden");}
async function saveChanda(event){event.preventDefault();if(!canEdit())return;const button=event.submitter,data=new FormData(event.currentTarget),amount=Number(data.get("amount"));if(!(amount>0))return toast("Enter a valid amount.","error");const record={donorName:String(data.get("donorName")).trim(),amount,date:timestampFromInput(data.get("date")),paymentMode:String(data.get("paymentMode")),note:String(data.get("note")).trim()};busy(button,true,"Saving...");try{const base=["temples",state.activeMembership.templeId,"chanda"];if(state.editingChandaId)await state.f.updateDoc(state.f.doc(state.db,...base,state.editingChandaId),record);else await state.f.addDoc(state.f.collection(state.db,...base),{...record,createdAt:state.f.serverTimestamp(),createdBy:state.user.uid});resetChanda();toast("Chanda saved.","success");}catch(e){console.error(e);toast("Chanda could not be saved.","error");}finally{busy(button,false);}}
async function saveKharcha(event){event.preventDefault();if(!canEdit())return;const button=event.submitter,data=new FormData(event.currentTarget),amount=Number(data.get("amount"));if(!(amount>0))return toast("Enter a valid amount.","error");const record={description:String(data.get("description")).trim(),amount,date:timestampFromInput(data.get("date")),category:String(data.get("category")),note:String(data.get("note")).trim()};busy(button,true,"Saving...");try{const base=["temples",state.activeMembership.templeId,"kharcha"];if(state.editingKharchaId)await state.f.updateDoc(state.f.doc(state.db,...base,state.editingKharchaId),record);else await state.f.addDoc(state.f.collection(state.db,...base),{...record,createdAt:state.f.serverTimestamp(),createdBy:state.user.uid});resetKharcha();toast("Kharcha saved.","success");}catch(e){console.error(e);toast("Kharcha could not be saved.","error");}finally{busy(button,false);}}

async function handleEntryAction(event,type){const button=event.target.closest("button[data-action]");if(!button||!canEdit())return;const isChanda=type==="chanda",items=isChanda?state.chanda:state.kharcha,entry=items.find(x=>x.id===button.dataset.id);if(!entry)return;if(button.dataset.action.startsWith("edit")){if(isChanda){state.editingChandaId=entry.id;$("#donor-name").value=entry.donorName||"";$("#chanda-amount").value=entry.amount||"";$("#chanda-date").value=inputDate(entry.date);$("#payment-mode").value=entry.paymentMode||"Cash";$("#chanda-note").value=entry.note||"";$("#chanda-form-title").textContent="Edit Chanda";$("#chanda-submit").textContent="Update Chanda";elements.chandaCancel.classList.remove("hidden");elements.chandaAdminPanel.scrollIntoView({behavior:"smooth"});}else{state.editingKharchaId=entry.id;$("#expense-description").value=entry.description||"";$("#kharcha-amount").value=entry.amount||"";$("#kharcha-date").value=inputDate(entry.date);$("#expense-category").value=entry.category||"Other";$("#kharcha-note").value=entry.note||"";$("#kharcha-form-title").textContent="Edit Kharcha";$("#kharcha-submit").textContent="Update Kharcha";elements.kharchaCancel.classList.remove("hidden");elements.kharchaAdminPanel.scrollIntoView({behavior:"smooth"});}}else if(button.dataset.action.startsWith("delete")&&confirm("Delete this entry permanently?")){try{await state.f.deleteDoc(state.f.doc(state.db,"temples",state.activeMembership.templeId,type,entry.id));toast("Entry deleted.","success");}catch(e){toast("Entry could not be deleted.","error");}}}

// UI events
elements.navButtons.forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.screen)));
elements.accountButton.addEventListener("click",()=>showScreen(state.user?"temple":"account"));
$("#google-signin-button").addEventListener("click",googleSignIn);
elements.logoutButton.addEventListener("click",async()=>{await state.f.signOut(state.auth);toast("Signed out.","success");});
elements.createTempleForm.addEventListener("submit",createTemple); elements.joinTempleForm.addEventListener("submit",requestAccess);
elements.templeSwitcher.addEventListener("click",(e)=>{const b=e.target.closest("button[data-temple-id]");if(b)activateTemple(state.memberships.find(m=>m.templeId===b.dataset.templeId));});
$("#copy-workspace-id").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(state.activeMembership.templeId);toast("Workspace ID copied.","success");}catch{toast(`Workspace ID: ${state.activeMembership.templeId}`);}});
elements.membersList.addEventListener("change", (event) => {
  const select = event.target.closest('select[data-action="change-role"]');
  if (select) changeMemberRole(select.dataset.memberId, select.value);
});
elements.membersList.addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="remove-member"]');
  if (button) removeMember(button.dataset.memberId);
});
elements.deleteTempleButton.addEventListener("click", deleteTempleWorkspace);elements.requestsList.addEventListener("click",async(e)=>{const b=e.target.closest("button[data-action]");if(!b)return;if(b.dataset.action==="approve")await approveRequest(b.dataset.uid,b.dataset.role);if(b.dataset.action==="reject"&&confirm("Reject this access request?"))await state.f.deleteDoc(state.f.doc(state.db,"temples",state.activeMembership.templeId,"joinRequests",b.dataset.uid));});
elements.chandaForm.addEventListener("submit",saveChanda);elements.kharchaForm.addEventListener("submit",saveKharcha);elements.chandaCancel.addEventListener("click",resetChanda);elements.kharchaCancel.addEventListener("click",resetKharcha);
elements.chandaList.addEventListener("click",e=>handleEntryAction(e,"chanda"));elements.kharchaList.addEventListener("click",e=>handleEntryAction(e,"kharcha"));elements.chandaSearch.addEventListener("input",renderChanda);elements.kharchaSearch.addEventListener("input",renderKharcha);
function onlineStatus(){elements.offlineBanner.classList.toggle("show",!navigator.onLine);} window.addEventListener("online",()=>{onlineStatus();toast("Back online — syncing data.","success");});window.addEventListener("offline",onlineStatus);onlineStatus();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));
resetChanda();resetKharcha();initialize();
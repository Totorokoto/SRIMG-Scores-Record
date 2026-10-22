
const STORAGE_KEY = "sriCloudIntegrationTestDataV1";

let campData = loadData();
let activeUnitId = null;

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      if (parsed && Array.isArray(parsed.units)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Could not load saved camp data:", error);
  }

  return { units: [] };
}


function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campData));

    window.cloudSyncChange?.();
    renderDashboard();

    if (activeUnitId) {
      renderUnitPage();
    }

    if (activeMemberId) {
      renderMemberPage();
    }
  } catch (error) {
    showError("Unable to save data. Please check your browser storage.");
    console.error(error);
  }
}

function createId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char];
  });
}

function calculateUnitScore(unit) {
  const members = unit.members || [];
  const individualPoints = members.reduce((total, member) => {
    return total + (member.records || []).reduce((sum, record) => {
      return sum + (record.type === "merit"
        ? Number(record.points)
        : -Number(record.points));
    }, 0);
  }, 0);

  const teamPoints = (unit.records || []).reduce((total, record) => {
    return total + (record.type === "merit"
      ? Number(record.points)
      : -Number(record.points));
  }, 0);

  return individualPoints + teamPoints;
}

function renderDashboard() {
  const container = document.getElementById("units-container");
  if (!container) return;

  const units = campData.units;

  document.getElementById("total-units").textContent = units.length;

  document.getElementById("total-campers").textContent =
    units.reduce((sum, unit) => sum + (unit.members || []).length, 0);

  let merits = 0;
  let demerits = 0;

  units.forEach(unit => {
    (unit.members || []).forEach(member => {
      (member.records || []).forEach(record => {
        if (record.type === "merit") merits += Number(record.points);
        else demerits += Number(record.points);
      });
    });

    (unit.records || []).forEach(record => {
      if (record.type === "merit") merits += Number(record.points);
      else demerits += Number(record.points);
    });
  });

  document.getElementById("total-merits").textContent = merits;
  document.getElementById("total-demerits").textContent = demerits;

  if (units.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">♧</div>
        <h3>No units added yet</h3>
        <p>Add your first unit to begin organizing your campers.</p>
        <button class="primary-button" type="button" onclick="addUnit()">
          + Add Your First Unit
        </button>
      </div>`;
    return;
  }

  const rankedUnits = [...units].sort((a, b) =>
    calculateUnitScore(b) - calculateUnitScore(a)
  );

  container.innerHTML = rankedUnits.map((unit, index) => `
    <article class="unit-card">
      <div class="unit-card-top">
        <div class="unit-avatar">${escapeHTML(unit.name.charAt(0).toUpperCase())}</div>
        <div class="unit-actions">
          <button class="small-button" onclick="renameUnit('${unit.id}')"
            title="Rename unit" aria-label="Rename unit">✎</button>
          <button class="small-button danger-button"
            onclick="deleteUnit('${unit.id}')"
            title="Delete unit" aria-label="Delete unit">×</button>
        </div>
      </div>
      <div class="unit-rank">RANK #${index + 1}</div>
      <h3>${escapeHTML(unit.name)}</h3>
      <p class="member-count">${(unit.members || []).length} camper(s)</p>
      <div class="unit-score-row">
        <span>Current score</span>
        <strong>${calculateUnitScore(unit)} pts</strong>
      </div>
      <button class="open-unit-button" onclick="openUnit('${unit.id}')">
        Manage Unit →
      </button>
    </article>
  `).join("");
}

function addUnit() {
  openNameDialog("Add Unit", "Enter the new unit name:", "", name => {
    const cleanName = name.trim();
    if (!cleanName) return "Please enter a unit name.";
    if (campData.units.some(unit => unit.name.toLowerCase() === cleanName.toLowerCase())) return "A unit with this name already exists.";
    campData.units.push({id:createId(), name:cleanName, members:[], records:[]});
    saveData();
  });
}
function renameUnit(id) {
  const unit = campData.units.find(item => item.id === id);
  if (!unit) return;
  openNameDialog("Rename Unit", "Enter the new unit name:", unit.name, name => {
    const cleanName = name.trim();
    if (!cleanName) return "The unit name cannot be empty.";
    if (campData.units.some(item => item.id !== id && item.name.toLowerCase() === cleanName.toLowerCase())) return "Another unit already uses that name.";
    unit.name = cleanName; saveData();
  });
}

function deleteUnit(id) {
  const unit = campData.units.find(item => item.id === id);
  if (!unit) return;

  const confirmed = confirm(
    `Delete "${unit.name}" and all its members and score records? This cannot be undone.`
  );

  if (!confirmed) return;

  campData.units = campData.units.filter(item => item.id !== id);

  if (activeUnitId === id) activeUnitId = null;

  saveData();
}


function addMember(unitId) {
  const unit = campData.units.find(item => item.id === unitId);
  if (!unit) return;
  openNameDialog("Add Camper", `Enter a camper's full name for ${unit.name}:`, "", name => {
    const cleanName = name.trim();
    if (!cleanName) return "Please enter a camper's name.";
    unit.members.push({id:createId(), name:cleanName, records:[]}); saveData();
  });
}

function viewMembers(unitId) {
  const unit = campData.units.find(item => item.id === unitId);
  if (!unit) return;

  if (unit.members.length === 0) {
    showError(`${unit.name} has no campers yet.`);
    return;
  }

  const list = unit.members.map((member, index) =>
    `${index + 1}. ${member.name}`
  ).join("\n");

  showError(`${unit.name} — Members\n\n${list}`);
}

document.addEventListener("DOMContentLoaded", function () {
  const dateElement = document.getElementById("today-date");

  if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  document.getElementById("add-unit-btn").addEventListener("click", addUnit);

  renderDashboard();
});


function setActiveMenu(page) {
  document.querySelectorAll('.nav-item[data-page]').forEach(button => {
    button.classList.toggle('active', button.dataset.page === page);
  });
}
function hidePages() {
  document.querySelector('.main-content').classList.add('hidden');
  ['unit-page', 'member-page', 'listing-page'].forEach(id => document.getElementById(id).classList.add('hidden'));
}
function showDashboard() {
  hidePages();
  document.querySelector('.main-content').classList.remove('hidden');
  activeUnitId = null;
  activeMemberId = null;
  setActiveMenu('dashboard');
  renderDashboard();
}
function showListing(page) {
  hidePages();
  activeUnitId = null;
  activeMemberId = null;
  document.getElementById('listing-page').classList.remove('hidden');
  currentListing = page;
  setActiveMenu(page);
  renderListing();
}
let currentListing = 'campers';
function getRecordTotals(records) {
  return (records || []).reduce((totals, record) => {
    const points = Number(record.points) || 0;
    if (record.type === 'merit') totals.merits += points;
    if (record.type === 'demerit') totals.demerits += points;
    return totals;
  }, {merits: 0, demerits: 0});
}
function renderListing() {
  const title = document.getElementById('listing-title');
  const description = document.getElementById('listing-description');
  const container = document.getElementById('listing-content');
  title.textContent = {campers:'Campers', units:'Units', reports:'Unit Reports'}[currentListing];
  description.textContent = {campers:'Campers grouped by unit. Select Record Points to award or deduct individual points.', units:'All units. Select Team Points to award or deduct points for the whole unit.', reports:'Summary of individual and team points for every unit.'}[currentListing];
  if (!campData.units.length) { container.innerHTML = '<div class="history-empty">No units yet. Add one from the Dashboard.</div>'; return; }
  if (currentListing === 'campers') {
    container.innerHTML = campData.units.map(unit => `<section class="record-section"><div class="section-heading"><h2>${escapeHTML(unit.name)}</h2><span>${(unit.members || []).length} campers</span></div><div class="quick-list">${(unit.members || []).length ? unit.members.map(member => {
      const totals = getRecordTotals(member.records);
      return `<div class="quick-row"><div><strong>${escapeHTML(member.name)}</strong><p>Merits: ${totals.merits} · Demerits: ${totals.demerits} · Net: ${totals.merits - totals.demerits}</p></div><button type="button" class="primary-button" onclick="openMemberFromList('${unit.id}','${member.id}')">Record Points</button></div>`;
    }).join('') : '<p>No campers in this unit yet.</p>'}</div></section>`).join('');
  } else if (currentListing === 'units') {
    container.innerHTML = `<div class="units-grid">${campData.units.map(unit => `<article class="unit-card"><h3>${escapeHTML(unit.name)}</h3><p class="member-count">${(unit.members || []).length} campers</p><div class="unit-score-row"><span>Combined score</span><strong>${calculateUnitScore(unit)} pts</strong></div><button type="button" class="open-unit-button" onclick="openUnit('${unit.id}')">Team Points →</button></article>`).join('')}</div>`;
  } else {
    const rows = campData.units.map(unit => {
      const team = getRecordTotals(unit.records);
      const individuals = (unit.members || []).reduce((sum, member) => {
        const t = getRecordTotals(member.records); sum.merits += t.merits; sum.demerits += t.demerits; return sum;
      }, {merits:0, demerits:0});
      return `<tr><td><strong>${escapeHTML(unit.name)}</strong><div class="report-sub">${(unit.members || []).length} campers</div></td><td>${individuals.merits}</td><td>${individuals.demerits}</td><td>${team.merits}</td><td>${team.demerits}</td><td><strong>${calculateUnitScore(unit)}</strong></td><td><button class="open-unit-button" onclick="openUnit('${unit.id}')">Details</button></td></tr>`;
    }).join('');
    container.innerHTML = `<div class="report-scroll"><table class="report-table"><thead><tr><th>Unit</th><th>Camper merits</th><th>Camper demerits</th><th>Team merits</th><th>Team demerits</th><th>Net score</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
}
function openMemberFromList(unitId, memberId) {
  activeUnitId = unitId;
  openMember(memberId);
}


function openUnit(id) {
  const unit = campData.units.find(item => item.id === id);
  if (!unit) return;

  activeUnitId = id;
  activeMemberId = null;

  hidePages();
  document.getElementById("unit-page").classList.remove("hidden");

  renderUnitPage();
}


function renderUnitPage() {
  const unit = campData.units.find(item => item.id === activeUnitId);
  if (!unit) {
    showDashboard();
    return;
  }

  document.getElementById("unit-page-name").textContent = unit.name;
  document.getElementById("unit-member-count").textContent = unit.members.length;

  let merits = 0;
  let demerits = 0;

  unit.members.forEach(member => {
    (member.records || []).forEach(record => {
      if (record.type === "merit") merits += Number(record.points);
      else demerits += Number(record.points);
    });
  });

  (unit.records || []).forEach(record => {
    if (record.type === "merit") merits += Number(record.points);
    else demerits += Number(record.points);
  });

  document.getElementById("unit-merits").textContent = merits;
  document.getElementById("unit-demerits").textContent = demerits;
  document.getElementById("unit-total-score").textContent =
    calculateUnitScore(unit);

  const teamHistory = document.getElementById('team-history');
  const allRecords = [
    ...(unit.records || []).map(record => ({record, camper: null})),
    ...(unit.members || []).flatMap(member => (member.records || []).map(record => ({record, camper: member})))
  ].sort((a,b) => (b.record.date || '').localeCompare(a.record.date || ''));
  teamHistory.innerHTML = allRecords.length ? allRecords.map(({record, camper}) => `
    <article class="history-item"><div><h3>${escapeHTML(record.reason || '')}</h3>
    <p><strong>${camper ? 'Camper: ' + escapeHTML(camper.name) : 'Whole Unit'}</strong> · ${record.type === 'merit' ? 'Merit' : 'Demerit'} · ${escapeHTML(record.date || '')}</p>
    ${camper ? '' : `<button type="button" class="delete-record-button" onclick="deleteTeamRecord('${record.id}')">Delete team record</button>`}
    </div><div class="history-points ${record.type}">${record.type === 'merit' ? '+' : '−'}${Number(record.points)}</div></article>
  `).join('') : '<div class="history-empty">No unit or camper score records yet.</div>';
  const teamDate = document.getElementById("team-score-date");
  if (teamDate && !teamDate.value) teamDate.value = localDateString();

  const container = document.getElementById("members-container");

  if (unit.members.length === 0) {
    container.innerHTML = `
      <div class="members-empty">
        <h3>No campers registered yet</h3>
        <p>Add members to begin tracking their scores.</p>
        <button class="primary-button" onclick="addMemberToActiveUnit()">
          + Add First Camper
        </button>
      </div>`;
    return;
  }

  container.innerHTML = unit.members.map(member => {
    const score = (member.records || []).reduce((sum, record) => {
      return sum + (record.type === "merit"
        ? Number(record.points)
        : -Number(record.points));
    }, 0);

    return `
      <article class="member-card">
        <div class="member-avatar">
          ${escapeHTML(member.name.charAt(0).toUpperCase())}
        </div>
        <div class="member-info">
          <h3>${escapeHTML(member.name)}</h3>
          <p>${(member.records || []).length} score record(s)</p>
        </div>
        <div class="member-score">${score} pts</div>
        <button class="member-open-button"
          onclick="openMember('${member.id}')">View</button>
        <button type="button" class="small-button danger-button" onclick="deleteMember('${member.id}')" title="Delete empty camper only" aria-label="Delete empty camper">Delete Camper</button>
      </article>`;
  }).join("");
}

function addMemberToActiveUnit() {
  if (activeUnitId) addMember(activeUnitId);
}

let activeMemberId = null;

function openMember(memberId) {
  const unit = campData.units.find(item => item.id === activeUnitId);
  if (!unit) return;

  const member = unit.members.find(item => item.id === memberId);
  if (!member) return;

  activeMemberId = memberId;

  hidePages();
  document.getElementById("member-page").classList.remove("hidden");

  renderMemberPage();
}

function renderMemberPage() {
  const unit = campData.units.find(item => item.id === activeUnitId);
  if (!unit) return;

  const member = unit.members.find(item => item.id === activeMemberId);
  if (!member) return;

  document.getElementById("member-page-name").textContent = member.name;
  document.getElementById("member-page-unit").textContent = unit.name;

  const records = member.records || [];
  let merits = 0;
  let demerits = 0;

  records.forEach(record => {
  const points = Number(record.points) || 0;

  if (record.type === "merit") {
    merits += points;
  } else if (record.type === "demerit") {
    demerits += points;
  }
});

  document.getElementById("member-merits").textContent = merits;
  document.getElementById("member-demerits").textContent = demerits;
  document.getElementById("member-net-score").textContent = merits - demerits;

  const history = document.getElementById("member-history");

  if (records.length === 0) {
    history.innerHTML = `
      <div class="history-empty">
        No score records yet. Use the form above to add the first record.
      </div>`;
  } else {
    history.innerHTML = [...records].reverse().map(record => `
      <article class="history-item">
        <div>
          <h3>${escapeHTML(record.reason)}</h3>
          <p>${record.type === "merit" ? "Merit" : "Demerit"} ·
             ${escapeHTML(record.date)}</p>
          <button type="button" class="delete-record-button"
            onclick="deleteMemberRecord('${record.id}')">
            Delete record
          </button>
        </div>
        <div class="history-points ${record.type}">
          ${record.type === "merit" ? "+" : "−"}${Number(record.points)}
        </div>
      </article>
    `).join("");
  }

  const dateInput = document.getElementById("score-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = localDateString();
  }
}

function deleteMemberRecord(recordId) {
  const unit = campData.units.find(item => item.id === activeUnitId);
  if (!unit) return;

  const member = unit.members.find(item => item.id === activeMemberId);
  if (!member) return;

  const record = member.records.find(item => item.id === recordId);
  if (!record) return;

  if (!confirm(`Delete this score record: "${record.reason}"?`)) return;

  member.records = member.records.filter(item => item.id !== recordId);

  saveData();
  renderMemberPage();
}


// Date in local time, not UTC.
function localDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Keep the existing {id, type, points, date, reason} record structure.
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("score-form");
  if (!form) {
    console.error("Score form not found. Check index.html.");
    return;
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const unit = campData.units.find(item => item.id === activeUnitId);
    const member = unit && unit.members.find(item => item.id === activeMemberId);
    if (!member) { showError("Please select a camper first."); return; }

    const meritInput = document.getElementById("merit-points").value.trim();
    const demeritInput = document.getElementById("demerit-points").value.trim();
    const merit = meritInput === "" ? 0 : Number(meritInput);
    const demerit = demeritInput === "" ? 0 : Number(demeritInput);
    const date = document.getElementById("score-date").value;
    const meritCategories = getCheckedCategories(form, "merit");
    const demeritCategories = getCheckedCategories(form, "demerit");
    const notes = document.getElementById("score-notes").value.trim();

    if (![merit, demerit].every(n => Number.isSafeInteger(n) && n >= 0) ||
        merit + demerit === 0 || !date || (merit > 0 && !meritCategories.length) || (demerit > 0 && !demeritCategories.length)) {
      showError("Enter positive whole-number merit or demerit points (or both), a date, and at least one category.");
      return;
    }

    const meritReason = meritCategories.join(", ") + (notes ? " — " + notes : "");
    const demeritReason = demeritCategories.join(", ") + (notes ? " — " + notes : "");
    member.records = member.records || [];
    const newRecords = [];
    if (merit > 0) newRecords.push({ id: createId(), type: "merit", points: merit, date, reason: meritReason });
    if (demerit > 0) newRecords.push({ id: createId(), type: "demerit", points: demerit, date, reason: demeritReason });
    // Check storage before changing the in-memory records.
    const previous = [...member.records];
    member.records.push(...newRecords);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(campData));
    } catch (error) {
      member.records = previous;
      console.error("Score save failed:", error);
      showError("Could not save this score. Your previous records are unchanged.");
      return;
    }
    window.cloudSyncChange?.();
    renderDashboard();
    renderUnitPage();
    renderMemberPage();
    form.reset();
    document.getElementById("score-date").value = localDateString();
  });
});


function deleteTeamRecord(recordId) {
  const unit = campData.units.find(item => item.id === activeUnitId);
  if (!unit) return;
  const record = (unit.records || []).find(item => item.id === recordId);
  if (!record || !confirm(`Delete this team score: "${record.reason}"?`)) return;
  const previous = unit.records;
  unit.records = previous.filter(item => item.id !== recordId);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(campData)); }
  catch (error) { unit.records = previous; showError("Unable to delete team score."); return; }
  window.cloudSyncChange?.();
  renderDashboard(); renderUnitPage();
}

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("team-score-form");
  if (!form) return;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const unit = campData.units.find(item => item.id === activeUnitId);
    if (!unit) return;
    const meritText = document.getElementById("team-merit-points").value.trim();
    const demeritText = document.getElementById("team-demerit-points").value.trim();
    const merit = meritText === "" ? 0 : Number(meritText);
    const demerit = demeritText === "" ? 0 : Number(demeritText);
    const date = document.getElementById("team-score-date").value;
    const meritCategories = getCheckedCategories(form, "merit");
    const demeritCategories = getCheckedCategories(form, "demerit");
    const notes = document.getElementById("team-score-notes").value.trim();
    if (![merit, demerit].every(n => Number.isSafeInteger(n) && n >= 0) ||
        merit + demerit === 0 || !date || (merit > 0 && !meritCategories.length) || (demerit > 0 && !demeritCategories.length)) {
      showError("Enter merit or demerit points (or both), a date, and at least one category."); return;
    }
    const meritReason = meritCategories.join(", ") + (notes ? " — " + notes : "");
    const demeritReason = demeritCategories.join(", ") + (notes ? " — " + notes : "");
    const previous = unit.records || [];
    const added = [];
    if (merit > 0) added.push({ id: createId(), type: "merit", points: merit, date, reason: meritReason });
    if (demerit > 0) added.push({ id: createId(), type: "demerit", points: demerit, date, reason: demeritReason });
    unit.records = [...previous, ...added];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(campData)); }
    catch (error) { unit.records = previous; showError("Unable to save team score. Previous records are unchanged."); return; }
    window.cloudSyncChange?.();
  renderDashboard(); renderUnitPage();
    form.reset(); document.getElementById("team-score-date").value = localDateString();
  });
});


// Category settings are stored separately from camper and team score records.
const CATEGORY_STORAGE_KEY = "sriCloudIntegrationTestCategoriesV1";
const DEFAULT_CATEGORIES = {
  merit: ["Participation", "Teamwork", "Leadership", "Punctuality", "Cleanliness", "Helping Others"],
  demerit: ["Discipline Violation", "Late Arrival", "Untidy Area", "Improper Uniform", "Disobeying Instructions"]
};
function loadCategories() {
  try {
    const data = JSON.parse(localStorage.getItem(CATEGORY_STORAGE_KEY));
    if (data && Array.isArray(data.merit) && Array.isArray(data.demerit)) return data;
  } catch (error) { console.error("Category settings could not be loaded:", error); }
  return { merit: [...DEFAULT_CATEGORIES.merit], demerit: [...DEFAULT_CATEGORIES.demerit] };
}
let scoreCategories = loadCategories();
function renderCategoryFields() {
  for (const [containerId, prefix] of [["camper-category-fields", "camper"], ["team-category-fields", "team"]]) {
    const container = document.getElementById(containerId);
    if (!container) continue;
    container.innerHTML = ["merit", "demerit"].map(type => `
      <fieldset class="category-field category-${type}">
        <legend>${type === "merit" ? "Merit Reasons (+)" : "Demerit Reasons (−)"} — choose one or more</legend>
        <div class="category-grid">${scoreCategories[type].map(category => `
          <label><input type="checkbox" name="${type}-category" value="${escapeHTML(category)}"> ${escapeHTML(category)}</label>
        `).join("")}</div>
      </fieldset>
    `).join("");
  }
}
function getCheckedCategories(form, type) {
  return Array.from(form.querySelectorAll(`input[name="${type}-category"]:checked`)).map(input => input.value);
}
function manageCategories() {
  const type = prompt("Which categories would you like to edit? Type MERIT or DEMERIT:");
  if (type === null) return;
  const key = type.trim().toLowerCase();
  if (key !== "merit" && key !== "demerit") { showError("Please enter MERIT or DEMERIT."); return; }
  const answer = prompt(`Edit ${key} categories. Enter one category per line. You can add, rename or remove categories here:`, scoreCategories[key].join("\n"));
  if (answer === null) return;
  const categories = [...new Set(answer.split(/\r?\n/).map(item => item.trim()).filter(Boolean))];
  if (!categories.length) { showError("Please keep at least one category."); return; }
  if (categories.some(item => item.length > 80)) { showError("Each category must be 80 characters or fewer."); return; }
  const updated = { ...scoreCategories, [key]: categories };
  try { localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(updated)); }
  catch (error) { showError("Could not save categories. No changes were made."); return; }
  scoreCategories = updated;
  renderCategoryFields();
}
document.addEventListener("DOMContentLoaded", renderCategoryFields);

// Centered name-entry and error dialogs. They do not change existing stored records.
let nameDialogAction = null;
function openNameDialog(title, description, initialValue, onSave) {
  document.getElementById("dialog-title").textContent = title;
  document.getElementById("dialog-description").textContent = description;
  document.getElementById("dialog-name").value = initialValue;
  document.getElementById("dialog-error").classList.add("hidden");
  nameDialogAction = onSave;
  document.getElementById("app-dialog").classList.remove("hidden");
  document.getElementById("dialog-name").focus();
}
function closeNameDialog() {
  document.getElementById("app-dialog").classList.add("hidden");
  nameDialogAction = null;
}
function showError(message) {
  document.getElementById("app-error-message").textContent = String(message);
  document.getElementById("app-error").classList.remove("hidden");
  document.getElementById("app-error-close").focus();
}
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("dialog-cancel").addEventListener("click", closeNameDialog);
  document.getElementById("dialog-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!nameDialogAction) return;
    const error = nameDialogAction(document.getElementById("dialog-name").value);
    if (typeof error === "string" && error) {
      const el = document.getElementById("dialog-error");
      el.textContent = error;
      el.classList.remove("hidden");
      return;
    }
    closeNameDialog();
  });
  document.getElementById("app-error-close").addEventListener("click", () => {
    document.getElementById("app-error").classList.add("hidden");
  });
});

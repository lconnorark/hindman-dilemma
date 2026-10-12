/* Commander’s Dilemma — Prairie Grove (Confederate perspective, deterministic)
   - Exactly two choices per decision; historic choices highlighted.
   - JPG base map is loaded inside the script via MAP_SRC or URL ?map= parameter.
   - Bars show labels only during play; numbers are revealed at Outcome.
   - Intelligence condition removed entirely (no bar/label/number).
   - Morale & Cohesion degrade as casualties increase and supply falls.
   - Troop lines per phase align to ABT positions; Decision 5 Union line is north of the Confederate ridge. */

/* ---------- Map file configuration ---------- */
/* Put your JPG in ./assets/ and set MAP_SRC below; OR call the page with ?map=yourfile.jpg */
const DEFAULT_MAP_SRC = "./assets/prairie-grove-historic-base.jpg";

/* ---------- State ---------- */
const state = {
  time: 6,
  supply: 30,
  morale: 35,
  cohesion: 50,
  casualties: 0,
  step: 1,
  path: [],
  phases: [],
  historicCount: 0
};
const STEP_MAX = 7;

/* ---------- DOM refs ---------- */
const dilemmaCard  = document.getElementById("dilemmaCard");
const sceneTitle   = document.getElementById("sceneTitle");
const sceneBody    = document.getElementById("sceneBody");
const choiceList   = document.getElementById("choiceList");
const confirmBtn   = document.getElementById("confirmBtn");
const resetBtn     = document.getElementById("resetBtn");
const shareBtn     = document.getElementById("shareBtn");

const timeBar      = document.getElementById("timeBar");
const supplyBar    = document.getElementById("supplyBar");
const moraleBar    = document.getElementById("moraleBar");
const casualtyBar  = document.getElementById("casualtyBar");
const cohesionBar  = document.getElementById("cohesionBar");

const timeVal      = document.getElementById("timeVal");
const supplyVal    = document.getElementById("supplyVal");
const moraleVal    = document.getElementById("moraleVal");
const casualtyVal  = document.getElementById("casualtyVal");
const cohesionVal  = document.getElementById("cohesionVal");

const stepVal      = document.getElementById("stepVal");
const stepMaxEl    = document.getElementById("stepMax");
const phaseTag     = document.getElementById("phaseTag");
const routeTag     = document.getElementById("routeTag");

const outcomeBox     = document.getElementById("outcomeBox");
const outcomeTitle   = document.getElementById("outcomeTitle");
const outcomeSummary = document.getElementById("outcomeSummary");
const finalMorale    = document.getElementById("finalMorale");
const finalMoraleNum = document.getElementById("finalMoraleNum");
const finalSupply    = document.getElementById("finalSupply");
const finalCohesion  = document.getElementById("finalCohesion");
const finalCohesionNum = document.getElementById("finalCohesionNum");
const finalTime      = document.getElementById("finalTime");
const finalCasualties= document.getElementById("finalCasualties");
const finalPhases    = document.getElementById("finalPhases");
const finalPath      = document.getElementById("finalPath");
const historicCount  = document.getElementById("historicCount");

/* Map elements */
const mapBase       = document.getElementById("mapBase");
const confLinesGroup= document.getElementById("confLines");
const unionLinesGroup= document.getElementById("unionLines");

stepMaxEl.textContent = String(STEP_MAX);

/* ---------- Helpers ---------- */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* Label mappers (labels only during play) */
function labelTime(val) {
  const pct = (clamp(val,0,12)/12)*100;
  if (pct >= 80) return "Very High";
  if (pct >= 60) return "High";
  if (pct >= 40) return "Moderate";
  if (pct >= 20) return "Low";
  return "Very Low";
}
function labelSupply(val) {
  const pct = clamp(val,0,100);
  if (pct >= 80) return "Very High";
  if (pct >= 60) return "High";
  if (pct >= 40) return "Moderate";
  if (pct >= 20) return "Low";
  return "Very Low";
}
function labelCasualties(val) {
  const pct = (clamp(val,0,1700)/1700)*100;
  if (pct < 20) return "Very Low";
  if (pct < 40) return "Low";
  if (pct < 60) return "Moderate";
  if (pct < 80) return "High";
  return "Very High";
}

/* Morale & Cohesion degrade as casualties rise / supply falls */
function effectiveMorale() {
  const base = clamp(state.morale, 0, 100);
  const casualtyPenalty = Math.floor(state.casualties / 50);      // up to ~34 at 1700
  const supplyPenalty   = Math.max(0, Math.floor((50 - state.supply) / 5)); // penalty if supply < 50
  return clamp(base - casualtyPenalty - supplyPenalty, 0, 100);
}
function labelMorale() {
  const m = effectiveMorale();
  if (m >= 80) return "Excellent";
  if (m >= 60) return "Good";
  if (m >= 40) return "Fair";
  if (m >= 20) return "Poor";
  return "Distraught";
}

function effectiveCohesion() {
  const base = clamp(state.cohesion, 0, 100);
  const casualtyPenalty = Math.floor(state.casualties / 40);      // harsher on cohesion
  const supplyPenalty   = Math.max(0, Math.floor((40 - state.supply) / 4)); // penalty if supply < 40
  return clamp(base - casualtyPenalty - supplyPenalty, 0, 100);
}
function labelCohesion() {
  const c = effectiveCohesion();
  if (c >= 75) return "Brothers-in-Arms";
  if (c >= 50) return "Together";
  if (c >= 25) return "Falling Apart";
  return "Disintegrated";
}

/* During play: bars + labels only */
function updateBars() {
  supplyBar.style.width   = `${clamp(state.supply,0,100)}%`;
  moraleBar.style.width   = `${effectiveMorale()}%`;
  timeBar.style.width     = `${(clamp(state.time,0,12)/12)*100}%`;
  cohesionBar.style.width = `${effectiveCohesion()}%`;
  casualtyBar.style.width = `${(clamp(state.casualties,0,1700)/1700)*100}%`;

  supplyVal.textContent   = labelSupply(state.supply);
  moraleVal.textContent   = labelMorale();
  timeVal.textContent     = labelTime(state.time);
  cohesionVal.textContent = labelCohesion();
  casualtyVal.textContent = labelCasualties(state.casualties);

  stepVal.textContent     = `${state.step}`;
}
function setPhase(label) {
  phaseTag.textContent = `Phase: ${label}`;
  state.phases.push(label);
}

/* ---------- Historic choice mapping ---------- */
const HISTORIC_CHOICES = {
  "1": "1A",
  "2": "2A",
  "3": "3B",
  "4": "4B",
  "5": "5A",
  "6": "6A",
  "7": "7A"
};

/* ---------- Scenario decisions (two options per phase) ----------
   Casualty totals (worst path) are capped at 1700; lowest path ~1060. */
const NODES = {
  "1": {
    id: "1",
    title: "08:30–09:00 • Cavalry Contact at Prairie Grove Church",
    body:
      "Near <strong>Prairie Grove Church</strong>, Marmaduke’s cavalry drives Federal horse back across the <strong>Illinois River</strong>. " +
      "Confederate infantry forms on the <strong>wooded ridge</strong> west of the river.",
    phase: "08:30–09:00 • Contact at Prairie Grove Church",
    choices: [
      { id: "1A", label: "Hold the ridge; keep screens light",
        desc: "Conserve energy; slower intel; cohesion steadier.",
        effects: s => { s.time -= 0; s.cohesion += 3; s.morale += 1; s.supply -= 2; s.casualties += 60; } },
      { id: "1B", label: "Push the screens forward",
        desc: "Better eyes; risk cohesion and tempo.",
        effects: s => { s.time -= 1; s.cohesion -= 4; s.morale += 1; s.supply -= 4; s.casualties += 140; } }
    ],
    next: "2"
  },
  "2": {
    id: "2",
    title: "10:00–11:00 • Herron’s Artillery at the Illinois River",
    body:
      "Herron reaches the <strong>Illinois River</strong> and positions artillery to duel your guns on the ridge.",
    phase: "10:00–11:00 • Artillery Duel across the Illinois",
    choices: [
      { id: "2A", label: "Spread batteries along the crest",
        desc: "Broader coverage; less massed fire.",
        effects: s => { s.morale += 2; s.time -= 1; s.casualties += 160; s.supply -= 6; } },
      { id: "2B", label: "Concentrate guns for counterbattery",
        desc: "Stronger massed fire; higher exposure per unit.",
        effects: s => { s.morale += 3; s.time -= 1; s.casualties += 220; s.supply -= 8; } }
    ],
    next: "3"
  },
  "3": {
    id: "3",
    title: "~13:00 • First Federal Assault up the Ridge",
    body:
      "Around <strong>1:00 p.m.</strong>, Herron’s infantry attacks up the <strong>Prairie Grove ridge</strong> and is repulsed.",
    phase: "~13:00 • First Assault Repulsed",
    choices: [
      { id: "3A", label: "Commit reserves to thicken the line",
        desc: "Higher cohesion; more losses; tempo slows.",
        effects: s => { s.cohesion += 6; s.time -= 1; s.casualties += 280; s.morale += 2; s.supply -= 6; } },
      { id: "3B", label: "Conserve ammo; hold positions",
        desc: "Lower losses now; cohesion drifts.",
        effects: s => { s.casualties += 160; s.cohesion -= 4; s.morale += 1; s.supply -= 3; } }
    ],
    next: "4"
  },
  "4": {
    id: "4",
    title: "~14:00–15:00 • Second Push & Confederate Counters",
    body:
      "A second Federal push climbs the slope; your counterattacks bite but meet canister.",
    phase: "~14:00–15:00 • Second Push & Counters on the Ridge",
    choices: [
      { id: "4A", label: "Limited counter; restore the line",
        desc: "Cohesion steadies; fewer losses.",
        effects: s => { s.cohesion += 4; s.casualties += 200; s.morale += 2; s.time -= 0; s.supply -= 5; } },
      { id: "4B", label: "Drive harder to exploit",
        desc: "Greater shock; higher casualties; tempo cost.",
        effects: s => { s.cohesion -= 2; s.casualties += 320; s.morale += 3; s.time -= 1; s.supply -= 8; } }
    ],
    next: "5"
  },
  "5": {
    id: "5",
    title: "~15:00–16:00 • Blunt Arrives North of the Ridge (Borden House)",
    body:
      "Blunt’s men arrive <strong>north</strong> of your ridge near the <strong>Borden House &amp; Orchard</strong> area. Decide how to respond.",
    phase: "~15:00–16:00 • Blunt’s Flank Pressure North of Ridge",
    choices: [
      { id: "5A", label: "Shift brigades to the left",
        desc: "Blunt checked; center thins.",
        effects: s => { s.cohesion += 2; s.casualties += 220; s.morale += 1; s.time -= 0; s.supply -= 7; } },
      { id: "5B", label: "Hold center; accept pressure left",
        desc: "Center steady; losses rise on the flank.",
        effects: s => { s.cohesion += 1; s.casualties += 320; s.morale += 0; s.time -= 0; s.supply -= 5; } }
    ],
    next: "6"
  },
  "6": {
    id: "6",
    title: "Late Afternoon • Ammunition Running Low",
    body:
      "Reports of dwindling rounds; decide whether to husband ammunition or press locally.",
    phase: "Late Afternoon • Ammunition Low",
    choices: [
      { id: "6A", label: "Husband ammunition; shorten the line",
        desc: "Lower immediate losses; cohesion improves; tempo slows.",
        effects: s => { s.casualties += 160; s.cohesion += 4; s.time -= 1; s.morale += 1; s.supply -= 10; } },
      { id: "6B", label: "Press with bayonet where possible",
        desc: "Higher losses; morale uptick; cohesion variable.",
        effects: s => { s.casualties += 260; s.morale += 3; s.cohesion -= 1; s.time -= 0; s.supply -= 12; } }
    ],
    next: "7"
  },
  "7": {
    id: "7",
    title: "After Dusk • Withdrawal Decision",
    body:
      "Darkness settles. Withdraw toward Van Buren or hold the ridge overnight.",
    phase: "After Dusk • Night Withdrawal Decision",
    choices: [
      { id: "7A", label: "Withdraw toward Van Buren",
        desc: "Avoid isolation; concede field; preserve force.",
        effects: s => { s.time -= 0; s.morale -= 1; s.cohesion += 2; s.casualties += 100; s.supply -= 5; } },
      { id: "7B", label: "Hold the ridge overnight",
        desc: "Risk isolation; morale steadies; supply remains critical.",
        effects: s => { s.time -= 0; s.morale += 1; s.supply -= 8; s.casualties += 160; } }
    ],
    next: "END"
  }
};

/* ---------- Outcome ---------- */
function labelSupplyScore(val){ return clamp(val,0,100); }
function computeOutcome(s) {
  const tempo = Math.max(0, s.time) * 2;
  const score = effectiveMorale() + labelSupplyScore(s.supply) + effectiveCohesion() + tempo - Math.min(s.casualties / 10, 170);
  let title, summary;
  if (score >= 140) { title = "Tactical Success (Contested)"; summary = "You maintained a fighting withdrawal with controlled losses, but the field is not yours."; }
  else if (score >= 110) { title = "Marginal Success"; summary = "You preserved combat power with trade‑offs; future operations will depend on resupply and cohesion."; }
  else if (score >= 85) { title = "Costly Stalemate"; summary = "The ridge held at moments, but losses and logistics eroded your position."; }
  else { title = "Repulse"; summary = "Fatigue, losses, and tempo gaps broke the plan; withdrawal is advised."; }
  return { score, title, summary };
}

/* Reveal numbers only in Outcome */
function showOutcome() {
  state.supply = clamp(state.supply, 0, 5); // enforce low/gone by Decision 7
  updateBars();
  confirmBtn.disabled = true;

  const result = computeOutcome(state);
  outcomeTitle.textContent   = result.title;
  outcomeSummary.textContent = result.summary;

  finalMorale.textContent     = labelMorale();
  finalMoraleNum.textContent  = `${effectiveMorale()}`;
  finalSupply.textContent     = `${state.supply} (0 = gone)`;
  finalCohesion.textContent   = labelCohesion();
  finalCohesionNum.textContent= `${effectiveCohesion()}`;
  finalTime.textContent       = `${Math.max(0, state.time)}`;
  finalCasualties.textContent = `${state.casualties}`;
  historicCount.textContent   = `${state.historicCount}`;
  finalPhases.textContent     = state.phases.join(" → ");
  finalPath.textContent       = state.path.join(" → ");

  outcomeBox.classList.remove("hidden");
}

/* ---------- Troop lines (SVG overlay on JPG base map) ----------
   Normalized 0–100 coords matched to historic base & ABT map.
   Decision 5 Union line is north (smaller Y) of ridge to reflect arrival north of the Confederate line. */
const TROOP_LINES = {
  "1": { // ridge + union cavalry screen
    conf: [ [[18,60],[32,58],[45,58],[60,59],[78,62]] ],
    union: [ [[70,39],[76,38],[82,37]] ]
  },
  "2": { // Herron across the river
    conf: [ [[18,60],[32,58],[45,58],[60,59],[78,62]] ],
    union: [ [[62,44],[70,42],[78,40]] ]
  },
  "3": { // first assault
    conf: [ [[18,60],[32,58],[45,58],[60,59],[78,62]] ],
    union: [ [[55,60],[62,59],[70,58]] ]
  },
  "4": { // counters & recoil
    conf: [ [[20,60],[34,58],[48,57],[62,58],[78,62]] ],
    union: [ [[56,62],[63,61],[71,60]] ]
  },
  "5": { // Blunt north of ridge + Herron opposite ridge
    conf: [ [[20,60],[34,58],[48,57],[62,58],[78,62]] ],
    union: [
      /* Blunt’s line north of ridge (smaller Y than ~58–62): */
      [[30,50],[40,52]],
      /* Herron still opposite ridge near river */
      [[62,44],[70,42],[78,40]]
    ]
  },
  "6": { // shortened line
    conf: [ [[24,61],[46,59],[68,61]] ],
    union: [
      [[30,50],[42,52]],                /* Blunt holds north flank */
      [[58,60],[66,59],[74,58]]         /* Herron opposite ridge */
    ]
  },
  "7": { // withdrawal axis
    conf: [ [[16,78],[12,88]] ],
    union: [
      [[30,50],[42,52]],                /* Blunt north flank */
      [[56,60],[66,59],[76,58]]         /* Union line holding ridge/prairie */
    ]
  }
};

/* Apply small geometry nudges for some choices (visual variation only) */
function adjustForChoice(phaseId, choiceId) {
  const lines = JSON.parse(JSON.stringify(TROOP_LINES[phaseId])); // copy
  if (!choiceId) return lines;

  if (phaseId === "5") {
    if (choiceId === "5A") { // shift brigades left: pull conf arc slightly toward Borden area
      lines.conf[0] = [[18,60],[30,59],[44,58],[60,59],[78,62]];
      /* keep Blunt north of ridge */
      lines.union[0] = [[28,49],[40,51]];
    } else if (choiceId === "5B") { // hold center: keep arc center-weighted
      lines.conf[0] = [[22,61],[35,59],[48,58],[62,59],[78,62]];
      lines.union[0] = [[32,51],[44,53]];
    }
  }
  if (phaseId === "6") {
    if (choiceId === "6A") { // shorten further
      lines.conf[0] = [[26,62],[46,60],[66,61]];
    } else if (choiceId === "6B") { // press locally mid
      lines.conf[0] = [[24,61],[48,58],[68,61]];
    }
  }
  return lines;
}

/* SVG drawing */
function drawTroopLines(phaseId, choiceId = null) {
  const { conf, union } = adjustForChoice(phaseId, choiceId);
  confLinesGroup.replaceChildren();
  unionLinesGroup.replaceChildren();

  conf.forEach(points => {
    const pl = document.createElementNS("http://www.w3.org/2000/svg","polyline");
    pl.setAttribute("points", points.map(p => `${p[0]},${p[1]}`).join(" "));
    confLinesGroup.appendChild(pl);
  });
  union.forEach(points => {
    const pl = document.createElementNS("http://www.w3.org/2000/svg","polyline");
    pl.setAttribute("points", points.map(p => `${p[0]},${p[1]}`).join(" "));
    unionLinesGroup.appendChild(pl);
  });
}

/* ---------- Rendering ---------- */
function focusSceneTitle() { sceneTitle.setAttribute("tabindex","-1"); sceneTitle.focus(); }

function renderNode(nodeId) {
  const node = NODES[nodeId];
  if (!node) return;

  outcomeBox.classList.add("hidden");
  confirmBtn.disabled = false;

  sceneTitle.innerHTML = node.title;
  sceneBody.innerHTML  = node.body;
  setPhase(node.phase);

  // Build exactly two choices
  choiceList.replaceChildren();
  node.choices.forEach((ch, i) => {
    const wrap = document.createElement("div");
    wrap.className = `choice${i === 0 ? " selected" : ""}`;
    wrap.dataset.choiceId = ch.id;

    const radio = document.createElement("input");
    radio.type = "radio"; radio.name = "choice"; radio.id = ch.id; radio.value = ch.id;
    radio.setAttribute("aria-label", ch.label);
    if (i === 0) radio.checked = true;

    const title = document.createElement("h4");
    title.textContent = ch.label;

    // Historic badge
    if (HISTORIC_CHOICES[nodeId] === ch.id) {
      const badge = document.createElement("span");
      badge.className = "badge historic";
      badge.textContent = "Historic Choice";
      title.appendChild(badge);
    }

    const desc = document.createElement("p"); desc.textContent = ch.desc;

    // Tap the whole card to select
    wrap.addEventListener("click", () => {
      radio.checked = true;
      choiceList.querySelectorAll(".choice").forEach(c => c.classList.remove("selected"));
      wrap.classList.add("selected");
    });

    wrap.appendChild(radio);
    wrap.appendChild(title);
    wrap.appendChild(desc);
    choiceList.appendChild(wrap);
  });

  // Draw troop lines for phase preview
  drawTroopLines(nodeId);

  updateBars();
  focusSceneTitle();
  routeTag.classList.add("hidden");
}

function getCheckedChoiceId() {
  return choiceList.querySelector('input[type="radio"]:checked')?.value || null;
}

function applyChoice(choiceId) {
  const nodeId = currentNodeId();
  const node   = NODES[nodeId];
  const choice = node.choices.find(c => c.id === choiceId);
  if (!choice) return;

  // Apply effects
  choice.effects(state);

  // Clamp
  state.supply     = clamp(state.supply, 0, 100);
  state.morale     = clamp(state.morale, 0, 100);
  state.cohesion   = clamp(state.cohesion, 0, 100);
  state.casualties = Math.max(0, state.casualties);
  state.time       = clamp(state.time, 0, 12);

  // Historic vs alternate banner
  const isHistoric = HISTORIC_CHOICES[nodeId] === choiceId;
  if (isHistoric) {
    state.historicCount++;
    routeTag.textContent = "Historic Route";
    routeTag.classList.remove("alt","hidden"); routeTag.classList.add("historic");
  } else {
    routeTag.textContent = "Alternate Route";
    routeTag.classList.remove("historic","hidden"); routeTag.classList.add("alt");
  }

  // Draw lines reflecting this choice
  drawTroopLines(nodeId, choiceId);

  // Advance
  state.path.push(choiceId);
  const nextId = node.next;
  if (nextId === "END") {
    state.supply = clamp(state.supply, 0, 5); // force low/gone by Decision 7
    showOutcome();
  } else {
    state.step++;
    setCurrentNode(nextId);
    renderNode(nextId);
  }
}

/* ---------- Navigation & sharing ---------- */
let _currentNode = "1";
function currentNodeId() { return _currentNode; }
function setCurrentNode(id) { _currentNode = id; }

function confirmSelection() {
  const choiceId = getCheckedChoiceId();
  if (!choiceId) return;
  applyChoice(choiceId);
}

function resetScenario() {
  Object.assign(state, {
    time: 6, supply: 30, morale: 35, cohesion: 50,
    casualties: 0, step: 1, path: [], phases: [], historicCount: 0
  });
  setCurrentNode("1");
  outcomeBox.classList.add("hidden");
  renderNode("1");
  history.replaceState(null, "", location.pathname);
}

function copyShareLink() {
  const params = new URLSearchParams();
  if (state.path.length) params.set("path", state.path.join(","));
  if (state.phases.length) params.set("ph", state.phases.map(p => p.replace(/\s+/g, "_")).join(","));
  params.set("hc", String(state.historicCount));
  const url = `${location.origin}${location.pathname}?${params.toString()}`;
  if (!navigator.clipboard?.writeText) {
    toast("Clipboard unavailable. You can share the URL in your address bar.");
    return;
  }
  navigator.clipboard.writeText(url)
    .then(() => toast("Share link copied to clipboard."))
    .catch(() => toast("Unable to copy. You can share the URL in your address bar."));
}

function toast(msg) {
  const box = document.createElement("div");
  box.className = "result-message";
  box.style.position = "fixed"; box.style.bottom = "16px"; box.style.left = "16px"; box.style.right = "16px";
  box.style.zIndex = "1000"; box.style.background = "#fff"; box.style.border = "1px solid var(--border-color)";
  box.style.borderRadius = "10px"; box.style.padding = "10px 12px";
  box.textContent = msg;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1800);
}

/* ---------- Touch & keyboard UX ---------- */
function pressHandlerDown(e) {
  const btn = e.target.closest('button.primary-btn, button.secondary-btn, a.text-btn');
  if (btn) btn.classList.add('is-pressed');
}
function pressHandlerUp() { document.querySelectorAll('.is-pressed').forEach(b => b.classList.remove('is-pressed')); }
document.addEventListener('pointerdown', pressHandlerDown);
document.addEventListener('pointerup', pressHandlerUp);
document.addEventListener('pointercancel', pressHandlerUp);
window.addEventListener('blur', pressHandlerUp);

function selectChoiceByOffset(offset) {
  const radios = Array.from(choiceList.querySelectorAll('input[type="radio"]'));
  if (!radios.length) return;
  const currentIdx = radios.findIndex(r => r.checked);
  const idx = currentIdx >= 0 ? currentIdx : 0;
  const nextIdx = Math.max(0, Math.min(radios.length - 1, idx + offset));
  radios[nextIdx].checked = true;
  radios[nextIdx].focus();
  choiceList.querySelectorAll(".choice").forEach(c => c.classList.remove("selected"));
  radios[nextIdx].closest(".choice")?.classList.add("selected");
}
function handleKeydown(e) {
  const active = document.activeElement;
  if (!active || !dilemmaCard.contains(active)) return;
  const key = e.key.toLowerCase();
  const inChoices = choiceList.contains(active);
  if (key === "arrowdown" && inChoices) { e.preventDefault(); selectChoiceByOffset(+1); }
  else if (key === "arrowup" && inChoices) { e.preventDefault(); selectChoiceByOffset(-1); }
  else if ((key === "enter" || key === " ") && inChoices) { e.preventDefault(); confirmSelection(); }
  else if (key === "escape") { choiceList.querySelector('input[type="radio"]')?.focus(); }
}
document.addEventListener("keydown", handleKeydown);

/* ---------- Map loader (JPG) ---------- */
function loadMapImage() {
  const p = new URLSearchParams(location.search);
  const MAP_SRC = p.get("map") ? `./assets/${p.get("map")}` : DEFAULT_MAP_SRC;
  mapBase.addEventListener("error", () => {
    mapBase.hidden = true;
    toast("Map JPG not found. Place your file in ./assets/ and set MAP_SRC or use ?map=filename.jpg");
  }, { once: true });
  mapBase.src = MAP_SRC;
}

/* ---------- Init & deep-link hydration ---------- */
confirmBtn.addEventListener("click", confirmSelection);
resetBtn.addEventListener("click", resetScenario);
shareBtn.addEventListener("click", copyShareLink);

function init() {
  loadMapImage();
  renderNode("1");
  hydrateFromURL();
}
document.addEventListener("DOMContentLoaded", init);

function hydrateFromURL() {
  const p = new URLSearchParams(location.search);
  const path = p.get("path")?.split(",").filter(Boolean) || [];
  if (path.length) {
    resetScenario();
    for (const choiceId of path) {
      const nodeId = currentNodeId();
      const node = NODES[nodeId];
      const choice = node?.choices.find(c => c.id === choiceId);
      if (!choice) break;
      applyChoice(choiceId);
    }
  }
}

/* ---------- Current node helpers ---------- */

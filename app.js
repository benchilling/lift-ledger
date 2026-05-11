const program = window.PROGRAM_DATA;
const storageKey = "lift-ledger-v1";

const $ = (selector) => document.querySelector(selector);
const state = loadState();

const els = {
  week: $("#weekSelect"),
  day: $("#daySelect"),
  block: $("#blockLabel"),
  title: $("#todayTitle"),
  summary: $("#todaySummary"),
  completion: $("#completionValue"),
  nextTarget: $("#nextTarget"),
  volume: $("#volumeMetric"),
  reps: $("#repMetric"),
  list: $("#exerciseList"),
  heading: $("#workoutHeading"),
  trend: $("#exerciseTrendSelect"),
  markDone: $("#markDoneBtn"),
  export: $("#exportBtn"),
  importBtn: $("#importBtn"),
  importFile: $("#importFile"),
  install: $("#installBtn"),
};

let deferredInstallPrompt = null;

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (saved) return JSON.parse(saved);
  return { week: 1, day: 0, logs: {}, doneDays: {}, createdAt: new Date().toISOString() };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function currentWeek() {
  return program.weeks.find((week) => week.week === Number(state.week)) || program.weeks[0];
}

function currentDay() {
  return currentWeek().days[Number(state.day)] || currentWeek().days[0];
}

function entryKey(week, dayIndex, exerciseId) {
  return `w${week}-d${dayIndex}-${exerciseId}`;
}

function getLog(week, dayIndex, exerciseId) {
  return state.logs[entryKey(week, dayIndex, exerciseId)] || { sets: [], note: "" };
}

function setLog(week, dayIndex, exerciseId, log) {
  state.logs[entryKey(week, dayIndex, exerciseId)] = log;
  saveState();
  renderInsights();
  drawCharts();
}

function parseRepRange(reps) {
  const nums = String(reps).match(/\d+/g)?.map(Number) || [];
  if (!nums.length) return { low: 0, high: 0, isRange: false };
  const low = nums[0];
  const high = nums[nums.length - 1];
  return { low, high, isRange: nums.length > 1 && high > low };
}

function setVolume(set) {
  return Number(set.load || 0) * Number(set.reps || 0);
}

function exerciseVolume(log) {
  return (log.sets || []).reduce((sum, set) => sum + setVolume(set), 0);
}

function completedSets(log) {
  return (log.sets || []).filter((set) => Number(set.reps || 0) > 0 || Number(set.load || 0) > 0).length;
}

function loggedSets(log) {
  return (log?.sets || []).filter((set) => Number(set.reps || 0) > 0 || Number(set.load || 0) > 0);
}

function formatSet(set) {
  const load = Number(set?.load || 0);
  const reps = Number(set?.reps || 0);
  const rpe = set?.rpe ? ` @ RPE ${set.rpe}` : "";
  if (!load && !reps) return "-";
  if (!load) return `${reps} reps${rpe}`;
  if (!reps) return `${load} lb${rpe}`;
  return `${load} x ${reps}${rpe}`;
}

function summarizeLog(log) {
  const sets = loggedSets(log);
  if (!sets.length) return "No previous log yet";
  return sets.map((set, index) => `S${index + 1}: ${formatSet(set)}`).join(" | ");
}

function findPreviousExercise(exerciseName, weekNumber) {
  const all = [];
  for (const week of program.weeks) {
    if (week.week >= weekNumber) continue;
    week.days.forEach((day, dayIndex) => {
      day.exercises.forEach((exercise) => {
        if (exercise.exercise === exerciseName) {
          const log = getLog(week.week, dayIndex, exercise.id);
          if (completedSets(log)) all.push({ week: week.week, day: day.name, log });
        }
      });
    });
  }
  return all.at(-1);
}

function targetForExercise(exercise, weekNumber) {
  const previous = findPreviousExercise(exercise.exercise, weekNumber);
  const range = parseRepRange(exercise.reps);
  const base = {
    label: `${exercise.reps} reps`,
    summary: `Start with a load that lets you land in the ${exercise.reps} rep target at the listed RPE.`,
    previousText: "No previous log yet",
    previous,
    placeholders: [],
    addLoad: false,
  };
  if (!previous) return base;

  const sets = loggedSets(previous.log);
  const maxedCurrentSetCount = range.isRange && sets.length >= exercise.workingSets && sets.slice(0, exercise.workingSets).every((set) => Number(set.reps || 0) >= range.high);
  const lastLoad = Number(sets[0]?.load || 0);
  const bestReps = Math.max(0, ...sets.map((set) => Number(set.reps || 0)));

  base.previousText = `Last logged W${previous.week}: ${summarizeLog(previous.log)}`;
  base.placeholders = Array.from({ length: exercise.workingSets }, (_, index) => {
    const prior = sets[index] || sets.at(-1) || {};
    const priorReps = Number(prior.reps || 0);
    const nextReps = range.isRange && priorReps ? Math.min(priorReps + 1, range.high) : range.low || priorReps || "";
    return { load: prior.load || "", reps: nextReps, rpe: "" };
  });

  if (range.isRange && maxedCurrentSetCount && lastLoad > 0) {
    base.addLoad = true;
    base.label = "Add load";
    base.summary = `You reached ${range.high} on all logged working sets. Add a small amount of weight, then aim for ${range.low}+ reps with clean form.`;
    base.placeholders = base.placeholders.map((item) => ({ ...item, reps: range.low }));
    return base;
  }

  if (range.isRange && bestReps > 0) {
    base.label = `Beat ${bestReps}`;
    base.summary = `Keep the same load if form was solid. Add 1 rep to at least one set, working toward ${range.high} on every set before adding weight.`;
    return base;
  }

  base.label = `Hit ${exercise.reps}`;
  base.summary = `Repeat the target reps at the listed RPE. Add load only when the reps are clean and the effort is no harder than prescribed.`;
  return base;
}

function initSelectors() {
  els.week.innerHTML = program.weeks.map((week) => `<option value="${week.week}">Week ${week.week}</option>`).join("");
  els.week.value = state.week;
  renderDayOptions();
  renderTrendOptions();
}

function renderDayOptions() {
  const week = currentWeek();
  els.day.innerHTML = week.days.map((day, index) => `<option value="${index}">${index + 1}. ${day.name}</option>`).join("");
  if (!week.days[state.day]) state.day = 0;
  els.day.value = state.day;
}

function renderTrendOptions() {
  const names = [...new Set(program.weeks.flatMap((week) => week.days.flatMap((day) => day.exercises.map((exercise) => exercise.exercise))))].sort();
  els.trend.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  const firstLogged = Object.values(state.logs).find((log) => completedSets(log));
  els.trend.value = names.includes(firstLogged?.exercise) ? firstLogged.exercise : names[0];
}

function renderWorkout() {
  const week = currentWeek();
  const day = currentDay();
  els.block.textContent = `Week ${week.week}`;
  els.title.textContent = day.name;
  els.heading.textContent = day.rest ? "Recovery" : `${day.name} Plan`;

  if (day.rest) {
    els.summary.textContent = "Rest day. Mobility, easy walk, or full recovery.";
    els.list.innerHTML = `<article class="exercise-card"><div class="exercise-main"><span class="exercise-index">R</span><span><strong class="exercise-name">Rest Day</strong><small class="exercise-prescription">No lifting scheduled.</small></span></div></article>`;
    renderInsights();
    drawCharts();
    return;
  }

  const plannedSets = day.exercises.reduce((sum, exercise) => sum + exercise.workingSets, 0);
  els.summary.textContent = `${day.exercises.length} exercises, ${plannedSets} working sets. Targets update from your previous logged performances.`;
  const template = $("#exerciseTemplate");
  els.list.innerHTML = "";
  day.exercises.forEach((exercise, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const log = getLog(week.week, Number(state.day), exercise.id);
    node.querySelector(".exercise-index").textContent = index + 1;
    node.querySelector(".exercise-name").textContent = exercise.exercise;
    const target = targetForExercise(exercise, week.week);
    node.querySelector(".exercise-prescription").textContent = `${exercise.workingSets} sets x ${exercise.reps} reps`;
    node.querySelector(".target-pill").textContent = target.label;
    node.querySelector(".previous-summary").textContent = target.previousText;
    node.querySelector(".target-summary").textContent = target.summary;
    node.querySelector(".rest").textContent = exercise.rest;
    node.querySelector(".rpe").textContent = [exercise.earlyRpe, exercise.lastRpe].filter(Boolean).join(" / ");
    node.querySelector(".warmups").textContent = exercise.warmupSets || "As needed";
    node.querySelector(".notes").textContent = exercise.notes || [exercise.sub1, exercise.sub2].filter(Boolean).join(" or ");
    node.querySelector(".exercise-main").addEventListener("click", () => node.classList.toggle("open"));
    const sets = node.querySelector(".sets");
    for (let i = 0; i < exercise.workingSets; i += 1) {
      const set = log.sets[i] || {};
      const row = document.createElement("div");
      row.className = "set-row";
      const prior = target.previous?.log?.sets?.[i] || {};
      const placeholder = target.placeholders?.[i] || {};
      row.innerHTML = `
        <strong>Set ${i + 1}</strong>
        <div class="previous-set"><span>Last</span><em>${escapeHtml(formatSet(prior))}</em></div>
        <label><span>Load</span><input inputmode="decimal" type="number" min="0" step="0.5" value="${escapeHtml(set.load ?? "")}" placeholder="${escapeHtml(placeholder.load || "lb")}"></label>
        <label><span>Reps</span><input inputmode="numeric" type="number" min="0" step="1" value="${escapeHtml(set.reps ?? "")}" placeholder="${escapeHtml(placeholder.reps || exercise.reps)}"></label>
        <label><span>RPE</span><input inputmode="decimal" type="number" min="0" max="10" step="0.5" value="${escapeHtml(set.rpe ?? "")}" placeholder="${escapeHtml(i + 1 === exercise.workingSets ? exercise.lastRpe : exercise.earlyRpe)}"></label>
      `;
      const [loadInput, repsInput, rpeInput] = row.querySelectorAll("input");
      const persist = () => {
        const fresh = getLog(week.week, Number(state.day), exercise.id);
        fresh.exercise = exercise.exercise;
        fresh.week = week.week;
        fresh.day = day.name;
        fresh.sets[i] = { load: loadInput.value, reps: repsInput.value, rpe: rpeInput.value };
        setLog(week.week, Number(state.day), exercise.id, fresh);
      };
      loadInput.addEventListener("input", persist);
      repsInput.addEventListener("input", persist);
      rpeInput.addEventListener("input", persist);
      sets.appendChild(row);
    }
    const note = node.querySelector("textarea");
    note.value = log.note || "";
    note.addEventListener("input", () => {
      const fresh = getLog(week.week, Number(state.day), exercise.id);
      fresh.exercise = exercise.exercise;
      fresh.week = week.week;
      fresh.day = day.name;
      fresh.note = note.value;
      setLog(week.week, Number(state.day), exercise.id, fresh);
    });
    if (index === 0) node.classList.add("open");
    els.list.appendChild(node);
  });
  renderInsights();
  drawCharts();
}

function renderInsights() {
  const week = currentWeek();
  const day = currentDay();
  const plannedSets = day.exercises.reduce((sum, exercise) => sum + exercise.workingSets, 0);
  const completed = day.exercises.reduce((sum, exercise) => sum + completedSets(getLog(week.week, Number(state.day), exercise.id)), 0);
  const percent = plannedSets ? Math.round((completed / plannedSets) * 100) : 100;
  els.completion.textContent = `${Math.min(percent, 100)}%`;
  drawCompletion(Math.min(percent, 100));

  const weekLogs = logsForWeek(week.week);
  const volume = weekLogs.reduce((sum, log) => sum + exerciseVolume(log), 0);
  els.volume.textContent = `${Math.round(volume).toLocaleString()} lb`;

  const firstOpen = day.exercises.find((exercise) => completedSets(getLog(week.week, Number(state.day), exercise.id)) < exercise.workingSets);
  els.nextTarget.textContent = firstOpen ? `${firstOpen.exercise}: ${targetForExercise(firstOpen, week.week).label}` : "Day complete";

  const repGain = calculateRepGain(week.week);
  els.reps.textContent = `${repGain >= 0 ? "+" : ""}${repGain} reps`;
}

function logsForWeek(weekNumber) {
  return Object.values(state.logs).filter((log) => Number(log.week) === Number(weekNumber));
}

function calculateRepGain(weekNumber) {
  let gain = 0;
  logsForWeek(weekNumber).forEach((log) => {
    const prev = findPreviousExercise(log.exercise, weekNumber);
    if (!prev) return;
    const nowReps = Math.max(0, ...log.sets.map((set) => Number(set.reps || 0)));
    const prevReps = Math.max(0, ...prev.log.sets.map((set) => Number(set.reps || 0)));
    gain += nowReps - prevReps;
  });
  return gain;
}

function drawCompletion(percent) {
  const canvas = $("#completionChart");
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.lineWidth = 13;
  ctx.strokeStyle = "rgba(255,255,255,.2)";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#8ee4d5";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (percent / 100));
  ctx.stroke();
}

function drawCharts() {
  drawVolumeChart();
  drawExerciseChart();
}

function drawVolumeChart() {
  const points = program.weeks.map((week) => ({
    label: `W${week.week}`,
    value: logsForWeek(week.week).reduce((sum, log) => sum + exerciseVolume(log), 0),
  })).slice(-8);
  drawBars($("#volumeChart"), points, "#0f766e");
}

function drawExerciseChart() {
  const name = els.trend.value;
  const points = [];
  program.weeks.forEach((week) => {
    const matches = logsForWeek(week.week).filter((log) => log.exercise === name);
    if (!matches.length) return;
    const best = Math.max(0, ...matches.flatMap((log) => log.sets.map((set) => Number(set.reps || 0))));
    points.push({ label: `W${week.week}`, value: best });
  });
  drawLine($("#exerciseChart"), points, "#c2410c");
}

function drawBars(canvas, points, color) {
  const ctx = prepareCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  const max = Math.max(1, ...points.map((point) => point.value));
  const barWidth = width / points.length - 14;
  ctx.fillStyle = "#f3f7f4";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  points.forEach((point, index) => {
    const h = (point.value / max) * (height - 42);
    const x = index * (barWidth + 14) + 8;
    ctx.fillRect(x, height - h - 24, barWidth, h);
    ctx.fillStyle = "#64707d";
    ctx.fillText(point.label, x, height - 8);
    ctx.fillStyle = color;
  });
}

function drawLine(canvas, points, color) {
  const ctx = prepareCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  ctx.fillStyle = "#f3f7f4";
  ctx.fillRect(0, 0, width, height);
  if (!points.length) {
    ctx.fillStyle = "#64707d";
    ctx.fillText("Log this exercise to see a trend.", 14, height / 2);
    return;
  }
  const max = Math.max(1, ...points.map((point) => point.value));
  const step = points.length > 1 ? (width - 32) / (points.length - 1) : 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = 16 + index * step;
    const y = height - 30 - (point.value / max) * (height - 52);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = color;
  points.forEach((point, index) => {
    const x = 16 + index * step;
    const y = height - 30 - (point.value / max) * (height - 52);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#64707d";
    ctx.fillText(point.label, x - 8, height - 8);
    ctx.fillStyle = color;
  });
}

function prepareCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.font = "12px system-ui";
  return ctx;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

els.week.addEventListener("change", () => {
  state.week = Number(els.week.value);
  state.day = 0;
  saveState();
  renderDayOptions();
  renderWorkout();
});

els.day.addEventListener("change", () => {
  state.day = Number(els.day.value);
  saveState();
  renderWorkout();
});

els.trend.addEventListener("change", drawExerciseChart);

els.markDone.addEventListener("click", () => {
  state.doneDays[`w${state.week}-d${state.day}`] = new Date().toISOString();
  saveState();
  renderInsights();
});


els.importBtn.addEventListener("click", () => els.importFile.click());

els.importFile.addEventListener("change", async () => {
  const file = els.importFile.files[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  if (!imported.logs || !imported.createdAt) {
    alert("That backup file does not look like Lift Ledger data.");
    return;
  }
  Object.assign(state, imported);
  saveState();
  initSelectors();
  renderWorkout();
  els.importFile.value = "";
});
els.export.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lift-ledger-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.install.hidden = false;
});

els.install.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.install.hidden = true;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

initSelectors();
renderWorkout();



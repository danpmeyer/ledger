/* ============================================================
   STORAGE
   ============================================================ */
const STORAGE_KEY = 'ledger.v1';
const THEME_KEY = 'ledger.theme';

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultData();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultData(), parsed);
  }catch(e){
    console.error('Failed to load data, starting fresh.', e);
    return defaultData();
  }
}

function defaultData(){
  return {
    version: 1,
    entries: {
      exercise: [],
      reading: [],
      writing: [],
      smoking: [],
      onanism: [],
      chastity: []
    },
    goals: {
      smokingDaily: null,
      chastityWeekly: null
    }
  };
}

let DATA = loadData();

function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

/* ============================================================
   THEME
   ============================================================ */
function getTheme(){
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  try{ localStorage.setItem(THEME_KEY, theme); }catch(e){}
  const metaColor = document.getElementById('meta-theme-color');
  if(metaColor) metaColor.setAttribute('content', theme === 'light' ? '#EDEFF2' : '#0F1216');
  updateThemeUI();
}

function toggleTheme(){
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function updateThemeUI(){
  const theme = getTheme();
  const fab = document.getElementById('theme-fab');
  if(fab) fab.textContent = theme === 'dark' ? '☾' : '☀';
  const dOpt = document.getElementById('theme-opt-dark');
  const lOpt = document.getElementById('theme-opt-light');
  if(dOpt) dOpt.classList.toggle('is-active', theme === 'dark');
  if(lOpt) lOpt.classList.toggle('is-active', theme === 'light');
}

document.getElementById('theme-fab').addEventListener('click', toggleTheme);
document.getElementById('theme-opt-dark').addEventListener('click', () => setTheme('dark'));
document.getElementById('theme-opt-light').addEventListener('click', () => setTheme('light'));

/* ============================================================
   HELPERS
   ============================================================ */
function pad(n){ return n < 10 ? '0' + n : '' + n; }

function toISO(dateObj){
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth()+1)}-${pad(dateObj.getDate())}`;
}

function todayStr(){ return toISO(new Date()); }

function nowTimeStr(){
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function fmtDateLabel(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
}

// Monday-start week range containing given date
function weekRange(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(d);
  start.setDate(d.getDate() - dow);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [toISO(start), toISO(end)];
}

function dateInRange(dateStr, startStr, endStr){
  return dateStr >= startStr && dateStr <= endStr;
}

function isoDateList(startStr, endStr){
  const out = [];
  let cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while(cur <= end){
    out.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function earliestDate(){
  let min = null;
  Object.values(DATA.entries).forEach(list => {
    list.forEach(e => {
      if(!min || e.date < min) min = e.date;
    });
  });
  return min || todayStr();
}

function rangeStartFor(rangeVal){
  if(rangeVal === 'all') return earliestDate();
  const days = parseInt(rangeVal, 10);
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return toISO(d);
}

function round(n, dp=1){
  const f = Math.pow(10, dp);
  return Math.round((n + Number.EPSILON) * f) / f;
}

/* ============================================================
   WEEKLY TREND (progressive-goal engine)
   ============================================================ */
function computeWeekTrend(habit, valueFn){
  const today = todayStr();
  const [curStart, curEnd] = weekRange(today);
  const prevAnchor = new Date(curStart + 'T00:00:00');
  prevAnchor.setDate(prevAnchor.getDate() - 7);
  const [prevStart, prevEnd] = weekRange(toISO(prevAnchor));

  const list = DATA.entries[habit];
  const curEntries = list.filter(e => dateInRange(e.date, curStart, curEnd));
  const prevEntries = list.filter(e => dateInRange(e.date, prevStart, prevEnd));

  const curVal = round(curEntries.reduce((s,e) => s + valueFn(e), 0), 2);
  const prevVal = round(prevEntries.reduce((s,e) => s + valueFn(e), 0), 2);
  const curDays = new Set(curEntries.filter(e => valueFn(e) > 0).map(e => e.date)).size;
  const prevDays = new Set(prevEntries.filter(e => valueFn(e) > 0).map(e => e.date)).size;

  return { curVal, prevVal, curDays, prevDays };
}

function trendChip(curVal, prevVal, goodDirection){
  const delta = round(curVal - prevVal, 2);
  let arrow = '→', cls = 'flat';
  if(delta > 0){ arrow = '↑'; cls = goodDirection === 'up' ? 'good' : 'bad'; }
  else if(delta < 0){ arrow = '↓'; cls = goodDirection === 'up' ? 'bad' : 'good'; }
  const sign = delta > 0 ? '+' : '';
  return `<span class="trend-chip trend-${cls}">${arrow} ${sign}${delta}</span>`;
}

function trendRow(label, curVal, prevVal, goodDirection){
  return `
    <div class="trend-row">
      <span class="trend-label">${label}</span>
      <span class="trend-val mono">${curVal}</span>
      ${trendChip(curVal, prevVal, goodDirection)}
    </div>`;
}

function renderTrends(){
  // Exercise — progressive goal: beat last week on each metric + train more often
  const exMetrics = [
    ['Push-ups', e => e.pushups || 0],
    ['Pull-ups', e => e.pullups || 0],
    ['Sit-ups',  e => e.situps || 0],
    ['Squats',   e => e.squats || 0],
    ['Run mi',   e => e.runDist || 0]
  ];
  let exHtml = '';
  exMetrics.forEach(([label, fn]) => {
    const t = computeWeekTrend('exercise', fn);
    if(t.curVal || t.prevVal) exHtml += trendRow(label, t.curVal, t.prevVal, 'up');
  });
  const exFreq = computeWeekTrend('exercise', e => (e.pushups||e.pullups||e.situps||e.squats||e.runDist) ? 1 : 0);
  exHtml += trendRow('Days trained', exFreq.curDays, exFreq.prevDays, 'up');
  document.getElementById('trend-rows-exercise').innerHTML = exHtml ||
    `<div class="trend-row"><span class="trend-label">Log a session to start tracking week-over-week progress.</span></div>`;

  // Reading — improve frequency + volume
  const readVal = computeWeekTrend('reading', e => e.pages || 0);
  const readFreq = computeWeekTrend('reading', e => e.pages > 0 ? 1 : 0);
  document.getElementById('trend-rows-reading').innerHTML =
    trendRow('Pages', readVal.curVal, readVal.prevVal, 'up') +
    trendRow('Days read', readFreq.curDays, readFreq.prevDays, 'up');

  // Writing — improve frequency + volume
  const writeVal = computeWeekTrend('writing', e => e.words || 0);
  const writeFreq = computeWeekTrend('writing', e => e.words > 0 ? 1 : 0);
  document.getElementById('trend-rows-writing').innerHTML =
    trendRow('Words', writeVal.curVal, writeVal.prevVal, 'up') +
    trendRow('Days written', writeFreq.curDays, writeFreq.prevDays, 'up');

  // Smoking — reduce volume + frequency
  const smokeVal = computeWeekTrend('smoking', e => e.amount || 0);
  const smokeFreq = computeWeekTrend('smoking', e => e.amount > 0 ? 1 : 0);
  document.getElementById('trend-rows-smoking').innerHTML =
    trendRow('Cigarettes', smokeVal.curVal, smokeVal.prevVal, 'down') +
    trendRow('Days smoked', smokeFreq.curDays, smokeFreq.prevDays, 'down');

  // Self-control — reduce volume + frequency
  const onVal = computeWeekTrend('onanism', e => e.count || 1);
  const onFreq = computeWeekTrend('onanism', e => (e.count||1) > 0 ? 1 : 0);
  document.getElementById('trend-rows-onanism').innerHTML =
    trendRow('Occurrences', onVal.curVal, onVal.prevVal, 'down') +
    trendRow('Days occurred', onFreq.curDays, onFreq.prevDays, 'down');

  // Anti-chastity — improve frequency + volume
  const chVal = computeWeekTrend('chastity', e => e.count || 1);
  const chFreq = computeWeekTrend('chastity', e => (e.count||1) > 0 ? 1 : 0);
  document.getElementById('trend-rows-chastity').innerHTML =
    trendRow('Occurrences', chVal.curVal, chVal.prevVal, 'up') +
    trendRow('Days active', chFreq.curDays, chFreq.prevDays, 'up');
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('is-active'));
    views.forEach(v => v.classList.remove('is-active'));
    tab.classList.add('is-active');
    document.getElementById('view-' + tab.dataset.view).classList.add('is-active');
    if(tab.dataset.view === 'stats') renderStats();
    if(tab.dataset.view === 'history') renderHistory();
  });
});

/* header date readout */
function updateHeaderDate(){
  const el = document.getElementById('date-readout');
  const d = new Date();
  el.textContent = d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
}

/* ============================================================
   TODAY VIEW
   ============================================================ */
const entryDateInput = document.getElementById('entry-date');
entryDateInput.value = todayStr();
entryDateInput.addEventListener('change', renderToday);

function currentEntryDate(){
  return entryDateInput.value || todayStr();
}

function addEntry(habit, fields){
  const date = currentEntryDate();
  const entry = Object.assign({ id: uid(), date, time: nowTimeStr() }, fields);
  DATA.entries[habit].push(entry);
  saveData();
  renderToday();
}

function deleteEntry(habit, id){
  DATA.entries[habit] = DATA.entries[habit].filter(e => e.id !== id);
  saveData();
  renderToday();
}

/* ---------- Exercise ---------- */
document.getElementById('btn-add-exercise').addEventListener('click', () => {
  const pushups = parseInt(document.getElementById('in-pushups').value) || 0;
  const pullups = parseInt(document.getElementById('in-pullups').value) || 0;
  const situps  = parseInt(document.getElementById('in-situps').value) || 0;
  const squats  = parseInt(document.getElementById('in-squats').value) || 0;
  const runTime = parseFloat(document.getElementById('in-run-time').value) || 0;
  const runDist = parseFloat(document.getElementById('in-run-dist').value) || 0;
  if(!pushups && !pullups && !situps && !squats && !runTime && !runDist) return;
  addEntry('exercise', { pushups, pullups, situps, squats, runTime, runDist });
  ['in-pushups','in-pullups','in-situps','in-squats','in-run-time','in-run-dist'].forEach(id => {
    document.getElementById(id).value = '';
  });
});

/* ---------- Reading ---------- */
document.getElementById('btn-add-reading').addEventListener('click', () => {
  const pages = parseInt(document.getElementById('in-pages').value) || 0;
  if(!pages) return;
  addEntry('reading', { pages });
  document.getElementById('in-pages').value = '';
});

/* ---------- Writing ---------- */
document.getElementById('btn-add-writing').addEventListener('click', () => {
  const words = parseInt(document.getElementById('in-words').value) || 0;
  if(!words) return;
  addEntry('writing', { words });
  document.getElementById('in-words').value = '';
});

/* ---------- Smoking ---------- */
document.getElementById('btn-half-cig').addEventListener('click', () => addEntry('smoking', { amount: 0.5 }));
document.getElementById('btn-full-cig').addEventListener('click', () => addEntry('smoking', { amount: 1 }));

/* ---------- Onanism ---------- */
document.getElementById('btn-add-onanism').addEventListener('click', () => addEntry('onanism', { count: 1 }));
document.getElementById('btn-undo-onanism').addEventListener('click', () => {
  const list = DATA.entries.onanism;
  if(list.length) deleteEntry('onanism', list[list.length - 1].id);
});

/* ---------- Love ---------- */
document.getElementById('btn-add-chastity').addEventListener('click', () => addEntry('chastity', { count: 1 }));
document.getElementById('btn-undo-chastity').addEventListener('click', () => {
  const list = DATA.entries.chastity;
  if(list.length) deleteEntry('chastity', list[list.length - 1].id);
});

/* ---------- inline goal editors ---------- */
function goalKeyFor(habit){
  return habit === 'smoking' ? 'smokingDaily' : 'chastityWeekly';
}

function setupGoalEditor(habit){
  const editBtn = document.querySelector(`.goal-edit-btn[data-goal="${habit}"]`);
  const editorBox = document.getElementById(`goal-editor-${habit}`);
  const input = document.getElementById(`edit-goal-${habit}`);
  const saveBtn = document.getElementById(`save-goal-${habit}`);
  const cancelBtn = document.getElementById(`cancel-goal-${habit}`);

  editBtn.addEventListener('click', () => {
    const current = DATA.goals[goalKeyFor(habit)];
    input.value = current != null ? current : '';
    editorBox.hidden = false;
    input.focus();
  });
  cancelBtn.addEventListener('click', () => { editorBox.hidden = true; });
  saveBtn.addEventListener('click', () => {
    const val = input.value === '' ? null : parseFloat(input.value);
    DATA.goals[goalKeyFor(habit)] = val;
    saveData();
    editorBox.hidden = true;
    renderToday();
  });
}
setupGoalEditor('smoking');
setupGoalEditor('chastity');

/* ---------- render today ---------- */
function renderMiniLog(habit, containerId, formatFn){
  const container = document.getElementById(containerId);
  const date = currentEntryDate();
  const rows = DATA.entries[habit].filter(e => e.date === date).sort((a,b) => a.time < b.time ? 1 : -1);
  if(!rows.length){ container.innerHTML = ''; return; }
  container.innerHTML = rows.map(e => `
    <div class="log-row">
      <span>${e.time} — ${formatFn(e)}</span>
      <button class="log-del" data-habit="${habit}" data-id="${e.id}" title="Delete">✕</button>
    </div>
  `).join('');
  container.querySelectorAll('.log-del').forEach(btn => {
    btn.addEventListener('click', () => deleteEntry(btn.dataset.habit, btn.dataset.id));
  });
}

function renderToday(){
  const date = currentEntryDate();

  // Exercise log
  renderMiniLog('exercise', 'log-exercise', e => {
    const parts = [];
    if(e.pushups) parts.push(`${e.pushups} push-ups`);
    if(e.pullups) parts.push(`${e.pullups} pull-ups`);
    if(e.situps) parts.push(`${e.situps} sit-ups`);
    if(e.squats) parts.push(`${e.squats} squats`);
    if(e.runDist || e.runTime) parts.push(`run ${e.runDist||0}mi / ${e.runTime||0}min`);
    return parts.join(', ') || '—';
  });

  // Reading
  renderMiniLog('reading', 'log-reading', e => `${e.pages} pages`);
  const readingTotal = DATA.entries.reading.filter(e => e.date === date).reduce((s,e) => s + e.pages, 0);
  document.getElementById('reading-today-total').textContent = readingTotal;

  // Writing
  renderMiniLog('writing', 'log-writing', e => `${e.words} words`);
  const writingTotal = DATA.entries.writing.filter(e => e.date === date).reduce((s,e) => s + e.words, 0);
  document.getElementById('writing-today-total').textContent = writingTotal;

  // Smoking
  renderMiniLog('smoking', 'log-smoking', e => `+${e.amount} cigarette${e.amount===1?'':'s'}`);
  const smokingTotal = DATA.entries.smoking.filter(e => e.date === date).reduce((s,e) => s + e.amount, 0);
  document.getElementById('smoking-today-total').textContent = smokingTotal;
  const smokingGoal = DATA.goals.smokingDaily;
  document.getElementById('smoking-goal-display').textContent = smokingGoal != null ? smokingGoal : '—';
  const smokingBar = document.getElementById('smoking-tickbar');
  smokingBar.style.setProperty('--fill', smokingGoal ? Math.min(100, (smokingTotal/smokingGoal)*100) + '%' : '0%');

  // Onanism
  renderMiniLog('onanism', 'log-onanism', e => 'logged');
  const onanismList = DATA.entries.onanism.slice().sort((a,b) => (a.date+a.time) < (b.date+b.time) ? 1 : -1);
  let streakDays = '—';
  if(onanismList.length){
    const last = onanismList[0].date;
    const diffMs = new Date(todayStr()) - new Date(last);
    streakDays = Math.max(0, Math.round(diffMs / 86400000));
  }
  document.getElementById('onanism-streak').textContent = streakDays;
  const [wkStart, wkEnd] = weekRange(date);
  const onanismWeek = DATA.entries.onanism.filter(e => dateInRange(e.date, wkStart, wkEnd)).length;
  document.getElementById('onanism-week-total').textContent = onanismWeek;

  // Love
  renderMiniLog('chastity', 'log-chastity', e => 'logged');
  const chastityWeek = DATA.entries.chastity.filter(e => dateInRange(e.date, wkStart, wkEnd)).length;
  document.getElementById('chastity-week-total').textContent = chastityWeek;
  const chastityGoal = DATA.goals.chastityWeekly;
  document.getElementById('chastity-goal-display').textContent = chastityGoal != null ? chastityGoal : '—';
  const chastityBar = document.getElementById('chastity-tickbar');
  chastityBar.style.setProperty('--fill', chastityGoal ? Math.min(100, (chastityWeek/chastityGoal)*100) + '%' : '0%');

  renderTrends();
}

/* ============================================================
   STATS VIEW
   ============================================================ */
const chartInstances = {};
document.getElementById('stats-range').addEventListener('change', renderStats);

function destroyChart(key){
  if(chartInstances[key]){ chartInstances[key].destroy(); delete chartInstances[key]; }
}

function chartBaseOptions(){
  const gridColor = getTheme() === 'light' ? '#D6D9DF' : '#363C48';
  const tickColor = getTheme() === 'light' ? '#8C9199' : '#666B76';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: tickColor, font: { family: 'Inter', size: 11 } } } },
    scales: {
      x: { ticks: { color: tickColor, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: gridColor } },
      y: { ticks: { color: tickColor, font: { family: 'JetBrains Mono', size: 10 }, precision: 0 }, grid: { color: gridColor }, beginAtZero: true }
    }
  };
}

function renderStats(){
  const rangeVal = document.getElementById('stats-range').value;
  const start = rangeStartFor(rangeVal);
  const end = todayStr();
  const dates = isoDateList(start, end);
  const labels = dates.map(fmtDateLabel);
  const grid = document.getElementById('stats-grid');

  grid.innerHTML = `
    ${statCardShell('exercise', 'Exercise', 'reps + distance')}
    ${statCardShell('reading', 'Reading', 'pages')}
    ${statCardShell('writing', 'Writing', 'words')}
    ${statCardShell('smoking', 'Smoking', 'cigarettes')}
    ${statCardShell('onanism', 'Self-Control', 'occurrences')}
    ${statCardShell('chastity', 'Love', 'occurrences / week')}
  `;

  renderExerciseStats(dates, labels);
  renderReadingStats(dates, labels);
  renderWritingStats(dates, labels);
  renderSmokingStats(dates, labels);
  renderOnanismStats(dates, labels);
  renderChastityStats(start, end);
}

function statCardShell(key, title, eyebrow){
  return `
    <div class="stat-card" data-accent="${key}">
      <div class="card-edge" style="background:var(--${key})"></div>
      <h3>${title}</h3>
      <span class="card-eyebrow mono">${eyebrow.toUpperCase()}</span>
      <div class="stat-summary" id="summary-${key}"></div>
      <div class="chart-wrap"><canvas id="chart-${key}"></canvas></div>
    </div>
  `;
}

function figure(num, label){
  return `<div class="figure"><span class="num">${num}</span><span class="lbl">${label}</span></div>`;
}

function sumByDate(entries, dates, valueFn){
  const map = {};
  entries.forEach(e => { map[e.date] = (map[e.date] || 0) + valueFn(e); });
  return dates.map(d => round(map[d] || 0, 2));
}

function renderExerciseStats(dates, labels){
  const entries = DATA.entries.exercise.filter(e => dates.includes(e.date));
  const pushups = sumByDate(entries, dates, e => e.pushups || 0);
  const pullups = sumByDate(entries, dates, e => e.pullups || 0);
  const situps  = sumByDate(entries, dates, e => e.situps || 0);
  const squats  = sumByDate(entries, dates, e => e.squats || 0);
  const dist    = sumByDate(entries, dates, e => e.runDist || 0);

  const totalPushups = pushups.reduce((a,b)=>a+b,0);
  const totalPullups = pullups.reduce((a,b)=>a+b,0);
  const totalSitups = situps.reduce((a,b)=>a+b,0);
  const totalSquats = squats.reduce((a,b)=>a+b,0);
  const totalDist = round(dist.reduce((a,b)=>a+b,0),1);

  document.getElementById('summary-exercise').innerHTML =
    figure(totalPushups, 'push-ups') + figure(totalPullups, 'pull-ups') +
    figure(totalSitups, 'sit-ups') + figure(totalSquats, 'squats') +
    figure(totalDist, 'miles run');

  destroyChart('exercise');
  const ctx = document.getElementById('chart-exercise');
  chartInstances.exercise = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Push-ups', data: pushups, borderColor: '#4FA8A0', backgroundColor: '#4FA8A0', tension: 0.3, pointRadius: 0 },
        { label: 'Pull-ups', data: pullups, borderColor: '#7FC8C2', backgroundColor: '#7FC8C2', tension: 0.3, pointRadius: 0 },
        { label: 'Sit-ups', data: situps, borderColor: '#2E756F', backgroundColor: '#2E756F', tension: 0.3, pointRadius: 0 },
        { label: 'Squats', data: squats, borderColor: '#A6D8D3', backgroundColor: '#A6D8D3', tension: 0.3, pointRadius: 0 }
      ]
    },
    options: chartBaseOptions()
  });
}

function renderReadingStats(dates, labels){
  const entries = DATA.entries.reading.filter(e => dates.includes(e.date));
  const pages = sumByDate(entries, dates, e => e.pages || 0);
  const total = pages.reduce((a,b)=>a+b,0);
  const avg = round(total / dates.length, 1);
  const best = Math.max(0, ...pages);

  document.getElementById('summary-reading').innerHTML =
    figure(total, 'total pages') + figure(avg, 'avg / day') + figure(best, 'best day');

  destroyChart('reading');
  chartInstances.reading = new Chart(document.getElementById('chart-reading'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Pages', data: pages, backgroundColor: '#D1A83F' }] },
    options: Object.assign(chartBaseOptions(), { plugins: { legend: { display: false } } })
  });
}

function renderWritingStats(dates, labels){
  const entries = DATA.entries.writing.filter(e => dates.includes(e.date));
  const words = sumByDate(entries, dates, e => e.words || 0);
  const total = words.reduce((a,b)=>a+b,0);
  const avg = round(total / dates.length, 1);
  const best = Math.max(0, ...words);

  document.getElementById('summary-writing').innerHTML =
    figure(total, 'total words') + figure(avg, 'avg / day') + figure(best, 'best day');

  destroyChart('writing');
  chartInstances.writing = new Chart(document.getElementById('chart-writing'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Words', data: words, backgroundColor: '#A08CD8' }] },
    options: Object.assign(chartBaseOptions(), { plugins: { legend: { display: false } } })
  });
}

function renderSmokingStats(dates, labels){
  const entries = DATA.entries.smoking.filter(e => dates.includes(e.date));
  const amounts = sumByDate(entries, dates, e => e.amount || 0);
  const total = round(amounts.reduce((a,b)=>a+b,0),1);
  const avg = round(total / dates.length, 2);
  const goal = DATA.goals.smokingDaily;
  const daysUnderGoal = goal != null ? amounts.filter(a => a <= goal).length : null;

  document.getElementById('summary-smoking').innerHTML =
    figure(total, 'total cigarettes') + figure(avg, 'avg / day') +
    (goal != null ? figure(daysUnderGoal + '/' + dates.length, 'days ≤ goal') : '');

  destroyChart('smoking');
  chartInstances.smoking = new Chart(document.getElementById('chart-smoking'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Cigarettes', data: amounts, backgroundColor: '#C0553C' }] },
    options: Object.assign(chartBaseOptions(), { plugins: { legend: { display: false } } })
  });
}

function renderOnanismStats(dates, labels){
  const entries = DATA.entries.onanism.filter(e => dates.includes(e.date));
  const counts = sumByDate(entries, dates, e => e.count || 1);
  const total = counts.reduce((a,b)=>a+b,0);

  let longestGap = 0, currentGap = 0;
  counts.forEach(c => {
    if(c === 0){ currentGap++; longestGap = Math.max(longestGap, currentGap); }
    else { currentGap = 0; }
  });

  document.getElementById('summary-onanism').innerHTML =
    figure(total, 'total occurrences') + figure(longestGap, 'longest streak (days)');

  destroyChart('onanism');
  chartInstances.onanism = new Chart(document.getElementById('chart-onanism'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Occurrences', data: counts, backgroundColor: '#6E82D9' }] },
    options: Object.assign(chartBaseOptions(), { plugins: { legend: { display: false } } })
  });
}

function renderChastityStats(start, end){
  const weeks = [];
  let cur = weekRange(start)[0];
  const lastWeekEnd = weekRange(end)[1];
  while(cur <= lastWeekEnd){
    const [wStart, wEnd] = weekRange(cur);
    weeks.push([wStart, wEnd]);
    const next = new Date(wStart + 'T00:00:00');
    next.setDate(next.getDate() + 7);
    cur = toISO(next);
  }
  const labels = weeks.map(([s]) => fmtDateLabel(s));
  const counts = weeks.map(([s,e]) => DATA.entries.chastity.filter(x => dateInRange(x.date, s, e)).length);
  const goal = DATA.goals.chastityWeekly;
  const total = counts.reduce((a,b)=>a+b,0);
  const avg = round(total / (weeks.length || 1), 2);
  const weeksMetGoal = goal != null ? counts.filter(c => c >= goal).length : null;

  document.getElementById('summary-chastity').innerHTML =
    figure(total, 'total occurrences') + figure(avg, 'avg / week') +
    (goal != null ? figure(weeksMetGoal + '/' + weeks.length, 'weeks met goal') : '');

  destroyChart('chastity');
  chartInstances.chastity = new Chart(document.getElementById('chart-chastity'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Per week', data: counts, backgroundColor: '#C15C8E' }] },
    options: Object.assign(chartBaseOptions(), { plugins: { legend: { display: false } } })
  });
}

/* ============================================================
   HISTORY VIEW
   ============================================================ */
document.getElementById('history-filter').addEventListener('change', renderHistory);

const HABIT_META = {
  exercise: { label: 'Exercise', color: '#4FA8A0' },
  reading:  { label: 'Reading',  color: '#D1A83F' },
  writing:  { label: 'Writing',  color: '#A08CD8' },
  smoking:  { label: 'Smoking',  color: '#C0553C' },
  onanism:  { label: 'Self-Control', color: '#6E82D9' },
  chastity: { label: 'Love', color: '#C15C8E' }
};

function detailFor(habit, e){
  switch(habit){
    case 'exercise': {
      const parts = [];
      if(e.pushups) parts.push(`${e.pushups} push-ups`);
      if(e.pullups) parts.push(`${e.pullups} pull-ups`);
      if(e.situps) parts.push(`${e.situps} sit-ups`);
      if(e.squats) parts.push(`${e.squats} squats`);
      if(e.runDist || e.runTime) parts.push(`run ${e.runDist||0}mi/${e.runTime||0}min`);
      return parts.join(', ') || '—';
    }
    case 'reading': return `${e.pages} pages`;
    case 'writing': return `${e.words} words`;
    case 'smoking': return `+${e.amount} cigarette${e.amount===1?'':'s'}`;
    case 'onanism': return 'logged';
    case 'chastity': return 'logged';
    default: return '';
  }
}

function renderHistory(){
  const filter = document.getElementById('history-filter').value;
  const tbody = document.getElementById('history-tbody');
  let rows = [];
  Object.keys(DATA.entries).forEach(habit => {
    if(filter !== 'all' && filter !== habit) return;
    DATA.entries[habit].forEach(e => rows.push({ habit, e }));
  });
  rows.sort((a,b) => {
    const ka = a.e.date + a.e.time, kb = b.e.date + b.e.time;
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });

  if(!rows.length){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No entries yet. Log something from the Today tab.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(({habit, e}) => `
    <tr>
      <td class="mono">${e.date}</td>
      <td class="mono">${e.time}</td>
      <td><span class="habit-tag" style="background:${HABIT_META[habit].color}">${HABIT_META[habit].label}</span></td>
      <td>${detailFor(habit, e)}</td>
      <td><button class="row-del" data-habit="${habit}" data-id="${e.id}" title="Delete">✕</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.row-del').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteEntry(btn.dataset.habit, btn.dataset.id);
      renderHistory();
    });
  });
}

/* ============================================================
   SETTINGS VIEW
   ============================================================ */
function downloadFile(filename, content, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('btn-export-json').addEventListener('click', () => {
  const stamp = todayStr();
  downloadFile(`ledger-backup-${stamp}.json`, JSON.stringify(DATA, null, 2), 'application/json');
});

document.getElementById('btn-export-csv').addEventListener('click', () => {
  const lines = [['habit','date','time','detail']];
  Object.keys(DATA.entries).forEach(habit => {
    DATA.entries[habit].forEach(e => {
      lines.push([habit, e.date, e.time, detailFor(habit, e).replace(/,/g, ';')]);
    });
  });
  const csv = lines.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile(`ledger-export-${todayStr()}.csv`, csv, 'text/csv');
});

document.getElementById('btn-import-json').addEventListener('click', () => {
  const fileInput = document.getElementById('import-file');
  const status = document.getElementById('import-status');
  const file = fileInput.files[0];
  if(!file){
    status.textContent = 'Choose a JSON file first.';
    status.className = 'status-line err';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed.entries || !parsed.goals){
        throw new Error('File is missing expected fields.');
      }
      const confirmed = confirm('This will replace all current data in this browser with the contents of the file. Continue?');
      if(!confirmed) return;
      DATA = Object.assign(defaultData(), parsed);
      saveData();
      renderToday();
      status.textContent = 'Import successful.';
      status.className = 'status-line ok';
    }catch(err){
      status.textContent = 'Could not read that file: ' + err.message;
      status.className = 'status-line err';
    }
  };
  reader.readAsText(file);
});

document.getElementById('btn-reset-all').addEventListener('click', () => {
  const confirmed = confirm('This erases every entry and goal in this browser. Export a backup first if you want one. Continue?');
  if(!confirmed) return;
  DATA = defaultData();
  saveData();
  renderToday();
});

/* ============================================================
   INIT
   ============================================================ */
updateHeaderDate();
updateThemeUI();
renderToday();

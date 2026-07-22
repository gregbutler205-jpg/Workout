const EXERCISES = [
  {name:"Leg Press", group:"Lower Body"},
  {name:"Leg Extension (Both)", group:"Lower Body"},
  {name:"Leg Extension (Left)", group:"Lower Body", side:"Left"},
  {name:"Leg Extension (Right)", group:"Lower Body", side:"Right"},
  {name:"Seated Leg Curl", group:"Lower Body"},
  {name:"Hip Adduction", group:"Lower Body"},
  {name:"Hip Abduction", group:"Lower Body"},
  {name:"Rotary Calf Press", group:"Lower Body"},
  {name:"Chest Press", group:"Upper Body"},
  {name:"Pec Fly", group:"Upper Body"},
  {name:"Rear Delt", group:"Upper Body"},
  {name:"Lateral Raise", group:"Upper Body"},
  {name:"Tricep Pushdown", group:"Upper Body"},
  {name:"Arm Curl", group:"Upper Body"},
  {name:"Back Extension", group:"Core / Trunk"},
  {name:"Abdominal", group:"Core / Trunk"},
];

const defaultState = {
  version:1,
  settings:Object.fromEntries(EXERCISES.map(e=>[e.name,{weight:"",seat:"",backPad:"",leg:"",start:"",other:""}])),
  weekly:{},
  workouts:[],
  activeWorkout:null,
};
let state = loadState();
let currentScreen = "dashboard";
let timerId=null, timerRemaining=20, timerPaused=false;
const $ = s=>document.querySelector(s);
const screen = $("#screen");

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem("strengthTrackerState"));
    return saved ? {...defaultState,...saved,settings:{...defaultState.settings,...saved.settings}} : structuredClone(defaultState);
  }catch{return structuredClone(defaultState)}
}
function saveState(){localStorage.setItem("strengthTrackerState",JSON.stringify(state))}
function isoDate(d=new Date()){return d.toISOString().slice(0,10)}
function weekStart(date=new Date()){
  const d=new Date(date); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d;
}
function fmtDate(d){return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(d)}
function fmtTime(ts){return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(new Date(ts))}
function durationText(ms){
  const s=Math.max(0,Math.floor(ms/1000)), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return h?`${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`:`${m}:${String(sec).padStart(2,"0")}`;
}
function toast(msg){const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.append(t);setTimeout(()=>t.remove(),1800)}
function playTimerAlert(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    const ctx=new AudioCtx(); const now=ctx.currentTime;
    [0,.22,.44].forEach(offset=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type="sine";osc.frequency.value=880;gain.gain.setValueAtTime(.0001,now+offset);gain.gain.exponentialRampToValueAtTime(.22,now+offset+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+.16);osc.connect(gain);gain.connect(ctx.destination);osc.start(now+offset);osc.stop(now+offset+.18)});
    setTimeout(()=>ctx.close(),1200);
  }catch{}
  navigator.vibrate?.([250,120,250,120,350]);
}
function setHeader(title,subtitle="",back=false){$("#screenTitle").textContent=title;$("#screenSubtitle").textContent=subtitle;$("#backBtn").classList.toggle("hidden",!back)}
function navigate(name){currentScreen=name;document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.screen===name));render()}

function ensureWeek(){
  const start=isoDate(weekStart()); if(!state.weekly[start]) state.weekly[start]={strength:[],cardio:[],rest:[]}; return [start,state.weekly[start]]
}
function render(){
  stopTimer();
  if(currentScreen==="dashboard") renderDashboard();
  else if(currentScreen==="history") renderHistory();
  else if(currentScreen==="exercises") renderExercises();
  else if(currentScreen==="progress") renderProgress();
  else if(currentScreen==="more") renderMore();
  else if(currentScreen==="strength") renderStrengthList();
  else if(currentScreen==="exercise") renderExerciseEntry();
  else if(currentScreen==="summary") renderSummary();
}
function renderDashboard(){
  setHeader("This Week",`${fmtDate(weekStart())} – ${fmtDate(new Date(weekStart().getTime()+6*864e5))}`);
  const [wk, data]=ensureWeek(); const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const dayDates=days.map((_,i)=>isoDate(new Date(weekStart().getTime()+i*864e5)));
  const card=(type,label,target,emoji)=>`
    <div class="card">
      <div class="row"><h3>${emoji} ${label} (${data[type].length} of ${target})</h3><span class="pill">${target} target</span></div>
      <div class="small muted">Check off each day completed</div>
      <div class="week-grid" style="margin-top:12px">
        ${days.map((d,i)=>`<div><div class="day-label">${d}</div><button class="day-check ${data[type].includes(dayDates[i])?`checked ${type}`:""}" data-check="${type}" data-date="${dayDates[i]}">${data[type].includes(dayDates[i])?"✓":""}</button></div>`).join("")}
      </div>
    </div>`;
  const weekWorkouts=state.workouts.filter(w=>w.date>=wk);
  const totalMs=weekWorkouts.reduce((s,w)=>s+(w.durationMs||0),0);
  const calories=weekWorkouts.reduce((s,w)=>s+(Number(w.apple?.activeCalories)||0),0);
  screen.innerHTML=card("strength","Strength Workouts",3,"🏋️")+card("cardio","Cardio Workouts",2,"💙")+card("rest","Rest Days",2,"🛏️")+`
    <div class="metric-grid">
      <div class="metric"><div class="muted small">Total Workout Time</div><div class="value">${Math.round(totalMs/60000)} min</div></div>
      <div class="metric"><div class="muted small">Active Calories</div><div class="value">${calories.toLocaleString()}</div></div>
    </div>
    <div class="card stack">
      <button class="btn green" id="startStrength">🏋️ Start Strength Workout</button>
      <button class="btn blue" id="addCardio">💙 Add Cardio Workout</button>
      <button class="btn purple" id="recordRest">🛏️ Record Rest Day</button>
    </div>`;
  document.querySelectorAll("[data-check]").forEach(btn=>btn.onclick=()=>toggleDay(btn.dataset.check,btn.dataset.date));
  $("#startStrength").onclick=startStrength;
  $("#addCardio").onclick=()=>openCardioModal();
  $("#recordRest").onclick=()=>toggleDay("rest",isoDate());
}
function toggleDay(type,date){
  const [,d]=ensureWeek();
  const otherTypes=["strength","cardio","rest"].filter(t=>t!==type);
  otherTypes.forEach(t=>d[t]=d[t].filter(x=>x!==date));
  d[type]=d[type].includes(date)?d[type].filter(x=>x!==date):[...d[type],date];
  saveState();renderDashboard();
}
function startStrength(){
  if(state.activeWorkout && confirm("Resume the unfinished strength workout?")){currentScreen="strength";render();return}
  state.activeWorkout={id:crypto.randomUUID(),type:"strength",date:isoDate(),startTs:Date.now(),currentIndex:0,exercises:EXERCISES.map(e=>({name:e.name,status:"not-started",weight:state.settings[e.name].weight,reps:["","",""],effort:"Good",pain:"None",notes:"",recommendation:""}))};
  saveState(); currentScreen="strength"; render();
}
function renderStrengthList(){
  const w=state.activeWorkout;if(!w){navigate("dashboard");return}
  const done=w.exercises.filter(e=>e.status==="done").length;
  setHeader("Strength Workout",`${fmtDate(new Date(w.startTs))} • ${fmtTime(w.startTs)}`,true);
  const groups=[...new Set(EXERCISES.map(e=>e.group))];
  screen.innerHTML=`
    <div class="card">
      <div class="metric-grid">
        <div class="metric"><div class="small muted">Completed</div><div class="value">${done}/16</div></div>
        <div class="metric"><div class="small muted">Elapsed</div><div class="value" id="elapsed">${durationText(Date.now()-w.startTs)}</div></div>
      </div>
    </div>
    ${groups.map(g=>`<div class="section-title">${g}</div><div class="card" style="padding:0">${w.exercises.map((e,i)=>EXERCISES[i].group===g?`
      <div class="exercise-item ${i===w.currentIndex?"current":""}" data-ex-index="${i}">
        <div>${i+1}</div><div><strong>${e.name}</strong><div class="small muted">${e.weight?`${e.weight} lb • `:""}3 sets</div></div>
        <div class="status-dot ${e.status==="done"?"done":e.status==="skipped"?"skipped":i===w.currentIndex?"current":""}">${e.status==="done"?"✓":e.status==="skipped"?"–":i===w.currentIndex?"▶":""}</div>
      </div>`:"").join("")}</div>`).join("")}
    <div class="btn-row"><button class="btn outline" id="jumpBtn">Jump to Exercise</button><button class="btn red" id="endWorkout">End Workout</button></div>`;
  document.querySelectorAll("[data-ex-index]").forEach(el=>el.onclick=()=>openExercise(Number(el.dataset.exIndex)));
  $("#jumpBtn").onclick=()=>openJumpModal();
  $("#endWorkout").onclick=()=>finishWorkout(true);
  const id=setInterval(()=>{const e=$("#elapsed");if(e)e.textContent=durationText(Date.now()-w.startTs);else clearInterval(id)},1000);
}
function openExercise(i){state.activeWorkout.currentIndex=i;saveState();currentScreen="exercise";render()}
function renderExerciseEntry(){
  const w=state.activeWorkout, i=w.currentIndex, ex=w.exercises[i], settings=state.settings[ex.name];
  setHeader(ex.name,`${i+1} of 16`,true);
  screen.innerHTML=`
    <div class="card">
      <div class="row"><div><div class="small muted">Current Weight / Plate</div><div class="big-number"><input id="weight" type="number" inputmode="decimal" value="${ex.weight}" style="width:130px;font-size:30px;text-align:center"> lb</div></div>
      <button class="btn outline" id="settingsBtn" style="width:auto">Machine Settings</button></div>
      <div class="small muted" style="margin-top:8px">${settings.seat?`Seat ${settings.seat} • `:""}${settings.backPad?`Back ${settings.backPad} • `:""}${settings.leg?`Leg ${settings.leg} • `:""}${settings.start?`Start ${settings.start}`:""}</div>
    </div>
    <div class="card">
      <div class="set-grid header"><div>Set</div><div>Reps</div><div>20-sec rest</div></div>
      ${[0,1,2].map(s=>`<div class="set-grid" style="margin-top:10px"><div><strong>${s+1}</strong></div><input class="rep-input" data-set="${s}" type="number" inputmode="numeric" min="0" value="${ex.reps[s]}"><button class="btn ${s<2?"blue":"gray"} save-set" data-set="${s}" style="padding:11px">${ex.reps[s]?"Update":"Save"}</button></div>`).join("")}
      <div id="timerArea"></div>
    </div>
    <div class="card stack">
      <label>Notes (optional)<textarea id="notes" rows="2" placeholder="How did it feel?">${ex.notes||""}</textarea></label>
      <div><div class="small" style="font-weight:700;margin-bottom:7px">How did that feel?</div><div class="segmented" id="effortSeg">${["Easy","Good","Hard","Very Hard"].map(x=>`<button data-val="${x}" class="${ex.effort===x?"selected":""}">${x}</button>`).join("")}</div></div>
      <div><div class="small" style="font-weight:700;margin-bottom:7px">Pain / discomfort</div><div class="segmented" id="painSeg">${["None","Mild","Moderate","Severe"].map(x=>`<button data-val="${x}" class="${ex.pain===x?"selected":""}">${x}</button>`).join("")}</div></div>
    </div>
    <div class="btn-row"><button class="btn outline" id="skipExercise">Skip Exercise</button><button class="btn green" id="completeExercise">Complete Exercise</button></div>`;
  $("#weight").onchange=e=>{ex.weight=e.target.value;saveState()};
  $("#notes").onchange=e=>{ex.notes=e.target.value;saveState()};
  $("#settingsBtn").onclick=()=>openSettingsModal(ex.name);
  document.querySelectorAll(".save-set").forEach(b=>b.onclick=()=>saveSet(Number(b.dataset.set)));
  document.querySelectorAll("#effortSeg button").forEach(b=>b.onclick=()=>selectSeg("effort",b.dataset.val));
  document.querySelectorAll("#painSeg button").forEach(b=>b.onclick=()=>selectSeg("pain",b.dataset.val));
  $("#skipExercise").onclick=()=>{ex.status="skipped";advanceExercise()};
  $("#completeExercise").onclick=completeExercise;
}
function selectSeg(field,val){state.activeWorkout.exercises[state.activeWorkout.currentIndex][field]=val;saveState();renderExerciseEntry()}
function saveSet(s){
  const ex=state.activeWorkout.exercises[state.activeWorkout.currentIndex];
  ex.reps[s]=document.querySelector(`[data-set="${s}"].rep-input`).value;
  ex.weight=$("#weight").value; ex.notes=$("#notes").value; saveState();
  if(s<2){startTimer()}else{toast("Set 3 saved")}
}
function startTimer(){
  stopTimer(); timerRemaining=20; timerPaused=false;
  renderTimer(); timerId=setInterval(()=>{if(!timerPaused){timerRemaining--;renderTimer();if(timerRemaining<=0){stopTimer();playTimerAlert();toast("Rest complete")}}},1000);
}
function renderTimer(){
  const a=$("#timerArea"); if(!a)return;
  a.innerHTML=`<div class="timer">${String(Math.floor(timerRemaining/60)).padStart(2,"0")}:${String(timerRemaining%60).padStart(2,"0")}</div>
  <div class="timer-controls"><button id="pauseT">${timerPaused?"Resume":"Pause"}</button><button id="restartT">Restart</button><button id="addT">+20 sec</button><button id="skipT">Skip</button></div>`;
  $("#pauseT").onclick=()=>{timerPaused=!timerPaused;renderTimer()};
  $("#restartT").onclick=()=>{timerRemaining=20;timerPaused=false;renderTimer()};
  $("#addT").onclick=()=>{timerRemaining+=20;renderTimer()};
  $("#skipT").onclick=()=>{stopTimer();a.innerHTML=""};
}
function stopTimer(){if(timerId)clearInterval(timerId);timerId=null}
function recommendation(ex){
  const reps=ex.reps.map(Number);
  if(ex.pain!=="None" || ex.status==="skipped" || reps.some(r=>!r)) return "Review";
  if(reps.some(r=>r<5)) return "Decrease";
  if(reps.some(r=>r>=20) || reps.every(r=>r>=15)) return "Increase";
  return "Stay";
}
function completeExercise(){
  const ex=state.activeWorkout.exercises[state.activeWorkout.currentIndex];
  ex.weight=$("#weight").value; ex.notes=$("#notes").value;
  if(ex.reps.some(r=>r==="")){toast("Enter all three sets or skip the exercise");return}
  ex.status="done";ex.recommendation=recommendation(ex);saveState();
  openResultModal(ex);
}
function openResultModal(ex){
  const cls=ex.recommendation.toLowerCase();
  const suggested=ex.recommendation==="Increase"?nextWeight(ex.weight,1):ex.recommendation==="Decrease"?nextWeight(ex.weight,-1):ex.weight;
  openModal("Exercise Result",`<div class="recommendation ${cls}">
    <div class="small">RECOMMENDATION</div><div class="big-number">${ex.recommendation.toUpperCase()}</div>
    <div>${ex.recommendation==="Increase"?"You met the increase rule. Review and choose the weight for your next workout.":ex.recommendation==="Decrease"?"A set was below 5 reps. Review and choose a lower weight for your next workout.":ex.recommendation==="Review"?"Pain, skipped work, or incomplete data means no automatic increase.":"The progression rule suggests keeping the same weight."}</div>
  </div><div class="card" style="margin-top:14px"><label>Weight for next workout<div class="weight-stepper"><button type="button" id="minusWeight">−</button><input id="nextWeightInput" type="number" inputmode="decimal" value="${suggested||""}"><button type="button" id="plusWeight">+</button></div></label><div class="small muted" style="margin-top:8px">You can lower or raise this before accepting.</div></div><div class="stack"><button class="btn green" id="acceptRec">Accept Weight & Next Exercise</button><button class="btn outline" id="keepWeight">Keep Current Weight</button></div>`);
  $("#minusWeight").onclick=()=>{$("#nextWeightInput").value=Math.max(0,(Number($("#nextWeightInput").value)||0)-5)};
  $("#plusWeight").onclick=()=>{$("#nextWeightInput").value=(Number($("#nextWeightInput").value)||0)+5};
  $("#acceptRec").onclick=()=>{state.settings[ex.name].weight=$("#nextWeightInput").value;ex.acceptedNextWeight=$("#nextWeightInput").value;saveState();$("#modal").close();advanceExercise()};
  $("#keepWeight").onclick=()=>{state.settings[ex.name].weight=ex.weight;ex.acceptedNextWeight=ex.weight;saveState();$("#modal").close();advanceExercise()};
}
function nextWeight(w,dir){const n=Number(w);return Number.isFinite(n)&&n?String(Math.max(0,n+dir*5)):w}
function advanceExercise(){
  const w=state.activeWorkout;let next=w.exercises.findIndex((e,i)=>i>w.currentIndex&&e.status==="not-started");
  if(next<0)next=w.exercises.findIndex(e=>e.status==="not-started");
  if(next<0){finishWorkout(false);return}
  w.currentIndex=next;saveState();currentScreen="exercise";render();
}
function finishWorkout(confirmEnd){
  const w=state.activeWorkout;if(!w)return;
  if(confirmEnd && !confirm("End this workout and save what you completed?"))return;
  w.endTs=Date.now();w.durationMs=w.endTs-w.startTs;w.completed=w.exercises.filter(e=>e.status==="done").length;
  state.workouts.push(w);
  const [,week]=ensureWeek();if(!week.strength.includes(w.date))week.strength.push(w.date);
  state.lastWorkout=w;state.activeWorkout=null;saveState();currentScreen="summary";render();
}
function renderSummary(){
  const w=state.lastWorkout;if(!w){navigate("dashboard");return}
  setHeader("Workout Summary",`${fmtDate(new Date(w.startTs))}`,true);
  const counts={Increase:0,Stay:0,Decrease:0,Review:0};w.exercises.forEach(e=>{if(counts[e.recommendation]!==undefined)counts[e.recommendation]++});
  const reps=w.exercises.reduce((s,e)=>s+e.reps.reduce((a,r)=>a+(Number(r)||0),0),0);
  screen.innerHTML=`<div class="card" style="text-align:center"><div style="font-size:58px">✅</div><h2>Workout Complete!</h2><div class="muted">${fmtTime(w.startTs)} – ${fmtTime(w.endTs)}</div></div>
  <div class="metric-grid">
    <div class="metric"><div class="small muted">Total Time</div><div class="value">${durationText(w.durationMs)}</div></div>
    <div class="metric"><div class="small muted">Exercises</div><div class="value">${w.completed}/16</div></div>
    <div class="metric"><div class="small muted">Total Sets</div><div class="value">${w.exercises.filter(e=>e.status==="done").length*3}</div></div>
    <div class="metric"><div class="small muted">Total Reps</div><div class="value">${reps}</div></div>
  </div>
  <div class="card stack"><h3>Weight Recommendations</h3>${Object.entries(counts).map(([k,v])=>`<div class="row"><span>${k}</span><strong>${v}</strong></div>`).join("")}</div>
  <button class="btn blue" id="appleEntry">Enter Apple Watch Data</button>`;
  $("#appleEntry").onclick=()=>openAppleModal(w);
}
function openAppleModal(w,fromHistory=false){
  openModal("Apple Watch Data",`<div class="stack">
    <label>Workout type<select id="awType"><option ${w.apple?.type==="Traditional Strength Training"?"selected":""}>Traditional Strength Training</option><option ${w.apple?.type==="Indoor Cycle"?"selected":""}>Indoor Cycle</option><option ${w.apple?.type==="Outdoor Walk"?"selected":""}>Outdoor Walk</option><option ${w.apple?.type==="Indoor Walk"?"selected":""}>Indoor Walk</option><option ${w.apple?.type==="Elliptical"?"selected":""}>Elliptical</option></select></label>
    <div class="form-grid"><label>Start time<input id="awStart" type="time" value="${new Date(w.startTs).toTimeString().slice(0,5)}"></label><label>End time<input id="awEnd" type="time" value="${new Date(w.endTs).toTimeString().slice(0,5)}"></label></div>
    <div class="form-grid"><label>Active calories<input id="awActive" type="number" value="${w.apple?.activeCalories||""}"></label><label>Total calories<input id="awTotal" type="number" value="${w.apple?.totalCalories||""}"></label></div>
    <div class="form-grid"><label>Average HR<input id="awAvg" type="number" value="${w.apple?.avgHR||""}"></label><label>Heart-rate range<input id="awRange" placeholder="96–156" value="${w.apple?.range||""}"></label></div>
    <label>Apple Watch effort (1–10)<input id="awEffort" type="number" min="1" max="10" value="${w.apple?.effort||""}"></label>
    <button class="btn blue" id="saveApple">Save Apple Watch Data</button></div>`);
  $("#saveApple").onclick=()=>{w.apple={type:$("#awType").value,start:$("#awStart").value,end:$("#awEnd").value,activeCalories:$("#awActive").value,totalCalories:$("#awTotal").value,avgHR:$("#awAvg").value,range:$("#awRange").value,effort:$("#awEffort").value};saveState();$("#modal").close();toast("Apple Watch data saved");navigate(fromHistory?"history":"dashboard")};
}
function openEditWorkout(i){
  const w=state.workouts[i];
  if(w.type==="cardio"){
    openModal("Edit Cardio Workout",`<div class="stack"><label>Date<input id="eDate" type="date" value="${w.date}"></label><label>Activity<select id="eType">${["Recumbent Bike","Walk","Elliptical","Combination"].map(x=>`<option ${w.activity===x?"selected":""}>${x}</option>`).join("")}</select></label><div class="form-grid"><label>Duration (minutes)<input id="eDur" type="number" value="${Math.round((w.durationMs||0)/60000)}"></label><label>Distance<input id="eDist" type="number" step=".01" value="${w.distance||""}"></label></div><div class="form-grid"><label>Resistance / level<input id="eLevel" value="${w.level||""}"></label><label>Pace / speed<input id="ePace" value="${w.pace||""}"></label></div><label>Notes<textarea id="eNotes">${w.notes||""}</textarea></label><button class="btn blue" id="saveEdit">Save Changes</button><button class="btn red" id="deleteEdit">Delete Workout</button></div>`);
    $("#saveEdit").onclick=()=>{Object.assign(w,{date:$("#eDate").value,activity:$("#eType").value,durationMs:(Number($("#eDur").value)||0)*60000,distance:$("#eDist").value,level:$("#eLevel").value,pace:$("#ePace").value,notes:$("#eNotes").value});saveState();$("#modal").close();renderHistory()};
  }else{
    openModal("Edit Strength Workout",`<div class="stack"><label>Date<input id="eDate" type="date" value="${w.date}"></label><label>Duration (minutes)<input id="eDur" type="number" value="${Math.round((w.durationMs||0)/60000)}"></label><div class="small muted">Edit any completed or skipped exercise below.</div>${w.exercises.map((e,ei)=>`<button class="btn ${e.status==="skipped"?"purple":e.status==="done"?"green":"outline"} edit-hist-ex" data-ei="${ei}">${ei+1}. ${e.name} — ${e.status}</button>`).join("")}<button class="btn blue" id="saveEdit">Save Workout Details</button><button class="btn red" id="deleteEdit">Delete Workout</button></div>`);
    document.querySelectorAll(".edit-hist-ex").forEach(b=>b.onclick=()=>openHistoricalExerciseEditor(i,Number(b.dataset.ei)));
    $("#saveEdit").onclick=()=>{w.date=$("#eDate").value;w.durationMs=(Number($("#eDur").value)||0)*60000;w.completed=w.exercises.filter(e=>e.status==="done").length;saveState();$("#modal").close();renderHistory()};
  }
  $("#deleteEdit").onclick=()=>{if(confirm("Delete this workout?")){state.workouts.splice(i,1);saveState();$("#modal").close();renderHistory()}};
}
function openHistoricalExerciseEditor(workoutIndex,exerciseIndex){
  const w=state.workouts[workoutIndex],ex=w.exercises[exerciseIndex];
  openModal(`Edit ${ex.name}`,`<div class="stack"><label>Status<select id="hxStatus"><option value="done" ${ex.status==="done"?"selected":""}>Completed</option><option value="skipped" ${ex.status==="skipped"?"selected":""}>Skipped</option><option value="not-started" ${ex.status==="not-started"?"selected":""}>Not started</option></select></label><label>Weight<input id="hxWeight" type="number" value="${ex.weight||""}"></label><div class="form-grid">${[0,1,2].map(s=>`<label>Set ${s+1} reps<input class="hxRep" data-s="${s}" type="number" value="${ex.reps[s]||""}"></label>`).join("")}</div><label>Effort<select id="hxEffort">${["Easy","Good","Hard","Very Hard"].map(x=>`<option ${ex.effort===x?"selected":""}>${x}</option>`).join("")}</select></label><label>Pain<select id="hxPain">${["None","Mild","Moderate","Severe"].map(x=>`<option ${ex.pain===x?"selected":""}>${x}</option>`).join("")}</select></label><label>Notes<textarea id="hxNotes">${ex.notes||""}</textarea></label><button class="btn blue" id="saveHx">Save Exercise</button></div>`);
  $("#saveHx").onclick=()=>{ex.status=$("#hxStatus").value;ex.weight=$("#hxWeight").value;ex.reps=[...document.querySelectorAll(".hxRep")].map(x=>x.value);ex.effort=$("#hxEffort").value;ex.pain=$("#hxPain").value;ex.notes=$("#hxNotes").value;ex.recommendation=ex.status==="done"?recommendation(ex):"";w.completed=w.exercises.filter(x=>x.status==="done").length;saveState();$("#modal").close();toast("Exercise updated");renderHistory()};
}
function openCardioModal(){
  openModal("Add Cardio Workout",`<div class="stack">
    <label>Date<input id="cDate" type="date" value="${isoDate()}"></label>
    <label>Activity<select id="cType"><option>Recumbent Bike</option><option>Walk</option><option>Elliptical</option><option>Combination</option></select></label>
    <div class="form-grid"><label>Duration (minutes)<input id="cDur" type="number"></label><label>Distance<input id="cDist" type="number" step=".01"></label></div>
    <div class="form-grid"><label>Resistance / level<input id="cLevel"></label><label>Pace / speed<input id="cPace"></label></div>
    <div class="form-grid"><label>Active calories<input id="cCal" type="number"></label><label>Average HR<input id="cHR" type="number"></label></div>
    <label>Effort (1–10)<input id="cEffort" type="number" min="1" max="10"></label>
    <label>Notes<textarea id="cNotes"></textarea></label>
    <button class="btn blue" id="saveCardio">Save Cardio Workout</button></div>`);
  $("#saveCardio").onclick=()=>{const w={id:crypto.randomUUID(),type:"cardio",date:$("#cDate").value,startTs:Date.now(),durationMs:(Number($("#cDur").value)||0)*60000,activity:$("#cType").value,distance:$("#cDist").value,level:$("#cLevel").value,pace:$("#cPace").value,apple:{activeCalories:$("#cCal").value,avgHR:$("#cHR").value,effort:$("#cEffort").value},notes:$("#cNotes").value};state.workouts.push(w);const [,week]=ensureWeek();if(!week.cardio.includes(w.date))week.cardio.push(w.date);saveState();$("#modal").close();toast("Cardio workout saved");renderDashboard()};
}
function openSettingsModal(name){
  const s=state.settings[name];
  openModal(`${name} Settings`,`<div class="stack"><div class="form-grid"><label>Seat<input id="sSeat" value="${s.seat||""}"></label><label>Back pad<input id="sBack" value="${s.backPad||""}"></label></div><div class="form-grid"><label>Leg setting<input id="sLeg" value="${s.leg||""}"></label><label>Start position<input id="sStart" value="${s.start||""}"></label></div><label>Other<input id="sOther" value="${s.other||""}"></label><button class="btn blue" id="saveSettings">Save Settings</button></div>`);
  $("#saveSettings").onclick=()=>{Object.assign(s,{seat:$("#sSeat").value,backPad:$("#sBack").value,leg:$("#sLeg").value,start:$("#sStart").value,other:$("#sOther").value});saveState();$("#modal").close();currentScreen==="exercise"?renderExerciseEntry():renderExercises()};
}
function openJumpModal(){
  const w=state.activeWorkout;
  openModal("Jump to Exercise",`<div class="stack">${w.exercises.map((e,i)=>`<button class="btn ${e.status==="done"?"green":"outline"} jump" data-i="${i}">${i+1}. ${e.name}${e.status==="skipped"?" — SKIPPED":e.status==="done"?" — COMPLETE":""}</button>`).join("")}</div>`);
  document.querySelectorAll(".jump").forEach(b=>b.onclick=()=>{$("#modal").close();openExercise(Number(b.dataset.i))});
}
function openModal(title,html){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=html;$("#modal").showModal()}
function renderHistory(){
  setHeader("History","Saved workouts");
  const rows=[...state.workouts].map((w,i)=>({w,i})).reverse();
  screen.innerHTML=rows.length?rows.map(({w,i})=>`<div class="card"><div class="row"><div><strong>${w.type==="strength"?"Strength":w.activity||"Cardio"}</strong><div class="small muted">${w.date}</div></div><div style="text-align:right"><strong>${Math.round((w.durationMs||0)/60000)} min</strong><div class="small muted">${w.apple?.activeCalories||0} active cal</div></div></div><div class="btn-row" style="margin-top:12px"><button class="btn outline edit-workout" data-i="${i}">Edit Workout</button>${w.type==="strength"?`<button class="btn blue apple-workout" data-i="${i}">${w.apple?"Edit":"Add"} Apple Watch</button>`:""}</div></div>`).join(""):`<div class="card muted">No workouts recorded yet.</div>`;
  document.querySelectorAll(".edit-workout").forEach(b=>b.onclick=()=>openEditWorkout(Number(b.dataset.i)));
  document.querySelectorAll(".apple-workout").forEach(b=>b.onclick=()=>openAppleModal(state.workouts[Number(b.dataset.i)],true));
}
function renderExercises(){
  setHeader("Exercises","Current weights and settings");
  screen.innerHTML=EXERCISES.map(e=>{const s=state.settings[e.name];return `<div class="card"><div class="row"><div><strong>${e.name}</strong><div class="small muted">${e.group}</div></div><div><strong>${s.weight||"—"}${s.weight?" lb":""}</strong></div></div><button class="btn outline edit-ex" data-name="${e.name}" style="margin-top:10px">Edit Settings</button></div>`}).join("");
  document.querySelectorAll(".edit-ex").forEach(b=>b.onclick=()=>openSettingsModal(b.dataset.name));
}
function renderProgress(){
  setHeader("Progress","Strength trends");
  const strength=state.workouts.filter(w=>w.type==="strength");
  const pending=EXERCISES.map(e=>({name:e.name,weight:state.settings[e.name].weight,last:[...strength].reverse().flatMap(w=>w.exercises).find(x=>x.name===e.name&&x.recommendation)}));
  screen.innerHTML=`<div class="card"><h3>Overview</h3><div class="metric-grid"><div class="metric"><div class="small muted">Strength workouts</div><div class="value">${strength.length}</div></div><div class="metric"><div class="small muted">Total sets</div><div class="value">${strength.reduce((s,w)=>s+w.exercises.filter(e=>e.status==="done").length*3,0)}</div></div></div></div><div class="card"><h3>Next-Workout Weight Review</h3><div class="small muted" style="margin-bottom:10px">This shows the accepted weight currently stored for each exercise.</div>${pending.map(p=>`<div class="row review-row"><span>${p.name}</span><span><strong>${p.weight||"—"}${p.weight?" lb":""}</strong>${p.last?`<div class="small muted">${p.last.recommendation}</div>`:""}</span></div>`).join("")}</div>`+
  EXERCISES.map(e=>{const hist=strength.flatMap(w=>w.exercises.filter(x=>x.name===e.name&&x.status==="done").map(x=>({date:w.date,weight:x.weight,reps:x.reps}))).slice(-3);return `<div class="card"><strong>${e.name}</strong>${hist.length?hist.map(h=>`<div class="row small" style="margin-top:8px"><span>${h.date}</span><span>${h.weight||"—"} lb • ${h.reps.join("/")}</span></div>`).join(""):`<div class="small muted" style="margin-top:8px">No completed sets yet.</div>`}</div>`}).join("");
}
function renderMore(){
  setHeader("More","Data and app settings");
  screen.innerHTML=`<div class="card stack"><button class="btn blue" id="exportCSV">Export Spreadsheet CSV</button><button class="btn outline" id="exportJSON">Export Backup JSON</button><label>Import Backup JSON<input id="importJSON" type="file" accept="application/json"></label><button class="btn red" id="resetData">Erase All Data</button></div>
  <div class="card"><h3>Progression Rules</h3><p>Increase one plate when all three sets reach 15 or more reps, or any set reaches 20 reps.</p><p>Decrease one plate when any completed set is below 5 reps.</p><p>Otherwise stay at the same weight. Pain or incomplete work triggers Review.</p></div>`;
  $("#exportCSV").onclick=exportCSV;$("#exportJSON").onclick=exportJSON;
  $("#importJSON").onchange=importJSON;
  $("#resetData").onclick=()=>{if(confirm("Erase all app data?")){localStorage.removeItem("strengthTrackerState");state=structuredClone(defaultState);render()}};
}
function exportCSV(){
  const rows=[["Workout Date","Workout Type","Exercise / Activity","Side","Weight","Set","Reps","Duration Minutes","Distance","Resistance Level","Active Calories","Average HR","Effort","Pain","Recommendation","Notes"]];
  state.workouts.forEach(w=>{
    if(w.type==="strength")w.exercises.forEach(e=>e.reps.forEach((r,i)=>rows.push([w.date,"Strength",e.name,EXERCISES.find(x=>x.name===e.name)?.side||"",e.weight,i+1,r,Math.round((w.durationMs||0)/60000),"","",w.apple?.activeCalories||"",w.apple?.avgHR||"",e.effort,e.pain,e.recommendation,e.notes||""])));
    else rows.push([w.date,"Cardio",w.activity||"","","","","",Math.round((w.durationMs||0)/60000),w.distance||"",w.level||"",w.apple?.activeCalories||"",w.apple?.avgHR||"",w.apple?.effort||"","","",w.notes||""]);
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  downloadBlob(csv,"strength-cardio-workouts.csv","text/csv");
}
function exportJSON(){downloadBlob(JSON.stringify(state,null,2),"strength-tracker-backup.json","application/json")}
function importJSON(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);saveState();toast("Backup imported");renderMore()}catch{alert("That file could not be imported.")}};r.readAsText(f)}
function downloadBlob(text,name,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>navigate(b.dataset.screen));
$("#backBtn").onclick=()=>{if(currentScreen==="exercise")currentScreen="strength";else if(currentScreen==="strength"||currentScreen==="summary")currentScreen="dashboard";else currentScreen="dashboard";render()};
$("#menuBtn").onclick=()=>navigate("more");
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js");
render();

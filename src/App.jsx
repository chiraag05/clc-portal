import { useMemo, useState } from "react";
import { ChevronRight, ClipboardList, MapPin, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";

const LEVELS = ["Expert Mentor", "Advanced Mentor", "Foundation Mentor", "Trainee"];
const SKILLS = ["Spike Essential", "Scratch", "Spike Prime", "ML", "Python", "Arduino", "No Code"];
const DEFAULT_STUDIOS = ["Andheri West", "Worli"];
const DEFAULT_VENUES = ["Vibgyor School", "Oberoi International School"];
const MENTOR_TYPES = ["Foundation Mentor", "Advanced Mentor", "Expert Mentor"];
const DEFAULT_TASKS = [
  "Prime Hub Charging", "Essential Hub Charging", "iPad Charging",
  "Water Management", "Register Management", "Prime Kit Sorting", "Essential Kit Sorting",
];
const STORAGE_KEY = "clc-mentor-portal-v1";

const levelSkills = {
  "Foundation Mentor": ["Spike Essential", "Scratch"],
  "Advanced Mentor": ["Spike Essential", "Scratch", "Spike Prime", "ML"],
  "Expert Mentor": [...SKILLS],
  Trainee: [],
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const id = () => crypto.randomUUID();

const initialData = {
  studios: DEFAULT_STUDIOS,
  venues: DEFAULT_VENUES,
  tasks: DEFAULT_TASKS,
  mentors: [
    { id: id(), name: "Rahul Sharma", mentorType: "Foundation Mentor", level: "Foundation Mentor", skills: levelSkills["Foundation Mentor"], studio: "Andheri West", venueEntries: [], process: "Prime Hub Charging", remarks: "", leave: null },
    { id: id(), name: "Priya Shah", mentorType: "Foundation Mentor", level: "Advanced Mentor", skills: levelSkills["Advanced Mentor"], studio: "Worli", venueEntries: [], process: "Register Management", remarks: "", leave: null },
    { id: id(), name: "Amit Patel", mentorType: "Foundation Mentor", level: "Expert Mentor", skills: levelSkills["Expert Mentor"], studio: "Andheri West", venueEntries: [], process: "iPad Charging", remarks: "", leave: null },
  ],
  processes: DEFAULT_TASKS.map((task, i) => ({ id: id(), task, assignedTo: ["Rahul Sharma", "Priya Shah", "Amit Patel"][i % 3] })),
  deploymentHistory: {},
};

function normalizeData(saved) {
  const parsed = saved ? JSON.parse(saved) : initialData;
  return {
    ...initialData,
    ...parsed,
    studios: parsed.studios?.length ? parsed.studios : DEFAULT_STUDIOS,
    venues: parsed.venues?.length ? parsed.venues : DEFAULT_VENUES,
    tasks: parsed.tasks?.length ? parsed.tasks : DEFAULT_TASKS,
    processes: parsed.processes || [],
    deploymentHistory: parsed.deploymentHistory || {},
    mentors: (parsed.mentors || []).map((mentor) => ({
      ...mentor,
      level: LEVELS.includes(mentor.level) ? mentor.level : "Trainee",
      skills: Array.isArray(mentor.skills) ? mentor.skills : [],
      venueEntries: Array.isArray(mentor.venueEntries) ? mentor.venueEntries.map((v) => ({
        id: v.id || id(), venue: v.venue || "", date: v.date || "", dateValue: v.dateValue || "",
        startTime: v.startTime || v.time || "", endTime: v.endTime || "",
      })) : [],
    })),
  };
}

function loadData() {
  try {
    const data = normalizeData(localStorage.getItem(STORAGE_KEY));
    const key = todayKey();
    if (!data.deploymentHistory[key]) {
      data.deploymentHistory[key] = Object.fromEntries(data.mentors.map((m) => [m.id, {
        id: m.id, name: m.name, studio: m.studio, venueEntries: m.venueEntries, leave: m.leave,
      }]));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    return data;
  } catch { return initialData; }
}

function isOnLeave(leave, date = todayKey()) {
  return !!(leave?.start && leave?.end && date >= leave.start && date <= leave.end);
}

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function timeRange(entry) {
  if (!entry.startTime && !entry.endTime) return "";
  return `${entry.startTime || ""}${entry.endTime ? ` – ${entry.endTime}` : ""}`;
}

function App() {
  const [data, setData] = useState(loadData);
  const [page, setPage] = useState("mentors");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null);

  const updateData = (next) => {
    const key = todayKey();
    const withHistory = {
      ...next,
      deploymentHistory: {
        ...(next.deploymentHistory || {}),
        [key]: Object.fromEntries(next.mentors.map((m) => [m.id, {
          id: m.id, name: m.name, studio: m.studio, venueEntries: m.venueEntries, leave: m.leave,
        }])),
      },
    };
    setData(withHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withHistory));
  };

  const filteredMentors = useMemo(() => data.mentors.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())), [data.mentors, search]);
  const selectedMentor = data.mentors.find((m) => m.id === selectedId);

  function saveMentor(form) {
    const mentors = data.mentors.some((m) => m.id === form.id)
      ? data.mentors.map((m) => m.id === form.id ? form : m)
      : [...data.mentors, { ...form, id: id() }];
    const saved = mentors.find((m) => m.id === (form.id || mentors.at(-1).id));
    updateData({ ...data, mentors });
    setModal(null);
    setSelectedId(saved?.id || null);
  }

  function removeMentor(mentorId) {
    const mentor = data.mentors.find((m) => m.id === mentorId);
    setModal({ type: "confirm", title: "Remove Mentor", message: `Remove ${mentor?.name || "this mentor"}?`, confirmLabel: "Remove", onConfirm: () => {
      const mentors = data.mentors.filter((m) => m.id !== mentorId);
      const processes = data.processes.filter((p) => p.assignedTo !== mentor?.name);
      updateData({ ...data, mentors, processes });
      setSelectedId(null);
      setModal(null);
    }});
  }

  function saveLeave(mentorId, leave) {
    updateData({ ...data, mentors: data.mentors.map((m) => m.id === mentorId ? { ...m, leave } : m) });
    setModal(null);
  }

  function addOrEditList(type, value, oldValue = "") {
    const key = type === "studio" ? "studios" : "venues";
    const clean = value.trim();
    if (!clean) return false;
    const list = data[key];
    if (oldValue) {
      if (clean !== oldValue && list.includes(clean)) return false;
      const nextList = list.map((item) => item === oldValue ? clean : item);
      const mentors = type === "studio"
        ? data.mentors.map((m) => m.studio === oldValue ? { ...m, studio: clean } : m)
        : data.mentors.map((m) => ({ ...m, venueEntries: m.venueEntries.map((v) => v.venue === oldValue ? { ...v, venue: clean } : v) }));
      updateData({ ...data, [key]: nextList, mentors });
      return true;
    }
    if (list.includes(clean)) return false;
    updateData({ ...data, [key]: [...list, clean] });
    return true;
  }

  function removeListItem(type, value) {
    const key = type === "studio" ? "studios" : "venues";
    const used = type === "studio"
      ? data.mentors.some((m) => m.studio === value)
      : data.mentors.some((m) => (m.venueEntries || []).some((v) => v.venue === value));
    setModal({ type: "confirm", title: `Remove ${type === "studio" ? "Studio" : "Other Venue"}`, message: used ? `This ${type === "studio" ? "studio" : "venue"} is currently used by a mentor. Remove it from the available list? Existing saved records will be kept.` : `Remove "${value}"?`, confirmLabel: "Remove", onConfirm: () => {
      updateData({ ...data, [key]: data[key].filter((item) => item !== value) });
      setModal(null);
    }});
  }

  function saveProcess(process) {
    const processes = data.processes.some((p) => p.id === process.id)
      ? data.processes.map((p) => p.id === process.id ? process : p)
      : [...data.processes, { ...process, id: id() }];
    updateData({ ...data, processes });
    setModal(null);
  }

  function addTask(task) {
    const clean = task.trim();
    if (!clean || data.tasks.includes(clean)) return false;
    updateData({ ...data, tasks: [...data.tasks, clean] });
    return true;
  }

  function editTask(oldTask, newTask) {
    const clean = newTask.trim();
    if (!clean || (clean !== oldTask && data.tasks.includes(clean))) return false;
    const tasks = data.tasks.map((t) => t === oldTask ? clean : t);
    const processes = data.processes.map((p) => p.task === oldTask ? { ...p, task: clean } : p);
    const mentors = data.mentors.map((m) => m.process === oldTask ? { ...m, process: clean } : m);
    updateData({ ...data, tasks, processes, mentors });
    return true;
  }

  function removeTask(task) {
    setModal({ type: "confirm", title: "Remove Task", message: `Remove "${task}" from the task list? Existing process assignments will remain unchanged.`, confirmLabel: "Remove", onConfirm: () => {
      updateData({ ...data, tasks: data.tasks.filter((t) => t !== task) });
      setModal(null);
    }});
  }

  function ensureTodayHistory(currentData) {
    const key = todayKey();
    const snapshot = Object.fromEntries(currentData.mentors.map((m) => [m.id, {
      id: m.id, name: m.name, studio: m.studio, venueEntries: m.venueEntries, leave: m.leave,
    }]));
    if (JSON.stringify(currentData.deploymentHistory?.[key]) === JSON.stringify(snapshot)) return currentData;
    return { ...currentData, deploymentHistory: { ...currentData.deploymentHistory, [key]: snapshot } };
  }

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} />
      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">Creative Links Club</p><h1>{page === "mentors" ? "Mentor Directory" : page === "deployment" ? "Mentor Deployment" : "Mentor Processes"}</h1></div>
          {page === "mentors" && <button className="primary-btn" onClick={() => setModal({ type: "mentor" })}><Plus size={18} /> Add Mentor</button>}
        </header>

        {page === "mentors" && <>
          <div className="toolbar"><div className="search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mentors..." /></div><span className="count">{data.mentors.length} mentors</span></div>
          <MentorGroups mentors={filteredMentors} onClick={(m) => setSelectedId(m.id)} />
        </>}

        {page === "deployment" && <DeploymentPage data={data} updateData={updateData} />}
        {page === "processes" && <ProcessesPage processes={data.processes} tasks={data.tasks} mentors={data.mentors} onAdd={() => setModal({ type: "process" })} onEdit={(p) => setModal({ type: "process", process: p })} onRemove={(id) => setModal({ type: "confirm", title: "Remove Process", message: "Remove this process assignment?", confirmLabel: "Remove", onConfirm: () => { updateData({ ...data, processes: data.processes.filter((p) => p.id !== id) }); setModal(null); } })} onAddTask={addTask} onEditTask={(task) => setModal({ type: "task", task })} onRemoveTask={removeTask} />}
      </main>

      {selectedMentor && <MentorDrawer mentor={selectedMentor} onClose={() => setSelectedId(null)} onEdit={() => setModal({ type: "mentor", mentor: selectedMentor })} onRemove={() => removeMentor(selectedMentor.id)} onLeave={() => setModal({ type: "leave", mentor: selectedMentor })} />}
      {modal?.type === "mentor" && <MentorForm mentor={modal.mentor} data={data} onClose={() => setModal(null)} onSave={saveMentor} onManage={(type) => setModal({ type: "manage-list", listType: type })} />}
      {modal?.type === "leave" && <LeaveForm mentor={modal.mentor} onClose={() => setModal(null)} onSave={(leave) => saveLeave(modal.mentor.id, leave)} />}
      {modal?.type === "process" && <ProcessForm process={modal.process} mentors={data.mentors} tasks={data.tasks} onClose={() => setModal(null)} onSave={saveProcess} onAddTask={addTask} />}
      {modal?.type === "task" && <TaskForm task={modal.task} onClose={() => setModal(null)} onSave={(value) => { const ok = modal.task ? editTask(modal.task, value) : addTask(value); if (ok) setModal(null); }} />}
      {modal?.type === "manage-list" && <ManageListForm type={modal.listType} values={modal.listType === "studio" ? data.studios : data.venues} onClose={() => setModal(null)} onAdd={(value) => addOrEditList(modal.listType, value)} onEdit={(oldValue, value) => addOrEditList(modal.listType, value, oldValue)} onRemove={(value) => removeListItem(modal.listType, value)} />}
      {modal?.type === "confirm" && <ConfirmForm {...modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function Sidebar({ page, setPage }) {
  return <aside className="sidebar"><div className="brand"><div className="brand-mark">CL</div><div><strong>Creative Links</strong><span>Mentor Portal</span></div></div><nav>{[["mentors","Mentors",Users],["deployment","Deployment",MapPin],["processes","Processes",ClipboardList]].map(([id,label,Icon]) => <button key={id} className={page === id ? "nav-item active" : "nav-item"} onClick={() => setPage(id)}><Icon size={19} />{label}</button>)}</nav></aside>;
}

function MentorGroups({ mentors, onClick }) {
  return <div>{LEVELS.map((level) => { const group = mentors.filter((m) => m.level === level); if (!group.length) return null; return <section className="mentor-group" key={level}><div className="group-head"><h2>{level}</h2><span>{group.length}</span></div><div className="mentor-grid">{group.map((m) => <MentorCard key={m.id} mentor={m} onClick={() => onClick(m)} />)}</div></section>; })}{!mentors.length && <Empty text="No mentors found." />}</div>;
}

function MentorCard({ mentor, onClick }) {
  return <button className="mentor-card" onClick={onClick}><div className="avatar">{mentor.name.charAt(0).toUpperCase()}</div><div className="mentor-card-body"><div className="card-title-row"><h3>{mentor.name}</h3>{isOnLeave(mentor.leave) && <span className="badge leave">On Leave</span>}</div><p>{mentor.level}</p><div className="card-meta"><span><MapPin size={14} /> {mentor.studio || "Studio not assigned"}</span></div></div><ChevronRight size={19} className="chevron" /></button>;
}

function MentorDrawer({ mentor, onClose, onEdit, onRemove, onLeave }) {
  return <div className="overlay" onMouseDown={onClose}><aside className="drawer" onMouseDown={(e) => e.stopPropagation()}><div className="drawer-head"><div className="avatar large">{mentor.name.charAt(0).toUpperCase()}</div><button className="icon-btn" onClick={onClose}><X size={20} /></button></div><div className="drawer-title"><div><h2>{mentor.name}</h2><p>{mentor.level}</p></div></div><InfoSection title="Skills"><div className="tag-list">{mentor.skills.map((s) => <span className="tag" key={s}>{s}</span>)}</div></InfoSection><InfoSection title="Allotted Studio"><p>{mentor.studio || "Not assigned"}</p></InfoSection><InfoSection title="Other Venue">{mentor.venueEntries.length ? mentor.venueEntries.map((v) => <div className="venue-summary-row" key={v.id}><strong>{v.venue}</strong><span>{v.date || "Day not set"}{timeRange(v) ? ` · ${timeRange(v)}` : ""}</span></div>) : <Muted>None</Muted>}</InfoSection><InfoSection title="Weekly Process"><p>{mentor.process || "Not assigned"}</p></InfoSection><InfoSection title="Leave">{mentor.leave ? <div className="leave-box"><strong>{isOnLeave(mentor.leave) ? "Currently on leave" : "Leave recorded"}</strong><span>{formatDate(mentor.leave.start)} – {formatDate(mentor.leave.end)}</span></div> : <Muted>No leave recorded</Muted>}<button className="secondary-btn full" onClick={onLeave}>{mentor.leave ? "Edit Leave" : "Add Leave"}</button></InfoSection><InfoSection title="Remarks"><p>{mentor.remarks || "No remarks"}</p></InfoSection><div className="drawer-actions"><button className="secondary-btn" onClick={onEdit}><Pencil size={16} /> Edit</button><button className="danger-btn" onClick={onRemove}><Trash2 size={16} /> Remove</button></div></aside></div>;
}

function MentorForm({ mentor, data, onClose, onSave, onManage }) {
  const [form, setForm] = useState(mentor || { id: "", name: "", mentorType: "Foundation Mentor", level: "Trainee", skills: [], studio: "", venueEntries: [], process: "", remarks: "", leave: null });
  const setLevel = (level) => setForm((f) => ({ ...f, level, skills: levelSkills[level].length ? [...levelSkills[level]] : f.skills }));
  const toggleSkill = (skill) => setForm((f) => { const skills = f.skills.includes(skill) ? f.skills.filter((s) => s !== skill) : [...f.skills, skill]; return { ...f, skills, level: inferLevel(skills) }; });
  const addVenue = () => setForm((f) => ({ ...f, venueEntries: [...f.venueEntries, { id: id(), venue: data.venues[0] || "", date: "", dateValue: "", startTime: "", endTime: "" }] }));
  const updateVenue = (venueId, field, value) => setForm((f) => ({ ...f, venueEntries: f.venueEntries.map((v) => v.id === venueId ? { ...v, [field]: value } : v) }));
  const removeVenue = (venueId) => setForm((f) => ({ ...f, venueEntries: f.venueEntries.filter((v) => v.id !== venueId) }));
  function submit(e) { e.preventDefault(); if (!form.name.trim()) return; onSave({ ...form, name: form.name.trim() }); }

  return <Modal title={mentor ? "Edit Mentor" : "Add Mentor"} onClose={onClose}><form onSubmit={submit}><Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field><Field label="Mentor Type"><select value={form.mentorType || "Foundation Mentor"} onChange={(e) => setForm({ ...form, mentorType: e.target.value })}>{MENTOR_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field><Field label="Current Level"><select value={form.level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></Field><Field label="Skills"><div className="skill-picker">{SKILLS.map((s) => <button type="button" key={s} className={form.skills.includes(s) ? "skill-option selected" : "skill-option"} onClick={() => toggleSkill(s)}>{s}</button>)}</div></Field><Field label="Allotted Studio"><div className="select-actions"><select value={form.studio} onChange={(e) => { const value = e.target.value; if (value === "__MANAGE__") { onManage("studio"); return; } setForm({ ...form, studio: value }); }}><option value="">Select studio</option>{data.studios.map((s) => <option key={s}>{s}</option>)}<option value="__MANAGE__">+ Add / Edit Studio</option></select><button type="button" className="secondary-btn" onClick={() => onManage("studio")}>Manage</button></div></Field><Field label="Other Venue"><button type="button" className="secondary-btn full" onClick={addVenue}><Plus size={16} /> Add Other Venue</button><button type="button" className="text-btn" onClick={() => onManage("venue")}>Add / Edit Venue Options</button></Field>{form.venueEntries.map((v) => <div className="venue-entry" key={v.id}><Field label="Venue"><select value={v.venue} onChange={(e) => { if (e.target.value === "__MANAGE__") { onManage("venue"); return; } updateVenue(v.id, "venue", e.target.value); }}>{data.venues.map((venue) => <option key={venue}>{venue}</option>)}<option value="__MANAGE__">+ Add / Edit Other Venue</option></select></Field><Field label="Date & Day"><input type="date" value={v.dateValue} onChange={(e) => { const value = e.target.value; const day = value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" }) : ""; updateVenue(v.id, "dateValue", value); updateVenue(v.id, "date", day); }} /></Field><div className="form-grid"><Field label="Start Time"><input type="time" value={v.startTime} onChange={(e) => updateVenue(v.id, "startTime", e.target.value)} /></Field><Field label="End Time"><input type="time" min={v.startTime || undefined} value={v.endTime} onChange={(e) => updateVenue(v.id, "endTime", e.target.value)} /></Field></div><button type="button" className="remove-venue-btn" onClick={() => removeVenue(v.id)}>Remove venue</button></div>)}<Field label="Weekly Process"><select value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })}><option value="">Select process</option>{data.tasks.map((t) => <option key={t}>{t}</option>)}</select></Field><Field label="Remarks"><textarea rows="3" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field><ModalActions onClose={onClose} submitLabel={mentor ? "Save Changes" : "Add Mentor"} /></form></Modal>;
}

function inferLevel(skills) {
  if (SKILLS.every((s) => skills.includes(s))) return "Expert Mentor";
  if (levelSkills["Advanced Mentor"].every((s) => skills.includes(s))) return "Advanced Mentor";
  if (levelSkills["Foundation Mentor"].every((s) => skills.includes(s))) return "Foundation Mentor";
  return "Trainee";
}

function DeploymentPage({ data, updateData }) {
  const [date, setDate] = useState(todayKey());
  const [viewHistory, setViewHistory] = useState(false);
  const history = data.deploymentHistory || {};
  const today = todayKey();
  const snapshot = history[date];
  const mentors = snapshot ? Object.values(snapshot) : data.mentors;
  const visible = mentors.map((m) => ({ ...m, venueEntries: (m.venueEntries || []).filter((v) => v.dateValue === date) }));
  const selectedIsToday = date === today;

  function captureToday() {
    if (!selectedIsToday) return;
    const nextHistory = Object.fromEntries(data.mentors.map((m) => [m.id, { id: m.id, name: m.name, studio: m.studio, venueEntries: m.venueEntries, leave: m.leave }]));
    updateData({ ...data, deploymentHistory: { ...history, [today]: nextHistory } });
  }

  const days = Object.keys(history).sort().reverse();
  return <section className="panel"><div className="panel-head"><div><h2>Mentor deployment</h2><p>{selectedIsToday ? "Today’s deployment" : `Deployment for ${formatDate(date)}`}</p></div><div className="deployment-controls"><label className="date-control">Day<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><button className="secondary-btn" onClick={() => setViewHistory((v) => !v)}>{viewHistory ? "Hide History" : "View History"}</button><button className="secondary-btn" onClick={captureToday}>Refresh Today</button></div></div>{viewHistory && <div className="history-bar">{days.length ? days.map((day) => <button key={day} className={day === date ? "history-day active" : "history-day"} onClick={() => setDate(day)}>{formatDate(day)}</button>) : <Muted>No saved daily history yet.</Muted>}</div>}<div className="table-wrap"><table><thead><tr><th>Mentor</th><th>Studio</th><th>Other Venue</th></tr></thead><tbody>{visible.map((m) => <tr key={m.id}><td><span className="table-name"><span className="mini-avatar">{m.name.charAt(0)}</span>{m.name}</span></td><td>{isOnLeave(m.leave, date) ? "Leave" : (m.studio || "")}</td><td>{isOnLeave(m.leave, date) ? "" : (m.venueEntries.length ? m.venueEntries.map((v) => <div key={v.id}>{v.venue}{timeRange(v) ? ` (${timeRange(v)})` : ""}</div>) : "")}</td></tr>)}</tbody></table></div></section>;
}

function ProcessesPage({ processes, tasks, mentors, onAdd, onEdit, onRemove, onAddTask, onEditTask, onRemoveTask }) {
  return <section className="panel"><div className="panel-head"><div><h2>Weekly processes</h2><p>Recurring studio responsibilities.</p></div><button className="primary-btn" onClick={onAdd}><Plus size={18} /> Add Process</button></div><div className="task-tools"><button className="secondary-btn" onClick={() => onEditTask("")}>+ Add Task</button></div><div className="process-list">{processes.map((p) => <div className="process-row" key={p.id}><div><strong>{p.task}</strong><span>Assigned to {p.assignedTo || "Unassigned"}</span></div><div className="row-actions"><button className="icon-btn" onClick={() => onEdit(p)}><Pencil size={17} /></button><button className="icon-btn danger-icon" onClick={() => onRemove(p.id)}><Trash2 size={17} /></button></div></div>)}{!processes.length && <Empty text="No processes added." />}</div><div className="task-list"><h3>Task list</h3>{tasks.map((task) => <div className="task-row" key={task}><span>{task}</span><div><button className="icon-btn" onClick={() => onEditTask(task)}><Pencil size={16} /></button><button className="icon-btn danger-icon" onClick={() => onRemoveTask(task)}><Trash2 size={16} /></button></div></div>)}</div></section>;
}


function ProcessForm({ process, mentors, tasks, onClose, onSave, onAddTask }) {
  const [form, setForm] = useState(process || { id: "", task: "", assignedTo: mentors[0]?.name || "" });
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState("");
  function createTask() {
    const clean = newTask.trim();
    if (!clean) return;
    if (onAddTask(clean)) { setForm({ ...form, task: clean }); setNewTask(""); setAddingTask(false); }
  }
  return <Modal title={process ? "Edit Process" : "Add Process"} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); if (form.task) onSave(form); }}><Field label="Task"><select value={addingTask ? "__ADD_TASK__" : form.task} onChange={(e) => { if (e.target.value === "__ADD_TASK__") setAddingTask(true); else { setAddingTask(false); setForm({ ...form, task: e.target.value }); } }} required><option value="">Select task</option>{tasks.map((t) => <option key={t}>{t}</option>)}<option value="__ADD_TASK__">+ Add Task</option></select>{addingTask && <div className="inline-add"><input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="New task name" autoFocus /><button type="button" className="secondary-btn" onClick={createTask}>Add Task</button></div>}</Field><Field label="Assigned Person"><select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">Unassigned</option>{mentors.map((m) => <option key={m.id}>{m.name}</option>)}</select></Field><ModalActions onClose={onClose} submitLabel={process ? "Save Changes" : "Add Process"} /></form></Modal>;
}

function TaskForm({ task, onClose, onSave }) { const [value, setValue] = useState(task || ""); const editing = !!task; return <Modal title={editing ? "Edit Task" : "Add Task"} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave(value); }}><Field label="Task Name"><input value={value} onChange={(e) => setValue(e.target.value)} required autoFocus /></Field><ModalActions onClose={onClose} submitLabel={editing ? "Save Task" : "Add Task"} /></form></Modal>; }

function ManageListForm({ type, values, onClose, onAdd, onEdit, onRemove }) {
  const [newValue, setNewValue] = useState(""); const [editing, setEditing] = useState(null); const label = type === "studio" ? "Studio" : "Other Venue";
  return <Modal title={`Manage ${label}s`} onClose={onClose}><Field label={`Add ${label}`}><div className="inline-add"><input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={`${label} name`} /><button type="button" className="primary-btn" onClick={() => { if (onAdd(newValue)) setNewValue(""); }}>Add</button></div></Field><div className="manage-list">{values.map((value) => <div className="manage-row" key={value}>{editing === value ? <input defaultValue={value} onKeyDown={(e) => { if (e.key === "Enter") { if (onEdit(value, e.currentTarget.value)) setEditing(null); } }} autoFocus /> : <span>{value}</span>}<div><button type="button" className="icon-btn" onClick={() => setEditing(editing === value ? null : value)}><Pencil size={16} /></button><button type="button" className="icon-btn danger-icon" onClick={() => onRemove(value)}><Trash2 size={16} /></button></div></div>)}</div><ModalActions onClose={onClose} submitLabel="Done" /></Modal>;
}

function LeaveForm({ mentor, onClose, onSave }) { const [leave, setLeave] = useState(mentor.leave || { start: "", end: "" }); return <Modal title={`${mentor.leave ? "Edit" : "Add"} Leave — ${mentor.name}`} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); if (leave.start && leave.end && leave.end >= leave.start) onSave(leave); }}><div className="form-grid"><Field label="Start Date"><input type="date" value={leave.start} onChange={(e) => setLeave({ ...leave, start: e.target.value })} required /></Field><Field label="End Date"><input type="date" value={leave.end} min={leave.start} onChange={(e) => setLeave({ ...leave, end: e.target.value })} required /></Field></div><ModalActions onClose={onClose} submitLabel="Save Leave" /></form></Modal>; }

function ConfirmForm({ title, message, confirmLabel, onConfirm, onClose }) { return <Modal title={title} onClose={onClose}><p className="confirm-message">{message}</p><div className="modal-actions"><button className="secondary-btn" onClick={onClose}>Cancel</button><button className="danger-btn" onClick={onConfirm}>{confirmLabel}</button></div></Modal>; }
function Modal({ title, onClose, children }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={20} /></button></div>{children}</div></div>; }
function ModalActions({ onClose, submitLabel }) { return <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button type="submit" className="primary-btn">{submitLabel}</button></div>; }
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
function InfoSection({ title, children }) { return <section className="info-section"><h4>{title}</h4>{children}</section>; }
function Muted({ children }) { return <span className="muted">{children}</span>; }
function Empty({ text }) { return <div className="empty">{text}</div>; }

export default App;

"use client";

import { useEffect, useState } from "react";

export default function AnalystNotes() {
  const [notes, setNotes] = useState("");
  const [thesis, setThesis] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNotes(localStorage.getItem("alchemy-desk-notes") || "");
    setThesis(localStorage.getItem("alchemy-desk-thesis") || "");
  }, []);

  function save() {
    localStorage.setItem("alchemy-desk-notes", notes);
    localStorage.setItem("alchemy-desk-thesis", thesis);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <section className="panel input-panel" id="input">
      <div className="section-heading">
        <div>
          <span className="kicker">MY INPUT</span>
          <h2>Test the research against the chart</h2>
        </div>
        <span className="privacy">Saved only in this browser</span>
      </div>
      <label>
        Current thesis
        <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="State your current view in one or two sentences." />
      </label>
      <label>
        Analyst notes
        <textarea className="large" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add chart observations, conflicts, article ideas or unresolved questions." />
      </label>
      <button onClick={save}>{saved ? "Saved" : "Save locally"}</button>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { BASE, api } from "../api.js";
import { useFlash } from "../utils.jsx";

const empty = { company_name: "", address: "", phone: "", email: "", gst_number: "", tax_rate: "" };

export default function Settings() {
  const [form, setForm] = useState(empty);
  const [flash, show] = useFlash();
  const fileRef = useRef(null);

  useEffect(() => {
    api
      .get("/settings")
      .then((s) =>
        setForm({
          company_name: s.company_name || "",
          address: s.address || "",
          phone: s.phone || "",
          email: s.email || "",
          gst_number: s.gst_number || "",
          tax_rate: String(s.tax_rate ?? 0),
        })
      )
      .catch((e) => show(e.message, true));
  }, [show]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    try {
      await api.put("/settings", form);
      show("Company settings saved successfully.");
    } catch (e) {
      show(e.message, true);
    }
  };

  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!window.confirm("Restoring this backup will replace ALL current data.\n\nAre you sure you want to continue?")) return;
    try {
      const backup = JSON.parse(await file.text());
      await api.post("/settings/restore", backup);
      show("Database restored successfully.");
    } catch (err) {
      show(err instanceof SyntaxError ? "This is not a valid backup file." : err.message, true);
    }
  };

  const fields = [
    ["company_name", "Company Name", "Enter your company name"],
    ["address", "Address", "Enter company address"],
    ["phone", "Phone Number", "Enter phone number"],
    ["email", "Email", "Enter email address"],
    ["gst_number", "GST Number", "Enter GST number (optional)"],
  ];

  return (
    <>
      <h1 className="page-title">Settings</h1>
      {flash}

      <div className="card">
        <h3>Company Information</h3>
        {fields.map(([key, label, ph]) => (
          <div className="field" key={key} style={{ maxWidth: 480 }}>
            <label>{label}</label>
            <input placeholder={ph} value={form[key]} onChange={set(key)} />
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Tax Settings</h3>
        <div className="field" style={{ maxWidth: 220 }}>
          <label>Default Tax Rate (%)</label>
          <input type="number" min="0" max="100" placeholder="Example: 18" value={form.tax_rate} onChange={set("tax_rate")} />
        </div>
      </div>

      <div className="form-row">
        <button className="btn" onClick={save}>Save Settings</button>
        <a className="btn secondary" href={`${BASE}/settings/backup`}>Backup Database</a>
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>Restore Database</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={restore} />
      </div>
    </>
  );
}

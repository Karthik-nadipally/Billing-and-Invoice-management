import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { fmtDate, useFlash } from "../utils.jsx";

const empty = { name: "", phone: "", email: "", address: "" };

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [flash, show] = useFlash();

  const load = useCallback(async () => {
    try {
      setRows(await api.get("/customers"));
    } catch (e) {
      show(e.message, true);
    }
  }, [show]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const clear = () => {
    setForm(empty);
    setSelected(null);
  };

  const add = async () => {
    try {
      await api.post("/customers", form);
      show("Customer added successfully.");
      clear();
      load();
    } catch (e) {
      show(e.message, true);
    }
  };

  const update = async () => {
    if (!selected) return show("Select a customer first.", true);
    try {
      await api.put(`/customers/${selected}`, form);
      show("Customer updated successfully.");
      clear();
      load();
    } catch (e) {
      show(e.message, true);
    }
  };

  const remove = async () => {
    if (!selected) return show("Select a customer first.", true);
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      await api.del(`/customers/${selected}`);
      show("Customer deleted successfully.");
      clear();
      load();
    } catch (e) {
      show(e.message, true);
    }
  };

  const pick = (c) => {
    setSelected(c.id);
    setForm({
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
    });
  };

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    (c) =>
      !q ||
      [c.name, c.phone, c.email].some((v) => (v || "").toLowerCase().includes(q))
  );

  return (
    <>
      <h1 className="page-title">Customer Management</h1>
      {flash}

      <div className="card">
        <div className="form-row">
          <input className="grow" placeholder="Customer Name" value={form.name} onChange={set("name")} />
          <input placeholder="Phone Number" value={form.phone} onChange={set("phone")} />
          <input className="grow" placeholder="Email" value={form.email} onChange={set("email")} />
        </div>
        <div className="form-row">
          <input className="grow" placeholder="Address" value={form.address} onChange={set("address")} />
          <button className="btn" onClick={add}>Add Customer</button>
          <button className="btn" onClick={update}>Update</button>
          <button className="btn danger" onClick={remove}>Delete</button>
          <button className="btn secondary" onClick={clear}>Clear</button>
        </div>
      </div>

      <div className="card">
        <div className="form-row">
          <input
            className="grow"
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="empty">No customers found.</td></tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={`clickable ${selected === c.id ? "selected" : ""}`}
                  onClick={() => pick(c)}
                >
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.email}</td>
                  <td>{c.address}</td>
                  <td>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { inr, useFlash } from "../utils.jsx";

const empty = { name: "", price: "", gst: "", stock: "" };

export default function Products() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [flash, show] = useFlash();

  const load = useCallback(async () => {
    try {
      setRows(await api.get("/products"));
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

  // Same checks as the desktop app
  const validate = () => {
    if (!form.name.trim() || form.price === "") return "Product name and price are required.";
    const price = Number(form.price);
    const gst = form.gst === "" ? 0 : Number(form.gst);
    const stock = form.stock === "" ? 0 : Number(form.stock);
    if ([price, gst, stock].some(isNaN) || !Number.isInteger(stock))
      return "Price and GST must be numbers. Stock must be a whole number.";
    if (price < 0 || gst < 0 || stock < 0) return "Price, GST and stock cannot be negative.";
    return null;
  };

  const add = async () => {
    const err = validate();
    if (err) return show(err, true);
    try {
      await api.post("/products", form);
      show("Product added successfully.");
      clear();
      load();
    } catch (e) {
      show(e.message, true);
    }
  };

  const update = async () => {
    if (!selected) return show("Select a product first.", true);
    const err = validate();
    if (err) return show(err, true);
    try {
      await api.put(`/products/${selected}`, form);
      show("Product updated successfully.");
      clear();
      load();
    } catch (e) {
      show(e.message, true);
    }
  };

  const remove = async () => {
    if (!selected) return show("Select a product first.", true);
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await api.del(`/products/${selected}`);
      show("Product deleted successfully.");
      clear();
      load();
    } catch (e) {
      show(e.message, true);
    }
  };

  const pick = (p) => {
    setSelected(p.id);
    setForm({ name: p.name, price: String(p.price), gst: String(p.gst), stock: String(p.stock) });
  };

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((p) => !q || p.name.toLowerCase().includes(q));

  return (
    <>
      <h1 className="page-title">Product Management</h1>
      {flash}

      <div className="card">
        <div className="form-row">
          <input className="grow" placeholder="Product Name" value={form.name} onChange={set("name")} />
          <input type="number" min="0" step="0.01" placeholder="Price" value={form.price} onChange={set("price")} />
          <input type="number" min="0" step="0.01" placeholder="GST %" value={form.gst} onChange={set("gst")} />
          <input type="number" min="0" step="1" placeholder="Stock Quantity" value={form.stock} onChange={set("stock")} />
        </div>
        <div className="form-row">
          <button className="btn" onClick={add}>Add Product</button>
          <button className="btn" onClick={update}>Update</button>
          <button className="btn danger" onClick={remove}>Delete</button>
          <button className="btn secondary" onClick={clear}>Clear</button>
        </div>
      </div>

      <div className="card">
        <div className="form-row">
          <input
            className="grow"
            placeholder="Search product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Product Name</th><th className="num">Price</th><th className="num">GST %</th><th className="num">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="empty">No products found.</td></tr>
              )}
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`clickable ${selected === p.id ? "selected" : ""}`}
                  onClick={() => pick(p)}
                >
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td className="num">{inr(p.price)}</td>
                  <td className="num">{Number(p.gst).toFixed(2)}%</td>
                  <td className="num">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

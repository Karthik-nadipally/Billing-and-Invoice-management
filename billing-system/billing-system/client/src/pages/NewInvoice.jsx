import { useEffect, useMemo, useState } from "react";
import { BASE, api } from "../api.js";
import { inr, StatusBadge, useFlash } from "../utils.jsx";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function NewInvoice() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [flash, show] = useFlash();

  const load = async () => {
    try {
      const [c, p] = await Promise.all([api.get("/customers"), api.get("/products")]);
      c.sort((a, b) => a.name.localeCompare(b.name));
      const inStock = p.filter((x) => x.stock > 0).sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(c);
      setProducts(inStock);
      setCustomerId((cur) => cur || (c[0] ? String(c[0].id) : ""));
      setProductId((cur) => (inStock.some((x) => String(x.id) === cur) ? cur : inStock[0] ? String(inStock[0].id) : ""));
    } catch (e) {
      show(e.message, true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addProduct = () => {
    const quantity = Number(qty);
    if (!productId) return show("Please select a product.", true);
    if (!Number.isInteger(quantity)) return show("Quantity must be a whole number.", true);
    if (quantity <= 0) return show("Quantity must be greater than zero.", true);

    const p = products.find((x) => String(x.id) === productId);
    if (!p) return;
    const existing = items.find((i) => i.product_id === p.id);
    const newQty = (existing ? existing.quantity : 0) + quantity;
    if (newQty > p.stock) return show(`Only ${p.stock} units of ${p.name} are available.`, true);

    if (existing) {
      setItems(items.map((i) => (i.product_id === p.id ? { ...i, quantity: newQty } : i)));
    } else {
      setItems([...items, { product_id: p.id, name: p.name, price: p.price, gst: p.gst, quantity }]);
    }
    setQty("");
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let gst = 0;
    items.forEach((i) => {
      const base = i.price * i.quantity;
      subtotal += base;
      gst += (base * i.gst) / 100;
    });
    subtotal = round2(subtotal);
    gst = round2(gst);
    let disc = Number(discount) || 0;
    disc = Math.max(0, Math.min(disc, subtotal));
    const total = round2(subtotal - disc + gst);
    let amountPaid = Number(paid) || 0;
    amountPaid = Math.max(0, Math.min(amountPaid, total));
    const status = amountPaid <= 0 ? "Pending" : amountPaid >= total ? "Paid" : "Partial";
    return { subtotal, gst, disc, total, amountPaid, due: round2(total - amountPaid), status };
  }, [items, discount, paid]);

  const save = async () => {
    if (!customerId) return show("Please select a customer.", true);
    if (!items.length) return show("Please add at least one product.", true);
    setSaving(true);
    try {
      const res = await api.post("/invoices", {
        customer_id: Number(customerId),
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        discount: totals.disc,
        amount_paid: totals.amountPaid,
        payment_method: method,
      });
      setSaved({ id: res.id, number: res.invoice_number, total: totals.total });
      setItems([]);
      setDiscount("");
      setPaid("");
      load(); // refresh stock
    } catch (e) {
      show(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="page-title">Create New Invoice</h1>
      {flash}

      {saved && (
        <div className="flash ok">
          Invoice {saved.number} saved successfully! Total: {inr(saved.total)} ·{" "}
          <a href={`${BASE}/invoices/${saved.id}/pdf`} target="_blank" rel="noreferrer">
            Open PDF
          </a>
        </div>
      )}

      <div className="card">
        <div className="form-row">
          <label>Customer:</label>
          <select className="grow" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.length === 0 && <option value="">No customers — add one first</option>}
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `- ${c.phone}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Product:</label>
          <select className="grow" value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.length === 0 && <option value="">No products in stock</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {inr(p.price)} - Stock: {p.stock}
              </option>
            ))}
          </select>
          <label>Quantity:</label>
          <input
            type="number"
            min="1"
            style={{ width: 90 }}
            placeholder="Qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addProduct()}
          />
          <button className="btn" onClick={addProduct}>Add Product</button>
        </div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th><th className="num">Quantity</th><th className="num">Price</th>
              <th className="num">GST %</th><th className="num">GST Amount</th><th className="num">Total</th><th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={7} className="empty">No items added yet.</td></tr>}
            {items.map((i, idx) => {
              const base = i.price * i.quantity;
              const g = (base * i.gst) / 100;
              return (
                <tr key={i.product_id}>
                  <td>{i.name}</td>
                  <td className="num">{i.quantity}</td>
                  <td className="num">{inr(i.price)}</td>
                  <td className="num">{Number(i.gst).toFixed(2)}%</td>
                  <td className="num">{inr(g)}</td>
                  <td className="num">{inr(base + g)}</td>
                  <td>
                    <button className="btn small danger" onClick={() => setItems(items.filter((_, k) => k !== idx))}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="totals">
          <div><span>Subtotal:</span><span>{inr(totals.subtotal)}</span></div>
          <div>
            <span>Discount:</span>
            <input
              type="number" min="0" style={{ width: 110, textAlign: "right" }} placeholder="0"
              value={discount} onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div><span>GST:</span><span>{inr(totals.gst)}</span></div>
          <div className="grand"><span>Grand Total:</span><span>{inr(totals.total)}</span></div>
        </div>
      </div>

      <div className="card">
        <div className="form-row">
          <label>Amount Paid:</label>
          <input
            type="number" min="0" style={{ width: 140 }} placeholder="0"
            value={paid} onChange={(e) => setPaid(e.target.value)}
          />
          <label>Method:</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {["Cash", "UPI", "Card", "Bank Transfer"].map((m) => <option key={m}>{m}</option>)}
          </select>
          <label>Status:</label>
          <StatusBadge status={totals.status} />
          <span className="muted">Due: {inr(totals.due)}</span>
          <button className="btn" style={{ marginLeft: "auto" }} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Invoice"}
          </button>
        </div>
      </div>
    </>
  );
}

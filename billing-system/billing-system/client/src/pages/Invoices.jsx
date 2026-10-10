import { useCallback, useEffect, useState } from "react";
import { BASE, api } from "../api.js";
import { fmtDate, fmtDateTime, inr, Modal, StatusBadge, useFlash } from "../utils.jsx";

function ViewModal({ id, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/invoices/${id}`).then(setData).catch(() => setData(false));
  }, [id]);

  if (data === false) return <Modal title="Invoice" onClose={onClose}>Could not load invoice.</Modal>;
  if (!data) return <Modal title="Invoice" onClose={onClose}>Loading…</Modal>;
  const { invoice: v, items } = data;

  return (
    <Modal title={v.invoice_number} onClose={onClose} wide>
      <p className="muted">Date: {fmtDateTime(v.created_at)}</p>
      <div className="card">
        <div><strong>Customer:</strong> {v.customer_name || "-"}</div>
        <div><strong>Phone:</strong> {v.customer_phone || "-"}</div>
        <div><strong>Email:</strong> {v.customer_email || "-"}</div>
        <div><strong>Address:</strong> {v.customer_address || "-"}</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Product</th><th className="num">Qty</th><th className="num">Price</th><th className="num">GST</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.product_name || "Deleted Product"}</td>
                <td className="num">{i.quantity}</td>
                <td className="num">{inr(i.price)}</td>
                <td className="num">{Number(i.gst).toFixed(2)}%</td>
                <td className="num">{inr(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="totals" style={{ marginTop: 14 }}>
        <div><span>Subtotal</span><span>{inr(v.subtotal)}</span></div>
        <div><span>Discount</span><span>{inr(v.discount)}</span></div>
        <div><span>GST</span><span>{inr(v.gst_amount)}</span></div>
        <div className="grand"><span>Grand Total</span><span>{inr(v.total)}</span></div>
        <div><span>Amount Paid</span><span>{inr(v.amount_paid)}</span></div>
        <div><span>Amount Due</span><span>{inr(v.amount_due)}</span></div>
        <div><span>Status</span><StatusBadge status={v.payment_status} /></div>
      </div>
    </Modal>
  );
}

function HistoryModal({ id, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/invoices/${id}`).then(setData).catch(() => setData(false));
  }, [id]);

  if (data === false) return <Modal title="Payment History" onClose={onClose}>Could not load.</Modal>;
  if (!data) return <Modal title="Payment History" onClose={onClose}>Loading…</Modal>;
  const { invoice: v, payments } = data;
  const sum = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <Modal title={`Payment History - ${v.invoice_number}`} onClose={onClose} wide>
      <div className="card">
        <div className="kv"><span>Grand Total</span><strong>{inr(v.total)}</strong></div>
        <div className="kv"><span>Total Paid</span><strong>{inr(v.amount_paid)}</strong></div>
        <div className="kv"><span>Amount Due</span><strong>{inr(v.amount_due)}</strong></div>
        <div className="kv"><span>Status</span><StatusBadge status={v.payment_status} /></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Payment Date</th><th className="num">Amount</th><th>Method</th></tr>
          </thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={4} className="empty">No payment records found.</td></tr>}
            {payments.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td>{fmtDateTime(p.payment_date)}</td>
                <td className="num">{inr(p.amount)}</td>
                <td>{p.payment_method || "Cash"}</td>
              </tr>
            ))}
            {payments.length > 0 && (
              <tr>
                <td colSpan={2}><strong>TOTAL</strong></td>
                <td className="num"><strong>{inr(sum)}</strong></td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function PayModal({ invoice, onClose, onDone, show }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const due = Number(invoice.amount_due);

  if (due <= 0)
    return (
      <Modal title="Payment Complete" onClose={onClose}>
        Invoice {invoice.invoice_number} is already fully paid.
      </Modal>
    );

  const submit = async () => {
    const value = Number(amount);
    if (!amount.trim()) return setError("Please enter a payment amount.");
    if (isNaN(value)) return setError("Please enter a valid number.");
    if (value <= 0) return setError("Payment amount must be greater than zero.");
    if (value > due) return setError(`Maximum payment allowed is ${inr(due)}.`);
    setBusy(true);
    try {
      await api.post(`/invoices/${invoice.id}/payments`, { amount: value, payment_method: method });
      show(`Payment of ${inr(value)} recorded successfully.`);
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <div className="kv"><span>Invoice</span><strong>{invoice.invoice_number}</strong></div>
      <div className="kv"><span>Grand Total</span><strong>{inr(invoice.total)}</strong></div>
      <div className="kv"><span>Already Paid</span><strong>{inr(invoice.amount_paid)}</strong></div>
      <div className="kv"><span>Amount Due</span><strong>{inr(due)}</strong></div>
      {error && <div className="flash error" style={{ marginTop: 12 }}>{error}</div>}
      <div className="field" style={{ marginTop: 14 }}>
        <label>Payment Amount</label>
        <input type="number" min="0" autoFocus placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="field">
        <label>Payment Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          {["Cash", "UPI", "Card", "Bank Transfer"].map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div className="form-row">
        <button className="btn" onClick={submit} disabled={busy}>Record Payment</button>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export default function Invoices() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modal, setModal] = useState(null); // {type, id|invoice}
  const [flash, show] = useFlash();

  const load = useCallback(
    async (f = { search, status, from, to }) => {
      const p = new URLSearchParams();
      if (f.search) p.set("q", f.search);
      if (f.status && f.status !== "All") p.set("status", f.status);
      if (f.from) p.set("from", f.from);
      if (f.to) p.set("to", f.to);
      try {
        setRows(await api.get(`/invoices?${p}`));
      } catch (e) {
        show(e.message, true);
      }
    },
    [search, status, from, to, show]
  );

  // Reload whenever a filter changes
  useEffect(() => {
    load();
  }, [load]);

  const clear = () => {
    setSearch("");
    setStatus("All");
    setFrom("");
    setTo("");
  };

  const remove = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}?\n\nThis also deletes its items and payments, and returns the stock.`)) return;
    try {
      await api.del(`/invoices/${inv.id}`);
      show("Invoice deleted successfully.");
      load();
    } catch (e) {
      show(e.message, true);
    }
  };

  return (
    <>
      <h1 className="page-title">Invoice History</h1>
      {flash}

      <div className="card">
        <div className="form-row">
          <input className="grow" placeholder="Search invoice number or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["All", "Paid", "Pending", "Partial"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className="muted">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="muted">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn" onClick={() => load()}>Refresh</button>
          <button className="btn secondary" onClick={clear}>Clear</button>
        </div>
      </div>

      <p className="muted">Showing {rows.length} invoices</p>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice No.</th><th>Customer</th><th>Date</th>
              <th className="num">Total</th><th className="num">Paid</th><th className="num">Due</th>
              <th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="empty"><strong>No invoices found</strong><br />Try changing your search or filters.</td></tr>
            )}
            {rows.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoice_number}</td>
                <td>{inv.customer_name || "Unknown"}</td>
                <td>{fmtDate(inv.created_at)}</td>
                <td className="num">{inr(inv.total)}</td>
                <td className="num">{inr(inv.amount_paid)}</td>
                <td className="num">{inr(inv.amount_due)}</td>
                <td><StatusBadge status={inv.payment_status} /></td>
                <td>
                  <div className="actions">
                    <button className="btn small" onClick={() => setModal({ type: "view", id: inv.id })}>View</button>
                    <a className="btn small" href={`${BASE}/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">PDF</a>
                    <button className="btn small" onClick={() => setModal({ type: "pay", invoice: inv })}>Pay</button>
                    <button className="btn small" onClick={() => setModal({ type: "history", id: inv.id })}>History</button>
                    <button className="btn small danger" onClick={() => remove(inv)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.type === "view" && <ViewModal id={modal.id} onClose={() => setModal(null)} />}
      {modal?.type === "history" && <HistoryModal id={modal.id} onClose={() => setModal(null)} />}
      {modal?.type === "pay" && (
        <PayModal
          invoice={modal.invoice}
          show={show}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </>
  );
}

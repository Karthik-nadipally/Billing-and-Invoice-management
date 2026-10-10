import { useCallback, useEffect, useState } from "react";
import { BASE, api } from "../api.js";
import { fmtDate, inr, isoDate, StatusBadge, useFlash } from "../utils.jsx";

export default function Reports() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [from, setFrom] = useState(isoDate(firstOfMonth));
  const [to, setTo] = useState(isoDate(today));
  const [data, setData] = useState(null);
  const [flash, show] = useFlash();

  const generate = useCallback(
    async (f = from, t = to) => {
      if (!f || !t) return show("Please choose both dates.", true);
      if (f > t) return show("From date cannot be after To date.", true);
      try {
        setData(await api.get(`/reports?from=${f}&to=${t}`));
      } catch (e) {
        show(e.message, true);
      }
    },
    [from, to, show]
  );

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRange = (f, t) => {
    setFrom(f);
    setTo(t);
    generate(f, t);
  };

  const exportPdf = () => {
    if (!data || data.invoices.length === 0)
      return show("There are no invoices in the selected date range.", true);
    window.open(`${BASE}/reports/pdf?from=${from}&to=${to}`, "_blank");
  };

  const s = data?.summary;

  return (
    <>
      <h1 className="page-title">Sales Reports</h1>
      {flash}

      <div className="card">
        <div className="form-row">
          <label>From:</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label>To:</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn" onClick={() => generate()}>Generate Report</button>
          <button className="btn secondary" onClick={() => setRange(isoDate(), isoDate())}>Today</button>
          <button className="btn secondary" onClick={() => setRange(isoDate(firstOfMonth), isoDate())}>This Month</button>
          <button className="btn" onClick={exportPdf}>Export PDF</button>
        </div>
      </div>

      <div className="cards">
        <div className="stat"><div className="label">Total Sales</div><div className="value">{inr(s?.sales)}</div></div>
        <div className="stat"><div className="label">Amount Paid</div><div className="value">{inr(s?.paid)}</div></div>
        <div className="stat"><div className="label">Amount Due</div><div className="value">{inr(s?.due)}</div></div>
        <div className="stat"><div className="label">Invoices</div><div className="value">{s?.invoices ?? 0}</div></div>
      </div>

      <div className="card">
        <h3>Invoice Report</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th><th>Customer</th><th>Date</th>
                <th className="num">Total</th><th className="num">Paid</th><th className="num">Due</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!data || data.invoices.length === 0) && (
                <tr><td colSpan={7} className="empty">No invoices found for this date range.</td></tr>
              )}
              {data?.invoices.map((i) => (
                <tr key={i.invoice_number}>
                  <td>{i.invoice_number}</td>
                  <td>{i.customer_name || "Unknown"}</td>
                  <td>{fmtDate(i.created_at)}</td>
                  <td className="num">{inr(i.total)}</td>
                  <td className="num">{inr(i.amount_paid)}</td>
                  <td className="num">{inr(i.amount_due)}</td>
                  <td><StatusBadge status={i.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

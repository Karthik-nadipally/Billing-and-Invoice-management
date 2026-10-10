import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { inr, StatusBadge } from "../utils.jsx";

function SalesChart({ data }) {
  if (!data.length) return <div className="empty">No sales data available yet.</div>;

  const W = 520, H = 260, P = { l: 56, r: 16, t: 16, b: 48 };
  const max = Math.max(...data.map((d) => Number(d.total)), 1);
  const x = (i) => P.l + (data.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (data.length - 1));
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);
  const points = data.map((d, i) => `${x(i)},${y(Number(d.total))}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(max * t)} y2={y(max * t)} stroke="#e5e7eb" />
          <text x={P.l - 8} y={y(max * t) + 4} fontSize="10" textAnchor="end" fill="#6b7280">
            {Math.round(max * t).toLocaleString("en-IN")}
          </text>
        </g>
      ))}
      <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      {data.map((d, i) => (
        <g key={d.month}>
          <circle cx={x(i)} cy={y(Number(d.total))} r="4" fill="#2563eb">
            <title>{`${d.month}: ${inr(d.total)}`}</title>
          </circle>
          <text
            x={x(i)}
            y={H - P.b + 16}
            fontSize="10"
            fill="#6b7280"
            textAnchor="end"
            transform={`rotate(-35 ${x(i)} ${H - P.b + 16})`}
          >
            {d.month}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setD(await api.get("/dashboard"));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <>
        <h1 className="page-title">Dashboard</h1>
        <div className="flash error">
          {error} — check that the database is configured and initialised.
        </div>
        <button className="btn" onClick={load}>Retry</button>
      </>
    );
  if (!d) return <p className="muted">Loading…</p>;

  const stats = [
    ["Total Sales", inr(d.totalSales)],
    ["Total Invoices", d.totalInvoices],
    ["Amount Paid", inr(d.totalPaid)],
    ["Amount Due", inr(d.totalDue)],
    ["Total Customers", d.totalCustomers],
    ["Total Products", d.totalProducts],
  ];

  return (
    <>
      <h1 className="page-title">Dashboard</h1>

      <div className="cards">
        {stats.map(([label, value]) => (
          <div className="stat" key={label}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Monthly Sales</h3>
          <SalesChart data={d.monthly} />
        </div>

        <div>
          <div className="card">
            <h3>Top Selling Products</h3>
            {d.topProducts.length === 0 && <div className="muted">No product sales yet.</div>}
            {d.topProducts.map((p, i) => (
              <div className="list-item" key={p.name}>
                {i + 1}. {p.name} — {p.qty} sold
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Recent Invoices</h3>
            {d.recent.length === 0 && <div className="muted">No invoices yet.</div>}
            {d.recent.map((inv) => (
              <div className="list-item" key={inv.id}>
                <strong>{inv.invoice_number}</strong>
                <div>
                  {inv.customer_name || "Unknown"} · {inr(inv.total)} <StatusBadge status={inv.payment_status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="btn" onClick={load}>Refresh Dashboard</button>
    </>
  );
}

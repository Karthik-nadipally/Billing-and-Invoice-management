import { useCallback, useEffect, useState } from "react";

export const inr = (n) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtDate = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return isNaN(x) ? String(d) : x.toLocaleDateString("en-GB");
};

export const fmtDateTime = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return isNaN(x) ? String(d) : x.toLocaleString("en-GB");
};

// yyyy-mm-dd in local time
export const isoDate = (d = new Date()) => {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

// Small flash-message hook: const [flash, show] = useFlash(); show("Saved"); show("Oops", true)
export function useFlash() {
  const [msg, setMsg] = useState(null);
  const show = useCallback((text, isError = false) => setMsg({ text, isError }), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div className={`flash ${msg.isError ? "error" : "ok"}`}>{msg.text}</div>
  ) : null;
  return [node, show];
}

export function StatusBadge({ status }) {
  return <span className={`badge ${String(status).toLowerCase()}`}>{status}</span>;
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

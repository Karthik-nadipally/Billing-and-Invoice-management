import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Customers from "./pages/Customers.jsx";
import Products from "./pages/Products.jsx";
import NewInvoice from "./pages/NewInvoice.jsx";
import Invoices from "./pages/Invoices.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";

const links = [
  ["/", "Dashboard"],
  ["/customers", "Customers"],
  ["/products", "Products"],
  ["/invoices/new", "New Invoice"],
  ["/invoices", "Invoices"],
  ["/reports", "Reports"],
  ["/settings", "Settings"],
];

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>BILLING SYSTEM</h1>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? "active" : "")}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/products" element={<Products />} />
          <Route path="/invoices/new" element={<NewInvoice />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

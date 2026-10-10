const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  const [[c]] = await db.query("SELECT COUNT(*) AS n FROM customers");
  const [[p]] = await db.query("SELECT COUNT(*) AS n FROM products");
  const [[s]] = await db.query(
    `SELECT COUNT(*) AS invoices,
            COALESCE(SUM(total), 0) AS sales,
            COALESCE(SUM(amount_paid), 0) AS paid,
            COALESCE(SUM(amount_due), 0) AS due
       FROM invoices`
  );

  const [monthly] = await db.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total) AS total
       FROM invoices
      GROUP BY month
      ORDER BY month`
  );

  const [topProducts] = await db.query(
    `SELECT p.name, SUM(ii.quantity) AS qty
       FROM invoice_items ii
       JOIN products p ON p.id = ii.product_id
      GROUP BY ii.product_id, p.name
      ORDER BY qty DESC
      LIMIT 5`
  );

  const [recent] = await db.query(
    `SELECT i.id, i.invoice_number, i.total, i.payment_status, c.name AS customer_name
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
      ORDER BY i.id DESC LIMIT 5`
  );

  res.json({
    totalSales: s.sales,
    totalInvoices: s.invoices,
    totalPaid: s.paid,
    totalDue: s.due,
    totalCustomers: c.n,
    totalProducts: p.n,
    monthly,
    topProducts,
    recent,
  });
});

module.exports = router;

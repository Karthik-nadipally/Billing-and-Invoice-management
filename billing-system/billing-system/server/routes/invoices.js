const express = require("express");
const PDFDocument = require("pdfkit");
const db = require("../db");

const router = express.Router();

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function statusFor(total, paid) {
  if (paid <= 0) return "Pending";
  if (paid >= total) return "Paid";
  return "Partial";
}

// List invoices (filters: q, status, from, to)
router.get("/", async (req, res) => {
  const { q, status, from, to } = req.query;
  let sql = `SELECT i.*, c.name AS customer_name
               FROM invoices i
               LEFT JOIN customers c ON c.id = i.customer_id
              WHERE 1=1`;
  const params = [];

  if (q && q.trim()) {
    sql += " AND (i.invoice_number LIKE ? OR c.name LIKE ?)";
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }
  if (status && status !== "All") {
    sql += " AND i.payment_status = ?";
    params.push(status);
  }
  if (from) {
    sql += " AND DATE(i.created_at) >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND DATE(i.created_at) <= ?";
    params.push(to);
  }
  sql += " ORDER BY i.id DESC";

  const [rows] = await db.query(sql, params);
  res.json(rows);
});

// Single invoice with items and payments
router.get("/:id", async (req, res) => {
  const data = await loadInvoice(req.params.id);
  if (!data) return res.status(404).json({ error: "Invoice not found" });
  res.json(data);
});

async function loadInvoice(id) {
  const [[invoice]] = await db.query(
    `SELECT i.*, c.name AS customer_name, c.phone AS customer_phone,
            c.email AS customer_email, c.address AS customer_address
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
      WHERE i.id = ?`,
    [id]
  );
  if (!invoice) return null;
  const [items] = await db.query(
    `SELECT ii.*, p.name AS product_name
       FROM invoice_items ii LEFT JOIN products p ON p.id = ii.product_id
      WHERE ii.invoice_id = ?`,
    [id]
  );
  const [payments] = await db.query(
    "SELECT * FROM payments WHERE invoice_id = ? ORDER BY id",
    [id]
  );
  return { invoice, items, payments };
}

// Create invoice (transaction: validates stock, deducts it, records first payment)
router.post("/", async (req, res) => {
  const { customer_id, items, discount, amount_paid, payment_method } = req.body;

  if (!customer_id) return res.status(400).json({ error: "Please select a customer" });
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "Please add at least one product" });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let subtotal = 0;
    let gstTotal = 0;
    const lines = [];

    for (const it of items) {
      const qty = parseInt(it.quantity);
      if (!it.product_id || !qty || qty < 1) throw new Error("Invalid item or quantity");

      const [[p]] = await conn.query("SELECT * FROM products WHERE id = ? FOR UPDATE", [
        it.product_id,
      ]);
      if (!p) throw new Error("Product not found");
      if (p.stock < qty) throw new Error(`Not enough stock for "${p.name}" (available: ${p.stock})`);

      const lineSub = round2(p.price * qty);
      const lineGst = round2((lineSub * p.gst) / 100);
      subtotal += lineSub;
      gstTotal += lineGst;
      lines.push({ p, qty, lineTotal: round2(lineSub + lineGst) });
    }

    subtotal = round2(subtotal);
    gstTotal = round2(gstTotal);
    const disc = Math.min(round2(discount || 0), subtotal);
    const total = round2(subtotal - disc + gstTotal);
    const paid = Math.min(round2(amount_paid || 0), total);
    const due = round2(total - paid);

    const tempNumber = `TMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [inv] = await conn.query(
      `INSERT INTO invoices
         (invoice_number, customer_id, subtotal, discount, gst_amount, total,
          amount_paid, amount_due, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tempNumber, customer_id || null, subtotal, disc, gstTotal, total, paid, due,
       statusFor(total, paid)]
    );
    const invoiceId = inv.insertId;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceId).padStart(4, "0")}`;
    await conn.query("UPDATE invoices SET invoice_number = ? WHERE id = ?", [
      invoiceNumber,
      invoiceId,
    ]);

    for (const l of lines) {
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, product_id, quantity, price, gst, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoiceId, l.p.id, l.qty, l.p.price, l.p.gst, l.lineTotal]
      );
      await conn.query("UPDATE products SET stock = stock - ? WHERE id = ?", [l.qty, l.p.id]);
    }

    if (paid > 0) {
      await conn.query(
        "INSERT INTO payments (invoice_id, amount, payment_method) VALUES (?, ?, ?)",
        [invoiceId, paid, payment_method || "Cash"]
      );
    }

    await conn.commit();
    res.status(201).json({ id: invoiceId, invoice_number: invoiceNumber });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Record a payment against an invoice
router.post("/:id/payments", async (req, res) => {
  const amount = round2(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: "Enter a valid amount" });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[inv]] = await conn.query("SELECT * FROM invoices WHERE id = ? FOR UPDATE", [
      req.params.id,
    ]);
    if (!inv) throw new Error("Invoice not found");
    if (amount > inv.amount_due)
      throw new Error(`Amount exceeds due balance (${inv.amount_due.toFixed(2)})`);

    const paid = round2(inv.amount_paid + amount);
    const due = round2(inv.total - paid);
    await conn.query(
      "UPDATE invoices SET amount_paid=?, amount_due=?, payment_status=? WHERE id=?",
      [paid, due, statusFor(inv.total, paid), inv.id]
    );
    await conn.query(
      "INSERT INTO payments (invoice_id, amount, payment_method) VALUES (?, ?, ?)",
      [inv.id, amount, req.body.payment_method || "Cash"]
    );
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Delete invoice and restore stock
router.delete("/:id", async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query("SELECT * FROM invoice_items WHERE invoice_id = ?", [
      req.params.id,
    ]);
    for (const it of items) {
      if (it.product_id)
        await conn.query("UPDATE products SET stock = stock + ? WHERE id = ?", [
          it.quantity,
          it.product_id,
        ]);
    }
    await conn.query("DELETE FROM invoices WHERE id = ?", [req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PDF invoice
router.get("/:id/pdf", async (req, res) => {
  const data = await loadInvoice(req.params.id);
  if (!data) return res.status(404).json({ error: "Invoice not found" });
  const { invoice, items } = data;
  const [[s]] = await db.query("SELECT * FROM settings WHERE id = 1");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${invoice.invoice_number}.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(20).text((s && s.company_name) || "Invoice", { align: "left" });
  doc.fontSize(10).fillColor("#555");
  if (s?.address) doc.text(s.address);
  if (s?.phone) doc.text(`Phone: ${s.phone}`);
  if (s?.email) doc.text(`Email: ${s.email}`);
  if (s?.gst_number) doc.text(`GSTIN: ${s.gst_number}`);

  doc.moveDown().fillColor("#000").fontSize(16).text("TAX INVOICE", { align: "right" });
  doc.fontSize(10)
    .text(`Invoice No: ${invoice.invoice_number}`, { align: "right" })
    .text(`Date: ${new Date(invoice.created_at).toLocaleDateString("en-IN")}`, { align: "right" })
    .text(`Status: ${invoice.payment_status}`, { align: "right" });

  doc.moveDown().fontSize(11).text("Bill To:", { underline: true });
  doc.fontSize(10).text(invoice.customer_name || "Walk-in customer");
  if (invoice.customer_phone) doc.text(invoice.customer_phone);
  if (invoice.customer_address) doc.text(invoice.customer_address);

  // Items table
  doc.moveDown();
  const cols = [50, 260, 310, 380, 430, 490];
  let y = doc.y;
  doc.font("Helvetica-Bold").fontSize(10);
  ["Item", "Qty", "Price", "GST %", "Total"].forEach((h, i) => doc.text(h, cols[i], y));
  doc.font("Helvetica");
  y += 18;
  doc.moveTo(50, y - 4).lineTo(550, y - 4).stroke();

  items.forEach((it) => {
    if (y > 700) { doc.addPage(); y = 50; }
    doc.text(it.product_name || "Item", cols[0], y, { width: 200 });
    doc.text(String(it.quantity), cols[1], y);
    doc.text(it.price.toFixed(2), cols[2], y);
    doc.text(String(it.gst), cols[3], y);
    doc.text(it.total.toFixed(2), cols[4], y);
    y += 18;
  });

  y += 10;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  y += 10;
  const row = (label, val, bold) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica");
    doc.text(label, 340, y);
    doc.text(val, 460, y, { width: 90, align: "right" });
    y += 16;
  };
  row("Subtotal", invoice.subtotal.toFixed(2));
  row("Discount", `- ${invoice.discount.toFixed(2)}`);
  row("GST", invoice.gst_amount.toFixed(2));
  row("Total", invoice.total.toFixed(2), true);
  row("Paid", invoice.amount_paid.toFixed(2));
  row("Balance Due", invoice.amount_due.toFixed(2), true);

  doc.font("Helvetica").fontSize(9).fillColor("#777").text("Thank you for your business!", 50, 740, {
    align: "center",
  });
  doc.end();
});

module.exports = router;

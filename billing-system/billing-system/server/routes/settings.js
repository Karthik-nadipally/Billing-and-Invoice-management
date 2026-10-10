const express = require("express");
const db = require("../db");

const router = express.Router();

// Order matters for restore: parents before children
const TABLES = ["customers", "products", "settings", "invoices", "invoice_items", "payments"];

router.get("/", async (req, res) => {
  const [[row]] = await db.query("SELECT * FROM settings WHERE id = 1");
  res.json(
    row || { company_name: "", address: "", phone: "", email: "", gst_number: "", tax_rate: 0 }
  );
});

router.put("/", async (req, res) => {
  const { company_name, address, phone, email, gst_number, tax_rate } = req.body;

  if (!company_name || !company_name.trim())
    return res.status(400).json({ error: "Please enter your company name" });

  const tax = tax_rate === "" || tax_rate == null ? 0 : Number(tax_rate);
  if (isNaN(tax) || tax < 0 || tax > 100)
    return res.status(400).json({ error: "Tax rate must be between 0 and 100" });

  await db.query(
    `INSERT INTO settings (id, company_name, address, phone, email, gst_number, tax_rate)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE company_name=VALUES(company_name), address=VALUES(address),
       phone=VALUES(phone), email=VALUES(email), gst_number=VALUES(gst_number),
       tax_rate=VALUES(tax_rate)`,
    [company_name.trim(), address || "", phone || "", email || "", gst_number || "", tax]
  );
  res.json({ ok: true });
});

// Backup: download every table as one JSON file
router.get("/backup", async (req, res) => {
  const data = {};
  for (const t of TABLES) {
    const [rows] = await db.query(`SELECT * FROM ${t}`);
    data[t] = rows;
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="Billing_Backup.json"');
  res.send(JSON.stringify({ version: 1, created_at: new Date().toISOString(), data }));
});

// Restore: replace all data with the contents of a backup file
router.post("/restore", async (req, res) => {
  const backup = req.body && req.body.data;
  if (!backup || !TABLES.every((t) => Array.isArray(backup[t])))
    return res.status(400).json({ error: "This is not a valid backup file" });

  const conn = await db.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.beginTransaction();

    for (const t of [...TABLES].reverse()) await conn.query(`DELETE FROM ${t}`);

    for (const t of TABLES) {
      for (const row of backup[t]) {
        const cols = Object.keys(row);
        if (!cols.length) continue;
        // Only allow plain column names
        if (!cols.every((c) => /^[a-z_]+$/.test(c))) throw new Error("Invalid column in backup");
        const values = cols.map((c) => {
          const v = row[c];
          // ISO timestamps -> MySQL DATETIME
          return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)
            ? v.replace("T", " ").replace(/\.\d+Z$/, "").replace("Z", "")
            : v;
        });
        await conn.query(
          `INSERT INTO ${t} (${cols.map((c) => `\`${c}\``).join(",")}) VALUES (${cols
            .map(() => "?")
            .join(",")})`,
          values
        );
      }
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: `Restore failed: ${err.message}` });
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
    conn.release();
  }
});

module.exports = router;

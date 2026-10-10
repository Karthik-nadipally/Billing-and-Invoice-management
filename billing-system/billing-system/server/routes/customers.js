const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  const [rows] = await db.query("SELECT * FROM customers ORDER BY id DESC");
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { name, phone, email, address } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  const [r] = await db.query(
    "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
    [name.trim(), phone || null, email || null, address || null]
  );
  res.status(201).json({ id: r.insertId });
});

router.put("/:id", async (req, res) => {
  const { name, phone, email, address } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  await db.query(
    "UPDATE customers SET name=?, phone=?, email=?, address=? WHERE id=?",
    [name.trim(), phone || null, email || null, address || null, req.params.id]
  );
  res.json({ ok: true });
});

router.delete("/:id", async (req, res) => {
  await db.query("DELETE FROM customers WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;

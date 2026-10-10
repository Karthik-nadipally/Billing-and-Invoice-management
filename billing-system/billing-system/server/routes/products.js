const express = require("express");
const db = require("../db");

const router = express.Router();

function validate(b) {
  if (!b.name || !b.name.trim()) return "Name is required";
  if (b.price === "" || b.price == null || isNaN(Number(b.price)) || Number(b.price) < 0)
    return "A valid price is required";
  return null;
}

router.get("/", async (req, res) => {
  const [rows] = await db.query("SELECT * FROM products ORDER BY id DESC");
  res.json(rows);
});

router.post("/", async (req, res) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });
  const { name, price, gst, stock } = req.body;
  const [r] = await db.query(
    "INSERT INTO products (name, price, gst, stock) VALUES (?, ?, ?, ?)",
    [name.trim(), Number(price), Number(gst) || 0, parseInt(stock) || 0]
  );
  res.status(201).json({ id: r.insertId });
});

router.put("/:id", async (req, res) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });
  const { name, price, gst, stock } = req.body;
  await db.query("UPDATE products SET name=?, price=?, gst=?, stock=? WHERE id=?", [
    name.trim(),
    Number(price),
    Number(gst) || 0,
    parseInt(stock) || 0,
    req.params.id,
  ]);
  res.json({ ok: true });
});

router.delete("/:id", async (req, res) => {
  await db.query("DELETE FROM products WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;

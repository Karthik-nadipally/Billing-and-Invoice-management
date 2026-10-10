// Local development entry point. On Vercel, api/index.js is used instead.
const app = require("./app");

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

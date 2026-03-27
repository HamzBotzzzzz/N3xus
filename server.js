import app from './api/index.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   WhatsApp Bug System - Server Ready  ║
╠═══════════════════════════════════════╣
║   Port: ${PORT}                           ║
║   URL:  http://localhost:${PORT}             ║
╚═══════════════════════════════════════╝
  `);
});

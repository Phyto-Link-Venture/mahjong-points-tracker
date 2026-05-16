require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '4mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/players', require('./routes/players'));
app.use('/api/watch', require('./routes/watch'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/ai', require('./routes/ai'));
app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Mahjong backend :${PORT}`));

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'wq-bot-secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '5533422';

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'game.sqlite'));
db.pragma('journal_mode = WAL');

const createTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_admin INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      skin_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      UNIQUE(user_id, skin_id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    db.prepare('INSERT INTO users (username, password_hash, balance, is_admin) VALUES (?, ?, ?, ?)')
      .run('admin', bcrypt.hashSync('admin123', 10), 10000, 1);
  }
};

createTables();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const getUser = (userId) => db.prepare(`
  SELECT id, username, balance, is_admin
  FROM users
  WHERE id = ?
`).get(userId);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'online' });
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || username.trim().length < 3 || password.length < 3) {
    return res.status(400).json({ error: 'Username and password must be at least 3 chars.' });
  }

  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    const row = db.prepare('INSERT INTO users (username, password_hash, balance) VALUES (?, ?, ?)')
      .run(username.trim(), passwordHash, 100);

    const user = getUser(row.lastInsertRowid);
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: { id: user.id, username: user.username, balance: user.balance, is_admin: !!user.is_admin } });
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists.' });
    }
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, balance: user.balance, is_admin: !!user.is_admin } });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = getUser(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { id: user.id, username: user.username, balance: user.balance, is_admin: !!user.is_admin } });
});

app.get('/api/player', requireAuth, (req, res) => {
  const user = getUser(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const inventory = db.prepare('SELECT skin_id, quantity, level FROM inventory WHERE user_id = ? ORDER BY skin_id').all(req.user.id);
  res.json({
    user: { id: user.id, username: user.username, balance: user.balance, is_admin: !!user.is_admin },
    inventory
  });
});

app.get('/api/skins', (req, res) => {
  const skins = [
    { id: 'purple-camo', name: 'Purple Camo', rarity: 'rare', price: 9 },
    { id: 'winter', name: 'Winter', rarity: 'common', price: 10 },
    { id: 'tiger', name: 'Tiger', rarity: 'rare', price: 11 },
    { id: 'nest', name: 'Nest', rarity: 'epic', price: 12 },
    { id: 'spark', name: 'Spark', rarity: 'epic', price: 13 },
    { id: 'beagle', name: 'Beagle', rarity: 'legendary', price: 18 },
    { id: 'neon', name: 'Neon', rarity: 'common', price: 14 },
    { id: 'arctic', name: 'Arctic', rarity: 'rare', price: 15 },
    { id: 'pro', name: 'Pro', rarity: 'rare', price: 16 },
    { id: 'carbon', name: 'Carbon', rarity: 'rare', price: 18 },
    { id: 'polar-night', name: 'Polar Night', rarity: 'epic', price: 22 },
    { id: 'rally', name: 'Rally', rarity: 'legendary', price: 30 }
  ];
  res.json({ skins });
});

app.post('/api/upgrade', requireAuth, (req, res) => {
  const { skinId, odds, multiplier, amount } = req.body || {};
  const chosenOdds = Number(odds || 30);
  const chosenMultiplier = Number(multiplier || 1);
  const spinCost = Number(amount || 10);

  const user = getUser(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.balance < spinCost) {
    return res.status(400).json({ error: 'Not enough balance.' });
  }

  const rng = Math.random() * 100;
  const success = rng <= chosenOdds;

  const updatedBalance = user.balance - spinCost + (success ? spinCost * chosenMultiplier : 0);
  db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(updatedBalance, user.id);

  const skin = db.prepare('SELECT * FROM inventory WHERE user_id = ? AND skin_id = ?').get(user.id, skinId);
  if (skin) {
    db.prepare('UPDATE inventory SET quantity = quantity + ?, level = level + 1 WHERE user_id = ? AND skin_id = ?')
      .run(success ? 1 : 0, user.id, skinId);
  } else if (success) {
    db.prepare('INSERT INTO inventory (user_id, skin_id, quantity, level) VALUES (?, ?, ?, ?)')
      .run(user.id, skinId, 1, 1);
  }

  db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
    .run(user.id, success ? 'upgrade_success' : 'upgrade_failed', JSON.stringify({ skinId, odds: chosenOdds, multiplier: chosenMultiplier, cost: spinCost }));

  const updatedUser = getUser(user.id);
  res.json({
    success,
    odds: chosenOdds,
    multiplier: chosenMultiplier,
    balance: updatedUser.balance,
    skinId,
    result: success ? `Upgrade success for ${skinId}` : 'Upgrade failed.'
  });
});

app.post('/api/buy-skin', requireAuth, (req, res) => {
  const { skinId } = req.body || {};
  const skinCatalog = [
    { id: 'purple-camo', price: 9 },
    { id: 'winter', price: 10 },
    { id: 'tiger', price: 11 },
    { id: 'nest', price: 12 },
    { id: 'spark', price: 13 },
    { id: 'beagle', price: 18 },
    { id: 'neon', price: 14 },
    { id: 'arctic', price: 15 },
    { id: 'pro', price: 16 },
    { id: 'carbon', price: 18 },
    { id: 'polar-night', price: 22 },
    { id: 'rally', price: 30 }
  ];

  const skin = skinCatalog.find(item => item.id === skinId);
  const user = getUser(req.user.id);
  if (!skin) return res.status(404).json({ error: 'Skin not found.' });
  if (user.balance < skin.price) return res.status(400).json({ error: 'Not enough balance.' });

  const newBalance = user.balance - skin.price;
  db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, user.id);

  const item = db.prepare('SELECT * FROM inventory WHERE user_id = ? AND skin_id = ?').get(user.id, skinId);
  if (item) {
    db.prepare('UPDATE inventory SET quantity = quantity + 1 WHERE user_id = ? AND skin_id = ?').run(user.id, skinId);
  } else {
    db.prepare('INSERT INTO inventory (user_id, skin_id, quantity, level) VALUES (?, ?, ?, ?)').run(user.id, skinId, 1, 1);
  }

  const updatedUser = getUser(user.id);
  res.json({ success: true, balance: updatedUser.balance, skinId });
});

app.post('/api/admin/grant-currency', requireAuth, (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { username, amount, password } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ error: 'Amount must be positive.' });
  }

  const updatedBalance = user.balance + value;
  db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(updatedBalance, user.id);
  db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
    .run(user.id, 'admin_grant', JSON.stringify({ amount: value, grantedBy: req.user.username }));

  res.json({ success: true, username, amount: value, balance: updatedBalance });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

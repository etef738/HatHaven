const express = require('express');
const app = express();
const port = process.env.MOCK_PORT || 4001;

app.use(express.json());

// Sample in-memory data
const users = [
  { id: 'user-1', email: 'alice@example.com', display_name: 'Alice', created_at: new Date().toISOString() },
  { id: 'user-2', email: 'bob@example.com', display_name: 'Bob', created_at: new Date().toISOString() }
];

const scenes = [
  { id: 'scene-1', title: 'First Scene', description: 'An intro scene', created_by: 'user-1', created_at: new Date().toISOString() }
];

const messages = [
  { id: 'msg-1', user_id: 'user-1', scene_id: 'scene-1', content: 'Hello world', created_at: new Date().toISOString() }
];

const coinBalances = [
  { user_id: 'user-1', balance: 100 },
  { user_id: 'user-2', balance: 50 }
];

// Auth
app.post('/auth/register', (req, res) => {
  const { email, password } = req.body;
  const id = `user-${users.length + 1}`;
  const user = { id, email, display_name: email.split('@')[0], created_at: new Date().toISOString() };
  users.push(user);
  res.status(201).json({ token: 'mock-jwt-token', user });
});

app.post('/auth/login', (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: 'mock-jwt-token', user });
});

// Users
app.get('/users/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// Scenes
app.post('/scenes', (req, res) => {
  const { title, description, created_by } = req.body;
  const scene = { id: `scene-${scenes.length + 1}`, title, description, created_by, created_at: new Date().toISOString() };
  scenes.push(scene);
  res.status(201).json(scene);
});

app.get('/scenes/:id', (req, res) => {
  const scene = scenes.find(s => s.id === req.params.id);
  if (!scene) return res.status(404).json({ error: 'Not found' });
  res.json(scene);
});

// Messages
app.post('/messages', (req, res) => {
  const { scene_id, content, user_id } = req.body;
  const msg = { id: `msg-${messages.length + 1}`, scene_id, content, user_id, created_at: new Date().toISOString() };
  messages.push(msg);
  res.status(201).json(msg);
});

// Coin balances
app.get('/coin_balances/:user_id', (req, res) => {
  const bal = coinBalances.find(b => b.user_id === req.params.user_id);
  if (!bal) return res.status(404).json({ error: 'Not found' });
  res.json(bal);
});

// Upload (mock)
app.post('/upload', (req, res) => {
  // This is a mock; in production you'd accept multipart/form-data and upload to Supabase Storage
  res.status(201).json({ url: 'https://cdn.example.com/mock-file.jpg', key: 'mock-file.jpg' });
});

app.listen(port, () => {
  console.log(`Mock server listening on http://localhost:${port}`);
});

module.exports = app;

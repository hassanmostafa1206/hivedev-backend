// ══════════════════════════════════════════════════════════════
//  HiveDev Backend — Node.js + Express + SQLite
//  بدون أي فلوس أو كارت بنكي
//  ارفعه على: Railway.app
// ══════════════════════════════════════════════════════════════

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── فتح/إنشاء قاعدة البيانات ───────────────────────────────────
const db = new Database(path.join(__dirname, 'hivedev.db'));
console.log('✅ SQLite database ready');

// ══════════════════════════════════════════════════════════════
//  إنشاء الجداول لو مش موجودة
// ══════════════════════════════════════════════════════════════
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL,
    tags        TEXT    DEFAULT '[]',
    type        TEXT    DEFAULT 'General',
    year        TEXT    DEFAULT '2024',
    duration    TEXT    DEFAULT 'N/A',
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS team (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    role  TEXT NOT NULL,
    bio   TEXT
  );

  CREATE TABLE IF NOT EXISTS services (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    number      TEXT,
    title       TEXT NOT NULL,
    description TEXT,
    tags        TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    type        TEXT DEFAULT 'Not specified',
    message     TEXT NOT NULL,
    received_at TEXT DEFAULT (datetime('now'))
  );
`);

// ══════════════════════════════════════════════════════════════
//  Seed البيانات الأولية لو الجداول فاضية
// ══════════════════════════════════════════════════════════════
function seedIfEmpty() {
  const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
  if (projectCount === 0) {
    const ins = db.prepare(
      'INSERT INTO projects (title,description,tags,type,year,duration) VALUES (@title,@description,@tags,@type,@year,@duration)'
    );
    db.transaction(() => {
      ins.run({ title:'NexaFlow SaaS',        description:'Full platform rebuild for a workflow automation startup. 3× faster load times.',    tags:JSON.stringify(['React','Node.js','PostgreSQL','AWS']),     type:'Website Development', year:'2024', duration:'4 months' });
      ins.run({ title:'Orbis Analytics',      description:'Real-time data dashboard for a financial analytics firm. 12 custom chart types.',  tags:JSON.stringify(['D3.js','WebSockets','Python','Redis']),    type:'Data Dashboard',       year:'2024', duration:'3 months' });
      ins.run({ title:'Pulse E-Commerce',     description:'High-volume e-commerce platform with custom CMS and multi-vendor support.',        tags:JSON.stringify(['Next.js','Stripe','MongoDB','Docker']),    type:'Website Development', year:'2023', duration:'6 months' });
      ins.run({ title:'Zephyr Landing',       description:'Launch campaign landing page. Winning A/B variant achieved 8.4% conversion.',     tags:JSON.stringify(['HTML','CSS','Analytics','CRO']),           type:'Landing Page',         year:'2023', duration:'3 weeks'  });
      ins.run({ title:'HRConnect Portal',     description:'Employee self-service HR portal for a 2,000-person enterprise with SSO.',          tags:JSON.stringify(['React','GraphQL','PostgreSQL','SAML']),    type:'Website Development', year:'2023', duration:'5 months' });
      ins.run({ title:'Beacon IoT Dashboard', description:'Real-time monitoring dashboard for industrial IoT sensors.',                       tags:JSON.stringify(['Vue.js','MQTT','InfluxDB','Chart.js']),    type:'Data Dashboard',       year:'2022', duration:'4 months' });
    })();
    console.log('🌱 Projects seeded');
  }

  const teamCount = db.prepare('SELECT COUNT(*) as c FROM team').get().c;
  if (teamCount === 0) {
    const ins = db.prepare('INSERT INTO team (name,role,bio) VALUES (@name,@role,@bio)');
    db.transaction(() => {
      ins.run({ name:'Alex Carter',  role:'Lead Architect',    bio:'Full-stack engineer with 10+ years building scalable web systems.' });
      ins.run({ name:'Mia Okafor',   role:'UX Engineer',        bio:'Design-obsessed frontend developer at the intersection of code and craft.' });
      ins.run({ name:'Dev Sharma',   role:'Backend Engineer',   bio:'API architect and database wizard. Former engineer at two YC startups.' });
      ins.run({ name:'Lena Park',    role:'Frontend Developer', bio:'Pixel-perfect CSS engineer with a background in graphic design.' });
      ins.run({ name:'Marco Silva',  role:'DevOps Engineer',    bio:'Infrastructure engineer obsessed with reliability and speed.' });
      ins.run({ name:'Sam Torres',   role:'Project Strategist', bio:'The bridge between business goals and technical solutions.' });
    })();
    console.log('🌱 Team seeded');
  }

  const serviceCount = db.prepare('SELECT COUNT(*) as c FROM services').get().c;
  if (serviceCount === 0) {
    const ins = db.prepare('INSERT INTO services (number,title,description,tags) VALUES (@number,@title,@description,@tags)');
    db.transaction(() => {
      ins.run({ number:'01', title:'Website Development', description:'From marketing sites to complex web apps, we engineer for scale.',      tags:JSON.stringify(['React / Next.js','Node.js','TypeScript','PostgreSQL','AWS']) });
      ins.run({ number:'02', title:'Landing Pages',       description:'Conversion-focused pages engineered to turn visitors into customers.', tags:JSON.stringify(['Conversion CRO','A/B Testing','SEO','Analytics'])           });
      ins.run({ number:'03', title:'Data Dashboards',     description:'Real-time analytics dashboards with custom visualizations.',           tags:JSON.stringify(['D3.js','Chart.js','WebSockets','REST APIs','GraphQL'])       });
      ins.run({ number:'04', title:'API & Backend',       description:'Robust APIs and infrastructure built to handle growth.',               tags:JSON.stringify(['Express.js','SQLite','Redis','Docker'])                      });
    })();
    console.log('🌱 Services seeded');
  }
}

seedIfEmpty();

// ── helper ─────────────────────────────────────────────────────
const parseRow  = r => r ? { ...r, tags: JSON.parse(r.tags || '[]') } : null;
const parseRows = rows => rows.map(parseRow);

// ══════════════════════════════════════════════════════════════
//  PROJECTS API
// ══════════════════════════════════════════════════════════════
app.get('/api/projects', (req, res) => {
  try {
    res.json({ success:true, data: parseRows(db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()) });
  } catch(e){ res.status(500).json({ success:false, message:e.message }); }
});

app.get('/api/projects/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
    if(!row) return res.status(404).json({ success:false, message:'Project not found' });
    res.json({ success:true, data:parseRow(row) });
  } catch(e){ res.status(500).json({ success:false, message:e.message }); }
});

app.post('/api/projects', (req, res) => {
  try {
    const { title, description, tags=[], type='General', year='2024', duration='N/A' } = req.body;
    if(!title||!description) return res.status(400).json({ success:false, message:'Title and description required.' });
    const r = db.prepare('INSERT INTO projects (title,description,tags,type,year,duration) VALUES (?,?,?,?,?,?)').run(title,description,JSON.stringify(tags),type,year,duration);
    res.status(201).json({ success:true, data:parseRow(db.prepare('SELECT * FROM projects WHERE id=?').get(r.lastInsertRowid)) });
  } catch(e){ res.status(500).json({ success:false, message:e.message }); }
});

app.delete('/api/projects/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
    if(!row) return res.status(404).json({ success:false, message:'Project not found' });
    db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
    res.json({ success:true, message:'Deleted', data:parseRow(row) });
  } catch(e){ res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  TEAM API
// ══════════════════════════════════════════════════════════════
app.get('/api/team', (req, res) => {
  try {
    res.json({ success:true, data: db.prepare('SELECT * FROM team ORDER BY id ASC').all() });
  } catch(e){ res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  SERVICES API
// ══════════════════════════════════════════════════════════════
app.get('/api/services', (req, res) => {
  try {
    res.json({ success:true, data: parseRows(db.prepare('SELECT * FROM services ORDER BY number ASC').all()) });
  } catch(e){ res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  CONTACT API  ← رسائل الناس بتتحفظ هنا
// ══════════════════════════════════════════════════════════════

// POST — استقبال رسالة جديدة
app.post('/api/contact', (req, res) => {
  try {
    const { name, email, type='Not specified', message } = req.body;
    if(!name||!email||!message)
      return res.status(400).json({ success:false, message:'Name, email, and message are required.' });
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ success:false, message:'Invalid email.' });

    const r = db.prepare('INSERT INTO messages (name,email,type,message) VALUES (?,?,?,?)').run(name,email,type,message);
    console.log(`\n📩 رسالة جديدة #${r.lastInsertRowid} من: ${name} <${email}>`);
    res.status(201).json({ success:true, message:'Message received!', id:r.lastInsertRowid });
  } catch(e){ res.status(500).json({ success:false, message:e.message }); }
});

// GET — شوف كل الرسائل (انت بس)
app.get('/api/contact', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM messages ORDER BY received_at DESC').all();
    res.json({ success:true, count:rows.length, data:rows });
  } catch(e){ res.status(500).json({ success:false, message:e.message }); }
});

// ── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success : true,
    status  : 'OK',
    db      : 'SQLite (hivedev.db)',
    counts  : {
      projects : db.prepare('SELECT COUNT(*) as c FROM projects').get().c,
      team     : db.prepare('SELECT COUNT(*) as c FROM team').get().c,
      services : db.prepare('SELECT COUNT(*) as c FROM services').get().c,
      messages : db.prepare('SELECT COUNT(*) as c FROM messages').get().c,
    },
    uptime: process.uptime().toFixed(1) + 's'
  });
});

// ── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🐝  HiveDev API — port ${PORT}`);
  console.log(`   GET  /api/projects`);
  console.log(`   POST /api/projects`);
  console.log(`   GET  /api/team`);
  console.log(`   GET  /api/services`);
  console.log(`   POST /api/contact   ← رسائل الزوار`);
  console.log(`   GET  /api/contact   ← تشوفها انت\n`);
});
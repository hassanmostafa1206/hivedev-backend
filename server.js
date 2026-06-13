// ══════════════════════════════════════════════════════════════
//  HiveDev Backend — Node.js + Express + SQLite
//  v2.0 — Security + Rate Limiting + CORS + PUT + Pagination
// ══════════════════════════════════════════════════════════════

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── كلمة السر — غيرها لما تحب ────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'team=3H_2Z_1O';

// ── Allowed Origins ───────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://hivedev-pro.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// ══════════════════════════════════════════════════════════════
//  RATE LIMITER — بدون أي package خارجي
// ══════════════════════════════════════════════════════════════
const rateLimitStore = new Map();

function rateLimit({ windowMs = 60_000, max = 20, message = 'Too many requests' } = {}) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = rateLimitStore.get(key) || { count: 0, start: now };

    if (now - entry.start > windowMs) {
      entry.count = 1;
      entry.start = now;
    } else {
      entry.count++;
    }

    rateLimitStore.set(key, entry);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));

    if (entry.count > max) {
      return res.status(429).json({ success: false, message });
    }
    next();
  };
}

// نظف الـ map كل 5 دقايق عشان الميموري ما تتملاش
setInterval(() => {
  const cutoff = Date.now() - 5 * 60_000;
  for (const [key, val] of rateLimitStore) {
    if (val.start < cutoff) rateLimitStore.delete(key);
  }
}, 5 * 60_000);

// Rate limits مختلفة حسب النوع
const generalLimit = rateLimit({ windowMs: 60_000,  max: 60,  message: 'Too many requests, slow down.' });
const contactLimit = rateLimit({ windowMs: 60_000,  max: 5,   message: 'Too many messages sent. Please wait a minute.' });
const adminLimit   = rateLimit({ windowMs: 60_000,  max: 20,  message: 'Too many admin requests.' });

app.use(generalLimit);

// ── Security Headers ──────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── فتح/إنشاء قاعدة البيانات ────────────────────────────────
const db = new Database(path.join(__dirname, 'hivedev.db'));
db.pragma('journal_mode = WAL');   // أسرع وأأمن للـ concurrent reads
db.pragma('foreign_keys = ON');
console.log('✅ SQLite database ready');

// ══════════════════════════════════════════════════════════════
//  إنشاء الجداول
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
    image       TEXT    DEFAULT 'images/project/default.png',
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS team (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    role  TEXT NOT NULL,
    bio   TEXT,
    image TEXT
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

try { db.exec('ALTER TABLE team ADD COLUMN image TEXT'); } catch(e) {}

// ══════════════════════════════════════════════════════════════
//  Seed البيانات الأولية
// ══════════════════════════════════════════════════════════════
function seedIfEmpty() {
  const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
  if (projectCount === 0) {
    const ins = db.prepare(
      'INSERT INTO projects (title,description,tags,type,year,duration,image) VALUES (@title,@description,@tags,@type,@year,@duration,@image)'
    );
    db.transaction(() => {
      ins.run({ title:'NexaFlow SaaS',        description:'Full platform rebuild for a workflow automation startup. 3× faster load times.',   tags:JSON.stringify(['React','Node.js','PostgreSQL','AWS']),     type:'Website Development', year:'2024', duration:'4 months', image:'images/project/bw.png'  });
      ins.run({ title:'Orbis Analytics',      description:'Real-time data dashboard for a financial analytics firm. 12 custom chart types.',  tags:JSON.stringify(['D3.js','WebSockets','Python','Redis']),    type:'Data Dashboard',      year:'2024', duration:'3 months', image:'images/project/wb.png'  });
      ins.run({ title:'Pulse E-Commerce',     description:'High-volume e-commerce platform with custom CMS and multi-vendor support.',        tags:JSON.stringify(['Next.js','Stripe','MongoDB','Docker']),    type:'Website Development', year:'2023', duration:'6 months', image:'images/project/bw.png'  });
      ins.run({ title:'Zephyr Landing',       description:'Launch campaign landing page. Winning A/B variant achieved 8.4% conversion.',      tags:JSON.stringify(['HTML','CSS','Analytics','CRO']),           type:'Landing Page',        year:'2023', duration:'3 weeks',  image:'images/project/wb.png'  });
      ins.run({ title:'HRConnect Portal',     description:'Employee self-service HR portal for a 2,000-person enterprise with SSO.',          tags:JSON.stringify(['React','GraphQL','PostgreSQL','SAML']),    type:'Website Development', year:'2023', duration:'5 months', image:'images/project/bw.png'  });
      ins.run({ title:'Beacon IoT Dashboard', description:'Real-time monitoring dashboard for industrial IoT sensors.',                       tags:JSON.stringify(['Vue.js','MQTT','InfluxDB','Chart.js']),    type:'Data Dashboard',      year:'2022', duration:'4 months', image:'images/project/wb.png'  });
    })();
    console.log('🌱 Projects seeded');
  }

  const teamCount = db.prepare('SELECT COUNT(*) as c FROM team').get().c;
  if (teamCount === 0) {
    const ins = db.prepare('INSERT INTO team (name,role,bio,image) VALUES (@name,@role,@bio,@image)');
    db.transaction(() => {
      ins.run({ name:'Hassan Mostafa', role:'Lead Architect',     bio:'Full-stack engineer with 10+ years building scalable web systems.',          image:'images/team/HMA.png' });
      ins.run({ name:'Hussien Khaled', role:'UX Engineer',        bio:'Design-obsessed frontend developer at the intersection of code and craft.',  image:'images/team/HKH.png' });
      ins.run({ name:'Ziad Hossam',    role:'Backend Engineer',   bio:'API architect and database wizard. Former engineer at two YC startups.',     image:'images/team/ZHG.png' });
      ins.run({ name:'Ziad Osama',     role:'Frontend Developer', bio:'Pixel-perfect CSS engineer with a background in graphic design.',            image:'images/team/ZOS.png' });
      ins.run({ name:'Omar Yasser',    role:'DevOps Engineer',    bio:'Infrastructure engineer obsessed with reliability and speed.',               image:'images/team/OYA.png' });
      ins.run({ name:'Hassan Mahmoud', role:'AI Engineer',        bio:'Artificial intelligence systems, machine learning models and integration.',  image:'images/team/HMH.png' });
    })();
    console.log('🌱 Team seeded');
  }

  const serviceCount = db.prepare('SELECT COUNT(*) as c FROM services').get().c;
  if (serviceCount === 0) {
    const ins = db.prepare('INSERT INTO services (number,title,description,tags) VALUES (@number,@title,@description,@tags)');
    db.transaction(() => {
      ins.run({ number:'01', title:'Website Development', description:'From marketing sites to complex web apps, we engineer for scale.',     tags:JSON.stringify(['React / Next.js','Node.js','TypeScript','PostgreSQL','AWS']) });
      ins.run({ number:'02', title:'Landing Pages',       description:'Conversion-focused pages engineered to turn visitors into customers.', tags:JSON.stringify(['Conversion CRO','A/B Testing','SEO','Analytics'])           });
      ins.run({ number:'03', title:'Data Dashboards',     description:'Real-time analytics dashboards with custom visualizations.',           tags:JSON.stringify(['D3.js','Chart.js','WebSockets','REST APIs','GraphQL'])       });
      ins.run({ number:'04', title:'API & Backend',       description:'Robust APIs and infrastructure built to handle growth.',               tags:JSON.stringify(['Express.js','SQLite','Redis','Docker'])                      });
    })();
    console.log('🌱 Services seeded');
  }
}

seedIfEmpty();

// ── Helpers ───────────────────────────────────────────────────
const parseRow  = r => r ? { ...r, tags: JSON.parse(r.tags || '[]') } : null;
const parseRows = rows => rows.map(parseRow);

// ── Input sanitizer — يشيل أي HTML خطر ──────────────────────
function sanitize(str = '') {
  return String(str).replace(/[<>'"]/g, c => ({'<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

// ── Admin auth middleware ─────────────────────────────────────
function requireAdmin(req, res, next) {
  const pw = req.query.password || req.headers['x-admin-password'];
  if (!pw || pw !== ADMIN_PASSWORD) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

// ══════════════════════════════════════════════════════════════
//  SITEMAP — بيتولد أوتوماتيك من الـ DB
// ══════════════════════════════════════════════════════════════
app.get('/sitemap.xml', (req, res) => {
  const base = 'https://hivedev-pro.vercel.app';
  const today = new Date().toISOString().split('T')[0];

  const staticUrls = [
    { loc: `${base}/`,          priority: '1.0', changefreq: 'weekly'  },
    { loc: `${base}/#services`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${base}/#portfolio`,priority: '0.8', changefreq: 'weekly'  },
    { loc: `${base}/#about`,    priority: '0.8', changefreq: 'monthly' },
    { loc: `${base}/#team`,     priority: '0.6', changefreq: 'monthly' },
    { loc: `${base}/#contact`,  priority: '0.7', changefreq: 'monthly' },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.send(xml);
});

// ══════════════════════════════════════════════════════════════
//  SCHEMA.ORG endpoint — JSON-LD جاهز للفرونت
// ══════════════════════════════════════════════════════════════
app.get('/api/schema', (req, res) => {
  const base = 'https://hivedev-pro.vercel.app';
  const services = parseRows(db.prepare('SELECT * FROM services ORDER BY number ASC').all());

  res.json({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: 'HiveDev',
        url: base,
        logo: { '@type': 'ImageObject', url: `${base}/images/HiveDev-icon.png` },
        description: 'HiveDev is a modern web development studio building fast, scalable digital products.',
        foundingDate: '2019',
        email: 'hivedev.pro@gmail.com',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Beni-Suef',
          addressRegion: 'Beni-Suef Governorate',
          addressCountry: 'EG',
        },
        sameAs: [
          'https://twitter.com/hivedev',
          'https://linkedin.com/company/hivedev',
          'https://github.com/hivedev',
        ],
      },
      {
        '@type': 'ProfessionalService',
        '@id': `${base}/#service`,
        name: 'HiveDev Web Development Studio',
        url: base,
        email: 'hivedev.pro@gmail.com',
        priceRange: '$$',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Beni-Suef',
          addressRegion: 'Beni-Suef Governorate',
          addressCountry: 'EG',
        },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Web Development Services',
          itemListElement: services.map(s => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: s.title, description: s.description },
          })),
        },
      },
    ],
  });
});

// ══════════════════════════════════════════════════════════════
//  PROJECTS API
// ══════════════════════════════════════════════════════════════

// GET all — مع pagination
app.get('/api/projects', (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
    const data  = parseRows(db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset));

    res.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET one
app.get('/api/projects/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, data: parseRow(row) });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST — إضافة project جديد
app.post('/api/projects', requireAdmin, (req, res) => {
  try {
    const { title, description, tags=[], type='General', year='2024', duration='N/A', image='' } = req.body;
    if (!title || !description) return res.status(400).json({ success: false, message: 'Title and description required.' });

    const r = db.prepare(
      'INSERT INTO projects (title,description,tags,type,year,duration,image) VALUES (?,?,?,?,?,?,?)'
    ).run(sanitize(title), sanitize(description), JSON.stringify(tags), sanitize(type), sanitize(year), sanitize(duration), sanitize(image));

    res.status(201).json({ success: true, data: parseRow(db.prepare('SELECT * FROM projects WHERE id=?').get(r.lastInsertRowid)) });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT — تعديل project موجود
app.put('/api/projects/:id', requireAdmin, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Project not found' });

    const { title, description, tags, type, year, duration, image } = req.body;

    db.prepare(`
      UPDATE projects SET
        title       = COALESCE(?, title),
        description = COALESCE(?, description),
        tags        = COALESCE(?, tags),
        type        = COALESCE(?, type),
        year        = COALESCE(?, year),
        duration    = COALESCE(?, duration),
        image       = COALESCE(?, image)
      WHERE id = ?
    `).run(
      title       ? sanitize(title)       : null,
      description ? sanitize(description) : null,
      tags        ? JSON.stringify(tags)  : null,
      type        ? sanitize(type)        : null,
      year        ? sanitize(year)        : null,
      duration    ? sanitize(duration)    : null,
      image       ? sanitize(image)       : null,
      req.params.id
    );

    res.json({ success: true, data: parseRow(db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id)) });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE
app.delete('/api/projects/:id', requireAdmin, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Project not found' });
    db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
    res.json({ success: true, message: 'Deleted', data: parseRow(row) });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  TEAM API
// ══════════════════════════════════════════════════════════════
app.get('/api/team', (req, res) => {
  try {
    res.json({ success: true, data: db.prepare('SELECT * FROM team ORDER BY id ASC').all() });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT — تعديل team member
app.put('/api/team/:id', requireAdmin, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM team WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Team member not found' });

    const { name, role, bio, image } = req.body;
    db.prepare(`
      UPDATE team SET
        name  = COALESCE(?, name),
        role  = COALESCE(?, role),
        bio   = COALESCE(?, bio),
        image = COALESCE(?, image)
      WHERE id = ?
    `).run(
      name  ? sanitize(name)  : null,
      role  ? sanitize(role)  : null,
      bio   ? sanitize(bio)   : null,
      image ? sanitize(image) : null,
      req.params.id
    );

    res.json({ success: true, data: db.prepare('SELECT * FROM team WHERE id=?').get(req.params.id) });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  SERVICES API
// ══════════════════════════════════════════════════════════════
app.get('/api/services', (req, res) => {
  try {
    res.json({ success: true, data: parseRows(db.prepare('SELECT * FROM services ORDER BY number ASC').all()) });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  CONTACT API
// ══════════════════════════════════════════════════════════════

// POST — استقبال رسالة جديدة
app.post('/api/contact', contactLimit, (req, res) => {
  try {
    const { name, email, type='Not specified', message } = req.body;

    if (!name || !email || !message)
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ success: false, message: 'Invalid email.' });

    if (name.length > 100 || message.length > 2000)
      return res.status(400).json({ success: false, message: 'Input too long.' });

    const r = db.prepare('INSERT INTO messages (name,email,type,message) VALUES (?,?,?,?)').run(
      sanitize(name), sanitize(email), sanitize(type), sanitize(message)
    );

    console.log(`\n📩 رسالة جديدة #${r.lastInsertRowid} من: ${name} <${email}>`);
    res.status(201).json({ success: true, message: 'Message received!', id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET — شوف كل الرسائل (أدمن بس)
app.get('/api/contact', adminLimit, requireAdmin, (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
    const data  = db.prepare('SELECT * FROM messages ORDER BY received_at DESC LIMIT ? OFFSET ?').all(limit, offset);

    res.json({ success: true, count: total, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE رسالة
app.delete('/api/contact/:id', adminLimit, requireAdmin, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM messages WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Message not found' });
    db.prepare('DELETE FROM messages WHERE id=?').run(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ══════════════════════════════════════════════════════════════
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
    uptime: process.uptime().toFixed(1) + 's',
  });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🐝  HiveDev API — port ${PORT}`);
  console.log(`   GET    /api/projects          (pagination: ?page=1&limit=20)`);
  console.log(`   POST   /api/projects          (admin)`);
  console.log(`   PUT    /api/projects/:id      (admin)`);
  console.log(`   DELETE /api/projects/:id      (admin)`);
  console.log(`   GET    /api/team`);
  console.log(`   PUT    /api/team/:id          (admin)`);
  console.log(`   GET    /api/services`);
  console.log(`   POST   /api/contact`);
  console.log(`   GET    /api/contact           (admin)`);
  console.log(`   DELETE /api/contact/:id       (admin)`);
  console.log(`   GET    /api/schema            (Schema.org JSON-LD)`);
  console.log(`   GET    /sitemap.xml           (auto-generated)`);
  console.log(`   GET    /api/health\n`);
});
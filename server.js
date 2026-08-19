require("dotenv").config();
const express = require("express");
const session = require("express-session");
const QRCode = require("qrcode");
const path = require("path");
const store = require("./lib/store");
const { generateUniqueCodes } = require("./lib/codes");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "please-change-this-secret";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 12 }, // 12 jam
  })
);

// ---------- Util ----------
function isValidGmapsUrl(url) {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    return (
      host.includes("google.com") ||
      host.includes("goo.gl") ||
      host === "maps.app.goo.gl" ||
      host.includes("g.page")
    );
  } catch {
    return false;
  }
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ ok: false, error: "Belum login." });
}

function buildRedirectUrl(code) {
  return `${BASE_URL}/r/${code}`;
}

// ---------- Auth ----------
app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: "Password salah." });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/session", (req, res) => {
  res.json({ ok: true, isAdmin: !!(req.session && req.session.isAdmin) });
});

app.get("/api/config", requireAuth, (req, res) => {
  res.json({ ok: true, baseUrl: BASE_URL });
});

// ---------- Admin API ----------
app.get("/api/codes", requireAuth, async (req, res) => {
  const all = await store.getAll();
  let list = Object.values(all);

  const { status, search } = req.query;
  if (status === "active") list = list.filter((c) => c.status === "active");
  if (status === "inactive") list = list.filter((c) => c.status === "inactive");
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.label && c.label.toLowerCase().includes(q)) ||
        (c.targetUrl && c.targetUrl.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ ok: true, codes: list });
});

app.get("/api/stats", requireAuth, async (req, res) => {
  const all = await store.getAll();
  const list = Object.values(all);
  const active = list.filter((c) => c.status === "active").length;
  const scans = list.reduce((sum, c) => sum + (c.scanCount || 0), 0);
  res.json({
    ok: true,
    total: list.length,
    active,
    inactive: list.length - active,
    scans,
  });
});

app.post("/api/codes/generate", requireAuth, async (req, res) => {
  let { count, prefix, batchLabel } = req.body || {};
  count = parseInt(count, 10);
  if (!count || count < 1 || count > 2000) {
    return res.status(400).json({ ok: false, error: "Jumlah harus antara 1 dan 2000." });
  }
  const all = await store.getAll();
  const existing = Object.keys(all);
  let newCodes;
  try {
    newCodes = generateUniqueCodes(count, existing, prefix);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
  const now = new Date().toISOString();
  const entries = newCodes.map((code) => ({
    code,
    status: "inactive",
    targetUrl: null,
    label: batchLabel || null,
    createdAt: now,
    activatedAt: null,
    scanCount: 0,
    lastScanAt: null,
  }));
  await store.upsertMany(entries);
  res.json({ ok: true, created: newCodes });
});

app.post("/api/codes/:code/activate", requireAuth, async (req, res) => {
  const { code } = req.params;
  const { targetUrl } = req.body || {};
  if (!isValidGmapsUrl(targetUrl)) {
    return res.status(400).json({
      ok: false,
      error: "Link tidak valid. Gunakan link Google Maps (google.com, goo.gl, atau g.page).",
    });
  }
  const existing = await store.get(code);
  if (!existing) return res.status(404).json({ ok: false, error: "Kode tidak ditemukan." });
  const updated = await store.update(code, {
    status: "active",
    targetUrl: targetUrl.trim(),
    activatedAt: new Date().toISOString(),
  });
  res.json({ ok: true, item: updated });
});

app.post("/api/codes/:code/deactivate", requireAuth, async (req, res) => {
  const { code } = req.params;
  const existing = await store.get(code);
  if (!existing) return res.status(404).json({ ok: false, error: "Kode tidak ditemukan." });
  const updated = await store.update(code, {
    status: "inactive",
    targetUrl: null,
    activatedAt: null,
  });
  res.json({ ok: true, item: updated });
});

app.delete("/api/codes/:code", requireAuth, async (req, res) => {
  const { code } = req.params;
  const ok = await store.remove(code);
  if (!ok) return res.status(404).json({ ok: false, error: "Kode tidak ditemukan." });
  res.json({ ok: true });
});

app.get("/api/codes/:code/qrcode.svg", requireAuth, async (req, res) => {
  const svg = await QRCode.toString(buildRedirectUrl(req.params.code), {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });
  res.type("image/svg+xml").send(svg);
});

app.get("/api/codes/export.csv", requireAuth, async (req, res) => {
  const all = await store.getAll();
  const list = Object.values(all).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const rows = [["code", "status", "redirect_url", "target_url", "label", "created_at", "activated_at", "scan_count"]];
  for (const c of list) {
    rows.push([
      c.code,
      c.status,
      buildRedirectUrl(c.code),
      c.targetUrl || "",
      c.label || "",
      c.createdAt || "",
      c.activatedAt || "",
      String(c.scanCount || 0),
    ]);
  }
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  res.setHeader("Content-Disposition", 'attachment; filename="kode-review.csv"');
  res.type("text/csv").send(csv);
});

// ---------- Halaman cetak (butuh login) ----------
app.get("/print", requireAuth, async (req, res) => {
  const all = await store.getAll();
  let list = Object.values(all);
  const { ids, status, label } = req.query;
  if (ids) {
    const wanted = new Set(String(ids).split(",").map((s) => s.trim()));
    list = list.filter((c) => wanted.has(c.code));
  } else if (status) {
    list = list.filter((c) => c.status === status);
  } else if (label) {
    list = list.filter((c) => c.label === label);
  }
  list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  const tickets = await Promise.all(
    list.map(async (c) => ({
      code: c.code,
      status: c.status,
      qrSvg: await QRCode.toString(buildRedirectUrl(c.code), {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
      }),
    }))
  );

  res.render("print", { tickets, total: tickets.length });
});

// ---------- Halaman admin & login (statis) ----------
app.use("/assets", express.static(path.join(__dirname, "public")));
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});
app.get("/", (req, res) => res.redirect("/admin"));

// ---------- Redirect publik (yang dipindai barcode/QR) ----------
app.get("/r/:code", async (req, res) => {
  const { code } = req.params;
  const item = await store.get(code.toUpperCase());

  if (!item) {
    return res.status(404).render("pending", { state: "notfound", code });
  }

  if (item.status === "active" && item.targetUrl) {
    store.update(code.toUpperCase(), {
      scanCount: (item.scanCount || 0) + 1,
      lastScanAt: new Date().toISOString(),
    });
    return res.redirect(302, item.targetUrl);
  }

  return res.render("pending", { state: "inactive", code });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di ${BASE_URL} (port ${PORT})`);
  console.log(`Admin panel: ${BASE_URL}/admin`);
});

import { DOCS_HTML } from "./docs.js";

/* ---------- helpers ---------- */
const enc = new TextEncoder();
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" };
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...CORS } });
class E extends Error { constructor(s, m) { super(m); this.s = s; } }
const bad = (m, s = 400) => { throw new E(s, m); };
const need = (b, ...k) => { const m = k.filter((x) => b[x] === undefined || b[x] === ""); if (m.length) bad("Missing field(s): " + m.join(", ")); };
const pj = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const mins = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const hm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const hkey = (s) => crypto.subtle.importKey("raw", enc.encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

async function signJWT(env, payload) {
  const h = b64u(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const p = b64u(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 1209600 })));
  return h + "." + p + "." + b64u(await crypto.subtle.sign("HMAC", await hkey(env.JWT_SECRET), enc.encode(h + "." + p)));
}
async function verifyJWT(env, t) {
  const [h, p, s] = (t || "").split(".");
  if (!s || !(await crypto.subtle.verify("HMAC", await hkey(env.JWT_SECRET), unb64u(s), enc.encode(h + "." + p)))) return null;
  const d = JSON.parse(new TextDecoder().decode(unb64u(p)));
  return d.exp > Date.now() / 1000 ? d : null;
}
async function verifyFirebase(env, token) {
  const [h, p, s] = (token || "").split(".");
  if (!s) bad("Invalid Google token", 401);
  const head = JSON.parse(new TextDecoder().decode(unb64u(h)));
  const jwks = await (await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com", { cf: { cacheTtl: 3600, cacheEverything: true } })).json();
  const jwk = jwks.keys.find((k) => k.kid === head.kid);
  if (!jwk || head.alg !== "RS256") bad("Invalid Google token", 401);
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(s), enc.encode(h + "." + p)))) bad("Invalid Google token", 401);
  const d = JSON.parse(new TextDecoder().decode(unb64u(p))), pid = env.FIREBASE_PROJECT_ID;
  if (!pid || d.aud !== pid || d.iss !== "https://securetoken.google.com/" + pid || d.exp < Date.now() / 1000 || !d.sub) bad("Invalid Google token", 401);
  return d;
}
async function cldSign(env, params) {
  const str = Object.keys(params).sort().map((k) => k + "=" + params[k]).join("&") + env.CLOUDINARY_API_SECRET;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-1", enc.encode(str)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const cldReady = (env) => (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) || bad("Cloudinary is not configured on the server", 500);
async function cldDelete(env, url) {
  const m = /\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i.exec(url || "");
  if (!m || !cldReady(env)) return;
  const ts = Math.floor(Date.now() / 1000), public_id = decodeURIComponent(m[2]);
  const fd = new FormData(); fd.append("public_id", public_id); fd.append("timestamp", ts); fd.append("api_key", env.CLOUDINARY_API_KEY); fd.append("signature", await cldSign(env, { public_id, timestamp: ts }));
  await fetch("https://api.cloudinary.com/v1_1/" + env.CLOUDINARY_CLOUD_NAME + "/" + m[1] + "/destroy", { method: "POST", body: fd });
}
async function hashPw(pw, salt) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return b64u(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, k, 256));
}

/* ---------- messaging: Termii (SMS/OTP) + Brevo (email) ---------- */
async function sendSMS(env, to, text) {
  if (!env.TERMII_API_KEY) return "skipped:no_termii_key";
  const r = await fetch("https://api.ng.termii.com/api/sms/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, from: env.TERMII_SENDER_ID, sms: text, type: "plain", channel: "generic", api_key: env.TERMII_API_KEY }) });
  return r.ok ? "sent" : "failed";
}
async function sendEmail(env, to, subject, html) {
  if (!env.BREVO_API_KEY) return "skipped:no_brevo_key";
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "content-type": "application/json", "api-key": env.BREVO_API_KEY }, body: JSON.stringify({ sender: { name: "Trend", email: env.BREVO_SENDER }, to: [{ email: to }], subject, htmlContent: html }) });
  return r.ok ? "sent" : "failed";
}
async function notify(c, userId, type, title, body) {
  const u = await c.one("SELECT email,phone,settings FROM users WHERE id=?", userId) || await c.one("SELECT email,phone,'{}' settings FROM staff WHERE id=?", userId);
  if (!u) return;
  const s = pj(u.settings, {}); const d = [];
  if (u.phone && s.sms !== false) d.push("sms:" + await sendSMS(c.env, u.phone, title + ": " + body));
  if (u.email && s.email !== false) d.push("email:" + await sendEmail(c.env, u.email, title, "<p>" + body + "</p>"));
  await c.run("INSERT INTO notifications(id,user_id,type,title,body,delivery) VALUES(?,?,?,?,?,?)", uid(), userId, type, title, body, d.join(",") || "in_app");
}
async function otp(c, target, purpose) {
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  await c.run("INSERT INTO otps(id,target,purpose,code,expires) VALUES(?,?,?,?,?)", uid(), target, purpose, code, Date.now() + 600000);
  const msg = "Your Trend code is " + code + ". It expires in 10 minutes.";
  target.includes("@") ? await sendEmail(c.env, target, "Your Trend code", msg) : await sendSMS(c.env, target, msg);
  return c.env.ENVIRONMENT === "dev" ? { dev_code: code } : {};
}
async function checkOtp(c, target, purpose, code, consume = true) {
  const o = await c.one("SELECT * FROM otps WHERE target=? AND purpose=? AND code=? AND used=0 AND expires>? ORDER BY expires DESC", target, purpose, code, Date.now());
  if (!o) bad("Invalid or expired code", 401);
  if (consume) await c.run("UPDATE otps SET used=1 WHERE id=?", o.id);
}

/* ---------- domain helpers ---------- */
async function biz(c) {
  const b = c.user.role === "staff" ? await c.one("SELECT * FROM businesses WHERE id=?", c.user.bid) : await c.one("SELECT * FROM businesses WHERE owner_id=?", c.user.sub);
  return b || bad("Register your business first", 404);
}
async function patch(c, table, id, body, fields, idcol = "id") {
  const f = fields.filter((k) => body[k] !== undefined);
  if (!f.length) bad("Nothing to update");
  await c.run("UPDATE " + table + " SET " + f.map((k) => k + "=?").join(",") + " WHERE " + idcol + "=?", ...f.map((k) => (typeof body[k] === "object" && body[k] !== null ? JSON.stringify(body[k]) : body[k])), id);
}
async function slots(c, s, date, dur, staffId, excludeId = "") {
  const bz = await c.one("SELECT hours FROM businesses WHERE id=?", s.business_id);
  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(date + "T00:00:00Z").getUTCDay()];
  const st = await c.all("SELECT * FROM staff WHERE business_id=? AND active=1" + (staffId ? " AND id=?" : ""), ...[s.business_id].concat(staffId ? [staffId] : []));
  const busy = await c.all("SELECT staff_id,start_time,end_time FROM bookings WHERE business_id=? AND date=? AND id!=? AND status IN ('pending','upcoming','awaiting_arrival','in_progress')", s.business_id, date, excludeId);
  const bh = pj(bz.hours, {}); const out = {};
  for (const m of st) {
    const w = pj(m.schedule, {})[day] || bh[day]; if (!w) continue;
    const brk = pj(m.breaks, []);
    for (let t = mins(w[0]); t + dur <= mins(w[1]); t += 30) {
      const e = t + dur;
      const clash = busy.some((x) => x.staff_id === m.id && t < mins(x.end_time) && e > mins(x.start_time)) || brk.some((x) => t < mins(x[1]) && e > mins(x[0]));
      if (!clash) (out[hm(t)] ||= []).push(m.id);
    }
  }
  return Object.entries(out).sort().map(([start, staff_ids]) => ({ start, staff_ids }));
}
async function loadBooking(c, id) {
  const b = await c.one("SELECT bk.*,s.name service_name,bz.owner_id,bz.name business_name FROM bookings bk JOIN services s ON s.id=bk.service_id JOIN businesses bz ON bz.id=bk.business_id WHERE bk.id=?", id);
  if (!b) bad("Booking not found", 404);
  const u = c.user;
  if (!(u.role === "admin" || b.client_id === u.sub || b.owner_id === u.sub || (u.role === "staff" && b.staff_id === u.sub))) bad("Forbidden", 403);
  return b;
}
const FLOW = { pending: ["upcoming", "declined", "cancelled"], upcoming: ["awaiting_arrival", "in_progress", "cancelled"], awaiting_arrival: ["in_progress", "cancelled"], in_progress: ["completed"] };
async function setStatus(c, b, status, extra = {}) {
  if (!(FLOW[b.status] || []).includes(status)) bad("Cannot move booking from " + b.status + " to " + status, 409);
  const ex = { ...extra, status, updated_at: now() };
  await patch(c, "bookings", b.id, ex, Object.keys(ex));
  const parties = [b.client_id, b.owner_id, b.staff_id].filter((x) => x && x !== c.user.sub);
  for (const p of parties) await notify(c, p, "booking_" + status, "Booking " + status.replace("_", " "), b.service_name + " on " + b.date + " at " + b.start_time + " is now " + status.replace("_", " ") + ".");
  return { ...b, ...ex };
}
async function statsFor(c, where, args) {
  const f = c.q.get("from") || "0000-00-00", t = c.q.get("to") || "9999-99-99";
  const w = where + " AND date>=? AND date<=?"; const a = [...args, f, t];
  const byStatus = await c.all("SELECT status,COUNT(*) count,COALESCE(SUM(price),0) value FROM bookings WHERE " + w + " GROUP BY status", ...a);
  const monthly = await c.all("SELECT substr(date,1,7) month,COUNT(*) appointments,COALESCE(SUM(CASE WHEN status='completed' THEN price END),0) revenue FROM bookings WHERE " + w + " GROUP BY month ORDER BY month DESC LIMIT 12", ...a);
  const cl = await c.all("SELECT client_id,MIN(date) first_date FROM bookings WHERE " + where + " AND status!='cancelled' GROUP BY client_id", ...args);
  const n = cl.filter((x) => x.first_date >= f).length;
  return { by_status: byStatus, monthly, clients: { total: cl.length, new: n, returning: cl.length - n }, revenue: byStatus.find((x) => x.status === "completed")?.value || 0 };
}

/* ---------- route registry ---------- */
const routes = [];
const r = (method, path, auth, summary, example, handler, o = {}) => routes.push({ method, path, auth, summary, example, handler, ...o });
const DAY = { mon: ["09:00", "18:00"], tue: ["09:00", "18:00"], wed: ["09:00", "18:00"], thu: ["09:00", "18:00"], fri: ["09:00", "18:00"], sat: ["10:00", "16:00"] };

// 1. Authentication
r("GET", "/api/health", "-", "Check the API is running", null, async () => ({ ok: true, time: now() }));
r("POST", "/api/auth/register", "-", "Register a client or business owner. Returns a token.", { role: "client", name: "Ada Obi", email: "ada@example.com", phone: "+2348012345678", password: "Passw0rd!" }, async (c) => {
  const b = c.body; need(b, "name", "password"); if (!b.email && !b.phone) bad("Provide email or phone");
  if (!["client", "business"].includes(b.role || "client")) bad("role must be client or business");
  if (b.password.length < 8) bad("Password must be at least 8 characters");
  if (await c.one("SELECT id FROM users WHERE email=? OR phone=?", b.email || "-", b.phone || "-")) bad("Account already exists", 409);
  const id = uid(), salt = uid(), role = b.role || "client";
  await c.run("INSERT INTO users(id,role,name,email,phone,password_hash,salt) VALUES(?,?,?,?,?,?,?)", id, role, b.name, b.email || null, b.phone || null, await hashPw(b.password, salt), salt);
  return [{ token: await signJWT(c.env, { sub: id, role }), user: { id, role, name: b.name } }, 201];
});
r("POST", "/api/auth/login", "-", "Log in with email or phone and password. Returns a token.", { identifier: "ada@example.com", password: "Passw0rd!" }, async (c) => {
  need(c.body, "identifier", "password");
  const u = await c.one("SELECT * FROM users WHERE email=? OR phone=?", c.body.identifier, c.body.identifier);
  if (!u || u.password_hash !== (await hashPw(c.body.password, u.salt))) bad("Wrong credentials", 401);
  return { token: await signJWT(c.env, { sub: u.id, role: u.role }), user: { id: u.id, role: u.role, name: u.name, verified: !!u.verified } };
});
r("POST", "/api/auth/google", "-", "Sign in or sign up with Google. Send the Firebase ID token from the frontend.", { id_token: "FIREBASE_ID_TOKEN", role: "client" }, async (c) => {
  need(c.body, "id_token");
  const g = await verifyFirebase(c.env, c.body.id_token);
  if (!g.email || !g.email_verified) bad("Google account email is not verified", 401);
  let u = await c.one("SELECT * FROM users WHERE email=?", g.email), created = false;
  if (!u) {
    const role = c.body.role === "business" ? "business" : "client", id = uid();
    await c.run("INSERT INTO users(id,role,name,email,image,verified) VALUES(?,?,?,?,?,1)", id, role, g.name || g.email.split("@")[0], g.email, g.picture || null);
    u = { id, role, name: g.name }; created = true;
  }
  return [{ token: await signJWT(c.env, { sub: u.id, role: u.role }), user: { id: u.id, role: u.role, name: u.name }, created }, created ? 201 : 200];
});
r("POST", "/api/auth/otp/send", "-", "Send a verification OTP by SMS (Termii) or email (Brevo)", { target: "+2348012345678" }, async (c) => { need(c.body, "target"); return { sent: true, ...(await otp(c, c.body.target, "verify")) }; });
r("POST", "/api/auth/otp/verify", "-", "Verify an OTP and mark the account as verified", { target: "+2348012345678", code: "123456" }, async (c) => {
  need(c.body, "target", "code"); await checkOtp(c, c.body.target, "verify", c.body.code);
  await c.run("UPDATE users SET verified=1 WHERE phone=? OR email=?", c.body.target, c.body.target); return { verified: true };
});
r("POST", "/api/auth/password/forgot", "-", "Send a password reset code", { identifier: "ada@example.com" }, async (c) => {
  need(c.body, "identifier"); const u = await c.one("SELECT email,phone FROM users WHERE email=? OR phone=?", c.body.identifier, c.body.identifier);
  return { sent: true, ...(u ? await otp(c, c.body.identifier, "reset") : {}) };
});
r("POST", "/api/auth/password/reset", "-", "Set a new password using the reset code", { identifier: "ada@example.com", code: "123456", new_password: "NewPassw0rd!" }, async (c) => {
  need(c.body, "identifier", "code", "new_password"); await checkOtp(c, c.body.identifier, "reset", c.body.code);
  const salt = uid(); await c.run("UPDATE users SET password_hash=?,salt=? WHERE email=? OR phone=?", await hashPw(c.body.new_password, salt), salt, c.body.identifier, c.body.identifier); return { reset: true };
});
r("POST", "/api/auth/staff-login", "-", "Staff log in with the code their business gave them", { code: "A1B2C3" }, async (c) => {
  need(c.body, "code"); const s = await c.one("SELECT * FROM staff WHERE login_code=? AND active=1", String(c.body.code).toUpperCase());
  if (!s) bad("Invalid staff code", 401);
  return { token: await signJWT(c.env, { sub: s.id, role: "staff", bid: s.business_id }), staff: { id: s.id, name: s.name, onboarded: !!s.onboarded } };
});
r("GET", "/api/auth/me", "any", "Get the signed-in user", null, async (c) => (c.user.role === "staff" ? await c.one("SELECT id,name,phone,email,title,image,onboarded,business_id FROM staff WHERE id=?", c.user.sub) : await c.one("SELECT id,role,name,email,phone,image,verified,settings FROM users WHERE id=?", c.user.sub)));
r("PUT", "/api/profile", "client,business", "Update name, email, phone, image URL or notification settings", { name: "Ada O.", settings: { sms: true, email: false } }, async (c) => { await patch(c, "users", c.user.sub, c.body, ["name", "email", "phone", "image", "settings"]); return { updated: true }; });
r("POST", "/api/uploads", "any", "Upload an image or media file (multipart field: file) to Cloudinary. Returns its URL.", null, async (c) => {
  cldReady(c.env); const f = (await c.req.formData()).get("file"); if (!f || !f.size) bad("Attach a file in the 'file' field");
  if (f.size > 10e6) bad("File too large (10 MB max)", 413);
  const ts = Math.floor(Date.now() / 1000), folder = "trend", fd = new FormData();
  fd.append("file", f); fd.append("api_key", c.env.CLOUDINARY_API_KEY); fd.append("timestamp", ts); fd.append("folder", folder); fd.append("signature", await cldSign(c.env, { folder, timestamp: ts }));
  const res = await fetch("https://api.cloudinary.com/v1_1/" + c.env.CLOUDINARY_CLOUD_NAME + "/auto/upload", { method: "POST", body: fd }), d = await res.json();
  if (!res.ok) bad("Upload failed: " + (d.error?.message || res.status), 502);
  return [{ url: d.secure_url, public_id: d.public_id, type: d.resource_type }, 201];
}, { file: true });

// 2. Client platform
r("GET", "/api/categories", "-", "List service categories", null, (c) => c.all("SELECT * FROM categories ORDER BY name"));
r("GET", "/api/services", "-", "List services. Query: category, business_id, q", null, async (c) => {
  let sql = "SELECT s.*,b.name business_name,(SELECT ROUND(AVG(rating),1) FROM reviews WHERE service_id=s.id) rating FROM services s JOIN businesses b ON b.id=s.business_id WHERE s.active=1"; const a = [];
  for (const [k, col] of [["category", "s.category"], ["business_id", "s.business_id"]]) if (c.q.get(k)) { sql += " AND " + col + "=?"; a.push(c.q.get(k)); }
  if (c.q.get("q")) { sql += " AND s.name LIKE ?"; a.push("%" + c.q.get("q") + "%"); }
  return (await c.all(sql + " ORDER BY s.created_at DESC LIMIT 100", ...a)).map((s) => ({ ...s, images: pj(s.images, []) }));
});
r("GET", "/api/services/:id", "-", "Service details with price, images, description and add-ons", null, async (c) => {
  const s = await c.one("SELECT s.*,b.name business_name,b.address,(SELECT ROUND(AVG(rating),1) FROM reviews WHERE service_id=s.id) rating FROM services s JOIN businesses b ON b.id=s.business_id WHERE s.id=?", c.params.id);
  if (!s) bad("Service not found", 404); return { ...s, images: pj(s.images, []), addons: await c.all("SELECT * FROM addons WHERE service_id=?", s.id) };
});
r("GET", "/api/services/:id/reviews", "-", "List reviews and the average rating for a service", null, async (c) => ({ reviews: await c.all("SELECT r.rating,r.comment,r.created_at,u.name client FROM reviews r JOIN users u ON u.id=r.client_id WHERE service_id=? ORDER BY r.created_at DESC", c.params.id) }));
r("POST", "/api/services/:id/reviews", "client", "Review a completed booking (1 to 5 stars)", { booking_id: "BOOKING_ID", rating: 5, comment: "Loved it" }, async (c) => {
  need(c.body, "booking_id", "rating"); const b = await c.one("SELECT * FROM bookings WHERE id=? AND client_id=? AND service_id=? AND status='completed'", c.body.booking_id, c.user.sub, c.params.id);
  if (!b) bad("Only completed bookings you made can be reviewed", 403); if (c.body.rating < 1 || c.body.rating > 5) bad("rating must be 1 to 5");
  await c.run("INSERT INTO reviews(id,service_id,booking_id,client_id,staff_id,rating,comment) VALUES(?,?,?,?,?,?,?)", uid(), b.service_id, b.id, c.user.sub, b.staff_id, c.body.rating, c.body.comment || ""); return [{ reviewed: true }, 201];
});
r("GET", "/api/wishlist", "client", "List my wishlist", null, (c) => c.all("SELECT s.* FROM wishlist w JOIN services s ON s.id=w.service_id WHERE w.client_id=?", c.user.sub));
r("POST", "/api/wishlist", "client", "Add a service to my wishlist", { service_id: "SERVICE_ID" }, async (c) => { need(c.body, "service_id"); await c.run("INSERT OR IGNORE INTO wishlist VALUES(?,?)", c.user.sub, c.body.service_id); return [{ added: true }, 201]; });
r("DELETE", "/api/wishlist/:service_id", "client", "Remove a service from my wishlist", null, async (c) => { await c.run("DELETE FROM wishlist WHERE client_id=? AND service_id=?", c.user.sub, c.params.service_id); return { removed: true }; });

// Booking
r("GET", "/api/services/:id/specialists", "-", "List staff who can perform a service", null, async (c) => { const s = await c.one("SELECT business_id FROM services WHERE id=?", c.params.id); if (!s) bad("Service not found", 404); return c.all("SELECT s.id,s.name,s.title,s.image,(SELECT ROUND(AVG(rating),1) FROM reviews WHERE staff_id=s.id) rating FROM staff s WHERE business_id=? AND active=1", s.business_id); });
r("GET", "/api/availability", "-", "Open time slots. Query: service_id, date (YYYY-MM-DD), staff_id (optional), addons (comma ids, optional)", null, async (c) => {
  const s = await c.one("SELECT * FROM services WHERE id=?", c.q.get("service_id")); if (!s) bad("service_id invalid", 404); if (!c.q.get("date")) bad("date required");
  let dur = s.duration; for (const id of (c.q.get("addons") || "").split(",").filter(Boolean)) dur += (await c.one("SELECT duration FROM addons WHERE id=?", id))?.duration || 0;
  return { date: c.q.get("date"), duration: dur, slots: await slots(c, s, c.q.get("date"), dur, c.q.get("staff_id")) };
});
r("POST", "/api/bookings", "client", "Create a booking. Starts as 'pending' until the business accepts.", { service_id: "SERVICE_ID", date: "2026-12-05", start: "10:00", staff_id: "", addons: [], appointment_type: "in_shop", notes: "" }, async (c) => {
  const b = c.body; need(b, "service_id", "date", "start");
  const s = await c.one("SELECT * FROM services WHERE id=? AND active=1", b.service_id) || bad("Service not found", 404);
  let dur = s.duration, price = s.price; const add = [];
  for (const id of b.addons || []) { const a = await c.one("SELECT * FROM addons WHERE id=? AND service_id=?", id, s.id); if (a) { dur += a.duration; price += a.price; add.push(a.id); } }
  const hit = (await slots(c, s, b.date, dur, b.staff_id || null)).find((x) => x.start === b.start) || bad("That time is no longer available", 409);
  const id = uid(), staff = b.staff_id || hit.staff_ids[0];
  await c.run("INSERT INTO bookings(id,client_id,business_id,staff_id,service_id,addons,appointment_type,date,start_time,end_time,price,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", id, c.user.sub, s.business_id, staff, s.id, JSON.stringify(add), b.appointment_type || "in_shop", b.date, b.start, hm(mins(b.start) + dur), price, b.notes || "");
  const bz = await c.one("SELECT owner_id FROM businesses WHERE id=?", s.business_id);
  c.ctx.waitUntil(notify(c, bz.owner_id, "new_booking", "New booking request", s.name + " on " + b.date + " at " + b.start));
  return [{ id, status: "pending", price, end_time: hm(mins(b.start) + dur), staff_id: staff }, 201];
});
r("GET", "/api/bookings", "client,business,staff", "My bookings (role-aware). Query: status, from, to, q", null, async (c) => {
  const u = c.user; let sql = "SELECT bk.*,s.name service_name,cu.name client_name,st.name staff_name FROM bookings bk JOIN services s ON s.id=bk.service_id JOIN users cu ON cu.id=bk.client_id LEFT JOIN staff st ON st.id=bk.staff_id WHERE "; const a = [];
  if (u.role === "client") { sql += "bk.client_id=?"; a.push(u.sub); } else if (u.role === "staff") { sql += "bk.staff_id=?"; a.push(u.sub); } else { sql += "bk.business_id=?"; a.push((await biz(c)).id); }
  const st = c.q.get("status"); if (st) { sql += " AND bk.status=?"; a.push(st); }
  if (c.q.get("from")) { sql += " AND bk.date>=?"; a.push(c.q.get("from")); } if (c.q.get("to")) { sql += " AND bk.date<=?"; a.push(c.q.get("to")); }
  if (c.q.get("q")) { sql += " AND (s.name LIKE ? OR cu.name LIKE ?)"; a.push("%" + c.q.get("q") + "%", "%" + c.q.get("q") + "%"); }
  return c.all(sql + " ORDER BY bk.date DESC,bk.start_time DESC LIMIT 200", ...a);
});
r("GET", "/api/bookings/:id", "client,business,staff", "Booking details", null, (c) => loadBooking(c, c.params.id));
r("POST", "/api/bookings/:id/cancel", "client,business,staff", "Cancel a booking", { reason: "Change of plans" }, async (c) => { const b = await loadBooking(c, c.params.id); return setStatus(c, b, "cancelled", { notes: (b.notes || "") + " [cancelled: " + (c.body.reason || "n/a") + "]" }); });
r("POST", "/api/bookings/:id/reschedule", "client,business", "Move a booking to a new date and time", { date: "2026-12-06", start: "11:00" }, async (c) => {
  const b = await loadBooking(c, c.params.id); need(c.body, "date", "start"); if (!["pending", "upcoming"].includes(b.status)) bad("Only pending or upcoming bookings can be rescheduled", 409);
  const s = await c.one("SELECT * FROM services WHERE id=?", b.service_id), dur = mins(b.end_time) - mins(b.start_time);
  if (!(await slots(c, s, c.body.date, dur, b.staff_id, b.id)).some((x) => x.start === c.body.start)) bad("That time is not available", 409);
  await patch(c, "bookings", b.id, { date: c.body.date, start_time: c.body.start, end_time: hm(mins(c.body.start) + dur), status: "pending", updated_at: now() }, ["date", "start_time", "end_time", "status", "updated_at"]);
  for (const p of [b.client_id, b.owner_id].filter((x) => x !== c.user.sub)) await notify(c, p, "rescheduled", "Booking rescheduled", b.service_name + " moved to " + c.body.date + " " + c.body.start); return { rescheduled: true, status: "pending" };
});

// 3. Business platform
r("POST", "/api/business", "business", "Register your business (onboarding)", { name: "Glow Studio", category: "Hair", description: "Premium salon", address: "12 Admiralty Way", city: "Lagos", phone: "+2348000000000", hours: DAY }, async (c) => {
  need(c.body, "name"); if (await c.one("SELECT id FROM businesses WHERE owner_id=?", c.user.sub)) bad("Business already registered", 409);
  const id = uid(), b = c.body; await c.run("INSERT INTO businesses(id,owner_id,name,description,category,address,city,lat,lng,phone,hours) VALUES(?,?,?,?,?,?,?,?,?,?,?)", id, c.user.sub, b.name, b.description || "", b.category || "", b.address || "", b.city || "", b.lat || null, b.lng || null, b.phone || "", JSON.stringify(b.hours || {})); return [{ id }, 201];
});
r("GET", "/api/business/me", "business,staff", "Get my business profile", null, async (c) => { const b = await biz(c); return { ...b, hours: pj(b.hours, {}) }; });
r("PUT", "/api/business/me", "business", "Update business info, location and operating hours", { name: "Glow Studio", hours: DAY }, async (c) => { await patch(c, "businesses", (await biz(c)).id, c.body, ["name", "description", "category", "address", "city", "lat", "lng", "phone", "logo", "hours"]); return { updated: true }; });
r("GET", "/api/business/services", "business", "List my services", null, async (c) => c.all("SELECT * FROM services WHERE business_id=?", (await biz(c)).id));
r("POST", "/api/business/services", "business", "Add a service or package, with optional add-ons", { name: "Silk Press", category: "Hair", description: "Smooth finish", price: 15000, duration: 90, kind: "service", images: [], addons: [{ name: "Deep conditioning", price: 3000, duration: 20 }] }, async (c) => {
  const b = c.body; need(b, "name", "price", "duration"); const bz = await biz(c), id = uid();
  await c.run("INSERT INTO services(id,business_id,category,name,description,price,duration,kind,images) VALUES(?,?,?,?,?,?,?,?,?)", id, bz.id, b.category || bz.category, b.name, b.description || "", b.price, b.duration, b.kind || "service", JSON.stringify(b.images || []));
  for (const a of b.addons || []) await c.run("INSERT INTO addons(id,service_id,name,price,duration) VALUES(?,?,?,?,?)", uid(), id, a.name, a.price, a.duration || 0); return [{ id }, 201];
});
const ownSvc = async (c) => (await c.one("SELECT * FROM services WHERE id=? AND business_id=?", c.params.id, (await biz(c)).id)) || bad("Service not found", 404);
r("PUT", "/api/business/services/:id", "business", "Update a service", { price: 16000, active: 1 }, async (c) => { await ownSvc(c); await patch(c, "services", c.params.id, c.body, ["name", "category", "description", "price", "duration", "kind", "images", "active"]); return { updated: true }; });
r("DELETE", "/api/business/services/:id", "business", "Delete a service", null, async (c) => { await ownSvc(c); await c.run("DELETE FROM addons WHERE service_id=?", c.params.id); await c.run("DELETE FROM services WHERE id=?", c.params.id); return { deleted: true }; });
r("POST", "/api/business/services/:id/addons", "business", "Add an add-on to a service", { name: "Scalp massage", price: 2000, duration: 10 }, async (c) => { await ownSvc(c); need(c.body, "name", "price"); const id = uid(); await c.run("INSERT INTO addons VALUES(?,?,?,?,?)", id, c.params.id, c.body.name, c.body.price, c.body.duration || 0); return [{ id }, 201]; });
r("DELETE", "/api/business/services/:id/images", "business", "Remove one image URL from a service", { url: "https://res.cloudinary.com/demo/image/upload/abc.jpg" }, async (c) => { const s = await ownSvc(c); const imgs = pj(s.images, []).filter((u) => u !== c.body.url); await c.run("UPDATE services SET images=? WHERE id=?", JSON.stringify(imgs), s.id); c.ctx.waitUntil(cldDelete(c.env, c.body.url)); return { images: imgs }; });
r("POST", "/api/business/services/:id/images", "business", "Attach an uploaded image URL to a service", { url: "https://res.cloudinary.com/demo/image/upload/abc.jpg" }, async (c) => { const s = await ownSvc(c); need(c.body, "url"); const imgs = [...pj(s.images, []), c.body.url]; await c.run("UPDATE services SET images=? WHERE id=?", JSON.stringify(imgs), s.id); return { images: imgs }; });

// Staff management
const ownStaff = async (c) => (await c.one("SELECT * FROM staff WHERE id=? AND business_id=?", c.params.id, (await biz(c)).id)) || bad("Staff not found", 404);
r("GET", "/api/business/staff", "business", "List staff", null, async (c) => c.all("SELECT id,name,phone,email,title,image,login_code,onboarded,active FROM staff WHERE business_id=?", (await biz(c)).id));
r("POST", "/api/business/staff", "business", "Add staff and generate their login code", { name: "Chika", phone: "+2348011111111", title: "Stylist" }, async (c) => {
  need(c.body, "name"); const id = uid(), code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join("");
  await c.run("INSERT INTO staff(id,business_id,name,phone,email,title,login_code) VALUES(?,?,?,?,?,?,?)", id, (await biz(c)).id, c.body.name, c.body.phone || null, c.body.email || null, c.body.title || "", code);
  if (c.body.phone) c.ctx.waitUntil(sendSMS(c.env, c.body.phone, "Your Trend staff login code is " + code)); return [{ id, login_code: code }, 201];
});
r("PUT", "/api/business/staff/:id", "business", "Update staff profile", { title: "Senior stylist" }, async (c) => { await ownStaff(c); await patch(c, "staff", c.params.id, c.body, ["name", "phone", "email", "title", "image", "active"]); return { updated: true }; });
r("DELETE", "/api/business/staff/:id", "business", "Remove staff", null, async (c) => { await ownStaff(c); await c.run("UPDATE staff SET active=0,login_code=NULL WHERE id=?", c.params.id); return { removed: true }; });
r("POST", "/api/business/staff/:id/new-code", "business", "Generate a new login code for staff", null, async (c) => { await ownStaff(c); const code = uid().slice(0, 6).toUpperCase(); await c.run("UPDATE staff SET login_code=? WHERE id=?", code, c.params.id); return { login_code: code }; });
r("PUT", "/api/business/staff/:id/schedule", "business", "Set staff work schedule and breaks", { schedule: DAY, breaks: [["13:00", "14:00"]] }, async (c) => { await ownStaff(c); await patch(c, "staff", c.params.id, c.body, ["schedule", "breaks"]); return { updated: true }; });
r("GET", "/api/business/portfolio", "business", "List portfolio uploads awaiting review", null, async (c) => c.all("SELECT p.*,s.name staff_name FROM portfolio p JOIN staff s ON s.id=p.staff_id WHERE s.business_id=? ORDER BY p.approved,p.created_at DESC", (await biz(c)).id));
r("POST", "/api/business/portfolio/:id/approve", "business", "Approve a staff portfolio image", null, async (c) => { await c.run("UPDATE portfolio SET approved=1 WHERE id=? AND staff_id IN (SELECT id FROM staff WHERE business_id=?)", c.params.id, (await biz(c)).id); return { approved: true }; });

// 4. Appointment management
r("POST", "/api/bookings/:id/accept", "business", "Accept a pending booking (moves to upcoming)", null, async (c) => setStatus(c, await loadBooking(c, c.params.id), "upcoming"));
r("POST", "/api/bookings/:id/decline", "business", "Decline a pending booking", { reason: "Fully booked" }, async (c) => setStatus(c, await loadBooking(c, c.params.id), "declined"));
r("POST", "/api/bookings/:id/status", "business,staff", "Move booking to: awaiting_arrival, in_progress, cancelled", { status: "awaiting_arrival" }, async (c) => { need(c.body, "status"); if (c.body.status === "completed") bad("Use /complete"); return setStatus(c, await loadBooking(c, c.params.id), c.body.status, c.body.status === "in_progress" ? { started_at: now() } : {}); });
r("POST", "/api/bookings/:id/start", "business,staff", "Start the appointment and its timer", null, async (c) => setStatus(c, await loadBooking(c, c.params.id), "in_progress", { started_at: now() }));
r("POST", "/api/bookings/:id/complete", "business,staff", "Mark the appointment complete. Client is asked to approve.", null, async (c) => { const b = await loadBooking(c, c.params.id); const out = await setStatus(c, b, "completed", { completed_at: now() }); return { ...out, duration_minutes: Math.round((Date.now() - Date.parse(b.started_at || now())) / 60000) }; });
r("POST", "/api/bookings/:id/approve", "client", "Client confirms the service was completed", null, async (c) => { const b = await loadBooking(c, c.params.id); if (b.status !== "completed") bad("Booking is not completed", 409); await c.run("UPDATE bookings SET client_approved=1 WHERE id=?", b.id); return { approved: true }; });

// 5. Staff platform
r("PUT", "/api/staff/onboarding", "staff", "Complete staff onboarding", { name: "Chika", title: "Stylist", image: "https://res.cloudinary.com/demo/image/upload/me.jpg" }, async (c) => { await patch(c, "staff", c.user.sub, { ...c.body, onboarded: 1 }, ["name", "title", "image", "onboarded"]); return { onboarded: true }; });
r("GET", "/api/staff/me", "staff", "My profile with business info", null, async (c) => ({ staff: await c.one("SELECT id,name,title,image,phone,schedule,breaks FROM staff WHERE id=?", c.user.sub), business: await biz(c) }));
r("PUT", "/api/staff/availability", "staff", "Update my availability, schedule and breaks", { schedule: DAY, breaks: [["13:00", "14:00"]] }, async (c) => { await patch(c, "staff", c.user.sub, c.body, ["schedule", "breaks"]); return { updated: true }; });
r("POST", "/api/staff/portfolio", "staff", "Add an uploaded image to my portfolio (needs business approval)", { url: "https://res.cloudinary.com/demo/image/upload/work1.jpg" }, async (c) => { need(c.body, "url"); const id = uid(); await c.run("INSERT INTO portfolio(id,staff_id,url) VALUES(?,?,?)", id, c.user.sub, c.body.url); return [{ id, approved: false }, 201]; });
r("GET", "/api/staff/portfolio", "staff", "My portfolio", null, (c) => c.all("SELECT * FROM portfolio WHERE staff_id=?", c.user.sub));
r("GET", "/api/staff/stats", "staff", "My statistics and client reviews. Query: from, to", null, async (c) => ({ ...(await statsFor(c, "staff_id=?", [c.user.sub])), reviews: await c.all("SELECT rating,comment,created_at FROM reviews WHERE staff_id=? ORDER BY created_at DESC LIMIT 50", c.user.sub) }));

// 6. Messaging and notifications
r("GET", "/api/conversations", "any", "List my conversations with last activity and unread count", null, (c) => c.all("SELECT CASE WHEN sender_id=?1 THEN recipient_id ELSE sender_id END peer,MAX(created_at) last_at,SUM(CASE WHEN recipient_id=?1 AND is_read=0 THEN 1 ELSE 0 END) unread FROM messages WHERE sender_id=?1 OR recipient_id=?1 GROUP BY peer ORDER BY last_at DESC", c.user.sub));
r("GET", "/api/messages", "any", "Messages with one person. Query: with (user id)", null, async (c) => { const w = c.q.get("with") || bad("with required"); await c.run("UPDATE messages SET is_read=1 WHERE sender_id=? AND recipient_id=?", w, c.user.sub); return c.all("SELECT * FROM messages WHERE (sender_id=?1 AND recipient_id=?2) OR (sender_id=?2 AND recipient_id=?1) ORDER BY created_at LIMIT 300", c.user.sub, w); });
r("POST", "/api/messages", "any", "Send a message, optionally with an uploaded media URL", { to: "USER_ID", body: "Hello!", media_url: "" }, async (c) => { need(c.body, "to"); if (!c.body.body && !c.body.media_url) bad("body or media_url required"); const id = uid(); await c.run("INSERT INTO messages(id,sender_id,recipient_id,body,media_url) VALUES(?,?,?,?,?)", id, c.user.sub, c.body.to, c.body.body || "", c.body.media_url || null); c.ctx.waitUntil(notify(c, c.body.to, "message", "New message", (c.body.body || "Sent you media").slice(0, 80))); return [{ id }, 201]; });
r("GET", "/api/notifications", "any", "My notifications", null, (c) => c.all("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100", c.user.sub));
r("POST", "/api/notifications/:id/read", "any", "Mark a notification as read", null, async (c) => { await c.run("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?", c.params.id, c.user.sub); return { read: true }; });
r("PUT", "/api/settings/notifications", "client,business", "Set SMS and email notification preferences", { sms: true, email: true }, async (c) => { await c.run("UPDATE users SET settings=? WHERE id=?", JSON.stringify({ sms: c.body.sms !== false, email: c.body.email !== false }), c.user.sub); return { updated: true }; });

// 7. Payments (manual)
r("GET", "/api/payments/bank-details", "-", "Trend's bank account details for manual transfers", null, (c) => pj(c.env.BANK_DETAILS, {}));
r("POST", "/api/payments", "client", "Client submits a payment confirmation for a booking", { booking_id: "BOOKING_ID", amount: 15000, method: "transfer", reference: "TRF123", proof_url: "https://res.cloudinary.com/demo/image/upload/receipt.jpg" }, async (c) => {
  need(c.body, "booking_id", "amount"); const b = await loadBooking(c, c.body.booking_id), id = uid();
  await c.run("INSERT INTO payments(id,kind,booking_id,payer_id,business_id,amount,method,reference,proof_url) VALUES(?,?,?,?,?,?,?,?,?)", id, "client_payment", b.id, c.user.sub, b.business_id, c.body.amount, c.body.method || "transfer", c.body.reference || "", c.body.proof_url || null); return [{ id, status: "pending" }, 201];
});
r("POST", "/api/payments/cash", "business,staff", "Record a cash payment for a booking", { booking_id: "BOOKING_ID", amount: 15000 }, async (c) => { need(c.body, "booking_id", "amount"); const b = await loadBooking(c, c.body.booking_id), id = uid(); await c.run("INSERT INTO payments(id,kind,booking_id,payer_id,business_id,amount,method,status) VALUES(?,?,?,?,?,?,?,?)", id, "client_payment", b.id, b.client_id, b.business_id, c.body.amount, "cash", "confirmed"); return [{ id, status: "confirmed" }, 201]; });
r("POST", "/api/payments/business-report", "business", "Business reports a payment made to Trend", { amount: 5000, reference: "TRF999", proof_url: "https://res.cloudinary.com/demo/image/upload/proof.jpg" }, async (c) => { need(c.body, "amount"); const id = uid(); await c.run("INSERT INTO payments(id,kind,payer_id,business_id,amount,method,reference,proof_url) VALUES(?,?,?,?,?,?,?,?)", id, "business_remittance", c.user.sub, (await biz(c)).id, c.body.amount, "transfer", c.body.reference || "", c.body.proof_url || null); return [{ id, status: "pending" }, 201]; });
r("GET", "/api/payments", "client,business,admin", "List payments. Query: status (pending, confirmed, incomplete, unsuccessful)", null, async (c) => {
  const u = c.user, st = c.q.get("status"); const w = u.role === "admin" ? "1=1" : u.role === "client" ? "payer_id=?" : "business_id=?"; const a = u.role === "admin" ? [] : [u.role === "client" ? u.sub : (await biz(c)).id];
  return c.all("SELECT * FROM payments WHERE " + w + (st ? " AND status=?" : "") + " ORDER BY created_at DESC LIMIT 200", ...a, ...(st ? [st] : []));
});
r("POST", "/api/payments/:id/verify", "admin", "Admin sets verification status after checking the bank", { status: "confirmed" }, async (c) => {
  if (!["confirmed", "incomplete", "unsuccessful"].includes(c.body.status)) bad("status must be confirmed, incomplete or unsuccessful");
  await c.run("UPDATE payments SET status=?,verified_at=? WHERE id=?", c.body.status, now(), c.params.id); return { updated: true };
});
r("GET", "/api/business/balance", "business", "Commission owed to Trend vs payments confirmed", null, async (c) => {
  const id = (await biz(c)).id, pct = +c.env.COMMISSION_PCT || 10;
  const sum = async (cond) => (await c.one("SELECT COALESCE(SUM(amount),0) t FROM payments WHERE business_id=? AND " + cond, id)).t;
  const cash = await sum("method='cash' AND status='confirmed'"), paid = await sum("kind='business_remittance' AND status='confirmed'"), pending = await sum("kind='business_remittance' AND status='pending'");
  const owed = Math.max(0, (cash * pct) / 100 - paid); return { commission_pct: pct, cash_collected: cash, paid_to_trend: paid, pending_verification: pending, outstanding: owed };
});
r("GET", "/api/business/payout", "business", "Get payout wallet details", null, async (c) => (await c.one("SELECT * FROM payouts WHERE business_id=?", (await biz(c)).id)) || {});
r("PUT", "/api/business/payout", "business", "Set payout wallet details", { bank_name: "GTBank", account_number: "0123456789", account_name: "Glow Studio" }, async (c) => { need(c.body, "bank_name", "account_number", "account_name"); const b = c.body; await c.run("INSERT INTO payouts VALUES(?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET bank_name=?2,account_number=?3,account_name=?4", (await biz(c)).id, b.bank_name, b.account_number, b.account_name); return { saved: true }; });

// 8. Statistics
r("GET", "/api/stats/business", "business", "Revenue, appointments by status, monthly comparison, new vs returning clients. Query: from, to", null, async (c) => statsFor(c, "business_id=?", [(await biz(c)).id]));
r("GET", "/api/stats/staff/:id", "business", "Performance of one staff member. Query: from, to", null, async (c) => { await ownStaff(c); return statsFor(c, "staff_id=?", [c.params.id]); });

/* ---------- dispatcher ---------- */
const compile = (p) => new RegExp("^" + p.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$");
routes.forEach((x) => (x.re = compile(x.path)));
const can = (auth, role) => auth === "-" || auth === "any" || auth.split(",").includes(role) || role === "admin";

export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url), p = url.pathname;
    if (p === "/" || p === "/docs") return new Response(DOCS_HTML, { headers: { "content-type": "text/html;charset=utf-8" } });
    if (p === "/api/_routes") return J(routes.map(({ method, path, auth, summary, example, file }) => ({ method, path, auth, summary, example, file: !!file })));
    try {
      for (const x of routes) {
        if (x.method !== req.method) continue; const m = p.match(x.re); if (!m) continue;
        const c = { env, ctx, req, q: url.searchParams, params: m.groups || {}, body: {}, user: null };
        c.all = async (s, ...a) => (await env.DB.prepare(s).bind(...a).all()).results;
        c.one = (s, ...a) => env.DB.prepare(s).bind(...a).first();
        c.run = (s, ...a) => env.DB.prepare(s).bind(...a).run();
        if (x.auth !== "-") {
          c.user = await verifyJWT(env, (req.headers.get("authorization") || "").replace(/^Bearer /i, ""));
          if (!c.user) bad("Sign in required. Send Authorization: Bearer <token>", 401);
          if (!can(x.auth, c.user.role)) bad("This route is for: " + x.auth, 403);
        }
        if (["POST", "PUT", "DELETE"].includes(req.method) && !x.file && (req.headers.get("content-type") || "").includes("json")) c.body = await req.json().catch(() => bad("Body must be valid JSON"));
        const out = await x.handler(c); const [data, status] = Array.isArray(out) ? out : [out, 200];
        return J(data, status);
      }
      return J({ error: "Route not found: " + req.method + " " + p }, 404);
    } catch (e) {
      if (e instanceof E) return J({ error: e.message }, e.s);
      console.error(e); return J({ error: "Server error", detail: String(e.message || e) }, 500);
    }
  },
};

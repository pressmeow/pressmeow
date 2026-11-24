// Draws every picture on the profile and writes README.md.
// Pictures that change (island, pet, trophies) come from the contribution calendar; the README links each one with a content hash so GitHub shows the new one.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { svgDoc } from "./pixel.mjs";
import {
  C, W, SHADOW, DEFS, win, frame, macButton, float, blink, twinkle, at, sprite, text, textWidth,
  CATC, catSprite, HEART, STAR, SPARK, FISH, YARN, CLOUD, SUN, ZZZ,
} from "./art.mjs";
import { fortune } from "./fortune.mjs";
import * as ttt from "./ttt.mjs";

const USER = process.env.GH_USER || "pressmeow";
const REPO = `${USER}/${USER}`;
const OFFSET = +(process.env.TZ_OFFSET ?? 9); // hours from UTC for the sky and the cat's day
// local time as a Date whose UTC fields read as local; FAKE_NOW ("2026-12-25T21:00") or FAKE_HOUR are for trying things out
const localNow = () =>
  process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW + "Z")
  : process.env.FAKE_HOUR ? new Date(Date.UTC(2026, 0, 1, +process.env.FAKE_HOUR))
  : new Date(Date.now() + OFFSET * 3600e3);
const centerText = (s, y, u, color, w = W) => text(s, Math.round((w - textWidth(s) * u) / 2 / u), y, u, color).svg;

const SITE = "https://pressmeow.github.io";
const LINKEDIN = "https://www.linkedin.com/in/nami-nam/";
const APPS = [
  { id: "isleday", name: "Isleday", desc: "Small habits grow a pixel island", chips: [["SITE", "https://isleday.app"], ["IOS", "https://apps.apple.com/app/isleday/id6816646663"]] },
  { id: "tuttiday", name: "tuttiday", desc: "Band rehearsals, set in one vote", chips: [["IOS", "https://apps.apple.com/kr/app/tuttiday/id6818943301"], ["ANDROID", "https://play.google.com/store/apps/details?id=com.tuttiday.app"], ["WEB", "https://tuttiday.com"]] },
  { id: "iyyko", name: "iyyko", desc: "One-minute games and tests", chips: [["WEB", "https://www.iyyko.com"]] },
  { id: "ourhour", name: "Ourhour", desc: "Your shared hours, across time zones", chips: [["SITE", "https://goldenhour-timezones.vercel.app"], ["BETA", "https://testflight.apple.com/join/1Yh1QZCH"]] },
];
// the card itself opens the website (or the only link); each platform chip under it is its own picture and link
APPS.forEach((a) => (a.url = (a.chips.find(([l]) => l === "SITE" || l === "WEB") ?? a.chips[0])[1]));

// ---------- data ----------
async function calendar() {
  const token = process.env.GITHUB_TOKEN || execSync("gh auth token").toString().trim();
  const q = `query($l:String!){user(login:$l){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-builder" },
    body: JSON.stringify({ query: q, variables: { l: USER } }),
  });
  const j = await r.json();
  if (!j.data) throw new Error(JSON.stringify(j));
  return j.data.user.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays).map((d) => ({ date: d.date, n: d.contributionCount }));
}
// newest posts from the website's feed; an empty list if the site can't be reached
async function notes() {
  try {
    const xml = await (await fetch(`${SITE}/feed.xml`, { headers: { "User-Agent": "profile-builder" } })).text();
    const unxml = (t) => t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&").trim();
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
      title: unxml(e.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? ""),
      url: e.match(/<link href="([^"]+)"/)?.[1] ?? `${SITE}/blog/`,
      date: (e.match(/<published>([^<]+)/)?.[1] ?? "").slice(0, 10),
      summary: unxml(e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? ""),
    }));
  } catch { return []; }
}
function stats(days) {
  const total = days.reduce((s, d) => s + d.n, 0);
  let longest = 0, run = 0;
  for (const d of days) { run = d.n ? run + 1 : 0; longest = Math.max(longest, run); }
  let i = days.length - 1, current = 0;
  if (days[i] && !days[i].n) i--;
  for (; i >= 0 && days[i].n; i--) current++;
  const active = days.filter((d) => d.n).length;
  return { total, longest, current, active, week: days.slice(-7), today: days.at(-1)?.n ?? 0, yesterday: days.at(-2)?.n ?? 0 };
}

// ---------- ID card: who I am, a few numbers, the tools I use ----------
const ME = {
  name: "NAMI",
  role: "DEV · DESIGNER",
  lines: ["BY DAY: BUILDING PRODUCTS WITH A TEAM", "ON THE SIDE: ISLEDAY, TUTTIDAY, IYYKO", "COOKING: OURHOUR"],
  tools: ["MACOS", "WINDOWS", "XCODE", "INTELLIJ IDEA", "VS CODE", "CLAUDE CODE", "FIGMA", "DOCKER", "NOTION"],
  status: "NOW: SHIPPING OURHOUR",
};
function idCard(s, noteCount) {
  const ww = W - SHADOW;
  // tools, as chips that wrap; laid out first so the card can fit them
  let chips = "", cx = 24, cy = 222;
  for (const t of ME.tools) {
    const w = textWidth(t) * 2 + 20;
    if (cx + w > ww - 20) { cx = 24; cy += 34; }
    chips += `<rect x="${cx}" y="${cy}" width="${w}" height="26" fill="#000"/><rect x="${cx + 2}" y="${cy + 2}" width="${w - 4}" height="22" fill="#fff"/>`;
    chips += text(t, (cx + 10) / 2, (cy + 8) / 2, 2, "#000").svg;
    cx += w + 8;
  }
  const H = cy + 26 + 22 + 40 + SHADOW;
  let b = frame(H, "ID CARD");
  // photo: iyyko stands in for me
  b += `<rect x="24" y="52" width="132" height="132" fill="#000"/><rect x="27" y="55" width="126" height="126" fill="${C.light}"/>`;
  b += float(at(48, 66, sprite(catSprite("happy"), CATC, 0, 0, 7)), 3, 2);
  b += text(ME.name, 176 / 5, 58 / 5, 5, "#000").svg;
  b += text("@" + USER, (176 + textWidth(ME.name) * 5 + 16) / 2, 68 / 2, 2, C.soft).svg;
  b += text(ME.role, 176 / 3, 96 / 3, 3, C.pink).svg;
  ME.lines.forEach((l, i) => (b += text(l, 176 / 2, (128 + i * 18) / 2, 2, C.soft).svg));
  // numbers
  const stats = [["STREAK", `${s.current} DAYS`], ["COMMITS", `${s.total}`], ["NOTES", `${noteCount >= 10 ? "10+" : noteCount}`], ["APPS", "3 LIVE"]];
  stats.forEach(([label, value], i) => {
    const x = 520 + (i % 2) * 134, y = 52 + Math.floor(i / 2) * 68;
    b += `<rect x="${x}" y="${y}" width="126" height="60" fill="#000"/><rect x="${x + 3}" y="${y + 3}" width="120" height="54" fill="${i === 0 ? C.pinkL : "#fff"}"/>`;
    b += text(label, (x + 10) / 2, (y + 10) / 2, 2, C.soft).svg;
    const vu = textWidth(value) * 4 > 104 ? 3 : 4;
    b += text(value, (x + 10) / vu, (y + 28) / vu, vu, "#000").svg;
  });
  // tools, as chips that wrap
  b += text("TOOLS", 24 / 2, 204 / 2, 2, C.soft).svg + chips;
  // status strip
  const sy = H - SHADOW - 40;
  b += `<rect x="3" y="${sy}" width="${ww - 6}" height="3" fill="#000"/><rect x="3" y="${sy + 3}" width="${ww - 6}" height="34" fill="${C.light}"/>`;
  b += text(ME.status, 24 / 2, (sy + 14) / 2, 2, "#000").svg;
  b += blink(`<rect x="${24 + textWidth(ME.status) * 2 + 6}" y="${sy + 12}" width="6" height="12" fill="#000"/>`, 1);
  const upd = "UPDATED EVERY HOUR";
  b += text(upd, (ww - 24 - textWidth(upd) * 2) / 2, (sy + 14) / 2, 2, C.soft).svg;
  return svgDoc(W, H, b, `ID card: Nami (@${USER}), ${ME.role.toLowerCase()}. Streak ${s.current} days, ${s.total} commits, ${noteCount} notes on the blog. Tools: ${ME.tools.join(", ").toLowerCase()}`);
}

// ---------- app cards: one small window per app ----------
function appCard(a) {
  const w = 190, h = 206, u = 2, ww = w - SHADOW;
  let b = DEFS + win(w, h, a.name.toUpperCase(), { tu: 3 });
  const png = readFileSync(`assets/${a.id}.png`).toString("base64");
  const ix = (ww - 96) / 2;
  b += float(`<rect x="${ix - 4}" y="46" width="104" height="104" fill="#000"/><image href="data:image/png;base64,${png}" x="${ix}" y="50" width="96" height="96"/>`, 4, 2.4, APPS.indexOf(a) * 0.3);
  const words = a.desc.toUpperCase().split(" "), ls = [""];
  for (const wd of words) (ls.at(-1) + " " + wd).trim().length > 20 ? ls.push(wd) : (ls[ls.length - 1] = (ls.at(-1) + " " + wd).trim());
  ls.slice(0, 2).forEach((l, i) => (b += centerText(l, 168 / u + i * 8, u, C.ink, ww)));
  return svgDoc(w, h, b, `${a.name}: ${a.desc}`);
}
// one platform chip; n chips share the card's 190px width, so they line up under it at the same scale
function chip(label, n) {
  const w = 190 / n, u = 2, rw = w - 6;
  let b = `<rect x="2" y="2" width="${rw}" height="28" fill="${label === "SOON" || label === "BETA" ? C.pink : "#000"}"/>`;
  b += text(label, (2 + (rw - textWidth(label) * u) / 2) / u, 9 / u, u, "#fff").svg;
  return svgDoc(w, 36, b, label);
}

// ---------- notes: the newest posts from the blog ----------
// the pixel font only has ASCII, so other titles (Korean, emoji) fall back to a plain font
const ascii = (t) => /^[\x20-\x7E·]*$/.test(t);
const xmlEsc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cut = (t, n) => (t.length > n ? t.slice(0, n - 2).trimEnd() + ".." : t);
function line(t, x, y, u, color, max) {
  if (ascii(t)) return text(cut(t, Math.floor(max / (4 * u))), x / u, y / u, u, color).svg;
  const px = u * 6;
  return `<text x="${x}" y="${y + u * 5}" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="${px}" font-weight="${u > 2 ? 700 : 400}" fill="${color}">${xmlEsc(cut(t, Math.floor(max / (px * 0.95))))}</text>`;
}
function notesCard(posts, today) {
  const shown = posts.slice(0, 3), rowH = 66, top = 52, ww = W - SHADOW;
  const H = top + Math.max(1, shown.length) * rowH + 56;
  let b = frame(H, "NOTES.LOG");
  if (!shown.length) b += centerText("NO NOTES YET. SOON!", (top + 22) / 3, 3, C.soft, ww);
  shown.forEach((p, i) => {
    const y = top + i * rowH;
    b += text(p.date.replace(/-/g, "."), 28 / 2, (y + 8) / 2, 2, C.soft).svg;
    const fresh = (Date.parse(today) - Date.parse(p.date)) / 864e5 <= 7;
    if (fresh) b += `<rect x="28" y="${y + 26}" width="42" height="18" fill="${C.pink}"/>` + text("NEW", 34 / 2, (y + 30) / 2, 2, "#000").svg;
    b += line(p.title, 160, y + 4, 3, "#000", ww - 160 - 28);
    if (p.summary) b += line(p.summary, 160, y + 30, 2, C.soft, ww - 160 - 28);
    if (i < shown.length - 1) b += `<rect x="24" y="${y + rowH - 10}" width="${ww - 48}" height="2" fill="url(#half)"/>`;
  });
  // status strip, like the ID card
  const sy = H - SHADOW - 40, msg = "READ MORE ON MY WEBSITE";
  b += `<rect x="3" y="${sy}" width="${ww - 6}" height="3" fill="#000"/><rect x="3" y="${sy + 3}" width="${ww - 6}" height="34" fill="${C.light}"/>`;
  b += text(msg, 24 / 2, (sy + 14) / 2, 2, "#000").svg;
  b += blink(`<rect x="${24 + textWidth(msg) * 2 + 6}" y="${sy + 12}" width="6" height="12" fill="#000"/>`, 1);
  const n = `${posts.length >= 10 ? "10+" : posts.length} NOTES`;
  b += text(n, (ww - 24 - textWidth(n) * 2) / 2, (sy + 14) / 2, 2, C.soft).svg;
  const alt = shown.length ? `Latest notes: ${shown.map((p) => p.title).join(", ")}` : "No notes yet";
  return svgDoc(W, H, b, xmlEsc(alt));
}

// ---------- my island ----------
// plants by how many commits a day had; p is the accent bit
const PLANTS = [
  [".s.", "sss"],
  ["g.g", ".g.", ".g."],
  ["..p..", ".pwp.", "..p..", "g.g.g", ".ggg.", "..g.."],
  [".pp.pp.", "pgggggp", "gggpggg", "ggggggg", ".ggggg.", "...g..."],
  ["..ggggg..", ".gggpggg.", "ggpgggggg", "ggggggpgg", ".ggggggg.", "..ggggg..", "....g....", "....g....", "...ggg..."],
];
const plantFor = (n) => PLANTS[n === 0 ? 0 : n <= 4 ? 1 : n <= 14 ? 2 : n <= 29 ? 3 : 4];
const MOON = ["..mmm..", ".mm....", "mm.....", "mm.....", "mm.....", ".mm....", "..mmm.."];
// the island follows the real calendar: petals in spring, a boat in summer, leaves in autumn, snow in winter
function seasonOf(d) {
  const m = d.getUTCMonth() + 1, md = m * 100 + d.getUTCDate();
  const season = m >= 3 && m <= 5 ? "SPRING" : m >= 6 && m <= 8 ? "SUMMER" : m >= 9 && m <= 11 ? "AUTUMN" : "WINTER";
  const holiday = md === 101 ? "NEWYEAR" : md === 214 ? "VALENTINE" : md === 1031 ? "HALLOWEEN" : md === 1224 || md === 1225 ? "XMAS" : null;
  return { season, holiday };
}
const FALL = {
  SPRING: { colors: [C.pink, C.pinkL], n: 16, size: 1, dur: 9 },
  AUTUMN: { colors: [C.dark, C.mid], n: 12, size: 1, dur: 8 },
  WINTER: { colors: [C.mid, C.light], n: 24, size: 1, dur: 10 },
};
const HOLIDAYS = {
  NEWYEAR: { line: "HAPPY NEW YEAR!", deco: [STAR, SPARK] },
  VALENTINE: { line: "HAPPY VALENTINE'S DAY", deco: [HEART] },
  HALLOWEEN: { line: "HAPPY HALLOWEEN", deco: [["y.....y", "yy.y.yy", "yyyyyyy", ".y...y."]] },
  XMAS: { line: "MERRY CHRISTMAS!", deco: [STAR, SPARK] },
};
const BOAT = ["....p....", "...pp....", "..ppp....", ".pppp....", "....k....", "kkkkkkkkk", ".kkkkkkk."];
function falling(cfg, GW, GH, u, night) {
  let out = "";
  for (let k = 0; k < cfg.n; k++) {
    const x = (k * 37 + 11) % GW, sz = cfg.size + (k % 3 === 0 ? 1 : 0), dur = cfg.dur + (k % 4) * 1.5;
    const color = night && cfg.colors[0] === C.mid ? "#fff" : cfg.colors[k % cfg.colors.length];
    out += `<g><animateTransform attributeName="transform" type="translate" values="0 ${-4 * u};${3 * u} ${(GH * u) / 2};0 ${GH * u}" dur="${dur}s" begin="${(-k * dur) / cfg.n}s" repeatCount="indefinite"/><rect x="${x * u}" y="0" width="${sz * u}" height="${sz * u}" fill="${color}"/></g>`;
  }
  return out;
}
function island(s) {
  const u = 6, GW = 120, GH = 50, now = localNow(), hour = now.getUTCHours();
  const { season, holiday } = seasonOf(now), winter = season === "WINTER" || holiday === "XMAS";
  const night = hour < 6 || hour >= 20, dusk = hour >= 17 && hour < 20;
  const sky = night ? "#000" : "#fff", ink = night ? "#fff" : "#000";
  let b = `<rect width="${GW * u}" height="${GH * u}" fill="${sky}"/>`;
  if (dusk) b += `<rect width="${GW * u}" height="${12 * u}" fill="url(#dither)"/>`;
  if (night) for (const [x, y, d] of [[10, 6, 0], [25, 12, 1.2], [44, 4, 0.6], [70, 9, 1.8], [86, 15, 0.3], [108, 5, 1.1]])
    b += twinkle(`<rect x="${x * u}" y="${y * u}" width="${u}" height="${u}" fill="#fff"/>`, 2.4, d);
  b += night ? sprite(MOON, { m: holiday === "HALLOWEEN" ? C.pink : "#fff" }, 104, 3, u) : sprite(SUN, { o: "#000", w: "#fff" }, 104, 3, u);
  if (!night) for (const [y, dur, d] of [[6, 46, -10], [13, 64, -40]])
    b += `<g><animateTransform attributeName="transform" type="translate" from="${-12 * u} 0" to="${(GW + 2) * u} 0" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/>${sprite(CLOUD, { o: "#000", w: "#fff" }, 0, y, u)}</g>`;
  // the sea: a horizon line and drifting dashes
  b += `<rect y="${38 * u}" width="${GW * u}" height="${u / 2}" fill="${ink}"/>`;
  let waves = "";
  for (let k = 0; k < 14; k++) waves += `<rect x="${(k * 17 + (k % 3) * 5) * u}" y="${(41 + (k % 4) * 2) * u}" width="${3 * u}" height="${u / 2}" fill="${ink}"/>`;
  b += `<g><animateTransform attributeName="transform" type="translate" values="0 0;${3 * u} 0;0 0" dur="5s" repeatCount="indefinite"/>${waves}</g>`;
  if (season === "SUMMER") b += `<g><animateTransform attributeName="transform" type="translate" from="${-10 * u} 0" to="${(GW + 2) * u} 0" dur="40s" begin="-12s" repeatCount="indefinite"/>${sprite(BOAT, { p: C.pink, k: ink }, 0, 38, u)}</g>`;
  const cx = 60, rows = [[29, 36], [30, 38], [31, 39], [32, 40], [33, 40], [34, 39], [35, 38], [36, 36], [37, 33], [38, 29], [39, 24], [40, 17]];
  for (const [y, hw] of rows) {
    const fill = y <= 30 ? (winter ? "#fff" : night ? C.mid : "url(#half)") : y === 31 ? "#000" : y <= 35 ? "#fff" : y <= 37 ? "url(#dither)" : "url(#half)";
    b += `<rect x="${(cx - hw) * u}" y="${y * u}" width="${hw * 2 * u}" height="${u}" fill="${fill}"/>`;
    if (y <= 35) b += `<rect x="${(cx - hw) * u}" y="${y * u}" width="${u}" height="${u}" fill="#000"/><rect x="${(cx + hw - 1) * u}" y="${y * u}" width="${u}" height="${u}" fill="#000"/>`;
  }
  if (winter) b += `<rect x="${(cx - 36) * u}" y="${28.5 * u}" width="${72 * u}" height="${u / 2}" fill="#000"/>`;
  const WD = "SMTWTFS";
  s.week.forEach((d, i) => {
    const x = cx - 30 + i * 10, rows = plantFor(d.n), w = rows[0].length, h = rows.length, today = i === 6;
    const col = { s: ink, g: today ? C.pink : ink, p: C.pink, w: "#fff" };
    b += `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 ${-u} 0;0 0" keyTimes="0;0.5;1" calcMode="discrete" dur="1.6s" begin="${i * 0.23}s" repeatCount="indefinite"/>${sprite(rows, col, x - Math.floor(w / 2), 29 - h, u)}</g>`;
    b += text(WD[new Date(d.date + "T00:00:00Z").getUTCDay()], x - 1, 33, u, today ? C.pink : "#000").svg;
  });
  const fall = FALL[holiday === "XMAS" ? "WINTER" : season];
  if (fall) b += falling(fall, GW, GH, u, night);
  const label = night ? "#fff" : C.soft;
  b += text(`THIS WEEK: ${s.week.reduce((t, d) => t + d.n, 0)} COMMITS`, 4, 4, 3, label).svg;
  b += text(season, 196 - textWidth(season), 4, 3, label).svg;
  if (holiday) {
    const h = HOLIDAYS[holiday];
    [[14, 9], [38, 13], [84, 8], [96, 14], [24, 15]].forEach(([x, y], k) => {
      const c = [C.pink, C.lilac, ink][k % 3];
      b += float(at(x * u, y * u, sprite(h.deco[k % h.deco.length], { p: c, y: c }, 0, 0, u / 2)), 6, 1.6 + (k % 3) * 0.4, k * 0.3);
    });
    b += blink(text(h.line, Math.round((GW * u - textWidth(h.line) * 4) / 2 / 4), 14, 4, C.pink).svg, 1.4);
  }
  const H = 362;
  return svgDoc(W, H, frame(H, "MY ISLAND") + `<rect x="37" y="45" width="${GW * u + 6}" height="${GH * u + 6}" fill="#000"/><svg x="40" y="48" width="${GW * u}" height="${GH * u}">${b}</svg>`, `A pixel island in ${season.toLowerCase()} where each of this week's days is a plant that grows with the day's commits`);
}

// ---------- iyyko, the pet: every commit feeds it ----------
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
// visitors' feed / play / pat from the last 12 hours top the bars up
const VISIT = { feed: "hunger", play: "fun", pat: "love" };
function petStats(s, hour, visits = []) {
  // food is today's commits; without any, iyyko gets hungrier as the day goes on
  const p = {
    hunger: s.today ? 55 + s.today * 9 : (s.yesterday ? 70 : 45) - hour * 2,
    fun: (s.week.filter((d) => d.n).length / 7) * 100, // busy days this week
    love: 25 + s.current * 12, // the streak
  };
  for (const v of visits) if (Date.now() - Date.parse(v.at) < 12 * 3600e3) p[VISIT[v.action]] += 15;
  return { hunger: clamp(p.hunger), fun: clamp(p.fun), love: clamp(p.love) };
}
const ago = (iso) => {
  const m = (Date.now() - Date.parse(iso)) / 60e3;
  return m < 2 ? "JUST NOW" : m < 60 ? `${Math.round(m)}M AGO` : m < 1440 ? `${Math.round(m / 60)}H AGO` : `${Math.round(m / 1440)}D AGO`;
};
function pet(s, saved) {
  const H = 336, hour = localNow().getUTCHours(), p = petStats(s, hour, saved.log);
  const last = saved.log[0], recent = last && Date.now() - Date.parse(last.at) < 90 * 60e3;
  let b = frame(H, "IYYKO PET");
  // the egg-shaped toy, drawn row by row with a black outline
  const ex = 150, ey = 186, rx = 104, ry = 128, g = 6, rowsAt = [];
  for (let y = -ry; y < ry; y += g) {
    const k = 1 - ((y + g / 2 + 14) / ry) ** 2; if (k <= 0) continue;
    rowsAt.push([y, Math.round((rx * Math.sqrt(k)) / g) * g]);
  }
  rowsAt.forEach(([y, hw], i) => {
    const edge = i === 0 || i === rowsAt.length - 1;
    b += `<rect x="${ex - hw}" y="${ey + y}" width="${hw * 2}" height="${g}" fill="#000"/>`;
    if (!edge) b += `<rect x="${ex - hw + g}" y="${ey + y}" width="${hw * 2 - 2 * g}" height="${g}" fill="#fff"/>`;
  });
  b += `<rect x="78" y="116" width="144" height="120" fill="#000"/><rect x="84" y="122" width="132" height="108" fill="${C.light}"/>`;
  [[110, 258], [150, 270], [190, 258]].forEach(([x, y], i) => (b += `<rect x="${x - 9}" y="${y - 9}" width="18" height="18" fill="${i === 1 ? C.pink : "#000"}"/>`));
  for (let i = 0; i < 6; i++) b += `<rect x="${102 + i * 18}" y="86" width="9" height="6" fill="#000"/>`;
  // what iyyko is up to
  const low = Math.min(p.hunger, p.fun, p.love);
  const asleep = !recent && hour < 7;
  const fed = !asleep && s.today > 0;
  const face = asleep ? "closed" : recent || (fed && p.hunger >= 70) ? "happy" : low < 15 ? "grumpy" : low < 40 ? "sad" : low >= 70 ? "happy" : "open";
  const mood = asleep ? "SLEEPING" : recent ? { feed: "YUMMY!", play: "SO FUN!", pat: "PURR PURR" }[last.action] : fed && p.hunger >= 90 ? "SO FULL!" : fed ? "YUMMY!" : low < 15 ? "GRUMPY" : low < 40 ? (p.hunger === low ? "HUNGRY" : p.fun === low ? "BORED" : "LONELY") : low >= 70 ? "HAPPY" : "OKAY";
  const lcd = { o: "#000", w: C.light, k: "#000", h: C.mid };
  b += float(at(104, 138, sprite(catSprite(face), lcd, 0, 0, 5)), asleep ? 0 : 4, 1.2);
  if (asleep) [0, 1, 2].forEach((k) => (b += `<g opacity="0"><animate attributeName="opacity" values="0;1;0" dur="3s" begin="${k}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;8 -16" dur="3s" begin="${k}s" repeatCount="indefinite"/>${at(176, 132, sprite(ZZZ, { z: "#000" }, 0, 0, 3))}</g>`));
  else if (recent && last.action === "play") b += `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -18;0 0" dur="0.7s" repeatCount="indefinite"/>${at(178, 194, sprite(YARN, { y: "#000" }, 0, 0, 3))}</g>`;
  else if (recent && last.action === "pat") b += twinkle(at(170, 130, sprite(HEART, { p: C.pink }, 0, 0, 3)), 1.2, 0) + twinkle(at(94, 134, sprite(HEART, { p: C.pink }, 0, 0, 2)), 1.2, 0.6);
  else if (fed || recent) b += float(at(172, 198, sprite(FISH, { f: "#000", k: C.light }, 0, 0, 3)), 3, 0.5);
  else if (p.love >= 70) b += twinkle(at(170, 130, sprite(HEART, { p: "#000" }, 0, 0, 3)), 1.2, 0) + twinkle(at(94, 134, sprite(HEART, { p: "#000" }, 0, 0, 2)), 1.2, 0.6);
  // stats
  const tx = 300;
  b += text("IYYKO", tx / 6, 66 / 6, 6, "#000").svg;
  b += text(`FEELING: ${mood}`, tx / 3, 110 / 3, 3, C.pink).svg;
  const bars = [["HUNGER", p.hunger, FISH, { f: "#000", k: "#fff" }], ["FUN", p.fun, YARN, { y: "#000" }], ["LOVE", p.love, HEART, { p: C.pink }]];
  bars.forEach(([label, v, icon, col], i) => {
    const y = 144 + i * 40;
    b += at(tx, y, sprite(icon, col, 0, 0, 3));
    b += text(label, (tx + 34) / 3, (y + 2) / 3, 3, "#000").svg;
    const on = Math.round(v / 5), color = v < 25 ? C.pink : "#000";
    b += `<rect x="${tx + 147}" y="${y - 3}" width="${20 * 15 + 3}" height="24" fill="#000"/><rect x="${tx + 150}" y="${y}" width="${20 * 15 - 3}" height="18" fill="#fff"/>`;
    for (let k = 0; k < on; k++) b += `<rect x="${tx + 150 + k * 15}" y="${y}" width="12" height="18" fill="${color}"/>`;
  });
  b += text(`TODAY: ${s.today} ${s.today === 1 ? "COMMIT" : "COMMITS"} = ${s.today} ${s.today === 1 ? "FISH" : "FISHES"}`, tx / 2, 278 / 2, 2, C.soft).svg;
  const said = { feed: "FED", play: "PLAYED WITH", pat: "PETTED" };
  const who = last ? `LAST: ${last.login.length > 16 ? last.login.slice(0, 15) + ".." : last.login} ${said[last.action]} IYYKO ${ago(last.at)}` : "NO VISITORS YET. PRESS A BUTTON BELOW!";
  b += text(who, tx / 2, 298 / 2, 2, last ? "#000" : C.pink).svg;
  return svgDoc(W, H, b, `iyyko the pet cat is feeling ${mood.toLowerCase()}: hunger ${p.hunger}, fun ${p.fun}, love ${p.love}`);
}

// ---------- arcade ----------
function arcade() {
  const H = 306;
  let b = frame(H, "ARCADE");
  // cabinet
  b += `<rect x="87" y="45" width="206" height="249" fill="#000"/><rect x="90" y="48" width="200" height="243" fill="url(#dither)"/>`;
  b += `<rect x="100" y="48" width="180" height="40" fill="#000"/>`;
  b += blink(text("IYYKO", 130 / 6, 56 / 6, 6, "#fff").svg, 1.2);
  b += `<rect x="104" y="96" width="172" height="120" fill="#000"/><rect x="112" y="104" width="156" height="104" fill="#000"/>`;
  // the game on the screen: iyyko hops over fish forever
  b += `<rect x="112" y="192" width="156" height="3" fill="#fff"/>`;
  b += `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -40;0 0;0 0" keyTimes="0;0.25;0.5;1" dur="1.4s" repeatCount="indefinite"/>${at(130, 156, sprite(catSprite("happy"), { o: "#fff", w: "#000", k: "#fff", h: C.pink }, 0, 0, 2.4))}</g>`;
  b += `<svg x="112" y="104" width="156" height="104"><g><animateTransform attributeName="transform" type="translate" from="170 0" to="-30 0" dur="1.4s" repeatCount="indefinite"/>${at(0, 74, sprite(FISH, { f: C.pink, k: "#000" }, 0, 0, 3))}</g></svg>`;
  b += blink(text("SCORE 0420", 120 / 2, 108 / 2, 2, "#fff").svg, 2);
  b += `<rect x="97" y="219" width="186" height="46" fill="#000"/><rect x="100" y="222" width="180" height="40" fill="#fff"/>`;
  b += `<rect x="134" y="228" width="8" height="18" fill="#000"/><rect x="128" y="222" width="20" height="10" fill="${C.pink}"/>`;
  [[200, C.pink], [228, C.lilac], [256, "#000"]].forEach(([x, c]) => (b += `<rect x="${x - 8}" y="234" width="16" height="12" fill="${c}"/>`));
  b += `<rect x="176" y="268" width="28" height="16" fill="#000"/><rect x="188" y="271" width="4" height="10" fill="${C.pink}"/>`;
  // the pitch
  b += blink(text("INSERT COIN", 340 / 6, 96 / 6, 6, C.pink).svg, 1.1);
  b += text("PLAY 1-MINUTE GAMES", 344 / 4, 166 / 4, 4, "#000").svg;
  b += text("AND TESTS ON IYYKO.COM", 344 / 4, 192 / 4, 4, "#000").svg;
  b += `<g>${at(344, 232, sprite(["p....", "ppp..", "ppppp", "ppp..", "p...."], { p: "#000" }, 0, 0, 5))}<animateTransform attributeName="transform" type="translate" values="0 0;6 0;0 0" dur="0.8s" repeatCount="indefinite"/></g>`;
  b += text("PRESS TO PLAY", 380 / 4, 236 / 4, 4, "#000").svg;
  [[700, 66, 0], [740, 236, 0.8], [320, 272, 1.5]].forEach(([x, y, d], i) => (b += twinkle(at(x, y, sprite(i % 2 ? SPARK : STAR, { y: i === 1 ? C.pink : "#000" }, 0, 0, 4)), 2, d)));
  return svgDoc(W, H, b, "Arcade: insert coin to play one-minute games on iyyko.com");
}

// ---------- trophies ----------
const CUP = [".yyyyyyy.", "yyWyyyyyy", "y.yWyyy.y", ".yyyyyyy.", "..yyyyy..", "...yyy...", "....y....", "..ddddd..", "..ddddd.."];
function trophies(s) {
  const items = [
    ["SHIPPED", "3 APPS"], ["COMMITS", `${s.total}`], ["STREAK", `${s.current} DAYS`], ["BEST", `${s.longest} DAYS`], ["DAYS ON", `${s.active}`],
  ];
  const H = 200, cw = 132, gap = 12, x0 = (W - SHADOW - (items.length * cw + (items.length - 1) * gap)) / 2;
  let b = frame(H, "TROPHIES");
  items.forEach(([label, value], i) => {
    const x = x0 + i * (cw + gap), y = 52;
    b += `<rect x="${x + 4}" y="${y + 4}" width="${cw}" height="120" fill="#000"/><rect x="${x}" y="${y}" width="${cw}" height="120" fill="#000"/><rect x="${x + 3}" y="${y + 3}" width="${cw - 6}" height="114" fill="#fff"/>`;
    b += float(at(x + (cw - 36) / 2, y + 12, sprite(CUP, { y: label === "STREAK" ? C.pink : "#000", W: "#fff", d: C.dark }, 0, 0, 4)), 4, 2, i * 0.4);
    b += text(label, (x + (cw - textWidth(label) * 3) / 2) / 3, (y + 62) / 3, 3, C.soft).svg;
    b += text(value, (x + (cw - textWidth(value) * 3) / 2) / 3, (y + 88) / 3, 3, "#000").svg;
  });
  return svgDoc(W, H, b, "Trophies");
}

// ---------- write everything ----------
const days = await calendar();
const s = stats(days);
// FAKE_NOTES (a JSON list) stands in for the feed when trying the layout locally
const posts = process.env.FAKE_NOTES ? JSON.parse(process.env.FAKE_NOTES) : await notes();
const petLog = existsSync("data/pet.json") ? JSON.parse(readFileSync("data/pet.json", "utf8")) : { log: [], count: 0 };
const files = {
  "idcard.svg": idCard(s, posts.length),
  "notes.svg": notesCard(posts, localNow().toISOString().slice(0, 10)),
  "island.svg": island(s),
  "pet.svg": pet(s, petLog),
  "btn-feed.svg": svgDoc(190, 56, macButton(190, 56, "FEED", true), "Feed iyyko"),
  "btn-play.svg": svgDoc(190, 56, macButton(190, 56, "PLAY"), "Play with iyyko"),
  "btn-pat.svg": svgDoc(190, 56, macButton(190, 56, "PET"), "Pet iyyko"),
  "btn-website.svg": svgDoc(190, 56, macButton(190, 56, "WEBSITE", true), "Website"),
  "btn-linkedin.svg": svgDoc(190, 56, macButton(190, 56, "LINKEDIN"), "LinkedIn"),
  "arcade.svg": arcade(),
  "trophies.svg": trophies(s),
  "fortune.svg": fortune(localNow()),
  ...ttt.pictures(),
};
mkdirSync("assets/ttt", { recursive: true });
APPS.forEach((a) => {
  files[`app-${a.id}.svg`] = appCard(a);
  a.chips.forEach(([label]) => (files[`chip-${a.id}-${label.toLowerCase()}.svg`] = chip(label, a.chips.length)));
});
const v = {};
for (const [f, svg] of Object.entries(files)) {
  writeFileSync(`assets/${f}`, svg);
  v[f] = createHash("md5").update(svg).digest("hex").slice(0, 8);
}
// pictures made elsewhere (banner script, snake action) get a hash too, so GitHub never shows an old copy
for (const f of ["header.svg", "footer.svg", "snake.svg"]) {
  try { v[f] = createHash("md5").update(readFileSync(`assets/${f}`)).digest("hex").slice(0, 8); } catch {}
}
const img = (f, alt, width = "100%", up = "") => `<img src="${up}assets/${f}${v[f] ? `?v=${v[f]}` : ""}" width="${width}" alt="${alt}"/>`;
// GitHub turns a bare picture into a link to the image file; pointing it at its own spot keeps a click from going anywhere
const issue = (title) => `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent("Just press **Create** — a bot does the rest and closes this issue. 🐱")}`;
const still = (id, f, alt, width) => `<a id="${id}" href="#${id}">${img(f, alt, width)}</a>`;
const game = ttt.markup(img, USER);
rmSync("game", { recursive: true, force: true });
mkdirSync("game");
for (const [f, md] of Object.entries(game.pages)) writeFileSync(`game/${f}`, md);

const readme = `${still("hi", "header.svg", "Press start: apps for the little moments of your day")}
${still("about", "idcard.svg", "ID card")}
<p align="center"><a href="${SITE}">${img("btn-website.svg", "Website", "190")}</a> <a href="${LINKEDIN}">${img("btn-linkedin.svg", "LinkedIn", "190")}</a></p>

<p align="center">
${APPS.map((a) => (a.url ? `<a href="${a.url}">${img(`app-${a.id}.svg`, a.name, "24%")}</a>` : still(a.id, `app-${a.id}.svg`, a.name, "24%"))).join("\n")}
<br/>
${APPS.map((a) => a.chips.map(([label, url]) => {
  const f = `chip-${a.id}-${label.toLowerCase()}.svg`, w = `${24 / a.chips.length}%`, alt = `${a.name} ${label === "BETA" ? "ios beta" : label === "SOON" ? "coming soon" : label.toLowerCase()}`;
  return url ? `<a href="${url}">${img(f, alt, w)}</a>` : still(`${a.id}-soon`, f, alt, w);
}).join("")).join("\n")}
</p>

<a href="${SITE}/blog/">${img("notes.svg", "Latest notes on my blog")}</a>

${still("island", "island.svg", "My island")}

${still("pet", "pet.svg", "iyyko the pet, fed by my commits and by you")}
<p align="center">
<a href="${issue("pet: feed 🐟")}">${img("btn-feed.svg", "Feed iyyko", "190")}</a>
<a href="${issue("pet: play 🧶")}">${img("btn-play.svg", "Play with iyyko", "190")}</a>
<a href="${issue("pet: pat ✋")}">${img("btn-pat.svg", "Pet iyyko", "190")}</a>
</p>

${still("fortune", "fortune.svg", "Today's fortune from iyyko")}

${game.start}

<a href="https://www.iyyko.com/play">${img("arcade.svg", "Arcade: play games on iyyko.com")}</a>

${still("trophies", "trophies.svg", "Trophies")}

${still("snake", "snake.svg", "A snake eating my contribution graph")}

${still("bye", "footer.svg", "Thanks for stopping by!")}
`;
writeFileSync("README.md", readme);
console.log(`week ${s.week.map((d) => d.n).join(",")} · today ${s.today} · total ${s.total} · streak ${s.current}/${s.longest} · ttt boards ${game.count} · pet ${JSON.stringify(petStats(s, localNow().getUTCHours(), petLog.log))} · visits ${petLog.count}`);

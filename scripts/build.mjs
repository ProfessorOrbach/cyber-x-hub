// Build: liest data/*.json, prüft Quellen- und Stichtagspflicht, fügt Daten in src/template.html ein, schreibt dist/
// Aufruf: node scripts/build.mjs [--inline-assets]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const inline = process.argv.includes("--inline-assets");

const stand = rd("data/stand.json").stand;
const D = {
  STAND: stand,
  DOM: rd("data/domaenen.json"),
  QUELLEN: rd("data/quellen.json"),
  AKTEURE: rd("data/akteure.json"),
  RECHTSAKTE: rd("data/rechtsakte.json"),
  KENNZAHLEN: rd("data/kennzahlen.json"),
  MELDUNGEN: rd("data/meldungen.json"),
  GLOSSAR: rd("data/glossar.json"),
  LOG: rd("data/aenderungslog.json"),
  HERAUSGEBER: rd("data/herausgeber.json"),
  LEITTHEMA: rd("data/leitthema.json"),
  THEMEN: rd("data/themen.json"),
  DE_MAP: rd("geo/deutschland.json"),
};
const vf = rd("data/vorfaelle.json"); D.VORFAELLE = vf.vorfaelle; D.VORFALL_STAT = vf.stat;
const bx = rd("data/boerse.json"); D.BOERSE = bx.titel; D.BOERSE_Q = bx.quellen;
const gr = rd("data/gruppen.json"); D.GRUPPEN = gr.gruppen; D.BED = gr.bedeutung;
D.SCHAEDEN = rd("data/schaeden.json");
D.RADAR = rd("data/radar.json");

// Kursdaten (optional, von scripts/kurse.mjs erzeugt) an Börsentitel hängen
for (const b of D.BOERSE) {
  const f = path.join(ROOT, "data/kurse", b.id + ".json");
  if (fs.existsSync(f)) b.kurse = JSON.parse(fs.readFileSync(f, "utf8"));
}

// ---------- Validierung: harte Regeln aus dem Fachkonzept ----------
const errors = [];
const isoDate = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
for (const k of D.KENNZAHLEN) {
  if (!k.q || !k.q.length) errors.push(`Kennzahl ${k.id}: keine Quelle`);
  if (k.v != null && !isoDate(k.st)) errors.push(`Kennzahl ${k.id}: Wert ohne Stichtag`);
  if (!k.per) errors.push(`Kennzahl ${k.id}: keine Periode`);
  for (const q of k.q || []) if (!D.QUELLEN[q]) errors.push(`Kennzahl ${k.id}: Quelle ${q} unbekannt`);
}
for (const m of D.MELDUNGEN) {
  if (!m.q || !m.q.length) errors.push(`Meldung ${m.id}: keine Quelle`);
  if (!(m.akt && m.akt.length) && !(m.ra && m.ra.length)) errors.push(`Meldung ${m.id}: weder Akteur noch Rechtsakt verknüpft`);
  if (!isoDate(m.d)) errors.push(`Meldung ${m.id}: Datum fehlt`);
  for (const a of m.akt || []) if (!D.AKTEURE.find(x => x.id === a)) errors.push(`Meldung ${m.id}: Akteur ${a} unbekannt`);
  for (const r of m.ra || []) if (!D.RECHTSAKTE.find(x => x.id === r)) errors.push(`Meldung ${m.id}: Rechtsakt ${r} unbekannt`);
}
for (const a of D.AKTEURE) {
  if (!a.q || !a.q.length) errors.push(`Akteur ${a.id}: keine Quelle`);
  if (!isoDate(a.pr)) errors.push(`Akteur ${a.id}: kein Prüfdatum`);
  for (const r of a.rel || []) if (!D.AKTEURE.find(x => x.id === r.z)) errors.push(`Akteur ${a.id}: Beziehung zu unbekanntem ${r.z}`);
}
for (const r of D.RECHTSAKTE) { if (!r.q || !r.q.length) errors.push(`Rechtsakt ${r.id}: keine Quelle`); if (!r.fristen || !r.fristen.length) errors.push(`Rechtsakt ${r.id}: keine Fristen`); }
for (const f of D.SCHAEDEN.faelle) { if (!f.kosten || !Object.keys(f.kosten).length) errors.push(`Schadenfall ${f.id}: keine Kosten`); for (const k of Object.keys(f.kosten)) if (!D.SCHAEDEN.kostenarten.find(x => x.id === k)) errors.push(`Schadenfall ${f.id}: Kostenart ${k} unbekannt`); }
for (const v of D.VORFAELLE) { if (!v.q) errors.push(`Vorfall ${v.id}: keine Quelle`); if (typeof v.lat !== "number" || typeof v.lon !== "number") errors.push(`Vorfall ${v.id}: keine Koordinaten`); }
for (const id of D.RADAR.regulierung) if (!D.RECHTSAKTE.find(x => x.id === id)) errors.push(`Radar: Rechtsakt ${id} unbekannt`);
for (const g of D.GRUPPEN) for (const id of g.ids) if (!D.AKTEURE.find(x => x.id === id)) errors.push(`Gruppe ${g.id}: Akteur ${id} unbekannt`);
if (errors.length) { console.error("Validierung fehlgeschlagen:\n- " + errors.join("\n- ")); process.exit(1); }

// ---------- Einfügen ----------
let html = fs.readFileSync(path.join(ROOT, "src/template.html"), "utf8");
const js = Object.entries(D).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`).join("\n");
html = html.replace("/*__DATA__*/", () => js);
const heroFile = path.join(ROOT, "assets/hero.jpg");
const heroRef = inline ? "data:image/jpeg;base64," + fs.readFileSync(heroFile).toString("base64") : "assets/hero.jpg";
html = html.replace("/*__HERO__*/", () => heroRef);

const dist = path.join(ROOT, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "assets"), { recursive: true });
// Für das Hosting eine vollständige HTML-Seite; die Artifact-Variante (--inline-assets) bleibt ein Fragment
const full = inline ? html : `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="description" content="Cyber-X-Hub – Die Landkarte des Cyberversicherungsmarktes. Kuratiertes Informationsportal für DACH: Akteure, Regulierung, Schadenfälle, Kennzahlen.">\n</head>\n<body style="margin:0">\n${html}\n</body>\n</html>\n`;
fs.writeFileSync(path.join(dist, "index.html"), full);
if (!inline) fs.copyFileSync(heroFile, path.join(dist, "assets/hero.jpg"));
fs.writeFileSync(path.join(dist, "data.json"), JSON.stringify({ stand, akteure: D.AKTEURE.length, kennzahlen: D.KENNZAHLEN, rechtsakte: D.RECHTSAKTE, meldungen: D.MELDUNGEN, aenderungslog: D.LOG }, null, 1));
console.log(`Build ok → dist/index.html (${Math.round(full.length / 1024)} KB), Stand ${stand}, ${D.AKTEURE.length} Akteure, ${D.KENNZAHLEN.length} Kennzahlen, ${D.MELDUNGEN.length} Meldungen, ${D.VORFAELLE.length} Vorfälle`);

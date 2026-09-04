// Kursdaten: Wochenschlusskurse der letzten 52 Wochen über die öffentliche Chart-Schnittstelle von Yahoo Finance
// (kein Schlüssel, keine Echtzeitdaten). Schreibt data/kurse/<id>.json mit indexierter Reihe (Start = 100).
// Hinweis: inoffizielle Schnittstelle — Nutzungsbedingungen für den öffentlichen Betrieb prüfen; Alternative mit
// kostenlosem Schlüssel: Twelve Data (TWELVEDATA_KEY als Secret setzen, dann greift der zweite Pfad).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const boerse = JSON.parse(fs.readFileSync(path.join(ROOT, "data/boerse.json"), "utf8"));
const dir = path.join(ROOT, "data/kurse"); fs.mkdirSync(dir, { recursive: true });
const KEY = process.env.TWELVEDATA_KEY || "";
const UA = { "user-agent": "Mozilla/5.0 (cyber-x-hub build)" };
const isoFromTs = ts => new Date(ts * 1000).toISOString().slice(0, 10);

async function yahoo(sym) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1wk`, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json(); const r = j.chart && j.chart.result && j.chart.result[0];
  if (!r) throw new Error("keine Daten");
  const ts = r.timestamp || [], close = (r.indicators.quote[0].close || []);
  const pts = ts.map((t, i) => [isoFromTs(t), close[i]]).filter(p => typeof p[1] === "number");
  return { pts, currency: r.meta.currency, quelle: "Yahoo Finance (Wochenschluss)" };
}
async function twelve(sym) {
  const res = await fetch(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=1week&outputsize=53&apikey=${KEY}`, { signal: AbortSignal.timeout(20000) });
  const j = await res.json(); if (!j.values) throw new Error(j.message || "keine Daten");
  const pts = j.values.map(v => [v.datetime, parseFloat(v.close)]).reverse();
  return { pts, currency: j.meta && j.meta.currency, quelle: "Twelve Data (Wochenschluss)" };
}

let ok = 0;
for (const b of boerse.titel) {
  const sym = (b.y || "").split("/quote/")[1] || b.tk;
  try {
    const d = KEY ? await twelve(sym) : await yahoo(sym);
    const pts = d.pts.slice(-52);
    if (pts.length < 20) throw new Error("zu wenige Datenpunkte");
    const base = pts[0][1];
    const out = { symbol: sym, quelle: d.quelle, waehrung: d.currency, stand: pts[pts.length - 1][0], schluss: Math.round(pts[pts.length - 1][1] * 100) / 100, von: pts[0][0], idx: pts.map(p => Math.round(p[1] / base * 1000) / 10) };
    fs.writeFileSync(path.join(dir, b.id + ".json"), JSON.stringify(out) + "\n");
    ok++; console.log(`${b.tk.padEnd(5)} ${sym.padEnd(8)} Schluss ${out.schluss} ${out.waehrung} am ${out.stand}, 52W: ${out.idx[0]} → ${out.idx[out.idx.length - 1]}`);
  } catch (e) { console.warn(`${b.tk} (${sym}): ${e.message}`); }
  await new Promise(r => setTimeout(r, 400));
}
console.log(`${ok}/${boerse.titel.length} Titel aktualisiert`);

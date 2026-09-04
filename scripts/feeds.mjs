// Feed-Strecke: holt RSS/Atom-Quellen, entdoppelt gegen bestehende Meldungen und frühere Eingänge,
// schlägt Domäne und Akteure vor und schreibt data/eingang/YYYY-MM-DD.json. Nichts davon wird automatisch veröffentlicht.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));

const FEEDS = [
  { h: "BSI Presse", u: "https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed/RSSNewsfeed_Presse_Veranstaltungen.xml", dom: "D4" },
  { h: "BSI Cyber-Sicherheitswarnungen", u: "https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed/RSSNewsfeed_CSW.xml", dom: "D3", filter: /kritisch|aktiv ausgenutzt|ransom|weltweit|kritische infrastruktur/i },
  { h: "BaFin Aufsicht", u: "https://www.bafin.de/DE/service/rss/_function/RSS_Aufsicht.xml", dom: "D4" },
  { h: "BaFin Presse", u: "https://www.bafin.de/DE/service/rss/_function/RSS_Presse.xml", dom: "D4" },
  { h: "BaFin Rundschreiben", u: "https://www.bafin.de/DE/service/rss/_function/RSS_Rundschreiben.xml", dom: "D5" },
  { h: "Artemis (ILS)", u: "https://www.artemis.bm/feed/", dom: "D6" },
  { h: "heise Security", u: "https://www.heise.de/security/rss/news-atom.xml", dom: "D3" },
  // EIOPA und ENISA bieten derzeit keinen auffindbaren RSS-Feed; Newsroom-Seiten bei Bedarf per HTML-Abruf ergänzen.
];
const KEYWORDS = [/cyber/i, /ransom/i, /hacker/i, /nis-?2/i, /dora/i, /versicher/i, /reinsur/i, /insur/i, /ils/i, /cat bond/i, /kritis/i, /resilience/i, /schwachstelle/i, /angriff/i];

const meldungen = rd("data/meldungen.json");
const akteure = rd("data/akteure.json");
const rechtsakte = rd("data/rechtsakte.json");
const known = new Set(meldungen.map(m => m.t.toLowerCase()));
for (const f of fs.readdirSync(path.join(ROOT, "data/eingang"))) if (f.endsWith(".json")) for (const e of rd("data/eingang/" + f)) known.add((e.link || e.t).toLowerCase());

const strip = s => (s || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
function parse(xml) {
  const items = [];
  const re = /<(item|entry)\b[\s\S]*?<\/\1>/g; let m;
  while ((m = re.exec(xml))) {
    const x = m[0];
    const g = tag => { const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(x); return r ? strip(r[1]) : ""; };
    const linkAttr = /<link[^>]*href="([^"]+)"/i.exec(x);
    items.push({ t: g("title"), link: g("link") || (linkAttr ? linkAttr[1] : ""), d: g("pubDate") || g("published") || g("updated") || g("dc:date"), s: g("description") || g("summary") || g("content") });
  }
  return items;
}
const iso = d => { const t = Date.parse(d); return isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10); };

const out = [];
for (const f of FEEDS) {
  try {
    const res = await fetch(f.u, { headers: { "user-agent": "cyber-x-hub-feeds/1.0" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) { console.warn(`${f.h}: HTTP ${res.status}`); continue; }
    const items = parse(await res.text());
    let n = 0;
    for (const it of items) {
      const text = it.t + " " + it.s;
      if (!KEYWORDS.some(k => k.test(text))) continue;
      if (f.filter && !f.filter.test(text)) continue;
      const key = (it.link || it.t).toLowerCase();
      if (known.has(key) || known.has(it.t.toLowerCase())) continue;
      known.add(key);
      const akt = akteure.filter(a => text.toLowerCase().includes(a.n.toLowerCase().split(" ")[0].toLowerCase()) && a.n.length > 3).map(a => a.id).slice(0, 4);
      const ra = rechtsakte.filter(r => new RegExp(r.n.split(" ")[0].replace(/[^\wäöü-]/gi, ""), "i").test(text)).map(r => r.id).slice(0, 3);
      out.push({ t: it.t, link: it.link, d: iso(it.d), s: it.s.slice(0, 400), quelle: f.h, vorschlag: { dom: f.dom, akt, ra }, status: "offen" });
      n++;
    }
    console.log(`${f.h}: ${items.length} Einträge, ${n} neu und relevant`);
  } catch (e) { console.warn(`${f.h}: ${e.message}`); }
}
if (out.length) {
  const file = path.join(ROOT, "data/eingang", new Date().toISOString().slice(0, 10) + ".json");
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  fs.writeFileSync(file, JSON.stringify(prev.concat(out), null, 1) + "\n");
  console.log(`→ ${out.length} Vorschläge in ${path.relative(ROOT, file)} (Freigabe durch den Herausgeber: in data/meldungen.json übernehmen)`);
} else console.log("Keine neuen Vorschläge.");

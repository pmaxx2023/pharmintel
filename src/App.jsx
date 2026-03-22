import { useState, useEffect, useCallback, useRef } from "react";

// ── Data ──
const SOURCES = [
  { id: "drugchannels", name: "Drug Channels", c: "#C9A84C" },
  { id: "drugstorenews", name: "Drug Store News", c: "#4BA89D" },
  { id: "pharmacytimes", name: "Pharmacy Times", c: "#C75B5B" },
  { id: "pharmcommerce", name: "Pharma Commerce", c: "#8B6EC0" },
  { id: "chaindrugreview", name: "Chain Drug Review", c: "#CC7E38" },
  { id: "rxinsider", name: "RXinsider", c: "#2BA5BD" },
  { id: "general", name: "Industry", c: "#7A8899" },
];
const TOPICS = [
  { label: "Cardinal Health", q: "Cardinal Health pharmacy strategy news" },
  { label: "Cencora", q: "Cencora AmerisourceBergen pharmacy news" },
  { label: "Drug Shortages", q: "pharmaceutical drug shortage pharmacy" },
  { label: "DSCSA", q: "DSCSA drug supply chain security act compliance" },
  { label: "Generic Drug Market", q: "generic drug pricing wholesale pharmacy market" },
  { label: "Independent Pharmacy", q: "independent pharmacy business challenges" },
  { label: "McKesson Connect", q: "McKesson Connect pharmacy ordering platform" },
  { label: "Pharma Ad Regulation", q: "pharmaceutical advertising regulation RFK ban" },
  { label: "Pharmacy Technology", q: "pharmacy technology automation digital ordering" },
  { label: "Retail Media", q: "retail media network pharmacy manufacturer advertising" },
  { label: "Specialty Distribution", q: "specialty pharmaceutical distribution wholesale" },
  { label: "Strategic Accounts", q: "pharmacy wholesale strategic accounts management" },
];
const WORKFLOWS = [
  { label: "Ordering", q: "pharmacy wholesale drug ordering platform ecommerce" },
  { label: "Returns", q: "pharmacy drug returns reverse distribution process" },
  { label: "Chargebacks", q: "pharmaceutical chargeback wholesale manufacturer pricing dispute" },
  { label: "Inventory Mgmt", q: "pharmacy inventory management par levels automation" },
  { label: "Contract Pricing", q: "pharmacy GPO contract pricing wholesale drug cost" },
  { label: "Invoice & AP", q: "pharmacy accounts payable wholesale invoice payment terms" },
  { label: "Backorders", q: "pharmacy drug backorder allocation shortage management" },
  { label: "Controlled Substances", q: "pharmacy controlled substance CSOS DEA ordering" },
  { label: "Drop Ship", q: "pharmacy drop ship direct from manufacturer distribution" },
  { label: "Formulary Mgmt", q: "pharmacy formulary management therapeutic interchange" },
  { label: "Rebates", q: "pharmaceutical manufacturer rebate wholesale pharmacy" },
  { label: "EDI Integration", q: "pharmacy EDI electronic ordering integration wholesale" },
];
const SEGMENTS = [
  { label: "Strategic Accounts", q: "pharmacy strategic accounts large chain wholesale distribution", desc: "Large chain & regional", accounts: [
    { name: "Wegmans", q: "Wegmans pharmacy wholesale distribution" },
    { name: "H-E-B", q: "HEB pharmacy wholesale drug distribution Texas" },
    { name: "Albertsons", q: "Albertsons pharmacy wholesale distribution" },
    { name: "CVS", q: "CVS pharmacy wholesale distribution supply chain" },
    { name: "Costco", q: "Costco pharmacy wholesale distribution" },
    { name: "Kinney Drugs", q: "Kinney Drugs pharmacy wholesale distribution" },
    { name: "Optum", q: "Optum pharmacy PBM wholesale distribution" },
    { name: "ProAct", q: "ProAct pharmacy PBM wholesale distribution" },
  ]},
  { label: "Independent Pharmacy", q: "independent community pharmacy business wholesale distributor", desc: "Single-location & small chain" },
  { label: "Health Mart", q: "Health Mart McKesson franchise independent pharmacy network", desc: "McKesson franchise network" },
  { label: "Hospitals", q: "hospital pharmacy supply chain wholesale drug distribution health system", desc: "Health system & acute care" },
  { label: "Government / VA", q: "VA veterans affairs pharmacy federal government drug distribution 340B", desc: "Federal, VA, 340B programs" },
  { label: "Specialty Pharmacy", q: "specialty pharmacy distribution high-cost biologics limited distribution", desc: "Biologics, oncology, limited dist." },
];
const VOICES_LIST = [
  { name: "Adam Fein", title: "Drug Channels Institute", c: "#C9A84C" },
  { name: "Brian Tyler", title: "CEO, McKesson", c: "#D4B96A" },
  { name: "Steven Collis", title: "CEO, Cencora", c: "#4BA89D" },
  { name: "Jason Hollar", title: "CEO, Cardinal Health", c: "#C75B5B" },
  { name: "B. Douglas Hoey", title: "CEO, NCPA", c: "#8B6EC0" },
  { name: "Chip Davis", title: "President, HDA", c: "#2BA5BD" },
  { name: "Jenni Zilka", title: "Good Neighbor Pharmacy", c: "#CC7E38" },
  { name: "Lisa Gill", title: "JPMorgan Analyst", c: "#7A8899" },
  { name: "Eric Percher", title: "Nephron Research", c: "#A07ED6" },
  { name: "Scott Mushkin", title: "R5 Capital", c: "#D9853F" },
];

// ── Utils ──
const ST = {
  async get(k) { try { const v = localStorage.getItem(`pi:${k}`); return v ? JSON.parse(v) : null; } catch { return null; } },
  async set(k, v) { try { localStorage.setItem(`pi:${k}`, JSON.stringify(v)); } catch {} },
};

// Cache: 4-hour TTL, keyed by format + lens
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const cacheKey = (fmt, lens) => `c:${fmt}:${lens || "all"}`;
const cacheGet = async (fmt, lens) => {
  const d = await ST.get(cacheKey(fmt, lens));
  if (!d || !d.ts) return null;
  return { ...d, fresh: (Date.now() - d.ts) < CACHE_TTL };
};
const cacheSet = (fmt, lens, data) => ST.set(cacheKey(fmt, lens), { ...data, ts: Date.now() });
function norm(t) { return (t || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim(); }
function wrds(t) { return new Set(norm(t).split(/\s+/).filter(w => w.length > 2)); }
function sim(a, b) { const wa = wrds(a), wb = wrds(b); if (!wa.size || !wb.size) return norm(a) === norm(b); let n = 0; for (const w of wa) if (wb.has(w)) n++; return (n / new Set([...wa, ...wb]).size) > 0.6; }
function dd(ex, items) { const r = []; for (const i of items) if (!ex.some(e => sim(e.title, i.title)) && !r.some(x => sim(x.title, i.title))) r.push(i); return r; }

const wait = ms => new Promise(r => setTimeout(r, ms));
async function api(sys, msg, opts = {}) {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sys, message: msg, model: opts.model, max_tokens: opts.maxTokens }) });
    const d = await res.json();
    // Retry on rate limit
    if (d.status === 429 || (d.error && d.error.includes("rate limit"))) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 15000; // 30s, 60s, 120s
        console.log(`Rate limited, retrying in ${delay/1000}s...`);
        await wait(delay);
        continue;
      }
    }
    if (d.error) throw new Error(d.error);
    return (d.text || "").replace(/<\/?antml:[^>]*>/g, "").replace(/<\/?cite[^>]*>/g, "").replace(/\[?\d+-\d+(?::\d+)?(?:,\d+-\d+(?::\d+)?)*\]?/g, "");
  }
  throw new Error("Rate limited. Try again in a minute.");
}
function pj(t) { try { const c = t.replace(/```json|```/g, "").trim(); const m = c.match(/\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : JSON.parse(c); } catch { return []; } }

const NEWS_SYS = `You are a pharmaceutical distribution news wire. Report ONLY verifiable facts with sources. No analysis, no opinion, no implications. If you cannot cite a source, do not include it.
Today: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. ONLY last 90 days. Every claim must be attributable to a named publication or public statement.`;
const EDU_SYS = `You are a pharmaceutical distribution reference guide. Explain how things work with cited sources. No analysis, no opinion, no strategic advice. Stick to documented facts, published processes, and verifiable information.`;
const SCH = `"title"(max 12 words, factual),"source"(publication name),"sourceId"(drugchannels|drugstorenews|pharmacytimes|pharmcommerce|chaindrugreview|rxinsider|general),"summary"(2-3 factual sentences with source attribution),"url"(https://),"date"(YYYY-MM-DD or ""),"tag"(COMPETITIVE|REGULATORY|MARKET|CUSTOMER|TECHNOLOGY|FINANCIAL)`;

const fmtDate = (d) => {
  if (!d || d.trim() === "") return null;
  try {
    const p = d.split("-"), mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    if (p.length === 3 && p[0].length === 4 && +p[1] >= 1 && +p[1] <= 12) return `${mo[+p[1]-1]} ${+p[2]}, ${p[0]}`;
    if (p.length === 2 && p[0].length === 4 && +p[1] >= 1 && +p[1] <= 12) return `${mo[+p[1]-1]} ${p[0]}`;
    return null;
  } catch { return null; }
};
const ago = (iso) => { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (d < 60) return `${d}m`; if (d < 1440) return `${Math.floor(d/60)}h`; return `${Math.floor(d/1440)}d`; };

function sysFor(lens) {
  if (!lens) return NEWS_SYS;
  if (lens.type === "workflow") return EDU_SYS;
  if (lens.type === "segment" || lens.type === "account") return `You are a pharmaceutical distribution reference tool focused on "${lens.label}". Report ONLY verifiable facts with sources. No analysis, no opinion.`;
  return NEWS_SYS;
}
const lensCtx = l => l ? `about "${l.label}" (${l.q})` : "across pharmaceutical distribution, pharmacy business, McKesson, Cardinal Health, Cencora, regulation";

// ── Components ──
const Progress = ({ msg }) => {
  const [p, setP] = useState(0);
  useEffect(() => { const i = setInterval(() => setP(v => v >= 92 ? 92 : v + Math.random()*6), 700); return () => clearInterval(i); }, []);
  return (<div style={{ padding: "12px 0", marginBottom: "16px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
      <span style={{ fontSize: "11px", color: "var(--gold)", fontFamily: "var(--mono)" }}>{msg}</span>
      <span style={{ fontSize: "11px", color: "var(--t4)", fontFamily: "var(--mono)" }}>{Math.round(p)}%</span>
    </div>
    <div style={{ height: "1px", background: "var(--border)" }}><div style={{ height: "100%", width: `${p}%`, background: "linear-gradient(90deg, var(--gold), var(--goldLight))", transition: "width 0.6s" }} /></div>
  </div>);
};

const Lnk = ({ url }) => {
  if (!url) return null;
  let h = "source"; try { h = new URL(url).hostname.replace("www.", ""); } catch {}
  return (<a href={url} target="_blank" rel="noopener noreferrer"
    style={{ fontSize: "11px", color: "var(--gold)", fontFamily: "var(--mono)", textDecoration: "none", opacity: 0.7, transition: "opacity 0.15s" }}
    onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}
  >↗ {h}</a>);
};

const Card = ({ item, onSave, saved, read, onRead, isNew }) => {
  const [open, setOpen] = useState(false);
  const src = SOURCES.find(s => s.id === item.sourceId) || SOURCES[6];
  return (
    <article style={{ paddingBottom: "24px", marginBottom: "24px", borderBottom: "1px solid var(--border)", opacity: read && !open ? 0.5 : 1, transition: "opacity 0.2s", cursor: "pointer" }}
      onClick={() => { setOpen(!open); if (!read && onRead) onRead(item.title); }}
      onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => { if (read && !open) e.currentTarget.style.opacity = "0.5"; }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        {item.date && fmtDate(item.date) && <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{fmtDate(item.date)}</span>}
        {item.date && fmtDate(item.date) && <span style={{ color: "var(--t4)" }}>·</span>}
        <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{item.source}</span>
        {item.tag && <span><span style={{ color: "var(--t4)" }}>·</span><span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{item.tag}</span></span>}
          {isNew && <span style={{ fontSize: "9px", fontFamily: "var(--mono)", color: "var(--gold)", background: "rgba(201,168,76,0.12)", padding: "1px 6px", borderRadius: "2px", letterSpacing: "0.1em" }}>NEW</span>}
        {onSave && <button onClick={e => { e.stopPropagation(); onSave(item); }} style={{ background: "none", border: "none", color: saved ? "var(--gold)" : "var(--t4)", cursor: "pointer", marginLeft: "auto", fontSize: "14px", transition: "color 0.15s" }}>{saved ? "★" : "☆"}</button>}
      </div>
      <h3 style={{ fontSize: "17px", fontWeight: 600, color: "var(--t1)", lineHeight: 1.4, marginBottom: open ? "10px" : 0, fontFamily: "var(--body)" }}>{item.title}</h3>
      {open && (<div style={{ animation: "fadeIn 0.2s ease" }}>
        <p style={{ fontSize: "14px", color: "var(--t2)", lineHeight: 1.7, marginBottom: "8px" }}>{item.summary}</p>
        <Lnk url={item.url} />
      </div>)}
    </article>
  );
};

const LensBadge = ({ lens, onClear }) => {
  if (!lens) return null;
  const c = { topic: "var(--gold)", workflow: "var(--blue)", segment: "var(--green)", account: "var(--green)" };
  return (<div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", border: `1px solid ${c[lens.type]}30`, borderRadius: "20px", fontSize: "11px", fontFamily: "var(--mono)", color: c[lens.type] }}>
    {lens.label}
    <button onClick={onClear} style={{ background: "none", border: "none", color: c[lens.type], cursor: "pointer", padding: 0, fontSize: "11px", opacity: 0.5 }}>✕</button>
  </div>);
};

// ── Main ──
export default function PharmIntel() {
  const [fmt, setFmt] = useState("news"); // news | voices
  const [lens, setLens] = useState(null);
  const [q, setQ] = useState("");
  const [intel, setIntel] = useState([]);
  const [allIntel, setAllIntel] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState([]);
  const [readSet, setReadSet] = useState(new Set());
  const [loadMsg, setLoadMsg] = useState("");
  const [err, setErr] = useState(null);
  const [topline, setTopline] = useState("");
  const [lastVisit, setLastVisit] = useState(null);
  const [voices, setVoices] = useState([]);
  const [vExp, setVExp] = useState(new Set());
  const [customT, setCustomT] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [sTab, setSTab] = useState("topics");
  const [segOpen, setSegOpen] = useState(null);
  const [nL, setNL] = useState("");
  const [nQu, setNQu] = useState("");
  const [copied, setCopied] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  const [journal, setJournal] = useState([]);
  const [topicIdx, setTopicIdx] = useState({}); // { "Cardinal Health": [{title,source,date,url,tag},...], ... }
  const addRef = useRef(null);

  useEffect(() => { if (showAdd && addRef.current) addRef.current.focus(); }, [showAdd]);
  useEffect(() => { (async () => {
    try {
      const ct = await ST.get("ct"); if (ct?.length) setCustomT(ct);
      const sv = await ST.get("sv"); if (sv?.length) setSaved(sv);
      const rd = await ST.get("rd"); if (rd?.length) setReadSet(new Set(rd));
      const lv = await ST.get("lv"); if (lv) setLastVisit(lv);
      const jl = await ST.get("jl"); if (Array.isArray(jl) && jl.length) setJournal(jl);
      const ti = await ST.get("tidx"); if (ti?.data && Object.keys(ti.data).length) setTopicIdx(ti.data);
    } catch (e) { console.error("Storage load error:", e); }
  })(); }, []);

  const allTopics = [...TOPICS.map(t => ({...t, custom: false})), ...customT.map(t => ({...t, custom: true}))].sort((a,b) => a.label.localeCompare(b.label));
  const ps = (k,v) => ST.set(k,v);
  const svSaved = i => { setSaved(i); ps("sv",i); };
  const svCustom = i => { setCustomT(i); ps("ct",i); };
  const markRead = t => { setReadSet(p => { const n = new Set(p); n.add(t); ps("rd",[...n]); return n; }); };
  const ml = { news:["Scanning","Gathering","Extracting"], voices:["Finding quotes","Checking","Gathering"], today:["Scanning","Ranking","Top 3"] };
  const sL = t => { let i=0; setLoadMsg(ml[t][0]); return setInterval(() => { i=(i+1)%ml[t].length; setLoadMsg(ml[t][i]); }, 2800); };
  const cp = t => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const tSave = i => { const ex = saved.find(x => x.title === i.title); svSaved(ex ? saved.filter(x => x.title !== i.title) : [...saved, i]); };
  const isSv = i => saved.some(x => x.title === i.title);
  const addT = () => { if (!nL.trim()) return; svCustom([...customT, { label: nL.trim(), q: nQu.trim() || nL.trim() }].sort((a,b) => a.label.localeCompare(b.label))); setNL(""); setNQu(""); setShowAdd(false); };
  const clearLens = () => setLens(null);
  const isNew = (item) => {
    if (!lastVisit || !item.date) return false;
    try { return item.date > lastVisit.slice(0, 10); } catch { return false; }
  };

  // ── Journal ──
  const logJ = (type, lensLabel, topline, items) => {
    const entry = {
      ts: new Date().toISOString(),
      type, // "news" | "voices" | "today" | "search"
      lens: lensLabel || null,
      topline: topline || null,
      items: (items || []).slice(0, 10).map(i => ({
        title: i.title || i.quote || "",
        source: i.source || i.name || "",
        date: i.date || "",
        url: i.url || "",
      })),
    };
    setJournal(prev => {
      const updated = [entry, ...prev].slice(0, 200); // keep last 200
      ST.set("jl", updated);
      return updated;
    });
  };

  const journalToMd = () => {
    const lines = ["# PharmIntel Journal", "", `Exported: ${new Date().toLocaleString()}`, ""];
    for (const e of journal) {
      const d = new Date(e.ts);
      const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      lines.push(`## ${date} · ${time} · ${e.type.toUpperCase()}${e.lens ? ` · ${e.lens}` : ""}`);
      if (e.topline) lines.push("", `> ${e.topline}`);
      lines.push("");
      for (const i of e.items) {
        lines.push(`- **${i.title}** — ${i.source}${i.date ? ` (${i.date})` : ""}${i.url ? ` [↗](${i.url})` : ""}`);
      }
      lines.push("", "---", "");
    }
    return lines.join("\n");
  };

  const clearJournal = () => { setJournal([]); ST.set("jl", []); };

  // ── Run: News (cache-first) ──
  const fetchNews = useCallback(async (currentLens, limit) => {
    const count = limit || "6-8";
    const t = await api(sysFor(currentLens) + `\nReturn JSON: {"topline":"one factual sentence summarizing the current state, cite a source","items":[${limit ? `exactly ${limit}` : count} objects: ${SCH}]}. ${limit ? "Rank by impact." : ""} Facts only. ONLY valid JSON.`,
      `${limit ? `${limit} most important things` : "Latest factual news"} ${lensCtx(currentLens)}. ONLY last 90 days. No 2024. Cite sources. URLs.`);
    try {
      const obj = JSON.parse(t.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/)?.[0] || "{}");
      if (obj.topline && obj.items?.length) return { topline: obj.topline, items: obj.items };
    } catch {}
    const p = pj(t);
    return p.length ? { topline: "", items: p } : null;
  }, []);

  const runNews = useCallback(async (currentLens, limit) => {
    setFmt("news"); setErr(null); setShowAll(false);
    const ck = limit ? "today" : "news";
    const lensLabel = currentLens?.label || null;

    // 1. Check per-topic cache
    const cached = await cacheGet(ck, lensLabel);
    if (cached?.items?.length) {
      setTopline(cached.topline || ""); setIntel(cached.items);
      if (cached.fresh) { return; }
      setRefreshing(true);
    }
    // 2. Check topic index for instant preview (if no cache hit)
    else if (!limit && lensLabel && topicIdx[lensLabel]?.length) {
      setIntel(topicIdx[lensLabel]); setTopline("");
      setRefreshing(true); // show index results, fetch full in background
    } else {
      setIntel([]); setTopline(""); setLoading(true);
    }

    // 3. Fetch full results
    const iv = sL(ck);
    try {
      const result = await fetchNews(currentLens, limit);
      if (result) {
        setTopline(result.topline); setIntel(result.items);
        setAllIntel(prev => [...prev, ...dd(prev, result.items)]);
        logJ(ck, lensLabel, result.topline, result.items);
        cacheSet(ck, lensLabel, { topline: result.topline, items: result.items });
        const now = new Date().toISOString(); setLastVisit(now); ST.set("lv", now);
      } else if (!cached?.items?.length && !(topicIdx[lensLabel]?.length)) setErr("No results.");
    } catch (e) { if (!cached?.items?.length && !(topicIdx[lensLabel]?.length)) setErr(e.message); }
    clearInterval(iv); setLoading(false); setRefreshing(false);
  }, [topicIdx]);

  // ── Run: Voices (cache-first) ──
  const fetchVoices = useCallback(async (currentLens) => {
    const topic = currentLens?.label || ""; const ab = topic ? ` about "${topic}"` : "";
    const sa = topic || "pharmaceutical distribution, pharmacy business";
    const collected = [];
    for (let i = 0; i < VOICES_LIST.length; i += 2) {
      if (i > 0) await wait(20000); // 20s between batches to respect rate limits
      const batch = VOICES_LIST.slice(i, i + 2);
      const results = await Promise.allSettled(batch.map(async v => {
        const t = await api(NEWS_SYS + `\nReturn JSON array 1-3 by ${v.name} (${v.title})${ab}: "quote","context","url","date". If none, []. ONLY valid JSON.`,
          `Recent public statements by ${v.name}, ${v.title}, about ${sa}. ONLY last 90 days.`);
        return { voice: v, stmts: pj(t) };
      }));
      for (const r of results) if (r.status === "fulfilled" && r.value.stmts.length)
        collected.push({ ...r.value.voice, stmts: r.value.stmts });
    }
    return collected;
  }, []);

  const runVoices = useCallback(async (currentLens) => {
    setFmt("voices"); setErr(null); setVExp(new Set());
    const lensLabel = currentLens?.label || null;

    // 1. Check cache
    const cached = await cacheGet("voices", lensLabel);
    if (cached?.voices?.length) {
      setVoices(cached.voices);
      if (cached.fresh) { return; }
      setRefreshing(true);
    } else {
      setVoices([]); setLoading(true);
    }

    // 2. Fetch
    const iv = sL("voices");
    try {
      const collected = await fetchVoices(currentLens);
      if (collected.length) {
        setVoices(collected);
        logJ("voices", lensLabel, null, collected.map(v => ({ title: v.stmts[0]?.quote || "", source: v.name, url: v.stmts[0]?.url || "" })));
        cacheSet("voices", lensLabel, { voices: collected });
      } else if (!cached?.voices?.length) setVoices([]);
    } catch (e) { if (!cached?.voices?.length) setErr(e.message); }
    clearInterval(iv); setLoading(false); setRefreshing(false);
  }, []);

  // ── Sidebar click: set lens, run active format ──
  const selectLens = useCallback((type, label, q) => {
    const nl = { type, label, q };
    setLens(nl);
    if (fmt === "voices") runVoices(nl);
    else runNews(nl);
  }, [fmt]);

  // ── Freeform search ──
  const runFree = useCallback(async (query) => {
    if (!query.trim()) return;
    setLens(null);
    setLoading(true); setErr(null); setIntel([]); setTopline(""); setShowAll(false); setFmt("news");
    const iv = sL("news");
    try {
      const t = await api(NEWS_SYS + `\nReturn JSON: {"topline":"one factual sentence summarizing results, cite a source","items":[6-8 objects: ${SCH}]}. Facts only. ONLY valid JSON.`, `Latest factual news: ${query}\nONLY last 90 days. Cite sources. URLs.`);
      try {
        const obj = JSON.parse(t.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/)?.[0] || "{}");
        if (obj.topline && obj.items?.length) { setTopline(obj.topline); setIntel(obj.items); setAllIntel(prev => [...prev, ...dd(prev, obj.items)]); logJ("search", query, obj.topline, obj.items); clearInterval(iv); setLoading(false); return; }
      } catch {}
      const p = pj(t); if (p.length) { setIntel(p); setAllIntel(prev => [...prev, ...dd(prev, p)]); logJ("search", query, null, p); } else setErr("No results.");
    } catch (e) { setErr(e.message); }
    clearInterval(iv); setLoading(false);
  }, []);

  // ── Format switch (no auto-run) ──
  const switchFmt = f => {
    setFmt(f); setErr(null);
    if (f === "news") { setIntel([]); setTopline(""); }
    if (f === "voices") { setVoices([]); setVExp(new Set()); }
  };

  // ── Topic Index: one API call indexes all topics ──
  const buildIndex = useCallback(async () => {
    const topicLabels = TOPICS.map(t => t.label).join(", ");
    try {
      const t = await api(
        NEWS_SYS + `\nReturn JSON object where each key is a topic name and the value is an array of 2-3 items: ${SCH}. Topics: ${topicLabels}. ONLY valid JSON. No markdown.`,
        `For EACH of these topics, find 2-3 recent factual headlines with sources: ${topicLabels}. ONLY last 90 days. Include URLs. Return as {"Topic Name": [{item}, ...], ...}`
      );
      try {
        const obj = JSON.parse(t.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/)?.[0] || "{}");
        if (Object.keys(obj).length > 0) {
          setTopicIdx(obj);
          ST.set("tidx", { data: obj, ts: Date.now() });
          // Also populate per-topic caches
          for (const [label, items] of Object.entries(obj)) {
            if (Array.isArray(items) && items.length) {
              cacheSet("news", label, { topline: "", items });
            }
          }
          return obj;
        }
      } catch {}
    } catch {}
    return null;
  }, []);

  // ── Pre-warm on mount (API calls disabled — uncomment when rate limit upgraded) ──
  const [warmed, setWarmed] = useState(false);
  useEffect(() => {
    if (warmed) return;
    setWarmed(true);
    (async () => {
      // Load cached index from localStorage (no API call)
      const cachedIdx = await ST.get("tidx");
      if (cachedIdx?.data && Object.keys(cachedIdx.data).length > 0) {
        setTopicIdx(cachedIdx.data);
      }
      // PREWARM DISABLED — rate limit too low (30K tokens/min)
      // To re-enable: upgrade API tier or use a second API key for background tasks
      // if (!cachedIdx?.ts || (Date.now() - cachedIdx.ts) > CACHE_TTL) {
      //   await wait(5000);
      //   try { await buildIndex(); } catch {}
      // }
    })();
  }, [warmed]);

  const vis = showAll ? intel : intel.slice(0, 3);
  const extra = intel.length - 3;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--t1)", fontFamily: "var(--body)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400&family=Outfit:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        :root { --serif:'Newsreader',serif; --body:'Outfit',sans-serif; --mono:'IBM Plex Mono',monospace;
          --bg:#0A0D12; --bg2:rgba(255,255,255,0.018); --bg3:rgba(255,255,255,0.04);
          --border:rgba(255,255,255,0.05); --border-dim:rgba(255,255,255,0.025);
          --t1:#D8DEE9; --t2:#8B95A5; --t3:#5A6373; --t4:#3D4654;
          --gold:#C9A84C; --goldLight:#E8D48B; --blue:#5C82A6; --green:#8B9E6E; }
        * { box-sizing:border-box } ::placeholder { color:var(--t4) }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.03)}
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", background: "rgba(10,13,18,0.92)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 28px", height: "52px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: loading ? "var(--gold)" : refreshing ? "var(--gold)" : "#3DBB6E", boxShadow: `0 0 8px ${loading || refreshing ? "var(--gold)" : "#3DBB6E"}`, animation: loading || refreshing ? "pulse 1.5s infinite" : "none" }} />
              <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--mono)", color: "#fff" }}>Pharm<span style={{ color: "var(--gold)" }}>Intel</span></span>
            </div>
            <nav style={{ display: "flex", gap: "20px" }}>
              <button onClick={() => { clearLens(); runNews(null, 3); }}
                style={{ background: "none", border: "none", fontSize: "13px", fontFamily: "var(--body)", fontWeight: 500, color: "var(--gold)", cursor: "pointer", padding: "16px 0", position: "relative" }}>⚡ Today</button>
              {[{id:"news",l:"News"},{id:"voices",l:"Voices"},{id:"journal",l:"Journal"}].map(m => (
                <button key={m.id} onClick={() => switchFmt(m.id)}
                  style={{ background: "none", border: "none", fontSize: "13px", fontFamily: "var(--body)", fontWeight: 500, color: fmt === m.id ? "#fff" : "var(--t3)", cursor: "pointer", padding: "16px 0", position: "relative", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => { if (fmt !== m.id) e.currentTarget.style.color = "var(--t3)"; }}>
                  {m.l}{fmt === m.id && <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: "var(--gold)" }} />}
                </button>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "20px", padding: "0 14px" }}>
              <span style={{ fontSize: "11px", color: "var(--t4)", marginRight: "6px" }}>⌕</span>
              <input type="text" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && runFree(q)} placeholder="Search..." style={{ background: "none", border: "none", outline: "none", color: "var(--t1)", fontSize: "12px", padding: "7px 0", fontFamily: "var(--body)", width: "160px" }} />
            </div>
            <button onClick={() => setNavOpen(n => !n)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--t3)", cursor: "pointer", padding: "5px 8px", fontSize: "11px", fontFamily: "var(--mono)" }}>{navOpen ? "◁" : "▷"}</button>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", maxWidth: "1200px", margin: "0 auto" }}>
        {/* Content */}
        <main style={{ flex: 1, padding: "32px 28px", maxWidth: navOpen ? "780px" : "100%", transition: "max-width 0.2s" }}>
          {lens && <div style={{ marginBottom: "20px" }}><LensBadge lens={lens} onClear={clearLens} /></div>}
          {loading && <Progress msg={loadMsg} />}
          {refreshing && !loading && <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", padding: "6px 0" }}>
            <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--gold)", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--t4)", letterSpacing: "0.1em" }}>UPDATING</span>
          </div>}
          {err && <div style={{ padding: "12px 0", marginBottom: "16px", color: "#E8A0A0", fontSize: "13px", borderBottom: "1px solid rgba(199,91,91,0.15)" }}>{err}</div>}
          {copied && <div style={{ position: "fixed", top: "60px", right: "28px", zIndex: 200, background: "#3DBB6E", color: "#000", padding: "5px 14px", borderRadius: "20px", fontSize: "10px", fontFamily: "var(--mono)", animation: "fadeIn 0.2s" }}>Copied</div>}

          {/* ── News ── */}
          {fmt === "news" && !loading && !intel.length && !err && (
            <div style={{ paddingTop: "80px", textAlign: "center" }}>
              <h1 style={{ fontSize: "26px", fontFamily: "var(--body)", color: "#fff", fontWeight: 600, marginBottom: "10px" }}>{lens ? lens.label : "Pharmaceutical Distribution News"}</h1>
              <p style={{ fontSize: "14px", color: "var(--t3)", maxWidth: "400px", margin: "0 auto", lineHeight: 1.6 }}>Select a subject on the right, search above, or hit ⚡ Today.</p>
              {lastVisit && <p style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "var(--t4)", marginTop: "12px" }}>Last checked {ago(lastVisit)} ago</p>}
            </div>
          )}
          {fmt === "news" && intel.length > 0 && (<div style={{ animation: "fadeIn 0.3s ease" }}>
            {topline && <p style={{ fontSize: "15px", color: "var(--t2)", lineHeight: 1.6, marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid var(--border)", maxWidth: "600px" }}>{topline}</p>}
            <div style={{ marginBottom: "20px" }}>
              <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--t4)", letterSpacing: "0.12em" }}>{showAll ? intel.length : Math.min(3, intel.length)} OF {intel.length}</span>
            </div>
            {vis.map((ins, i) => <Card key={i} item={ins} onSave={tSave} saved={isSv(ins)} read={readSet.has(ins.title)} onRead={markRead} isNew={isNew(ins)} />)}
            {!showAll && extra > 0 && <button onClick={() => setShowAll(true)} style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--body)", padding: "8px 0", opacity: 0.7 }}>Show {extra} more →</button>}
          </div>)}

          {/* ── Voices ── */}
          {fmt === "voices" && !loading && !voices.length && !err && (
            <div style={{ paddingTop: "80px", textAlign: "center" }}>
              <h1 style={{ fontSize: "26px", fontFamily: "var(--body)", color: "#fff", fontWeight: 600, marginBottom: "10px" }}>{lens ? `Voices on ${lens.label}` : "Industry Voices"}</h1>
              <p style={{ fontSize: "14px", color: "var(--t3)", maxWidth: "400px", margin: "0 auto 24px", lineHeight: 1.6 }}>Select a subject on the right, or pick a topic below.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", maxWidth: "400px", margin: "0 auto" }}>
                {["retail media","drug shortages","AI","generic pricing","automation"].map((t,i) => (
                  <button key={i} onClick={() => { const nl = {type:"topic",label:t,q:t}; setLens(nl); runVoices(nl); }}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: "20px", color: "var(--t3)", padding: "5px 14px", cursor: "pointer", fontSize: "12px", fontFamily: "var(--body)", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--gold)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--t3)"; e.currentTarget.style.borderColor = "var(--border)"; }}>{t}</button>
                ))}
              </div>
            </div>
          )}
          {fmt === "voices" && voices.length > 0 && (<div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "28px" }}>
              <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--t4)", letterSpacing: "0.12em" }}>{voices.length} VOICES</span>
              <button onClick={() => cp(voices.map(v => `${v.name}: "${v.stmts[0]?.quote}"`).join("\n"))} style={{ background: "none", border: "none", color: "var(--t4)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--mono)" }}>Copy</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              {voices.map((v, vi) => {
                const isExp = vExp.has(vi); const first = v.stmts[0]; const rest = v.stmts.slice(1);
                return (<div key={vi}>
                  <div style={{ marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "2px" }}>{v.name}</h3>
                    <span style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "var(--t4)" }}>{v.title}</span>
                  </div>
                  {first && (<div style={{ paddingLeft: "16px", borderLeft: `2px solid ${v.c}40`, cursor: rest.length ? "pointer" : "default" }}
                    onClick={() => rest.length && setVExp(p => { const n = new Set(p); n.has(vi) ? n.delete(vi) : n.add(vi); return n; })}>
                    <p style={{ fontSize: "17px", color: "var(--t1)", lineHeight: 1.6, fontStyle: "italic", fontFamily: "var(--serif)", marginBottom: "8px" }}>"{first.quote}"</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--t4)", letterSpacing: "0.1em" }}>{first.context}</span>
                      <Lnk url={first.url} />
                      {rest.length > 0 && <span style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "var(--t4)", marginLeft: "auto" }}>+{rest.length} more</span>}
                    </div>
                  </div>)}
                  {isExp && rest.map((s, si) => (
                    <div key={si} style={{ paddingLeft: "16px", borderLeft: "2px solid var(--border)", marginTop: "16px" }}>
                      <p style={{ fontSize: "15px", color: "var(--t2)", lineHeight: 1.6, fontStyle: "italic", fontFamily: "var(--serif)", marginBottom: "6px" }}>"{s.quote}"</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--t4)" }}>{s.context}</span>
                        <Lnk url={s.url} />
                      </div>
                    </div>
                  ))}
                </div>);
              })}
            </div>
          </div>)}

          {/* ── Journal ── */}
          {fmt === "journal" && (<div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
              <h1 style={{ fontSize: "22px", fontFamily: "var(--body)", color: "#fff", fontWeight: 600 }}>Learning Journal</h1>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => cp(journalToMd())} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--t3)", cursor: "pointer", padding: "5px 12px", fontSize: "11px", fontFamily: "var(--mono)", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--gold)"} onMouseLeave={e => e.currentTarget.style.color = "var(--t3)"}>Copy as Markdown</button>
                {journal.length > 0 && <button onClick={clearJournal} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--t4)", cursor: "pointer", padding: "5px 12px", fontSize: "11px", fontFamily: "var(--mono)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#C75B5B"} onMouseLeave={e => e.currentTarget.style.color = "var(--t4)"}>Clear</button>}
              </div>
            </div>
            {journal.length === 0 && <p style={{ fontSize: "14px", color: "var(--t3)", lineHeight: 1.6 }}>No entries yet. Run a News or Voices search to start logging.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {journal.map((e, i) => {
                if (!e?.ts) return null;
                const d = new Date(e.ts);
                const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                const typeColors = { news: "var(--t3)", today: "var(--gold)", voices: "var(--blue)", search: "var(--green)" };
                const items = Array.isArray(e.items) ? e.items : [];
                return (
                  <div key={i} style={{ paddingBottom: "20px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--t4)", letterSpacing: "0.12em" }}>{date} · {time}</span>
                      <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: typeColors[e.type] || "var(--t3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{e.type}</span>
                      {e.lens && <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--gold)" }}>· {e.lens}</span>}
                    </div>
                    {e.topline && <p style={{ fontSize: "14px", color: "var(--t2)", lineHeight: 1.6, marginBottom: "8px", fontStyle: "italic" }}>"{e.topline}"</p>}
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {items.map((it, j) => (
                        <li key={j} style={{ fontSize: "13px", color: "var(--t2)", lineHeight: 1.5, padding: "2px 0", display: "flex", gap: "6px" }}>
                          <span style={{ color: "var(--t4)", flexShrink: 0 }}>·</span>
                          <span><strong style={{ color: "var(--t1)", fontWeight: 500 }}>{it.title}</strong>{it.source ? ` — ${it.source}` : ""}{it.url && <span> <a href={it.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)", textDecoration: "none", fontSize: "10px", opacity: 0.6 }}>↗</a></span>}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>)}
        </main>

        {/* Right Rail */}
        {navOpen && (
          <aside style={{ width: "260px", flexShrink: 0, borderLeft: "1px solid var(--border)", padding: "32px 0 32px 24px", overflowY: "auto", position: "sticky", top: "52px", height: "calc(100vh - 52px)", animation: "fadeIn 0.2s" }}>
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              {["topics","workflow","segments"].map(t => (
                <button key={t} onClick={() => setSTab(t)} style={{ background: "none", border: "none", fontSize: "10px", fontFamily: "var(--mono)", letterSpacing: "0.12em", color: sTab === t ? "var(--gold)" : "var(--t4)", cursor: "pointer", padding: "0 0 4px", borderBottom: sTab === t ? "1px solid var(--gold)" : "1px solid transparent", textTransform: "uppercase" }}>{t}</button>
              ))}
            </div>

            {sTab === "topics" && (<div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px", marginBottom: "8px" }}>
                <button onClick={() => setShowAdd(!showAdd)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "3px", color: showAdd ? "var(--gold)" : "var(--t4)", cursor: "pointer", padding: "2px 8px", fontSize: "10px", fontFamily: "var(--mono)" }}>{showAdd ? "✕" : "+"}</button>
              </div>
              {showAdd && (<div style={{ marginBottom: "12px" }}>
                <input ref={addRef} value={nL} onChange={e => setNL(e.target.value)} placeholder="Label" onKeyDown={e => e.key === "Enter" && addT()} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--t1)", padding: "5px 8px", fontSize: "11px", fontFamily: "var(--body)", outline: "none", borderRadius: "3px", marginBottom: "4px" }} />
                <input value={nQu} onChange={e => setNQu(e.target.value)} placeholder="Terms (opt)" onKeyDown={e => e.key === "Enter" && addT()} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--t1)", padding: "5px 8px", fontSize: "11px", fontFamily: "var(--body)", outline: "none", borderRadius: "3px", marginBottom: "4px" }} />
                <button onClick={addT} disabled={!nL.trim()} style={{ background: nL.trim() ? "var(--gold)" : "var(--bg2)", color: nL.trim() ? "var(--bg)" : "var(--t4)", border: "none", padding: "4px 12px", borderRadius: "3px", fontSize: "10px", fontFamily: "var(--mono)", cursor: nL.trim() ? "pointer" : "default", width: "100%" }}>Add</button>
              </div>)}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {allTopics.map((t, i) => (
                  <button key={i} onClick={() => selectLens("topic", t.label, t.q)} disabled={loading}
                    style={{ background: lens?.label === t.label ? "rgba(201,168,76,0.12)" : "var(--bg2)", border: `1px solid ${lens?.label === t.label ? "rgba(201,168,76,0.3)" : "var(--border)"}`, borderRadius: "20px", color: lens?.label === t.label ? "var(--gold)" : "var(--t3)", padding: "4px 10px", cursor: "pointer", fontSize: "11px", fontFamily: "var(--body)", transition: "all 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#fff"; }} onMouseLeave={e => { e.currentTarget.style.color = lens?.label === t.label ? "var(--gold)" : "var(--t3)"; }}
                  >{t.custom ? "★ " : ""}{t.label}</button>
                ))}
              </div>
            </div>)}

            {sTab === "workflow" && (<div style={{ display: "flex", flexDirection: "column" }}>
              {WORKFLOWS.map((w, i) => (
                <button key={i} onClick={() => selectLens("workflow", w.label, w.q)} disabled={loading}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderBottom: "1px solid var(--border-dim)", color: lens?.label === w.label ? "var(--blue)" : "var(--t3)", padding: "8px 0", cursor: "pointer", fontSize: "12px", fontFamily: "var(--body)", transition: "color 0.12s", fontWeight: lens?.label === w.label ? 600 : 400 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = lens?.label === w.label ? "var(--blue)" : "var(--t3)"}>
                  <span>{w.label}</span><span style={{ fontSize: "10px", opacity: 0.3 }}>→</span>
                </button>
              ))}
            </div>)}

            {sTab === "segments" && (<div>
              {SEGMENTS.map((s, i) => (
                <div key={i}>
                  <button onClick={() => { if (s.accounts) setSegOpen(p => p === i ? null : i); selectLens("segment", s.label, s.q); }} disabled={loading}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--border-dim)", color: lens?.label === s.label ? "var(--green)" : "var(--t3)", padding: "8px 0", cursor: "pointer", fontSize: "12px", fontFamily: "var(--body)", transition: "color 0.12s", fontWeight: lens?.label === s.label ? 600 : 400 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = lens?.label === s.label ? "var(--green)" : "var(--t3)"}>
                    <span style={{ fontSize: "10px", marginRight: "4px" }}>{s.accounts ? (segOpen === i ? "▾" : "▸") : "◈"}</span>{s.label}
                    <span style={{ display: "block", fontSize: "10px", color: "var(--t4)", fontFamily: "var(--mono)", marginLeft: "14px" }}>{s.desc}</span>
                  </button>
                  {s.accounts && segOpen === i && s.accounts.map((a, ai) => (
                    <button key={ai} onClick={() => selectLens("account", a.name, a.q)} disabled={loading}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--border-dim)", color: lens?.label === a.name ? "var(--green)" : "var(--t4)", padding: "6px 0 6px 20px", cursor: "pointer", fontSize: "11px", fontFamily: "var(--body)", transition: "color 0.12s", fontWeight: lens?.label === a.name ? 600 : 400 }}
                      onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = lens?.label === a.name ? "var(--green)" : "var(--t4)"}>
                      {a.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>)}

            {saved.length > 0 && (<div style={{ marginTop: "28px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--t4)", letterSpacing: "0.12em", marginBottom: "10px" }}>SAVED · {saved.length}</h3>
              {saved.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
                  <span style={{ flex: 1, fontSize: "11px", color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                  <button onClick={() => tSave(s)} style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: "9px", padding: 0, opacity: 0.5 }}>✕</button>
                </div>
              ))}
            </div>)}
          </aside>
        )}
      </div>
    </div>
  );
}

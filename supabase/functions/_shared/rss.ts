// RSS / Atom feed parser pour Edge Functions Deno (Ticket 3 — ingest_rss).
//
// Contraintes (handoff §3 Ticket 3 + RECAP_TICKET_2_NOTES.md §2) :
//   - Module pur : aucune I/O Supabase ici, on rend des objets typés.
//   - deno-dom-wasm v0.1.46 en mimeType "text/html" UNIQUEMENT
//     ("text/xml" lève "DOMParser: 'text/xml' unimplemented" à l'exécution,
//     constaté en prod sur ingest_pubmed). En mode HTML deno-dom lowercase
//     les noms de balises et d'attributs au parse, donc tous les sélecteurs
//     CSS et getAttribute ci-dessous sont en lowercase.
//   - Sélecteurs CSS lowercase + utilitaire findChildByLocalName pour les
//     balises namespacées (dc:date, content:encoded) : le caractère ":" n'est
//     pas matchable directement par querySelector sans échappement, et
//     deno-dom expose le nom complet "dc:date" sur Element.tagName.
//   - Compatibilité formats : RSS 2.0, Atom 1.0, et rss.app (RSS 2.0 quirky).
//   - Décodage entités HTML (numériques + nommées courantes) appliqué
//     idempotemment sur title/description après textContent (deno-dom décode
//     déjà les entités du textContent en mode HTML, mais la double-passe
//     couvre les cas CDATA imbriqués et les flux malformés).
//   - Timeout fetch 15s par flux (AbortController), retry exp 3x sur 5xx +
//     erreurs réseau (1s → 2s → 4s).
//   - Hash fallback SHA-256 si guid ET link absents : sha256(title + raw_pub_date).
//   - Si title ET pubDate manquent simultanément → l'item est SKIPPÉ et compté
//     dans skipped (le hash inventé serait instable d'un run à l'autre).
//
// API publique :
//   - fetchFeed(url, opts)                   → string (XML brut)
//   - parseFeed(xml)                         → Promise<RssParseResult>
//   - normalizeLink(raw)                     → string | null  (utilitaire exporté pour tests)

import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.46/deno-dom-wasm.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RssFeedFormat = "rss2" | "atom";
export type ExternalIdSource = "guid" | "link" | "hash";

export interface RssItem {
  /** Identifiant calculé pour la dedup (col `external_id` de news_raw). */
  external_id: string;
  /** Provenance de l'external_id ('guid'|'link'|'hash') — stocké dans raw_payload. */
  external_id_source: ExternalIdSource;
  title: string | null;
  link: string | null;
  /** Description / summary — utilisé comme abstract. */
  description: string | null;
  /** Date publication ISO (YYYY-MM-DD), null si non parseable. */
  published_at: string | null;
  authors: string[];
  feed_format: RssFeedFormat;
  /** Snapshot brut pour news_raw.raw_payload (forensic). */
  raw_guid: string | null;
  raw_link: string | null;
  raw_pub_date: string | null;
}

export interface RssParseResult {
  format: RssFeedFormat | null;
  items: RssItem[];
  /** Items sautés faute de title ET pubDate simultanément absents. */
  skipped: number;
}

export interface FetchFeedOptions {
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
}

// ---------------------------------------------------------------------------
// fetchFeed — timeout + retry exp sur 5xx/network
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_USER_AGENT = "dentallearn-news/1.0 (+https://dental-learn-v3.vercel.app)";

export async function fetchFeed(url: string, opts: FetchFeedOptions = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;

  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": userAgent,
          "accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
        },
        redirect: "follow",
      });
      clearTimeout(timer);
      if (res.ok) return await res.text();
      // 4xx non retryable — sauf 408/429.
      if (res.status >= 500 || res.status === 408 || res.status === 429) {
        lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
        await res.body?.cancel();
      } else {
        await res.body?.cancel();
        throw new Error(`HTTP ${res.status} ${res.statusText} (non-retryable)`);
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      // Cas non-retryable détecté plus haut → on remonte.
      if (e instanceof Error && /non-retryable/.test(e.message)) throw e;
    }
    if (attempt < maxRetries) {
      const backoff = 1000 * Math.pow(2, attempt);
      await sleep(backoff);
    }
    attempt++;
  }
  throw lastErr ?? new Error("fetchFeed: exhausted retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// parseFeed — détection format + extraction items
// ---------------------------------------------------------------------------

export async function parseFeed(xml: string): Promise<RssParseResult> {
  if (!xml || !xml.trim()) return { format: null, items: [], skipped: 0 };

  const doc = new DOMParser().parseFromString(xml, "text/html");
  if (!doc) return { format: null, items: [], skipped: 0 };

  // Detection : <feed> = Atom, <rss>/<channel> = RSS 2.0.
  // En mode HTML, deno-dom encapsule le contenu dans <html><body>... — on
  // cherche donc les balises où qu'elles soient dans l'arbre.
  const atomRoot = doc.querySelector("feed");
  const rssChannel = doc.querySelector("rss > channel") ?? doc.querySelector("channel");

  if (atomRoot) {
    return parseAtom(atomRoot);
  }
  if (rssChannel) {
    return await parseRss2(rssChannel);
  }
  return { format: null, items: [], skipped: 0 };
}

// ---------------------------------------------------------------------------
// RSS 2.0
// ---------------------------------------------------------------------------

async function parseRss2(channel: Element): Promise<RssParseResult> {
  const itemNodes = Array.from(channel.querySelectorAll("item"))
    .filter((n): n is Element => n.nodeType === 1);

  const items: RssItem[] = [];
  let skipped = 0;

  for (const item of itemNodes) {
    const rawGuid = textOf(item, "guid");
    const rawLink = textOf(item, "link");
    const rawPubDate =
      textOf(item, "pubdate") ??
      // dc:date — namespace, : non matchable en CSS sans échappement.
      findChildByLocalName(item, "dc:date")?.textContent?.trim() ??
      null;

    const titleRaw = textOf(item, "title");
    const descriptionRaw =
      textOf(item, "description") ??
      // content:encoded — namespace.
      findChildByLocalName(item, "content:encoded")?.textContent?.trim() ??
      null;

    const title = titleRaw ? decodeEntities(titleRaw) : null;
    const description = descriptionRaw ? decodeEntities(descriptionRaw) : null;

    const publishedAt = rawPubDate ? toIsoDate(rawPubDate) : null;

    // Authors RSS 2.0 : <author> ou <dc:creator>.
    const authors: string[] = [];
    const authorEl = item.querySelector("author");
    if (authorEl?.textContent?.trim()) authors.push(decodeEntities(authorEl.textContent.trim()));
    const dcCreator = findChildByLocalName(item, "dc:creator");
    if (dcCreator?.textContent?.trim()) authors.push(decodeEntities(dcCreator.textContent.trim()));

    const idResolution = await resolveExternalId({
      guid: rawGuid,
      link: rawLink,
      title,
      rawPubDate,
    });
    if (!idResolution) {
      skipped++;
      continue;
    }

    items.push({
      external_id: idResolution.external_id,
      external_id_source: idResolution.source,
      title,
      link: rawLink ? normalizeLink(rawLink) ?? rawLink : null,
      description,
      published_at: publishedAt,
      authors,
      feed_format: "rss2",
      raw_guid: rawGuid,
      raw_link: rawLink,
      raw_pub_date: rawPubDate,
    });
  }

  return { format: "rss2", items, skipped };
}

// ---------------------------------------------------------------------------
// Atom 1.0
// ---------------------------------------------------------------------------

async function parseAtom(feed: Element): Promise<RssParseResult> {
  const entryNodes = Array.from(feed.querySelectorAll("entry"))
    .filter((n): n is Element => n.nodeType === 1);

  const items: RssItem[] = [];
  let skipped = 0;

  for (const entry of entryNodes) {
    const rawGuid = textOf(entry, "id");
    // <link rel="alternate" href="..."/> ou <link href="..."/>. En mode HTML
    // les attributs sont lowercased — href aussi. On préfère rel="alternate"
    // si présent, sinon le premier <link>.
    const rawLink = pickAtomLink(entry);
    const rawPubDate = textOf(entry, "published") ?? textOf(entry, "updated");

    const titleRaw = textOf(entry, "title");
    const summaryRaw = textOf(entry, "summary") ?? textOf(entry, "content");

    const title = titleRaw ? decodeEntities(titleRaw) : null;
    const description = summaryRaw ? decodeEntities(summaryRaw) : null;

    const publishedAt = rawPubDate ? toIsoDate(rawPubDate) : null;

    const authors = Array.from(entry.querySelectorAll("author"))
      .filter((n): n is Element => n.nodeType === 1)
      .map((a) => a.querySelector("name")?.textContent?.trim() ?? "")
      .filter((s) => s.length > 0)
      .map(decodeEntities);

    const idResolution = await resolveExternalId({
      guid: rawGuid,
      link: rawLink,
      title,
      rawPubDate,
    });
    if (!idResolution) {
      skipped++;
      continue;
    }

    items.push({
      external_id: idResolution.external_id,
      external_id_source: idResolution.source,
      title,
      link: rawLink ? normalizeLink(rawLink) ?? rawLink : null,
      description,
      published_at: publishedAt,
      authors,
      feed_format: "atom",
      raw_guid: rawGuid,
      raw_link: rawLink,
      raw_pub_date: rawPubDate,
    });
  }

  return { format: "atom", items, skipped };
}

function pickAtomLink(entry: Element): string | null {
  const links = Array.from(entry.querySelectorAll("link"))
    .filter((n): n is Element => n.nodeType === 1);
  if (links.length === 0) return null;
  const alternate = links.find((l) => {
    const rel = l.getAttribute("rel");
    return !rel || rel === "alternate";
  });
  const chosen = alternate ?? links[0];
  return chosen.getAttribute("href") ?? chosen.textContent?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// External ID resolution — cascade guid > link > hash
// ---------------------------------------------------------------------------

interface ExternalIdInput {
  guid: string | null;
  link: string | null;
  title: string | null;
  rawPubDate: string | null;
}

interface ExternalIdResolution {
  external_id: string;
  source: ExternalIdSource;
}

async function resolveExternalId(
  input: ExternalIdInput,
): Promise<ExternalIdResolution | null> {
  const guid = input.guid?.trim();
  if (guid && guid.length > 0) {
    return { external_id: guid, source: "guid" };
  }
  const link = input.link?.trim();
  if (link && link.length > 0) {
    const normalized = normalizeLink(link) ?? link;
    return { external_id: normalized, source: "link" };
  }
  // Fallback hash : nécessite au moins title OU pubDate. Si les deux
  // manquent, on skip pour éviter un hash instable d'un run à l'autre.
  if (!input.title && !input.rawPubDate) {
    return null;
  }
  const hash = await sha256Hex(`${input.title ?? ""}|${input.rawPubDate ?? ""}`);
  return { external_id: `sha256:${hash}`, source: "hash" };
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Link normalization — strip UTM, lowercase host, trim trailing slash
// ---------------------------------------------------------------------------

const UTM_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
]);

export function normalizeLink(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    u.hostname = u.hostname.toLowerCase();
    // Strip UTM params en conservant l'ordre des autres paramètres.
    const filtered: [string, string][] = [];
    for (const [k, v] of u.searchParams) {
      if (!UTM_KEYS.has(k.toLowerCase())) filtered.push([k, v]);
    }
    // searchParams est mutable — on le reconstruit pour figer l'ordre.
    u.search = "";
    for (const [k, v] of filtered) u.searchParams.append(k, v);
    let s = u.toString();
    // Trim trailing slash sur path != "/", sans toucher à la query/fragment.
    if (u.pathname !== "/" && u.pathname.endsWith("/") && !u.search && !u.hash) {
      s = s.replace(/\/$/, "");
    }
    return s;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers parsing — sélecteurs lowercase + namespaces
// ---------------------------------------------------------------------------

function textOf(root: Element, selector: string): string | null {
  const el = root.querySelector(selector);
  const v = el?.textContent?.trim();
  return v && v.length > 0 ? v : null;
}

/**
 * Cherche dans les enfants directs (recursif) un élément dont le tagName
 * (lowercased par deno-dom en mode HTML) correspond exactement à `name`.
 * Indispensable pour les balises namespacées (dc:date, content:encoded) :
 * le `:` n'est pas un caractère de sélecteur CSS standard et nécessiterait
 * un échappement non garanti par deno-dom.
 */
function findChildByLocalName(root: Element, name: string): Element | null {
  const target = name.toLowerCase();
  const stack: Element[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const child of Array.from(node.children)) {
      if (child.tagName.toLowerCase() === target) return child;
      stack.push(child);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Date parsing — RSS 2.0 (RFC 822) + Atom/dc:date (ISO 8601)
// ---------------------------------------------------------------------------

function toIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // `new Date()` parse RFC 822 (ex: "Mon, 25 Apr 2026 14:30:00 GMT") ET
  // ISO 8601 nativement. Si invalide, on retourne null.
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Décodage entités HTML
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  agrave: "à",
  acirc: "â",
  auml: "ä",
  iacute: "í",
  igrave: "ì",
  icirc: "î",
  iuml: "ï",
  oacute: "ó",
  ograve: "ò",
  ocirc: "ô",
  ouml: "ö",
  uacute: "ú",
  ugrave: "ù",
  ucirc: "û",
  uuml: "ü",
  ccedil: "ç",
  ntilde: "ñ",
  aelig: "æ",
  oelig: "œ",
  szlig: "ß",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  middot: "·",
  bull: "•",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([\da-f]+);/gi, (_m, hex: string) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return _m;
      }
    })
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return _m;
      }
    })
    .replace(/&([a-z]+);/gi, (m, name: string) => {
      const replacement = NAMED_ENTITIES[name.toLowerCase()];
      return replacement ?? m;
    });
}

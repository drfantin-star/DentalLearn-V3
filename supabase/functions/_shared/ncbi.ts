// NCBI E-utilities client (PubMed) pour Edge Functions Deno.
//
// Contraintes (handoff §4.6) :
//   - Rate limit : 3 req/s sans API key, 10 req/s avec (PUBMED_API_KEY).
//   - Email (tool=...&email=...) obligatoire (politique NCBI).
//   - Backoff exponentiel sur 429/5xx, max 3 retries.
//   - Aucune PII dans les logs (handoff §4.9).
//
// Ce module expose :
//   - ESearch : recherche par requête MeSH → liste de PMID.
//   - EFetch  : récupération du détail d'un lot de PMID (XML).
//   - extractArticles(xml) : parse XML → ArticleMeta[] (titre, abstract, authors,
//     journal, date, DOI, flag `retracted`).
//
// Parser XML : `deno-dom-wasm` (JSDOM-like, fonctionne en Deno Deploy / Edge).

import { DOMParser, Element } from "https://esm.sh/linkedom@0.16.11";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ESearchResult {
  count: number;
  pmids: string[];
}

export interface ArticleMeta {
  pmid: string;
  title: string;
  abstract: string | null;
  authors: string[];
  journal: string | null;
  doi: string | null;
  /** ISO date (YYYY-MM-DD) si disponible, sinon null. */
  publishedAt: string | null;
  /** true si <PublicationType>Retracted Publication</PublicationType>. */
  retracted: boolean;
}

export interface NcbiClientOptions {
  /** PUBMED_EMAIL (obligatoire — politique NCBI). */
  email: string;
  /** PUBMED_API_KEY (optionnelle — augmente le rate limit de 3→10 req/s). */
  apiKey?: string;
  /** Identifiant applicatif envoyé dans `tool=`. Par défaut 'dentallearn-news'. */
  tool?: string;
  /** Max retries sur 429/5xx (défaut 3). */
  maxRetries?: number;
}

// ---------------------------------------------------------------------------
// Rate limiter — enforce un délai minimum entre requêtes.
// ---------------------------------------------------------------------------

class RateLimiter {
  private lastCall = 0;
  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.lastCall = Date.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export class NcbiClient {
  private readonly email: string;
  private readonly apiKey: string | undefined;
  private readonly tool: string;
  private readonly maxRetries: number;
  private readonly limiter: RateLimiter;

  constructor(opts: NcbiClientOptions) {
    if (!opts.email) throw new Error("NcbiClient: email required");
    this.email = opts.email;
    this.apiKey = opts.apiKey && opts.apiKey.length > 0 ? opts.apiKey : undefined;
    this.tool = opts.tool ?? "dentallearn-news";
    this.maxRetries = opts.maxRetries ?? 3;
    // 3 req/s = 334ms, 10 req/s = 100ms. On garde une marge (+10%).
    const minIntervalMs = this.apiKey ? 110 : 367;
    this.limiter = new RateLimiter(minIntervalMs);
  }

  /**
   * ESearch — retourne les PMID correspondant à une requête MeSH.
   * @param query  ex : `("Endodontics"[MeSH]) AND ("last 7 days"[DP])`
   * @param retmax limite de résultats (défaut 200, max 10000).
   */
  async eSearch(query: string, retmax = 200): Promise<ESearchResult> {
    const params = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmode: "json",
      retmax: String(retmax),
    });
    const url = `${EUTILS_BASE}/esearch.fcgi?${this.appendAuth(params)}`;
    const res = await this.fetchWithRetry(url);
    const body = await res.json() as {
      esearchresult?: { count?: string; idlist?: string[] };
    };
    const result = body.esearchresult;
    return {
      count: result?.count ? parseInt(result.count, 10) : 0,
      pmids: result?.idlist ?? [],
    };
  }

  /**
   * EFetch — récupère le détail XML d'un lot de PMID.
   * NCBI recommande ≤ 200 PMID par requête.
   */
  async eFetch(pmids: string[]): Promise<string> {
    if (pmids.length === 0) return "";
    if (pmids.length > 200) {
      throw new Error(`EFetch accepts up to 200 PMIDs per call (got ${pmids.length})`);
    }
    const params = new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      retmode: "xml",
      rettype: "xml",
    });
    const url = `${EUTILS_BASE}/efetch.fcgi?${this.appendAuth(params)}`;
    const res = await this.fetchWithRetry(url);
    return await res.text();
  }

  private appendAuth(params: URLSearchParams): string {
    params.set("tool", this.tool);
    params.set("email", this.email);
    if (this.apiKey) params.set("api_key", this.apiKey);
    return params.toString();
  }

  /**
   * fetch() avec rate-limit + retry exponentiel sur 429/5xx.
   * Backoff : 1s → 2s → 4s.
   */
  private async fetchWithRetry(url: string): Promise<Response> {
    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= this.maxRetries) {
      await this.limiter.wait();
      try {
        const res = await fetch(url);
        if (res.ok) return res;
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`NCBI ${res.status} ${res.statusText}`);
          await res.body?.cancel();
        } else {
          await res.body?.cancel();
          throw new Error(`NCBI ${res.status} ${res.statusText} (non-retryable)`);
        }
      } catch (e) {
        lastErr = e;
      }
      const backoff = 1000 * Math.pow(2, attempt);
      await sleep(backoff);
      attempt++;
    }
    throw lastErr ?? new Error("NCBI: exhausted retries");
  }
}

// ---------------------------------------------------------------------------
// XML parsing — PubMedArticle → ArticleMeta
// ---------------------------------------------------------------------------

/**
 * Extrait les articles d'une réponse EFetch XML.
 * Fonction pure : prend le XML brut, rend un ArticleMeta[]. Testable unitaire.
 */
export function extractArticles(xml: string): ArticleMeta[] {
  if (!xml.trim()) return [];
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (!doc) return [];
  const nodes = Array.from(doc.querySelectorAll("PubmedArticle"));
  return nodes.map(parsePubmedArticle).filter((a): a is ArticleMeta => a !== null);
}

/**
 * Teste la présence du flag de rétraction.
 * Doit matcher exactement `<PublicationType>Retracted Publication</PublicationType>`
 * (case-sensitive selon NCBI DTD).
 */
export function isRetractedArticle(articleNode: Element): boolean {
  const types = Array.from(articleNode.querySelectorAll("PublicationType"));
  return types.some((t) => t.textContent?.trim() === "Retracted Publication");
}

function parsePubmedArticle(node: Element): ArticleMeta | null {
  const pmid = text(node, "MedlineCitation > PMID") ?? text(node, "PMID");
  if (!pmid) return null;

  const title = text(node, "ArticleTitle") ?? "";
  const abstract = collectAbstract(node);
  const authors = collectAuthors(node);
  const journal = text(node, "Journal > Title") ?? text(node, "Journal > ISOAbbreviation");
  const doi = findArticleId(node, "doi");
  const publishedAt = parsePublishedDate(node);
  const retracted = isRetractedArticle(node);

  return { pmid, title, abstract, authors, journal, doi, publishedAt, retracted };
}

function text(root: Element, selector: string): string | null {
  const el = root.querySelector(selector);
  return el?.textContent?.trim() || null;
}

function collectAbstract(node: Element): string | null {
  const parts = Array.from(node.querySelectorAll("Abstract > AbstractText"));
  if (parts.length === 0) return null;
  return parts
    .map((p) => {
      const label = p.getAttribute("Label");
      const body = p.textContent?.trim() ?? "";
      return label ? `${label}: ${body}` : body;
    })
    .filter((s) => s.length > 0)
    .join("\n\n") || null;
}

function collectAuthors(node: Element): string[] {
  const authors = Array.from(node.querySelectorAll("AuthorList > Author"));
  return authors
    .map((a) => {
      const last = a.querySelector("LastName")?.textContent?.trim() ?? "";
      const fore = a.querySelector("ForeName")?.textContent?.trim() ?? "";
      const coll = a.querySelector("CollectiveName")?.textContent?.trim() ?? "";
      if (coll) return coll;
      return [fore, last].filter(Boolean).join(" ").trim();
    })
    .filter((s) => s.length > 0);
}

function findArticleId(node: Element, type: string): string | null {
  const ids = Array.from(node.querySelectorAll("ArticleIdList > ArticleId"));
  for (const id of ids) {
    if (id.getAttribute("IdType") === type) {
      return id.textContent?.trim() || null;
    }
  }
  return null;
}

function parsePublishedDate(node: Element): string | null {
  // Priorité : ArticleDate (date complète), sinon PubDate (peut être partiel).
  const articleDate = node.querySelector("ArticleDate");
  if (articleDate) {
    const y = articleDate.querySelector("Year")?.textContent?.trim();
    const m = articleDate.querySelector("Month")?.textContent?.trim();
    const d = articleDate.querySelector("Day")?.textContent?.trim();
    if (y && m && d) return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  const pubDate = node.querySelector("Journal > JournalIssue > PubDate");
  if (pubDate) {
    const y = pubDate.querySelector("Year")?.textContent?.trim();
    const m = pubDate.querySelector("Month")?.textContent?.trim();
    const d = pubDate.querySelector("Day")?.textContent?.trim();
    if (y) {
      const mm = m ? monthToNum(m) : "01";
      const dd = d ? pad2(d) : "01";
      return `${y}-${mm}-${dd}`;
    }
  }
  return null;
}

function pad2(s: string): string {
  return s.length === 1 ? `0${s}` : s;
}

function monthToNum(m: string): string {
  const map: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  if (map[m]) return map[m];
  if (/^\d+$/.test(m)) return pad2(m);
  return "01";
}

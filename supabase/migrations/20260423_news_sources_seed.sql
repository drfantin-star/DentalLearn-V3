-- Nom du fichier : 20260423_news_sources_seed.sql
-- Date de création : 2026-04-23
-- Ticket : feature/news-ticket-1
-- Description : Seed initial de news_sources — 12 sources PubMed + 4 flux RSS pilotes
-- Rollback : supabase/migrations/20260423_news_schema_down.sql

-- ============================================================================
-- NOTE
-- ============================================================================
-- Idempotent via ON CONFLICT (name) DO NOTHING, aligné sur la contrainte
-- news_sources_name_uniq déclarée dans 20260423_news_schema.sql. Relancer ce
-- seed est sans effet si toutes les sources existent déjà ; n'ajoute que les
-- nouveautés sinon.
--
-- Format du champ `query` (JSONB) :
--   PubMed : {"db":"pubmed","term":"...","reldate":7,"lang":[...],"pubtypes":[...]}
--   RSS    : {"feed_url":"...","format":"rss2","accept_types":["article"]}
-- La clé pubtypes est appliquée par l'Edge Function `ingest_pubmed` (Ticket 2)
-- comme filtre PubMed Publication Type. Valeur par défaut retenue pour la
-- Phase 1 : ["Practice Guideline","Meta-Analysis","Systematic Review",
-- "Randomized Controlled Trial","Review"] — suffisamment large pour ne pas
-- manquer de volume en odontologie, assez restrictive pour réduire le bruit.
-- Override possible par source (cas `actu-pro` ci-dessous).
-- ============================================================================

-- ============================================================================
-- SECTION 1. SOURCES PUBMED (12, une par spécialité)
-- ============================================================================
-- URL générique E-utilities NCBI. Le query JSONB contient la requête MeSH.
-- Les tags MeSH ont été choisis pour combiner plusieurs termes avec OR afin
-- d'éviter les queries mono-MeSH trop étroites (consigne Dr Fantin).
-- ============================================================================

INSERT INTO public.news_sources (name, type, url, query, spe_tags, active, notes) VALUES
  ('PubMed - Endodontie', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Endodontics\"[MeSH] OR \"Root Canal Therapy\"[MeSH] OR \"Dental Pulp Diseases\"[MeSH] OR \"Periapical Diseases\"[MeSH]","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['endo'], true, NULL),

  ('PubMed - Parodontologie', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Periodontics\"[MeSH] OR \"Periodontal Diseases\"[MeSH] OR \"Gingival Diseases\"[MeSH] OR \"Peri-Implantitis\"[MeSH]","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['paro'], true,
   'Inclut Peri-Implantitis[MeSH] — chevauche volontairement avec la source PubMed - Implantologie. Le dédoublonnage par (source_id, external_id) en news_raw et par dedupe_hash en news_scored traite les doublons en aval.'),

  ('PubMed - Chirurgie orale', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Surgery, Oral\"[MeSH] OR \"Oral Surgical Procedures\"[MeSH] OR \"Tooth Extraction\"[MeSH]","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['chir-orale'], true, NULL),

  ('PubMed - Implantologie', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Dental Implantation\"[MeSH] OR \"Dental Implants\"[MeSH] OR \"Peri-Implantitis\"[MeSH] OR \"Dental Prosthesis, Implant-Supported\"[MeSH]","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['implanto'], true,
   'Inclut Peri-Implantitis[MeSH] — chevauche volontairement avec la source PubMed - Parodontologie (cf note paro).'),

  ('PubMed - Dentisterie restauratrice', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Dental Restoration, Permanent\"[MeSH] OR \"Composite Resins\"[MeSH] OR \"Dental Bonding\"[MeSH] OR \"Dental Caries\"[MeSH]","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['dent-resto'], true, NULL),

  ('PubMed - Prothèse', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Prosthodontics\"[MeSH] OR \"Dental Prosthesis\"[MeSH] OR \"Crowns\"[MeSH] OR \"Denture, Complete\"[MeSH] OR \"Denture, Partial\"[MeSH]","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['proth'], true, NULL),

  ('PubMed - Pédodontie', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Pediatric Dentistry\"[MeSH] OR \"Tooth, Deciduous\"[MeSH] OR \"Dental Care for Children\"[MeSH]","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['pedo'], true, NULL),

  ('PubMed - Orthodontie', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Orthodontics\"[MeSH] OR \"Malocclusion\"[MeSH] OR \"Tooth Movement Techniques\"[MeSH]","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['odf'], true, NULL),

  ('PubMed - Occlusodontie', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Dental Occlusion\"[MeSH] OR \"Temporomandibular Joint Disorders\"[MeSH] OR \"Bruxism\"[MeSH]","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['occluso'], true, NULL),

  ('PubMed - Gérodontologie', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Geriatric Dentistry\"[MeSH] OR (\"Aged\"[MeSH] AND \"Oral Health\"[MeSH])","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['gero'], true,
   'Combinaison "Aged"[MeSH] AND "Oral Health"[MeSH] parenthésée pour éviter une précédence OR/AND non désirée. Volume hebdomadaire probablement faible ; à surveiller en Ticket 2, élargissement possible en retirant le filtre pubtypes si nécessaire.'),

  ('PubMed - Santé publique dentaire', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Public Health Dentistry\"[MeSH] OR \"Oral Health\"[MeSH] OR \"Preventive Dentistry\"[MeSH] OR (\"Epidemiology\"[MeSH] AND \"Tooth Diseases\"[MeSH])","reldate":7,"lang":["fre","eng"],"pubtypes":["Practice Guideline","Meta-Analysis","Systematic Review","Randomized Controlled Trial","Review"]}'::jsonb,
   ARRAY['sante-pub'], true,
   'Parenthésage explicite sur ("Epidemiology"[MeSH] AND "Tooth Diseases"[MeSH]) pour éviter la précédence OR/AND ambiguë.'),

  ('PubMed - Actualité professionnelle', 'pubmed',
   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
   '{"db":"pubmed","term":"\"Dentistry\"[MeSH] OR \"Dental Care\"[MeSH]","reldate":7,"lang":["fre","eng"],"pubtypes":["Editorial","News","Letter"]}'::jsonb,
   ARRAY['actu-pro'], true,
   'Cas particulier : pas de MeSH "actualité professionnelle". Query MeSH volontairement large sur "Dentistry"[MeSH] OR "Dental Care"[MeSH], filtrage restrictif par pubtypes=["Editorial","News","Letter"] (override du default Phase 1). Volume hebdomadaire incertain, à évaluer en Ticket 2.')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SECTION 2. SOURCES RSS (4 flux pilotes)
-- ============================================================================
-- 4 sources pilotes Phase 1 (handoff v1.2) : Cochrane Oral Health (meta-
-- analyses), British Dental Journal (généraliste), HAS (recommandations
-- officielles françaises), L'Information Dentaire (actualité francophone).
-- ============================================================================

INSERT INTO public.news_sources (name, type, url, query, spe_tags, active, notes) VALUES
  ('Cochrane Oral Health', 'rss',
   'https://cochraneohg.wordpress.com/feed',
   '{"feed_url":"https://cochraneohg.wordpress.com/feed","format":"rss2","accept_types":["article"]}'::jsonb,
   ARRAY['paro','endo','dent-resto','pedo'], true,
   'Blog WordPress officiel du groupe Cochrane Oral Health (cochraneohg.wordpress.com). Diffuse annonces et résumés de revues systématiques. Le flux global Cochrane Library (https://www.cochranelibrary.com/cdsr/table-of-contents/rss.xml) est plus large et pourra être ajouté comme source complémentaire ultérieurement si nécessaire.'),

  ('British Dental Journal', 'rss',
   'https://www.nature.com/bdj.rss',
   '{"feed_url":"https://www.nature.com/bdj.rss","format":"rss2","accept_types":["article"]}'::jsonb,
   ARRAY['actu-pro'], true,
   'URL à vérifier en live au Ticket 3. Si 404, fallback vers https://www.nature.com/bdj/articles?type=news.rss ou tester le path générique nature.com avec paramètre journal=bdj.'),

  ('HAS - Haute Autorité de Santé', 'rss',
   'https://www.has-sante.fr/feed/Rss2.jsp?id=p_3081452',
   '{"feed_url":"https://www.has-sante.fr/feed/Rss2.jsp?id=p_3081452","format":"rss2","accept_types":["article"]}'::jsonb,
   ARRAY['sante-pub','actu-pro'], true,
   'Flux officiel HAS "Recommandations et guides" (ID JCMS p_3081452). Couvre recommandations de bonne pratique, recommandations vaccinales et de santé publique, guides et parcours, avis sur les actes.'),

  ('L''Information Dentaire', 'rss',
   'https://rss.app/feeds/WIB3eb2uxxBjWIfT.xml',
   '{"feed_url":"https://rss.app/feeds/WIB3eb2uxxBjWIfT.xml","format":"rss2","accept_types":["article"]}'::jsonb,
   ARRAY['actu-pro'], true,
   'Flux RSS généré par rss.app (service tiers scraping information-dentaire.fr, pas de RSS natif). Risque de rupture si rss.app change son modèle ou si la structure HTML du site évolue. Monitoring alerte admin si flux silencieux > 14 jours.')
ON CONFLICT (name) DO NOTHING;

-- Ajout du niveau de preuve « étude in vitro / ex vivo » (laboratoire)
-- Comble le trou taxonomique : le type niveau_preuve ne contenait que des devis
-- d'études cliniques (cas-clinique … méta-analyse), aucun pour une étude de
-- laboratoire in vitro / ex vivo. Sans ce slug, Sonnet rabat sur le devis
-- clinique le plus proche (consigne de repli) et produit un tag faux — mesuré :
-- 133 synthèses actives sur 632 décrivent une étude in vitro tout en portant un
-- tag de devis clinique (pire cas cas-temoin : 57/86).
-- Même nature et même gabarit que 20260602b (dentisterie-numerique).
-- Contrainte UNIQUE (type, slug) garantit l'idempotence si re-exécuté.

INSERT INTO news_taxonomy (id, type, slug, label, description, active)
VALUES
  (gen_random_uuid(), 'niveau_preuve', 'in-vitro',
   'Étude in vitro / ex vivo (laboratoire)',
   'Études menées sur cellules, souches bactériennes, matériaux, dents extraites ou modèles de laboratoire, sans sujet humain ni animal vivant. Couvre in vitro et ex vivo.',
   true)
ON CONFLICT (type, slug) DO NOTHING;

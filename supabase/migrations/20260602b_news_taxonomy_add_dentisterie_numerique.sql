-- Ajout du thème dentisterie numérique (CFAO / flux numérique)
-- Comble le trou taxonomique qui forçait Sonnet à inventer le slug 'numerique'
-- (fail récurrent tag_validation, 2 articles failed_permanent).
-- Contrainte UNIQUE (type, slug) garantit l'idempotence si re-exécuté.

INSERT INTO news_taxonomy (id, type, slug, label, description, active)
VALUES
  (gen_random_uuid(), 'theme', 'dentisterie-numerique',
   'Dentisterie numérique (CFAO, flux numérique)',
   'CFAO/CAD-CAM, empreinte optique, flux de travail numérique, impression 3D, usinage/fraisage, précision de fabrication des restaurations.',
   true)
ON CONFLICT (type, slug) DO NOTHING;

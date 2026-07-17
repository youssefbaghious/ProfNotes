-- ──────────── Création des tables ────────────

-- Table : professeurs
CREATE TABLE professeurs (
  id            SERIAL PRIMARY KEY,
  auth_id       UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nom           VARCHAR(100) NOT NULL,
  prénom        VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  filière       VARCHAR(100) DEFAULT NULL,
  avatar        TEXT DEFAULT NULL,
  module        VARCHAR(100) DEFAULT NULL,
  créé_le       TIMESTAMP DEFAULT NOW(),
  modifie_le    TIMESTAMP DEFAULT NOW()
);

-- Table : classes
CREATE TABLE classes (
  id            SERIAL PRIMARY KEY,
  professeur_id INT NOT NULL REFERENCES professeurs(id) ON DELETE CASCADE,
  nom           VARCHAR(100) NOT NULL,
  filière       VARCHAR(100) DEFAULT NULL,
  coefficient   NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  créé_le       TIMESTAMP DEFAULT NOW(),
  modifie_le    TIMESTAMP DEFAULT NOW()
);

-- Table : étudiants
CREATE TABLE étudiants (
  id              SERIAL PRIMARY KEY,
  professeur_id   INT NOT NULL REFERENCES professeurs(id) ON DELETE CASCADE,
  nom             VARCHAR(100) NOT NULL,
  prénom          VARCHAR(100) NOT NULL,
  cne             VARCHAR(10) NOT NULL UNIQUE,
  filière         VARCHAR(100) DEFAULT NULL,
  créé_le         TIMESTAMP DEFAULT NOW(),
  modifie_le      TIMESTAMP DEFAULT NOW(),
  CONSTRAINT étudiants_cne_verification CHECK (cne ~ '^[A-Z][0-9]{9}$')
);

-- Table : notes
CREATE TABLE notes (
  id              SERIAL PRIMARY KEY,
  étudiant_id     INT NOT NULL REFERENCES étudiants(id) ON DELETE CASCADE,
  module_id       INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  valeur          NUMERIC(5,2) NOT NULL,
  coefficient     NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  type            VARCHAR(50) NOT NULL DEFAULT 'Contrôle',
  semestre        VARCHAR(20) DEFAULT NULL,
  commentaire     TEXT DEFAULT NULL,
  date_saisie     TIMESTAMP DEFAULT NOW(),
  modifie_le      TIMESTAMP DEFAULT NOW(),
  CONSTRAINT notes_valeur_verification CHECK (valeur >= 0 AND valeur <= 20),
  UNIQUE (étudiant_id, module_id, type, semestre)
);

-- Table : Absences
CREATE TABLE absences (
  id            SERIAL PRIMARY KEY,
  étudiant_id   INT NOT NULL REFERENCES étudiants(id) ON DELETE CASCADE,
  classe_id     INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date_séance   TIMESTAMP NOT NULL,
  type_séance   VARCHAR(10) NOT NULL DEFAULT 'Cours',
  est_present   BOOLEAN NOT NULL DEFAULT true,
  est_justifié  BOOLEAN DEFAULT false,
  UNIQUE(étudiant_id, classe_id, date_séance, type_séance)
);

-- Permissions de base pour les rôles anonyme et authentifié
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ──────────── Protection des données ────────────

-- Garantit que chaque professeur ne peut accéder qu'à ses propres données
ALTER TABLE professeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE étudiants ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

-- Retourne l'ID du professeur connecté
CREATE FUNCTION id_prof_actuel()
RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT id 
  FROM professeurs 
  WHERE auth_id = auth.uid()  
$$;

-- Un professeur peut uniquement accède à ses données
CREATE POLICY professeurs_global ON professeurs FOR ALL USING (auth_id = auth.uid());

-- Un professeur peut uniquement gérer ses propres classes
CREATE POLICY classes_global ON classes FOR ALL USING (professeur_id = id_prof_actuel());

-- Un professeur peut uniquement gérer ses propres étudiants
CREATE POLICY étudiants_global ON étudiants FOR ALL USING (professeur_id = id_prof_actuel());

-- Un professeur peut uniquement gérer les notes de ses étudiants
CREATE POLICY notes_global ON notes FOR ALL USING (
  étudiant_id IN (SELECT id FROM étudiants WHERE professeur_id = id_prof_actuel()));

-- Un professeur peut uniquement gérer les absences de ses classes
CREATE POLICY absences_global ON absences FOR ALL USING (
  classe_id IN (SELECT id FROM classes WHERE professeur_id = id_prof_actuel()));



CREATE FUNCTION chercher_étudiants( id_prof INT, recherche TEXT )
RETURNS JSON LANGUAGE sql STABLE
AS $$
  SELECT json_agg(résultat)
  FROM (
    SELECT e.*, 
      ROUND(
        SUM(n.valeur * n.coefficient) / NULLIF(SUM(n.coefficient), 0),
        2
      ) AS moyenne
    FROM étudiants e
    LEFT JOIN notes n ON n.étudiant_id = e.id  
    WHERE e.professeur_id = id_prof
      AND (e.nom ILIKE '%' || recherche || '%'
        OR e.prénom ILIKE '%' || recherche || '%'
        OR e.cne ILIKE '%' || recherche || '%')  
    GROUP BY e.id
    ORDER BY e.nom
  ) résultat; 
$$;

CREATE FUNCTION obtenir_étudiants_avec_moyenne( id_prof INT )
RETURNS JSON LANGUAGE sql STABLE
AS $$
  SELECT json_agg(résultat)
  FROM (
    SELECT e.*,
      ROUND(
        SUM(n.valeur * n.coefficient) / NULLIF(SUM(n.coefficient), 0),
        2
      ) AS moyenne
    FROM étudiants e
    LEFT JOIN notes n ON n.étudiant_id = e.id 
    WHERE e.professeur_id = id_prof
    GROUP BY e.id
    ORDER BY e.nom
  ) résultat;
$$;

CREATE FUNCTION obtenir_tableau_de_bord( id_prof INT )
RETURNS JSON LANGUAGE sql STABLE 
AS $$
  SELECT json_agg(résultat) FROM (
    SELECT
      COUNT(DISTINCT e.id) AS totalÉtudiants,
      ROUND(
        COALESCE(SUM(n.valeur * n.coefficient) / NULLIF(SUM(n.coefficient), 0), 0), 2
      ) AS moyenneGénérale,
      ROUND(
        COALESCE((COUNT(n.id) * 1.0 / NULLIF(COUNT(DISTINCT e.id) * GREATEST(COUNT(DISTINCT c.id), 1), 0)) * 100, 0)
      ) AS tauxRéussite,
      COUNT(n.id) AS notesSaisies,
      COUNT(DISTINCT c.id) AS nombreClasses
    FROM classes c
    LEFT JOIN étudiants e ON e.professeur_id = id_prof
    LEFT JOIN notes n ON n.étudiant_id = e.id AND n.module_id = c.id
    WHERE c.professeur_id = id_prof
  ) résultat;
$$;

CREATE FUNCTION obtenir_notes_manquantes( id_prof INT )
RETURNS JSON LANGUAGE sql STABLE
AS $$
  SELECT json_agg(l) FROM (
    SELECT c.nom,
      COUNT(DISTINCT e.id) AS total_étudiants,
      COUNT(DISTINCT e.id) - COUNT(DISTINCT n.étudiant_id) AS manquantes,
      COALESCE(
        ROUND((COUNT(DISTINCT e.id) - COUNT(DISTINCT n.étudiant_id)) * 100.0 / NULLIF(COUNT(DISTINCT e.id), 0)),  0
      ) AS pct_manquant
    FROM classes c
    LEFT JOIN étudiants e ON e.filière = c.filière AND e.professeur_id = id_prof
    LEFT JOIN notes n ON n.module_id = c.id AND n.étudiant_id = e.id
    WHERE c.professeur_id = id_prof
    GROUP BY c.id
    HAVING COUNT(DISTINCT n.étudiant_id) < COUNT(DISTINCT e.id)
    ORDER BY manquantes DESC, c.nom
    LIMIT 10
  ) l;
$$;


CREATE FUNCTION obtenir_élèves_difficulté( id_prof INT )
RETURNS JSON LANGUAGE sql STABLE
AS $$
  SELECT json_agg(l) FROM (
    SELECT e.nom, e.prénom, e.filière,
      ROUND(  SUM(n.valeur * n.coefficient) / NULLIF(SUM(n.coefficient), 0),  2) AS moyenne
    FROM étudiants e
    JOIN notes n ON n.étudiant_id = e.id
    WHERE e.professeur_id = id_prof
    GROUP BY e.id
    HAVING ROUND(SUM(n.valeur * n.coefficient) / NULLIF(SUM(n.coefficient), 0), 2) < 10
    ORDER BY moyenne
    LIMIT 10
  ) l;
$$;


CREATE FUNCTION obtenir_distribution_notes( id_prof INT )
RETURNS JSON LANGUAGE sql STABLE
AS $$
  SELECT json_agg(résultat) FROM (
    SELECT
      CASE
        WHEN n.valeur >= 18 THEN '18-20'
        WHEN n.valeur >= 16 THEN '16-17'
        WHEN n.valeur >= 14 THEN '14-15'
        WHEN n.valeur >= 12 THEN '12-13'
        WHEN n.valeur >= 10 THEN '10-11'
        ELSE '0-9'
      END AS tranche,   
      COUNT(*) AS nombre  
    FROM notes n
    JOIN étudiants e ON e.id = n.étudiant_id
    WHERE e.professeur_id = id_prof
    GROUP BY tranche
    ORDER BY MIN(n.valeur) 
  ) résultat;
$$;


CREATE FUNCTION obtenir_résumé_classes( id_prof INT )
RETURNS JSON LANGUAGE sql STABLE AS $$
  SELECT json_agg(résultat) FROM (
    SELECT c.id, c.nom, c.filière, c.coefficient,
      COUNT(DISTINCT e.id) AS nb_étudiants,
      COUNT(DISTINCT e.id) AS notes_attendues,
      COALESCE( ROUND( AVG(n.valeur), 2 ), 0 ) AS moyenne_classe,
      COUNT(n.id) AS notes_saisies,
      COALESCE( ROUND(COUNT(n.id) * 100.0 / NULLIF(COUNT(DISTINCT e.id), 0)), 0 ) AS progression,
      CASE
        WHEN COUNT(n.id) >= COUNT(DISTINCT e.id) THEN 'Complet'
        WHEN COUNT(n.id) > 0 THEN 'En cours'
        ELSE 'En attente'
      END AS statut
    FROM classes c
    LEFT JOIN étudiants e ON e.filière = c.filière AND e.professeur_id = id_prof
    LEFT JOIN notes n ON n.étudiant_id = e.id AND n.module_id = c.id
    WHERE c.professeur_id = id_prof
    GROUP BY c.id
    ORDER BY c.nom
  ) résultat;
$$;


-- Calcule la moyenne d'un étudiant.
CREATE FUNCTION moyenne_étudiant( id_etu INT )
RETURNS NUMERIC LANGUAGE sql STABLE
AS $$
  SELECT ROUND(
    COALESCE(SUM(valeur * coefficient) / NULLIF(SUM(coefficient), 0), 0),
    2
  ) FROM notes 
  WHERE étudiant_id = id_etu;
$$;


-- Retourne la liste des séances déjà enregistrées (historique)
CREATE FUNCTION obtenir_historique_absences( id_prof INT )
RETURNS JSON LANGUAGE sql STABLE AS $$
  SELECT json_agg(l) FROM (
    SELECT a.date_séance, a.classe_id, c.nom AS classe_nom,
      c.filière AS classe_filière, a.type_séance, COUNT(*) AS nb_étudiants
    FROM absences a
    JOIN classes c ON c.id = a.classe_id
    WHERE c.professeur_id = id_prof
    GROUP BY a.date_séance, a.classe_id, c.nom, c.filière, a.type_séance
    ORDER BY a.date_séance DESC, c.nom
  ) l;
$$;


-- ──────────── TRIGGERS (s'exécute quand un événement se produit sur une table.) ────────────

CREATE FUNCTION synchroniser_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.modifie_le = NOW();
  RETURN NEW;
END $$;

-- Application du trigger sur professeurs
CREATE TRIGGER mise_à_jour_professeurs
  BEFORE UPDATE ON professeurs
  FOR EACH ROW EXECUTE FUNCTION synchroniser_modification();

-- Application du trigger sur étudiants
CREATE TRIGGER mise_à_jour_étudiants
  BEFORE UPDATE ON étudiants
  FOR EACH ROW EXECUTE FUNCTION synchroniser_modification();

-- Application du trigger sur classes
CREATE TRIGGER mise_à_jour_classes
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION synchroniser_modification();

-- Application du trigger sur notes
CREATE TRIGGER mise_à_jour_notes
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION synchroniser_modification();

-- ──────────── Index (Les index accélèrent les requêtes fréquentes) ────────────

-- Connexion
CREATE INDEX idx_professeurs_auth_id ON professeurs(auth_id);

-- Filtres étudiants
CREATE INDEX idx_étudiants_professeur_id ON étudiants(professeur_id);
CREATE INDEX idx_étudiants_filière ON étudiants(filière);

-- Filtres notes
CREATE INDEX idx_notes_étudiant_id ON notes(étudiant_id);
CREATE INDEX idx_notes_module_id ON notes(module_id);
CREATE INDEX idx_notes_date_saisie ON notes(date_saisie DESC);

-- Filtres absences
CREATE INDEX idx_absences_étudiant_id ON absences(étudiant_id);
CREATE INDEX idx_absences_classe_id ON absences(classe_id);
CREATE INDEX idx_absences_date_séance ON absences(date_séance DESC);

-- Filtres classes
CREATE INDEX idx_classes_professeur_id ON classes(professeur_id);

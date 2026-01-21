Voici une proposition **prête PostgreSQL** :

1. les **ENUM** (états + types de transition / origine / niveau de preuve),
2. des **tables d’historisation communes** (state history + transitions + événements) réutilisables pour tous les processus.

> Hypothèse : tu utilises `UUID` et tu as déjà `utilisateurs(id)`.

---

## 1) ENUM PostgreSQL

```sql
-- Origine / fiabilité (pour séparer factuel vs encodé)
CREATE TYPE source_type AS ENUM ('iot', 'scada', 'plc', 'manual', 'import', 'api', 'system');
CREATE TYPE evidence_level AS ENUM ('factuel', 'deduit', 'opinion');
CREATE TYPE decision_type AS ENUM ('approved', 'rejected', 'needs_info');

-- Types génériques d'événements / transitions
CREATE TYPE event_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE generic_status AS ENUM ('draft', 'active', 'suspended', 'obsolete', 'archived', 'cancelled');

-- 1) Anomalie (fiche anomalie production)
CREATE TYPE anomaly_state AS ENUM (
  'signalée',
  'triage',
  'attribuée',
  'diagnostic_sur_site',
  'attente_decision_projet',
  'planifiée',
  'intervention_en_cours',
  'attente_validation_solution',
  'validée_reprise_production',
  'clôturée',
  'rejetée',
  'doublon',
  'sécurisation_urgence'
);

-- 2) Demande d’intervention (DI)
CREATE TYPE request_state AS ENUM (
  'brouillon',
  'soumise',
  'qualifiée',
  'acceptée',
  'convertie_en_ot',
  'en_attente_infos',
  'refusée',
  'clôturée'
);

-- 3) OT (ordre de travail)
CREATE TYPE wo_state AS ENUM (
  'créé',
  'validé',
  'planifié',
  'en_attente_pieces',
  'en_attente_permis',
  'en_cours',
  'en_pause',
  'terminé_techniquement',
  'en_attente_reception',
  'clos',
  'annulé'
);

-- 4) Préventif plan (cycle de vie)
CREATE TYPE pm_plan_state AS ENUM ('brouillon', 'actif', 'suspendu', 'obsolète', 'archivé');

-- 5) Préventif instance (occurrence)
CREATE TYPE pm_instance_state AS ENUM (
  'générée',
  'à_faire',
  'planifiée',
  'en_cours',
  'faite',
  'en_retard',
  'annulée',
  'convertie_en_ot'
);

-- 6) Inspection / ronde
CREATE TYPE inspection_state AS ENUM (
  'planifiée',
  'en_cours',
  'terminée',
  'terminée_avec_anomalies',
  'invalidée',
  'archivée'
);

-- 7) Non-conformité (NC)
CREATE TYPE nc_state AS ENUM (
  'ouverte',
  'qualifiée',
  'analyse_cause',
  'plan_action',
  'mise_en_oeuvre',
  'vérification_efficacité',
  'close',
  'rejetée'
);

-- 8) RCA / stop-and-fix
CREATE TYPE rca_state AS ENUM (
  'à_initier',
  'collecte_faits',
  'hypothèses_causes',
  'cause_racine_identifiée',
  'actions_définies',
  'actions_appliquées',
  'efficacité_validée',
  'clôturée'
);

-- 9) Actif
CREATE TYPE asset_state AS ENUM (
  'en_service',
  'en_surveillance',
  'en_panne',
  'en_maintenance',
  'en_validation',
  'hors_service',
  'réformé',
  'en_stock'
);

-- 10) Alerte IoT
CREATE TYPE alert_state AS ENUM (
  'détectée',
  'corrélée',
  'qualifiée',
  'assignée',
  'acquittée',
  'convertie_en_di',
  'convertie_en_ot',
  'résolue',
  'fausse_alarme'
);

-- 11) Stock “santé”
CREATE TYPE stock_health_state AS ENUM ('ok', 'sous_seuil', 'rupture', 'surstock', 'bloqué_quarantaine');

-- 12) Réservation stock / mouvement
CREATE TYPE stock_reservation_state AS ENUM ('demandée', 'réservée', 'prélevée', 'annulée', 'restituée');
CREATE TYPE stock_movement_state AS ENUM ('brouillon', 'validé', 'exécuté', 'annulé');
CREATE TYPE stock_movement_type AS ENUM ('IN', 'OUT', 'TRANSFER', 'ADJUST');

-- 13) Achats
CREATE TYPE purchase_request_state AS ENUM (
  'brouillon',
  'soumise',
  'validée_budget',
  'validée_achat',
  'convertie_en_bc',
  'rejetée',
  'clôturée'
);

-- 14) Bon de commande
CREATE TYPE po_state AS ENUM (
  'créé',
  'envoyé',
  'confirmé_fournisseur',
  'partiellement_reçu',
  'reçu_total',
  'clôturé',
  'annulé'
);

-- 15) Réception / contrôle
CREATE TYPE receipt_state AS ENUM (
  'en_attente',
  'reçu',
  'contrôle_qualité',
  'accepté',
  'accepté_avec_réserve',
  'rejeté',
  'retourné'
);

-- 16) Contrats
CREATE TYPE contract_state AS ENUM ('brouillon', 'actif', 'suspendu', 'expiré', 'résilié', 'archivé');

-- 17) Intervention sous-traitant
CREATE TYPE subcontract_state AS ENUM (
  'demandée',
  'devis_attendu',
  'devis_reçu',
  'approuvée',
  'planifiée',
  'en_cours',
  'rapport_reçu',
  'acceptée',
  'clôturée',
  'litige'
);

-- 18) Métrologie instrument
CREATE TYPE metrology_instrument_state AS ENUM (
  'valide',
  'à_étalonner_bientôt',
  'échu',
  'en_étalonnage',
  'quarantaine',
  'réformé'
);

-- 19) Étalonnage opération
CREATE TYPE calibration_state AS ENUM (
  'planifiée',
  'en_cours',
  'certificat_reçu',
  'conforme',
  'non_conforme',
  'clôturée'
);

-- 20) Permis de travail (HSE)
CREATE TYPE permit_state AS ENUM ('à_rédiger', 'en_revue', 'approuvé', 'actif', 'suspendu', 'clos', 'annulé');

-- 21) Document
CREATE TYPE document_state AS ENUM ('brouillon', 'en_revue', 'approuvé', 'publié', 'obsolète', 'archivé');

-- 22) Notification
CREATE TYPE notification_state AS ENUM ('à_envoyer', 'envoyé', 'livré', 'échoué', 'relancé', 'annulé');
```

---

## 2) Tables communes “d’historisation” (réutilisables)

### 2.1 Table de référence “origine de données”

```sql
CREATE TABLE data_origins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type     source_type NOT NULL,
  source_name     TEXT NOT NULL,          -- ex: "TVAC9_PLC", "MQTT_Broker_Prod", "manuel"
  trust_level     SMALLINT NOT NULL CHECK (trust_level BETWEEN 0 AND 100),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX data_origins_source_type_idx ON data_origins(source_type);
```

### 2.2 Table générique d’événements “preuves” (logs, mesures, documents)

Elle sert à **lier toute transition** à des preuves (log MQTT, événement PLC, doc, mesure…).

```sql
CREATE TABLE evidence_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- à quoi ça se rattache
  object_type     TEXT NOT NULL,   -- 'actif', 'ot', 'demande', 'anomalie', 'alerte', 'instrument', etc.
  object_id       UUID NOT NULL,

  -- contenu
  severity        event_severity NOT NULL DEFAULT 'info',
  evidence_level  evidence_level NOT NULL DEFAULT 'factuel',
  title           TEXT,
  payload_json    JSONB,           -- ex: message MQTT décodé, snapshot PLC, etc.
  document_id     UUID,            -- si preuve documentaire (FK documents.id optionnel)

  -- timestamps
  captured_at     TIMESTAMPTZ NOT NULL,        -- quand ça s’est produit (machine/terrain)
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- provenance
  data_origin_id  UUID NOT NULL REFERENCES data_origins(id),
  recorded_by     UUID REFERENCES utilisateurs(id) -- null si machine

);

CREATE INDEX evidence_events_object_idx ON evidence_events(object_type, object_id);
CREATE INDEX evidence_events_captured_at_idx ON evidence_events(captured_at);
CREATE INDEX evidence_events_origin_idx ON evidence_events(data_origin_id);
CREATE INDEX evidence_events_payload_gin ON evidence_events USING GIN (payload_json);
```

### 2.3 Table générique “state history” (une seule table pour tous les objets)

Principe : tu historises **toutes les transitions**, quel que soit le processus, dans une table unique.

```sql
CREATE TABLE state_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- cible
  object_type      TEXT NOT NULL,     -- 'anomalie', 'demande', 'ot', 'actif', 'alerte', etc.
  object_id        UUID NOT NULL,

  -- état
  state_from       TEXT,              -- ex: 'créé'
  state_to         TEXT NOT NULL,      -- ex: 'planifié'
  reason           TEXT,              -- court motif
  comment          TEXT,              -- commentaire long

  -- qui / comment
  changed_by       UUID REFERENCES utilisateurs(id),
  data_origin_id   UUID NOT NULL REFERENCES data_origins(id),
  evidence_level   evidence_level NOT NULL DEFAULT 'factuel',

  -- timestamps
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_at     TIMESTAMPTZ,        -- si l'état est rétrodaté (fait sur le terrain)
  
  -- liaison vers une ou plusieurs preuves via table de jointure
  correlation_key  TEXT               -- pour regrouper (ex: même incident / même batch)
);

CREATE INDEX state_history_object_idx ON state_history(object_type, object_id, changed_at DESC);
CREATE INDEX state_history_state_to_idx ON state_history(state_to);
CREATE INDEX state_history_origin_idx ON state_history(data_origin_id);
```

### 2.4 Jointure “transition ↔ preuves”

Une transition peut référencer plusieurs preuves (logs, mesures, doc…).

```sql
CREATE TABLE state_history_evidence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_history_id UUID NOT NULL REFERENCES state_history(id) ON DELETE CASCADE,
  evidence_id      UUID NOT NULL REFERENCES evidence_events(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX state_history_evidence_uq
  ON state_history_evidence(state_history_id, evidence_id);
```

---

## 3) “State courant” (optionnel mais très pratique)

L’historique est la source de vérité, mais on garde l’état courant sur chaque objet (performance + simplicité UI).
Exemple générique : table de cache.

```sql
CREATE TABLE current_state (
  object_type   TEXT NOT NULL,
  object_id     UUID NOT NULL,
  state         TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (object_type, object_id)
);

CREATE INDEX current_state_state_idx ON current_state(object_type, state);
```

---

## 4) Variante “fortement typée” (si tu veux des FK stricts)

Si tu préfères une historisation **par table** (plus strict en SQL), tu peux créer des tables dédiées :

* `ot_state_history(state_to wo_state, ...)`
* `asset_state_history(state_to asset_state, ...)`
* etc.

Mais, pour un projet React + API + workflows multiples, la table **unique** `state_history` est souvent plus efficace et flexible.

---

## 5) Contraintes de cohérence recommandées (minimum)

Dans ton code API, impose une matrice de transitions (FSM) par `object_type`.
En base, tu peux ajouter :

* index uniques pour empêcher deux transitions simultanées identiques,
* triggers pour maintenir `current_state`.

Exemple (simple) : mise à jour du cache `current_state` à chaque insertion :

```sql
CREATE OR REPLACE FUNCTION trg_update_current_state()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO current_state(object_type, object_id, state, updated_at)
  VALUES (NEW.object_type, NEW.object_id, NEW.state_to, now())
  ON CONFLICT (object_type, object_id)
  DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER state_history_update_current
AFTER INSERT ON state_history
FOR EACH ROW EXECUTE FUNCTION trg_update_current_state();
```

---

Si tu me dis **si tu veux UUID ou BIGSERIAL**, et si tu as **multi-site / multi-tenant**, je te fournis la **version DDL complète** (avec `CREATE TABLE` pour les objets principaux + FK strictes + index) alignée sur ton schéma A→T.

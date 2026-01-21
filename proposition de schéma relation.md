Voici une proposition de schéma relationnel PostgreSQL (PK/FK) couvrant A → T, pensée pour ton contexte : machines/actifs, OT, stock/achats, contrats, métrologie, + IoT/MQTT et audit.

Je pars sur des conventions simples et robustes :

PK : id UUID (ou BIGSERIAL si tu préfères).

Colonnes communes (quasi partout) : created_at, updated_at, created_by (FK utilisateurs), updated_by (FK utilisateurs), is_active.

Nommage : snake_case.

Données factuelles vs saisies : voir section “Origine des données” à la fin (important pour tes KPI).

A) Référentiels et structure du site
sites

PK id

champs : code, nom, adresse, timezone

(option) FK entreprise_id -> entreprises.id (si multi-tenant)

batiments

PK id

FK site_id -> sites.id

zones

PK id

FK batiment_id -> batiments.id

localisations

PK id

FK site_id -> sites.id

FK parent_id -> localisations.id (arborescence)

(option) FK zone_id -> zones.id

centres_de_cout

PK id

(option) FK site_id -> sites.id

departements

PK id

FK site_id -> sites.id

tags

PK id

champs : code, label

tags_liaisons

PK id

champs : tag_id (FK tags.id), objet_type (ENUM), objet_id (UUID)

index : (objet_type, objet_id), (tag_id)

B) Actifs (équipements / machines)
actifs

PK id

FK site_id -> sites.id

FK localisation_id -> localisations.id

FK type_id -> actifs_types.id

FK modele_id -> actifs_modeles.id

FK fabricant_id -> actifs_fabricants.id

FK statut_id -> actifs_statuts.id

FK criticite_id -> actifs_criticites.id

champs : code_interne, numero_serie, description, date_mise_en_service

actifs_types

PK id

actifs_modeles

PK id

FK fabricant_id -> actifs_fabricants.id

actifs_fabricants

PK id

actifs_statuts

PK id (ex : en_service, en_maintenance, arret, reforme)

actifs_criticites

PK id (A/B/C), champs : impact_securite, impact_prod, impact_qualite

actifs_relations

PK id

FK parent_actif_id -> actifs.id

FK child_actif_id -> actifs.id

champs : relation_type (ENUM: “contient”, “depend_de”, “alimente”, etc.)

actifs_caracteristiques

PK id

FK actif_id -> actifs.id

champs : cle, valeur, unite, valeur_type

actifs_garanties

PK id

FK actif_id -> actifs.id

champs : date_debut, date_fin, conditions

actifs_mise_en_service

PK id

FK actif_id -> actifs.id

champs : date, note

actifs_historique_statut

PK id

FK actif_id -> actifs.id

FK statut_id -> actifs_statuts.id

champs : date_debut, date_fin, cause

actifs_photos

PK id

FK actif_id -> actifs.id

FK document_id -> documents.id (si tu stockes en GED)

actifs_documents_liaisons

PK id

FK actif_id -> actifs.id

FK document_id -> documents.id

C) Documents / Procédures / Checklists
documents

PK id

champs : titre, type_id (FK documents_types.id), uri/path, hash, mime, taille

documents_versions

PK id

FK document_id -> documents.id

champs : version, uri, hash, created_at

documents_types

PK id

documents_liaisons

PK id

FK document_id -> documents.id

champs : objet_type, objet_id

index : (objet_type, objet_id)

procedures

PK id

FK document_id -> documents.id (option)

champs : code, titre

procedures_etapes

PK id

FK procedure_id -> procedures.id

champs : ordre, titre, instruction

checklists_modeles

PK id

champs : code, titre, contexte (OT, inspection, etc.)

checklists_modeles_items

PK id

FK checklist_modele_id -> checklists_modeles.id

champs : ordre, question, type_reponse, obligatoire, valeurs_possibles

D) Utilisateurs / Équipes / Habilitations
utilisateurs

PK id

FK departement_id -> departements.id (option)

champs : email, nom, prenom, actif

equipes

PK id

FK site_id -> sites.id (option)

utilisateurs_equipes

PK id

FK utilisateur_id -> utilisateurs.id

FK equipe_id -> equipes.id

roles

PK id

permissions

PK id

roles_permissions

PK id

FK role_id -> roles.id

FK permission_id -> permissions.id

utilisateurs_roles

PK id

FK utilisateur_id -> utilisateurs.id

FK role_id -> roles.id

competences

PK id

utilisateurs_competences

PK id

FK utilisateur_id -> utilisateurs.id

FK competence_id -> competences.id

champs : niveau

habilitations

PK id

utilisateurs_habilitations

PK id

FK utilisateur_id -> utilisateurs.id

FK habilitation_id -> habilitations.id

champs : date_debut, date_fin, preuve_document_id (FK documents.id)

planning_calendriers

PK id

champs : nom, timezone

planning_astreintes

PK id

FK calendrier_id -> planning_calendriers.id

FK utilisateur_id -> utilisateurs.id

champs : debut, fin

planning_absences

PK id

FK utilisateur_id -> utilisateurs.id

champs : debut, fin, motif

E) Demandes d’intervention (tickets)
demandes_intervention

PK id

FK actif_id -> actifs.id

FK site_id -> sites.id

FK localisation_id -> localisations.id (option)

FK type_id -> demandes_types.id

FK categorie_id -> demandes_categories.id

FK priorite_id -> demandes_priorites.id

FK statut_id -> demandes_statuts.id

FK demandeur_id -> utilisateurs.id

champs : titre, description, date_signalement

demandes_types / categories / priorites / statuts

PK id

demandes_commentaires

PK id

FK demande_id -> demandes_intervention.id

FK auteur_id -> utilisateurs.id

demandes_pieces_jointes

PK id

FK demande_id -> demandes_intervention.id

FK document_id -> documents.id

demandes_affectations

PK id

FK demande_id -> demandes_intervention.id

FK equipe_id -> equipes.id (option)

FK utilisateur_id -> utilisateurs.id (option)

demandes_historique_statut

PK id

FK demande_id -> demandes_intervention.id

FK statut_id -> demandes_statuts.id

champs : date_debut, date_fin, commentaire, changed_by (FK utilisateurs.id)

F) Ordres de travail (OT)
ordres_travail

PK id

FK actif_id -> actifs.id

FK demande_id -> demandes_intervention.id (nullable)

FK type_id -> ot_types.id

FK priorite_id -> ot_priorites.id

FK statut_id -> ot_statuts.id

FK origine_id -> ot_origines.id

champs : titre, description, date_creation, date_planif_debut, date_planif_fin, date_debut_reelle, date_fin_reelle

ot_types / priorites / statuts / origines

PK id

ot_affectations

PK id

FK ot_id -> ordres_travail.id

FK equipe_id -> equipes.id (option)

FK utilisateur_id -> utilisateurs.id (option)

champs : role (responsable, exécutant)

ot_taches

PK id

FK ot_id -> ordres_travail.id

champs : ordre, titre, statut, consignes

ot_sous_taches

PK id

FK tache_id -> ot_taches.id

ot_checklists_instances

PK id

FK ot_id -> ordres_travail.id

FK checklist_modele_id -> checklists_modeles.id

ot_checklists_items_instances

PK id

FK checklist_instance_id -> ot_checklists_instances.id

FK item_modele_id -> checklists_modeles_items.id

champs : reponse, ok, valeur_mesuree, unite, commentaire

ot_commentaires

PK id

FK ot_id -> ordres_travail.id

FK auteur_id -> utilisateurs.id

ot_pieces_jointes

PK id

FK ot_id -> ordres_travail.id

FK document_id -> documents.id

ot_historique_statut

PK id

FK ot_id -> ordres_travail.id

FK statut_id -> ot_statuts.id

champs : date_debut, date_fin, changed_by

ot_journal_evenements

PK id

FK ot_id -> ordres_travail.id

champs : event_type, payload_json, created_at

G) Temps / Main d’œuvre / Coûts / Arrêts
temps_intervention

PK id

FK ot_id -> ordres_travail.id

FK utilisateur_id -> utilisateurs.id

FK type_id -> temps_types.id

champs : debut, fin, duree_minutes (calcul ou stocké), commentaire

temps_types

PK id

couts_main_oeuvre

PK id

champs : profil, taux_horaire, devise, valid_from, valid_to

couts_ot

PK id

FK ot_id -> ordres_travail.id

champs : cout_mo, cout_pieces, cout_presta, cout_total (snapshots)

couts_lignes

PK id

FK ot_id -> ordres_travail.id

champs : type (ENUM), montant, devise, ref_externe

immobilisations

PK id

FK actif_id -> actifs.id

FK ot_id -> ordres_travail.id (option)

champs : debut, fin, raison, impact_prod

H) Pannes / Causes / Actions / RCA (Stop-and-fix)
symptomes

PK id

modes_defaillance

PK id

causes_defaillance

PK id

actions_correctives

PK id

actions_preventives

PK id

ot_panne_cause_action

PK id

FK ot_id -> ordres_travail.id

FK symptome_id -> symptomes.id (nullable)

FK mode_defaillance_id -> modes_defaillance.id (nullable)

FK cause_id -> causes_defaillance.id (nullable)

FK action_corrective_id -> actions_correctives.id (nullable)

FK action_preventive_id -> actions_preventives.id (nullable)

rca_analyses

PK id

FK ot_id -> ordres_travail.id

champs : methode (5why/ishikawa), contenu_json, conclusion, validated_by (FK utilisateurs.id)

retours_experience

PK id

FK actif_id -> actifs.id (option)

FK ot_id -> ordres_travail.id (option)

champs : titre, contenu, tags

I) Maintenance préventive (plans / gammes)
plans_maintenance

PK id

FK type_id -> ot_types.id (souvent “préventif”)

FK statut_id -> plans_statuts.id

FK gamme_id -> gammes.id (option)

champs : code, titre, description

plans_statuts

PK id

plans_scopes

PK id

FK plan_id -> plans_maintenance.id

FK actif_id -> actifs.id (ou filtre par type/zone si tu veux)

(option) champs : actif_type_id, zone_id

declencheurs_plan

PK id

FK plan_id -> plans_maintenance.id

champs : type (calendar/compteur/condition), parametres_json

frequences

PK id (ex : tous_les_30_jours)

gammes

PK id

champs : code, titre, version

gammes_etapes

PK id

FK gamme_id -> gammes.id

champs : ordre, instruction

gammes_outils

PK id

FK gamme_id -> gammes.id

champs : outil, quantite

gammes_pieces

PK id

FK gamme_id -> gammes.id

FK article_id -> articles.id

champs : quantite

preventifs_instances

PK id

FK plan_id -> plans_maintenance.id

FK actif_id -> actifs.id

FK ot_id -> ordres_travail.id (créé automatiquement)

champs : date_due, date_generation

preventifs_instances_statuts

PK id

FK preventif_instance_id -> preventifs_instances.id

champs : statut, date

J) Inspections / Rondes / NC
rondes_modeles

PK id

champs : code, titre

rondes_points

PK id

FK ronde_modele_id -> rondes_modeles.id

FK actif_id -> actifs.id (option)

FK localisation_id -> localisations.id (option)

champs : ordre, question, type_mesure, seuil_min, seuil_max

rondes_instances

PK id

FK ronde_modele_id -> rondes_modeles.id

FK execute_par -> utilisateurs.id

champs : date_debut, date_fin, statut

rondes_mesures

PK id

FK ronde_instance_id -> rondes_instances.id

FK ronde_point_id -> rondes_points.id

champs : valeur, unite, ok, commentaire

rondes_anomalies

PK id

FK ronde_instance_id -> rondes_instances.id

FK demande_id -> demandes_intervention.id (créée si KO)

non_conformites

PK id

FK actif_id -> actifs.id (option)

FK ot_id -> ordres_travail.id (option)

champs : titre, description, gravite, date_detection

non_conformites_statuts

PK id

actions_nc

PK id

FK nc_id -> non_conformites.id

FK ot_id -> ordres_travail.id (option)

champs : action, responsable_id (FK utilisateurs.id), due_date

K) Stock / Pièces
articles

PK id

FK categorie_id -> articles_categories.id

FK unite_id -> unites.id

champs : sku, designation, est_stockable

articles_categories

PK id

unites

PK id

magasins

PK id

FK site_id -> sites.id

emplacements_stock

PK id

FK magasin_id -> magasins.id

FK parent_id -> emplacements_stock.id (rayonnage)

stocks

PK id

FK article_id -> articles.id

FK emplacement_id -> emplacements_stock.id

champs : quantite, quantite_reservee

mouvements_stock

PK id

FK article_id -> articles.id

FK emplacement_id -> emplacements_stock.id

FK ot_id -> ordres_travail.id (option)

champs : type (IN/OUT/TRANSFERT), quantite, date, ref

reservations_stock

PK id

FK ot_id -> ordres_travail.id

FK article_id -> articles.id

champs : quantite, statut

articles_equivalents

PK id

FK article_id -> articles.id

FK equivalent_article_id -> articles.id

lots

PK id

FK article_id -> articles.id

champs : lot_code, date_peremption

numeros_serie

PK id

FK article_id -> articles.id

champs : serial, statut

inventaires

PK id

FK magasin_id -> magasins.id

champs : date, statut

inventaires_lignes

PK id

FK inventaire_id -> inventaires.id

FK article_id -> articles.id

FK emplacement_id -> emplacements_stock.id

champs : quantite_theorique, quantite_comptee

L) Achats / Fournisseurs
fournisseurs

PK id

fournisseurs_contacts

PK id

FK fournisseur_id -> fournisseurs.id

prix_fournisseurs

PK id

FK fournisseur_id -> fournisseurs.id

FK article_id -> articles.id

champs : prix, devise, delai_jours

demandes_achat

PK id

FK demandeur_id -> utilisateurs.id

champs : statut, date

demandes_achat_lignes

PK id

FK demande_achat_id -> demandes_achat.id

FK article_id -> articles.id

champs : quantite, justification, ot_id (FK ordres_travail.id, option)

bons_commande

PK id

FK fournisseur_id -> fournisseurs.id

champs : numero, date, statut

bons_commande_lignes

PK id

FK bon_commande_id -> bons_commande.id

FK article_id -> articles.id

champs : quantite, prix_unitaire

receptions

PK id

FK bon_commande_id -> bons_commande.id

receptions_lignes

PK id

FK reception_id -> receptions.id

FK bon_commande_ligne_id -> bons_commande_lignes.id

champs : quantite_recue

factures (option)

PK id

FK fournisseur_id -> fournisseurs.id

FK bon_commande_id -> bons_commande.id

retours_fournisseur (option)

PK id

FK reception_id -> receptions.id

champs : motif, statut

M) Sous-traitance / Contrats / SLA
prestataires

PK id

champs : nom, type (societe/personne)

contrats

PK id

FK prestataire_id -> prestataires.id

FK site_id -> sites.id (option)

champs : date_debut, date_fin, type, plafond

contrats_sla

PK id

FK contrat_id -> contrats.id

champs : delai_prise_en_charge_h, delai_resolution_h, penalites

interventions_externes

PK id

FK ot_id -> ordres_travail.id

FK prestataire_id -> prestataires.id

FK contrat_id -> contrats.id (option)

champs : statut, date, rapport_document_id (FK documents.id)

devis_prestataire

PK id

FK prestataire_id -> prestataires.id

FK ot_id -> ordres_travail.id

champs : montant, statut

bons_intervention_externe

PK id

FK intervention_externe_id -> interventions_externes.id

N) Métrologie / Étalonnage
instruments_mesure

PK id

FK type_id -> instruments_types.id

FK site_id -> sites.id

champs : code, serial, statut (OK, expiré, quarantaine)

instruments_types

PK id

plans_etalonnage

PK id

FK instrument_id -> instruments_mesure.id

champs : periodicite_jours, tolérance, prochaine_date_due

etalonnages

PK id

FK instrument_id -> instruments_mesure.id

champs : date, resultat (OK/NOK), commentaire

certificats_etalonnage

PK id

FK etalonnage_id -> etalonnages.id

FK document_id -> documents.id

historique_etalonnage

PK id

FK instrument_id -> instruments_mesure.id

champs : event_type, payload_json, date

quarantaine_instruments

PK id

FK instrument_id -> instruments_mesure.id

champs : debut, fin, motif, decision

O) Sécurité / HSE / Permis de travail
risques

PK id

champs : code, description, gravite, probabilite

mesures_prevention

PK id

FK risque_id -> risques.id

champs : description

permis_travail_modeles

PK id

champs : type, contenu_json

permis_travail_instances

PK id

FK ot_id -> ordres_travail.id

FK modele_id -> permis_travail_modeles.id

champs : statut, valide_par (FK utilisateurs.id), date_validation

epi_catalogue

PK id

epi_attributions

PK id

FK epi_id -> epi_catalogue.id

FK utilisateur_id -> utilisateurs.id

champs : date, expiration (option)

evenements_hse

PK id

FK site_id -> sites.id

champs : type, date, description

actions_hse

PK id

FK evenement_id -> evenements_hse.id

FK responsable_id -> utilisateurs.id

champs : action, due_date, statut

P) IoT / MQTT / Compteurs / Alertes

(Tu peux stocker les séries temporelles dans InfluxDB, et ne garder en PostgreSQL que le “catalogue” + événements/alertes.)

capteurs

PK id

FK type_id -> capteurs_types.id

champs : identifiant, topic_mqtt, unite

capteurs_types

PK id

capteurs_liaisons_actifs

PK id

FK capteur_id -> capteurs.id

FK actif_id -> actifs.id

compteurs

PK id

FK actif_id -> actifs.id

champs : type (heures, cycles…), unite

compteurs_valeurs

PK id

FK compteur_id -> compteurs.id

champs : timestamp, valeur

(option) data_origin_id (voir section origine)

seuils_alarme

PK id

FK actif_id -> actifs.id (option)

FK capteur_id -> capteurs.id (option)

champs : seuil_min, seuil_max, niveau

alertes

PK id

FK seuil_id -> seuils_alarme.id (option)

FK actif_id -> actifs.id

champs : timestamp, niveau, message, payload_json

(option) FK demande_id -> demandes_intervention.id (auto-créée)

alertes_ack

PK id

FK alerte_id -> alertes.id

FK utilisateur_id -> utilisateurs.id

champs : timestamp, commentaire

regles_declenchement

PK id

champs : nom, expression, action (créer DI/OT…), enabled

evenements_machine

PK id

FK actif_id -> actifs.id

champs : timestamp, event_type (start/stop/proc…), payload_json

Q) Qualité / Changement / Configuration
demandes_changement

PK id

FK actif_id -> actifs.id

FK demandeur_id -> utilisateurs.id

champs : description, statut

revues_changement

PK id

FK demande_changement_id -> demandes_changement.id

FK reviewer_id -> utilisateurs.id

champs : avis, date

validations

PK id

champs : objet_type, objet_id, valide_par (FK utilisateurs.id), decision, date

configurations_actif

PK id

FK actif_id -> actifs.id

champs : version_fw, parametres_json, date_application

historique_configuration

PK id

FK configuration_id -> configurations_actif.id

champs : event_type, payload_json, date

R) Notifications / Abonnements / Templates
notifications

PK id

champs : objet_type, objet_id, canal_id (FK notifications_canaux.id), payload_json, statut, sent_at

notifications_canaux

PK id (email, teams, webhook)

abonnements

PK id

FK utilisateur_id -> utilisateurs.id

champs : objet_type, filtre_json, canal_id (FK notifications_canaux.id)

templates_messages

PK id

FK canal_id -> notifications_canaux.id

champs : code, subject_tpl, body_tpl

S) Audit / Sécurité applicative
audit_log

PK id

FK utilisateur_id -> utilisateurs.id (nullable si système)

champs : action, objet_type, objet_id, before_json, after_json, timestamp, ip

sessions (option)

PK id

FK utilisateur_id -> utilisateurs.id

champs : token_hash, expires_at

api_tokens (option)

PK id

FK utilisateur_id -> utilisateurs.id

champs : token_hash, scopes, expires_at

consentements (option)

PK id

FK utilisateur_id -> utilisateurs.id

champs : type, date

archives (option)

PK id

champs : objet_type, objet_id, archived_at, reason

T) “Techniques” (paramétrage / multi-tenant / imports)
entreprises (si multi-tenant)

PK id

champs : nom, slug

Puis tu ajoutes entreprise_id dans les tables “racine” (sites, utilisateurs, actifs, etc.)

parametres

PK id

champs : cle, valeur, valeur_type, scope (global/site/équipe)

dictionnaires

PK id

champs : nom, contenu_json (listes paramétrables)

import_jobs

PK id

FK created_by -> utilisateurs.id

champs : source (csv/xlsx), statut, rapport_json, started_at, ended_at

export_jobs

PK id

FK created_by -> utilisateurs.id

champs : type, statut, file_document_id (FK documents.id)

Origine des données “factuelles” vs “encodées”

Pour fiabiliser les KPI, je te recommande une approche standard :

data_origins

PK id

champs : source_type (ENUM: iot, scada, manual, import, api, system), source_name, trust_level (0–100)

Ajout (dans les tables “mesures”, “événements”, “statuts”, “temps”, “résultats checklist”)

data_origin_id (FK data_origins.id)

captured_at (timestamp “fait”)

recorded_at (timestamp “enregistré”)

recorded_by (FK utilisateurs.id, nullable si machine)

confidence (option)

Ça te permet ensuite de calculer des indicateurs “IoT-only”, “manual-only”, ou “mix”.
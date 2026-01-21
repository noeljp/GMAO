Voici les Tables de base:

A) Référentiels et structure du site

sites

batiments

zones

localisations (arborescence, emplacement précis)

centres_de_cout

departements

tags (étiquettes libres)

tags_liaisons (tag ↔ objet)

B) Actifs (équipements / machines)

actifs

actifs_types (familles)

actifs_modeles

actifs_fabricants

actifs_statuts

actifs_criticites

actifs_relations (parent/enfant, dépendances)

actifs_caracteristiques (attributs dynamiques clé/valeur)

actifs_garanties

actifs_mise_en_service

actifs_historique_statut

actifs_photos

actifs_documents_liaisons

C) Documents et gestion documentaire

documents

documents_versions

documents_types (manuel, schéma, procédure…)

documents_liaisons (doc ↔ actif/OT/pièce/inspection…)

procedures (SOP)

procedures_etapes

checklists_modeles

checklists_modeles_items

D) Utilisateurs, équipes, compétences, habilitations

utilisateurs

equipes

utilisateurs_equipes

roles

permissions

roles_permissions

utilisateurs_roles

competences

utilisateurs_competences

habilitations

utilisateurs_habilitations

planning_calendriers

planning_astreintes

planning_absences

E) Demandes d’intervention (tickets)

demandes_intervention

demandes_types

demandes_categories

demandes_priorites

demandes_statuts

demandes_commentaires

demandes_pieces_jointes

demandes_affectations

demandes_historique_statut

F) Ordres de travail (OT / Work Orders)

ordres_travail

ot_types

ot_priorites

ot_statuts

ot_origines (DI, alerte IoT, plan préventif…)

ot_affectations (technicien/équipe)

ot_taches

ot_sous_taches

ot_checklists_instances

ot_checklists_items_instances

ot_commentaires

ot_pieces_jointes

ot_historique_statut

ot_journal_evenements (audit opérationnel)

G) Temps, main d’œuvre, coûts

temps_intervention (temps passé par personne et OT)

temps_types (diagnostic, réparation, test…)

couts_main_oeuvre (taux horaire par profil)

couts_ot (agrégat)

couts_lignes (MO, pièces, prestataire, déplacement…)

immobilisations (temps d’arrêt, impact prod)

H) Pannes, causes, actions (REX / fiabilité)

symptomes

modes_defaillance

causes_defaillance

actions_correctives

actions_preventives

ot_panne_cause_action (liaison OT ↔ symptôme/cause/action)

rca_analyses (5-why, Ishikawa)

retours_experience (notes REX)

I) Maintenance préventive / plans / gammes

plans_maintenance

plans_statuts

plans_scopes (quels actifs)

declencheurs_plan (calendrier, compteur, condition)

frequences

gammes (procédures standard)

gammes_etapes

gammes_outils

gammes_pieces

preventifs_instances (occurrences générées)

preventifs_instances_statuts

J) Inspections, rondes, contrôles

rondes_modeles

rondes_points

rondes_instances

rondes_mesures

rondes_anomalies

non_conformites

non_conformites_statuts

actions_nc (actions liées NC)

K) Stock, pièces, magasin

articles

articles_categories

unites

magasins

emplacements_stock

stocks (quantité par emplacement)

mouvements_stock

reservations_stock (réservé pour OT)

articles_equivalents (substituts)

lots (lot/batch)

numeros_serie (traçabilité)

inventaires

inventaires_lignes

L) Achats / fournisseurs

fournisseurs

fournisseurs_contacts

prix_fournisseurs

demandes_achat

demandes_achat_lignes

bons_commande

bons_commande_lignes

receptions

receptions_lignes

factures (optionnel)

retours_fournisseur (optionnel)

M) Sous-traitance & contrats

prestataires

contrats

contrats_sla

interventions_externes

devis_prestataire

bons_intervention_externe

N) Métrologie / étalonnage

instruments_mesure

instruments_types

plans_etalonnage

etalonnages

certificats_etalonnage

historique_etalonnage

quarantaine_instruments

O) Sécurité / permis de travail / HSE

risques

mesures_prevention

permis_travail_modeles

permis_travail_instances

epi_catalogue

epi_attributions

evenements_hse

actions_hse

P) IoT / compteurs / alertes (si intégré à la GMAO)

capteurs

capteurs_types

capteurs_liaisons_actifs

compteurs

compteurs_valeurs

seuils_alarme

alertes

alertes_ack

regles_declenchement

evenements_machine (évènements horodatés)

Q) Qualité / changements / configuration

demandes_changement (MOC)

revues_changement

validations

configurations_actif (versions firmware, paramètres)

historique_configuration

R) Communication / notifications

notifications

notifications_canaux (mail, Teams, SMS…)

abonnements (qui reçoit quoi)

templates_messages

S) Audit, sécurité applicative, conformité

audit_log (toute action sensible)

sessions (si besoin)

api_tokens (si besoin)

consentements (si applicable)

archives (purge/archivage légal)

T) Tables “techniques” (si tu fais du multi-tenant / paramétrable)

entreprises (si plusieurs entités)

parametres (clé/valeur)

dictionnaires (listes paramétrables)

import_jobs (imports CSV/Excel)

export_jobs
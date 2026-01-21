Voici une liste structurée des machines d’état (workflows) à prévoir dans une GMAO industrielle (machines, OT, stock, contrats, métrologie, HSE, IoT). Pour chaque processus, je te donne : États + Transitions clés (et qui déclenche).

1) Anomalie / Fiche d’anomalie (ton exemple “production → tech → projet → validation → reprise”)

États

signalée

triage (qualif rapide : sécurité / arrêt / contournement)

attribuée

diagnostic_sur_site (état des lieux initial)

attente_decision_projet (validation du mode opératoire)

planifiée (créneau, pièces, permis)

intervention_en_cours

attente_validation_solution (état des lieux final transmis)

validée_reprise_production

clôturée

rejetée / doublon

showstopper : sécurisation_urgence (si risque HSE)

Transitions

production/machine : signalée

maintenance : attribuée → diagnostic_sur_site

projet/production : attente_decision_projet → planifiée ou rejetée

maintenance : intervention_en_cours → attente_validation_solution

projet : validée_reprise_production → clôturée

2) Demande d’intervention (DI / ticket “simple”)

États

brouillon

soumise

qualifiée

acceptée

convertie_en_OT

en_attente_infos

refusée

clôturée

Transitions

demandeur : soumise

maintenance/dispatch : qualifiée → acceptée → convertie_en_OT

3) Ordre de travail (OT / Work Order)

États

créé

validé

planifié

en_attente_pieces

en_attente_permis (HSE/autorisation)

en_cours

en_pause (bloqué : accès, sécurité, pièces…)

terminé_techniquement

en_attente_reception (acceptation client interne/projet)

clos

annulé

Transitions

responsable : créé → validé

planificateur : validé → planifié

technicien : en_cours → terminé_techniquement

demandeur/projet : en_attente_reception → clos

4) Plan de maintenance préventive (Plan)

États

brouillon

actif

suspendu

obsolète (remplacé)

archivé

Transitions

admin maintenance : brouillon → actif

amélioration : actif → obsolète (si nouveau plan)

5) Occurrence de préventif (Instance générée)

États

générée

à_faire

planifiée

en_cours

faite

en_retard

annulée (si actif démonté/obsolète)

convertie_en_OT (si tu sépares instance vs OT)

6) Inspection / Ronde (tournée)

États

planifiée

en_cours

terminée

terminée_avec_anomalies

invalidée (mesures incohérentes)

archivée

Transitions

contrôleur : en_cours → terminée

système : si KO → terminée_avec_anomalies + création DI

7) Non-conformité (NC) / Qualité

États

ouverte

qualifiée

analyse_cause (RCA)

plan_action

mise_en_oeuvre

vérification_efficacité

close

rejetée

8) RCA / Stop-and-fix (Analyse causale)

États

à_initier

collecte_faits

hypothèses_causes

cause_racine_identifiée

actions_définies

actions_appliquées

efficacité_validée

clôturée

(Important : “collecte_faits” doit privilégier données IoT/logs vs opinions.)

9) Actif / Équipement (cycle de vie)

États

en_service

en_surveillance (dégradation détectée)

en_panne

en_maintenance

en_validation (tests/requalification)

hors_service (mis à l’arrêt)

réformé

en_stock (actif de rechange)

Transitions

IoT / prod : en_service → en_surveillance → en_panne

maintenance : en_maintenance → en_validation → en_service

10) Alerte IoT / Alarme (capteurs / règles)

États

détectée

corrélée (regroupement multi-alertes)

qualifiée

assignée

acquittée

convertie_en_DI / convertie_en_OT

résolue

fausse_alarme

11) Stock (niveau global) – état “santé” d’un article

États

ok

sous_seuil

rupture

surstock (option)

bloqué_quarantaine (si qualité)

(Ces états peuvent être calculés, pas forcément “stockés”.)

12) Mouvement / Réservation de stock (workflow opérationnel)
Réservation

demandée

réservée

prélevée

annulée

restituée

Mouvement

brouillon

validé

exécuté

annulé

13) Achat (Demande d’achat)

États

brouillon

soumise

validée_budget

validée_achat

convertie_en_BC

rejetée

clôturée

14) Bon de commande (BC)

États

créé

envoyé

confirmé_fournisseur

partiellement_reçu

reçu_total

clôturé

annulé

15) Réception / Contrôle réception

États

en_attente

reçu

contrôle_qualité

accepté

accepté_avec_réserve

rejeté

retourné

16) Contrat / SLA (cycle de vie)

États

brouillon

actif

suspendu

expiré

résilié

archivé

17) Intervention sous-traitant (liée à OT)

États

demandée

devis_attendu

devis_reçu

approuvée

planifiée

en_cours

rapport_reçu

acceptée

clôturée

litige

18) Métrologie – instrument de mesure

États

valide

à_étalonner_bientôt

échu (étalonnage expiré)

en_étalonnage

quarantaine

réformé

19) Métrologie – opération d’étalonnage

États

planifiée

en_cours

certificat_reçu

conforme

non_conforme

clôturée

20) Permis de travail (HSE)

États

à_rédiger

en_revue

approuvé

actif

suspendu

clos

annulé

21) Gestion documentaire (document / procédure)

États

brouillon

en_revue

approuvé

publié

obsolète

archivé

22) Notification / message

États

à_envoyer

envoyé

livré (option)

échoué

relancé

annulé

Recommandation importante (pour ton besoin “facts vs encodé”)

Pour chaque machine d’état ci-dessus, ajoute un meta-état ou plutôt un marquage de transition :

transition_source = iot | système | humain

evidence_level = factuel | déduit | opinion

evidence_refs = {event_id, log_id, mesure_id, document_id}

Ainsi, tes KPI “MTTR / disponibilité / causes” peuvent filtrer : uniquement transitions factuelles.
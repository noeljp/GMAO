-- Seed data for GMAO database

-- Statuts des actifs
INSERT INTO actifs_statuts (nom, couleur, ordre) VALUES
('En service', '#28a745', 1),
('En maintenance', '#ffc107', 2),
('Hors service', '#dc3545', 3),
('En attente', '#6c757d', 4);

-- Criticités
INSERT INTO actifs_criticites (nom, niveau, couleur) VALUES
('Critique', 3, '#dc3545'),
('Important', 2, '#ffc107'),
('Normal', 1, '#28a745');

-- Types d'actifs
INSERT INTO actifs_types (nom, description) VALUES
('Machines de production', 'Équipements de production'),
('Équipements électriques', 'Installation électrique'),
('HVAC', 'Chauffage, Ventilation, Climatisation'),
('Informatique', 'Équipements informatiques');

-- Fabricants
INSERT INTO actifs_fabricants (nom) VALUES
('Siemens'),
('Schneider Electric'),
('ABB'),
('Rockwell Automation');

-- Admin user (password: Admin123!)
INSERT INTO utilisateurs (email, password_hash, prenom, nom, role) VALUES
('admin@gmao.com', '$2a$10$shblTc4yYQ9JcaAzPEugFeHVvrwAt5nT7xX3KjK56ZjBO/r7qjPQG', 'Admin', 'System', 'admin');

-- Équipe
INSERT INTO equipes (nom, description) VALUES
('Maintenance Générale', 'Équipe de maintenance générale'),
('Électricité', 'Équipe électricité'),
('Mécanique', 'Équipe mécanique');

-- Rôles
INSERT INTO roles (nom, description, niveau) VALUES
('admin', 'Administrateur système', 1),
('manager', 'Responsable maintenance', 2),
('technicien', 'Technicien de maintenance', 3),
('user', 'Utilisateur standard', 4),
('viewer', 'Lecture seule', 5);

-- Permissions par module
INSERT INTO permissions (code, nom, module, action) VALUES
-- Sites
('sites.read', 'Voir les sites', 'sites', 'read'),
('sites.create', 'Créer un site', 'sites', 'create'),
('sites.update', 'Modifier un site', 'sites', 'update'),
('sites.delete', 'Supprimer un site', 'sites', 'delete'),
-- Actifs
('actifs.read', 'Voir les actifs', 'actifs', 'read'),
('actifs.create', 'Créer un actif', 'actifs', 'create'),
('actifs.update', 'Modifier un actif', 'actifs', 'update'),
('actifs.delete', 'Supprimer un actif', 'actifs', 'delete'),
-- Ordres de travail
('ot.read', 'Voir les OT', 'ordres_travail', 'read'),
('ot.create', 'Créer un OT', 'ordres_travail', 'create'),
('ot.update', 'Modifier un OT', 'ordres_travail', 'update'),
('ot.delete', 'Supprimer un OT', 'ordres_travail', 'delete'),
('ot.assign', 'Assigner un OT', 'ordres_travail', 'assign'),
('ot.complete', 'Terminer un OT', 'ordres_travail', 'complete'),
-- Demandes
('demandes.read', 'Voir les demandes', 'demandes', 'read'),
('demandes.create', 'Créer une demande', 'demandes', 'create'),
('demandes.update', 'Modifier une demande', 'demandes', 'update'),
('demandes.delete', 'Supprimer une demande', 'demandes', 'delete'),
('demandes.approve', 'Approuver une demande', 'demandes', 'approve'),
-- Utilisateurs
('users.read', 'Voir les utilisateurs', 'users', 'read'),
('users.create', 'Créer un utilisateur', 'users', 'create'),
('users.update', 'Modifier un utilisateur', 'users', 'update'),
('users.delete', 'Supprimer un utilisateur', 'users', 'delete'),
-- Documents
('documents.read', 'Voir les documents', 'documents', 'read'),
('documents.upload', 'Upload un document', 'documents', 'upload'),
('documents.delete', 'Supprimer un document', 'documents', 'delete'),
-- Rapports
('reports.view', 'Voir les rapports', 'reports', 'read'),
('reports.export', 'Exporter les rapports', 'reports', 'export');

-- Permissions pour Admin (toutes)
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.nom = 'admin';

-- Permissions pour Manager
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.nom = 'manager' 
AND p.code IN (
    'sites.read', 'actifs.read', 'actifs.create', 'actifs.update',
    'ot.read', 'ot.create', 'ot.update', 'ot.assign', 'ot.complete',
    'demandes.read', 'demandes.update', 'demandes.approve',
    'users.read', 'documents.read', 'documents.upload', 'reports.view', 'reports.export'
);

-- Permissions pour Technicien
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.nom = 'technicien' 
AND p.code IN (
    'sites.read', 'actifs.read', 'actifs.update',
    'ot.read', 'ot.update', 'ot.complete',
    'demandes.read', 'demandes.create',
    'documents.read', 'documents.upload'
);

-- Permissions pour User
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.nom = 'user' 
AND p.code IN (
    'sites.read', 'actifs.read',
    'ot.read', 'demandes.read', 'demandes.create',
    'documents.read'
);

-- Permissions pour Viewer
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.nom = 'viewer' 
AND p.code LIKE '%.read';

-- Assigner le rôle admin à l'utilisateur admin
INSERT INTO utilisateurs_roles (utilisateur_id, role_id)
SELECT u.id, r.id FROM utilisateurs u, roles r 
WHERE u.email = 'admin@gmao.com' AND r.nom = 'admin';

-- Workflows transitions pour Demandes
INSERT INTO workflow_transitions (entite, statut_source, statut_destination, roles_autorises) VALUES
('demande', 'brouillon', 'soumise', ARRAY['user', 'technicien', 'manager', 'admin']),
('demande', 'soumise', 'en_attente', ARRAY['manager', 'admin']),
('demande', 'soumise', 'approuvee', ARRAY['manager', 'admin']),
('demande', 'soumise', 'rejetee', ARRAY['manager', 'admin']),
('demande', 'approuvee', 'en_cours', ARRAY['technicien', 'manager', 'admin']),
('demande', 'en_cours', 'terminee', ARRAY['technicien', 'manager', 'admin']),
('demande', 'terminee', 'validee', ARRAY['manager', 'admin']);

-- Workflows transitions pour Ordres de Travail
INSERT INTO workflow_transitions (entite, statut_source, statut_destination, roles_autorises) VALUES
('ot', 'planifie', 'assigne', ARRAY['manager', 'admin']),
('ot', 'assigne', 'en_cours', ARRAY['technicien', 'manager', 'admin']),
('ot', 'en_cours', 'en_attente', ARRAY['technicien', 'manager', 'admin']),
('ot', 'en_attente', 'en_cours', ARRAY['technicien', 'manager', 'admin']),
('ot', 'en_cours', 'termine', ARRAY['technicien', 'manager', 'admin']),
('ot', 'termine', 'valide', ARRAY['manager', 'admin']),
('ot', 'termine', 'rejete', ARRAY['manager', 'admin']),
('ot', 'planifie', 'annule', ARRAY['manager', 'admin']),
('ot', 'assigne', 'annule', ARRAY['manager', 'admin']);


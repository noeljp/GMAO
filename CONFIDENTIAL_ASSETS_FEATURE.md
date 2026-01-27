# Feature: Confidential Assets and Intervention Requests

## Overview

This feature allows users to create confidential assets and intervention requests that are only visible to them. This enables users to manage sensitive information and documents privately within their own session, without other users (technicians, managers, etc.) being able to view them.

## Database Changes

### Migration: 008_confidential_assets.sql

Added `is_confidential` boolean column to the following tables:
- `actifs` (assets)
- `demandes_intervention` (intervention requests)
- `ordres_travail` (work orders)
- `documents`

Each column defaults to `false` and includes indexes for improved query performance.

## Backend API Changes

### Actifs (Assets) Routes

**GET /api/actifs**
- Filters to only show confidential assets to their creator
- Query: `WHERE (is_confidential = false OR created_by = $user_id)`

**GET /api/actifs/:id**
- Access check for confidential assets
- Returns 404 if user is not the creator of a confidential asset

**POST /api/actifs**
- Accepts `is_confidential` field in request body
- Defaults to `false` if not provided

**PATCH /api/actifs/:id**
- Access check for confidential assets
- Allows updating `is_confidential` flag
- Only owner can modify confidential assets

**DELETE /api/actifs/:id**
- Access check for confidential assets
- Only owner can delete confidential assets

**GET /api/actifs/:id/enfants**
- Filters child assets by confidentiality

### Demandes (Intervention Requests) Routes

**GET /api/demandes**
- Filters to only show confidential requests to the requester
- Query: `WHERE (is_confidential = false OR demandeur_id = $user_id)`

**GET /api/demandes/:id**
- Access check for confidential requests
- Returns 404 if user is not the requester of a confidential request

**POST /api/demandes**
- Accepts `is_confidential` field in request body
- Defaults to `false` if not provided

**PATCH /api/demandes/:id**
- Access check for confidential requests
- Allows updating `is_confidential` flag
- Only requester can modify confidential requests

**DELETE /api/demandes/:id**
- Access check for confidential requests
- Only requester can delete confidential requests

### Ordres de Travail (Work Orders) Routes

**GET /api/ordres-travail**
- Filters to only show confidential work orders to their creator
- Query: `WHERE (is_confidential = false OR created_by = $user_id)`

**GET /api/ordres-travail/:id**
- Access check for confidential work orders

**POST /api/ordres-travail**
- Accepts `is_confidential` field in request body
- Defaults to `false` if not provided

### Documents Routes

**POST /api/documents**
- Accepts `is_confidential` field in request body
- Defaults to `false` if not provided

**GET /api/documents**
- Filters to only show confidential documents to uploader
- Query: `WHERE (is_confidential = false OR uploaded_by = $user_id)`

**GET /api/documents/:id/download**
- Access check for confidential documents
- Only uploader can download confidential documents

**DELETE /api/documents/:id**
- Access check for confidential documents
- Only uploader can delete confidential documents

## Frontend Changes

### Actifs Page (frontend/src/pages/Actifs.js)

**New Features:**
- Checkbox labeled "Confidentiel (visible uniquement par moi)" in create/edit dialog
- Visual indicator in table: Yellow "Confidentiel" chip with lock icon for confidential assets
- New "Confidentialité" column in assets table

### Demandes Page (frontend/src/pages/Demandes.js)

**New Features:**
- Checkbox labeled "Confidentiel (visible uniquement par moi)" in create/edit dialog
- Visual indicator in table: Yellow "Confidentiel" chip with lock icon for confidential requests
- New "Confidentialité" column in requests table

### ActifDetail Page (frontend/src/pages/ActifDetail.js)

**New Features:**
- Display confidentiality status with lock icon chip in asset details

### DemandeDetail Page (frontend/src/pages/DemandeDetail.js)

**New Features:**
- Display confidentiality status with lock icon chip alongside status chips

## Usage

### Creating a Confidential Asset

1. Navigate to the Actifs page
2. Click "Nouvel actif"
3. Fill in the asset details
4. Check the "Confidentiel (visible uniquement par moi)" checkbox
5. Click "Créer"

The asset will now only be visible to you in the system.

### Creating a Confidential Intervention Request

1. Navigate to the Demandes page
2. Click "Nouvelle demande"
3. Fill in the request details
4. Check the "Confidentiel (visible uniquement par moi)" checkbox
5. Click "Créer"

The request will now only be visible to you in the system.

## Security Considerations

- All database queries include confidentiality checks at the SQL level
- Access control is enforced in backend routes before any data is returned
- User authentication is required for all endpoints
- The feature respects existing permission system
- Confidential items are filtered out before being sent to the client
- No client-side filtering is used - all filtering happens on the backend

## Testing

To test the feature:

1. Run the database migration:
   ```bash
   cd backend
   npm run migrate
   ```

2. Create a confidential asset or request with User A
3. Log in as User B
4. Verify that User B cannot see the confidential item in the list
5. Verify that User B gets a 404 error when trying to access the item directly
6. Log back in as User A
7. Verify that User A can see, edit, and delete the confidential item

## Migration

Run the migration to add the new columns:

```bash
cd backend
npm run migrate
```

The migration will add the `is_confidential` column to all relevant tables with appropriate indexes.

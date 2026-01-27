# Deployment Guide: Catalogue de Pièces de Remplacement

## Prerequisites
- PostgreSQL database (existing GMAO installation)
- Node.js 18+ and npm installed
- Backend and frontend services configured

## Deployment Steps

### 1. Database Migration

Apply the migration to add the pieces catalog:

```bash
cd backend
npm run migrate
```

This will:
- Add new columns to the `pieces` table
- Create the `pieces_actifs` association table
- Create the `pieces_avec_alertes` view
- Add database indexes for performance

### 2. Backend Deployment

The backend code is already integrated:
- `backend/src/routes/pieces.routes.js` - New routes file
- `backend/src/server.js` - Updated to include pieces routes

Restart the backend service:
```bash
cd backend
npm start
# or with PM2: pm2 restart gmao-backend
# or with Docker: docker-compose restart backend
```

### 3. Frontend Deployment

The frontend code is already integrated:
- `frontend/src/pages/Pieces.js` - New page component
- `frontend/src/App.js` - Updated with `/pieces` route
- `frontend/src/components/Layout.js` - Updated menu with "Pièces de Rechange"

Build and restart the frontend:
```bash
cd frontend
npm run build
# Then serve the build directory or restart your frontend service
# With Docker: docker-compose restart frontend
```

### 4. Verification

1. **Check Database**:
   ```sql
   -- Verify tables exist
   SELECT tablename FROM pg_tables WHERE tablename IN ('pieces', 'pieces_actifs');
   
   -- Verify new columns
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'pieces' 
   AND column_name IN ('reference_interne', 'fournisseur', 'site_internet_fournisseur');
   ```

2. **Check Backend**:
   ```bash
   # Test health endpoint
   curl http://localhost:5000/health
   
   # Test pieces endpoint (requires authentication)
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/pieces
   ```

3. **Check Frontend**:
   - Navigate to the application
   - Log in with valid credentials
   - Click on "Pièces de Rechange" in the menu
   - Verify the page loads with the statistics dashboard

## Initial Data (Optional)

To add sample data for testing:

```sql
INSERT INTO pieces (code, designation, reference_interne, reference_fabricant, 
                    fournisseur, site_internet_fournisseur, prix_indicatif, 
                    unite, quantite_stock, seuil_minimum, remarques)
VALUES 
  ('FLT-001', 'Filtre à huile moteur', 'FLT-INT-001', 'MANN-W950/26', 
   'AutoParts France', 'https://www.autoparts.fr', 12.50, 
   'pièce', 5, 10, 'Compatible avec moteurs diesel'),
  ('BRG-002', 'Roulement à billes SKF', 'BRG-INT-002', 'SKF-6205-2RS', 
   'Bearing Center', 'https://www.bearingcenter.com', 8.90, 
   'pièce', 25, 15, 'Roulement étanche double face');
```

## API Endpoints

New endpoints available:

- `GET /api/pieces` - List all parts (with pagination & filters)
- `GET /api/pieces/:id` - Get part details
- `POST /api/pieces` - Create new part
- `PATCH /api/pieces/:id` - Update part
- `DELETE /api/pieces/:id` - Delete part (soft delete)
- `GET /api/pieces/:id/actifs` - Get assets using this part
- `POST /api/pieces/:id/actifs` - Associate part with asset
- `DELETE /api/pieces/:pieceId/actifs/:actifId` - Remove association
- `GET /api/pieces/actif/:actifId` - Get parts for specific asset

## Permissions

The following permissions are required:
- `actifs.create` - To create new parts
- `actifs.update` - To update parts or manage associations
- `actifs.delete` - To delete parts

## Troubleshooting

### Migration fails
- Check PostgreSQL is running and accessible
- Verify database credentials in `.env` file
- Ensure user has CREATE TABLE permissions

### Backend returns 401 Unauthorized
- Verify user is logged in with valid JWT token
- Check token expiration

### Frontend page not loading
- Clear browser cache
- Check browser console for errors
- Verify backend is running and accessible

### Stock status not calculating
- Check the `pieces_avec_alertes` view exists
- Verify `quantite_stock` and `seuil_minimum` values are set

## Rollback (if needed)

If you need to rollback the changes:

```sql
-- Remove the new tables (WARNING: This will delete all data)
DROP TABLE IF EXISTS pieces_actifs CASCADE;
DROP VIEW IF EXISTS pieces_avec_alertes;

-- Remove new columns from pieces table
ALTER TABLE pieces 
  DROP COLUMN IF EXISTS reference_interne,
  DROP COLUMN IF EXISTS fournisseur,
  DROP COLUMN IF EXISTS site_internet_fournisseur,
  DROP COLUMN IF EXISTS quantite_stock,
  DROP COLUMN IF EXISTS seuil_minimum,
  DROP COLUMN IF EXISTS prix_indicatif,
  DROP COLUMN IF EXISTS remarques;
```

Then revert the backend and frontend code changes.

## Support

For issues or questions:
1. Check `PIECES_CATALOG_SUMMARY.md` for feature documentation
2. Review the code comments in:
   - `backend/src/routes/pieces.routes.js`
   - `frontend/src/pages/Pieces.js`
   - `backend/src/database/migrations/006_pieces_catalog_enhancement.sql`
3. Check application logs for error details

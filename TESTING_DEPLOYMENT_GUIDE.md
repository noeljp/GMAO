# Testing and Deployment Guide

## Database Migration

The new resource allocation system requires running the database migration:

```bash
# Method 1: Using Docker Compose
docker-compose up -d postgres
docker-compose exec backend npm run migrate

# Method 2: Direct migration
cd backend
npm run migrate
```

The migration `005_task_calendar_integration.sql` will:
- Create `resource_types` table for human and material resource types
- Create `resources` table for available resources
- Create `resource_allocations` table to track resource assignments to tasks
- Add new columns to `ordres_travail`: `date_prevue`, `couleur`, `has_conflicts`, `conflict_details`
- Create `check_resource_conflict()` function for conflict detection
- Create `resource_availability` view for easy querying
- Insert default resource types

## API Testing

### Testing Resource Management APIs

1. **Get all resources**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5010/api/resources
```

2. **Create a resource**
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Technicien Jean",
    "code": "TECH001",
    "resource_type_id": "UUID_OF_TECHNICIEN_TYPE",
    "quantite_disponible": 1
  }' \
  http://localhost:5010/api/resources
```

3. **Check resource availability**
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "RESOURCE_UUID",
    "date_debut": "2024-01-15T10:00:00Z",
    "date_fin": "2024-01-15T12:00:00Z",
    "quantite_requise": 1
  }' \
  http://localhost:5010/api/resources/check-availability
```

### Testing Task Management APIs

1. **Create task with resource allocation**
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "titre": "Maintenance préventive",
    "description": "Vérification mensuelle",
    "type": "preventif",
    "priorite": "moyenne",
    "actif_id": "ACTIF_UUID",
    "date_prevue_debut": "2024-01-15T10:00:00Z",
    "date_prevue_fin": "2024-01-15T12:00:00Z",
    "duree_estimee": 120,
    "resources": [
      {
        "resource_id": "RESOURCE_UUID",
        "quantite_requise": 1
      }
    ]
  }' \
  http://localhost:5010/api/ordres-travail
```

2. **Get tasks with filters**
```bash
# Filter by date range
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5010/api/ordres-travail?date_debut_min=2024-01-01&date_fin_max=2024-01-31"

# Filter by type
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5010/api/ordres-travail?type=preventif"

# Filter by priority
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5010/api/ordres-travail?priorite=haute"
```

3. **Get resource allocations for a task**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5010/api/ordres-travail/TASK_UUID/resources
```

4. **Reschedule a task (drag-and-drop)**
```bash
curl -X PATCH -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date_prevue_debut": "2024-01-16T10:00:00Z",
    "date_prevue_fin": "2024-01-16T12:00:00Z"
  }' \
  http://localhost:5010/api/ordres-travail/TASK_UUID/schedule
```

## Frontend Testing

### Manual UI Testing

1. **Access the application**
   - Navigate to http://localhost:3010
   - Login with your credentials

2. **Test Calendar View**
   - Go to "Planification" page
   - Verify calendar displays with week/month/day views
   - Check that existing tasks appear on the calendar
   - Test drag-and-drop to reschedule tasks
   - Click on a task to see details popup

3. **Test Task Creation**
   - Click "Nouvelle Tâche" button
   - Fill in all required fields:
     - Title
     - Type (Correctif/Préventif/Amélioration)
     - Priority
     - Asset
     - Start date/time
     - Estimated duration
   - Select resources from the multi-select dropdown
   - Create the task
   - Verify conflict warnings appear if resources are already allocated

4. **Test Filters**
   - Use type filter to show only preventive tasks
   - Use priority filter to show high-priority tasks
   - Use status filter to show only pending tasks
   - Verify the calendar updates correctly

5. **Test Responsive Design**
   - Resize browser window to mobile size
   - Verify layout adapts properly
   - Check that all controls remain accessible

### Conflict Detection Testing

1. **Create overlapping task allocations**
   - Create Task A: Jan 15, 10:00-12:00, Resource: Technicien 1
   - Create Task B: Jan 15, 11:00-13:00, Resource: Technicien 1
   - Verify Task B shows conflict warning
   - Check `has_conflicts` flag is set

2. **Test drag-and-drop conflict resolution**
   - Drag Task B to a different time slot
   - Verify conflict is resolved
   - Confirm `has_conflicts` flag is cleared

## Running Automated Tests

```bash
cd backend
npm test

# Run specific test file
npm test -- resources.test.js

# Run with coverage
npm test -- --coverage
```

## Deployment Checklist

- [ ] Run database migration in production
- [ ] Verify all API endpoints are accessible
- [ ] Test calendar view loads correctly
- [ ] Test task creation with resources
- [ ] Test conflict detection
- [ ] Verify mobile responsiveness
- [ ] Check performance with large datasets (1000+ tasks)
- [ ] Test with different user roles
- [ ] Verify security: authentication, authorization
- [ ] Test error handling and user feedback

## Known Limitations

1. **Notifications**: The automatic notification system for task reminders and conflicts is not yet implemented. This will be added in a future update.

2. **Advanced Conflict Resolution**: Currently shows conflicts but doesn't provide automatic resolution suggestions.

3. **List View**: The list view toggle is implemented but the actual list view UI is a placeholder.

4. **Resource Capacity Planning**: No visualization for resource capacity over time (will be added).

## Performance Considerations

- The calendar loads tasks for ±1 month from current view for better performance
- Filters are applied at the API level to reduce data transfer
- Resource conflict checking uses database functions for efficiency
- Drag-and-drop operations trigger API calls with optimistic UI updates

## Security Notes

- All endpoints require authentication
- Resource allocation changes are audited
- Conflict detection prevents double-booking
- Input validation on both client and server

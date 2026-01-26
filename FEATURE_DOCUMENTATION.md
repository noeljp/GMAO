# Task Calendar Integration - Feature Documentation

## Overview

This feature implements a comprehensive maintenance task management system with an interactive calendar interface for the GMAO (Gestion de la Maintenance Assistée par Ordinateur) application.

## Key Features

### 1. Interactive Calendar View
- **Multiple Views**: Day, Week, Month, and Agenda views
- **Drag-and-Drop**: Reschedule tasks by dragging them to different time slots
- **Resize Events**: Adjust task duration by resizing events on the calendar
- **Visual Indicators**:
  - Color-coded by priority (Basse, Moyenne, Haute, Urgente)
  - Dashed borders indicate resource conflicts
  - Reduced opacity for cancelled tasks
  - Today's date is highlighted

### 2. Task Creation & Management

#### Creating Tasks
Users can create new maintenance tasks with the following information:
- **Basic Information**:
  - Title (required)
  - Description
  - Type: Correctif, Préventif, or Amélioration (required)
  - Priority: Basse, Moyenne, Haute, or Urgente (required)
  
- **Assignment**:
  - Asset/Equipment (required)
  - Technician (optional)
  
- **Scheduling**:
  - Start date and time (required)
  - Estimated duration in minutes (required)
  - End date is automatically calculated
  
- **Resources**:
  - Select multiple human and material resources
  - System automatically checks for conflicts

#### Task Statuses
- **En attente**: Awaiting assignment/scheduling
- **Planifié**: Scheduled with date and resources
- **En cours**: Currently being worked on
- **Terminé**: Completed
- **Annulé**: Cancelled

### 3. Resource Management

#### Resource Types
The system supports two main resource categories:
- **Human Resources**: Technicians, Engineers
- **Material Resources**: Tools, Vehicles, Safety Equipment

#### Resource Allocation
- Resources can be allocated to tasks during creation or later
- Each allocation specifies:
  - Resource
  - Required quantity
  - Start and end dates (inherited from task)

#### Conflict Detection
The system automatically detects conflicts when:
- A resource is allocated to multiple tasks at the same time
- The total quantity required exceeds available quantity

**Conflict Indicators**:
- Visual warning on the calendar (dashed border)
- Alert in task details
- Warning message during task creation

### 4. Advanced Filtering

Users can filter tasks by:
- **Type**: Show only corrective, preventive, or improvement tasks
- **Priority**: Filter by priority level
- **Status**: View tasks by their current status

Filters are applied in real-time and persist during navigation.

### 5. Statistics Dashboard

The planning page displays key statistics:
- Total number of tasks
- Tasks awaiting action
- Tasks currently in progress
- Number of resource conflicts

### 6. Mobile Responsiveness

The interface adapts to different screen sizes:
- Responsive calendar layout
- Touch-friendly controls
- Simplified views on smaller screens
- Optimized CSS for mobile devices

## Technical Implementation

### Backend Architecture

#### Database Schema
```sql
-- New Tables
- resource_types: Categories of resources
- resources: Available resources with quantities
- resource_allocations: Links resources to tasks with dates

-- Extended Tables
- ordres_travail: Added fields for calendar integration
  - date_prevue: Backward compatibility
  - couleur: Custom color for events
  - has_conflicts: Boolean flag
  - conflict_details: JSON with conflict information
```

#### Key Database Functions
- `check_resource_conflict()`: Detects overlapping resource allocations
- `sync_date_prevue()`: Trigger to keep date fields in sync

#### API Endpoints

**Resource Management**:
- `GET /api/resources` - List all resources
- `GET /api/resources/:id` - Get resource details
- `POST /api/resources` - Create new resource
- `PUT /api/resources/:id` - Update resource
- `POST /api/resources/check-availability` - Check availability
- `GET /api/resources/types/list` - Get resource types

**Task Management** (Enhanced):
- `GET /api/ordres-travail` - List tasks with filters
  - Query params: `date_debut_min`, `date_fin_max`, `type`, `priorite`, `statut`, `resource_id`
- `POST /api/ordres-travail` - Create task with resource allocation
- `GET /api/ordres-travail/:id/resources` - Get task resources
- `POST /api/ordres-travail/:id/resources` - Add resource to task
- `PATCH /api/ordres-travail/:id/schedule` - Reschedule task (drag-and-drop)

### Frontend Architecture

#### Components

**TaskCalendar** (`components/TaskCalendar.js`):
- Uses react-big-calendar library
- Handles drag-and-drop events
- Displays task details in modal
- Shows conflict indicators
- Integrates with notification system

**CreateTaskDialog** (`components/CreateTaskDialog.js`):
- Form for creating new tasks
- Multi-select for resources
- Date/time picker
- Validation and error handling
- Conflict warning display

**PlanificationEnhanced** (`pages/PlanificationEnhanced.js`):
- Main planning page
- Statistics dashboard
- Filter controls
- View mode toggle (calendar/list)
- Integrates TaskCalendar and CreateTaskDialog

**NotificationContext** (`context/NotificationContext.js`):
- Global notification system
- Material-UI Snackbar integration
- Success/Error/Warning/Info types

#### Libraries Used
- `react-big-calendar`: Calendar component
- `date-fns`: Date manipulation
- `@mui/x-date-pickers`: Date/time input
- `@mui/material`: UI components
- `react-query`: Data fetching and caching
- `axios`: HTTP client

## User Workflows

### Workflow 1: Creating a Scheduled Task

1. Navigate to "Planification" page
2. Click "Nouvelle Tâche" button
3. Fill in task details:
   - Enter title and description
   - Select type and priority
   - Choose asset
   - Optionally assign technician
   - Set start date/time
   - Enter estimated duration
   - Select required resources
4. Click "Créer"
5. System checks for conflicts:
   - If conflicts found: Shows warning, task is created with conflict flag
   - If no conflicts: Task is created and appears on calendar
6. Success notification appears

### Workflow 2: Rescheduling a Task (Drag-and-Drop)

1. On the calendar, click and drag a task event
2. Drop it on the new date/time slot
3. System updates task dates
4. Resource allocations are updated automatically
5. System checks for new conflicts
6. Success notification appears
7. Calendar refreshes to show new position

### Workflow 3: Resolving Resource Conflicts

1. View calendar - tasks with conflicts have dashed borders
2. Click on a conflicting task
3. View conflict details in the popup
4. Click "Voir les détails" to go to full task page
5. Options:
   - Reschedule task to avoid conflict (drag-and-drop)
   - Change assigned resources
   - Cancel one of the conflicting tasks
6. Conflict automatically clears when resolved

### Workflow 4: Filtering Tasks

1. Use filter section on planning page
2. Select type (e.g., "Préventif")
3. Select priority (e.g., "Haute")
4. Select status (e.g., "En attente")
5. Calendar updates to show only matching tasks
6. Statistics update to reflect filtered data
7. Click "Effacer les filtres" to reset

## Data Flow

### Creating a Task with Resources
```
User Input (Frontend)
    ↓
CreateTaskDialog validates input
    ↓
POST /api/ordres-travail
    ↓
Backend validates and creates task in transaction:
    1. Insert into ordres_travail
    2. For each resource:
        a. Check for conflicts (SQL function)
        b. Insert into resource_allocations
        c. If conflicts found, set has_conflicts flag
    3. Commit transaction
    ↓
Response with task and conflicts (if any)
    ↓
Frontend shows notification and updates calendar
```

### Drag-and-Drop Rescheduling
```
User drags task event
    ↓
Calendar onEventDrop handler
    ↓
PATCH /api/ordres-travail/:id/schedule
    ↓
Backend updates task dates
    ↓
Backend updates all related resource_allocations
    ↓
Backend checks all allocations for conflicts
    ↓
Response with conflict status
    ↓
Frontend refreshes calendar and shows notification
```

## Configuration

### Environment Variables

Backend (`.env`):
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gmao_db
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
```

Frontend:
```env
REACT_APP_API_URL=http://localhost:5000
```

## Performance Optimizations

1. **Calendar Data Loading**:
   - Loads only ±1 month of data from current view
   - Uses pagination for large datasets
   - React Query caching prevents unnecessary refetches

2. **Conflict Detection**:
   - Database-level function for efficient checking
   - Only checks affected resources on updates
   - Indexed queries for fast lookups

3. **Frontend Rendering**:
   - Memoized event list to prevent re-renders
   - Optimized calendar event styling
   - Debounced filter updates

## Future Enhancements

1. **Automatic Notifications**:
   - Email/SMS reminders for upcoming tasks
   - Alerts when conflicts are created
   - Notifications for status changes

2. **Advanced Conflict Resolution**:
   - Suggest alternative time slots
   - Automatic resource reallocation
   - Priority-based scheduling

3. **Resource Capacity Planning**:
   - Timeline view showing resource utilization
   - Capacity heatmap
   - Overallocation warnings

4. **List View**:
   - Table-based task list
   - Sortable columns
   - Inline editing

5. **Recurring Tasks**:
   - Support for preventive maintenance schedules
   - Automatic task generation
   - Template management

6. **Mobile App**:
   - Native iOS/Android apps
   - Offline support
   - Push notifications

7. **Reports & Analytics**:
   - Resource utilization reports
   - Task completion metrics
   - Efficiency analysis

## Troubleshooting

### Common Issues

**Issue**: Tasks not appearing on calendar
- **Solution**: Check date filters, ensure tasks have `date_prevue` or `date_prevue_debut` set

**Issue**: Drag-and-drop not working
- **Solution**: Ensure authentication token is valid, check browser console for errors

**Issue**: Conflict detection not working
- **Solution**: Run database migration, verify `check_resource_conflict()` function exists

**Issue**: Resources not loading in dropdown
- **Solution**: Check `/api/resources` endpoint, ensure resource_types table is populated

## Support

For issues or questions:
1. Check this documentation
2. Review API logs in backend console
3. Check browser console for frontend errors
4. Refer to `TESTING_DEPLOYMENT_GUIDE.md` for testing procedures

## Changelog

### Version 1.0 (Current)
- Initial implementation of calendar integration
- Resource allocation system
- Conflict detection
- Drag-and-drop rescheduling
- Task creation with resources
- Advanced filtering
- Mobile-responsive design
- Notification system

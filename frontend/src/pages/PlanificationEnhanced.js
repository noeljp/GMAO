import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  ViewModule as ViewModuleIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { startOfMonth, endOfMonth, addMonths } from 'date-fns';
import TaskCalendar from '../components/TaskCalendar';
import CreateTaskDialog from '../components/CreateTaskDialog';

export default function PlanificationEnhanced() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [filters, setFilters] = useState({
    type: '',
    priorite: '',
    statut: '',
  });

  // Fetch orders for calendar
  const { data: response, isLoading, refetch } = useQuery(
    ['ordres-planification-enhanced', currentDate, filters],
    async () => {
      const start = startOfMonth(addMonths(currentDate, -1));
      const end = endOfMonth(addMonths(currentDate, 1));

      const params = {
        date_debut_min: start.toISOString().split('T')[0],
        date_fin_max: end.toISOString().split('T')[0],
        limit: 1000,
      };

      if (filters.type) params.type = filters.type;
      if (filters.priorite) params.priorite = filters.priorite;
      if (filters.statut) params.statut = filters.statut;

      const response = await axios.get('/api/ordres-travail', { params });
      return response.data;
    }
  );

  const ordres = response?.data || [];

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      priorite: '',
      statut: '',
    });
  };

  const hasActiveFilters = filters.type || filters.priorite || filters.statut;

  // Count statistics
  const stats = {
    total: ordres.length,
    enAttente: ordres.filter((o) => o.statut === 'en_attente').length,
    enCours: ordres.filter((o) => o.statut === 'en_cours').length,
    conflicts: ordres.filter((o) => o.has_conflicts).length,
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4">Planification des Tâches</Typography>
        <Stack direction="row" spacing={2}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, value) => value && setViewMode(value)}
            size="small"
          >
            <ToggleButton value="calendar">
              <CalendarIcon sx={{ mr: 1 }} /> Calendrier
            </ToggleButton>
            <ToggleButton value="list">
              <ViewModuleIcon sx={{ mr: 1 }} /> Liste
            </ToggleButton>
          </ToggleButtonGroup>

          <Tooltip title="Actualiser">
            <IconButton onClick={() => refetch()} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Nouvelle Tâche
          </Button>
        </Stack>
      </Box>

      {/* Statistics */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={3}>
          <Box>
            <Typography variant="body2" color="textSecondary">
              Total des tâches
            </Typography>
            <Typography variant="h6">{stats.total}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="textSecondary">
              En attente
            </Typography>
            <Typography variant="h6" color="warning.main">
              {stats.enAttente}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="textSecondary">
              En cours
            </Typography>
            <Typography variant="h6" color="info.main">
              {stats.enCours}
            </Typography>
          </Box>
          {stats.conflicts > 0 && (
            <Box>
              <Typography variant="body2" color="textSecondary">
                Conflits de ressources
              </Typography>
              <Typography variant="h6" color="error.main">
                {stats.conflicts}
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <FilterIcon />
          <Typography variant="h6">Filtres</Typography>
          {hasActiveFilters && (
            <Button size="small" onClick={clearFilters}>
              Effacer les filtres
            </Button>
          )}
        </Box>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filters.type}
              label="Type"
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <MenuItem value="">
                <em>Tous</em>
              </MenuItem>
              <MenuItem value="correctif">Correctif</MenuItem>
              <MenuItem value="preventif">Préventif</MenuItem>
              <MenuItem value="amelioration">Amélioration</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Priorité</InputLabel>
            <Select
              value={filters.priorite}
              label="Priorité"
              onChange={(e) => handleFilterChange('priorite', e.target.value)}
            >
              <MenuItem value="">
                <em>Toutes</em>
              </MenuItem>
              <MenuItem value="basse">Basse</MenuItem>
              <MenuItem value="moyenne">Moyenne</MenuItem>
              <MenuItem value="haute">Haute</MenuItem>
              <MenuItem value="urgente">Urgente</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Statut</InputLabel>
            <Select
              value={filters.statut}
              label="Statut"
              onChange={(e) => handleFilterChange('statut', e.target.value)}
            >
              <MenuItem value="">
                <em>Tous</em>
              </MenuItem>
              <MenuItem value="en_attente">En attente</MenuItem>
              <MenuItem value="planifie">Planifié</MenuItem>
              <MenuItem value="en_cours">En cours</MenuItem>
              <MenuItem value="termine">Terminé</MenuItem>
              <MenuItem value="annule">Annulé</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Main Content */}
      {isLoading ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography>Chargement...</Typography>
        </Paper>
      ) : viewMode === 'calendar' ? (
        <TaskCalendar ordres={ordres} onRefresh={refetch} filters={filters} />
      ) : (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Vue Liste (à implémenter)
          </Typography>
          <Typography color="textSecondary">
            La vue liste sera disponible prochainement.
          </Typography>
        </Paper>
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onTaskCreated={() => {
          refetch();
        }}
      />
    </Box>
  );
}

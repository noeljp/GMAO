import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  Box,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Typography,
  Alert,
  Stack,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

const locales = { fr };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: fr }),
  getDay,
  locales,
});

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgente':
      return '#f44336';
    case 'haute':
      return '#ff9800';
    case 'moyenne':
      return '#2196f3';
    case 'basse':
      return '#4caf50';
    default:
      return '#9e9e9e';
  }
};

const getStatusColor = (statut) => {
  switch (statut) {
    case 'termine':
      return 'success';
    case 'en_cours':
      return 'info';
    case 'en_attente':
      return 'warning';
    case 'annule':
      return 'error';
    default:
      return 'default';
  }
};

export default function TaskCalendar({ ordres, onRefresh, filters }) {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Convert ordres to calendar events
  const events = useMemo(() => {
    return ordres
      .filter((ordre) => {
        // Apply filters
        if (filters?.type && ordre.type !== filters.type) return false;
        if (filters?.priorite && ordre.priorite !== filters.priorite) return false;
        if (filters?.statut && ordre.statut !== filters.statut) return false;
        return true;
      })
      .map((ordre) => {
        const startDate = ordre.date_prevue_debut || ordre.date_prevue;
        const endDate = ordre.date_prevue_fin;
        
        if (!startDate) return null;

        // Calculate end date from duration if not provided
        let calculatedEnd = endDate;
        if (!calculatedEnd && ordre.duree_estimee) {
          calculatedEnd = addMinutes(new Date(startDate), ordre.duree_estimee);
        }

        return {
          id: ordre.id,
          title: ordre.titre,
          start: new Date(startDate),
          end: calculatedEnd ? new Date(calculatedEnd) : new Date(startDate),
          resource: {
            ...ordre,
            color: ordre.couleur || getPriorityColor(ordre.priorite),
          },
        };
      })
      .filter(Boolean);
  }, [ordres, filters]);

  // Handle event selection
  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event);
    setDetailsOpen(true);
  }, []);

  // Handle event drag and drop (reschedule)
  const handleEventDrop = useCallback(
    async ({ event, start, end }) => {
      setIsUpdating(true);
      try {
        await axios.patch(`/api/ordres-travail/${event.id}/schedule`, {
          date_prevue_debut: start.toISOString(),
          date_prevue_fin: end.toISOString(),
        });
        
        showNotification('Tâche reprogrammée avec succès', 'success');
        
        if (onRefresh) {
          await onRefresh();
        }
      } catch (error) {
        console.error('Error rescheduling task:', error);
        showNotification(
          'Erreur lors de la reprogrammation de la tâche: ' + 
          (error.response?.data?.error || error.message),
          'error'
        );
      } finally {
        setIsUpdating(false);
      }
    },
    [onRefresh, showNotification]
  );

  // Handle event resize
  const handleEventResize = useCallback(
    async ({ event, start, end }) => {
      setIsUpdating(true);
      try {
        await axios.patch(`/api/ordres-travail/${event.id}/schedule`, {
          date_prevue_debut: start.toISOString(),
          date_prevue_fin: end.toISOString(),
        });
        
        showNotification('Durée de la tâche modifiée avec succès', 'success');
        
        if (onRefresh) {
          await onRefresh();
        }
      } catch (error) {
        console.error('Error resizing task:', error);
        showNotification(
          'Erreur lors de la modification de la durée: ' + 
          (error.response?.data?.error || error.message),
          'error'
        );
      } finally {
        setIsUpdating(false);
      }
    },
    [onRefresh, showNotification]
  );

  // Custom event style
  const eventStyleGetter = useCallback((event) => {
    const hasConflicts = event.resource.has_conflicts;
    return {
      style: {
        backgroundColor: event.resource.color,
        borderColor: hasConflicts ? '#ff0000' : event.resource.color,
        borderWidth: hasConflicts ? '3px' : '1px',
        borderStyle: hasConflicts ? 'dashed' : 'solid',
        opacity: event.resource.statut === 'annule' ? 0.5 : 1,
      },
    };
  }, []);

  // Custom toolbar messages
  const messages = {
    today: "Aujourd'hui",
    previous: 'Précédent',
    next: 'Suivant',
    month: 'Mois',
    week: 'Semaine',
    day: 'Jour',
    agenda: 'Agenda',
    date: 'Date',
    time: 'Heure',
    event: 'Tâche',
    noEventsInRange: 'Aucune tâche dans cette période',
    showMore: (total) => `+ ${total} tâche(s)`,
  };

  return (
    <Box>
      <Paper sx={{ p: 2, height: 700 }}>
        {isUpdating && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Mise à jour en cours...
          </Alert>
        )}
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          messages={messages}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          resizable
          draggableAccessor={() => true}
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day', 'agenda']}
          defaultView="week"
          culture="fr"
        />
      </Paper>

      {/* Event Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedEvent && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedEvent.resource.has_conflicts && (
                  <WarningIcon color="error" />
                )}
                {selectedEvent.title}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                {selectedEvent.resource.has_conflicts && (
                  <Alert severity="error" icon={<WarningIcon />}>
                    Cette tâche a des conflits de ressources !
                  </Alert>
                )}

                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {selectedEvent.resource.description || 'Aucune description'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={selectedEvent.resource.type}
                    size="small"
                    color="primary"
                  />
                  <Chip
                    label={selectedEvent.resource.priorite}
                    size="small"
                    sx={{
                      bgcolor: getPriorityColor(selectedEvent.resource.priorite),
                      color: 'white',
                    }}
                  />
                  <Chip
                    label={selectedEvent.resource.statut}
                    size="small"
                    color={getStatusColor(selectedEvent.resource.statut)}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Période
                  </Typography>
                  <Typography variant="body1">
                    Du {format(selectedEvent.start, 'PPPp', { locale: fr })}
                    {selectedEvent.end &&
                      ` au ${format(selectedEvent.end, 'PPPp', { locale: fr })}`}
                  </Typography>
                </Box>

                {selectedEvent.resource.duree_estimee && (
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Durée estimée
                    </Typography>
                    <Typography variant="body1">
                      {selectedEvent.resource.duree_estimee} minutes
                    </Typography>
                  </Box>
                )}

                {selectedEvent.resource.actif_nom && (
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Actif
                    </Typography>
                    <Typography variant="body1">
                      {selectedEvent.resource.actif_nom}
                    </Typography>
                  </Box>
                )}

                {selectedEvent.resource.technicien_nom && (
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Technicien
                    </Typography>
                    <Typography variant="body1">
                      {selectedEvent.resource.technicien_nom}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
              <Button
                variant="contained"
                onClick={() => {
                  navigate(`/ordres-travail/${selectedEvent.id}`);
                  setDetailsOpen(false);
                }}
              >
                Voir les détails
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

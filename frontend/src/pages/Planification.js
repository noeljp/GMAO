import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  ViewWeek as WeekIcon,
  ViewDay as DayIcon,
} from '@mui/icons-material';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function Planification() {
  const [view, setView] = useState('week'); // 'day', 'week', 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  const { data: response, isLoading } = useQuery(
    ['ordres-planification', currentDate],
    async () => {
      const start = view === 'week'
        ? startOfWeek(currentDate, { locale: fr })
        : view === 'month'
        ? startOfMonth(currentDate)
        : currentDate;

      const end = view === 'week'
        ? endOfWeek(currentDate, { locale: fr })
        : view === 'month'
        ? endOfMonth(currentDate)
        : currentDate;

      const response = await axios.get('/api/ordres-travail', {
        params: {
          date_debut_min: format(start, 'yyyy-MM-dd'),
          date_fin_max: format(end, 'yyyy-MM-dd'),
          limit: 1000,
        },
      });
      return response.data;
    }
  );

  const ordres = response?.data || [];

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

  const renderDayView = () => {
    const ordresOfDay = ordres.filter(
      (ordre) =>
        ordre.date_prevue &&
        isSameDay(new Date(ordre.date_prevue), currentDate)
    );

    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
        </Typography>
        <Stack spacing={2}>
          {ordresOfDay.length === 0 ? (
            <Typography color="textSecondary" align="center">
              Aucun ordre de travail prévu pour cette date
            </Typography>
          ) : (
            ordresOfDay.map((ordre) => (
              <Card key={ordre.id} sx={{ borderLeft: 3, borderColor: getPriorityColor(ordre.priorite) }}>
                <CardActionArea onClick={() => navigate(`/ordres-travail/${ordre.id}`)}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6">{ordre.titre}</Typography>
                      <Chip label={ordre.statut} size="small" color={getStatusColor(ordre.statut)} />
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                      {ordre.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {ordre.priorite && (
                        <Chip label={ordre.priorite} size="small" />
                      )}
                      {ordre.technicien_nom && (
                        <Chip label={`👤 ${ordre.technicien_nom}`} size="small" variant="outlined" />
                      )}
                      {ordre.actif_nom && (
                        <Chip label={`🔧 ${ordre.actif_nom}`} size="small" variant="outlined" />
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))
          )}
        </Stack>
      </Paper>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { locale: fr });
    const weekEnd = endOfWeek(currentDate, { locale: fr });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <Grid container spacing={1}>
        {days.map((day) => {
          const ordresOfDay = ordres.filter(
            (ordre) =>
              ordre.date_prevue &&
              isSameDay(new Date(ordre.date_prevue), day)
          );

          return (
            <Grid item xs={12 / 7} key={day.toString()}>
              <Paper
                sx={{
                  p: 1,
                  minHeight: 300,
                  bgcolor: isSameDay(day, new Date()) ? 'action.hover' : 'background.paper',
                }}
              >
                <Typography
                  variant="subtitle2"
                  align="center"
                  sx={{
                    mb: 1,
                    fontWeight: isSameDay(day, currentDate) ? 700 : 400,
                  }}
                >
                  {format(day, 'EEE d', { locale: fr })}
                </Typography>
                <Stack spacing={0.5}>
                  {ordresOfDay.map((ordre) => (
                    <Card
                      key={ordre.id}
                      sx={{
                        borderLeft: 2,
                        borderColor: getPriorityColor(ordre.priorite),
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate(`/ordres-travail/${ordre.id}`)}
                    >
                      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {ordre.titre}
                        </Typography>
                        <Typography variant="caption" display="block" color="textSecondary">
                          {ordre.actif_nom}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { locale: fr });
    const endDate = endOfWeek(monthEnd, { locale: fr });
    const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { locale: fr });

    return (
      <Paper sx={{ p: 2 }}>
        <Grid container spacing={0.5}>
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
            <Grid item xs={12 / 7} key={day}>
              <Typography variant="subtitle2" align="center" sx={{ fontWeight: 600 }}>
                {day}
              </Typography>
            </Grid>
          ))}
        </Grid>
        {weeks.map((weekStart, weekIndex) => {
          const weekDays = eachDayOfInterval({
            start: weekStart,
            end: addDays(weekStart, 6),
          });

          return (
            <Grid container spacing={0.5} key={weekIndex} sx={{ mt: 0.5 }}>
              {weekDays.map((day) => {
                const ordresOfDay = ordres.filter(
                  (ordre) =>
                    ordre.date_prevue &&
                    isSameDay(new Date(ordre.date_prevue), day)
                );

                const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                return (
                  <Grid item xs={12 / 7} key={day.toString()}>
                    <Paper
                      sx={{
                        p: 0.5,
                        minHeight: 80,
                        bgcolor: isSameDay(day, new Date())
                          ? 'primary.light'
                          : !isCurrentMonth
                          ? 'action.disabledBackground'
                          : 'background.paper',
                        opacity: isCurrentMonth ? 1 : 0.6,
                        cursor: ordresOfDay.length > 0 ? 'pointer' : 'default',
                      }}
                      onClick={() => ordresOfDay.length > 0 && setCurrentDate(day)}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: isSameDay(day, new Date()) ? 700 : 400,
                        }}
                      >
                        {format(day, 'd')}
                      </Typography>
                      {ordresOfDay.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.5 }}>
                          {ordresOfDay.slice(0, 3).map((ordre) => (
                            <Box
                              key={ordre.id}
                              sx={{
                                width: '100%',
                                height: 4,
                                bgcolor: getPriorityColor(ordre.priorite),
                                borderRadius: 1,
                              }}
                            />
                          ))}
                          {ordresOfDay.length > 3 && (
                            <Typography variant="caption" color="textSecondary">
                              +{ordresOfDay.length - 3}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          );
        })}
      </Paper>
    );
  };

  if (isLoading) return <CircularProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4">Planification</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={(e, value) => value && setView(value)}
            size="small"
          >
            <ToggleButton value="day">
              <DayIcon sx={{ mr: 1 }} /> Jour
            </ToggleButton>
            <ToggleButton value="week">
              <WeekIcon sx={{ mr: 1 }} /> Semaine
            </ToggleButton>
            <ToggleButton value="month">
              <CalendarIcon sx={{ mr: 1 }} /> Mois
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
        <Typography
          sx={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() =>
            setCurrentDate(
              view === 'day'
                ? addDays(currentDate, -1)
                : view === 'week'
                ? addDays(currentDate, -7)
                : addDays(currentDate, -30)
            )
          }
        >
          ◀ Précédent
        </Typography>
        <Typography variant="h6">
          {view === 'day' && format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
          {view === 'week' &&
            `Semaine du ${format(startOfWeek(currentDate, { locale: fr }), 'd MMM', {
              locale: fr,
            })} au ${format(endOfWeek(currentDate, { locale: fr }), 'd MMM yyyy', { locale: fr })}`}
          {view === 'month' && format(currentDate, 'MMMM yyyy', { locale: fr })}
        </Typography>
        <Typography
          sx={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() =>
            setCurrentDate(
              view === 'day'
                ? addDays(currentDate, 1)
                : view === 'week'
                ? addDays(currentDate, 7)
                : addDays(currentDate, 30)
            )
          }
        >
          Suivant ▶
        </Typography>
      </Box>

      {view === 'day' && renderDayView()}
      {view === 'week' && renderWeekView()}
      {view === 'month' && renderMonthView()}
    </Box>
  );
}

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Build as BuildIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DemandeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: response, isLoading } = useQuery(['demande', id], async () => {
    const response = await axios.get(`/api/demandes/${id}`);
    return response.data;
  });

  const { data: historiqueResponse } = useQuery(['demande-historique', id], async () => {
    const response = await axios.get(`/api/demandes/${id}/historique`);
    return response.data;
  });

  const { data: ordresResponse } = useQuery(['demande-ordres', id], async () => {
    const response = await axios.get('/api/ordres-travail', {
      params: { demande_id: id },
    });
    return response.data;
  });

  if (isLoading) return <CircularProgress />;

  const demande = response?.data;
  const historique = historiqueResponse?.data || [];
  const ordres = ordresResponse?.data || [];

  if (!demande) {
    return (
      <Alert severity="error">
        Demande non trouvée
      </Alert>
    );
  }

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'approuvee':
        return 'success';
      case 'en_cours':
        return 'info';
      case 'nouvelle':
        return 'warning';
      case 'rejetee':
        return 'error';
      case 'terminee':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgente':
        return 'error';
      case 'haute':
        return 'warning';
      case 'moyenne':
        return 'info';
      case 'basse':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/demandes')}>
            Retour
          </Button>
          <Typography variant="h4">{demande.titre}</Typography>
        </Box>
        <Button variant="contained" startIcon={<EditIcon />}>
          Modifier
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Informations principales */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              <Chip label={demande.statut} color={getStatutColor(demande.statut)} />
              {demande.priorite && (
                <Chip label={demande.priorite} color={getPriorityColor(demande.priorite)} />
              )}
              {demande.type && <Chip label={demande.type} />}
            </Box>

            <Typography variant="h6" gutterBottom>
              Description
            </Typography>
            <Typography variant="body1" paragraph>
              {demande.description || 'Aucune description'}
            </Typography>

            <Divider sx={{ my: 3 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <PersonIcon color="action" />
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Demandeur
                    </Typography>
                    <Typography variant="body2">{demande.demandeur_nom || 'N/A'}</Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <BuildIcon color="action" />
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Actif concerné
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ cursor: 'pointer', color: 'primary.main' }}
                      onClick={() => demande.actif_id && navigate(`/actifs/${demande.actif_id}`)}
                    >
                      {demande.actif_nom || 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CalendarIcon color="action" />
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Date de création
                    </Typography>
                    <Typography variant="body2">
                      {demande.created_at &&
                        format(new Date(demande.created_at), 'dd MMMM yyyy à HH:mm', {
                          locale: fr,
                        })}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CategoryIcon color="action" />
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Site
                    </Typography>
                    <Typography variant="body2">{demande.site_nom || 'N/A'}</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Ordres de travail associés */}
          {ordres.length > 0 && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Ordres de travail créés ({ordres.length})
              </Typography>
              <List>
                {ordres.map((ordre) => (
                  <ListItem
                    key={ordre.id}
                    button
                    onClick={() => navigate(`/ordres-travail/${ordre.id}`)}
                    sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}
                  >
                    <ListItemText
                      primary={ordre.titre}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          <Chip label={ordre.statut} size="small" />
                          {ordre.technicien_nom && (
                            <Chip label={`👤 ${ordre.technicien_nom}`} size="small" />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Grid>

        {/* Panneau latéral */}
        <Grid item xs={12} md={4}>
          {/* Historique */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Historique
              </Typography>
              {historique.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  Aucun historique disponible
                </Typography>
              ) : (
                <List dense>
                  {historique.map((event, index) => (
                    <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {event.action}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {event.user_nom} •{' '}
                        {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </Typography>
                      {event.details && (
                        <Typography variant="caption" color="textSecondary">
                          {event.details}
                        </Typography>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

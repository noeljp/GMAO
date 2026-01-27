import React from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { Grid, Paper, Typography, Box, CircularProgress } from '@mui/material';
import {
  Inventory as InventoryIcon,
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

const StatCard = ({ title, value, icon, color }) => (
  <Paper
    sx={{
      p: 3,
      display: 'flex',
      flexDirection: 'column',
      height: 140,
    }}
  >
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="h6" color="textSecondary" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ color: color }}>{icon}</Box>
    </Box>
    <Typography variant="h3" component="div" sx={{ flexGrow: 1, mt: 2 }}>
      {value}
    </Typography>
  </Paper>
);

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery('dashboard-stats', async () => {
    const response = await axios.get('/api/dashboard/stats');
    return response.data;
  });

  if (isLoading) return <CircularProgress />;

  const resume = stats?.resume || {};
  const activites = stats?.activite_recente || [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Tableau de bord
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Actifs"
            value={resume?.actifs?.total || 0}
            icon={<InventoryIcon fontSize="large" />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="OT en cours"
            value={resume?.ordres_travail?.par_statut?.find(s => s.statut === 'en_cours')?.count || 0}
            icon={<BuildIcon fontSize="large" />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="OT terminés"
            value={resume?.ordres_travail?.par_statut?.find(s => s.statut === 'termine')?.count || 0}
            icon={<CheckCircleIcon fontSize="large" />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Demandes"
            value={resume?.demandes?.total || 0}
            icon={<WarningIcon fontSize="large" />}
            color="error.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Activité récente
            </Typography>
            {activites.length > 0 ? (
              <Box>
                {activites.map((activite, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 2,
                      pb: 2,
                      borderBottom: index < activites.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="body1" fontWeight="bold">
                      {activite.type === 'ot' ? '🔧 OT' : '📋 Demande'}: {activite.titre}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(activite.created_at).toLocaleString('fr-FR')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography color="textSecondary">
                Aucune activité récente
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Alertes et notifications
            </Typography>
            {/* Alertes basées sur les KPIs */}
            <Box>
              {resume?.ordres_travail?.par_statut?.find(s => s.statut === 'en_attente')?.count > 0 && (
                <Box
                  sx={{
                    mb: 2,
                    p: 2,
                    backgroundColor: 'warning.light',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    ⚠️ {resume.ordres_travail.par_statut.find(s => s.statut === 'en_attente').count} OT en attente
                  </Typography>
                  <Typography variant="caption">
                    Des ordres de travail nécessitent votre attention
                  </Typography>
                </Box>
              )}
              
              {resume?.ordres_travail?.par_statut?.find(s => s.statut === 'en_cours')?.count > 0 && (
                <Box
                  sx={{
                    mb: 2,
                    p: 2,
                    backgroundColor: 'info.light',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    🔧 {resume.ordres_travail.par_statut.find(s => s.statut === 'en_cours').count} OT en cours
                  </Typography>
                  <Typography variant="caption">
                    Travaux actuellement en cours d'exécution
                  </Typography>
                </Box>
              )}
              
              {resume?.demandes?.total > 0 && (
                <Box
                  sx={{
                    mb: 2,
                    p: 2,
                    backgroundColor: 'error.light',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    📋 {resume.demandes.total} Demande{resume.demandes.total > 1 ? 's' : ''} d'intervention
                  </Typography>
                  <Typography variant="caption">
                    Nouvelles demandes à traiter
                  </Typography>
                </Box>
              )}
              
              {resume?.actifs?.total === 0 && (
                <Box
                  sx={{
                    mb: 2,
                    p: 2,
                    backgroundColor: 'grey.200',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    ℹ️ Aucun actif enregistré
                  </Typography>
                  <Typography variant="caption">
                    Commencez par ajouter des actifs au système
                  </Typography>
                </Box>
              )}
              
              {(!resume?.ordres_travail?.total || resume.ordres_travail.total === 0) && 
               (!resume?.demandes?.total || resume.demandes.total === 0) && 
               resume?.actifs?.total > 0 && (
                <Box
                  sx={{
                    mb: 2,
                    p: 2,
                    backgroundColor: 'success.light',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    ✅ Système opérationnel
                  </Typography>
                  <Typography variant="caption">
                    Aucune alerte actuellement
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

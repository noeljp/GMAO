import React from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
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
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Tableau de bord
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Actifs"
            value="0"
            icon={<InventoryIcon fontSize="large" />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="OT en cours"
            value="0"
            icon={<BuildIcon fontSize="large" />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="OT complétés"
            value="0"
            icon={<CheckCircleIcon fontSize="large" />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Demandes"
            value="0"
            icon={<WarningIcon fontSize="large" />}
            color="error.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Activité récente
            </Typography>
            <Typography color="textSecondary">
              Aucune activité récente
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Alertes et notifications
            </Typography>
            <Typography color="textSecondary">
              Aucune alerte
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Rapports() {
  const [periode, setPeriode] = useState('30days');
  const [siteId, setSiteId] = useState('all');

  // Calculer les dates de début et fin selon la période
  const getDateRange = () => {
    const now = new Date();
    switch (periode) {
      case '7days':
        return { start: subDays(now, 7), end: now };
      case '30days':
        return { start: subDays(now, 30), end: now };
      case '90days':
        return { start: subDays(now, 90), end: now };
      case 'currentMonth':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      default:
        return { start: subDays(now, 30), end: now };
    }
  };

  const { start, end } = getDateRange();

  // Charger les sites
  const { data: sitesResponse } = useQuery('sites', async () => {
    const response = await axios.get('/api/sites');
    return response.data;
  });

  const sites = sitesResponse?.data || [];

  // Charger les statistiques globales
  const { data: statsResponse, isLoading: statsLoading } = useQuery(
    ['rapports-stats', siteId, periode],
    async () => {
      const params = {
        date_debut: format(start, 'yyyy-MM-dd'),
        date_fin: format(end, 'yyyy-MM-dd'),
      };
      if (siteId !== 'all') {
        params.site_id = siteId;
      }
      const response = await axios.get('/api/dashboard/stats', { params });
      return response.data;
    }
  );

  // Charger les ordres de travail pour analyse
  const { data: ordresResponse, isLoading: ordresLoading } = useQuery(
    ['rapports-ordres', siteId, periode],
    async () => {
      const params = {
        date_creation_min: format(start, 'yyyy-MM-dd'),
        date_creation_max: format(end, 'yyyy-MM-dd'),
        limit: 1000,
      };
      if (siteId !== 'all') {
        params.site_id = siteId;
      }
      const response = await axios.get('/api/ordres-travail', { params });
      return response.data;
    }
  );

  const ordres = ordresResponse?.data || [];
  const stats = statsResponse?.data || {};

  // Calculs statistiques
  const totalOrdres = ordres.length;
  const ordresTermines = ordres.filter((o) => o.statut === 'termine').length;
  const ordresEnCours = ordres.filter((o) => o.statut === 'en_cours').length;
  const ordresEnAttente = ordres.filter((o) => o.statut === 'en_attente').length;
  const ordresAnnules = ordres.filter((o) => o.statut === 'annule').length;

  const tauxCompletion = totalOrdres > 0 ? ((ordresTermines / totalOrdres) * 100).toFixed(1) : 0;

  // Analyse par priorité
  const parPriorite = {
    urgente: ordres.filter((o) => o.priorite === 'urgente').length,
    haute: ordres.filter((o) => o.priorite === 'haute').length,
    moyenne: ordres.filter((o) => o.priorite === 'moyenne').length,
    basse: ordres.filter((o) => o.priorite === 'basse').length,
  };

  // Analyse par type
  const parType = ordres.reduce((acc, ordre) => {
    const type = ordre.type || 'non défini';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  // Top 5 actifs avec le plus d'ordres
  const actifsCount = ordres.reduce((acc, ordre) => {
    if (ordre.actif_nom) {
      const key = ordre.actif_nom;
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});

  const topActifs = Object.entries(actifsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nom, count]) => ({ nom, count }));

  // Top 5 techniciens par nombre d'ordres
  const techniciensCount = ordres.reduce((acc, ordre) => {
    if (ordre.technicien_nom) {
      const key = ordre.technicien_nom;
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});

  const topTechniciens = Object.entries(techniciensCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nom, count]) => ({ nom, count }));

  if (statsLoading || ordresLoading) return <CircularProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4">
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Rapports et Statistiques
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Site</InputLabel>
            <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} label="Site">
              <MenuItem value="all">Tous les sites</MenuItem>
              {sites.map((site) => (
                <MenuItem key={site.id} value={site.id}>
                  {site.nom}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Période</InputLabel>
            <Select value={periode} onChange={(e) => setPeriode(e.target.value)} label="Période">
              <MenuItem value="7days">7 derniers jours</MenuItem>
              <MenuItem value="30days">30 derniers jours</MenuItem>
              <MenuItem value="90days">90 derniers jours</MenuItem>
              <MenuItem value="currentMonth">Mois en cours</MenuItem>
              <MenuItem value="lastMonth">Mois dernier</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Période du {format(start, 'dd MMMM yyyy', { locale: fr })} au{' '}
        {format(end, 'dd MMMM yyyy', { locale: fr })}
      </Typography>

      {/* Indicateurs clés */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Ordres
              </Typography>
              <Typography variant="h4">{totalOrdres}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Taux de Complétion
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="h4">{tauxCompletion}%</Typography>
                {tauxCompletion >= 70 ? (
                  <TrendingUpIcon color="success" sx={{ ml: 1 }} />
                ) : (
                  <TrendingDownIcon color="error" sx={{ ml: 1 }} />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                En Cours
              </Typography>
              <Typography variant="h4" color="info.main">
                {ordresEnCours}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                En Attente
              </Typography>
              <Typography variant="h4" color="warning.main">
                {ordresEnAttente}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Répartition par statut */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Répartition par Statut
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Statut</TableCell>
                    <TableCell align="right">Nombre</TableCell>
                    <TableCell align="right">%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Chip label="Terminé" size="small" color="success" />
                    </TableCell>
                    <TableCell align="right">{ordresTermines}</TableCell>
                    <TableCell align="right">
                      {totalOrdres > 0 ? ((ordresTermines / totalOrdres) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Chip label="En cours" size="small" color="info" />
                    </TableCell>
                    <TableCell align="right">{ordresEnCours}</TableCell>
                    <TableCell align="right">
                      {totalOrdres > 0 ? ((ordresEnCours / totalOrdres) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Chip label="En attente" size="small" color="warning" />
                    </TableCell>
                    <TableCell align="right">{ordresEnAttente}</TableCell>
                    <TableCell align="right">
                      {totalOrdres > 0 ? ((ordresEnAttente / totalOrdres) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Chip label="Annulé" size="small" color="error" />
                    </TableCell>
                    <TableCell align="right">{ordresAnnules}</TableCell>
                    <TableCell align="right">
                      {totalOrdres > 0 ? ((ordresAnnules / totalOrdres) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Répartition par priorité */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Répartition par Priorité
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Priorité</TableCell>
                    <TableCell align="right">Nombre</TableCell>
                    <TableCell align="right">%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Chip label="Urgente" size="small" color="error" />
                    </TableCell>
                    <TableCell align="right">{parPriorite.urgente}</TableCell>
                    <TableCell align="right">
                      {totalOrdres > 0 ? ((parPriorite.urgente / totalOrdres) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Chip label="Haute" size="small" color="warning" />
                    </TableCell>
                    <TableCell align="right">{parPriorite.haute}</TableCell>
                    <TableCell align="right">
                      {totalOrdres > 0 ? ((parPriorite.haute / totalOrdres) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Chip label="Moyenne" size="small" color="info" />
                    </TableCell>
                    <TableCell align="right">{parPriorite.moyenne}</TableCell>
                    <TableCell align="right">
                      {totalOrdres > 0 ? ((parPriorite.moyenne / totalOrdres) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Chip label="Basse" size="small" color="success" />
                    </TableCell>
                    <TableCell align="right">{parPriorite.basse}</TableCell>
                    <TableCell align="right">
                      {totalOrdres > 0 ? ((parPriorite.basse / totalOrdres) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Top actifs */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Top 5 Actifs (Nombre d'Ordres)
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Actif</TableCell>
                    <TableCell align="right">Ordres</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topActifs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} align="center">
                        <Typography color="textSecondary">Aucune donnée</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    topActifs.map((actif, index) => (
                      <TableRow key={index}>
                        <TableCell>{actif.nom}</TableCell>
                        <TableCell align="right">{actif.count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Top techniciens */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Top 5 Techniciens (Nombre d'Ordres)
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Technicien</TableCell>
                    <TableCell align="right">Ordres</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topTechniciens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} align="center">
                        <Typography color="textSecondary">Aucune donnée</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    topTechniciens.map((tech, index) => (
                      <TableRow key={index}>
                        <TableCell>{tech.nom}</TableCell>
                        <TableCell align="right">{tech.count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Répartition par type */}
        {Object.keys(parType).length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Répartition par Type d'Intervention
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Nombre</TableCell>
                      <TableCell align="right">%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(parType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <TableRow key={type}>
                          <TableCell>{type}</TableCell>
                          <TableCell align="right">{count}</TableCell>
                          <TableCell align="right">
                            {totalOrdres > 0 ? ((count / totalOrdres) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

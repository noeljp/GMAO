import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Button,
  Chip,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Divider,
  IconButton,
  Card,
  CardContent,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Description as DescriptionIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import CompteursActif from '../components/CompteursActif';

export default function ActifDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);

  const { data: actif, isLoading } = useQuery(['actif', id], async () => {
    const response = await axios.get(`/api/actifs/${id}`);
    return response.data;
  });

  const { data: ordresTravail } = useQuery(['actif-ordres', id], async () => {
    const response = await axios.get(`/api/ordres-travail?actif_id=${id}`);
    return response.data;
  });

  const { data: documents } = useQuery(['actif-documents', id], async () => {
    const response = await axios.get(`/api/documents?entity_type=actif&entity_id=${id}`);
    return response.data;
  });

  const { data: historique } = useQuery(['actif-historique', id], async () => {
    const response = await axios.get(`/api/actifs/${id}/historique`);
    return response.data;
  });

  if (isLoading) return <CircularProgress />;
  if (!actif) return <Typography>Actif non trouvé</Typography>;

  const ordres = ordresTravail?.data || [];
  const docs = documents?.data || [];
  const history = historique?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/actifs')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Actif: {actif.code_interne}
        </Typography>
        <Button variant="outlined" startIcon={<EditIcon />}>
          Modifier
        </Button>
      </Box>

      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Informations" />
        <Tab label="Compteurs & Seuils" icon={<SpeedIcon />} iconPosition="start" />
        <Tab label="Historique" icon={<HistoryIcon />} iconPosition="start" />
      </Tabs>

      {activeTab === 0 && (
      <Grid container spacing={3}>
        {/* Informations principales */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Informations principales
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell><strong>Code interne</strong></TableCell>
                  <TableCell>{actif.code_interne}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell>{actif.description}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell>{actif.type_nom}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Site</strong></TableCell>
                  <TableCell>{actif.site_nom}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Statut</strong></TableCell>
                  <TableCell>
                    <Chip label={actif.statut_nom} size="small" color="primary" />
                  </TableCell>
                </TableRow>
                {actif.criticite_nom && (
                  <TableRow>
                    <TableCell><strong>Criticité</strong></TableCell>
                    <TableCell>
                      <Chip label={actif.criticite_nom} size="small" color="error" />
                    </TableCell>
                  </TableRow>
                )}
                {actif.numero_serie && (
                  <TableRow>
                    <TableCell><strong>N° série</strong></TableCell>
                    <TableCell>{actif.numero_serie}</TableCell>
                  </TableRow>
                )}
                {actif.date_mise_en_service && (
                  <TableRow>
                    <TableCell><strong>Mise en service</strong></TableCell>
                    <TableCell>
                      {format(new Date(actif.date_mise_en_service), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        {/* Statistiques */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Statistiques
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Ordres de travail
                    </Typography>
                    <Typography variant="h4">{ordres.length}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Documents
                    </Typography>
                    <Typography variant="h4">{docs.length}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Ordres de travail récents */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Ordres de travail récents
              </Typography>
              <Button size="small" onClick={() => navigate('/ordres-travail?actif_id=' + id)}>
                Voir tout
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {ordres.slice(0, 5).map((ordre) => (
              <Box
                key={ordre.id}
                sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="body1">{ordre.titre}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip label={ordre.statut} size="small" />
                  <Chip label={ordre.priorite} size="small" color="warning" />
                  <Typography variant="caption" color="textSecondary" sx={{ ml: 'auto' }}>
                    {ordre.created_at && format(new Date(ordre.created_at), 'dd/MM/yyyy', { locale: fr })}
                  </Typography>
                </Box>
              </Box>
            ))}
            {ordres.length === 0 && (
              <Typography color="textSecondary">Aucun ordre de travail</Typography>
            )}
          </Paper>
        </Grid>

        {/* Documents */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                <DescriptionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Documents
              </Typography>
              <Button size="small" onClick={() => navigate('/documents')}>
                Voir tout
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {docs.slice(0, 5).map((doc) => (
              <Box
                key={doc.id}
                sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="body1">{doc.titre}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {doc.nom_fichier} • {doc.created_at && format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: fr })}
                </Typography>
              </Box>
            ))}
            {docs.length === 0 && (
              <Typography color="textSecondary">Aucun document</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
      )}

      {/* Onglet Compteurs */}
      {activeTab === 1 && (
        <CompteursActif actifId={id} />
      )}

      {/* Onglet Historique */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Historique des modifications
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {history.length > 0 ? (
                <Table size="small">
                  <TableBody>
                    {history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {entry.created_at && format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </TableCell>
                        <TableCell>{entry.user_nom}</TableCell>
                        <TableCell>{entry.action}</TableCell>
                        <TableCell>{entry.details}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography color="textSecondary">Aucun historique disponible</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

      </Grid>
    </Box>
  );
}

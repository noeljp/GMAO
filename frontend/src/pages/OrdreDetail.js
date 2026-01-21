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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  PlayArrow as PlayArrowIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function OrdreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [transitionDialog, setTransitionDialog] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState(null);
  const [commentaire, setCommentaire] = useState('');
  const [error, setError] = useState('');

  const { data: ordre, isLoading } = useQuery(['ordre', id], async () => {
    const response = await axios.get(`/api/ordres-travail/${id}`);
    return response.data;
  });

  const { data: transitions } = useQuery(['ordre-transitions', id], async () => {
    const response = await axios.get(`/api/ordres-travail/${id}/transitions`);
    return response.data;
  });

  const { data: documents } = useQuery(['ordre-documents', id], async () => {
    const response = await axios.get(`/api/documents?entity_type=ordre_travail&entity_id=${id}`);
    return response.data;
  });

  const { data: historique } = useQuery(['ordre-historique', id], async () => {
    const response = await axios.get(`/api/ordres-travail/${id}/historique`);
    return response.data;
  });

  const transitionMutation = useMutation(
    (data) => axios.post(`/api/ordres-travail/${id}/transition`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ordre', id]);
        queryClient.invalidateQueries(['ordre-transitions', id]);
        queryClient.invalidateQueries(['ordre-historique', id]);
        handleCloseTransition();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la transition');
      },
    }
  );

  const handleOpenTransition = (transition) => {
    setSelectedTransition(transition);
    setCommentaire('');
    setError('');
    setTransitionDialog(true);
  };

  const handleCloseTransition = () => {
    setTransitionDialog(false);
    setSelectedTransition(null);
    setCommentaire('');
    setError('');
  };

  const handleTransition = () => {
    if (selectedTransition) {
      transitionMutation.mutate({
        transition: selectedTransition.nom,
        commentaire,
      });
    }
  };

  if (isLoading) return <CircularProgress />;
  if (!ordre) return <Typography>Ordre de travail non trouvé</Typography>;

  const availableTransitions = transitions?.data || [];
  const docs = documents?.data || [];
  const history = historique?.data || [];

  const getStatutColor = (statut) => {
    const colors = {
      'planifie': 'info',
      'en_cours': 'warning',
      'termine': 'success',
      'annule': 'error',
    };
    return colors[statut] || 'default';
  };

  const getPrioriteColor = (priorite) => {
    const colors = {
      'basse': 'default',
      'moyenne': 'info',
      'haute': 'warning',
      'urgente': 'error',
    };
    return colors[priorite] || 'default';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/ordres-travail')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {ordre.titre}
        </Typography>
        <Button variant="outlined" startIcon={<EditIcon />} sx={{ mr: 1 }}>
          Modifier
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Informations principales */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Détails de l'ordre de travail
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell><strong>Titre</strong></TableCell>
                  <TableCell>{ordre.titre}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell>{ordre.description}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Actif</strong></TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => navigate(`/actifs/${ordre.actif_id}`)}
                    >
                      {ordre.actif_code}
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell>{ordre.type}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Priorité</strong></TableCell>
                  <TableCell>
                    <Chip label={ordre.priorite} size="small" color={getPrioriteColor(ordre.priorite)} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Statut</strong></TableCell>
                  <TableCell>
                    <Chip label={ordre.statut} size="small" color={getStatutColor(ordre.statut)} />
                  </TableCell>
                </TableRow>
                {ordre.technicien_nom && (
                  <TableRow>
                    <TableCell><strong>Technicien</strong></TableCell>
                    <TableCell>{ordre.technicien_nom}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell><strong>Créé le</strong></TableCell>
                  <TableCell>
                    {ordre.created_at && format(new Date(ordre.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </TableCell>
                </TableRow>
                {ordre.date_prevue && (
                  <TableRow>
                    <TableCell><strong>Date prévue</strong></TableCell>
                    <TableCell>
                      {format(new Date(ordre.date_prevue), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          {/* Documents */}
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Documents joints
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {docs.length > 0 ? (
              docs.map((doc) => (
                <Box key={doc.id} sx={{ mb: 2 }}>
                  <Typography variant="body1">{doc.titre}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {doc.nom_fichier}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography color="textSecondary">Aucun document</Typography>
            )}
          </Paper>
        </Grid>

        {/* Actions et transitions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Actions disponibles
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {availableTransitions.length > 0 ? (
              availableTransitions.map((transition) => (
                <Button
                  key={transition.nom}
                  fullWidth
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => handleOpenTransition(transition)}
                  sx={{ mb: 1 }}
                >
                  {transition.libelle || transition.nom}
                </Button>
              ))
            ) : (
              <Typography color="textSecondary">Aucune action disponible</Typography>
            )}
          </Paper>

          {/* Historique */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Historique
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {history.length > 0 ? (
              history.slice(0, 10).map((entry) => (
                <Box key={entry.id} sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2">{entry.action}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {entry.user_nom} • {entry.created_at && format(new Date(entry.created_at), 'dd/MM HH:mm', { locale: fr })}
                  </Typography>
                  {entry.commentaire && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      {entry.commentaire}
                    </Typography>
                  )}
                </Box>
              ))
            ) : (
              <Typography color="textSecondary">Aucun historique</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Dialog de transition */}
      <Dialog open={transitionDialog} onClose={handleCloseTransition} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedTransition?.libelle || 'Confirmer la transition'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Commentaire (optionnel)"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            multiline
            rows={4}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTransition}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleTransition}
            disabled={transitionMutation.isLoading}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

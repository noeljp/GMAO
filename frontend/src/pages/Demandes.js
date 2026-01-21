import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Demandes() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editDemande, setEditDemande] = useState(null);
  const [formData, setFormData] = useState({
    titre: '',
    description: '',
    actif_id: '',
    type: 'panne',
    priorite: 'moyenne',
  });
  const [error, setError] = useState('');

  const { data: response, isLoading } = useQuery('demandes', async () => {
    const response = await axios.get('/api/demandes');
    return response.data;
  });

  const { data: actifsResponse } = useQuery('actifs', async () => {
    const response = await axios.get('/api/actifs');
    return response.data;
  });

  const createMutation = useMutation(
    (data) => axios.post('/api/demandes', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('demandes');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la création');
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/demandes/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('demandes');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/demandes/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('demandes');
      },
    }
  );

  const handleOpen = (demande = null) => {
    if (demande) {
      setEditDemande(demande);
      setFormData({
        titre: demande.titre || '',
        description: demande.description || '',
        actif_id: demande.actif_id || '',
        type: demande.type || 'panne',
        priorite: demande.priorite || 'moyenne',
      });
    } else {
      setEditDemande(null);
      setFormData({
        titre: '',
        description: '',
        actif_id: '',
        type: 'panne',
        priorite: 'moyenne',
      });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditDemande(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editDemande) {
      updateMutation.mutate({ id: editDemande.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette demande ?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <CircularProgress />;

  const demandes = response?.data || [];
  const actifs = actifsResponse?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Demandes d'intervention</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Nouvelle demande
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Titre</TableCell>
              <TableCell>Actif</TableCell>
              <TableCell>Demandeur</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Priorité</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Créée le</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {demandes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Aucune demande disponible. Cliquez sur "Nouvelle demande" pour commencer.
                </TableCell>
              </TableRow>
            ) : (
              demandes.map((demande) => (
                <TableRow
                  key={demande.id}
                  onClick={() => navigate(`/demandes/${demande.id}`)}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <TableCell>{demande.titre}</TableCell>
                  <TableCell>{demande.actif_code}</TableCell>
                  <TableCell>{demande.demandeur_nom}</TableCell>
                  <TableCell>{demande.type}</TableCell>
                  <TableCell>{demande.priorite}</TableCell>
                  <TableCell>
                    <Chip label={demande.statut} size="small" color="warning" />
                  </TableCell>
                  <TableCell>
                    {demande.created_at && format(new Date(demande.created_at), 'dd/MM/yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleOpen(demande); }}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleDelete(demande.id); }}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editDemande ? 'Modifier la demande' : 'Nouvelle demande'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Titre"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              select
              label="Actif"
              value={formData.actif_id}
              onChange={(e) => setFormData({ ...formData, actif_id: e.target.value })}
              SelectProps={{ native: true }}
              required
              margin="normal"
            >
              <option value="">Sélectionner un actif</option>
              {actifs.map((actif) => (
                <option key={actif.id} value={actif.id}>
                  {actif.code_interne} - {actif.description}
                </option>
              ))}
            </TextField>
            <TextField
              fullWidth
              select
              label="Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              SelectProps={{ native: true }}
              margin="normal"
            >
              <option value="panne">Panne</option>
              <option value="maintenance">Maintenance</option>
              <option value="information">Information</option>
            </TextField>
            <TextField
              fullWidth
              select
              label="Priorité"
              value={formData.priorite}
              onChange={(e) => setFormData({ ...formData, priorite: e.target.value })}
              SelectProps={{ native: true }}
              margin="normal"
            >
              <option value="basse">Basse</option>
              <option value="moyenne">Moyenne</option>
              <option value="haute">Haute</option>
              <option value="urgente">Urgente</option>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Annuler</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isLoading || updateMutation.isLoading}
            >
              {editDemande ? 'Modifier' : 'Créer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

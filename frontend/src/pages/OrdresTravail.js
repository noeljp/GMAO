import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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

const getStatutColor = (statut) => {
  const colors = {
    'planifie': 'info',
    'en_cours': 'warning',
    'termine': 'success',
    'annule': 'error',
  };
  return colors[statut] || 'default';
};

export default function OrdresTravail() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editOrdre, setEditOrdre] = useState(null);
  const [formData, setFormData] = useState({
    titre: '',
    description: '',
    actif_id: '',
    type: 'correctif',
    priorite: 'moyenne',
    technicien_assigne_id: '',
    date_prevue: '',
  });
  const [error, setError] = useState('');

  const { data: response, isLoading } = useQuery('ordres-travail', async () => {
    const response = await axios.get('/api/ordres-travail');
    return response.data;
  });

  const { data: actifsResponse } = useQuery('actifs', async () => {
    const response = await axios.get('/api/actifs');
    return response.data;
  });

  const { data: usersResponse } = useQuery('users', async () => {
    const response = await axios.get('/api/users');
    return response.data;
  });

  const createMutation = useMutation(
    (data) => axios.post('/api/ordres-travail', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('ordres-travail');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la création');
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/ordres-travail/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('ordres-travail');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/ordres-travail/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('ordres-travail');
      },
    }
  );

  const handleOpen = (ordre = null) => {
    if (ordre) {
      setEditOrdre(ordre);
      setFormData({
        titre: ordre.titre || '',
        description: ordre.description || '',
        actif_id: ordre.actif_id || '',
        type: ordre.type || 'correctif',
        priorite: ordre.priorite || 'moyenne',
        technicien_assigne_id: ordre.technicien_assigne_id || '',
        date_prevue: ordre.date_prevue ? ordre.date_prevue.split('T')[0] : '',
      });
    } else {
      setEditOrdre(null);
      setFormData({
        titre: '',
        description: '',
        actif_id: '',
        type: 'correctif',
        priorite: 'moyenne',
        technicien_assigne_id: '',
        date_prevue: '',
      });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditOrdre(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editOrdre) {
      updateMutation.mutate({ id: editOrdre.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet ordre de travail ?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <CircularProgress />;

  const ordres = response?.data || [];
  const actifs = actifsResponse?.data || [];
  const users = usersResponse?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Ordres de travail</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Nouvel OT
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Titre</TableCell>
              <TableCell>Actif</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Priorité</TableCell>
              <TableCell>Technicien</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Créé le</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ordres.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Aucun ordre de travail disponible. Cliquez sur "Nouvel OT" pour commencer.
                </TableCell>
              </TableRow>
            ) : (
              ordres.map((ordre) => (
                <TableRow
                  key={ordre.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/ordres-travail/${ordre.id}`)}
                >
                  <TableCell>{ordre.titre}</TableCell>
                  <TableCell>{ordre.actif_code}</TableCell>
                  <TableCell>{ordre.type}</TableCell>
                  <TableCell>{ordre.priorite}</TableCell>
                  <TableCell>{ordre.technicien_nom}</TableCell>
                  <TableCell>
                    <Chip
                      label={ordre.statut}
                      size="small"
                      color={getStatutColor(ordre.statut)}
                    />
                  </TableCell>
                  <TableCell>
                    {ordre.created_at && format(new Date(ordre.created_at), 'dd/MM/yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(ordre);
                      }}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ordre.id);
                      }}
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
            {editOrdre ? 'Modifier l\'ordre de travail' : 'Nouvel ordre de travail'}
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
              <option value="correctif">Correctif</option>
              <option value="preventif">Préventif</option>
              <option value="amelioration">Amélioration</option>
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
            <TextField
              fullWidth
              select
              label="Technicien assigné"
              value={formData.technicien_assigne_id}
              onChange={(e) => setFormData({ ...formData, technicien_assigne_id: e.target.value })}
              SelectProps={{ native: true }}
              margin="normal"
            >
              <option value="">Aucun</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.prenom} {user.nom}
                </option>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Date prévue"
              type="date"
              value={formData.date_prevue}
              onChange={(e) => setFormData({ ...formData, date_prevue: e.target.value })}
              InputLabelProps={{ shrink: true }}
              margin="normal"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Annuler</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isLoading || updateMutation.isLoading}
            >
              {editOrdre ? 'Modifier' : 'Créer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

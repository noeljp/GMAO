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

export default function Actifs() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editActif, setEditActif] = useState(null);
  const [formData, setFormData] = useState({
    code_interne: '',
    description: '',
    type_id: '',
    site_id: '',
    localisation: '',
    numero_serie: '',
  });
  const [error, setError] = useState('');

  const { data: response, isLoading } = useQuery('actifs', async () => {
    const response = await axios.get('/api/actifs');
    return response.data;
  });

  const { data: sitesResponse } = useQuery('sites', async () => {
    const response = await axios.get('/api/sites');
    return response.data;
  });

  const { data: typesResponse } = useQuery('actifs-types', async () => {
    const response = await axios.get('/api/actifs/types');
    return response.data;
  });

  const createMutation = useMutation(
    (data) => axios.post('/api/actifs', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actifs');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la création');
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/actifs/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actifs');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/actifs/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actifs');
      },
    }
  );

  const handleOpen = (actif = null) => {
    if (actif) {
      setEditActif(actif);
      setFormData({
        code_interne: actif.code_interne || '',
        description: actif.description || '',
        type_id: actif.type_id || '',
        site_id: actif.site_id || '',
        localisation: actif.localisation || '',
        numero_serie: actif.numero_serie || '',
      });
    } else {
      setEditActif(null);
      setFormData({
        code_interne: '',
        description: '',
        type_id: '',
        site_id: '',
        localisation: '',
        numero_serie: '',
      });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditActif(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editActif) {
      updateMutation.mutate({ id: editActif.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet actif ?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <CircularProgress />;

  const actifs = response?.data || [];
  const sites = sitesResponse?.data || [];
  const types = typesResponse?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Actifs</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Nouvel actif
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Site</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {actifs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Aucun actif disponible. Cliquez sur "Nouvel actif" pour commencer.
                </TableCell>
              </TableRow>
            ) : (
              actifs.map((actif) => (
                <TableRow
                  key={actif.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/actifs/${actif.id}`)}
                >
                  <TableCell>{actif.code_interne}</TableCell>
                  <TableCell>{actif.description}</TableCell>
                  <TableCell>{actif.type_nom}</TableCell>
                  <TableCell>{actif.site_nom}</TableCell>
                  <TableCell>
                    <Chip label={actif.statut_nom} size="small" color="primary" />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(actif);
                      }}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(actif.id);
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
            {editActif ? 'Modifier l\'actif' : 'Nouvel actif'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Code interne"
              value={formData.code_interne}
              onChange={(e) => setFormData({ ...formData, code_interne: e.target.value })}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              multiline
              rows={3}
              margin="normal"
            />
            <TextField
              fullWidth
              select
              label="Type d'actif"
              value={formData.type_id}
              onChange={(e) => setFormData({ ...formData, type_id: e.target.value })}
              SelectProps={{ native: true }}
              required
              margin="normal"
            >
              <option value="">Sélectionner un type</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.nom}
                </option>
              ))}
            </TextField>
            <TextField
              fullWidth
              select
              label="Site"
              value={formData.site_id}
              onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
              SelectProps={{ native: true }}
              required
              margin="normal"
            >
              <option value="">Sélectionner un site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.nom}
                </option>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Localisation"
              value={formData.localisation}
              onChange={(e) => setFormData({ ...formData, localisation: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Numéro de série"
              value={formData.numero_serie}
              onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })}
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
              {editActif ? 'Modifier' : 'Créer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

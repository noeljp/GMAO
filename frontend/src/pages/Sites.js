import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
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

export default function Sites() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editSite, setEditSite] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    nom: '',
    adresse: '',
    ville: '',
    code_postal: '',
    pays: '',
  });
  const [error, setError] = useState('');

  const { data: response, isLoading } = useQuery('sites', async () => {
    const response = await axios.get('/api/sites');
    return response.data;
  });

  const createMutation = useMutation(
    (data) => axios.post('/api/sites', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sites');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la création');
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/sites/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sites');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/sites/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sites');
      },
    }
  );

  const handleOpen = (site = null) => {
    if (site) {
      setEditSite(site);
      setFormData({
        code: site.code || '',
        nom: site.nom || '',
        adresse: site.adresse || '',
        ville: site.ville || '',
        code_postal: site.code_postal || '',
        pays: site.pays || '',
      });
    } else {
      setEditSite(null);
      setFormData({
        code: '',
        nom: '',
        adresse: '',
        ville: '',
        code_postal: '',
        pays: 'France',
      });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditSite(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editSite) {
      updateMutation.mutate({ id: editSite.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce site ?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <CircularProgress />;

  const sites = response?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Sites</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Nouveau site
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Nom</TableCell>
              <TableCell>Adresse</TableCell>
              <TableCell>Ville</TableCell>
              <TableCell>Pays</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sites.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Aucun site trouvé. Cliquez sur "Nouveau site" pour commencer.
                </TableCell>
              </TableRow>
            ) : (
              sites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell>{site.code}</TableCell>
                  <TableCell>{site.nom}</TableCell>
                  <TableCell>{site.adresse}</TableCell>
                  <TableCell>{site.ville}</TableCell>
                  <TableCell>{site.pays}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpen(site)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(site.id)}
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
            {editSite ? 'Modifier le site' : 'Nouveau site'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Nom"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Adresse"
              value={formData.adresse}
              onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Ville"
              value={formData.ville}
              onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Code postal"
              value={formData.code_postal}
              onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Pays"
              value={formData.pays}
              onChange={(e) => setFormData({ ...formData, pays: e.target.value })}
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
              {editSite ? 'Modifier' : 'Créer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
              <TableRow>
                <TableCell colSpan={4} align="center">
                  Aucun site disponible
                </TableCell>
              </TableRow>
            ) : (
              sites?.map((site) => (
                <TableRow key={site.id}>
                  <TableCell>{site.code}</TableCell>
                  <TableCell>{site.nom}</TableCell>
                  <TableCell>{site.adresse}</TableCell>
                  <TableCell>{site.timezone}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

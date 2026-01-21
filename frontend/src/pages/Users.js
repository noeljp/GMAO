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
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

export default function Users() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    prenom: '',
    nom: '',
    role: 'user',
  });
  const [error, setError] = useState('');

  const { data: response, isLoading } = useQuery('users', async () => {
    const res = await axios.get('/api/users');
    return res.data;
  });

  const createMutation = useMutation(
    (data) => axios.post('/api/users', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la création');
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/users/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/users/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
      },
    }
  );

  const handleOpen = (user = null) => {
    if (user) {
      setEditUser(user);
      setFormData({
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        role: user.role,
        password: '', // Ne pas pré-remplir le mot de passe
      });
    } else {
      setEditUser(null);
      setFormData({
        email: '',
        password: '',
        prenom: '',
        nom: '',
        role: 'user',
      });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditUser(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editUser) {
      // Mise à jour - ne pas envoyer le password s'il est vide
      const updateData = { ...formData };
      if (!updateData.password) {
        delete updateData.password;
      }
      updateMutation.mutate({ id: editUser.id, data: updateData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <CircularProgress />;

  const users = response?.data || [];

  const getRoleColor = (role) => {
    const colors = {
      admin: 'error',
      manager: 'warning',
      technicien: 'info',
      user: 'default',
      viewer: 'default',
    };
    return colors[role] || 'default';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Utilisateurs</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Nouvel utilisateur
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Prénom</TableCell>
              <TableCell>Nom</TableCell>
              <TableCell>Rôle</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Aucun utilisateur trouvé
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.prenom}</TableCell>
                  <TableCell>{user.nom}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      color={getRoleColor(user.role)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.is_active ? 'Actif' : 'Inactif'}
                      color={user.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpen(user)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(user.id)}
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
            {editUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label={editUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editUser}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Prénom"
              value={formData.prenom}
              onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
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
              select
              label="Rôle"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              SelectProps={{ native: true }}
              margin="normal"
            >
              <option value="user">Utilisateur</option>
              <option value="technicien">Technicien</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrateur</option>
              <option value="viewer">Lecteur</option>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Annuler</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isLoading || updateMutation.isLoading}
            >
              {editUser ? 'Modifier' : 'Créer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Grid,
  InputAdornment,
  Tooltip,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Link as LinkIcon,
} from '@mui/icons-material';

export default function Pieces() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editPiece, setEditPiece] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    designation: '',
    reference_interne: '',
    reference_fabricant: '',
    fournisseur: '',
    site_internet_fournisseur: '',
    prix_indicatif: '',
    unite: '',
    quantite_stock: 0,
    seuil_minimum: 0,
    remarques: '',
  });
  const [error, setError] = useState('');

  const { data: response, isLoading } = useQuery('pieces', async () => {
    const response = await axios.get('/api/pieces');
    return response.data;
  });

  const createMutation = useMutation(
    (data) => axios.post('/api/pieces', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('pieces');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la création');
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/pieces/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('pieces');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/pieces/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('pieces');
      },
    }
  );

  const handleOpen = (piece = null) => {
    if (piece) {
      setEditPiece(piece);
      setFormData({
        code: piece.code || '',
        designation: piece.designation || '',
        reference_interne: piece.reference_interne || '',
        reference_fabricant: piece.reference_fabricant || '',
        fournisseur: piece.fournisseur || '',
        site_internet_fournisseur: piece.site_internet_fournisseur || '',
        prix_indicatif: piece.prix_indicatif || '',
        unite: piece.unite || '',
        quantite_stock: piece.quantite_stock || 0,
        seuil_minimum: piece.seuil_minimum || 0,
        remarques: piece.remarques || '',
      });
    } else {
      setEditPiece(null);
      setFormData({
        code: '',
        designation: '',
        reference_interne: '',
        reference_fabricant: '',
        fournisseur: '',
        site_internet_fournisseur: '',
        prix_indicatif: '',
        unite: '',
        quantite_stock: 0,
        seuil_minimum: 0,
        remarques: '',
      });
    }
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditPiece(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      prix_indicatif: formData.prix_indicatif ? parseFloat(formData.prix_indicatif) : null,
      quantite_stock: parseInt(formData.quantite_stock) || 0,
      seuil_minimum: parseInt(formData.seuil_minimum) || 0,
    };
    
    if (editPiece) {
      updateMutation.mutate({ id: editPiece.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette pièce ?')) {
      deleteMutation.mutate(id);
    }
  };

  const getStockStatusColor = (statut) => {
    switch (statut) {
      case 'critique':
        return 'error';
      case 'attention':
        return 'warning';
      case 'ok':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStockStatusIcon = (statut) => {
    switch (statut) {
      case 'critique':
      case 'attention':
        return <WarningIcon />;
      case 'ok':
        return <CheckCircleIcon />;
      default:
        return null;
    }
  };

  const getStockStatusLabel = (statut) => {
    switch (statut) {
      case 'critique':
        return 'Stock critique';
      case 'attention':
        return 'Stock faible';
      case 'ok':
        return 'Stock OK';
      default:
        return 'N/A';
    }
  };

  if (isLoading) return <CircularProgress />;

  const pieces = response?.data || [];
  
  // Filter pieces based on search term
  const filteredPieces = pieces.filter(piece => 
    piece.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    piece.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    piece.reference_fabricant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    piece.reference_interne?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    piece.fournisseur?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate statistics
  const stats = {
    total: pieces.length,
    critique: pieces.filter(p => p.statut_stock === 'critique').length,
    attention: pieces.filter(p => p.statut_stock === 'attention').length,
    ok: pieces.filter(p => p.statut_stock === 'ok').length,
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Catalogue de Pièces</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Nouvelle pièce
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Pièces
              </Typography>
              <Typography variant="h4">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="error" gutterBottom>
                Stock Critique
              </Typography>
              <Typography variant="h4" color="error">{stats.critique}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="warning.main" gutterBottom>
                Stock Faible
              </Typography>
              <Typography variant="h4" color="warning.main">{stats.attention}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="success.main" gutterBottom>
                Stock OK
              </Typography>
              <Typography variant="h4" color="success.main">{stats.ok}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search Bar */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Rechercher par code, désignation, référence, ou fournisseur..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Désignation</TableCell>
              <TableCell>Réf. Interne</TableCell>
              <TableCell>Réf. Fabricant</TableCell>
              <TableCell>Fournisseur</TableCell>
              <TableCell align="center">Stock</TableCell>
              <TableCell align="center">Seuil Min</TableCell>
              <TableCell align="right">Prix</TableCell>
              <TableCell align="center">Statut</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPieces.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  {searchTerm ? 'Aucune pièce trouvée.' : 'Aucune pièce disponible. Cliquez sur "Nouvelle pièce" pour commencer.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredPieces.map((piece) => (
                <TableRow
                  key={piece.id}
                  hover
                  sx={{ 
                    cursor: 'pointer',
                    backgroundColor: piece.statut_stock === 'critique' ? 'rgba(211, 47, 47, 0.05)' : 'inherit'
                  }}
                >
                  <TableCell>{piece.code}</TableCell>
                  <TableCell>{piece.designation}</TableCell>
                  <TableCell>{piece.reference_interne || '-'}</TableCell>
                  <TableCell>{piece.reference_fabricant || '-'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {piece.fournisseur || '-'}
                      {piece.site_internet_fournisseur && (
                        <Tooltip title="Visiter le site du fournisseur">
                          <IconButton
                            size="small"
                            href={piece.site_internet_fournisseur}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <LinkIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <strong>{piece.quantite_stock || 0}</strong>
                  </TableCell>
                  <TableCell align="center">{piece.seuil_minimum || 0}</TableCell>
                  <TableCell align="right">
                    {piece.prix_indicatif ? `${parseFloat(piece.prix_indicatif).toFixed(2)} €` : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      icon={getStockStatusIcon(piece.statut_stock)}
                      label={getStockStatusLabel(piece.statut_stock)}
                      size="small"
                      color={getStockStatusColor(piece.statut_stock)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(piece);
                      }}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(piece.id);
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

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editPiece ? 'Modifier la pièce' : 'Nouvelle pièce'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* Identification */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Identification
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Code *"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Référence Interne"
                  value={formData.reference_interne}
                  onChange={(e) => setFormData({ ...formData, reference_interne: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Désignation *"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  required
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Référence Fabricant"
                  value={formData.reference_fabricant}
                  onChange={(e) => setFormData({ ...formData, reference_fabricant: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Unité"
                  value={formData.unite}
                  onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
                  placeholder="Ex: pièce, kg, m, L"
                />
              </Grid>

              {/* Fournisseur */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Fournisseur
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Fournisseur"
                  value={formData.fournisseur}
                  onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Site Internet Fournisseur"
                  value={formData.site_internet_fournisseur}
                  onChange={(e) => setFormData({ ...formData, site_internet_fournisseur: e.target.value })}
                  placeholder="https://www.example.com"
                  type="url"
                />
              </Grid>

              {/* Stock et Prix */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Stock et Prix
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Quantité en Stock"
                  type="number"
                  value={formData.quantite_stock}
                  onChange={(e) => setFormData({ ...formData, quantite_stock: e.target.value })}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Seuil Minimum"
                  type="number"
                  value={formData.seuil_minimum}
                  onChange={(e) => setFormData({ ...formData, seuil_minimum: e.target.value })}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Prix Indicatif (€)"
                  type="number"
                  value={formData.prix_indicatif}
                  onChange={(e) => setFormData({ ...formData, prix_indicatif: e.target.value })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              {/* Remarques */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Remarques"
                  value={formData.remarques}
                  onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Annuler</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isLoading || updateMutation.isLoading}
            >
              {editPiece ? 'Modifier' : 'Créer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

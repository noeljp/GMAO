import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';

export default function TemplatesMaintenance() {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    type_maintenance: 'preventif',
    priorite: 'normale',
    duree_estimee_heures: '',
    instructions: '',
    pieces_necessaires: [],
    competences_requises: []
  });

  // Fetch templates
  const { data: templatesData, isLoading } = useQuery('templates', async () => {
    const res = await axios.get('/api/compteurs/templates');
    return res.data;
  });

  // Create template
  const createMutation = useMutation(
    (data) => axios.post('/api/compteurs/templates', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('templates');
        handleCloseDialog();
      }
    }
  );

  // Update template
  const updateMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/compteurs/templates/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('templates');
        handleCloseDialog();
      }
    }
  );

  // Delete template
  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/compteurs/templates/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('templates');
      }
    }
  );

  const handleOpenDialog = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        nom: template.nom,
        description: template.description || '',
        type_maintenance: template.type_maintenance,
        priorite: template.priorite,
        duree_estimee_heures: template.duree_estimee_heures || '',
        instructions: template.instructions || '',
        pieces_necessaires: template.pieces_necessaires || [],
        competences_requises: template.competences_requises || []
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        nom: '',
        description: '',
        type_maintenance: 'preventif',
        priorite: 'normale',
        duree_estimee_heures: '',
        instructions: '',
        pieces_necessaires: [],
        competences_requises: []
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
  };

  const handleSubmit = () => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce template ?')) {
      deleteMutation.mutate(id);
    }
  };

  const templates = templatesData?.data || [];

  const getPriorityColor = (priorite) => {
    switch (priorite) {
      case 'critique': return 'error';
      case 'haute': return 'warning';
      case 'normale': return 'info';
      case 'basse': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          <DescriptionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Templates de Maintenance
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nouveau Template
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nom</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Priorité</TableCell>
              <TableCell>Durée estimée (h)</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">
                    {template.nom}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={template.type_maintenance} size="small" />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={template.priorite} 
                    size="small" 
                    color={getPriorityColor(template.priorite)}
                  />
                </TableCell>
                <TableCell>{template.duree_estimee_heures || '-'}</TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                    {template.description || '-'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(template)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(template.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">
                    Aucun template de maintenance. Créez-en un pour démarrer.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog Création/Édition */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Modifier le template' : 'Nouveau template de maintenance'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nom du template"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Type de maintenance</InputLabel>
                <Select
                  value={formData.type_maintenance}
                  onChange={(e) => setFormData({ ...formData, type_maintenance: e.target.value })}
                >
                  <MenuItem value="preventif">Préventif</MenuItem>
                  <MenuItem value="correctif">Correctif</MenuItem>
                  <MenuItem value="predictif">Prédictif</MenuItem>
                  <MenuItem value="amelioration">Amélioration</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Priorité</InputLabel>
                <Select
                  value={formData.priorite}
                  onChange={(e) => setFormData({ ...formData, priorite: e.target.value })}
                >
                  <MenuItem value="critique">Critique</MenuItem>
                  <MenuItem value="haute">Haute</MenuItem>
                  <MenuItem value="normale">Normale</MenuItem>
                  <MenuItem value="basse">Basse</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Durée estimée (heures)"
                type="number"
                value={formData.duree_estimee_heures}
                onChange={(e) => setFormData({ ...formData, duree_estimee_heures: e.target.value })}
                inputProps={{ step: '0.5', min: '0' }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Instructions détaillées"
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                multiline
                rows={4}
                placeholder="Décrire les étapes de la maintenance..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.nom || createMutation.isLoading || updateMutation.isLoading}
          >
            {editingTemplate ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

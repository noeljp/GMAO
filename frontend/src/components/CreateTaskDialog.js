import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Alert,
  CircularProgress,
  Autocomplete,
  Stack,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { addMinutes } from 'date-fns';
import axios from 'axios';

const TASK_TYPES = [
  { value: 'correctif', label: 'Correctif' },
  { value: 'preventif', label: 'Préventif' },
  { value: 'amelioration', label: 'Amélioration' },
];

const PRIORITY_LEVELS = [
  { value: 'basse', label: 'Basse' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'haute', label: 'Haute' },
  { value: 'urgente', label: 'Urgente' },
];

export default function CreateTaskDialog({ open, onClose, onTaskCreated }) {
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [actifs, setActifs] = useState([]);
  const [resources, setResources] = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  
  const [formData, setFormData] = useState({
    titre: '',
    description: '',
    type: 'correctif',
    priorite: 'moyenne',
    actif_id: '',
    technicien_id: '',
    date_prevue_debut: new Date(),
    duree_estimee: 60, // minutes
    selectedResources: [],
  });

  // Load data on mount
  useEffect(() => {
    if (open) {
      loadActifs();
      loadResources();
      loadTechniciens();
    }
  }, [open]);

  const loadActifs = async () => {
    try {
      const response = await axios.get('/api/actifs', {
        params: { limit: 1000 },
      });
      setActifs(response.data.data || []);
    } catch (error) {
      console.error('Error loading actifs:', error);
    }
  };

  const loadResources = async () => {
    try {
      const response = await axios.get('/api/resources');
      setResources(response.data.data || []);
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  };

  const loadTechniciens = async () => {
    try {
      const response = await axios.get('/api/users', {
        params: { role: 'technicien' },
      });
      setTechniciens(response.data.data || []);
    } catch (error) {
      console.error('Error loading techniciens:', error);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setConflicts([]);

    try {
      const dateDebut = formData.date_prevue_debut;
      const dateFin = addMinutes(dateDebut, formData.duree_estimee);

      const payload = {
        titre: formData.titre,
        description: formData.description,
        type: formData.type,
        priorite: formData.priorite,
        actif_id: formData.actif_id,
        technicien_id: formData.technicien_id || null,
        date_prevue_debut: dateDebut.toISOString(),
        date_prevue_fin: dateFin.toISOString(),
        duree_estimee: formData.duree_estimee,
        resources: formData.selectedResources.map((r) => ({
          resource_id: r.id,
          quantite_requise: r.quantite || 1,
        })),
      };

      const response = await axios.post('/api/ordres-travail', payload);
      
      // Check if there are conflicts
      if (response.data.has_conflicts) {
        setConflicts(response.data.conflict_details?.conflicts || []);
      } else {
        // Success - close and refresh
        if (onTaskCreated) {
          onTaskCreated(response.data);
        }
        handleClose();
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Erreur lors de la création de la tâche: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      titre: '',
      description: '',
      type: 'correctif',
      priorite: 'moyenne',
      actif_id: '',
      technicien_id: '',
      date_prevue_debut: new Date(),
      duree_estimee: 60,
      selectedResources: [],
    });
    setConflicts([]);
    onClose();
  };

  const handleResourceChange = (_, newValue) => {
    setFormData((prev) => ({
      ...prev,
      selectedResources: newValue,
    }));
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Créer une nouvelle tâche de maintenance</DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {conflicts.length > 0 && (
              <Alert severity="warning">
                Attention: La tâche a été créée mais il y a {conflicts.length} conflit(s) de ressources.
                Vous pouvez fermer cette fenêtre et résoudre les conflits plus tard.
              </Alert>
            )}

            <TextField
              label="Titre *"
              fullWidth
              value={formData.titre}
              onChange={(e) => handleChange('titre', e.target.value)}
              required
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />

            <FormControl fullWidth>
              <InputLabel>Type *</InputLabel>
              <Select
                value={formData.type}
                label="Type *"
                onChange={(e) => handleChange('type', e.target.value)}
              >
                {TASK_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Priorité *</InputLabel>
              <Select
                value={formData.priorite}
                label="Priorité *"
                onChange={(e) => handleChange('priorite', e.target.value)}
              >
                {PRIORITY_LEVELS.map((priority) => (
                  <MenuItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Actif *</InputLabel>
              <Select
                value={formData.actif_id}
                label="Actif *"
                onChange={(e) => handleChange('actif_id', e.target.value)}
              >
                {actifs.map((actif) => (
                  <MenuItem key={actif.id} value={actif.id}>
                    {actif.code_interne} - {actif.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Technicien</InputLabel>
              <Select
                value={formData.technicien_id}
                label="Technicien"
                onChange={(e) => handleChange('technicien_id', e.target.value)}
              >
                <MenuItem value="">
                  <em>Non assigné</em>
                </MenuItem>
                {techniciens.map((tech) => (
                  <MenuItem key={tech.id} value={tech.id}>
                    {tech.prenom} {tech.nom}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <DateTimePicker
              label="Date de début prévue *"
              value={formData.date_prevue_debut}
              onChange={(newValue) => handleChange('date_prevue_debut', newValue)}
              renderInput={(params) => <TextField {...params} fullWidth />}
              ampm={false}
            />

            <TextField
              label="Durée estimée (minutes) *"
              type="number"
              fullWidth
              value={formData.duree_estimee}
              onChange={(e) => handleChange('duree_estimee', parseInt(e.target.value))}
              inputProps={{ min: 1 }}
            />

            <Autocomplete
              multiple
              options={resources}
              getOptionLabel={(option) => `${option.nom} (${option.type_nom})`}
              value={formData.selectedResources}
              onChange={handleResourceChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Ressources nécessaires"
                  placeholder="Sélectionner des ressources"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.nom}
                    {...getTagProps({ index })}
                    size="small"
                  />
                ))
              }
            />
          </Stack>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={
            loading ||
            !formData.titre ||
            !formData.actif_id ||
            !formData.type ||
            !formData.priorite
          }
        >
          {loading ? <CircularProgress size={24} /> : conflicts.length > 0 ? 'Fermer' : 'Créer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

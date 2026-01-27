import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';

export default function TypesActifs() {
  const queryClient = useQueryClient();
  const [openChampDialog, setOpenChampDialog] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedChamp, setSelectedChamp] = useState(null);
  const [champForm, setChampForm] = useState({
    nom: '',
    libelle: '',
    type_champ: 'number',
    unite: '',
    description: '',
    ordre: 0,
    obligatoire: false,
  });

  // Queries
  const { data: typesData, isLoading } = useQuery('types-actifs', async () => {
    const res = await axios.get('/api/types-actifs');
    return res.data;
  });

  // Mutations pour champs
  const createChampMutation = useMutation(
    ({ typeId, data }) => axios.post(`/api/types-actifs/${typeId}/champs`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('types-actifs');
        setOpenChampDialog(false);
        resetChampForm();
      },
    }
  );

  const updateChampMutation = useMutation(
    ({ typeId, champId, data }) =>
      axios.patch(`/api/types-actifs/${typeId}/champs/${champId}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('types-actifs');
        setOpenChampDialog(false);
        resetChampForm();
      },
    }
  );

  const deleteChampMutation = useMutation(
    ({ typeId, champId }) => axios.delete(`/api/types-actifs/${typeId}/champs/${champId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('types-actifs');
      },
    }
  );

  // Handlers
  const resetChampForm = () => {
    setChampForm({
      nom: '',
      libelle: '',
      type_champ: 'number',
      unite: '',
      description: '',
      ordre: 0,
      obligatoire: false,
    });
    setSelectedChamp(null);
  };

  const handleOpenChampDialog = (type, champ = null) => {
    setSelectedType(type);
    if (champ) {
      setSelectedChamp(champ);
      setChampForm({
        nom: champ.nom,
        libelle: champ.libelle,
        type_champ: champ.type_champ,
        unite: champ.unite || '',
        description: champ.description || '',
        ordre: champ.ordre || 0,
        obligatoire: champ.obligatoire || false,
      });
    } else {
      resetChampForm();
    }
    setOpenChampDialog(true);
  };

  const handleSaveChamp = () => {
    if (selectedChamp) {
      updateChampMutation.mutate({
        typeId: selectedType.id,
        champId: selectedChamp.id,
        data: champForm,
      });
    } else {
      createChampMutation.mutate({
        typeId: selectedType.id,
        data: champForm,
      });
    }
  };

  const handleDeleteChamp = (typeId, champId) => {
    if (window.confirm('Êtes-vous sûr de vouloir désactiver ce champ ?')) {
      deleteChampMutation.mutate({ typeId, champId });
    }
  };

  if (isLoading) return <Typography>Chargement...</Typography>;

  const types = typesData?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Compteurs par type d'actif</Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Les <strong>compteurs</strong> sont des champs numériques définis pour chaque type
        d'actif. Ils permettent de suivre des valeurs comme les heures de fonctionnement, les
        kilomètres, les cycles, etc. Vous pouvez ensuite définir des seuils d'alerte sur ces
        compteurs.
      </Alert>

      {types.length === 0 ? (
        <Alert severity="warning">Aucun type d'actif défini.</Alert>
      ) : (
        types.map((type) => (
          <Accordion key={type.id} defaultExpanded={types.length === 1}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  {type.nom}
                </Typography>
                <Chip label={`${type.nb_actifs} actifs`} size="small" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {type.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {type.description}
                </Typography>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Champs et Compteurs
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenChampDialog(type)}
                >
                  Ajouter un champ
                </Button>
              </Box>

              {!type.champs || type.champs.length === 0 ? (
                <Alert severity="info">
                  Aucun compteur défini. Ajoutez un champ de type <strong>"number"</strong> pour
                  créer un compteur.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Nom</TableCell>
                        <TableCell>Libellé</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Unité</TableCell>
                        <TableCell>Ordre</TableCell>
                        <TableCell>Obligatoire</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {type.champs.map((champ) => (
                        <TableRow key={champ.id}>
                          <TableCell>
                            {champ.type_champ === 'number' && (
                              <SpeedIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                            )}
                            {champ.nom}
                          </TableCell>
                          <TableCell>{champ.libelle}</TableCell>
                          <TableCell>
                            <Chip
                              label={champ.type_champ}
                              size="small"
                              color={champ.type_champ === 'number' ? 'primary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>{champ.unite || '-'}</TableCell>
                          <TableCell>{champ.ordre}</TableCell>
                          <TableCell>{champ.obligatoire ? '✓' : '-'}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenChampDialog(type, champ)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteChamp(type.id, champ.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </AccordionDetails>
          </Accordion>
        ))
      )}

      {/* Dialog Champ/Compteur */}
      <Dialog
        open={openChampDialog}
        onClose={() => setOpenChampDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedChamp ? 'Modifier le champ' : 'Nouveau champ'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
            Pour créer un <strong>compteur</strong>, choisissez le type <strong>"number"</strong>.
            Vous pourrez ensuite définir des seuils d'alerte sur les actifs.
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Nom technique"
                value={champForm.nom}
                onChange={(e) => setChampForm({ ...champForm, nom: e.target.value })}
                margin="normal"
                required
                disabled={!!selectedChamp}
                helperText="Identifiant unique (ex: heures_fonctionnement)"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Libellé affiché"
                value={champForm.libelle}
                onChange={(e) => setChampForm({ ...champForm, libelle: e.target.value })}
                margin="normal"
                required
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Type de champ</InputLabel>
                <Select
                  value={champForm.type_champ}
                  onChange={(e) => setChampForm({ ...champForm, type_champ: e.target.value })}
                  disabled={!!selectedChamp}
                >
                  <MenuItem value="text">Texte</MenuItem>
                  <MenuItem value="number">Nombre (Compteur)</MenuItem>
                  <MenuItem value="date">Date</MenuItem>
                  <MenuItem value="boolean">Oui/Non</MenuItem>
                  <MenuItem value="select">Liste déroulante</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Unité"
                value={champForm.unite}
                onChange={(e) => setChampForm({ ...champForm, unite: e.target.value })}
                margin="normal"
                placeholder="ex: heures, km, cycles"
                helperText="Pour les compteurs numériques"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={champForm.description}
                onChange={(e) => setChampForm({ ...champForm, description: e.target.value })}
                margin="normal"
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Ordre d'affichage"
                type="number"
                value={champForm.ordre}
                onChange={(e) => setChampForm({ ...champForm, ordre: parseInt(e.target.value) })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={champForm.obligatoire}
                    onChange={(e) => setChampForm({ ...champForm, obligatoire: e.target.checked })}
                  />
                }
                label="Champ obligatoire"
                sx={{ mt: 3 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenChampDialog(false)}>Annuler</Button>
          <Button
            onClick={handleSaveChamp}
            variant="contained"
            disabled={!champForm.nom || !champForm.libelle}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

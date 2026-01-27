import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  IconButton,
  Grid,
  Card,
  CardContent,
  Divider,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function CompteursActif({ actifId }) {
  const queryClient = useQueryClient();
  const [openSaisie, setOpenSaisie] = useState(false);
  const [openSeuil, setOpenSeuil] = useState(false);
  const [selectedCompteur, setSelectedCompteur] = useState(null);
  const [alerteSnackbar, setAlerteSnackbar] = useState({ open: false, alertes: [] });
  const [saisieForm, setSaisieForm] = useState({ valeur: '', commentaire: '' });
  const [seuilForm, setSeuilForm] = useState({
    champ_definition_id: '',
    type_seuil: 'superieur',
    valeur_seuil_min: '',
    valeur_seuil_max: '',
    niveau_alerte: 'warning',
    message_alerte: '',
    action_automatique: 'notification',
    template_maintenance_id: null,
  });

  // Queries
  const { data: compteursData, isLoading, error } = useQuery(
    ['compteurs', actifId],
    async () => {
      const res = await axios.get(`/api/compteurs/actif/${actifId}`);
      return res.data;
    },
    {
      enabled: !!actifId,
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - évite les re-fetch trop fréquents
      refetchOnWindowFocus: false // Ne pas re-fetch au focus
    }
  );

  const { data: alertesData } = useQuery(
    ['alertes', actifId],
    async () => {
      const res = await axios.get(`/api/compteurs/alertes?actif_id=${actifId}`);
      return res.data;
    },
    { 
      enabled: false, // Désactivé temporairement - table v_alertes_actives n'existe pas
      retry: false
    }
  );

  const { data: templatesData } = useQuery('templates', async () => {
    const res = await axios.get('/api/compteurs/templates');
    return res.data;
  }, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Mutations
  const saisieMutation = useMutation(
    (data) => axios.post(`/api/compteurs/actif/${actifId}/saisie`, data),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries(['compteurs', actifId]);
        queryClient.invalidateQueries(['alertes', actifId]);
        setOpenSaisie(false);
        setSaisieForm({ valeur: '', commentaire: '' });
        
        // Afficher les alertes déclenchées
        if (response.data.alertes_declenchees?.length > 0) {
          setAlerteSnackbar({
            open: true,
            alertes: response.data.alertes_declenchees
          });
        }
      },
    }
  );

  const createSeuilMutation = useMutation(
    (data) => axios.post('/api/compteurs/seuils', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['compteurs', actifId]);
        setOpenSeuil(false);
        resetSeuilForm();
      },
    }
  );

  const deleteSeuilMutation = useMutation(
    (id) => axios.delete(`/api/compteurs/seuils/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['compteurs', actifId]);
      },
    }
  );

  const acquitterAlerteMutation = useMutation(
    ({ id, commentaire }) =>
      axios.post(`/api/compteurs/alertes/${id}/acquitter`, { commentaire }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['alertes', actifId]);
      },
    }
  );

  // Handlers
  const resetSeuilForm = () => {
    setSeuilForm({
      champ_definition_id: '',
      type_seuil: 'superieur',
      valeur_seuil_min: '',
      valeur_seuil_max: '',
      niveau_alerte: 'warning',
      message_alerte: '',
      action_automatique: 'notification',
      template_maintenance_id: null,
    });
  };

  const handleOpenSaisie = (compteur) => {
    setSelectedCompteur(compteur);
    setSaisieForm({
      valeur: compteur.valeur_actuelle || '',
      commentaire: '',
    });
    setOpenSaisie(true);
  };

  const handleSaveSaisie = () => {
    saisieMutation.mutate({
      champ_id: selectedCompteur.champ_id,
      valeur: parseFloat(saisieForm.valeur),
      commentaire: saisieForm.commentaire,
    });
  };

  const handleOpenSeuil = (compteur) => {
    setSeuilForm({
      ...seuilForm,
      champ_definition_id: compteur.champ_id,
    });
    setOpenSeuil(true);
  };

  const handleSaveSeuil = () => {
    createSeuilMutation.mutate({
      ...seuilForm,
      actif_id: actifId,
      valeur_seuil_min: parseFloat(seuilForm.valeur_seuil_min),
      valeur_seuil_max: seuilForm.valeur_seuil_max ? parseFloat(seuilForm.valeur_seuil_max) : null,
    });
  };

  const handleDeleteSeuil = (seuilId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce seuil ?')) {
      deleteSeuilMutation.mutate(seuilId);
    }
  };

  const handleAcquitter = (alerteId) => {
    const commentaire = prompt('Commentaire d\'acquittement (optionnel):');
    acquitterAlerteMutation.mutate({ id: alerteId, commentaire: commentaire || '' });
  };

  if (isLoading) {
    return <Typography>Chargement...</Typography>;
  }
  if (error) {
    console.error('❌ CompteursActif - Error:', error);
    return <Alert severity="error">Erreur lors du chargement des compteurs: {error.message}</Alert>;
  }

  const compteurs = compteursData?.data || [];
  const alertes = alertesData?.data || [];
  const templates = templatesData?.data || [];

  return (
    <Box>
      {/* Alertes actives */}
      {alertes.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#fff3e0' }}>
          <Typography variant="h6" gutterBottom>
            <WarningIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            {alertes.length} Alerte(s) Active(s)
          </Typography>
          {alertes.slice(0, 3).map((alerte) => (
            <Alert
              key={alerte.id}
              severity={
                alerte.niveau_alerte === 'critical'
                  ? 'error'
                  : alerte.niveau_alerte === 'warning'
                  ? 'warning'
                  : 'info'
              }
              sx={{ mb: 1 }}
              action={
                <Button size="small" onClick={() => handleAcquitter(alerte.id)}>
                  Acquitter
                </Button>
              }
            >
              <strong>{alerte.champ_libelle}:</strong> {alerte.message} (Valeur: {alerte.valeur_declenchement})
            </Alert>
          ))}
        </Paper>
      )}

      {/* Liste des compteurs */}
      <Typography variant="h6" gutterBottom>
        Compteurs et Seuils
      </Typography>

      {compteurs.length === 0 ? (
        <Alert severity="info">
          Aucun compteur défini pour cet actif (type de cet actif).
          <br />
          Pour créer des compteurs, allez dans le menu "Types d'actifs" et ajoutez des champs de type "number" au type de cet actif.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {compteurs.map((compteur) => (
            <Grid item xs={12} md={6} key={compteur.champ_id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">{compteur.libelle}</Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SaveIcon />}
                      onClick={() => handleOpenSaisie(compteur)}
                    >
                      Saisir
                    </Button>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h4" color="primary">
                      {compteur.valeur_actuelle || '-'} {compteur.unite}
                    </Typography>
                    {compteur.derniere_mise_a_jour && (
                      <Typography variant="caption" color="text.secondary">
                        Mis à jour le{' '}
                        {format(new Date(compteur.derniere_mise_a_jour), 'Pp', { locale: fr })}
                      </Typography>
                    )}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">Seuils d'alerte:</Typography>
                    <IconButton size="small" onClick={() => handleOpenSeuil(compteur)}>
                      <AddIcon />
                    </IconButton>
                  </Box>

                  {compteur.seuils && compteur.seuils.length > 0 ? (
                    compteur.seuils.map((seuil) => (
                      <Box
                        key={seuil.id}
                        sx={{
                          mb: 2,
                          p: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          bgcolor: 'background.paper',
                        }}
                      >
                        {/* Première ligne: Niveau et Valeur + Bouton supprimer */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                            <Chip
                              label={seuil.niveau_alerte}
                              size="small"
                              color={
                                seuil.niveau_alerte === 'critical'
                                  ? 'error'
                                  : seuil.niveau_alerte === 'warning'
                                  ? 'warning'
                                  : 'info'
                              }
                            />
                            <Typography variant="body2" component="span" fontWeight="medium">
                              {seuil.type_seuil === 'superieur' && `> ${seuil.valeur_seuil_min}`}
                              {seuil.type_seuil === 'inferieur' && `< ${seuil.valeur_seuil_min}`}
                              {seuil.type_seuil === 'egal' && `= ${seuil.valeur_seuil_min}`}
                              {seuil.type_seuil === 'entre' &&
                                `entre ${seuil.valeur_seuil_min} et ${seuil.valeur_seuil_max}`}
                            </Typography>
                          </Box>
                          <IconButton size="small" onClick={() => handleDeleteSeuil(seuil.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        {/* Action automatique */}
                        {seuil.action_automatique && (
                          <Box sx={{ mb: 0.5 }}>
                            <Chip
                              label={
                                seuil.action_automatique === 'ordre_travail'
                                  ? '🔧 Création OT automatique'
                                  : seuil.action_automatique === 'notification'
                                  ? '🔔 Notification uniquement'
                                  : seuil.action_automatique === 'notification_et_ordre'
                                  ? '🔔 + 🔧 Notification + Création OT'
                                  : seuil.action_automatique
                              }
                              size="small"
                              color={
                                seuil.action_automatique.includes('ordre')
                                  ? 'success'
                                  : 'default'
                              }
                              variant="outlined"
                            />
                          </Box>
                        )}

                        {/* Template associé */}
                        {seuil.template_maintenance_id && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            📋 Template: {seuil.template_nom || seuil.template_maintenance_id}
                          </Typography>
                        )}

                        {/* Message d'alerte */}
                        {seuil.message_alerte && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            💬 {seuil.message_alerte}
                          </Typography>
                        )}
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Aucun seuil défini
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog Saisie */}
      <Dialog open={openSaisie} onClose={() => setOpenSaisie(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Saisir un compteur</DialogTitle>
        <DialogContent>
          {selectedCompteur && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {selectedCompteur.libelle}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedCompteur.description}
              </Typography>
              <TextField
                fullWidth
                label={`Valeur (${selectedCompteur.unite})`}
                type="number"
                value={saisieForm.valeur}
                onChange={(e) => setSaisieForm({ ...saisieForm, valeur: e.target.value })}
                margin="normal"
                inputProps={{ step: '0.01' }}
              />
              <TextField
                fullWidth
                label="Commentaire (optionnel)"
                value={saisieForm.commentaire}
                onChange={(e) => setSaisieForm({ ...saisieForm, commentaire: e.target.value })}
                margin="normal"
                multiline
                rows={2}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSaisie(false)}>Annuler</Button>
          <Button
            onClick={handleSaveSaisie}
            variant="contained"
            disabled={!saisieForm.valeur}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Seuil */}
      <Dialog open={openSeuil} onClose={() => setOpenSeuil(false)} maxWidth="md" fullWidth>
        <DialogTitle>Configurer un seuil d'alerte</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
            Définissez un seuil pour déclencher automatiquement une alerte et/ou un ordre de travail
            préventif.
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Type de seuil</InputLabel>
                <Select
                  value={seuilForm.type_seuil}
                  onChange={(e) => setSeuilForm({ ...seuilForm, type_seuil: e.target.value })}
                >
                  <MenuItem value="superieur">Supérieur à</MenuItem>
                  <MenuItem value="inferieur">Inférieur à</MenuItem>
                  <MenuItem value="egal">Égal à</MenuItem>
                  <MenuItem value="entre">Entre</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Niveau d'alerte</InputLabel>
                <Select
                  value={seuilForm.niveau_alerte}
                  onChange={(e) => setSeuilForm({ ...seuilForm, niveau_alerte: e.target.value })}
                >
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warning">Avertissement</MenuItem>
                  <MenuItem value="critical">Critique</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={seuilForm.type_seuil === 'entre' ? 6 : 12}>
              <TextField
                fullWidth
                label="Valeur seuil"
                type="number"
                value={seuilForm.valeur_seuil_min}
                onChange={(e) =>
                  setSeuilForm({ ...seuilForm, valeur_seuil_min: e.target.value })
                }
                margin="normal"
                inputProps={{ step: '0.01' }}
              />
            </Grid>

            {seuilForm.type_seuil === 'entre' && (
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Valeur max"
                  type="number"
                  value={seuilForm.valeur_seuil_max}
                  onChange={(e) =>
                    setSeuilForm({ ...seuilForm, valeur_seuil_max: e.target.value })
                  }
                  margin="normal"
                  inputProps={{ step: '0.01' }}
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Message d'alerte"
                value={seuilForm.message_alerte}
                onChange={(e) => setSeuilForm({ ...seuilForm, message_alerte: e.target.value })}
                margin="normal"
                multiline
                rows={2}
                placeholder="Ex: Le compteur horaire a dépassé la limite de maintenance"
              />
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Action automatique</InputLabel>
                <Select
                  value={seuilForm.action_automatique}
                  onChange={(e) =>
                    setSeuilForm({ ...seuilForm, action_automatique: e.target.value })
                  }
                >
                  <MenuItem value="notification">Notification uniquement</MenuItem>
                  <MenuItem value="ordre_travail">Créer un ordre de travail</MenuItem>
                  <MenuItem value="notification_et_ordre">Notification + Ordre</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Template de maintenance */}
            {(seuilForm.action_automatique === 'ordre_travail' ||
              seuilForm.action_automatique === 'notification_et_ordre') && (
              <Grid item xs={12}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Template de maintenance</InputLabel>
                  <Select
                    value={seuilForm.template_maintenance_id || ''}
                    onChange={(e) =>
                      setSeuilForm({ ...seuilForm, template_maintenance_id: e.target.value })
                    }
                  >
                    <MenuItem value="">
                      <em>Aucun template</em>
                    </MenuItem>
                    {templates.map((template) => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.nom} - {template.type_maintenance}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSeuil(false)}>Annuler</Button>
          <Button
            onClick={handleSaveSeuil}
            variant="contained"
            disabled={!seuilForm.valeur_seuil_min}
          >
            Créer le seuil
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar pour les alertes déclenchées */}
      <Snackbar
        open={alerteSnackbar.open}
        autoHideDuration={8000}
        onClose={() => setAlerteSnackbar({ open: false, alertes: [] })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          severity="warning" 
          onClose={() => setAlerteSnackbar({ open: false, alertes: [] })}
          sx={{ width: '100%', maxWidth: 500 }}
        >
          <Typography variant="subtitle2" gutterBottom>
            🚨 {alerteSnackbar.alertes.length} Alerte(s) déclenchée(s)
          </Typography>
          {alerteSnackbar.alertes.map((alerte, index) => (
            <Box key={index} sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="body2" fontWeight="medium">
                {alerte.ordre_travail_titre}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Niveau: {alerte.niveau} | OT #{alerte.ordre_travail_id}
              </Typography>
              {alerte.message && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  {alerte.message}
                </Typography>
              )}
            </Box>
          ))}
        </Alert>
      </Snackbar>
    </Box>
  );
}

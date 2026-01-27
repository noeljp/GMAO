import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Transcribe as TranscribeIcon } from '@mui/icons-material';
import axios from 'axios';

/**
 * TranscriptionDialog Component
 * Dialog for requesting audio transcription with business context and technical keywords
 */
export default function TranscriptionDialog({ 
  open, 
  onClose, 
  document, 
  onTranscriptionRequested 
}) {
  const [formData, setFormData] = useState({
    businessContext: '',
    technicalKeywords: '',
    language: 'fr',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(
        `/api/whisper/transcribe/${document.id}`,
        {
          businessContext: formData.businessContext,
          technicalKeywords: formData.technicalKeywords,
          language: formData.language,
        }
      );

      setSuccess(true);
      setTimeout(() => {
        if (onTranscriptionRequested) {
          onTranscriptionRequested(response.data);
        }
        handleClose();
      }, 2000);

    } catch (err) {
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Erreur lors de la demande de transcription'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        businessContext: '',
        technicalKeywords: '',
        language: 'fr',
      });
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <TranscribeIcon />
            <Typography variant="h6">
              Transcrire le fichier audio
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Transcription en cours ! Le résultat apparaîtra bientôt dans vos documents.
            </Alert>
          )}

          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Fichier: <strong>{document?.nom_fichier || document?.titre}</strong>
          </Typography>

          <Typography variant="body2" sx={{ mb: 2 }}>
            Pour améliorer la précision de la transcription, vous pouvez fournir des informations 
            supplémentaires sur le contexte métier et les termes techniques utilisés dans l'audio.
          </Typography>

          <TextField
            fullWidth
            label="Contexte métier"
            placeholder="Ex: Maintenance préventive d'une pompe centrifuge sur le site de production"
            value={formData.businessContext}
            onChange={(e) => setFormData({ ...formData, businessContext: e.target.value })}
            multiline
            rows={3}
            margin="normal"
            helperText="Décrivez brièvement le contexte de l'enregistrement (réunion, analyse, intervention...)"
          />

          <TextField
            fullWidth
            label="Mots techniques et acronymes"
            placeholder="Ex: GMAO, API, IoT, MQTT, ordre de travail, préventif, correctif"
            value={formData.technicalKeywords}
            onChange={(e) => setFormData({ ...formData, technicalKeywords: e.target.value })}
            multiline
            rows={3}
            margin="normal"
            helperText="Listez les termes techniques, acronymes ou noms propres à reconnaître (séparés par des virgules)"
          />

          <TextField
            select
            fullWidth
            label="Langue"
            value={formData.language}
            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
            SelectProps={{ native: true }}
            margin="normal"
            helperText="Langue principale de l'enregistrement"
          >
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
            <option value="es">Espagnol</option>
            <option value="de">Allemand</option>
            <option value="it">Italien</option>
          </TextField>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || success}
            startIcon={loading ? <CircularProgress size={16} /> : <TranscribeIcon />}
          >
            {loading ? 'Envoi...' : 'Lancer la transcription'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

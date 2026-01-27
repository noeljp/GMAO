import React, { useState } from 'react';
import {
  IconButton,
  Tooltip,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { AutoAwesome as SparkleIcon } from '@mui/icons-material';
import axios from 'axios';

/**
 * LLMReformulateButton - Component for AI-powered description reformulation
 * 
 * @param {string} description - Current description text
 * @param {function} onReformulated - Callback when description is reformulated (receives new text)
 * @param {string} actifId - Optional asset ID for context
 * @param {string} typeIntervention - Optional intervention type
 * @param {string} priorite - Optional priority level
 * @param {boolean} disabled - Disable the button
 */
export default function LLMReformulateButton({
  description,
  onReformulated,
  actifId,
  typeIntervention,
  priorite,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reformulatedText, setReformulatedText] = useState('');
  const [originalText, setOriginalText] = useState('');

  const handleReformulate = async () => {
    if (!description || description.trim() === '') {
      setError('Veuillez entrer une description avant de la reformuler');
      return;
    }

    setLoading(true);
    setError(null);
    setOriginalText(description);

    try {
      const response = await axios.post('/api/ollama/reformulate', {
        description: description,
        actif_id: actifId,
        type_intervention: typeIntervention,
        priorite: priorite,
      });

      if (response.data.success) {
        setReformulatedText(response.data.reformulated);
        setDialogOpen(true);
      } else {
        setError('Erreur lors de la reformulation');
      }
    } catch (err) {
      console.error('Reformulation error:', err);
      
      if (err.response?.status === 503) {
        setError('Service de reformulation non disponible. Vérifiez que le service Ollama est démarré.');
      } else {
        setError(
          err.response?.data?.error || 
          'Erreur lors de la reformulation. Veuillez réessayer.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    onReformulated(reformulatedText);
    setDialogOpen(false);
  };

  const handleReject = () => {
    setDialogOpen(false);
  };

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <>
      <Tooltip title="Reformuler avec l'IA">
        <span>
          <IconButton
            onClick={handleReformulate}
            disabled={disabled || loading || !description}
            color="primary"
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'primary.light',
                opacity: 0.8,
              },
            }}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <SparkleIcon />
            )}
          </IconButton>
        </span>
      </Tooltip>

      {/* Reformulation preview dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleReject}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Proposition de reformulation
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Description originale:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                p: 2,
                backgroundColor: 'grey.100',
                borderRadius: 1,
                fontStyle: 'italic',
              }}
            >
              {originalText}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Description reformulée:
            </Typography>
            <Typography
              variant="body1"
              sx={{
                p: 2,
                backgroundColor: 'primary.light',
                borderRadius: 1,
                color: 'primary.contrastText',
              }}
            >
              {reformulatedText}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleReject} color="inherit">
            Annuler
          </Button>
          <Button
            onClick={handleAccept}
            variant="contained"
            color="primary"
            autoFocus
          >
            Utiliser cette reformulation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}

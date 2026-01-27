import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DocumentUpload({ objetType, objetId, onUploadComplete }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    titre: '',
    type: 'manuel',
    description: '',
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  // Récupérer les documents
  const { data: documents, isLoading } = useQuery(
    ['documents', objetType, objetId],
    async () => {
      const response = await axios.get(`/api/documents`, {
        params: { objet_type: objetType, objet_id: objetId },
      });
      return response.data.data || [];
    },
    { enabled: !!objetId }
  );

  // Mutation pour l'upload
  const uploadMutation = useMutation(
    async (uploadData) => {
      const formDataToSend = new FormData();
      formDataToSend.append('file', uploadData.file);
      formDataToSend.append('titre', uploadData.titre);
      formDataToSend.append('type', uploadData.type);
      formDataToSend.append('description', uploadData.description);
      formDataToSend.append('objet_type', objetType);
      formDataToSend.append('objet_id', objetId);

      const response = await axios.post('/api/documents/upload', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['documents', objetType, objetId]);
        setOpen(false);
        setFile(null);
        setFormData({ titre: '', type: 'manuel', description: '' });
        setUploadProgress(0);
        setError('');
        if (onUploadComplete) onUploadComplete();
      },
      onError: (err) => {
        setError(err.response?.data?.message || 'Erreur lors de l\'upload');
        setUploadProgress(0);
      },
    }
  );

  // Mutation pour la suppression
  const deleteMutation = useMutation(
    async (documentId) => {
      await axios.delete(`/api/documents/${documentId}`);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['documents', objetType, objetId]);
      },
    }
  );

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!formData.titre) {
        setFormData({ ...formData, titre: selectedFile.name });
      }
    }
  };

  const handleSubmit = () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }
    if (!formData.titre) {
      setError('Le titre est requis');
      return;
    }
    uploadMutation.mutate({ file, ...formData });
  };

  const handleDownload = async (documentId, nomFichier) => {
    try {
      const response = await axios.get(`/api/documents/${documentId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', nomFichier);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Erreur téléchargement:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Documents ({documents?.length || 0})</Typography>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => setOpen(true)}
          size="small"
        >
          Ajouter
        </Button>
      </Box>

      {/* Liste des documents */}
      {isLoading ? (
        <Typography color="textSecondary">Chargement...</Typography>
      ) : documents && documents.length > 0 ? (
        <List>
          {documents.map((doc) => (
            <ListItem
              key={doc.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
              }}
            >
              <ListItemText
                primary={doc.titre}
                secondary={
                  <>
                    {doc.nom_fichier} • {formatFileSize(doc.taille)}
                    {doc.created_at && (
                      <> • {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</>
                    )}
                    {doc.description && (
                      <>
                        <br />
                        {doc.description}
                      </>
                    )}
                  </>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => handleDownload(doc.id, doc.nom_fichier)}
                  sx={{ mr: 1 }}
                >
                  <DownloadIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => {
                    if (window.confirm('Supprimer ce document ?')) {
                      deleteMutation.mutate(doc.id);
                    }
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography color="textSecondary">Aucun document</Typography>
      )}

      {/* Dialog d'upload */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter un document</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Button
            variant="outlined"
            component="label"
            fullWidth
            sx={{ mb: 2 }}
            startIcon={<UploadIcon />}
          >
            {file ? file.name : 'Choisir un fichier'}
            <input type="file" hidden onChange={handleFileChange} />
          </Button>

          {file && (
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Taille: {formatFileSize(file.size)}
            </Typography>
          )}

          <TextField
            fullWidth
            label="Titre"
            value={formData.titre}
            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
            required
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              label="Type"
            >
              <MenuItem value="manuel">Manuel</MenuItem>
              <MenuItem value="procedure">Procédure</MenuItem>
              <MenuItem value="schema">Schéma</MenuItem>
              <MenuItem value="photo">Photo</MenuItem>
              <MenuItem value="certificat">Certificat</MenuItem>
              <MenuItem value="rapport">Rapport</MenuItem>
              <MenuItem value="autre">Autre</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={3}
          />

          {uploadProgress > 0 && uploadProgress < 100 && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
              <Typography variant="caption" color="textSecondary">
                Upload: {uploadProgress}%
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!file || uploadMutation.isLoading}
          >
            {uploadMutation.isLoading ? 'Upload...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

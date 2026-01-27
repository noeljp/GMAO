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
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  CloudUpload as CloudUploadIcon,
  Transcribe as TranscribeIcon,
  AudioFile as AudioFileIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import TranscriptionDialog from '../components/TranscriptionDialog';

export default function Documents() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcriptionDialogOpen, setTranscriptionDialogOpen] = useState(false);
  const [selectedDocForTranscription, setSelectedDocForTranscription] = useState(null);
  const [formData, setFormData] = useState({
    titre: '',
    description: '',
    type: 'manuel',
    entity_type: '',
    entity_id: '',
  });
  const [error, setError] = useState('');

  const { data: response, isLoading } = useQuery('documents', async () => {
    const response = await axios.get('/api/documents');
    return response.data;
  });

  const uploadMutation = useMutation(
    async (data) => {
      const formDataToSend = new FormData();
      formDataToSend.append('file', data.file);
      formDataToSend.append('titre', data.titre);
      formDataToSend.append('description', data.description);
      formDataToSend.append('type', data.type);
      if (data.entity_type) formDataToSend.append('entity_type', data.entity_type);
      if (data.entity_id) formDataToSend.append('entity_id', data.entity_id);

      return axios.post('/api/documents/upload', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documents');
        handleClose();
      },
      onError: (err) => {
        setError(err.response?.data?.error || 'Erreur lors de l\'upload');
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/documents/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documents');
      },
    }
  );

  const handleOpen = () => {
    setFormData({
      titre: '',
      description: '',
      type: 'manuel',
      entity_type: '',
      entity_id: '',
    });
    setSelectedFile(null);
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedFile(null);
    setError('');
  };

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Veuillez sélectionner un fichier');
      return;
    }
    uploadMutation.mutate({ ...formData, file: selectedFile });
  };

  const handleDownload = async (id, filename) => {
    try {
      const response = await axios.get(`/api/documents/${id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleTranscriptionRequest = (doc) => {
    setSelectedDocForTranscription(doc);
    setTranscriptionDialogOpen(true);
  };

  const handleTranscriptionRequested = () => {
    queryClient.invalidateQueries('documents');
    setTranscriptionDialogOpen(false);
    setSelectedDocForTranscription(null);
  };

  const isAudioFile = (mimeType) => {
    return mimeType && mimeType.startsWith('audio/');
  };

  const getTranscriptionStatusIcon = (doc) => {
    if (!isAudioFile(doc.type_mime)) return null;
    
    if (doc.transcription_status === 'completed' || doc.has_transcript > 0) {
      return (
        <Tooltip title="Transcription terminée">
          <CheckCircleIcon color="success" fontSize="small" />
        </Tooltip>
      );
    } else if (doc.transcription_status === 'processing') {
      return (
        <Tooltip title="Transcription en cours">
          <PendingIcon color="info" fontSize="small" />
        </Tooltip>
      );
    } else if (doc.transcription_status === 'failed') {
      return (
        <Tooltip title="Transcription échouée">
          <ErrorIcon color="error" fontSize="small" />
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title="Cliquez pour transcrire ce fichier audio">
          <AudioFileIcon color="primary" fontSize="small" />
        </Tooltip>
      );
    }
  };

  if (isLoading) return <CircularProgress />;

  const documents = response?.data || [];

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getTypeColor = (type) => {
    const colors = {
      manuel: 'primary',
      photo: 'secondary',
      rapport: 'success',
      certificat: 'warning',
      facture: 'error',
    };
    return colors[type] || 'default';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Documents</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpen}
        >
          Uploader un document
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Titre</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Fichier</TableCell>
              <TableCell>Taille</TableCell>
              <TableCell>Uploadé le</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Aucun document. Cliquez sur "Uploader un document" pour commencer.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getTranscriptionStatusIcon(doc)}
                      <Box>
                        <Typography variant="body2">{doc.titre}</Typography>
                        {doc.description && (
                          <Typography variant="caption" color="textSecondary">
                            {doc.description}
                          </Typography>
                        )}
                        {doc.source_audio_id && (
                          <Chip 
                            label="Transcription" 
                            size="small" 
                            color="info" 
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={doc.type} size="small" color={getTypeColor(doc.type)} />
                  </TableCell>
                  <TableCell>{doc.nom_fichier}</TableCell>
                  <TableCell>{formatFileSize(doc.taille)}</TableCell>
                  <TableCell>
                    {doc.created_at && format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell align="right">
                    {isAudioFile(doc.type_mime) && !doc.transcription_status && (
                      <Tooltip title="Transcrire ce fichier audio">
                        <IconButton
                          size="small"
                          onClick={() => handleTranscriptionRequest(doc)}
                          color="primary"
                        >
                          <TranscribeIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(doc.id, doc.nom_fichier)}
                      color="primary"
                    >
                      <DownloadIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(doc.id)}
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
          <DialogTitle>Uploader un document</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Button
              variant="outlined"
              component="label"
              fullWidth
              startIcon={<CloudUploadIcon />}
              sx={{ mt: 2, mb: 2, py: 2 }}
            >
              {selectedFile ? selectedFile.name : 'Choisir un fichier'}
              <input type="file" hidden onChange={handleFileChange} />
            </Button>
            <TextField
              fullWidth
              label="Titre"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              margin="normal"
            />
            <TextField
              fullWidth
              select
              label="Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              SelectProps={{ native: true }}
              margin="normal"
            >
              <option value="manuel">Manuel</option>
              <option value="photo">Photo</option>
              <option value="rapport">Rapport</option>
              <option value="certificat">Certificat</option>
              <option value="facture">Facture</option>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Annuler</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={uploadMutation.isLoading || !selectedFile}
            >
              Uploader
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Transcription Dialog */}
      {selectedDocForTranscription && (
        <TranscriptionDialog
          open={transcriptionDialogOpen}
          onClose={() => {
            setTranscriptionDialogOpen(false);
            setSelectedDocForTranscription(null);
          }}
          document={selectedDocForTranscription}
          onTranscriptionRequested={handleTranscriptionRequested}
        />
      )}
    </Box>
  );
}

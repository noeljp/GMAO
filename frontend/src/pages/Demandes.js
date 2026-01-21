import React from 'react';
import { useQuery } from 'react-query';
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
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Demandes() {
  const { data: response, isLoading, error } = useQuery('demandes', async () => {
    const response = await axios.get('/api/demandes');
    return response.data;
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Typography color="error">Erreur lors du chargement des demandes</Typography>;

  const demandes = response?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Demandes d'intervention</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Nouvelle demande
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Titre</TableCell>
              <TableCell>Actif</TableCell>
              <TableCell>Demandeur</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Priorité</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Créée le</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {demandes?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Aucune demande disponible
                </TableCell>
              </TableRow>
            ) : (
              demandes?.map((demande) => (
                <TableRow key={demande.id}>
                  <TableCell>{demande.titre}</TableCell>
                  <TableCell>{demande.actif_code}</TableCell>
                  <TableCell>{demande.demandeur_nom}</TableCell>
                  <TableCell>{demande.type}</TableCell>
                  <TableCell>{demande.priorite}</TableCell>
                  <TableCell>
                    <Chip label={demande.statut} size="small" color="warning" />
                  </TableCell>
                  <TableCell>
                    {demande.created_at && format(new Date(demande.created_at), 'dd/MM/yyyy', { locale: fr })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

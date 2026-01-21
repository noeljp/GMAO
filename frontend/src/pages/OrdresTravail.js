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

const getStatutColor = (statut) => {
  const colors = {
    'planifie': 'info',
    'en_cours': 'warning',
    'termine': 'success',
    'annule': 'error',
  };
  return colors[statut] || 'default';
};

export default function OrdresTravail() {
  const { data: response, isLoading, error } = useQuery('ordres-travail', async () => {
    const response = await axios.get('/api/ordres-travail');
    return response.data;
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Typography color="error">Erreur lors du chargement des ordres de travail</Typography>;

  const ordres = response?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Ordres de travail</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Nouvel OT
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Titre</TableCell>
              <TableCell>Actif</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Priorité</TableCell>
              <TableCell>Technicien</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Créé le</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ordres?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Aucun ordre de travail disponible
                </TableCell>
              </TableRow>
            ) : (
              ordres?.map((ordre) => (
                <TableRow key={ordre.id}>
                  <TableCell>{ordre.titre}</TableCell>
                  <TableCell>{ordre.actif_code}</TableCell>
                  <TableCell>{ordre.type}</TableCell>
                  <TableCell>{ordre.priorite}</TableCell>
                  <TableCell>{ordre.technicien_nom}</TableCell>
                  <TableCell>
                    <Chip 
                      label={ordre.statut} 
                      size="small" 
                      color={getStatutColor(ordre.statut)} 
                    />
                  </TableCell>
                  <TableCell>
                    {ordre.created_at && format(new Date(ordre.created_at), 'dd/MM/yyyy', { locale: fr })}
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

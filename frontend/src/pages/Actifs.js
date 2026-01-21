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

export default function Actifs() {
  const { data: response, isLoading, error } = useQuery('actifs', async () => {
    const response = await axios.get('/api/actifs');
    return response.data;
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Typography color="error">Erreur lors du chargement des actifs</Typography>;

  const actifs = response?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Actifs</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Nouvel actif
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Site</TableCell>
              <TableCell>Statut</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {actifs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Aucun actif disponible
                </TableCell>
              </TableRow>
            ) : (
              actifs?.map((actif) => (
                <TableRow key={actif.id}>
                  <TableCell>{actif.code_interne}</TableCell>
                  <TableCell>{actif.description}</TableCell>
                  <TableCell>{actif.type_nom}</TableCell>
                  <TableCell>{actif.site_nom}</TableCell>
                  <TableCell>
                    <Chip label={actif.statut_nom} size="small" color="primary" />
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

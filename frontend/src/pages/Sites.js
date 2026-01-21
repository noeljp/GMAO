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
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

export default function Sites() {
  const { data: response, isLoading, error } = useQuery('sites', async () => {
    const response = await axios.get('/api/sites');
    return response.data;
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Typography color="error">Erreur lors du chargement des sites</Typography>;

  const sites = response?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Sites</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Nouveau site
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Nom</TableCell>
              <TableCell>Adresse</TableCell>
              <TableCell>Timezone</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sites?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  Aucun site disponible
                </TableCell>
              </TableRow>
            ) : (
              sites?.map((site) => (
                <TableRow key={site.id}>
                  <TableCell>{site.code}</TableCell>
                  <TableCell>{site.nom}</TableCell>
                  <TableCell>{site.adresse}</TableCell>
                  <TableCell>{site.timezone}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

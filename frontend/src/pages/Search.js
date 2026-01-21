import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Inventory as InventoryIcon,
  Build as BuildIcon,
  RequestPage as RequestPageIcon,
  Description as DescriptionIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const { data: results, isLoading } = useQuery(
    ['search', searchTerm],
    async () => {
      if (searchTerm.length < 2) return null;
      const response = await axios.get(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      return response.data;
    },
    {
      enabled: searchTerm.length >= 2,
    }
  );

  const getIcon = (type) => {
    switch (type) {
      case 'actifs':
        return <InventoryIcon color="primary" />;
      case 'ordres_travail':
        return <BuildIcon color="warning" />;
      case 'demandes':
        return <RequestPageIcon color="error" />;
      case 'documents':
        return <DescriptionIcon color="info" />;
      default:
        return <SearchIcon />;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      actifs: 'Actifs',
      ordres_travail: 'Ordres de travail',
      demandes: 'Demandes',
      documents: 'Documents',
    };
    return labels[type] || type;
  };

  const handleNavigate = (type, id) => {
    switch (type) {
      case 'actifs':
        navigate(`/actifs/${id}`);
        break;
      case 'ordres_travail':
        navigate(`/ordres-travail/${id}`);
        break;
      case 'demandes':
        navigate(`/demandes/${id}`);
        break;
      case 'documents':
        navigate(`/documents/${id}`);
        break;
      default:
        break;
    }
  };

  const renderResults = () => {
    if (!searchTerm || searchTerm.length < 2) {
      return (
        <Typography color="textSecondary" sx={{ mt: 4, textAlign: 'center' }}>
          Entrez au moins 2 caractères pour rechercher
        </Typography>
      );
    }

    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (!results || results.total === 0) {
      return (
        <Typography color="textSecondary" sx={{ mt: 4, textAlign: 'center' }}>
          Aucun résultat trouvé pour "{searchTerm}"
        </Typography>
      );
    }

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {results.total} résultat{results.total > 1 ? 's' : ''} trouvé{results.total > 1 ? 's' : ''}
        </Typography>

        {Object.entries(results.results).map(([type, items]) => {
          if (!items || items.length === 0) return null;

          return (
            <Paper key={type} sx={{ mb: 3 }}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', display: 'flex', alignItems: 'center' }}>
                {getIcon(type)}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  {getTypeLabel(type)} ({items.length})
                </Typography>
              </Box>
              <List>
                {items.map((item, index) => (
                  <React.Fragment key={item.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      secondaryAction={
                        <IconButton edge="end" onClick={() => handleNavigate(type, item.id)}>
                          <ArrowForwardIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {item.titre || item.code_interne || item.nom}
                            {item.priorite && (
                              <Chip label={item.priorite} size="small" color="warning" />
                            )}
                            {item.statut && (
                              <Chip label={item.statut} size="small" color="info" />
                            )}
                          </Box>
                        }
                        secondary={item.description || item.snippet}
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          );
        })}
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Recherche
      </Typography>

      <TextField
        fullWidth
        placeholder="Rechercher dans actifs, ordres de travail, demandes, documents..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ mt: 2 }}
      />

      {renderResults()}
    </Box>
  );
}

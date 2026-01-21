import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PowerSettingsNew as PowerIcon,
  ExpandMore as ExpandMoreIcon,
  CloudQueue as CloudIcon,
  Subscriptions as SubscriptionsIcon,
  Link as LinkIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ConfigurationMQTT() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [openBrokerDialog, setOpenBrokerDialog] = useState(false);
  const [openSubDialog, setOpenSubDialog] = useState(false);
  const [openMappingDialog, setOpenMappingDialog] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [brokerForm, setBrokerForm] = useState({
    nom: '',
    host: '',
    port: 1883,
    protocol: 'mqtt',
    username: '',
    password: '',
    client_id: '',
  });
  const [subForm, setSubForm] = useState({
    broker_id: '',
    topic: '',
    qos: 0,
    description: '',
  });
  const [mappingForm, setMappingForm] = useState({
    subscription_id: '',
    actif_id: '',
    champ_definition_id: '',
    champ_standard: '',
    json_path: '',
    transformation: 'none',
    factor: 1,
  });

  // Queries
  const { data: brokersData, isLoading: loadingBrokers } = useQuery('mqtt-brokers', async () => {
    const res = await axios.get('/api/mqtt/brokers');
    return res.data;
  });

  const { data: statusData } = useQuery('mqtt-status', async () => {
    const res = await axios.get('/api/mqtt/status');
    return res.data;
  }, { refetchInterval: 5000 });

  const { data: messagesData } = useQuery('mqtt-messages', async () => {
    const res = await axios.get('/api/mqtt/messages?limit=50');
    return res.data;
  }, { refetchInterval: 10000 });

  const { data: actifsData } = useQuery('actifs-list', async () => {
    const res = await axios.get('/api/actifs');
    return res.data;
  });

  // Mutations
  const createBrokerMutation = useMutation(
    (data) => axios.post('/api/mqtt/brokers', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('mqtt-brokers');
        setOpenBrokerDialog(false);
        resetBrokerForm();
      },
    }
  );

  const updateBrokerMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/mqtt/brokers/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('mqtt-brokers');
        setOpenBrokerDialog(false);
        resetBrokerForm();
      },
    }
  );

  const deleteBrokerMutation = useMutation(
    (id) => axios.delete(`/api/mqtt/brokers/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('mqtt-brokers');
      },
    }
  );

  const connectBrokerMutation = useMutation(
    (id) => axios.post(`/api/mqtt/brokers/${id}/connect`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('mqtt-brokers');
        queryClient.invalidateQueries('mqtt-status');
      },
    }
  );

  const disconnectBrokerMutation = useMutation(
    (id) => axios.post(`/api/mqtt/brokers/${id}/disconnect`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('mqtt-brokers');
        queryClient.invalidateQueries('mqtt-status');
      },
    }
  );

  const createSubscriptionMutation = useMutation(
    (data) => axios.post('/api/mqtt/subscriptions', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('mqtt-brokers');
        setOpenSubDialog(false);
        resetSubForm();
      },
    }
  );

  const createMappingMutation = useMutation(
    (data) => axios.post('/api/mqtt/mappings', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('mqtt-brokers');
        setOpenMappingDialog(false);
        resetMappingForm();
      },
    }
  );

  // Handlers
  const resetBrokerForm = () => {
    setBrokerForm({
      nom: '',
      host: '',
      port: 1883,
      protocol: 'mqtt',
      username: '',
      password: '',
      client_id: '',
    });
    setSelectedBroker(null);
  };

  const resetSubForm = () => {
    setSubForm({
      broker_id: '',
      topic: '',
      qos: 0,
      description: '',
    });
  };

  const resetMappingForm = () => {
    setMappingForm({
      subscription_id: '',
      actif_id: '',
      champ_definition_id: '',
      champ_standard: '',
      json_path: '',
      transformation: 'none',
      factor: 1,
    });
  };

  const handleOpenBrokerDialog = (broker = null) => {
    if (broker) {
      setBrokerForm(broker);
      setSelectedBroker(broker);
    } else {
      resetBrokerForm();
    }
    setOpenBrokerDialog(true);
  };

  const handleSaveBroker = () => {
    if (selectedBroker) {
      updateBrokerMutation.mutate({ id: selectedBroker.id, data: brokerForm });
    } else {
      createBrokerMutation.mutate(brokerForm);
    }
  };

  const handleDeleteBroker = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce broker ?')) {
      deleteBrokerMutation.mutate(id);
    }
  };

  const handleToggleConnection = (broker) => {
    if (broker.is_connected) {
      disconnectBrokerMutation.mutate(broker.id);
    } else {
      connectBrokerMutation.mutate(broker.id);
    }
  };

  const handleOpenSubDialog = (brokerId) => {
    setSubForm({ ...subForm, broker_id: brokerId });
    setOpenSubDialog(true);
  };

  const handleSaveSubscription = () => {
    createSubscriptionMutation.mutate(subForm);
  };

  const handleOpenMappingDialog = (subscriptionId) => {
    setMappingForm({ ...mappingForm, subscription_id: subscriptionId });
    setOpenMappingDialog(true);
  };

  const handleSaveMapping = () => {
    createMappingMutation.mutate(mappingForm);
  };

  if (loadingBrokers) return <CircularProgress />;

  const brokers = brokersData?.data || [];
  const status = statusData?.data || [];
  const messages = messagesData?.data || [];
  const actifs = actifsData?.data || [];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">
          <CloudIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Configuration MQTT
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenBrokerDialog()}
        >
          Nouveau Broker
        </Button>
      </Box>

      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Brokers" icon={<CloudIcon />} iconPosition="start" />
        <Tab label="Status" icon={<PowerIcon />} iconPosition="start" />
        <Tab label="Messages" icon={<HistoryIcon />} iconPosition="start" />
      </Tabs>

      {/* TAB 1: Brokers */}
      {activeTab === 0 && (
        <Box>
          {brokers.map((broker) => (
            <BrokerCard
              key={broker.id}
              broker={broker}
              onEdit={handleOpenBrokerDialog}
              onDelete={handleDeleteBroker}
              onToggleConnection={handleToggleConnection}
              onAddSubscription={handleOpenSubDialog}
              onAddMapping={handleOpenMappingDialog}
            />
          ))}
        </Box>
      )}

      {/* TAB 2: Status */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Broker</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Subscriptions</TableCell>
                <TableCell>Mappings</TableCell>
                <TableCell>Messages/h</TableCell>
                <TableCell>Messages/24h</TableCell>
                <TableCell>Dernière connexion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {status.map((s) => (
                <TableRow key={s.broker_id}>
                  <TableCell>{s.broker_nom}</TableCell>
                  <TableCell>
                    <Chip
                      label={s.is_connected ? 'Connecté' : 'Déconnecté'}
                      color={s.is_connected ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{s.subscriptions_count}</TableCell>
                  <TableCell>{s.mappings_count}</TableCell>
                  <TableCell>{s.messages_last_hour}</TableCell>
                  <TableCell>{s.messages_last_day}</TableCell>
                  <TableCell>
                    {s.last_connection
                      ? format(new Date(s.last_connection), 'Pp', { locale: fr })
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* TAB 3: Messages */}
      {activeTab === 2 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date/Heure</TableCell>
                <TableCell>Broker</TableCell>
                <TableCell>Topic</TableCell>
                <TableCell>Payload</TableCell>
                <TableCell>Traité</TableCell>
                <TableCell>Actifs MAJ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {messages.map((msg) => (
                <TableRow key={msg.id}>
                  <TableCell>
                    {format(new Date(msg.received_at), 'Pp', { locale: fr })}
                  </TableCell>
                  <TableCell>{msg.broker_nom}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {msg.topic}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <code>{msg.payload}</code>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={msg.processed ? 'Oui' : 'Non'}
                      color={msg.processed ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{msg.actifs_updated}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog: Broker */}
      <Dialog open={openBrokerDialog} onClose={() => setOpenBrokerDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedBroker ? 'Modifier' : 'Nouveau'} Broker MQTT</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nom"
            value={brokerForm.nom}
            onChange={(e) => setBrokerForm({ ...brokerForm, nom: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Host"
            value={brokerForm.host}
            onChange={(e) => setBrokerForm({ ...brokerForm, host: e.target.value })}
            margin="normal"
            placeholder="mqtt.example.com"
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Port"
                type="number"
                value={brokerForm.port}
                onChange={(e) => setBrokerForm({ ...brokerForm, port: parseInt(e.target.value) })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Protocole</InputLabel>
                <Select
                  value={brokerForm.protocol}
                  onChange={(e) => setBrokerForm({ ...brokerForm, protocol: e.target.value })}
                >
                  <MenuItem value="mqtt">mqtt</MenuItem>
                  <MenuItem value="mqtts">mqtts</MenuItem>
                  <MenuItem value="ws">ws</MenuItem>
                  <MenuItem value="wss">wss</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <TextField
            fullWidth
            label="Username (optionnel)"
            value={brokerForm.username}
            onChange={(e) => setBrokerForm({ ...brokerForm, username: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Password (optionnel)"
            type="password"
            value={brokerForm.password}
            onChange={(e) => setBrokerForm({ ...brokerForm, password: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Client ID (optionnel)"
            value={brokerForm.client_id}
            onChange={(e) => setBrokerForm({ ...brokerForm, client_id: e.target.value })}
            margin="normal"
            helperText="Laissez vide pour génération automatique"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBrokerDialog(false)}>Annuler</Button>
          <Button onClick={handleSaveBroker} variant="contained">
            {selectedBroker ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Subscription */}
      <Dialog open={openSubDialog} onClose={() => setOpenSubDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle Souscription</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Wildcards MQTT:
            </Typography>
            <Typography variant="body2">
              <code>+</code> : Un niveau (ex: <code>sensors/+/temperature</code>)
            </Typography>
            <Typography variant="body2">
              <code>#</code> : Multi-niveaux (ex: <code>factory/#</code>)
            </Typography>
          </Alert>
          <TextField
            fullWidth
            label="Topic"
            value={subForm.topic}
            onChange={(e) => setSubForm({ ...subForm, topic: e.target.value })}
            margin="normal"
            placeholder="sensors/machine/+/counter"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>QoS</InputLabel>
            <Select
              value={subForm.qos}
              onChange={(e) => setSubForm({ ...subForm, qos: e.target.value })}
            >
              <MenuItem value={0}>0 - At most once</MenuItem>
              <MenuItem value={1}>1 - At least once</MenuItem>
              <MenuItem value={2}>2 - Exactly once</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Description"
            value={subForm.description}
            onChange={(e) => setSubForm({ ...subForm, description: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSubDialog(false)}>Annuler</Button>
          <Button onClick={handleSaveSubscription} variant="contained">
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Mapping */}
      <Dialog open={openMappingDialog} onClose={() => setOpenMappingDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Nouveau Mapping Actif</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
            Configurez comment extraire les données du payload JSON et les mapper vers un actif.
          </Alert>
          <FormControl fullWidth margin="normal">
            <InputLabel>Actif</InputLabel>
            <Select
              value={mappingForm.actif_id}
              onChange={(e) => setMappingForm({ ...mappingForm, actif_id: e.target.value })}
            >
              {actifs.map((actif) => (
                <MenuItem key={actif.id} value={actif.id}>
                  {actif.code_interne} - {actif.description || 'Sans description'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="JSON Path"
            value={mappingForm.json_path}
            onChange={(e) => setMappingForm({ ...mappingForm, json_path: e.target.value })}
            margin="normal"
            placeholder="$.data.counter ou $.temperature"
            helperText="Chemin JSONPath pour extraire la valeur du payload"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Transformation</InputLabel>
            <Select
              value={mappingForm.transformation}
              onChange={(e) => setMappingForm({ ...mappingForm, transformation: e.target.value })}
            >
              <MenuItem value="none">Aucune</MenuItem>
              <MenuItem value="multiply">Multiplier</MenuItem>
              <MenuItem value="divide">Diviser</MenuItem>
              <MenuItem value="round">Arrondir</MenuItem>
              <MenuItem value="floor">Floor</MenuItem>
              <MenuItem value="ceil">Ceil</MenuItem>
            </Select>
          </FormControl>
          {['multiply', 'divide'].includes(mappingForm.transformation) && (
            <TextField
              fullWidth
              label="Facteur"
              type="number"
              value={mappingForm.factor}
              onChange={(e) => setMappingForm({ ...mappingForm, factor: parseFloat(e.target.value) })}
              margin="normal"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMappingDialog(false)}>Annuler</Button>
          <Button onClick={handleSaveMapping} variant="contained">
            Créer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Composant BrokerCard
function BrokerCard({ broker, onEdit, onDelete, onToggleConnection, onAddSubscription, onAddMapping }) {
  const queryClient = useQueryClient();

  const { data: subscriptionsData } = useQuery(
    ['mqtt-subscriptions', broker.id],
    async () => {
      const res = await axios.get(`/api/mqtt/brokers/${broker.id}/subscriptions`);
      return res.data;
    }
  );

  const subscriptions = subscriptionsData?.data || [];

  return (
    <Accordion sx={{ mb: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <CloudIcon sx={{ mr: 2, color: broker.is_connected ? 'success.main' : 'grey.400' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{broker.nom}</Typography>
            <Typography variant="body2" color="text.secondary">
              {broker.protocol}://{broker.host}:{broker.port}
            </Typography>
          </Box>
          <Chip
            label={broker.is_connected ? 'Connecté' : 'Déconnecté'}
            color={broker.is_connected ? 'success' : 'default'}
            size="small"
            sx={{ mr: 2 }}
          />
          <Chip
            label={`${broker.subscriptions_count} souscriptions`}
            size="small"
            sx={{ mr: 2 }}
          />
          <Chip
            label={`${broker.mappings_count} mappings`}
            size="small"
            sx={{ mr: 2 }}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PowerIcon />}
            onClick={() => onToggleConnection(broker)}
          >
            {broker.is_connected ? 'Déconnecter' : 'Connecter'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SubscriptionsIcon />}
            onClick={() => onAddSubscription(broker.id)}
          >
            Ajouter Topic
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => onEdit(broker)}
          >
            Modifier
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => onDelete(broker.id)}
          >
            Supprimer
          </Button>
        </Box>

        {subscriptions.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Topic</TableCell>
                  <TableCell>QoS</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Mappings</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{sub.topic}</TableCell>
                    <TableCell>{sub.qos}</TableCell>
                    <TableCell>{sub.description || '-'}</TableCell>
                    <TableCell>{sub.mappings_count}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => onAddMapping(sub.id)}>
                        <LinkIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

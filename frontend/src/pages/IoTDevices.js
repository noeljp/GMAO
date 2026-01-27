import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sensors as SensorsIcon,
  Router as RouterIcon,
  Memory as MemoryIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  ErrorOutline as ErrorIcon,
  CheckCircleOutline as CheckIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function IoTDevices() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [openDeviceDialog, setOpenDeviceDialog] = useState(false);
  const [openParameterDialog, setOpenParameterDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedDeviceForParams, setSelectedDeviceForParams] = useState(null);
  const [deviceForm, setDeviceForm] = useState({
    nom: '',
    identifiant_unique: '',
    device_type_id: '',
    actif_id: '',
    mqtt_broker_id: '',
    mqtt_topic_base: '',
    fabricant: '',
    modele: '',
    version_firmware: '',
    date_installation: '',
    statut: 'actif',
    notes: '',
  });
  const [parameterForm, setParameterForm] = useState({
    parameter_id: '',
    champ_definition_id: '',
    champ_standard: '',
    mqtt_topic_suffix: '',
    json_path: '$.value',
    transformation: 'none',
    factor: 1,
    seuil_min: '',
    seuil_max: '',
    frequence_lecture: '',
  });

  // Queries
  const { data: devicesData, isLoading: loadingDevices } = useQuery('iot-devices', async () => {
    const res = await axios.get('/api/iot-devices');
    return res.data;
  });

  const { data: typesData } = useQuery('iot-device-types', async () => {
    const res = await axios.get('/api/iot-devices/types');
    return res.data;
  });

  const { data: actifsData } = useQuery('actifs-list', async () => {
    const res = await axios.get('/api/actifs');
    return res.data;
  });

  const { data: brokersData } = useQuery('mqtt-brokers', async () => {
    const res = await axios.get('/api/mqtt/brokers');
    return res.data;
  });

  const { data: statsData } = useQuery('iot-stats', async () => {
    const res = await axios.get('/api/iot-devices/stats/overview');
    return res.data;
  }, { refetchInterval: 30000 });

  // Parameters for a specific device
  const { data: parametersData } = useQuery(
    ['device-parameters', selectedDeviceForParams?.id],
    async () => {
      if (!selectedDeviceForParams?.id) return null;
      const res = await axios.get(`/api/iot-devices/types/${selectedDeviceForParams.device_type_id}/parameters`);
      return res.data;
    },
    { enabled: !!selectedDeviceForParams?.id }
  );

  // Parameter configs for a specific device
  const { data: parameterConfigsData } = useQuery(
    ['device-parameter-configs', selectedDeviceForParams?.id],
    async () => {
      if (!selectedDeviceForParams?.id) return null;
      const res = await axios.get(`/api/iot-devices/${selectedDeviceForParams.id}/parameter-configs`);
      return res.data;
    },
    { enabled: !!selectedDeviceForParams?.id }
  );

  // Latest values for a specific device
  const { data: latestValuesData } = useQuery(
    ['device-latest-values', selectedDeviceForParams?.id],
    async () => {
      if (!selectedDeviceForParams?.id) return null;
      const res = await axios.get(`/api/iot-devices/${selectedDeviceForParams.id}/latest-values`);
      return res.data;
    },
    { enabled: !!selectedDeviceForParams?.id, refetchInterval: 10000 }
  );

  // Mutations
  const createDeviceMutation = useMutation(
    async (data) => await axios.post('/api/iot-devices', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('iot-devices');
        queryClient.invalidateQueries('iot-stats');
        setOpenDeviceDialog(false);
        resetDeviceForm();
      }
    }
  );

  const updateDeviceMutation = useMutation(
    async ({ id, data }) => await axios.patch(`/api/iot-devices/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('iot-devices');
        setOpenDeviceDialog(false);
        setSelectedDevice(null);
        resetDeviceForm();
      }
    }
  );

  const deleteDeviceMutation = useMutation(
    async (id) => await axios.delete(`/api/iot-devices/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('iot-devices');
        queryClient.invalidateQueries('iot-stats');
      }
    }
  );

  const saveParameterConfigMutation = useMutation(
    async ({ deviceId, data }) => await axios.post(`/api/iot-devices/${deviceId}/parameter-configs`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['device-parameter-configs', selectedDeviceForParams?.id]);
        setOpenParameterDialog(false);
        resetParameterForm();
      }
    }
  );

  // Handlers
  const resetDeviceForm = () => {
    setDeviceForm({
      nom: '',
      identifiant_unique: '',
      device_type_id: '',
      actif_id: '',
      mqtt_broker_id: '',
      mqtt_topic_base: '',
      fabricant: '',
      modele: '',
      version_firmware: '',
      date_installation: '',
      statut: 'actif',
      notes: '',
    });
  };

  const resetParameterForm = () => {
    setParameterForm({
      parameter_id: '',
      champ_definition_id: '',
      champ_standard: '',
      mqtt_topic_suffix: '',
      json_path: '$.value',
      transformation: 'none',
      factor: 1,
      seuil_min: '',
      seuil_max: '',
      frequence_lecture: '',
    });
  };

  const handleOpenCreateDevice = () => {
    resetDeviceForm();
    setSelectedDevice(null);
    setOpenDeviceDialog(true);
  };

  const handleOpenEditDevice = (device) => {
    setSelectedDevice(device);
    setDeviceForm({
      nom: device.nom || '',
      identifiant_unique: device.identifiant_unique || '',
      device_type_id: device.device_type_id || '',
      actif_id: device.actif_id || '',
      mqtt_broker_id: device.mqtt_broker_id || '',
      mqtt_topic_base: device.mqtt_topic_base || '',
      fabricant: device.fabricant || '',
      modele: device.modele || '',
      version_firmware: device.version_firmware || '',
      date_installation: device.date_installation || '',
      statut: device.statut || 'actif',
      notes: device.notes || '',
    });
    setOpenDeviceDialog(true);
  };

  const handleSaveDevice = () => {
    if (selectedDevice) {
      updateDeviceMutation.mutate({ id: selectedDevice.id, data: deviceForm });
    } else {
      createDeviceMutation.mutate(deviceForm);
    }
  };

  const handleDeleteDevice = (device) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le dispositif "${device.nom}" ?`)) {
      deleteDeviceMutation.mutate(device.id);
    }
  };

  const handleOpenParameterConfig = (device) => {
    setSelectedDeviceForParams(device);
    setActiveTab(1);
  };

  const handleSaveParameterConfig = () => {
    saveParameterConfigMutation.mutate({
      deviceId: selectedDeviceForParams.id,
      data: parameterForm
    });
  };

  const getStatusColor = (statut) => {
    switch (statut) {
      case 'actif': return 'success';
      case 'inactif': return 'default';
      case 'maintenance': return 'warning';
      case 'erreur': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (statut) => {
    switch (statut) {
      case 'actif': return <CheckIcon fontSize="small" />;
      case 'erreur': return <ErrorIcon fontSize="small" />;
      default: return null;
    }
  };

  if (loadingDevices) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          <SensorsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Gestion des Dispositifs IoT
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateDevice}
        >
          Nouveau Dispositif
        </Button>
      </Box>

      {/* Statistics Cards */}
      {statsData && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Dispositifs
                </Typography>
                <Typography variant="h4">
                  {statsData.overview.total_devices}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Actifs
                </Typography>
                <Typography variant="h4" color="success.main">
                  {statsData.overview.active_devices}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  En Ligne
                </Typography>
                <Typography variant="h4" color="primary.main">
                  {statsData.overview.online_devices}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Erreurs
                </Typography>
                <Typography variant="h4" color="error.main">
                  {statsData.overview.error_devices}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Content */}
      <Paper sx={{ width: '100%' }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="Liste des Dispositifs" />
          {selectedDeviceForParams && (
            <Tab label={`Configuration - ${selectedDeviceForParams.nom}`} />
          )}
        </Tabs>

        {/* Tab 0: Devices List */}
        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nom</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Machine</TableCell>
                    <TableCell>Identifiant</TableCell>
                    <TableCell>Broker MQTT</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell>Dernière Communication</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {devicesData?.data?.map((device) => (
                    <TableRow key={device.id} hover>
                      <TableCell>{device.nom}</TableCell>
                      <TableCell>{device.device_type_nom}</TableCell>
                      <TableCell>
                        {device.actif_code}
                        {device.actif_description && (
                          <Typography variant="caption" display="block" color="textSecondary">
                            {device.actif_description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {device.identifiant_unique}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {device.broker_nom ? (
                          <Chip
                            label={device.broker_nom}
                            size="small"
                            color={device.broker_connected ? 'success' : 'default'}
                            icon={<RouterIcon />}
                          />
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            Non configuré
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={device.statut}
                          size="small"
                          color={getStatusColor(device.statut)}
                          icon={getStatusIcon(device.statut)}
                        />
                      </TableCell>
                      <TableCell>
                        {device.date_derniere_communication ? (
                          <Typography variant="body2">
                            {format(new Date(device.date_derniere_communication), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            Jamais
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Configurer les paramètres">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenParameterConfig(device)}
                            color="primary"
                          >
                            <SettingsIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Modifier">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEditDevice(device)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteDevice(device)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {devicesData?.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography variant="body2" color="textSecondary" sx={{ py: 3 }}>
                          Aucun dispositif IoT trouvé. Créez-en un pour commencer.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Tab 1: Device Configuration */}
        {activeTab === 1 && selectedDeviceForParams && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Configuration des Paramètres - {selectedDeviceForParams.nom}
            </Typography>
            
            <Grid container spacing={3}>
              {/* Device Info */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Informations du Dispositif
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">Type:</Typography>
                        <Typography variant="body1">{selectedDeviceForParams.device_type_nom}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">Machine:</Typography>
                        <Typography variant="body1">{selectedDeviceForParams.actif_code}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">Topic MQTT:</Typography>
                        <Typography variant="body2" fontFamily="monospace">
                          {selectedDeviceForParams.mqtt_topic_base || 'Non configuré'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">Paramètres Configurés:</Typography>
                        <Typography variant="body1">{selectedDeviceForParams.parameters_count || 0}</Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Latest Values */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Dernières Valeurs
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    {latestValuesData?.data?.length > 0 ? (
                      latestValuesData.data.map((value) => (
                        <Box key={value.parameter_id} sx={{ mb: 1 }}>
                          <Typography variant="body2" color="textSecondary">
                            {value.parameter_libelle}:
                          </Typography>
                          <Typography variant="h6">
                            {value.valeur_number !== null && `${value.valeur_number} ${value.unite || ''}`}
                            {value.valeur_boolean !== null && (value.valeur_boolean ? 'Oui' : 'Non')}
                            {value.valeur_text !== null && value.valeur_text}
                            {value.valeur_date !== null && format(new Date(value.valeur_date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {format(new Date(value.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                          </Typography>
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        Aucune valeur disponible
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Parameter Configurations */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Configuration des Paramètres
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      resetParameterForm();
                      setOpenParameterDialog(true);
                    }}
                  >
                    Ajouter un Paramètre
                  </Button>
                </Box>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Paramètre</TableCell>
                        <TableCell>Topic MQTT</TableCell>
                        <TableCell>JSONPath</TableCell>
                        <TableCell>Transformation</TableCell>
                        <TableCell>Seuils</TableCell>
                        <TableCell>Actif</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {parameterConfigsData?.data?.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {config.parameter_libelle}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {config.type_donnee} {config.unite && `(${config.unite})`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {selectedDeviceForParams.mqtt_topic_base}
                              {config.mqtt_topic_suffix}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {config.json_path}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {config.transformation !== 'none' && (
                              <Chip
                                label={`${config.transformation} (${config.factor})`}
                                size="small"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {(config.seuil_min || config.seuil_max) && (
                              <Typography variant="caption">
                                Min: {config.seuil_min || 'N/A'} / Max: {config.seuil_max || 'N/A'}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={config.is_active ? 'Actif' : 'Inactif'}
                              size="small"
                              color={config.is_active ? 'success' : 'default'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!parameterConfigsData?.data || parameterConfigsData.data.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography variant="body2" color="textSecondary" sx={{ py: 2 }}>
                              Aucun paramètre configuré. Cliquez sur "Ajouter un Paramètre" pour commencer.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Device Dialog */}
      <Dialog open={openDeviceDialog} onClose={() => setOpenDeviceDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedDevice ? 'Modifier le Dispositif IoT' : 'Nouveau Dispositif IoT'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nom du Dispositif"
                value={deviceForm.nom}
                onChange={(e) => setDeviceForm({ ...deviceForm, nom: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Identifiant Unique"
                value={deviceForm.identifiant_unique}
                onChange={(e) => setDeviceForm({ ...deviceForm, identifiant_unique: e.target.value })}
                required
                helperText="Ex: serial number, MAC address"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Type de Dispositif</InputLabel>
                <Select
                  value={deviceForm.device_type_id}
                  onChange={(e) => setDeviceForm({ ...deviceForm, device_type_id: e.target.value })}
                  label="Type de Dispositif"
                >
                  {typesData?.data?.map((type) => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.nom}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Machine Associée</InputLabel>
                <Select
                  value={deviceForm.actif_id}
                  onChange={(e) => setDeviceForm({ ...deviceForm, actif_id: e.target.value })}
                  label="Machine Associée"
                >
                  {actifsData?.data?.map((actif) => (
                    <MenuItem key={actif.id} value={actif.id}>
                      {actif.code_interne} - {actif.description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Broker MQTT</InputLabel>
                <Select
                  value={deviceForm.mqtt_broker_id}
                  onChange={(e) => setDeviceForm({ ...deviceForm, mqtt_broker_id: e.target.value })}
                  label="Broker MQTT"
                >
                  <MenuItem value="">
                    <em>Aucun</em>
                  </MenuItem>
                  {brokersData?.data?.map((broker) => (
                    <MenuItem key={broker.id} value={broker.id}>
                      {broker.nom}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Topic MQTT de Base"
                value={deviceForm.mqtt_topic_base}
                onChange={(e) => setDeviceForm({ ...deviceForm, mqtt_topic_base: e.target.value })}
                helperText="Ex: factory/machine/M001"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Fabricant"
                value={deviceForm.fabricant}
                onChange={(e) => setDeviceForm({ ...deviceForm, fabricant: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Modèle"
                value={deviceForm.modele}
                onChange={(e) => setDeviceForm({ ...deviceForm, modele: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Version Firmware"
                value={deviceForm.version_firmware}
                onChange={(e) => setDeviceForm({ ...deviceForm, version_firmware: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date d'Installation"
                type="date"
                value={deviceForm.date_installation}
                onChange={(e) => setDeviceForm({ ...deviceForm, date_installation: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Statut</InputLabel>
                <Select
                  value={deviceForm.statut}
                  onChange={(e) => setDeviceForm({ ...deviceForm, statut: e.target.value })}
                  label="Statut"
                >
                  <MenuItem value="actif">Actif</MenuItem>
                  <MenuItem value="inactif">Inactif</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="erreur">Erreur</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={deviceForm.notes}
                onChange={(e) => setDeviceForm({ ...deviceForm, notes: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeviceDialog(false)}>Annuler</Button>
          <Button
            onClick={handleSaveDevice}
            variant="contained"
            disabled={
              !deviceForm.nom ||
              !deviceForm.identifiant_unique ||
              !deviceForm.device_type_id ||
              !deviceForm.actif_id
            }
          >
            {selectedDevice ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Parameter Configuration Dialog */}
      <Dialog open={openParameterDialog} onClose={() => setOpenParameterDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Configurer un Paramètre</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Paramètre</InputLabel>
                <Select
                  value={parameterForm.parameter_id}
                  onChange={(e) => setParameterForm({ ...parameterForm, parameter_id: e.target.value })}
                  label="Paramètre"
                >
                  {parametersData?.data?.map((param) => (
                    <MenuItem key={param.id} value={param.id}>
                      {param.libelle} ({param.type_donnee} {param.unite && `- ${param.unite}`})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Suffixe du Topic MQTT"
                value={parameterForm.mqtt_topic_suffix}
                onChange={(e) => setParameterForm({ ...parameterForm, mqtt_topic_suffix: e.target.value })}
                helperText="Ex: /temperature, /status"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="JSONPath"
                value={parameterForm.json_path}
                onChange={(e) => setParameterForm({ ...parameterForm, json_path: e.target.value })}
                helperText="Ex: $.value, $.data.temperature"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Transformation</InputLabel>
                <Select
                  value={parameterForm.transformation}
                  onChange={(e) => setParameterForm({ ...parameterForm, transformation: e.target.value })}
                  label="Transformation"
                >
                  <MenuItem value="none">Aucune</MenuItem>
                  <MenuItem value="multiply">Multiplier</MenuItem>
                  <MenuItem value="divide">Diviser</MenuItem>
                  <MenuItem value="round">Arrondir</MenuItem>
                  <MenuItem value="floor">Floor</MenuItem>
                  <MenuItem value="ceil">Ceil</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Facteur"
                type="number"
                value={parameterForm.factor}
                onChange={(e) => setParameterForm({ ...parameterForm, factor: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Seuil Minimum"
                type="number"
                value={parameterForm.seuil_min}
                onChange={(e) => setParameterForm({ ...parameterForm, seuil_min: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Seuil Maximum"
                type="number"
                value={parameterForm.seuil_max}
                onChange={(e) => setParameterForm({ ...parameterForm, seuil_max: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Fréquence de Lecture (secondes)"
                type="number"
                value={parameterForm.frequence_lecture}
                onChange={(e) => setParameterForm({ ...parameterForm, frequence_lecture: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenParameterDialog(false)}>Annuler</Button>
          <Button
            onClick={handleSaveParameterConfig}
            variant="contained"
            disabled={!parameterForm.parameter_id}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

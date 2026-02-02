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
  LinearProgress,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sensors as SensorsIcon,
  Router as RouterIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as OnlineIcon,
  Cancel as OfflineIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function APRU40Dashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [openGatewayDialog, setOpenGatewayDialog] = useState(false);
  const [openNodeDialog, setOpenNodeDialog] = useState(false);
  const [openAlertDialog, setOpenAlertDialog] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [gatewayForm, setGatewayForm] = useState({
    gateway_id: '',
    gateway_name: '',
    mac_address: '',
    ip_address: '',
    mqtt_client_id: '',
    mqtt_broker_id: '',
    cert_expiry: '',
    firmware_version: '',
    site_id: '',
    location: '',
    notes: '',
  });

  const [nodeForm, setNodeForm] = useState({
    node_id: '',
    nom: '',
    gateway_id: '',
    identifiant_unique: '',
    bt_scanner_mac: '',
    bt_pin: '',
    deployed_date: '',
    deployed_by: '',
    location: '',
    seal_number: '',
    notes: '',
  });

  // Queries
  const { data: statsData, isLoading: loadingStats } = useQuery('apru40-stats', async () => {
    const res = await axios.get('/api/apru40/stats/overview');
    return res.data;
  }, { refetchInterval: 5000 }); // Rafraîchir toutes les 5 secondes

  const { data: gatewaysData, isLoading: loadingGateways } = useQuery('apru40-gateways', async () => {
    const res = await axios.get('/api/apru40/gateways');
    return res.data;
  }, { refetchInterval: 10000 });

  const { data: nodesData, isLoading: loadingNodes } = useQuery('apru40-nodes', async () => {
    const res = await axios.get('/api/apru40/nodes');
    return res.data;
  }, { refetchInterval: 5000 });

  const { data: alertsData, isLoading: loadingAlerts } = useQuery('apru40-alerts', async () => {
    const res = await axios.get('/api/apru40/alerts?status=nouveau,en_cours');
    return res.data;
  }, { refetchInterval: 10000 });

  const { data: sitesData } = useQuery('sites-list', async () => {
    const res = await axios.get('/api/sites');
    return res.data;
  });

  // Mutations
  const createGatewayMutation = useMutation(
    (data) => axios.post('/api/apru40/gateways', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('apru40-gateways');
        queryClient.invalidateQueries('apru40-stats');
        setOpenGatewayDialog(false);
        resetGatewayForm();
      },
    }
  );

  const updateGatewayMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/apru40/gateways/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('apru40-gateways');
        queryClient.invalidateQueries('apru40-stats');
        setOpenGatewayDialog(false);
        setSelectedGateway(null);
        resetGatewayForm();
      },
    }
  );

  const deleteGatewayMutation = useMutation(
    (id) => axios.delete(`/api/apru40/gateways/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('apru40-gateways');
        queryClient.invalidateQueries('apru40-stats');
      },
    }
  );

  const updateNodeMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/apru40/nodes/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('apru40-nodes');
        queryClient.invalidateQueries('apru40-stats');
        setOpenNodeDialog(false);
        setSelectedNode(null);
        resetNodeForm();
      },
    }
  );

  const regeneratePinMutation = useMutation(
    (id) => axios.post(`/api/apru40/nodes/${id}/regenerate-pin`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('apru40-nodes');
        setSnackbar({ open: true, message: 'PIN régénéré avec succès', severity: 'success' });
      },
      onError: (error) => {
        setSnackbar({ 
          open: true, 
          message: error?.response?.data?.message || 'Erreur lors de la régénération du PIN', 
          severity: 'error' 
        });
      },
    }
  );

  const updateAlertMutation = useMutation(
    ({ id, data }) => axios.patch(`/api/apru40/alerts/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('apru40-alerts');
        queryClient.invalidateQueries('apru40-stats');
        setOpenAlertDialog(false);
        setSelectedAlert(null);
      },
    }
  );

  // Helper functions
  const resetGatewayForm = () => {
    setGatewayForm({
      gateway_id: '',
      gateway_name: '',
      mac_address: '',
      ip_address: '',
      mqtt_client_id: '',
      mqtt_broker_id: '',
      cert_expiry: '',
      firmware_version: '',
      site_id: '',
      location: '',
      notes: '',
    });
  };

  const resetNodeForm = () => {
    setNodeForm({
      node_id: '',
      nom: '',
      gateway_id: '',
      identifiant_unique: '',
      bt_scanner_mac: '',
      bt_pin: '',
      deployed_date: '',
      deployed_by: '',
      location: '',
      seal_number: '',
      notes: '',
    });
  };

  const handleGatewayEdit = (gateway) => {
    setSelectedGateway(gateway);
    setGatewayForm({
      gateway_id: gateway.gateway_id || '',
      gateway_name: gateway.gateway_name || '',
      mac_address: gateway.mac_address || '',
      ip_address: gateway.ip_address || '',
      mqtt_client_id: gateway.mqtt_client_id || '',
      mqtt_broker_id: gateway.mqtt_broker_id || '',
      cert_expiry: gateway.cert_expiry || '',
      firmware_version: gateway.firmware_version || '',
      site_id: gateway.site_id || '',
      location: gateway.location || '',
      notes: gateway.notes || '',
    });
    setOpenGatewayDialog(true);
  };

  const handleNodeEdit = (node) => {
    setSelectedNode(node);
    setNodeForm({
      node_id: node.node_id || '',
      nom: node.node_name || '',
      gateway_id: node.gateway_id || '',
      identifiant_unique: node.mac_address || '',
      bt_scanner_mac: node.bt_scanner_mac || '',
      bt_pin: node.bt_pin || '',
      deployed_date: node.deployed_date || '',
      deployed_by: node.deployed_by || '',
      location: node.location || '',
      seal_number: node.seal_number || '',
      notes: node.notes || '',
    });
    setOpenNodeDialog(true);
  };

  const handleGatewaySubmit = () => {
    if (selectedGateway) {
      updateGatewayMutation.mutate({ id: selectedGateway.id, data: gatewayForm });
    } else {
      createGatewayMutation.mutate(gatewayForm);
    }
  };

  const handleNodeSubmit = () => {
    if (selectedNode) {
      updateNodeMutation.mutate({ id: selectedNode.node_uuid, data: nodeForm });
    }
  };

  const handleAlertResolve = () => {
    if (selectedAlert) {
      updateAlertMutation.mutate({
        id: selectedAlert.id,
        data: { status: 'resolu' },
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'offline':
        return 'error';
      case 'compromised':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <OnlineIcon />;
      case 'offline':
        return <OfflineIcon />;
      default:
        return <WarningIcon />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critique':
        return 'error';
      case 'haute':
        return 'warning';
      case 'moyenne':
        return 'info';
      default:
        return 'default';
    }
  };

  // Render Dashboard Overview
  const renderDashboard = () => (
    <Box>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Gateways Stats */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <RouterIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Gateways</Typography>
              </Box>
              <Typography variant="h3" color="primary">
                {statsData?.gateways?.online_gateways || 0} / {statsData?.gateways?.total_gateways || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                En ligne
              </Typography>
              {statsData?.gateways?.cert_expiring_soon > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {statsData.gateways.cert_expiring_soon} certificat(s) expirent bientôt
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Nodes Stats */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SensorsIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Nœuds</Typography>
              </Box>
              <Typography variant="h3" color="success.main">
                {statsData?.nodes?.online_nodes || 0} / {statsData?.nodes?.total_nodes || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                En ligne
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  ((statsData?.nodes?.online_nodes || 0) / (statsData?.nodes?.total_nodes || 1)) * 100
                }
                sx={{ mt: 2 }}
              />
              {statsData?.nodes?.compromised_nodes > 0 && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {statsData.nodes.compromised_nodes} nœud(s) compromis
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Alerts Stats */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Alertes</Typography>
              </Box>
              <Typography variant="h3" color="warning.main">
                {(statsData?.alerts?.new_alerts || 0) + (statsData?.alerts?.in_progress_alerts || 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Actives
              </Typography>
              {statsData?.alerts?.critical_alerts > 0 && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {statsData.alerts.critical_alerts} alerte(s) critiques
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Active Alerts */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          🚨 Alertes Actives
        </Typography>
        {loadingAlerts ? (
          <CircularProgress />
        ) : alertsData?.data?.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Priorité</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Titre</TableCell>
                  <TableCell>Dispositif</TableCell>
                  <TableCell>Détecté</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alertsData.data.slice(0, 5).map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <Chip label={alert.priority} color={getPriorityColor(alert.priority)} size="small" />
                    </TableCell>
                    <TableCell>{alert.alert_type}</TableCell>
                    <TableCell>{alert.title}</TableCell>
                    <TableCell>{alert.device_name || alert.gateway_name || '-'}</TableCell>
                    <TableCell>
                      {alert.detected_at
                        ? format(new Date(alert.detected_at), 'dd/MM/yyyy HH:mm', { locale: fr })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => {
                          setSelectedAlert(alert);
                          setOpenAlertDialog(true);
                        }}
                      >
                        Voir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography color="text.secondary">Aucune alerte active</Typography>
        )}
      </Paper>
    </Box>
  );

  // Render Gateways Tab
  const renderGateways = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h6">Gateways APRU40</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedGateway(null);
            resetGatewayForm();
            setOpenGatewayDialog(true);
          }}
        >
          Ajouter Gateway
        </Button>
      </Box>

      {loadingGateways ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Adresse MAC</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>Nœuds</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Dernière vue</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gatewaysData?.data?.map((gateway) => (
                <TableRow key={gateway.id}>
                  <TableCell>{gateway.gateway_id}</TableCell>
                  <TableCell>{gateway.gateway_name}</TableCell>
                  <TableCell>{gateway.mac_address}</TableCell>
                  <TableCell>{gateway.ip_address || '-'}</TableCell>
                  <TableCell>
                    {gateway.online_nodes || 0} / {gateway.actual_node_count || 0}
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(gateway.status)}
                      label={gateway.status}
                      color={getStatusColor(gateway.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {gateway.last_seen
                      ? format(new Date(gateway.last_seen), 'dd/MM/yyyy HH:mm', { locale: fr })
                      : 'Jamais'}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleGatewayEdit(gateway)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (window.confirm('Êtes-vous sûr de vouloir supprimer cette gateway ?')) {
                          deleteGatewayMutation.mutate(gateway.id);
                        }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );

  // Render Nodes Tab
  const renderNodes = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h6">Nœuds APRU40</Typography>
      </Box>

      {loadingNodes ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Gateway</TableCell>
                <TableCell>MAC</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Tamper</TableCell>
                <TableCell>Emplacement</TableCell>
                <TableCell>Dernière vue</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {nodesData?.data?.map((node) => (
                <TableRow key={node.node_uuid}>
                  <TableCell>{node.node_id}</TableCell>
                  <TableCell>{node.node_name}</TableCell>
                  <TableCell>{node.gateway_name || '-'}</TableCell>
                  <TableCell>{node.mac_address}</TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(node.status)}
                      label={node.status || 'inconnu'}
                      color={getStatusColor(node.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {node.tamper_count > 0 ? (
                      <Chip label={node.tamper_count} color="error" size="small" />
                    ) : (
                      <Chip label="0" color="success" size="small" />
                    )}
                  </TableCell>
                  <TableCell>{node.location || '-'}</TableCell>
                  <TableCell>
                    {node.last_seen
                      ? format(new Date(node.last_seen), 'dd/MM/yyyy HH:mm', { locale: fr })
                      : 'Jamais'}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Éditer">
                      <IconButton size="small" onClick={() => handleNodeEdit(node)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Régénérer PIN BT">
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (window.confirm('Régénérer le PIN Bluetooth ? Le re-pairing sera nécessaire.')) {
                            regeneratePinMutation.mutate(node.node_uuid);
                          }
                        }}
                      >
                        <SecurityIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📡 Réseau APRU40
      </Typography>

      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Dashboard" />
        <Tab label="Gateways" />
        <Tab label="Nœuds" />
        <Tab label="Alertes" />
      </Tabs>

      {activeTab === 0 && renderDashboard()}
      {activeTab === 1 && renderGateways()}
      {activeTab === 2 && renderNodes()}
      {activeTab === 3 && (
        <Typography color="text.secondary">Gestion détaillée des alertes (à implémenter)</Typography>
      )}

      {/* Gateway Dialog */}
      <Dialog open={openGatewayDialog} onClose={() => setOpenGatewayDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedGateway ? 'Modifier Gateway' : 'Nouvelle Gateway'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Gateway ID"
                type="number"
                value={gatewayForm.gateway_id}
                onChange={(e) => setGatewayForm({ ...gatewayForm, gateway_id: e.target.value })}
                disabled={!!selectedGateway}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nom"
                value={gatewayForm.gateway_name}
                onChange={(e) => setGatewayForm({ ...gatewayForm, gateway_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Adresse MAC"
                value={gatewayForm.mac_address}
                onChange={(e) => setGatewayForm({ ...gatewayForm, mac_address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Adresse IP"
                value={gatewayForm.ip_address}
                onChange={(e) => setGatewayForm({ ...gatewayForm, ip_address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="MQTT Client ID"
                value={gatewayForm.mqtt_client_id}
                onChange={(e) => setGatewayForm({ ...gatewayForm, mqtt_client_id: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Version Firmware"
                value={gatewayForm.firmware_version}
                onChange={(e) => setGatewayForm({ ...gatewayForm, firmware_version: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Expiration Certificat"
                type="date"
                value={gatewayForm.cert_expiry}
                onChange={(e) => setGatewayForm({ ...gatewayForm, cert_expiry: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Site</InputLabel>
                <Select
                  value={gatewayForm.site_id}
                  onChange={(e) => setGatewayForm({ ...gatewayForm, site_id: e.target.value })}
                >
                  {sitesData?.data?.map((site) => (
                    <MenuItem key={site.id} value={site.id}>
                      {site.nom}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Emplacement"
                value={gatewayForm.location}
                onChange={(e) => setGatewayForm({ ...gatewayForm, location: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={gatewayForm.notes}
                onChange={(e) => setGatewayForm({ ...gatewayForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGatewayDialog(false)}>Annuler</Button>
          <Button onClick={handleGatewaySubmit} variant="contained">
            {selectedGateway ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Node Dialog */}
      <Dialog open={openNodeDialog} onClose={() => setOpenNodeDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Modifier Nœud</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Node ID"
                type="number"
                value={nodeForm.node_id}
                onChange={(e) => setNodeForm({ ...nodeForm, node_id: e.target.value })}
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nom"
                value={nodeForm.nom}
                onChange={(e) => setNodeForm({ ...nodeForm, nom: e.target.value })}
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Scanner BT MAC"
                value={nodeForm.bt_scanner_mac}
                onChange={(e) => setNodeForm({ ...nodeForm, bt_scanner_mac: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="PIN Bluetooth"
                value={nodeForm.bt_pin}
                onChange={(e) => setNodeForm({ ...nodeForm, bt_pin: e.target.value })}
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date de déploiement"
                type="date"
                value={nodeForm.deployed_date}
                onChange={(e) => setNodeForm({ ...nodeForm, deployed_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Déployé par"
                value={nodeForm.deployed_by}
                onChange={(e) => setNodeForm({ ...nodeForm, deployed_by: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emplacement"
                value={nodeForm.location}
                onChange={(e) => setNodeForm({ ...nodeForm, location: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Numéro de scellé"
                value={nodeForm.seal_number}
                onChange={(e) => setNodeForm({ ...nodeForm, seal_number: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={nodeForm.notes}
                onChange={(e) => setNodeForm({ ...nodeForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNodeDialog(false)}>Annuler</Button>
          <Button onClick={handleNodeSubmit} variant="contained">
            Mettre à jour
          </Button>
        </DialogActions>
      </Dialog>

      {/* Alert Dialog */}
      <Dialog open={openAlertDialog} onClose={() => setOpenAlertDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Détail de l'alerte</DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Type
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedAlert.alert_type}
              </Typography>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                Priorité
              </Typography>
              <Chip label={selectedAlert.priority} color={getPriorityColor(selectedAlert.priority)} size="small" />

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                Description
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedAlert.description || 'Aucune description'}
              </Typography>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                Dispositif
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedAlert.device_name || selectedAlert.gateway_name || '-'}
              </Typography>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                Statut
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedAlert.status}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAlertDialog(false)}>Fermer</Button>
          {selectedAlert?.status !== 'resolu' && (
            <Button onClick={handleAlertResolve} variant="contained" color="success">
              Résoudre
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

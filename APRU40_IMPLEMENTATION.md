# APRU40 IoT Network Management - Implementation Guide

## Overview

This document describes the APRU40 IoT network management implementation added to the GMAO system. The APRU40 network consists of ESP32-based sensor nodes connected through gateways, with comprehensive monitoring and security features.

## Architecture

### Database Schema

The implementation adds the following tables:

1. **apru40_gateways** - Gateway devices managing node networks
   - Gateway identification (ID, name, MAC, IP)
   - MQTT configuration (client ID, broker reference)
   - Certificate management (expiry tracking)
   - Network statistics (node count, uptime)
   - Status tracking (online/offline)

2. **iot_devices (extended)** - Node devices with APRU40-specific fields
   - Node identification (node_id 1-254, gateway reference)
   - Security fields (tamper count, BT scanner MAC, BT PIN)
   - Deployment tracking (date, operator, seal number)
   - Physical location
   - Status tracking (last_seen, connectivity status)

3. **apru40_sensor_data** - Sensor readings from nodes
   - Support for ADS7128 (8 channels)
   - Support for ADS1119 #1 and #2 (4 channels each)
   - Support for TCA9537 (4 GPIO)
   - Timestamped readings with quality indicators

4. **apru40_alerts** - Security and monitoring alerts
   - Alert types: tamper, bt_unauthorized, node_offline, gateway_offline, cert_expiring, battery_low, sensor_anomaly
   - Priority levels: critique, haute, moyenne, basse
   - Assignment and resolution tracking
   - Metadata storage (JSONB)

5. **apru40_device_config** - Node configuration parameters
   - Acquisition periods (sensors, ESP-NOW, heartbeat)
   - Tamper auto-erase settings
   - Configuration versioning

### Views

1. **v_apru40_nodes_status** - Comprehensive node status
2. **v_apru40_gateways_status** - Gateway health and statistics
3. **v_apru40_latest_sensor_values** - Latest sensor readings per node

### Triggers & Automation

1. **update_gateway_node_count()** - Automatically updates node count on gateway
2. **update_device_last_seen()** - Updates last_seen timestamp on sensor data
3. **create_tamper_alert()** - Automatically creates critical alert on tamper detection

## API Endpoints

### Gateways
- `GET /api/apru40/gateways` - List all gateways
- `GET /api/apru40/gateways/:id` - Get gateway details
- `POST /api/apru40/gateways` - Create new gateway
- `PATCH /api/apru40/gateways/:id` - Update gateway
- `DELETE /api/apru40/gateways/:id` - Delete gateway

### Nodes
- `GET /api/apru40/nodes` - List all nodes (with filtering)
- `GET /api/apru40/nodes/:id` - Get node details
- `PATCH /api/apru40/nodes/:id` - Update node metadata
- `POST /api/apru40/nodes/:id/regenerate-pin` - Regenerate Bluetooth PIN

### Sensor Data
- `GET /api/apru40/nodes/:id/sensor-values` - Get latest sensor values
- `GET /api/apru40/nodes/:id/sensor-history` - Get historical sensor data
- `POST /api/apru40/nodes/:id/sensor-data` - Add sensor reading (for MQTT integration)

### Configuration
- `GET /api/apru40/nodes/:id/config` - Get node configuration
- `POST /api/apru40/nodes/:id/config` - Update node configuration

### Alerts
- `GET /api/apru40/alerts` - List alerts (with filtering)
- `GET /api/apru40/alerts/:id` - Get alert details
- `POST /api/apru40/alerts` - Create alert
- `PATCH /api/apru40/alerts/:id` - Update alert (assign, resolve)

### Statistics
- `GET /api/apru40/stats/overview` - Dashboard overview statistics
- `GET /api/apru40/stats/connectivity-history` - Historical connectivity data

## Frontend Components

### APRU40 Dashboard (`/apru40`)

A comprehensive dashboard with 4 tabs:

#### 1. Dashboard Tab
- Real-time statistics cards:
  - Gateways: online/total count, certificate warnings
  - Nodes: online/total with connectivity percentage
  - Alerts: active alert count, critical alert warnings
- Active alerts preview table (last 5 alerts)
- Auto-refresh every 5 seconds for nodes, 10 seconds for others

#### 2. Gateways Tab
- Gateway list table with:
  - Gateway ID, name, MAC address, IP address
  - Connected nodes count (online/total)
  - Status indicator (online/offline)
  - Last seen timestamp
- CRUD operations:
  - Add new gateway with full form
  - Edit gateway metadata
  - Delete gateway with confirmation
- Fields: gateway_id, name, MAC, IP, MQTT client ID, cert expiry, firmware, site, location, notes

#### 3. Nodes Tab
- Node list table with:
  - Node ID, name, gateway name
  - MAC address, status
  - Tamper count indicator (green/red badge)
  - Physical location
  - Last seen timestamp
- Actions:
  - Edit node metadata (location, deployment info, seal number)
  - Regenerate Bluetooth PIN (with confirmation)
- Security features prominently displayed

#### 4. Alerts Tab
- Alert management interface (placeholder for future expansion)

### Features
- Material-UI consistent design
- React Query for data fetching and caching
- Real-time updates with configurable refresh intervals
- Form validation with helpful error messages
- Color-coded status indicators
- Responsive layout for mobile/desktop

## Installation & Setup

### 1. Apply Database Migration

The migration will be automatically applied when you run:

```bash
cd backend
npm run migrate
```

Or it will be applied automatically when the backend starts if migrations are auto-run.

### 2. Verify Migration

Check that the following tables exist in your database:
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'apru40%';
```

Expected result:
- apru40_gateways
- apru40_sensor_data
- apru40_alerts
- apru40_device_config

### 3. Access the Dashboard

Navigate to: `http://localhost:3010/apru40` (or your configured frontend URL)

## Usage Examples

### Creating a Gateway

1. Go to APRU40 Dashboard → Gateways tab
2. Click "Ajouter Gateway"
3. Fill in:
   - Gateway ID: 1-254 (unique)
   - Name: "Gateway-Site-A"
   - MAC Address: "11:22:33:44:55:66"
   - IP Address: "192.168.1.100"
   - MQTT Client ID: "apru40_gw_01"
   - Certificate Expiry: select date
4. Click "Créer"

### Managing Nodes

1. Nodes are typically created through MQTT discovery or manual provisioning
2. Edit metadata by clicking the edit icon on any node
3. Update location, deployment info, seal number
4. Regenerate Bluetooth PIN when needed (requires re-pairing)

### Monitoring Alerts

1. Dashboard shows active alerts automatically
2. Click "Voir" to see alert details
3. Assign alerts to team members
4. Mark as "Résolu" when fixed

## MQTT Integration

### Expected MQTT Topics

**Node Data:**
```
apru40/gateway-{id}/node/{node_id}/data
```

**Payload Example:**
```json
{
  "timestamp": "2026-02-02T14:32:15Z",
  "sensors": {
    "ads7128": {
      "ch0": 12.34,  // Voltage in V
      "ch1": 5.67,   // Voltage in V
      "ch2": 3.21,   // Current in A
      "ch3": 1.23    // Temperature in °C
    },
    "ads1119_1": [1234, 5678, 9012, 3456],  // mV
    "ads1119_2": [2345, 6789, 1234, 5678],  // mV
    "tca9537": {
      "gpio0": true,
      "gpio1": false,
      "gpio2": true,
      "gpio3": false
    }
  }
}
```

**Heartbeat:**
```
apru40/gateway-{id}/node/{node_id}/heartbeat
```

**Alerts:**
```
apru40/gateway-{id}/node/{node_id}/alert
```

## Security Features

### Tamper Detection
- Automatic alert creation on tamper count increase
- Critical priority alerts
- Tracks tamper count history

### Bluetooth Security
- 6-digit PIN protection
- Authorized scanner MAC address filtering
- PIN regeneration capability with audit logging

### Certificate Management
- Tracks TLS certificate expiry dates
- Warnings when certificates expire within 30 days
- Alert generation for expiring certificates

## Default Data

### Device Type
- **APRU40 Node** device type with 20 sensor parameters:
  - 8 ADS7128 channels (CH0-CH7)
  - 8 ADS1119 channels (2 chips × 4 channels)
  - 4 TCA9537 GPIO channels

### Alert Types
- tamper (critique)
- bt_unauthorized (haute)
- node_offline (moyenne)
- gateway_offline (critique)
- cert_expiring (moyenne)
- battery_low (moyenne)
- sensor_anomaly (moyenne)

## Monitoring & Maintenance

### Health Checks
- Node heartbeat: every 30 seconds (configurable)
- Node offline threshold: 60 seconds
- Gateway offline threshold: 120 seconds

### Data Retention
- Sensor data: 90 days (configurable)
- Use `cleanup_old_apru40_sensor_data(90)` function to clean old data

### Performance
- Indexes on all frequently queried columns
- Views for complex queries
- Optimized for high-frequency sensor data inserts

## Troubleshooting

### Nodes Not Appearing
1. Check gateway is online and registered
2. Verify MQTT broker connection
3. Check node is sending heartbeats
4. Review backend logs for MQTT messages

### Alerts Not Triggering
1. Verify triggers are enabled in database
2. Check tamper_count is being updated
3. Review alert creation logs

### Sensor Data Not Showing
1. Verify MQTT topic format matches expected pattern
2. Check sensor data is being received by backend
3. Review `apru40_sensor_data` table for recent inserts

## Future Enhancements

Potential areas for expansion:
- Historical connectivity graphs
- Advanced sensor data visualization (charts)
- Alert notification system (email, SMS)
- Bulk node operations
- Gateway firmware update management
- OTA (Over-The-Air) update support for nodes
- Network topology visualization
- Advanced filtering and search
- Export reports (PDF, Excel)

## Support

For issues or questions about the APRU40 implementation:
1. Check this documentation
2. Review API endpoint responses for error messages
3. Check browser console for frontend errors
4. Review backend logs for API errors
5. Verify database migration was successful

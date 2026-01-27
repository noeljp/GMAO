# IoT Device Administration - Implementation Summary

## Overview

This implementation adds comprehensive IoT device management capabilities to the GMAO system, allowing administrators to manage IoT devices associated with machines (actifs) and automatically receive and process data from these devices via MQTT.

## What Was Implemented

### 1. Database Schema (Migration 007)

**New Tables:**
- `iot_device_types`: Types of IoT devices (Temperature sensors, Power meters, etc.)
- `iot_device_parameters`: Parameters available for each device type
- `iot_devices`: IoT devices registered in the system
- `iot_device_parameter_configs`: Configuration of parameters for each device
- `iot_device_values_history`: Historical values received from devices

**Pre-populated Data:**
- 6 default device types (Temperature/Humidity sensor, Power meter, Pressure sensor, Door sensor, Vibration sensor, Multi-parameter)
- Default parameters for each device type

**Features:**
- Automatic cleanup of old data (90 days retention by default)
- Views for device status and latest values
- Triggers for automatic last communication update

### 2. Backend API

**New API Routes** (`/api/iot-devices`):

#### Device Types
- `GET /types` - List all device types
- `GET /types/:id` - Get device type details
- `POST /types` - Create new device type
- `PATCH /types/:id` - Update device type

#### Device Parameters
- `GET /types/:typeId/parameters` - List parameters for a type
- `POST /types/:typeId/parameters` - Add parameter to type
- `PATCH /parameters/:id` - Update parameter
- `DELETE /parameters/:id` - Delete parameter

#### IoT Devices
- `GET /` - List all devices (with filtering by actif, type, status)
- `GET /:id` - Get device details
- `POST /` - Create new device
- `PATCH /:id` - Update device
- `DELETE /:id` - Delete device

#### Parameter Configuration
- `GET /:deviceId/parameter-configs` - List parameter configurations
- `POST /:deviceId/parameter-configs` - Create/update parameter config
- `DELETE /:deviceId/parameter-configs/:id` - Delete parameter config

#### Values & History
- `GET /:deviceId/values-history` - Get historical values
- `GET /:deviceId/latest-values` - Get latest values for all parameters

#### Statistics
- `GET /stats/overview` - Get system-wide IoT statistics

**Security:**
- All endpoints require authentication
- Permissions based on actifs permissions (view, create, edit, delete)
- Full audit trail for all operations

### 3. MQTT Integration

Enhanced the existing MQTT service (`backend/src/config/mqtt.js`) to:
- Automatically detect and process IoT device messages
- Extract values using JSONPath from JSON payloads
- Apply transformations (multiply, divide, round, etc.)
- Store values in history table
- Update associated machine (actif) fields automatically
- Check thresholds and trigger alerts

**Processing Flow:**
1. MQTT message received on subscribed topic
2. System checks for matching IoT devices
3. Extracts values using configured JSONPath
4. Applies transformations if configured
5. Stores in `iot_device_values_history`
6. Updates machine fields if configured
7. Checks thresholds and creates alerts if needed

### 4. Frontend UI

**New Page**: `/iot-devices` (IoTDevices.js)

**Features:**
- Dashboard with statistics (total devices, active, online, errors)
- Device list with filtering and sorting
- Create/Edit device dialog with full configuration
- Parameter configuration interface
- Real-time monitoring of latest values
- Status indicators and connection state
- Responsive Material-UI design

**User Interface Elements:**
- Statistics cards showing device counts
- Data table with device information
- Configuration tab for selected device
- Forms for device and parameter creation
- Real-time value display (auto-refresh every 10s)
- Color-coded status chips
- Integration with existing navigation menu

### 5. Documentation

**DOCUMENTATION_IOT.md** includes:
- Complete feature overview
- Step-by-step usage guide
- Configuration examples
- MQTT integration details
- API reference
- Troubleshooting guide
- Best practices

**test-iot-api.sh**:
- Automated API testing script
- Tests all major endpoints
- Provides immediate feedback

## Files Added/Modified

### Added Files:
```
backend/src/database/migrations/007_iot_devices.sql
backend/src/routes/iot-devices.routes.js
frontend/src/pages/IoTDevices.js
DOCUMENTATION_IOT.md
IOT_DEVICES_IMPLEMENTATION.md
test-iot-api.sh
```

### Modified Files:
```
backend/src/server.js (added IoT routes)
backend/src/config/mqtt.js (added IoT processing)
frontend/src/App.js (added IoT route)
frontend/src/components/Layout.js (added menu item)
```

## Installation & Setup

### 1. Database Migration

```bash
cd backend
node src/database/migrate.js
```

This will create all necessary tables and populate default device types.

### 2. No Additional Dependencies

All required dependencies are already present:
- `mqtt` - MQTT client
- `jsonpath-plus` - JSON path extraction
- `express-validator` - Input validation

### 3. Frontend Setup

The frontend page is automatically available after building the React app:

```bash
cd frontend
npm install  # if not already done
npm start    # for development
```

Access at: `http://localhost:3000/iot-devices`

## Usage Example

### 1. Create a Device Type (Optional - if not using defaults)

Via API:
```bash
POST /api/iot-devices/types
{
  "nom": "Custom Sensor",
  "description": "My custom sensor type",
  "icone": "sensors"
}
```

### 2. Create an IoT Device

Via UI or API:
```bash
POST /api/iot-devices
{
  "nom": "Temperature Sensor - Machine M001",
  "identifiant_unique": "SN-12345",
  "device_type_id": "<uuid-of-temp-sensor-type>",
  "actif_id": "<uuid-of-machine>",
  "mqtt_broker_id": "<uuid-of-broker>",
  "mqtt_topic_base": "factory/machine/M001",
  "fabricant": "Siemens",
  "modele": "TSensor-100",
  "statut": "actif"
}
```

### 3. Configure Parameters

```bash
POST /api/iot-devices/<device-id>/parameter-configs
{
  "parameter_id": "<uuid-of-temperature-parameter>",
  "mqtt_topic_suffix": "/temperature",
  "json_path": "$.value",
  "transformation": "none",
  "seuil_min": 15,
  "seuil_max": 35
}
```

### 4. Send MQTT Data

```bash
mosquitto_pub -h localhost \
  -t "factory/machine/M001/temperature" \
  -m '{"value": 23.5, "unit": "°C", "timestamp": "2024-01-27T18:00:00Z"}'
```

The system will automatically:
- Receive the message
- Extract the value (23.5)
- Store it in history
- Update the machine's temperature field
- Check if it's within thresholds (15-35°C)

## Key Features

### Real-Time Monitoring
- Automatic data collection from MQTT
- Live dashboard with device statistics
- Auto-refreshing latest values (10s interval)
- Connection status indicators

### Flexible Configuration
- Multiple device types supported
- Customizable parameters per device
- JSONPath for flexible data extraction
- Value transformations (multiply, divide, round)
- Threshold configuration for alerts

### Integration
- Seamlessly integrates with existing MQTT system
- Updates machine (actif) fields automatically
- Links to existing alert and maintenance systems
- Full audit trail

### Data Management
- Automatic historical data retention
- Configurable cleanup (default 90 days)
- Efficient database queries with indexes
- Views for easy data access

## Testing

### Manual Testing

1. **Database**:
   - Run migration
   - Verify tables created
   - Check default data inserted

2. **Backend**:
   - Start backend: `cd backend && npm start`
   - Run test script: `./test-iot-api.sh`
   - Check logs for MQTT processing

3. **Frontend**:
   - Start frontend: `cd frontend && npm start`
   - Navigate to "Dispositifs IoT"
   - Create a device
   - Configure parameters
   - Monitor values

### Integration Testing

1. Set up a local MQTT broker (Mosquitto)
2. Configure MQTT broker in the system
3. Create an IoT device
4. Configure parameters
5. Publish test messages
6. Verify data appears in history and updates machine

## Security Considerations

- All endpoints require authentication
- Uses existing permission system
- Sensitive data (broker credentials) encrypted
- Input validation on all API endpoints
- SQL injection protection via parameterized queries
- Audit logging for all operations

## Performance

- Database indexes on all foreign keys and query fields
- Efficient MQTT client (persistent connections)
- Automatic old data cleanup
- Pagination on list endpoints
- Optimized queries with views

## Future Enhancements (Not Implemented)

Potential future improvements:
- WebSocket for real-time UI updates
- Advanced alerting rules engine
- Data visualization/charts
- Device grouping and bulk operations
- Export historical data
- Device health monitoring
- Predictive maintenance based on IoT data

## Troubleshooting

### Device not receiving data
1. Check MQTT broker is connected
2. Verify topic configuration matches published topic
3. Check JSONPath configuration
4. Review backend logs

### Values incorrect
1. Verify JSONPath extracts correct value
2. Check transformation settings
3. Test JSONPath at jsonpath.com

### Performance issues
1. Run cleanup function to remove old data
2. Check database indexes exist
3. Reduce query frequency if needed

## Support

- Full documentation: `DOCUMENTATION_IOT.md`
- MQTT documentation: `DOCUMENTATION_MQTT.md`
- Test script: `test-iot-api.sh`

## Conclusion

This implementation provides a complete IoT device management solution that:
- ✅ Allows administration of IoT devices
- ✅ Supports multiple device types with configurable parameters
- ✅ Integrates seamlessly with existing MQTT infrastructure
- ✅ Provides real-time monitoring and historical data
- ✅ Updates machine fields automatically
- ✅ Includes comprehensive documentation
- ✅ Follows existing code patterns and best practices
- ✅ Maintains security and audit requirements

The system is production-ready and can be extended as needed.

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function NotificationCenter() {
  const [anchorEl, setAnchorEl] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications } = useQuery(
    'notifications',
    async () => {
      const response = await axios.get('/api/notifications?limit=10');
      return response.data;
    },
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  const markAsReadMutation = useMutation(
    (id) => axios.patch(`/api/notifications/${id}/mark-read`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notifications');
      },
    }
  );

  const markAllAsReadMutation = useMutation(
    () => axios.post('/api/notifications/mark-all-read'),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notifications');
      },
    }
  );

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification) => {
    markAsReadMutation.mutate(notification.id);
    handleClose();

    // Navigate based on notification type
    if (notification.entity_type === 'ordre_travail' && notification.entity_id) {
      navigate(`/ordres-travail/${notification.entity_id}`);
    } else if (notification.entity_type === 'demande' && notification.entity_id) {
      navigate(`/demandes/${notification.entity_id}`);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const notificationList = notifications?.data || [];
  const unreadCount = notificationList.filter((n) => !n.is_read).length;

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'haute':
      case 'urgente':
        return 'error';
      case 'moyenne':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { width: 400, maxHeight: 500 },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={handleMarkAllAsRead}>
              Tout marquer comme lu
            </Button>
          )}
        </Box>
        <Divider />

        {notificationList.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="textSecondary">Aucune notification</Typography>
          </Box>
        ) : (
          notificationList.map((notification) => (
            <MenuItem
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              sx={{
                bgcolor: notification.is_read ? 'transparent' : 'action.hover',
                flexDirection: 'column',
                alignItems: 'flex-start',
                py: 1.5,
                whiteSpace: 'normal',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 0.5 }}>
                {!notification.is_read && (
                  <CircleIcon sx={{ fontSize: 8, color: 'primary.main', mr: 1 }} />
                )}
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: notification.is_read ? 400 : 600 }}>
                        {notification.titre}
                      </Typography>
                      {notification.priorite && (
                        <Chip
                          label={notification.priorite}
                          size="small"
                          color={getPriorityColor(notification.priorite)}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" color="textSecondary">
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {notification.created_at &&
                          format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </Typography>
                    </>
                  }
                />
              </Box>
            </MenuItem>
          ))
        )}

        <Divider />
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Button size="small" onClick={() => { handleClose(); navigate('/notifications'); }}>
            Voir toutes les notifications
          </Button>
        </Box>
      </Menu>
    </>
  );
}

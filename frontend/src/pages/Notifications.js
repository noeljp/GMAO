import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Divider,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Circle as CircleIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function Notifications() {
  const [filter, setFilter] = useState('all');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: response, isLoading } = useQuery('all-notifications', async () => {
    const url = filter === 'unread' ? '/api/notifications?is_read=false' : '/api/notifications';
    const response = await axios.get(url);
    return response.data;
  });

  const markAsReadMutation = useMutation(
    (id) => axios.patch(`/api/notifications/${id}/mark-read`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('all-notifications');
        queryClient.invalidateQueries('notifications');
      },
    }
  );

  const markAllAsReadMutation = useMutation(
    () => axios.post('/api/notifications/mark-all-read'),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('all-notifications');
        queryClient.invalidateQueries('notifications');
      },
    }
  );

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }

    if (notification.entity_type === 'ordre_travail' && notification.entity_id) {
      navigate(`/ordres-travail/${notification.entity_id}`);
    } else if (notification.entity_type === 'demande' && notification.entity_id) {
      navigate(`/demandes/${notification.entity_id}`);
    }
  };

  if (isLoading) return <CircularProgress />;

  const notifications = response?.data || [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4">Notifications</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(e, value) => value && setFilter(value)}
            size="small"
          >
            <ToggleButton value="all">Toutes</ToggleButton>
            <ToggleButton value="unread">Non lues ({unreadCount})</ToggleButton>
          </ToggleButtonGroup>
          {unreadCount > 0 && (
            <Button
              variant="outlined"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              Tout marquer comme lu
            </Button>
          )}
        </Box>
      </Box>

      <Paper>
        <List>
          {notifications.length === 0 ? (
            <ListItem>
              <ListItemText
                primary={
                  <Typography color="textSecondary" align="center">
                    Aucune notification
                  </Typography>
                }
              />
            </ListItem>
          ) : (
            notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                {index > 0 && <Divider />}
                <ListItem
                  button
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    bgcolor: notification.is_read ? 'transparent' : 'action.hover',
                    '&:hover': {
                      bgcolor: 'action.selected',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 2 }}>
                    {notification.is_read ? (
                      <CheckCircleIcon sx={{ color: 'action.disabled', mt: 0.5 }} />
                    ) : (
                      <CircleIcon sx={{ fontSize: 16, color: 'primary.main', mt: 1 }} />
                    )}
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography
                            variant="body1"
                            sx={{ fontWeight: notification.is_read ? 400 : 600 }}
                          >
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
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {notification.created_at &&
                              format(new Date(notification.created_at), 'dd MMMM yyyy à HH:mm', {
                                locale: fr,
                              })}
                          </Typography>
                        </>
                      }
                    />
                  </Box>
                </ListItem>
              </React.Fragment>
            ))
          )}
        </List>
      </Paper>
    </Box>
  );
}

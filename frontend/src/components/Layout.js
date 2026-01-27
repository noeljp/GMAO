import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  Inventory as InventoryIcon,
  Build as BuildIcon,
  RequestPage as RequestPageIcon,
  People as PeopleIcon,
  Search as SearchIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon,
  Assessment as AssessmentIcon,
  Logout as LogoutIcon,
  CloudQueue as CloudQueueIcon,
  Category as CategoryIcon,
  Assignment as AssignmentIcon,
  Construction as ConstructionIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from './NotificationCenter';

const drawerWidth = 240;

const menuItems = [
  { text: 'Tableau de bord', icon: <DashboardIcon />, path: '/' },
  { text: 'Sites', icon: <BusinessIcon />, path: '/sites' },
  { text: 'Actifs', icon: <InventoryIcon />, path: '/actifs' },
  { text: 'Types d\'actifs', icon: <CategoryIcon />, path: '/types-actifs' },
  { text: 'Pièces de Rechange', icon: <ConstructionIcon />, path: '/pieces' },
  { text: 'Ordres de travail', icon: <BuildIcon />, path: '/ordres-travail' },
  { text: 'Planification', icon: <CalendarIcon />, path: '/planification' },
  { text: 'Demandes', icon: <RequestPageIcon />, path: '/demandes' },
  { text: 'Templates de Maintenance', icon: <AssignmentIcon />, path: '/templates-maintenance' },
  { text: 'Rapports', icon: <AssessmentIcon />, path: '/rapports' },
  { text: 'Recherche', icon: <SearchIcon />, path: '/search' },
  { text: 'Documents', icon: <DescriptionIcon />, path: '/documents' },
  { text: 'Configuration MQTT', icon: <CloudQueueIcon />, path: '/configuration/mqtt' },
  { text: 'Utilisateurs', icon: <PeopleIcon />, path: '/users' },
];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          GMAO
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton onClick={() => handleNavigation(item.path)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon><LogoutIcon /></ListItemIcon>
            <ListItemText primary="Déconnexion" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Gestion de Maintenance
          </Typography>
          <NotificationCenter />
          <Typography variant="body1" sx={{ ml: 2 }}>
            {user?.prenom} {user?.nom}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

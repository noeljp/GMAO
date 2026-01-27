import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sites from './pages/Sites';
import Actifs from './pages/Actifs';
import ActifDetail from './pages/ActifDetail';
import TypesActifs from './pages/TypesActifs';
import OrdresTravail from './pages/OrdresTravail';
import OrdreDetail from './pages/OrdreDetail';
import Demandes from './pages/Demandes';
import DemandeDetail from './pages/DemandeDetail';
import Users from './pages/Users';
import Search from './pages/Search';
import Documents from './pages/Documents';
import Notifications from './pages/Notifications';
import PlanificationEnhanced from './pages/PlanificationEnhanced';
import Rapports from './pages/Rapports';
import ConfigurationMQTT from './pages/ConfigurationMQTT';
import TemplatesMaintenance from './pages/TemplatesMaintenance';
import { useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <NotificationProvider>
          <CssBaseline />
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/sites" element={<Sites />} />
                    <Route path="/actifs" element={<Actifs />} />
                    <Route path="/actifs/:id" element={<ActifDetail />} />
                    <Route path="/types-actifs" element={<TypesActifs />} />
                    <Route path="/ordres-travail" element={<OrdresTravail />} />
                    <Route path="/ordres-travail/:id" element={<OrdreDetail />} />
                    <Route path="/demandes" element={<Demandes />} />
                    <Route path="/demandes/:id" element={<DemandeDetail />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/planification" element={<PlanificationEnhanced />} />
                    <Route path="/rapports" element={<Rapports />} />
                    <Route path="/templates-maintenance" element={<TemplatesMaintenance />} />
                    <Route path="/configuration/mqtt" element={<ConfigurationMQTT />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

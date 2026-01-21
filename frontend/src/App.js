import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sites from './pages/Sites';
import Actifs from './pages/Actifs';
import ActifDetail from './pages/ActifDetail';
import OrdresTravail from './pages/OrdresTravail';
import OrdreDetail from './pages/OrdreDetail';
import Demandes from './pages/Demandes';
import DemandeDetail from './pages/DemandeDetail';
import Users from './pages/Users';
import Search from './pages/Search';
import Documents from './pages/Documents';
import Notifications from './pages/Notifications';
import Planification from './pages/Planification';
import Rapports from './pages/Rapports';
import { useAuth } from './context/AuthContext';

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
    <ThemeProvider theme={theme}>
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
                  <Route path="/ordres-travail" element={<OrdresTravail />} />
                  <Route path="/ordres-travail/:id" element={<OrdreDetail />} />
                  <Route path="/demandes" element={<Demandes />} />
                  <Route path="/demandes/:id" element={<DemandeDetail />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/planification" element={<Planification />} />
                  <Route path="/rapports" element={<Rapports />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </ThemeProvider>
  );
}

export default App;

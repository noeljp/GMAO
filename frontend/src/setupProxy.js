const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Utiliser le nom du service Docker en environnement conteneur
  // ou localhost pour le développement local
  const target = process.env.REACT_APP_API_URL || 'http://backend:5000';
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      logLevel: 'debug',
      onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).send('Proxy Error');
      }
    })
  );
};

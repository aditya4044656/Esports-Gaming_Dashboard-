import React from 'react';
import ReactDOM from 'react-dom/client';
// This is the only file that index.js should import
import App from './App.jsx'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
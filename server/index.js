// 'dotenv' is a library for loading environment variables from a .env file
// and must be required before other modules
require('dotenv').config();
const express = require('express');
const cors = require('cors');  // 'cors' is scurity middleware for Express

// -- Importing the route files --
const trendingRoutes = require('./routes/trending');
const genreRoutes = require('./routes/genres');
const platformRoutes = require('./routes/platforms');

// Creating the main Express applications
const app = express();
// Now we are using PORT form .env or default to 3001
const PORT = process.env.PORT || 3001;

// Middleware
// we use 'app.use' to add middleware on every request
/**
 * WHY: 'cors' allows out React app to make request to this server (running on localHost: 3001). Without it, the browser would blick the request for security reasons
 */
app.use(cors());
// This allows us to parse JSON data from the request body
app.use(express.json());

// -- Using the route files --
// For passing any request that comes on '/api' to the trendingRoutes router to see if it matches
app.use('/api', trendingRoutes);
// For passing any request that comes on '/api' to the genreRoutes router to see if it matches
app.use('/api', genreRoutes);
// For passing any request that comes on '/api' to the platformRoutes router to see if it matches
app.use('/api', platformRoutes);

// Starting the server
// This line will start the server and listen on port 3001, and will log a message to the console when it starts
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('You can now test your endpoints in Postman.');
    console.log('GET http://localhost:3001/api/trending');
    console.log('GET http://localhost:3001/api/genre-trends');
    console.log('GET http://localhost:3001/api/platform-performance');
});
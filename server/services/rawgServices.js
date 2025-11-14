// Load environment variables (like our API keys) from the .env file
// 'dotenv' MUST be loaded at the top to make process.env work
require('dotenv').config(); 
// 'axios' is the library we use to make HTTP requests (like calling an API)
const axios = require('axios');

// --- Load All API Keys ---
// Now we will GET the API keys from the loaded environment variables
const RAWG_API_KEY = process.env.RAWG_API_KEY;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// --- Twitch Token (In-Memory Cache) ---
// This variable will hold our Twitch token so we don't
// have to ask for a new one with every single API call.
let twitchToken = null;

/**
 * WHAT: Gets (or refreshes) an App Access Token from Twitch.
 * WHY: We need this token to make any other request to the Twitch API.
 * Twitch uses OAuth 2.0, which is more complex than a simple API key.
 */
const getTwitchAccessToken = async () => {
  // If we already have a valid token, just return it.
  // In a real production app, we would also check if it's expired.
  if (twitchToken) {
    return twitchToken;
  }

  try {
    // This logs to the console so we know when we're getting a new token.
    console.log('Getting new Twitch token...');
    // Make a POST request to Twitch's token endpoint to get a new token
    const response = await axios.post(
      'https://id.twitch.tv/oauth2/token',
      null, // No body is needed for this request
      {
        params: {
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials', // We are an "app", so we use this
        },
      }
    );
    
    // Save the token to our 'twitchToken' variable and return it
    twitchToken = response.data.access_token;
    return twitchToken;
  } catch (error) {
    // If it fails, log the error and stop the process.
    console.error('Error getting Twitch token:', error.response.data);
    throw new Error('Could not get Twitch token');
  }
};

/**
 * WHAT: Fetches the total live viewer count for a single game name.
 * WHY: To show the "327k" live stats on the dashboard.
 */
const fetchLiveViewers = async (gameName) => {
  // If the game from RAWG doesn't have a name, don't bother.
  if (!gameName) {
    return 0;
  }

  try {
    // 1. Get our secret auth token (from cache or a new one)
    const token = await getTwitchAccessToken();
    
    // 2. First, we must find the Game ID from Twitch (e.g., "Valorant" -> "516575")
    //    The Twitch API prefers IDs over names.
    const gameResponse = await axios.get('https://api.twitch.tv/helix/games', {
      params: { name: gameName }, // Search by the game name
      headers: {
        'Client-ID': TWITCH_CLIENT_ID, // Our public ID
        'Authorization': `Bearer ${token}`, // Our secret token
      },
    });

    // If Twitch doesn't find the game, return 0 viewers
    if (gameResponse.data.data.length === 0) {
      console.log(`Game not found on Twitch: ${gameName}`);
      return 0; 
    }
    
    // Get the ID from the first search result
    const gameId = gameResponse.data.data[0].id;

    // 3. Now, get all live streams for that *specific* Game ID
    const streamsResponse = await axios.get('https://api.twitch.tv/helix/streams', {
      params: { game_id: gameId },
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`,
      },
    });

    // 4. Sum up all the viewers from all live streams
    let totalViewers = 0;
    // Loop through the 'data' array (which is all the live streams)
    streamsResponse.data.data.forEach(stream => {
      totalViewers += stream.viewer_count; // Add each stream's viewers to the total
    });

    return totalViewers;
    
  } catch (error) {
    // If any part of the Twitch API fails, log it and return 0
    console.error(`Error fetching Twitch data for ${gameName}:`, error.message);
    return 0;
  }
};

// --- Service for Trending Games (MODIFIED) ---
/**
 * WHAT: Fetches top-rated games from RAWG and merges them with live Twitch data.
 * WHY: This provides the data for your '/api/trending' endpoint.
 */
const fetchTrendingGames = async () => {
  // 1. Get the base game data from RAWG (as before)
  // 'await' means we are pausing here until the API call is finished
  const response = await axios.get('https://api.rawg.io/api/games', {
    params: {
      key: RAWG_API_KEY,  // Send our secret API key
      ordering: '-added', // 'sort by rating, descending
      page_size: 5,        // Only get the top 5 results for the UI
    },
  });

  // Now we have the API call finished, we can return the data
  const games = response.data.results;

  // 2. NEW: Merge with Twitch Data
  // 'Promise.all' lets us fetch all the Twitch data in parallel
  // This is much faster than doing it one by one in a loop
  const gamesWithLiveStats = await Promise.all(
    // We 'map' over the games array from RAWG
    games.map(async (game) => {
      // For each game, call our new Twitch function
      const liveViewers = await fetchLiveViewers(game.name);
      
      // Return a *new* object that merges the RAWG and Twitch data
      return {
        id: game.id,
        name: game.name,
        image: game.background_image, // from RAWG
        liveViewers: liveViewers,     // The new data point from Twitch!
      };
    })
  );

  return gamesWithLiveStats; // Return the final merged array
};


// --- Service for Genre Trends (NO CHANGE) ---
/**
 * Fetches 50 popular games and calculates the genre trends
 * RAWG doesn't have a "genre trend" endpoint. We have to create one for it.
 */
const fetchGenreTrends = async () => {
  // We will fetch larger list of games to analyze
  const response = await axios.get('https://api.rawg.io/api/games', {
    params: {
      key: RAWG_API_KEY, // Send our secret API key
      ordering: '-added', // means most popular/ recently added
      page_size: 50, // Only get the top 50 results
    },
  });

  const games = response.data.results;

  // Now we will process the data to count genres
  // We will create an empty "hash map" to store the counts.
  const genreCounts = {};

  // Looping through every game we fetched
  games.forEach((game) => {
    // Looping through each game, through each genre
    game.genres.forEach((genre) => {
      // genre.name is "Action", "RPG", etc
      if (genreCounts[genre.name]) {
        // If we've seen "Action" before, increment its count
        genreCounts[genre.name]++;
      } else {
        // If this is the first time we've seen "Action"
        genreCounts[genre.name] = 1;
      }
    });
  });

  // Now the genreCounts object will look like this: { "Action": 20, "RPG": 15, ... }
  // Now we will format the data to match the API contract
  // The contract wants: [{ id: "action", label: "Action", value: 25 }, ...]
  
  // 'Object.keys' gets an array of the keys: ["Action", "RPG", ...]
  const formattedGenres = Object.keys(genreCounts).map((genreName) => ({
    id: genreName.toLowerCase().replace(' ', '-'), // "Action" -> "action"
    label: genreName, // This displays "Action"
    value: genreCounts[genreName], // This displays count: 25
  }));

  // Returning the final, formatted array
  return formattedGenres;
};

// --- Service for Platform Performance (NO CHANGE) ---
/**
 * Fetches the top platforms, ordered by how many games they have.
 * Provides data for the '/api/platform-performance' endpoint
 */
const fetchPlatformPerformance = async () => {
  // We are hitting the platforms endpoint with this
  const response = await axios.get('https://api.rawg.io/api/platforms', {
    params: {
      key: RAWG_API_KEY, // Send our secret API key
      ordering: '-games_count', // Get the platforms with the most games first
      page_size: 8, // Only get the top 8 results
    },
  });

  // Now we have the API call finished, we can return the data
  const platforms = response.data.results;
  
  // Now we will format it to contract: [{ id, label, value }]
  const formattedPlatforms = platforms.map((platform) => ({
    id: platform.slug, // "pc", "playstation5", etc
    label: platform.name, // "PC", "PlayStation 5", etc
    value: platform.games_count, // The total game count
  }));

  // Returning the final, formatted array
  return formattedPlatforms;
};

// 'module.exports' is the Node.js way of making functions
// available to other files that 'require' this one.
module.exports = {
  fetchTrendingGames,
  fetchGenreTrends,
  fetchPlatformPerformance
};
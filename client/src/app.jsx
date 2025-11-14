import React, { useState, useEffect } from 'react';
import axios from 'axios';
// Import the chart components we need
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

// --- Chart.js setup ---
// We must register the components we want to use (ArcElement is for Pie Chart)
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// --- Base URL for our API ---
// This is the server you have running on http://localhost:3001
const API_BASE_URL = 'http://localhost:3001/api';

// --- Helper Function ---
// Formats large numbers into "k" (e.g., 327000 -> "327k")
const formatViewers = (num) => {
  if (num > 999) {
    return (num / 1000).toFixed(0) + 'k';
  }
  return num;
};

// --- Main App Component ---
export default function App() {
  // State to hold all our data from the backend
  const [trendingData, setTrendingData] = useState(null);
  const [genreData, setGenreData] = useState(null);
  const [platformData, setPlatformData] = useState(null);
  const [error, setError] = useState(null);

  // Fetch all data when the component loads
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // We use Promise.all to fetch all 3 endpoints in parallel
        // This is much faster than fetching them one by one
        const [trendingRes, genreRes, platformRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/trending`),
          axios.get(`${API_BASE_URL}/genre-trends`),
          axios.get(`${API_BASE_URL}/platform-performance`),
        ]);

        // Set the data in our state
        setTrendingData(trendingRes.data);
        setGenreData(genreRes.data);
        setPlatformData(platformRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
        // A "Network Error" almost always means the React app
        // cannot reach the server.
        setError(
          'Network Error: Failed to load data. Is your backend server running on port 3001? (You must run "node index.js" in the /server folder)'
        );
      }
    };

    fetchAllData();
  }, []); // The empty array [] means this runs only once on mount

  // Show error message if fetching failed
  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 p-4 text-center text-red-400">
        <pre className="whitespace-pre-wrap font-sans text-lg">{error}</pre>
      </div>
    );
  }

  // Show a loading screen until all data is fetched
  if (!trendingData || !genreData || !platformData) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">
        Loading Dashboard...
      </div>
    );
  }

  // --- Render the Dashboard ---
  return (
    <div className="min-h-screen bg-gray-900 p-4 font-sans text-white md:p-8">
      <Header />
      <main className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Card 1: Trending Games (Live) */}
        <TrendingGamesCard data={trendingData} />

        {/* The other two cards take up the rest of the space */}
        <div className="grid grid-cols-1 gap-8 md:col-span-2">
          {/* Card 2: Genre Stats */}
          <GenreStatsCard data={genreData} />
          {/* Card 3: Top Platforms */}
          <PlatformChartCard data={platformData} />
        </div>
      </main>
    </div>
  );
}

// --- Header Component ---
function Header() {
  return (
    <header className="flex items-center justify-between">
      <h1 className="text-3xl font-bold">Esports & Gaming Stats Dashboard</h1>
      <div className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold">
        <svg
          className="h-5 w-5 fill-white"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M11 12.85V10.75C11 10.2703 11.2375 9.875 11.6375 9.75L17.1875 8H3V14H17.1875L11.6375 12.85C11.2375 12.725 11 12.33 11 12.85ZM18.5 14.25L21 15V17H18L16.5 15.5V12L18.5 14.25Z" />
          <path d="M20 4H10C8.9 4 8 4.9 8 6V8H2V16H8V18C8 19.1 8.9 20 10 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 18H10V6H20V18Z" />
        </svg>
        <span>Live on Twitch</span>
      </div>
    </header>
  );
}

// --- Card 1: Trending Games ---
function TrendingGamesCard({ data }) {
  return (
    <div className="rounded-lg bg-gray-800 p-6 shadow-lg md:col-span-1">
      <h2 className="mb-4 text-xl font-semibold">Trending Games</h2>
      <ul className="space-y-4">
        {data.map((game) => (
          <li key={game.id} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                // Fallback placeholder image if game.image is null
                src={game.image || 'https://placehold.co/60x80/60a5fa/FFF?text=?'}
                alt={game.name}
                className="h-20 w-16 rounded-md object-cover"
              />
              <span className="font-medium">{game.name}</span>
            </div>
            <span className="font-bold text-lg text-purple-400">
              {formatViewers(game.liveViewers)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Card 2: Genre Stats ---
function GenreStatsCard({ data }) {
  // We must transform our API data into the format Chart.js needs
  const chartData = {
    labels: data.map((g) => g.label),
    datasets: [
      {
        data: data.map((g) => g.value),
        backgroundColor: [
          '#8B5CF6', // purple-500
          '#EC4899', // pink-500
          '#3B82F6', // blue-500
          '#10B981', // emerald-500
          '#F59E0B', // amber-500
          '#EF4444', // red-500
        ],
        borderColor: '#1F2937', // bg-gray-800
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#FFFFFF', // text-white
          font: {
            size: 14,
          },
        },
      },
      title: {
        display: false, // We already have a card title
      },
    },
  };

  return (
    <div className="rounded-lg bg-gray-800 p-6 shadow-lg">
      <h2 className="mb-4 text-xl font-semibold">Genre Stats</h2>
      <div className="mx-auto h-64 w-full max-w-sm"> {/* Constrain pie chart size */}
        <Pie data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

// --- Card 3: Top Platforms ---
function PlatformChartCard({ data }) {
  // Transform data for the bar chart
  const chartData = {
    labels: data.map((p) => p.label),
    datasets: [
      {
        label: 'Total Games',
        data: data.map((p) => p.value),
        backgroundColor: '#8B5CF6', // purple-500
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    indexAxis: 'y', // This makes it a horizontal bar chart
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend for a cleaner look
      },
      title: {
        display: false, // We already have a card title
      },
    },
    scales: {
      x: {
        ticks: { color: '#D1D5DB' }, // text-gray-300
        grid: { color: '#374151' }, // text-gray-700
      },
      y: {
        ticks: { color: '#D1D5DB' }, // text-gray-300
        grid: { display: false },
      },
    },
  };

  return (
    <div className="rounded-lg bg-gray-800 p-6 shadow-lg">
      <h2 className="mb-4 text-xl font-semibold">Top Platforms</h2>
      <div className="h-64 w-full"> {/* Set a fixed height for the chart container */}
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
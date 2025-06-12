const fetch = require('node-fetch');

const TMDB_API_KEY = process.env.TMDB_API_KEY || '00e012c8105feb4cf6af96575793c443';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function searchMovies(query, filters = {}) {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    query,
    ...filters
  });
  const url = `${TMDB_BASE_URL}/search/movie?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch movies from TMDB');
  return res.json();
}

async function getMovieDetails(movieId) {
  const url = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,reviews`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch movie details from TMDB');
  return res.json();
}

module.exports = { searchMovies, getMovieDetails };

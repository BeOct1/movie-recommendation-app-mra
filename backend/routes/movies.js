require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { getDb } = require('../db');

const router = express.Router();

const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Middleware to check JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Add a new movie (protected)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, genre, year, description, posterUrl } = req.body;
    const moviesCol = getDb().collection('movies');
    const result = await moviesCol.insertOne({ title, genre, year, description, posterUrl });
    res.status(201).json(result.ops ? result.ops[0] : { title, genre, year, description, posterUrl });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all movies or search by title/genre
router.get('/', async (req, res) => {
  try {
    const { search, genre } = req.query;
    let query = {};
    if (search) query.title = { $regex: search, $options: 'i' };
    if (genre) query.genre = genre;
    const moviesCol = getDb().collection('movies');
    const movies = await moviesCol.find(query).toArray();
    res.json(movies);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Recommend movies (personalized)
router.get('/recommendations', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.userId;
    // 1. Get user's favorites, watchlists, and reviews
    const [favorites, watchlists, reviews] = await Promise.all([
      db.collection('favorites').find({ user: require('mongodb').ObjectId(userId) }).toArray(),
      db.collection('watchlists').find({ user: require('mongodb').ObjectId(userId) }).toArray(),
      db.collection('reviews').find({ user: require('mongodb').ObjectId(userId) }).toArray(),
    ]);
    // 2. Collect all movieIds the user interacted with
    const favIds = favorites.map(f => f.movieId);
    const watchlistIds = watchlists.flatMap(wl => (wl.movies || []).map(m => m.movieId));
    const reviewIds = reviews.map(r => r.movieId);
    const userMovieIds = Array.from(new Set([...favIds, ...watchlistIds, ...reviewIds]));
    // 3. Get genres of these movies
    const moviesCol = db.collection('movies');
    const userMovies = await moviesCol.find({ _id: { $in: userMovieIds.map(id => isNaN(id) ? id : parseInt(id)) } }).toArray();
    const genres = Array.from(new Set(userMovies.flatMap(m => m.genre ? [m.genre] : [])));
    // 4. Recommend movies with similar genres, not already seen
    let recQuery = {};
    if (genres.length > 0) {
      recQuery.genre = { $in: genres };
    }
    if (userMovieIds.length > 0) {
      recQuery._id = { $nin: userMovieIds.map(id => isNaN(id) ? id : parseInt(id)) };
    }
    let recommendations = await moviesCol.find(recQuery).limit(10).toArray();
    // If not enough, fill with random
    if (recommendations.length < 5) {
      const count = await moviesCol.countDocuments();
      const random = Math.max(0, Math.floor(Math.random() * (count - 5)));
      const randomMovies = await moviesCol.find().skip(random).limit(5).toArray();
      recommendations = recommendations.concat(randomMovies.filter(m => !userMovieIds.includes(m._id)));
    }
    // Remove duplicates
    const seen = new Set();
    const uniqueRecs = recommendations.filter(m => {
      if (seen.has(m._id)) return false;
      seen.add(m._id);
      return true;
    });
    res.json(uniqueRecs.slice(0, 5));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search movies
router.get('/search', async (req, res) => {
  try {
    const { query, year, genre, sort_by } = req.query;
    const params = {
      api_key: TMDB_API_KEY,
      query,
      year,
      with_genres: genre,
      sort_by,
    };
    const tmdbRes = await axios.get('https://api.themoviedb.org/3/search/movie', { params });
    res.json(tmdbRes.data);
  } catch (err) {
    res.status(500).json({ message: 'TMDB search error' });
  }
});

// Movie details
router.get('/:id', async (req, res) => {
  try {
    const tmdbRes = await axios.get(
      `https://api.themoviedb.org/3/movie/${req.params.id}`,
      { params: { api_key: TMDB_API_KEY, append_to_response: 'credits,videos' } }
    );
    res.json(tmdbRes.data);
  } catch (err) {
    res.status(500).json({ message: 'TMDB details error' });
  }
});

module.exports = router;

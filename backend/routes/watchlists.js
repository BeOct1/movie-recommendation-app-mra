const express = require('express');
const { getDb } = require('../db');
const auth = require('../middleware/auth');
const { ObjectId } = require('mongodb');
const router = express.Router();

// Create watchlist
router.post('/', auth, async (req, res) => {
  const { name } = req.body;
  try {
    const watchlistsCol = getDb().collection('watchlists');
    const wl = {
      user: ObjectId(req.user.userId),
      name,
      movies: [],
      createdAt: new Date()
    };
    const result = await watchlistsCol.insertOne(wl);
    res.status(201).json(result.ops ? result.ops[0] : wl);
  } catch (err) {
    res.status(500).json({ message: 'Error creating watchlist' });
  }
});

// Add movie to watchlist
router.post('/:id/movies', auth, async (req, res) => {
  const { movieId, title, posterPath } = req.body;
  try {
    const watchlistsCol = getDb().collection('watchlists');
    const wl = await watchlistsCol.findOne({ _id: ObjectId(req.params.id), user: ObjectId(req.user.userId) });
    if (!wl) return res.status(404).json({ message: 'Watchlist not found' });
    await watchlistsCol.updateOne(
      { _id: ObjectId(req.params.id), user: ObjectId(req.user.userId) },
      { $push: { movies: { movieId, title, posterPath } } }
    );
    const updated = await watchlistsCol.findOne({ _id: ObjectId(req.params.id) });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error adding movie to watchlist' });
  }
});

// Get all watchlists
router.get('/', auth, async (req, res) => {
  try {
    const watchlistsCol = getDb().collection('watchlists');
    const wls = await watchlistsCol.find({ user: ObjectId(req.user.userId) }).toArray();
    res.json(wls);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching watchlists' });
  }
});

module.exports = router;
const express = require('express');
const { getDb } = require('../db');
const auth = require('../middleware/auth');
const { ObjectId } = require('mongodb');
const router = express.Router();

// Add favorite
router.post('/', auth, async (req, res) => {
  const { movieId, title, posterPath } = req.body;
  try {
    const favoritesCol = getDb().collection('favorites');
    const fav = {
      user: ObjectId(req.user.userId),
      movieId,
      title,
      posterPath,
      createdAt: new Date()
    };
    const result = await favoritesCol.insertOne(fav);
    res.status(201).json(result.ops ? result.ops[0] : fav);
  } catch (err) {
    res.status(500).json({ message: 'Error saving favorite' });
  }
});

// Get favorites
router.get('/', auth, async (req, res) => {
  try {
    const favoritesCol = getDb().collection('favorites');
    const favs = await favoritesCol.find({ user: ObjectId(req.user.userId) }).toArray();
    res.json(favs);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching favorites' });
  }
});

// Remove favorite
router.delete('/:id', auth, async (req, res) => {
  try {
    const favoritesCol = getDb().collection('favorites');
    await favoritesCol.deleteOne({ user: ObjectId(req.user.userId), movieId: req.params.id });
    res.json({ message: 'Favorite removed' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing favorite' });
  }
});

module.exports = router;
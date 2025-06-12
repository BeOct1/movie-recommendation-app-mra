const express = require('express');
const { ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { getDb } = require('../db');
const router = express.Router();

// Add review
router.post(
  '/',
  auth,
  [
    body('movieId').notEmpty().withMessage('movieId is required'),
    body('rating').isInt({ min: 1, max: 10 }).withMessage('Rating must be between 1 and 10'),
    body('comment').optional().isLength({ max: 500 }).withMessage('Comment max length is 500'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { movieId, rating, comment } = req.body;
    try {
      const reviewsCol = getDb().collection('reviews');
      const review = {
        user: ObjectId(req.user.userId),
        movieId,
        rating,
        comment,
        createdAt: new Date(),
      };
      const result = await reviewsCol.insertOne(review);
      res.status(201).json(result.ops ? result.ops[0] : review);
    } catch (err) {
      res.status(500).json({ message: 'Error saving review' });
    }
  }
);

// Get reviews for a movie
router.get('/:movieId', async (req, res) => {
  try {
    const reviewsCol = getDb().collection('reviews');
    const reviews = await reviewsCol.find({ movieId: req.params.movieId }).toArray();
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reviews' });
  }
});

// Get reviews by user
router.get('/user/:userId', async (req, res) => {
  try {
    const reviewsCol = getDb().collection('reviews');
    const reviews = await reviewsCol.find({ user: ObjectId(req.params.userId) }).toArray();
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user reviews' });
  }
});

// Edit review
router.put(
  '/:id',
  [
    body('rating').isInt({ min: 1, max: 10 }).withMessage('Rating must be between 1 and 10'),
    body('comment').optional().isLength({ max: 500 }).withMessage('Comment max length is 500'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const reviewsCol = getDb().collection('reviews');
      const review = await reviewsCol.findOne({ _id: ObjectId(req.params.id) });
      if (!review) return res.status(404).json({ message: 'Review not found' });
      if (String(review.user) !== String(req.user.userId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      await reviewsCol.updateOne(
        { _id: ObjectId(req.params.id) },
        { $set: { rating: req.body.rating, comment: req.body.comment } }
      );
      const updated = await reviewsCol.findOne({ _id: ObjectId(req.params.id) });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: 'Error updating review' });
    }
  }
);

// Delete review
router.delete('/:id', auth, async (req, res) => {
  try {
    const reviewsCol = getDb().collection('reviews');
    const review = await reviewsCol.findOne({ _id: ObjectId(req.params.id) });
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (String(review.user) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await reviewsCol.deleteOne({ _id: ObjectId(req.params.id) });
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting review' });
  }
});

module.exports = router;
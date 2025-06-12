const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  movies: [{ movieId: String, title: String, posterPath: String }]
});

module.exports = mongoose.model('Watchlist', watchlistSchema);
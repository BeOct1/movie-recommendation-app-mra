const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  genre: { type: String, required: true },
  year: { type: Number },
  description: { type: String },
  posterUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Movie', movieSchema);

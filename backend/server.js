require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { getDb } = require('./db');
const moviesRouter = require('./routes/movies');
const favoritesRouter = require('./routes/favorites');
const watchlistsRouter = require('./routes/watchlists');
const reviewsRouter = require('./routes/reviews');
const profileRouter = require('./routes/profile');

const app = express();
const PORT = process.env.PORT || 5000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(limiter);

app.use(cors({
  origin: [
    'https://movie-recommendation-fu9npnm5g-edwards-projects-0bb04786.vercel.app',
    'https://tangerine-lollipop-a24f3d.netlify.app',
    'http://localhost:3000',
    'http://localhost:5000',
    'https://frontend-roan-kappa-95.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Registration route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }
    const usersCol = getDb().collection('users');
    const existingUser = await usersCol.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await usersCol.insertOne({ username, password: hashedPassword });
    const token = jwt.sign({ userId: result.insertedId.toString(), username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ message: 'User registered successfully.', token });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});


// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }
    const usersCol = getDb().collection('users');
    const user = await usersCol.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = jwt.sign({ userId: user._id.toString(), username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Add a protected profile route
app.get('/api/auth/profile', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usersCol = getDb().collection('users');
    const user = await usersCol.findOne({ _id: require('mongodb').ObjectId(decoded.userId) }, { projection: { password: 0 } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Import routes

app.use('/api/movies', moviesRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/watchlists', watchlistsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/profile', profileRouter);

app.get('/', (req, res) => {
  res.send('Express server is running!');
});

// Refresh token endpoint
app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies ? req.cookies.refreshToken : null;
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token' });
  }
  try {
    const usersCol = getDb().collection('users');
    const user = await usersCol.findOne({ refreshTokens: refreshToken });
    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    const accessToken = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ token: accessToken });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  const refreshToken = req.cookies ? req.cookies.refreshToken : null;
  if (refreshToken) {
    try {
      const usersCol = getDb().collection('users');
      await usersCol.updateOne({ refreshTokens: refreshToken }, { $pull: { refreshTokens: refreshToken } });
      res.clearCookie('refreshToken');
    } catch (err) {
      return res.status(500).json({ message: 'Server error' });
    }
  }
  res.json({ message: 'Logged out' });
});

// Deployment best practices:
// - Set all required env vars (MONGODB_URI, JWT_SECRET, etc.) in Render/Vercel
// - Set REACT_APP_API_URL in frontend to your deployed backend URL
// - Ensure CORS allows your frontend domain
// - Use HTTPS for both frontend and backend in production

// Export app for testing and for use in start.js
module.exports = app;
// To run the server in production, use start.js

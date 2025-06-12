const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

const router = express.Router();

// Helper to generate refresh token
function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

// Register
router.post(
  '/register',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields required' });
      }
      const usersCol = getDb().collection('users');
      const existingUser = await usersCol.findOne({ $or: [{ username }, { email }] });
      if (existingUser) {
        return res.status(409).json({ message: 'Username or email already exists' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await usersCol.insertOne({ username, email, password: hashedPassword, refreshTokens: [] });
      const user = result.ops ? result.ops[0] : { _id: result.insertedId, username, email, refreshTokens: [] };
      const accessToken = jwt.sign(
        { userId: user._id.toString(), username: user.username, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      const refreshToken = generateRefreshToken();
      await usersCol.updateOne({ _id: user._id }, { $push: { refreshTokens: refreshToken } });
      res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'Strict', secure: process.env.NODE_ENV === 'production', maxAge: 7*24*60*60*1000 });
      res.status(201).json({ message: 'User registered successfully', token: accessToken, user: { username: user.username, email: user.email, _id: user._id } });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { email, password } = req.body;
      const usersCol = getDb().collection('users');
      const user = await usersCol.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      const accessToken = jwt.sign(
        { userId: user._id.toString(), username: user.username, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      const refreshToken = generateRefreshToken();
      await usersCol.updateOne({ _id: user._id }, { $push: { refreshTokens: refreshToken } });
      res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'Strict', secure: process.env.NODE_ENV === 'production', maxAge: 7*24*60*60*1000 });
      res.json({ token: accessToken, user: { username: user.username, email: user.email, _id: user._id } });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token' });
  }
  const usersCol = getDb().collection('users');
  const user = await usersCol.findOne({ refreshTokens: refreshToken });
  if (!user) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
  const accessToken = jwt.sign(
    { userId: user._id.toString(), username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  res.json({ token: accessToken });
});

// Logout: clear refresh token
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (refreshToken) {
    const usersCol = getDb().collection('users');
    await usersCol.updateOne({ refreshTokens: refreshToken }, { $pull: { refreshTokens: refreshToken } });
    res.clearCookie('refreshToken');
  }
  res.json({ message: 'Logged out' });
});

// Facebook OAuth
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_CLIENT_ID,
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL,
  profileFields: ['id', 'emails', 'name', 'displayName', 'photos']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const usersCol = getDb().collection('users');
    let user = await usersCol.findOne({ facebookId: profile.id });
    if (!user) {
      // Try to find by email
      const email = profile.emails && profile.emails[0] && profile.emails[0].value;
      user = await usersCol.findOne({ email });
      if (user) {
        await usersCol.updateOne({ _id: user._id }, { $set: { facebookId: profile.id } });
      } else {
        user = {
          username: profile.displayName || profile.username || profile.id,
          email: email || `${profile.id}@facebook.com`,
          facebookId: profile.id,
          refreshTokens: []
        };
        const result = await usersCol.insertOne(user);
        user._id = result.insertedId;
      }
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// GitHub OAuth
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL,
  scope: ['user:email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const usersCol = getDb().collection('users');
    let user = await usersCol.findOne({ githubId: profile.id });
    if (!user) {
      // Try to find by email
      let email = null;
      if (profile.emails && profile.emails.length > 0) {
        email = profile.emails[0].value;
      }
      user = await usersCol.findOne({ email });
      if (user) {
        await usersCol.updateOne({ _id: user._id }, { $set: { githubId: profile.id } });
      } else {
        user = {
          username: profile.username || profile.displayName || profile.id,
          email: email || `${profile.id}@github.com`,
          githubId: profile.id,
          refreshTokens: []
        };
        const result = await usersCol.insertOne(user);
        user._id = result.insertedId;
      }
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// Facebook OAuth endpoints
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { session: false, failureRedirect: '/login' }), async (req, res) => {
  const user = req.user;
  const accessToken = jwt.sign(
    { userId: user._id.toString(), username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const refreshToken = generateRefreshToken();
  const usersCol = getDb().collection('users');
  await usersCol.updateOne({ _id: user._id }, { $push: { refreshTokens: refreshToken } });
  res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'Strict', secure: process.env.NODE_ENV === 'production', maxAge: 7*24*60*60*1000 });
  // For SPA: redirect with token in query or as JSON
  res.redirect(`${process.env.OAUTH_REDIRECT_URL}?token=${accessToken}`);
});

// GitHub OAuth endpoints
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { session: false, failureRedirect: '/login' }), async (req, res) => {
  const user = req.user;
  const accessToken = jwt.sign(
    { userId: user._id.toString(), username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const refreshToken = generateRefreshToken();
  const usersCol = getDb().collection('users');
  await usersCol.updateOne({ _id: user._id }, { $push: { refreshTokens: refreshToken } });
  res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'Strict', secure: process.env.NODE_ENV === 'production', maxAge: 7*24*60*60*1000 });
  res.redirect(`${process.env.OAUTH_REDIRECT_URL}?token=${accessToken}`);
});

module.exports = router;

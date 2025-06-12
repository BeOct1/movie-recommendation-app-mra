const request = require('supertest');
const app = require('../server');
const { getDb, connectToDatabase } = require('../db');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

describe('API Endpoints', () => {
  let token;
  let userId;
  let testMovieId = '1234567890abcdef12345678'; // example movie id

  beforeAll(async () => {
    // Connect to database
    await connectToDatabase();

    // Register a test user
    const username = 'testuser';
    const password = 'testpassword';

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password });

    if (registerRes.statusCode !== 201 && registerRes.statusCode !== 409) {
      throw new Error(`Unexpected status code during registration: ${registerRes.statusCode}`);
    }

    // Login to get token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password });

    expect(res.statusCode).toBe(200);
    token = res.body.token;

    // Get userId from token payload (decode JWT)
    const decoded = jwt.decode(token);
    userId = decoded ? decoded.userId : null;
    if (!userId) throw new Error('Failed to decode userId from token');
  });

  afterAll(async () => {
    // Clean up test user from DB
    const db = getDb();
    await db.collection('users').deleteOne({ _id: new ObjectId(userId) });
  });

  test('GET /api/movies should return movies list', async () => {
    const res = await request(app)
      .get('/api/movies')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/favorites add and remove favorite', async () => {
    // Add favorite
    let res = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ movieId: testMovieId, title: 'Test Movie', posterPath: '/test.jpg' });

    expect(res.statusCode).toBe(200);

    // Get favorites
    res = await request(app)
      .get('/api/favorites')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.some(fav => fav.movieId === testMovieId)).toBe(true);

    // Remove favorite
    res = await request(app)
      .delete(`/api/favorites/${testMovieId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);

    // Confirm removal
    res = await request(app)
      .get('/api/favorites')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.some(fav => fav.movieId === testMovieId)).toBe(false);
  });

  test('GET /api/recommendations returns recommendations', async () => {
    const res = await request(app)
      .get('/api/movies/recommendations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/auth/logout logs out user', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Logged out');
  });

  // Add more tests for watchlists, reviews, profile, etc. as needed
});

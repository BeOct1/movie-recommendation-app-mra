const request = require('supertest');
const app = require('../server');
const { getDb } = require('../db');
const jwt = require('jsonwebtoken');

let token;
let movieId;

beforeAll(async () => {
  // Create a test user and get token
  const usersCol = getDb().collection('users');
  const result = await usersCol.insertOne({ username: 'testuser', password: 'hashedpassword' });
  token = jwt.sign({ userId: result.insertedId.toString(), username: 'testuser' }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  // Clean up test data
  const usersCol = getDb().collection('users');
  await usersCol.deleteOne({ username: 'testuser' });
  if (movieId) {
    const moviesCol = getDb().collection('movies');
    await moviesCol.deleteOne({ _id: movieId });
  }
});

describe('Movies API', () => {
  test('Add a new movie (protected)', async () => {
    const res = await request(app)
      .post('/api/movies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Movie',
        genre: 'Drama',
        year: 2023,
        description: 'Test description',
        posterUrl: 'http://example.com/poster.jpg'
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Test Movie');
    movieId = res.body._id;
  });

  test('Get all movies', async () => {
    const res = await request(app).get('/api/movies');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Get movie recommendations (protected)', async () => {
    const res = await request(app)
      .get('/api/movies/recommendations')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Search movies', async () => {
    const res = await request(app).get('/api/movies/search').query({ query: 'Test' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('results');
  });

  test('Get movie details', async () => {
    // Use a known TMDB movie ID, e.g., 550 (Fight Club)
    const res = await request(app).get('/api/movies/550');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('title');
  });
});

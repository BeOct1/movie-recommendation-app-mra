const request = require('supertest');
const app = require('../server');
const { getDb } = require('../db');
const jwt = require('jsonwebtoken');

let token;
let testUserId;
let testWatchlistId;
let testMovie = { movieId: 'test-movie-456', title: 'Watchlist Movie', posterPath: 'http://example.com/poster2.jpg' };

beforeAll(async () => {
  const usersCol = getDb().collection('users');
  const result = await usersCol.insertOne({ username: 'wltestuser', password: 'hashedpassword' });
  testUserId = result.insertedId;
  token = jwt.sign({ userId: testUserId.toString(), username: 'wltestuser' }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  const usersCol = getDb().collection('users');
  await usersCol.deleteOne({ _id: testUserId });
  const watchlistsCol = getDb().collection('watchlists');
  if (testWatchlistId) {
    await watchlistsCol.deleteOne({ _id: testWatchlistId });
  }
});

describe('Watchlists API', () => {
  test('Create a watchlist', async () => {
    const res = await request(app)
      .post('/api/watchlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Watchlist' });
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('My Watchlist');
    testWatchlistId = res.body._id;
  });

  test('Add movie to watchlist', async () => {
    const res = await request(app)
      .post(`/api/watchlists/${testWatchlistId}/movies`)
      .set('Authorization', `Bearer ${token}`)
      .send(testMovie);
    expect(res.statusCode).toBe(200);
    expect(res.body.movies.some(m => m.movieId === testMovie.movieId)).toBe(true);
  });

  test('Get all watchlists', async () => {
    const res = await request(app)
      .get('/api/watchlists')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(wl => wl._id === testWatchlistId)).toBe(true);
  });
});

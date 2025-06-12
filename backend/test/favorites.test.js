const request = require('supertest');
const app = require('../server');
const { getDb } = require('../db');
const jwt = require('jsonwebtoken');

let token;
let testUserId;
let testMovieId = 'test-movie-123';

beforeAll(async () => {
  const usersCol = getDb().collection('users');
  const result = await usersCol.insertOne({ username: 'favtestuser', password: 'hashedpassword' });
  testUserId = result.insertedId;
  token = jwt.sign({ userId: testUserId.toString(), username: 'favtestuser' }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  const usersCol = getDb().collection('users');
  await usersCol.deleteOne({ _id: testUserId });
  const favoritesCol = getDb().collection('favorites');
  await favoritesCol.deleteMany({ user: testUserId });
});

describe('Favorites API', () => {
  test('Add a favorite', async () => {
    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ movieId: testMovieId, title: 'Test Movie', posterPath: 'http://example.com/poster.jpg' });
    expect(res.statusCode).toBe(201);
    expect(res.body.movieId).toBe(testMovieId);
  });

  test('Get favorites', async () => {
    const res = await request(app)
      .get('/api/favorites')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(fav => fav.movieId === testMovieId)).toBe(true);
  });

  test('Remove a favorite', async () => {
    const res = await request(app)
      .delete(`/api/favorites/${testMovieId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Favorite removed');
  });
});

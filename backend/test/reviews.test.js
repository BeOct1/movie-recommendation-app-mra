const request = require('supertest');
const app = require('../server');
const { getDb } = require('../db');
const jwt = require('jsonwebtoken');

let token;
let testUserId;
let testReviewId;
let testMovieId = 'test-movie-789';

beforeAll(async () => {
  const usersCol = getDb().collection('users');
  const result = await usersCol.insertOne({ username: 'revtestuser', password: 'hashedpassword' });
  testUserId = result.insertedId;
  token = jwt.sign({ userId: testUserId.toString(), username: 'revtestuser' }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  const usersCol = getDb().collection('users');
  await usersCol.deleteOne({ _id: testUserId });
  const reviewsCol = getDb().collection('reviews');
  if (testReviewId) {
    await reviewsCol.deleteOne({ _id: testReviewId });
  }
});

describe('Reviews API', () => {
  test('Add a review', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ movieId: testMovieId, rating: 8, comment: 'Great movie!' });
    expect(res.statusCode).toBe(201);
    expect(res.body.movieId).toBe(testMovieId);
    testReviewId = res.body._id;
  });

  test('Get reviews for a movie', async () => {
    const res = await request(app)
      .get(`/api/reviews/${testMovieId}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(r => r._id === testReviewId)).toBe(true);
  });

  test('Edit a review', async () => {
    const res = await request(app)
      .put(`/api/reviews/${testReviewId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 9, comment: 'Updated review' });
    expect(res.statusCode).toBe(200);
    expect(res.body.rating).toBe(9);
  });

  test('Delete a review', async () => {
    const res = await request(app)
      .delete(`/api/reviews/${testReviewId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Review deleted');
  });
});

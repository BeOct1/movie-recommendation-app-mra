jest.setTimeout(20000);
const request = require('supertest');
const { client } = require('../server');
const app = require('../server');

beforeAll(async () => {
  // Clean up users collection before tests
  await client.db().collection('users').deleteMany({});
});

afterAll(async () => {
  // Clean up after tests
  await client.db().collection('users').deleteMany({});
  // Do not close client here to avoid teardown errors
});

describe('Auth API', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'testpass' });
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/registered/i);
  });

  it('should not register duplicate user', async () => {
    await request(app).post('/api/auth/register').send({ username: 'testuser2', password: 'testpass' });
    const res = await request(app).post('/api/auth/register').send({ username: 'testuser2', password: 'testpass' });
    expect(res.statusCode).toBe(409);
  });

  it('should login a user', async () => {
    await request(app).post('/api/auth/register').send({ username: 'testuser3', password: 'testpass' });
    const res = await request(app).post('/api/auth/login').send({ username: 'testuser3', password: 'testpass' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

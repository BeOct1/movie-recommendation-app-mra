// Separate entry point to start the server in production or development
const app = require('./server');
const { connectToDatabase } = require('./db');

const PORT = process.env.PORT || 5000;

connectToDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to connect to MongoDB, server not started.', err);
  process.exit(1);
});

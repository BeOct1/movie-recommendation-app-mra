# Deploymentcomm Instructions for Movie Recommendation App

## Frontend Deployment (Vercel or Render)

1. Build the React app for production:

```bash
cd frontend
npm install
npm run build
```

2. Deploy the contents of the `build` folder to Vercel or Render.

3. Set environment variables in the deployment platform:

- `REACT_APP_API_URL`: URL of the deployed backend API (e.g., https://your-backend-url.onrender.com)

4. Ensure the deployment platform serves the static files from the `build` folder.

5. Configure custom domains and HTTPS as needed.

## Backend Deployment (Render)

1. Install dependencies and start the server:

```bash
cd backend
npm install
npm start
```

2. Set environment variables in Render:

- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT signing
- Any other required environment variables

3. Configure CORS in `server.js` to allow your frontend domain.

4. Use HTTPS in production.

## Notes

- Update the frontend `REACT_APP_API_URL` to point to the backend URL after deployment.
- Make sure to configure CORS properly to allow communication between frontend and backend.
- For local development, use `npm start` in both frontend and backend directories.

## Future Enhancements

- Implement social sharing buttons in frontend components.
- Embed movie trailers in movie detail views.
- Convert frontend to a Progressive Web App (PWA) with offline support.
- Develop advanced recommendation algorithms using machine learning in the backend.

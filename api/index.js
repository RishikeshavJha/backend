import app from '../backend/server.js';

// Disable Vercel's default body parser so multer can parse multipart/form-data image uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;

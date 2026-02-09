const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[AUTH] JWT_SECRET not set. Exiting.');
  process.exit(1);
}

module.exports = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    const err = new Error('Unauthorized');
    err.status = 401;
    return next(err);
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (e) {
    const err = new Error('Invalid token');
    err.status = 401;
    return next(err);
  }
};


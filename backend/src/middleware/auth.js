const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, name: user.name }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/** Returns { id, role, name } or throws AppError 401. */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    return { id: Number(payload.sub), role: payload.role, name: payload.name };
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AppError(401, 'Your session has expired. Please log in again.', 'TOKEN_EXPIRED');
    throw AppError.unauthorized();
  }
}

/** Requires "Authorization: Bearer <token>". Sets req.user. */
function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(AppError.unauthorized('Login required.'));
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

/** Usage: requireRole('ADMIN') or requireRole('ADMIN', 'DRIVER'). */
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (!roles.includes(req.user.role)) return next(AppError.forbidden());
  next();
};

module.exports = { signToken, verifyToken, requireAuth, requireRole };

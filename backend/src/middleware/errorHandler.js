const env = require('../config/env');
const AppError = require('../utils/AppError');

function notFound(req, _res, next) {
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found.`, 'NOT_FOUND'));
}

// Translates Postgres constraint errors into friendly messages.
function fromPg(err) {
  switch (err.code) {
    case '23505': return AppError.conflict('That value already exists (duplicate).');
    case '23503': return AppError.badRequest('A linked item does not exist or is still in use.');
    case '23514': return AppError.badRequest('A value is out of the allowed range.');
    case '22P02': return AppError.badRequest('Invalid value format.');
    default: return null;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let appErr = err instanceof AppError ? err : fromPg(err);
  if (!appErr && err.type === 'entity.parse.failed') appErr = AppError.badRequest('Invalid JSON body.');
  if (!appErr) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
    appErr = new AppError(500, 'Something went wrong. Please try again.', 'INTERNAL');
  }
  const body = { error: { code: appErr.code, message: appErr.message } };
  if (appErr.details) body.error.details = appErr.details;
  if (!env.isProd && appErr.status === 500) body.error.debug = err.message; // never in production
  res.status(appErr.status).json(body);
}

module.exports = { notFound, errorHandler };

// An error that is safe to show to the user. Anything else becomes a generic 500.
class AppError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code || 'ERROR';
    this.details = details;
  }
  static badRequest(msg, details) { return new AppError(400, msg, 'BAD_REQUEST', details); }
  static unauthorized(msg = 'Please log in again.') { return new AppError(401, msg, 'UNAUTHORIZED'); }
  static forbidden(msg = 'You do not have permission to do this.') { return new AppError(403, msg, 'FORBIDDEN'); }
  static notFound(what = 'Item') { return new AppError(404, `${what} not found.`, 'NOT_FOUND'); }
  static conflict(msg) { return new AppError(409, msg, 'CONFLICT'); }
}

module.exports = AppError;

const AppError = require('../utils/AppError');

/**
 * validate({ body, query, params }) with zod schemas.
 * Parsed (coerced, trimmed) values replace the originals; express 5 safe.
 */
const validate = (schemas) => (req, _res, next) => {
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(AppError.badRequest('Please check the highlighted fields.', details));
    }
    req.valid = req.valid || {};
    req.valid[key] = result.data;
  }
  next();
};

module.exports = validate;

// Central error handler: logs the error and sends a consistent JSON body.
module.exports = (err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: "Invalid id!" });
  }
  if (err.message === 'Invalid mime type') {
    return res.status(400).json({ message: err.message });
  }
  res.status(err.status || 500).json({ message: err.status ? err.message : "Internal server error!" });
};

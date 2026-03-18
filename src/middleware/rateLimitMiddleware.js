const requestCounts = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.timestamp > 60 * 60 * 1000) {
      requestCounts.delete(key);
    }
  }
}, 60 * 60 * 1000);

export const rateLimit = (maxRequests, timeWindowMinutes) => {
  return (req, res, next) => {
    const key = `${req.ip}-${req.path}`;
    const now = Date.now();
    const timeWindow = timeWindowMinutes * 60 * 1000;

    const requestData = requestCounts.get(key) || {
      count: 0,
      timestamp: now
    };

    if (now - requestData.timestamp > timeWindow) {
      requestData.count = 0;
      requestData.timestamp = now;
    }

    requestData.count++;

    if (requestData.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message: `Too many requests. Please try after ${timeWindowMinutes} minutes.`
      });
    }

    requestCounts.set(key, requestData);
    next();
  };
};
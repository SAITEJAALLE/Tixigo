import jwt from 'jsonwebtoken';
const secret = process.env.JWT_SECRET || 'dev_secret';
export function requireAuth(req, res, next){
  const hdr = req.headers.authorization;
  if (!hdr) return res.status(401).json({ error: 'Missing auth header' });
  const token = hdr.split(' ')[1];
  try { req.user = jwt.verify(token, secret); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}
export function requireRole(roles){
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

import jwt from 'jsonwebtoken';
const secret = process.env.JWT_SECRET || 'dev_secret';
export function sign(payload, expiresIn='7d'){ return jwt.sign(payload, secret, { expiresIn }); }
export function verify(token){ return jwt.verify(token, secret); }

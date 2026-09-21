import jwt, { SignOptions } from 'jsonwebtoken';
import { ENV } from '../config/env';
import { IUser } from '../models/User';

export interface JwtPayload {
  sub: string;
  role: IUser['role'];
}

export const signAccessToken = (user: IUser) => {
  const payload: JwtPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, ENV.JWT_ACCESS_SECRET, {
    expiresIn: ENV.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
};

export const signRefreshToken = (user: IUser) => {
  const payload: JwtPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, {
    expiresIn: ENV.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, ENV.JWT_ACCESS_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as JwtPayload;
};



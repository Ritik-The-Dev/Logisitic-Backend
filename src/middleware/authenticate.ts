// middlewares/authenticated.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { JWT_SECRET_ACCESS } from '../config/constant';
import USER, { IUser } from '../models/users.model';
import { errorHandler } from '../utils/response-handler';

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

export const authenticated = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        let token = req.headers.authorization || req.headers.Authorization || req.cookies.auth_token;
        if (!token || typeof token !== 'string') {
            res.status(401).json(errorHandler('Not logged in'));
            return;
        }

        token = token.replace(/Bearer\s?/i, '').replace(/"/g, '');
        const decoded = jwt.verify(token, JWT_SECRET_ACCESS || '') as JwtPayload;

        if (!decoded || !decoded.id) {
            res.status(401).json(errorHandler('Invalid token'));
            return;
        }

        const user = await USER.findById(decoded.id).select('-password').exec();
        if (!user) {
            res.status(404).json(errorHandler('User not found'));
            return;
        }

        req.user = user;
        next();
    } catch (error: any) {
        console.error('Authentication error:', error);
        res.status(401).json(errorHandler('Invalid token'));
        return;
    }
};


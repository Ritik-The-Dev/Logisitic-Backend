import jwt, { JwtPayload } from 'jsonwebtoken';
import { JWT_SECRET_ACCESS, JWT_SECRET_REFRESH } from '../config/constant';

const ACCESS_TOKEN_SECRET = JWT_SECRET_ACCESS;
const REFRESH_TOKEN_SECRET = JWT_SECRET_REFRESH;

interface TokenCallback<T> {
    (result: {
        status: boolean;
        data?: T;
        message?: string;
        code?: number;
    }): void;
}

interface DecodedToken extends JwtPayload {
    name: string;
}

// Encode Access Token
export function accessTokenEncode(userData: object): string {
    return jwt.sign(
        userData,
        ACCESS_TOKEN_SECRET,
        { expiresIn: '30d' }
    );
}

// Encode Refresh Token
export function refreshTokenEncode(userData: object): string {
    return jwt.sign(
        userData,
        REFRESH_TOKEN_SECRET,
        { expiresIn: '2 days' }
    );
}

// Decode Access Token with callback
export function accessTokenDecode(fn: TokenCallback<DecodedToken>, access_token: string): void {
    try {
        const decoded = jwt.verify(access_token, ACCESS_TOKEN_SECRET) as DecodedToken;
        fn({ status: true, data: decoded });
    } catch (err: any) {
        console.error(err, "error");
        fn({ status: false, message: err.message, code: 403 });
    }
}


// Decode Refresh Token with callback
export function refreshTokenDecode(fn: TokenCallback<DecodedToken>, refresh_token: string): void {
    try {
        const decoded = jwt.verify(refresh_token, REFRESH_TOKEN_SECRET) as DecodedToken;
        fn({ status: true, data: decoded });
    } catch (err: any) {
        fn({ status: false, message: err.message, code: 403 });
    }
}
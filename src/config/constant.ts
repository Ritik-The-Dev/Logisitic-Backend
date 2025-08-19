/* Dotenv Package */
import dotenv from 'dotenv';
dotenv.config();

/* Environment Constants */
export const DB_URL = process.env.DB_URL;
export const PORT = process.env.PORT || 3000;
export const DB_USER = process.env.DB_USER;
export const DB_PASSWORD = process.env.DB_PASSWORD;
export const JWT_SECRET_ACCESS = process.env.JWT_SECRET_ACCESS || "QWERTYUIOPASDTDFVXFD";
export const JWT_SECRET_REFRESH = process.env.JWT_SECRET_REFRESH || "QWERTYUIOPASFHGCFVB";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
export const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
export const NODE_ENVIRONMENT = process.env.NODE_ENVIRONMENT || "Production";
export const RUNNING_PROTOCOL = process.env.RUNNING_PROTOCOL || "https";
export const SWAGGER_HOST = process.env.SWAGGER_HOST || 'api.chawlalogistics.xyz';

/* Constants */
export const SUCESS = "SUCESS";
export const FAILED = "FAILED";
export const NOT_FOUND = "NOT_FOUND";

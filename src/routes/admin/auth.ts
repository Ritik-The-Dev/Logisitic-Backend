/* Packages */
import express, { Request, Response } from 'express';
import authController from '../../controller/admin/auth';

const authRouter = express.Router();

/* Routes */
authRouter.post('/login', (req: Request, res: Response) => {
    authController.login(req, res);
});

authRouter.post('/access_token', (req: Request, res: Response) => {
    authController.getAccessTokenByRefreshToken(req, res);
});

authRouter.post('/otp/login', (req: Request, res: Response) => {
    authController.loginWithOtp(req, res);
});

authRouter.get('/user', (req: Request, res: Response) => {
    authController.getUserByCookieToken(req, res);
});

authRouter.get('/logout', (req: Request, res: Response) => {
    authController.userLogoutFromCookie(req, res);
});

/* Export the router */
export default authRouter;

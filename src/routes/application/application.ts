/* Packages */
import express, { Request, Response } from 'express';
import appAuthController from '../../controller/application/auth';
import vehicleAppsRouter from './vehicle';
import driverLocationRouter from './driver_location';
import tripRouter from './trip';

const appAuthRouter = express.Router();

/* Routes */
appAuthRouter.post('/login', (req: Request, res: Response) => {
    appAuthController.login(req, res);
});

appAuthRouter.post('/google/login', (req: Request, res: Response) => {
    appAuthController.googleLogin(req, res);
});

appAuthRouter.use('/trip', tripRouter);
appAuthRouter.use('/vehicle', vehicleAppsRouter);
appAuthRouter.use('/driver_location', driverLocationRouter);

/* Export the router */
export default appAuthRouter;

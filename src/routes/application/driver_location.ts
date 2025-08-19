/* Packages */
import express, { Request, Response } from 'express';
import driverLocationController from '../../controller/application/driver_location';
import { authenticated } from '../../middleware/authenticate';

const driverLocationRouter = express.Router();

/* Routes */
driverLocationRouter.post('/', authenticated, (req: Request, res: Response) => {
    driverLocationController.createDriverLocation(req, res);
});

driverLocationRouter.get('/', authenticated, (req: Request, res: Response) => {
    driverLocationController.fetchDriverLocations(req, res);
});

driverLocationRouter.get('/user/:user_id', authenticated, (req: Request, res: Response) => {
    driverLocationController.fetchCurrentDriverLocation(req, res);
});

driverLocationRouter.get('/:id', authenticated, (req: Request, res: Response) => {
    driverLocationController.fetchDriverLocation(req, res);
});

driverLocationRouter.put('/:id', authenticated, (req: Request, res: Response) => {
    driverLocationController.editDriverLocation(req, res);
});

driverLocationRouter.delete('/:id', authenticated, (req: Request, res: Response) => {
    driverLocationController.deleteDriverLocation(req, res);
});

/* Export the router */
export default driverLocationRouter;

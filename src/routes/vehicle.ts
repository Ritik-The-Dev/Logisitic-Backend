/* Packages */
import express, { Request, Response } from 'express';
import vehicleController from '../controller/vehicle';
import { authenticated } from '../middleware/authenticate';
import { appUploadCustomerImage } from '../helper/application/multer';

const vehicleRouter = express.Router();

/* Routes */
vehicleRouter.post('/', authenticated, appUploadCustomerImage.single("vehicle_image"), (req: Request, res: Response) => {
    vehicleController.createVehicle(req, res);
});

vehicleRouter.get('/', authenticated, (req: Request, res: Response) => {
    vehicleController.fetchVehicles(req, res);
});

vehicleRouter.get('/documents/:vehicle_id', authenticated, (req: Request, res: Response) => {
    vehicleController.fetchVehicleDocumentsByVehicleID(req, res);
});


vehicleRouter.get('/:id', authenticated, (req: Request, res: Response) => {
    vehicleController.fetchVehicle(req, res);
});

vehicleRouter.put('/:id', authenticated, appUploadCustomerImage.single("vehicle_image"), (req: Request, res: Response) => {
    vehicleController.editVehicle(req, res);
});

vehicleRouter.delete('/:id', authenticated, (req: Request, res: Response) => {
    vehicleController.deleteVehicle(req, res);
});

/* Export the router */
export default vehicleRouter;

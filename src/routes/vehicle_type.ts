/* Packages */
import express, { Request, Response } from 'express';
import vehicleTypeController from '../controller/vehicle_type';
import { authenticated } from '../middleware/authenticate';
import { appUploadCustomerImage } from '../helper/application/multer';

const vehicleTypeRouter = express.Router();

/* Routes */
vehicleTypeRouter.post('/', authenticated, appUploadCustomerImage.single("vehicle_image"), (req: Request, res: Response) => {
    vehicleTypeController.createVehicleType(req, res);
});

vehicleTypeRouter.get('/', authenticated, (req: Request, res: Response) => {
    vehicleTypeController.fetchVehicleTypes(req, res);
});

vehicleTypeRouter.get('/drivers', authenticated, (req: Request, res: Response) => {
    vehicleTypeController.fetchVehicleDriver(req, res);
});

vehicleTypeRouter.get('/:id', authenticated, (req: Request, res: Response) => {
    vehicleTypeController.fetchVehicleType(req, res);
});

vehicleTypeRouter.put('/:id', authenticated, appUploadCustomerImage.single("vehicle_image"), (req: Request, res: Response) => {
    vehicleTypeController.editVehicleType(req, res);
});

vehicleTypeRouter.delete('/:id', authenticated, (req: Request, res: Response) => {
    vehicleTypeController.deleteVehicleType(req, res);
});

/* Export the router */
export default vehicleTypeRouter;

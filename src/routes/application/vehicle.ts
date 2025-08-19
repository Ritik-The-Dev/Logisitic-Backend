/* Packages */
import express, { Request, Response } from 'express';
import vehicleAppsController from '../../controller/application/vehicle';
import { authenticated } from '../../middleware/authenticate';
import { appUploadCustomerImage } from '../../helper/application/multer'

const vehicleAppsRouter = express.Router();

/* Routes */
vehicleAppsRouter.post('/', authenticated,
    // appUploadCustomerImage.fields([
    //     { name: 'driving_licence', maxCount: 1 },
    //     { name: 'insurance', maxCount: 1 },
    //     { name: 'puc_certificate', maxCount: 1 },
    //     { name: 'vehicle_image', maxCount: 1 },
    // ]),
    (req: Request, res: Response) => {
        vehicleAppsController.createVehicle(req, res);
    });

/* Export the router */
export default vehicleAppsRouter;

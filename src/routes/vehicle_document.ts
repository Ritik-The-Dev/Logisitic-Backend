/* Packages */
import express, { Request, Response } from 'express';
import vehicleDocumentController from '../controller/vehicle_document';
import { authenticated } from '../middleware/authenticate';
import { appUploadCustomerImage } from '../helper/application/multer';

const vehicleDocumentRouter = express.Router();

/* Routes */
vehicleDocumentRouter.post('/', authenticated, appUploadCustomerImage.fields([
    { name: 'doc_front_image', maxCount: 1 },
    { name: 'doc_back_image', maxCount: 1 }
]), (req: Request, res: Response) => {
    vehicleDocumentController.createVehicleDocument(req, res);
});

vehicleDocumentRouter.get('/', authenticated, (req: Request, res: Response) => {
    vehicleDocumentController.fetchVehicleDocuments(req, res);
});

vehicleDocumentRouter.get('/:id', authenticated, (req: Request, res: Response) => {
    vehicleDocumentController.fetchVehicleDocument(req, res);
});

vehicleDocumentRouter.put('/:id', authenticated, appUploadCustomerImage.fields([
    { name: 'doc_front_image', maxCount: 1 },
    { name: 'doc_back_image', maxCount: 1 }
]), (req: Request, res: Response) => {
    vehicleDocumentController.editVehicleDocument(req, res);
});

vehicleDocumentRouter.delete('/:id', authenticated, (req: Request, res: Response) => {
    vehicleDocumentController.deleteVehicleDocument(req, res);
});

/* Export the router */
export default vehicleDocumentRouter;

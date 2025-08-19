/* Packages */
import express, { Request, Response } from 'express';
import materialBoxController from '../controller/material_box';
import { authenticated } from '../middleware/authenticate';
import { appUploadCustomerImage } from '../helper/application/multer';

const materialBoxRouter = express.Router();

/* Routes */
materialBoxRouter.post('/', authenticated, appUploadCustomerImage.single("box_image"), (req: Request, res: Response) => {
    materialBoxController.createMaterialBox(req, res);
});

materialBoxRouter.get('/', authenticated, (req: Request, res: Response) => {
    materialBoxController.fetchMaterialBoxes(req, res);
});

materialBoxRouter.get('/:id', authenticated, (req: Request, res: Response) => {
    materialBoxController.fetchMaterialBox(req, res);
});

materialBoxRouter.put('/:id', authenticated, appUploadCustomerImage.single("box_image"), (req: Request, res: Response) => {
    materialBoxController.editMaterialBox(req, res);
});

materialBoxRouter.delete('/:id', authenticated, (req: Request, res: Response) => {
    materialBoxController.deleteMaterialBox(req, res);
});

/* Export the router */
export default materialBoxRouter;

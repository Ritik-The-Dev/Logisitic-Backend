/* Packages */
import express, { Request, Response } from 'express';
import adminController from '../../controller/admin/admin';
import { adminAuthenticated } from '../../middleware/adminAuthenticae';

const adminRouter = express.Router();

/* Routes */
adminRouter.post('/', (req: Request, res: Response) => {
    adminController.createAdmin(req, res);
});

adminRouter.get('/users', adminAuthenticated, (req: Request, res: Response) => {
    adminController.fetchAllUser(req, res);
});

adminRouter.get('/:id', adminAuthenticated, (req: Request, res: Response) => {
    adminController.fetchAdmin(req, res);
});

adminRouter.put('/:id', adminAuthenticated, (req: Request, res: Response) => {
    adminController.editAdmin(req, res);
});

adminRouter.delete('/:id', adminAuthenticated, (req: Request, res: Response) => {
    adminController.deleteAdmin(req, res);
});

adminRouter.post('/upload', (req: Request, res: Response) => {
    adminController.uploadImage(req, res);
});

/* Export the router */
export default adminRouter;

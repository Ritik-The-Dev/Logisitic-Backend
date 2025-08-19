/* Packages */
import express, { Request, Response } from 'express';
import multer from 'multer';
import userController from '../../controller/admin/user';
import { authenticated } from '../../middleware/authenticate';
import { appUploadCustomerImage } from '../../helper/application/multer';

const userRouter = express.Router();

/* Routes */
userRouter.post('/', appUploadCustomerImage.fields([
    { name: 'profile', maxCount: 1 }]), (req: Request, res: Response) => {
        userController.createUser(req, res);
    });

userRouter.post('/credits/add', authenticated, (req: Request, res: Response) => {
    userController.createUserCredit(req, res);
});

userRouter.get('/credits', authenticated, (req: Request, res: Response) => {
    userController.fetchUserCredits(req, res);
});

userRouter.delete('/credits/:credit_id', authenticated, (req: Request, res: Response) => {
    userController.deleteUserCredit(req, res);
});

userRouter.get('/:id', authenticated, (req: Request, res: Response) => {
    userController.fetchUser(req, res);
});

userRouter.get('/:user_id/vehicle', authenticated, (req: Request, res: Response) => {
    userController.fetchVehicleDetailByUserID(req, res);
});

userRouter.put('/:id', authenticated, appUploadCustomerImage.fields([
    { name: 'profile', maxCount: 1 }]), (req: Request, res: Response) => {
        userController.editUser(req, res);
    });

userRouter.delete('/:id', authenticated, (req: Request, res: Response) => {
    userController.deleteUser(req, res);
});

userRouter.post('/upload', (req: Request, res: Response) => {
    userController.uploadImage(req, res);
});

/* Export the router */
export default userRouter;

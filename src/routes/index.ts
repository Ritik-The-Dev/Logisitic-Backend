/* Packages */
import { Router } from 'express';
import authRouter from './admin/auth';
import userRouter from './admin/user';
import adminRouter from './admin/admin';
import vehicleRouter from './vehicle';
import vehicleTypeRouter from './vehicle_type';
import vehicleDocumentRouter from './vehicle_document';
import appAuthRouter from './application/application';
import materialBoxRouter from './material_box';
import tripRouter from './application/trip';

const router = Router();

/* Routes */
router.use('/auth', authRouter);
router.use('/admins', adminRouter);
router.use('/users', userRouter);
router.use('/vehicle', vehicleRouter);
router.use('/vehicle_type', vehicleTypeRouter);
router.use('/vehicle_document', vehicleDocumentRouter);
router.use('/material_box', materialBoxRouter);
router.use('/trips', tripRouter);

/* Application Routes */
router.use('/apps', appAuthRouter);

/* Export the router */
export default router;

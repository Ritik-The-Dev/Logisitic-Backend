/* Packages */
import express, { Request, Response } from 'express';
import tripController from '../../controller/application/trip';
import { authenticated } from '../../middleware/authenticate';
import { adminAuthenticated } from '../../middleware/adminAuthenticae';

const tripRouter = express.Router();

/* Routes */
tripRouter.post('/', authenticated, (req: Request, res: Response) => {
    tripController.createTrip(req, res);
});

tripRouter.get('/', authenticated, (req: Request, res: Response) => {
    tripController.fetchTrips(req, res);
});

tripRouter.post('/admin', authenticated, (req: Request, res: Response) => {
    tripController.createTripByAdmin(req, res);
});

tripRouter.get('/all-notifications', authenticated, (req: Request, res: Response) => {
    tripController.fetchAllNotifications(req, res);
});

tripRouter.post('/manual-assigned', adminAuthenticated, (req: Request, res: Response) => {
    tripController.manuallyAssignedDriver(req, res);
});

tripRouter.get('/retry/:trip_id', authenticated, (req: Request, res: Response) => {
    tripController.retryTrip(req, res);
});

tripRouter.post('/notify/:driver_id', authenticated, (req: Request, res: Response) => {
    tripController.notifyMessage(req, res);
});

tripRouter.get('/reminder', (req: Request, res: Response) => {
    tripController.sendNotificationToScheduleTrips(req, res);
});
 
tripRouter.post('/respond', authenticated, (req: Request, res: Response) => {
    tripController.respondToTripRequest(req, res);
});

tripRouter.get('/custom-search', authenticated, (req: Request, res: Response) => {
    tripController.fetchTripsByUserFilter(req, res);
});

tripRouter.get('/test-notification', authenticated, (req: Request, res: Response) => {
    tripController.testNotification(req, res);
});

tripRouter.get('/nearby-drivers', authenticated, (req: Request, res: Response) => {
    tripController.findNearbyDrivers(req, res);
});

tripRouter.get('/:id', authenticated, (req: Request, res: Response) => {
    tripController.fetchTrip(req, res);
});

tripRouter.put('/:id', authenticated, (req: Request, res: Response) => {
    tripController.editTrip(req, res);
});

tripRouter.delete('/:id', authenticated, (req: Request, res: Response) => {
    tripController.deleteTrip(req, res);
});

/* Export the router */
export default tripRouter;

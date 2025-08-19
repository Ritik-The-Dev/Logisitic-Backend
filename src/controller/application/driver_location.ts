import { Request, Response } from 'express';
import { successHandler, errorHandler } from '../../utils/response-handler';
import DriverLocation from '../../models/driver/driver_location.model';
import User from '../../models/users.model';

const driverLocationController = {
    async createDriverLocation(req: Request, res: Response): Promise<Response> {
        try {
            const { user, latitude, longitude } = req.body;

            if (!user || latitude === undefined || longitude === undefined) {
                return res.status(400).send(errorHandler('User ID, latitude and longitude are required'));
            }

            const user_exist = await User.findById(user);
            if (!user_exist) {
                return res.status(404).send(errorHandler('User not found'));
            }
            if (user_exist.type != "driver") {
                return res.status(404).send(errorHandler('Given user is not driver'));
            }

            const newDriverLocation = new DriverLocation({
                user,
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude] 
                },
                latitude,
                longitude
            });

            const savedLocation = await newDriverLocation.save();
            return res.status(201).send(successHandler('Driver location created successfully', savedLocation));
        } catch (error) {
            console.error('Error creating Driver location:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchDriverLocations(req: Request, res: Response): Promise<Response> {
        try {
            const { page = '1', limit = '10', user } = req.query;
            const pageNum = Math.max(parseInt(page as string) || 1, 1);
            const limitNum = Math.max(parseInt(limit as string) || 10, 1);
            const offset = (pageNum - 1) * limitNum;

            const query: any = {};

            if (user) {
                query.user = user;
            }

            const locations = await DriverLocation.find(query)
                .skip(offset)
                .limit(limitNum)
                .populate({
                    path: 'user',
                    select: 'fullname email contact_no'
                })
                .lean()
                .sort({ updatedAt: -1 });

            const totalLocations = await DriverLocation.countDocuments(query);

            return res.status(200).send(successHandler('Driver locations fetched successfully', locations, {
                totalLocations,
                currentPage: pageNum,
                totalPages: Math.ceil(totalLocations / limitNum),
                userFilter: user || undefined
            }));

        } catch (error) {
            console.error('Error fetching Driver locations:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchDriverLocation(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing driver location id'));
            }

            const location = await DriverLocation.findById(id)
                .populate({
                    path: 'user',
                    select: 'fullname email contact_no'
                })
                .lean();

            if (!location) {
                return res.status(404).send(errorHandler('Driver location not found'));
            }

            return res.status(200).send(successHandler('Driver location fetched successfully', location));
        } catch (error) {
            console.error('Error fetching Driver location:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchCurrentDriverLocation(req: Request, res: Response): Promise<Response> {
        try {
            const { user_id } = req.params;
            if (!user_id) {
                return res.status(400).send(errorHandler('Missing driver id'));
            }

            const location = await DriverLocation.findOne({ user: user_id })
                .populate({
                    path: 'user',
                    select: 'fullname email contact_no'
                })
                .sort({ updatedAt: -1 })
                .lean();

            if (!location) {
                return res.status(404).send(errorHandler('Driver location not found'));
            }

            return res.status(200).send(successHandler('Driver location fetched successfully', location));
        } catch (error) {
            console.error('Error fetching Driver location:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async editDriverLocation(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing driver location ID'));
            }

            const { latitude, longitude } = req.body;

            if (latitude === undefined || longitude === undefined) {
                return res.status(400).send(errorHandler('Latitude and longitude are required'));
            }

            const updatedData = {
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                latitude, 
                longitude,
                updatedAt: Date.now(),
            };

            const updatedLocation = await DriverLocation.findByIdAndUpdate(
                id,
                updatedData,
                { new: true }
            ).populate({
                path: 'user',
                select: 'fullname email contact_no'
            });

            if (!updatedLocation) {
                return res.status(404).send(errorHandler('Driver location not found'));
            }

            return res.status(200).send(successHandler('Driver location updated successfully', updatedLocation));
        } catch (error) {
            console.error('Error updating Driver location:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async deleteDriverLocation(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Invalid driver location id'));
            }

            const deletedLocation = await DriverLocation.findByIdAndDelete(id);
            if (!deletedLocation) {
                return res.status(404).send(errorHandler('Driver location not found'));
            }

            return res.status(200).send(successHandler('Driver location deleted successfully', deletedLocation));
        } catch (error) {
            console.error('Error deleting Driver location:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    }
}

export default driverLocationController;
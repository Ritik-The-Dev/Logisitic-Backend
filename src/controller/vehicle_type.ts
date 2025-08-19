import { Request, Response } from 'express';
import { successHandler, errorHandler } from '../utils/response-handler';
import User from '../models/users.model';
import VehicleType from '../models/driver/vehicle_type.model';
import Vehicle from '../models/driver/vehicle.model';
import { RUNNING_PROTOCOL, NODE_ENVIRONMENT } from '../config/constant';
import fs from 'fs/promises';

const vehicleTypeController = {
    async createVehicleType(req: Request, res: Response): Promise<Response> {
        try {
            const { name, wheeler, capacity, unit, customer_base_fare, customer_km_fare, customer_base_fare_margin, customer_km_fare_margin, driver_base_fare, driver_km_fare, driver_base_fare_margin, driver_km_fare_margin } = req.body;

            if (!name || !wheeler) {
                return res.status(400).send(errorHandler('Name and wheeler are required fields'));
            }

            let vehicle_image = "";
            if (req.file) {
                vehicle_image = `${RUNNING_PROTOCOL}://${req.get('host')}${req.file!.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
            }

            const newVehicleType = new VehicleType({
                name,
                wheeler,
                capacity,
                unit,
                customer_base_fare,
                customer_km_fare,
                customer_base_fare_margin,
                customer_km_fare_margin,
                driver_base_fare,
                driver_km_fare,
                driver_base_fare_margin,
                driver_km_fare_margin,
                vehicle_image
            });

            const vehicleType = await newVehicleType.save();
            return res.status(201).send(successHandler('Vehicle type created successfully', vehicleType));
        } catch (error) {
            console.error('Error creating vehicle type:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async editVehicleType(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing vehicle type ID'));
            }

            let previousVehicleTypeData = await VehicleType.findById(id);
            if (!previousVehicleTypeData) {
                return res.status(404).send(errorHandler('Vehicle type not found'));
            }

            let vehicle_image = "";
            let new_file_path = "";
            if (req.file) {
                new_file_path = `${RUNNING_PROTOCOL}://${req.get('host')}${req.file!.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
                vehicle_image = new_file_path;
                try {
                    if (previousVehicleTypeData.vehicle_image != "") {
                        if (new_file_path != previousVehicleTypeData.vehicle_image) {
                            let upload_directory = previousVehicleTypeData.vehicle_image.split('/storage')[1];
                            await fs.unlink(__dirname.replace("/controller", "/storage") + upload_directory);
                        }
                    }
                } catch (error) {
                    console.log('File not exist to remove');
                }
            } else {
                vehicle_image = previousVehicleTypeData.vehicle_image;
            }

            const { name, wheeler, capacity, unit, customer_base_fare, customer_km_fare, customer_base_fare_margin, customer_km_fare_margin, driver_base_fare, driver_km_fare, driver_base_fare_margin, driver_km_fare_margin } = req.body;

            const updatedData = {
                name,
                wheeler,
                capacity,
                unit,
                customer_base_fare,
                customer_km_fare,
                customer_base_fare_margin,
                customer_km_fare_margin,
                driver_base_fare,
                driver_km_fare,
                driver_base_fare_margin,
                driver_km_fare_margin,
                vehicle_image,
                updatedAt: Date.now(),
            };

            const updatedVehicleType = await VehicleType.findByIdAndUpdate(id, updatedData, { new: true });

            return res.status(200).send(successHandler('Vehicle type updated successfully', updatedVehicleType));
        } catch (error) {
            console.error('Error updating vehicle type:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async fetchVehicleType(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing vehicle type ID'));
            }

            const vehicleType = await VehicleType.findById(id).lean();

            if (!vehicleType) {
                return res.status(404).send(errorHandler('Vehicle type not found'));
            }

            return res.status(200).send(successHandler('Vehicle type fetched successfully', vehicleType));
        } catch (error) {
            console.error('Error fetching vehicle type:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchVehicleTypes(req: Request, res: Response): Promise<Response> {
        try {
            const { page = '1', limit = '10', search = '', weight } = req.query;
            const pageNum = Math.max(parseInt(page as string) || 1, 1);
            const limitNum = Math.max(parseInt(limit as string) || 10, 1);
            const offset = (pageNum - 1) * limitNum;
            const searchText = (search as string).trim();
            const weightNum = weight ? parseFloat(weight as string) : null;

            const query: any = {};

            if (searchText && searchText.length >= 3) {
                query.$or = [
                    { name: { $regex: searchText, $options: 'i' } },
                    { wheeler: isNaN(Number(searchText)) ? null : Number(searchText) },
                ].filter(Boolean);
            }

            if (weightNum && weightNum > 0) {
                query.capacity = { $gte: weightNum };
            }

            const vehicleTypes = await VehicleType.find(query)
                .skip(offset)
                .limit(limitNum)
                .lean()
                .sort({ createdAt: -1 });

            const totalVehicleTypes = await VehicleType.countDocuments(query);

            return res.status(200).send(successHandler('Vehicle types fetched successfully', vehicleTypes, {
                totalVehicleTypes,
                currentPage: pageNum,
                totalPages: Math.ceil(totalVehicleTypes / limitNum),
                searchQuery: searchText || undefined
            }));

        } catch (error) {
            console.error('Error fetching vehicle types:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async deleteVehicleType(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Invalid vehicle type ID'));
            }

            let previousVehicleTypeData = await VehicleType.findById(id);

            if (!previousVehicleTypeData) {
                return res.status(404).send(errorHandler('Vehicle type not found'));
            }

            if (previousVehicleTypeData.vehicle_image != "") {
                try {
                    let upload_directory = previousVehicleTypeData.vehicle_image.split('/storage')[1];
                    await fs.unlink(__dirname.replace("/controller", "/storage") + upload_directory);
                } catch (error) {
                    console.log('File not exist to remove');
                }
            }

            // Check if any vehicles are using this type before deletion
            const vehiclesUsingType = await Vehicle.countDocuments({ vehicle_type: id });
            if (vehiclesUsingType > 0) {
                return res.status(400).send(errorHandler('Cannot delete vehicle type as it is being used by vehicles'));
            }

            const deletedVehicleType = await VehicleType.findByIdAndDelete(id);
            if (!deletedVehicleType) {
                return res.status(404).send(errorHandler('Vehicle type not found'));
            }

            return res.status(200).send(successHandler('Vehicle type deleted successfully', deletedVehicleType));
        } catch (error) {
            console.error('Error deleting vehicle type:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchVehicleDriver(req: Request, res: Response): Promise<Response> {
        try {
            if (!req.query.type) {
                return res.status(404).send(errorHandler('Required field is missing'));
            }
            if (req.query.vehicle_type) {
                const vehicle_list = await Vehicle.find({ vehicle_type: req.query.vehicle_type });
                const users_ = vehicle_list.map((ele) => ele.user.toString());
                const users = await User.find({
                    type: req.query.type,
                    _id: { '$in': users_ },
                    "status": "active"
                })
                    .select('username fullname email status type')
                    .lean();
                return res.status(200).send(successHandler('Users fetched successfully', users));
            } else {
                const users = await User.find({
                    type: req.query.type
                })
                    .select('username fullname email status type')
                    .lean();
                return res.status(200).send(successHandler('Users fetched successfully', users));
            }

        } catch (error) {
            console.error('Error fetching vehicle type:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    }

}

export default vehicleTypeController;
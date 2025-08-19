import { Request, Response } from 'express';
import { successHandler, errorHandler } from '../utils/response-handler';
import User from '../models/users.model';
import Vehicle from '../models/driver/vehicle.model';
import VehicleDocument from '../models/driver/vehicle_document.model';
import VehicleType from '../models/driver/vehicle_type.model';
import fs from 'fs/promises';
import { RUNNING_PROTOCOL, NODE_ENVIRONMENT } from '../config/constant';

const vehicleController = {
    async createVehicle(req: Request, res: Response): Promise<Response> {
        try {
            const { vehicle_type, vehicle_no, weight, length, width, height, documents, status, user } = req.body;

            if (!vehicle_type || !vehicle_no) {
                return res.status(400).send(errorHandler('Missing required fields'));
            }

            let vehicle_image = "";
            if (req.file) {
                vehicle_image = `${RUNNING_PROTOCOL}://${req.get('host')}${req.file!.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
            }

            const newVehicle = new Vehicle({
                user: req.user!.type == "driver" ? req.user!.id : user,
                vehicle_type,
                vehicle_no,
                weight,
                length,
                width,
                height,
                documents,
                vehicle_image,
                status,
            });

            const vehicle = await newVehicle.save();
            await User.findByIdAndUpdate(req.user!.type == "driver" ? req.user!.id || req.user!._id : user, { $addToSet: { vehicle_detail: vehicle._id || vehicle.id } }, { new: true });
            return res.status(201).send(successHandler('Vehicle created successfully', vehicle));
        } catch (error) {
            console.error('Error creating vehicle:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async editVehicle(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing vehicle ID'));
            }

            let previousVehicleData = await Vehicle.findById(id);
            if (!previousVehicleData) {
                return res.status(404).send(errorHandler('Vehicle not found'));
            }

            let vehicle_image = "";
            let new_file_path = "";
            if (req.file) {
                new_file_path = `${RUNNING_PROTOCOL}://${req.get('host')}${req.file!.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
                vehicle_image = new_file_path;
                try {
                    if (previousVehicleData.vehicle_image != "") {
                        if (new_file_path != previousVehicleData.vehicle_image) {
                            let upload_directory = previousVehicleData.vehicle_image.split('/storage')[1];
                            await fs.unlink(__dirname.replace("/controller", "/storage") + upload_directory);
                        }
                    }
                } catch (error) {
                    console.log('File not exist to remove');
                }
            } else {
                vehicle_image = previousVehicleData.vehicle_image;
            }

            const { user, vehicle_type, vehicle_no, weight, length, width, height, documents, status, } = req.body;

            const updatedData = {
                user,
                vehicle_type,
                vehicle_no,
                weight,
                length,
                width,
                height,
                documents,
                status,
                vehicle_image,
                updatedAt: Date.now(),
            };

            const updatedVehicle = await Vehicle.findByIdAndUpdate(id, updatedData, { new: true });
            if (!updatedVehicle) {
                return res.status(404).send(errorHandler('Vehicle not found'));
            }

            return res.status(200).send(successHandler('Vehicle updated successfully', updatedVehicle));
        } catch (error) {
            console.error('Error updating vehicle:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async fetchVehicle(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing vehicle ID'));
            }

            const vehicle = await Vehicle.findById(id).populate({
                path: 'user',
                select: 'name email fullname username type status createdAt contact_no postal_code profile'
            })
                .populate({
                    path: 'documents',
                    select: 'doc_no  doc_front_image doc_back_image document_type is_approved approved_status'
                })
                .populate({
                    path: 'vehicle_type',
                    select: '_id name vehicle_image unit capacity'
                })
                .lean();

            if (!vehicle) {
                return res.status(404).send(errorHandler('Vehicle not found'));
            }

            return res.status(200).send(successHandler('Vehicle fetched successfully', vehicle));
        } catch (error) {
            console.error('Error fetching vehicle:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    // async fetchVehicles(req: Request, res: Response): Promise<Response> {
    //     try {
    //         const { page = '1', limit = '10', user, search = '' } = req.query;
    //         const pageNum = Math.max(parseInt(page as string) || 1, 1);
    //         const limitNum = Math.max(parseInt(limit as string) || 10, 1);
    //         const offset = (pageNum - 1) * limitNum;
    //         const searchText = (search as string).trim();

    //         const query: any = {};

    //         if (user) {
    //             query.user = user;
    //         }

    //         if (searchText && searchText.length >= 3) {
    //             query.$or = [
    //                 { vehicle_no: { $regex: searchText, $options: 'i' } },
    //             ];
    //         }

    //         const vehicles = await Vehicle.find(query)
    //             .skip(offset)
    //             .limit(limitNum)
    //             .populate({
    //                 path: 'user',
    //                 select: 'name email fullname username type status'
    //             })
    //             .populate({
    //                 path: 'vehicle_type',
    //                 select: '_id name vehicle_image'
    //             })
    //             .lean()
    //             .sort({ createdAt: -1 });

    //         const totalVehicles = await Vehicle.countDocuments(query);

    //         return res.status(200).send(successHandler('Vehicles fetched successfully', vehicles, {
    //             totalVehicles,
    //             currentPage: pageNum,
    //             totalPages: Math.ceil(totalVehicles / limitNum),
    //             searchQuery: searchText || undefined
    //         }));

    //     } catch (error) {
    //         console.error('Error fetching vehicles:', error);
    //         return res.status(500).send(errorHandler('Internal Server Error', error));
    //     }
    // },

    async fetchVehicles(req: Request, res: Response): Promise<Response> {
        try {
            const { page = '1', limit = '10', user, search = '', weight } = req.query;
            const pageNum = Math.max(parseInt(page as string) || 1, 1);
            const limitNum = Math.max(parseInt(limit as string) || 10, 1);
            const offset = (pageNum - 1) * limitNum;
            const searchText = (search as string).trim();
            const weightNum = weight ? parseFloat(weight as string) : null;

            const query: any = {};

            if (user) {
                query.user = user;
            }

            if (searchText && searchText.length >= 3) {
                query.$or = [
                    { vehicle_no: { $regex: searchText, $options: 'i' } },
                ];
            }

            let vehicleTypeQuery: any = {};
            if (weightNum && weightNum > 0) {
                vehicleTypeQuery.capacity = { $gte: weightNum };
            }

            const suitableVehicleTypes = await VehicleType.find(vehicleTypeQuery).select('_id');
            const suitableVehicleTypeIds = suitableVehicleTypes.map(vt => vt._id);

            if (weightNum && weightNum > 0) {
                query.vehicle_type = { $in: suitableVehicleTypeIds };
            }

            const vehicles = await Vehicle.find(query)
                .skip(offset)
                .limit(limitNum)
                .populate({
                    path: 'user',
                    select: 'name email fullname username type status'
                })
                .populate({
                    path: 'vehicle_type',
                    match: weightNum && weightNum > 0 ? { capacity: { $gte: weightNum } } : {}
                })
                .lean()
                .sort({ createdAt: -1 });

            const filteredVehicles = vehicles.filter(v => v.vehicle_type !== null);

            const totalVehicles = await Vehicle.countDocuments(query);

            return res.status(200).send(successHandler('Vehicles fetched successfully', filteredVehicles, {
                totalVehicles,
                currentPage: pageNum,
                totalPages: Math.ceil(totalVehicles / limitNum),
                searchQuery: searchText || undefined,
                minCapacity: weightNum || undefined
            }));

        } catch (error) {
            console.error('Error fetching vehicles:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchVehicleDocumentsByVehicleID(req: Request, res: Response): Promise<Response> {
        try {
            const { vehicle_id } = req.params;
            if (!vehicle_id) {
                return res.status(400).send(errorHandler('Missing Vehicle ID'));
            }
            const vehicle = await Vehicle.findById(vehicle_id)
                .select('vehicle_no vehicle_image status createdAt')
                .lean()
                .populate({
                    path: 'user',
                    select: 'name email fullname username type status createdAt'
                })
                .populate({
                    path: 'documents'
                });
            if (!vehicle) {
                return res.status(404).send(errorHandler('Vehicle document not found'));
            }

            return res.status(200).send(successHandler('Vehicle document fetch sucessfully', vehicle));

        } catch (error: any) {
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    },

    async deleteVehicle(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Invalid vehicle ID'));
            }

            let previousVehicleData = await Vehicle.findById(id);

            if (!previousVehicleData) {
                return res.status(404).send(errorHandler('Vehicle not found'));
            }

            // Remove vehicle image
            if (previousVehicleData.vehicle_image != "") {
                try {
                    let upload_directory = previousVehicleData.vehicle_image.split('/storage')[1];
                    await fs.unlink(__dirname.replace("/controller", "/storage") + upload_directory);
                } catch (error) {
                    console.log('File not exist to remove');
                }
            }

            // Remove vehicle document also
            const vehicleDocuments = await VehicleDocument.find({ vehicle_id: id });

            if (vehicleDocuments.length > 0) {
                await Promise.all(
                    vehicleDocuments.map(async (doc) => {
                        await VehicleDocument.findByIdAndDelete(doc._id);
                    })
                );
            }

            // Remove vehicle id from user also
            await User.findByIdAndUpdate(
                req.user!.type === "driver" ? req.user!.id : previousVehicleData.user,
                { $pull: { vehicle_detail: previousVehicleData._id || previousVehicleData.id } },
                { new: true }
            );

            const deletedVehicle = await Vehicle.findByIdAndDelete(id);
            return res.status(200).send(successHandler('Vehicle deleted successfully', deletedVehicle));
        } catch (error) {
            console.error('Error deleting vehicle:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    }
}

export default vehicleController;
import { Request, Response } from 'express';
import { successHandler, errorHandler } from '../../utils/response-handler';
import User from '../../models/users.model';
import Vehicle from '../../models/driver/vehicle.model';
import VehicleDocument from '../../models/driver/vehicle_document.model';
import fs from 'fs/promises';

const vehicleAppsController = {
    async createVehicle(req: Request, res: Response): Promise<Response> {
        try {
            const { driving_licence_no, puc_certificate_no, insurance_no, vehicle_no, vehicle_type, user } = req.body;

            if (!vehicle_type || !vehicle_no || !driving_licence_no) {
                return res.status(400).send(errorHandler('Missing required fields'));
            }

            const files = req.files as {
                [fieldname: string]: Express.Multer.File[];
            };

            if (!files || !files.driving_licence || files.driving_licence.length === 0) {
                return res.status(400).send(errorHandler('Driving license image is required'));
            }

            const driving_licence = files.driving_licence[0].path || "";
            const insurance = files.insurance?.[0]?.path || "";
            const puc_certificate = files.puc_certificate?.[0]?.path || "";
            const vehicle_image = files.vehicle_image?.[0]?.path || "";

            const newVehicle = new Vehicle({
                user: req.user!.type == "driver" ? req.user!.id : user,
                vehicle_type,
                vehicle_no,
                weight: "XXX",
                length: "XXX",
                width: "XXX",
                height: "XXX",
                documents: [],
                vehicle_image,
                status: "active"
            });

            const vehicle = await newVehicle.save();
            await User.findByIdAndUpdate(req.user!.type == "driver" ? req.user!.id : user, { $addToSet: { vehicle_detail: vehicle._id || vehicle.id } }, { new: true });

             const newVehicleDocument = new VehicleDocument({
                user: req.user!.type == "driver" ? req.user!.id : user,
                vehicle_id: vehicle._id || vehicle.id ,
                driving_licence_no,
                driving_licence,
                vehicle_no,
                insurance,
                insurance_no,
                puc_certificate,
                puc_certificate_no
            });

            const vehicleDocument_ = await newVehicleDocument.save();
            await Vehicle.findByIdAndUpdate(vehicle._id || vehicle.id, { $addToSet: { documents: vehicleDocument_._id || vehicleDocument_.id } }, { new: true });

            return res.status(201).send(successHandler('Vehicle created successfully', vehicle));
            // return res.status(403).send(successHandler('API Forbidden from backend'));
        } catch (error) {
            console.error('Error creating vehicle:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    }
}

export default vehicleAppsController;
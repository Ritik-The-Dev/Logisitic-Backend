
import { Request, Response } from 'express';
import { successHandler, errorHandler } from '../utils/response-handler';
import Vehicle from '../models/driver/vehicle.model';
import { RUNNING_PROTOCOL, NODE_ENVIRONMENT } from '../config/constant';
import Vehicle_Document from "../models/driver/vehicle_document.model";
import fs from 'fs/promises';

const vehicleDocumentController = {
    async createVehicleDocument(req: Request, res: Response): Promise<Response> {
        try {
            if (!req.body) {
                return res.status(400).send(errorHandler('Request body is missing'));
            }
            // const { doc_no, expiry_date, vehicle_id, user, document_type } = req.body;
            const { doc_no, expiry_date, vehicle_id, document_type } = req.body;
            if (!vehicle_id || !document_type) {
                return res.status(400).send(errorHandler('Missing required fields'));
            };

            const vehicleExist = await Vehicle.findById(vehicle_id);
            if (!vehicleExist) {
                return res.status(400).send(errorHandler('Vehicle id is invalid'));
            }

            const files = req.files as {
                [fieldname: string]: Express.Multer.File[];
            };

            const same_document_type = await Vehicle_Document.findOne({ vehicle_id, document_type });
            if (same_document_type) {
                return res.status(400).send(errorHandler(`Document ${document_type} already uploaded`));
            }

            if (!files || !files.doc_front_image || files.doc_front_image.length === 0) {
                return res.status(400).send(errorHandler('Document front image is required'));
            }
            const doc_front_image = files.doc_front_image && `${RUNNING_PROTOCOL}://${req.get('host')}${files.doc_front_image[0]?.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
            const doc_back_image = files.doc_back_image && `${RUNNING_PROTOCOL}://${req.get('host')}${files.doc_back_image[0]?.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;

            const newVehicleDocument = new Vehicle_Document({
                // user: req.user!.type == "driver" ? req.user!.id : user,
                vehicle_id,
                doc_no,
                expiry_date: expiry_date && expiry_date != undefined ? new Date(expiry_date) : null,
                document_type,
                doc_front_image,
                doc_back_image,
                is_approved: req.user!.type == "admin" ? true : false,
                approved_status: req.user!.type == "admin" ? "approved" : "not_started"
            });

            const vehicle_document = await newVehicleDocument.save();
            await Vehicle.findByIdAndUpdate(vehicle_id, { $addToSet: { documents: vehicle_document._id || vehicle_document.id } }, { new: true });
            return res.status(201).send(successHandler('Vehicle document created successfully', vehicle_document));
        } catch (error: any) {
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    },

    async editVehicleDocument(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing Vehicle document ID'));
            }

            if (!req.body) {
                return res.status(400).send(errorHandler('Request body is missing'));
            }

            let previousVehicleDocumentData = await Vehicle_Document.findById(id);
            if (!previousVehicleDocumentData) {
                return res.status(404).send(errorHandler('Vehicle document not found'));
            }

            let doc_front_image = "";
            let doc_back_image = "";

            const files = req.files as {
                [fieldname: string]: Express.Multer.File[];
            };

            // Document front image
            if (!files || !files.doc_front_image || files.doc_front_image.length === 0) {
                doc_front_image = previousVehicleDocumentData.doc_front_image;
            } else {
                doc_front_image = `${RUNNING_PROTOCOL}://${req.get('host')}${files.doc_front_image[0]?.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
                if (doc_front_image != previousVehicleDocumentData.doc_front_image) {
                    try {
                        let upload_directory = previousVehicleDocumentData.doc_front_image.split('/storage')[1];
                        await fs.unlink(__dirname.replace("/controller", "/storage") + upload_directory);
                    } catch (error) {
                        console.log('File not exist to remove');
                    }
                }
            }

            // Document Back image
            if (!files || !files.doc_back_image || files.doc_back_image.length === 0) {
                doc_back_image = previousVehicleDocumentData.doc_back_image;
            } else {
                doc_back_image = `${RUNNING_PROTOCOL}://${req.get('host')}${files.doc_back_image[0]?.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
                if (doc_back_image != previousVehicleDocumentData.doc_back_image) {
                    try {
                        let upload_directory = previousVehicleDocumentData.doc_back_image.split('/storage')[1];
                        await fs.unlink(__dirname.replace("/controller", "/storage") + upload_directory);
                    } catch (error) {
                        console.log('File not exist to remove');
                    }
                }
            }

            const { doc_no, expiry_date, vehicle_id, document_type, is_approved, approved_status, approved_notification, note } = req.body;

            const updatedData = {
                vehicle_id,
                doc_no,
                doc_front_image,
                doc_back_image,
                expiry_date: expiry_date ? new Date(expiry_date) : previousVehicleDocumentData.expiry_date,
                document_type,
                is_approved,
                approved_status,
                approved_notification,
                note
            };

            const updatedVehicle = await Vehicle_Document.findByIdAndUpdate(id, updatedData, { new: true });

            return res.status(200).send(successHandler('Vehicle document updated sucessfully', updatedVehicle));

        } catch (error: any) {
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    },

    async fetchVehicleDocument(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing Vehicle document ID'));
            }
            const vehicle = await Vehicle_Document.findById(id)
                // .populate({
                //     path: 'user',
                //     select: 'name email fullname username type status'
                // })
                .populate({
                    path: 'vehicle_id',
                    select: '-user -documents -updatedAt -__v'
                }).lean();
            if (!vehicle) {
                return res.status(404).send(errorHandler('Vehicle document not found'));
            }

            return res.status(200).send(successHandler('Vehicle document fetch sucessfully', vehicle));

        } catch (error: any) {
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    },

    async fetchVehicleDocuments(req: Request, res: Response): Promise<Response> {
        try {
            const { page = '1', limit = '10', search = '' } = req.query;
            const pageNum = Math.max(parseInt(page as string) || 1, 1);
            const limitNum = Math.max(parseInt(limit as string) || 10, 1);
            const offset = (pageNum - 1) * limitNum;
            const searchText = (search as string).trim();

            const query: any = {};

            if (searchText && searchText.length >= 3) {
                query.$or = [
                    { document_type: { $regex: searchText, $options: 'i' } },
                ];
            }

            const vehicles = await Vehicle_Document.find(query)
                .skip(offset)
                .limit(limitNum)
                // .populate({
                //     path: 'user',
                //     select: 'name email fullname username type status'
                // })
                .populate({
                    path: 'vehicle_id',
                    select: '-user -documents -updatedAt -__v'
                })
                .lean()
                .sort({ createdAt: -1 });

            const totalDocuments = await Vehicle_Document.countDocuments(query);

            return res.status(200).send(successHandler('Vehicle documents fetched successfully', vehicles, {
                totalDocuments,
                currentPage: pageNum,
                totalPages: Math.ceil(totalDocuments / limitNum)
            }));

        } catch (error: any) {
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    },

    async deleteVehicleDocument(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing Vehicle document ID'));
            }

            let previousVehicleDocumentData = await Vehicle_Document.findById(id);

            if (!previousVehicleDocumentData) {
                return res.status(404).send(errorHandler('Vehicle document not found'));
            }

            // Document front image
            if (previousVehicleDocumentData.doc_front_image != "") {
                try {
                    let upload_directory = previousVehicleDocumentData.doc_front_image.split('/storage')[1];
                    await fs.unlink(__dirname.replace("/controller", "/storage") + upload_directory);
                } catch (error) {
                    console.log('File not exist to remove');
                }
            }

            // Document back image
            if (previousVehicleDocumentData.doc_back_image != "") {
                try {
                    let upload_directory = previousVehicleDocumentData.doc_back_image.split('/storage')[1];
                    await fs.unlink(__dirname.replace("/controller", "/storage") + upload_directory);
                } catch (error) {
                    console.log('File not exist to remove');
                }
            }

            await Vehicle.findByIdAndUpdate(previousVehicleDocumentData.vehicle_id, { $pull: { documents: id } }, { new: true });
            const deletedVehicleDocument = await Vehicle_Document.findByIdAndDelete(id);
            if (!deletedVehicleDocument) {
                return res.status(404).send(errorHandler('Vehicle document not found'));
            }

            return res.status(200).send(successHandler('Vehicle document deleted successfully'));

        } catch (error: any) {
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    }
}

export default vehicleDocumentController;
import { Request, Response } from 'express';
import { successHandler, errorHandler } from '../utils/response-handler';
import Material from '../models/driver/material_box.model';
import fs from 'fs/promises';
import { RUNNING_PROTOCOL, NODE_ENVIRONMENT } from '../config/constant';

const materialBoxController = {
    async createMaterialBox(req: Request, res: Response): Promise<Response> {
        try {
            const { name, weight, type } = req.body;

            if (!type) {
                return res.status(400).send(errorHandler('Material Type are required'));
            }

            const exist = await Material.findOne({ type });
            if (exist) {
                return res.status(200).send(errorHandler('Material Type already exist'));
            }

            let box_image = "";
            if (req.file) {
                box_image = `${RUNNING_PROTOCOL}://${req.get('host')}${req.file!.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
            }

            const newMaterialBox = new Material({
                name,
                weight,
                type,
                box_image
            });

            const materialBox = await newMaterialBox.save();
            return res.status(201).send(successHandler('Material Box created successfully', materialBox));
        } catch (error) {
            console.error('Error creating material box:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchMaterialBoxes(req: Request, res: Response): Promise<Response> {
        try {
            const { page = '1', limit = '10', search = '' } = req.query;
            const pageNum = Math.max(parseInt(page as string) || 1, 1);
            const limitNum = Math.max(parseInt(limit as string) || 10, 1);
            const offset = (pageNum - 1) * limitNum;
            const searchText = (search as string).trim();

            const query: any = {};

            if (searchText && searchText.length >= 3) {
                query.$or = [
                    { name: { $regex: searchText, $options: 'i' } },
                    { type: { $regex: searchText, $options: 'i' } },
                ].filter(Boolean);
            }

            const materialBoxes = await Material.find(query)
                .skip(offset)
                .limit(limitNum)
                .lean()
                .sort({ createdAt: -1 });

            const totalMaterialBoxes = await Material.countDocuments(query);

            return res.status(200).send(successHandler('Material Boxes fetched successfully !!', materialBoxes, {
                totalMaterialBoxes,
                currentPage: pageNum,
                totalPages: Math.ceil(totalMaterialBoxes / limitNum),
                searchQuery: searchText || undefined
            }));

        } catch (error) {
            console.error('Error fetching material boxes:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchMaterialBox(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing material box ID'));
            }

            const materialBox = await Material.findById(id).lean();

            if (!materialBox) {
                return res.status(404).send(errorHandler('Material Box not found'));
            }

            return res.status(200).send(successHandler('Material Box fetched successfully', materialBox));
        } catch (error) {
            console.error('Error fetching material box:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async editMaterialBox(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing material box ID'));
            }

            let previousMaterialBoxData = await Material.findById(id);
            if (!previousMaterialBoxData) {
                return res.status(404).send(errorHandler('Material Box not found'));
            }

            let box_image = "";
            let new_file_path = "";
            if (req.file) {
                new_file_path = `${RUNNING_PROTOCOL}://${req.get('host')}${req.file!.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
                box_image = new_file_path;
                try {
                    if (previousMaterialBoxData.box_image != "") {
                        if (new_file_path != previousMaterialBoxData.box_image) {
                            let upload_directory = previousMaterialBoxData.box_image.split('/storage')[1];
                            await fs.unlink(__dirname.replace("/controller", "/storage") + upload_directory);
                        }
                    }
                } catch (error) {
                    console.log('File not exist to remove');
                }
            } else {
                box_image = previousMaterialBoxData.box_image;
            }

            const { name, weight, type } = req.body;

            const exist = await Material.findOne({ type });
            if (exist) {
                return res.status(403).send(errorHandler('Material Type already exist'));
            }

            const updatedData = {
                name,
                weight,
                type,
                box_image,
                updatedAt: Date.now(),
            };

            const updatedMaterialBox = await Material.findByIdAndUpdate(id, updatedData, { new: true });

            return res.status(200).send(successHandler('Material Box updated successfully', updatedMaterialBox));
        } catch (error) {
            console.error('Error updating material box:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async deleteMaterialBox(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Invalid material box ID'));
            }

            let previousMaterialBoxData = await Material.findById(id);

            if (!previousMaterialBoxData) {
                return res.status(404).send(errorHandler('Material Box not found'));
            }

            if (previousMaterialBoxData.box_image != "") {
                try {
                    let upload_directory = previousMaterialBoxData.box_image.split('/storage')[1];
                    await fs.unlink(__dirname.replace("/controller", "/storage") + upload_directory);
                } catch (error) {
                    console.log('File not exist to remove');
                }
            }

            const deletedMaterialBox = await Material.findByIdAndDelete(id);
            if (!deletedMaterialBox) {
                return res.status(404).send(errorHandler('Material Box not found'));
            }

            return res.status(200).send(successHandler('Material Box deleted successfully', deletedMaterialBox));
        } catch (error) {
            console.error('Error deleting material box:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    }
}

export default materialBoxController;
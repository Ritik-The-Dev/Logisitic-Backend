import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import USER, { IUser } from '../../models/users.model';
import Vehicle from '../../models/driver/vehicle.model';
import { uploadImage, deleteImage } from '../../helper/multer';
import { join } from 'path';
import { isValidMobile } from '../../utils/worker_function';
import fs from 'fs/promises';
import { RUNNING_PROTOCOL, NODE_ENVIRONMENT } from '../../config/constant';
import { successHandler, errorHandler } from '../../utils/response-handler';
import Credit from '../../models/credit_stack.model';
import mongoose from 'mongoose';

interface IUserRequestBody {
    username?: string;
    email?: string;
    fullname?: string;
    name?: string;
    postal_code?: string;
    contact_no?: string;
    profile?: string;
    password?: string;
    type?: string;
    fcm_token: String;
    availability: string;
    terms_conditions?: boolean;
}

const userController = {
    async createUser(req: Request, res: Response): Promise<Response> {
        try {
            const {
                username,
                email,
                fullname,
                name,
                postal_code,
                contact_no,
                password,
                type,
                fcm_token,
                terms_conditions,
            } = req.body;

            if (!username || !email || !password || !contact_no) {
                return res.status(400).send(errorHandler('Missing required fields'));
            }

            if (!isValidMobile(contact_no)) {
                return res.status(400).send(errorHandler('Contact number is invalid, Enter valid contact number.'));
            }

            const existingUser = await USER.findOne({ $or: [{ email }, { username }] });
            if (existingUser) {
                return res.status(400).send(errorHandler('User with this email or username already exists'));
            }

            const files = req.files as {
                [fieldname: string]: Express.Multer.File[];
            };

            let profile = "";
            if (files && files.profile && files.profile.length > 0) {
                profile = files.profile && `${RUNNING_PROTOCOL}://${req.get('host')}${files.profile[0]?.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = new USER({
                username,
                email,
                fullname,
                name,
                postal_code,
                contact_no,
                profile,
                fcm_token,
                password: hashedPassword,
                salt,
                type: type || 'customer',
                availability: type == 'driver' ? "online" : null,
                terms_conditions,
            });

            const user = await newUser.save();
            return res.status(201).send(successHandler('User created successfully', user));
        } catch (error) {
            console.error('Error creating user:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async editUser(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing user ID'));
            }
            const {
                username,
                email,
                fullname,
                name,
                postal_code,
                contact_no,
                fcm_token,
                password,
                availability,
                terms_conditions,
            } = req.body;

            const previous_user_data = await USER.findById(id);
            if (!previous_user_data) {
                return res.status(404).send(errorHandler('User not found'));
            }

            const files = req.files as {
                [fieldname: string]: Express.Multer.File[];
            };

            let profile = "";

            if (!files || !files.profile || files.profile.length === 0) {
                profile = previous_user_data.profile || "";
            } else {
                profile = `${RUNNING_PROTOCOL}://${req.get('host')}${files.profile[0]?.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`;
                if (profile != previous_user_data.profile) {
                    try {
                        let upload_directory = previous_user_data.profile?.split('/storage')[1];
                        await fs.unlink(__dirname.replace("/controller/admin", "/storage") + upload_directory);
                    } catch (error) {
                        console.log('File not exist to remove');
                    }
                }
            }

            if (!isValidMobile(contact_no)) {
                return res.status(400).send(errorHandler('Contact number is invalid, Enter valid contact number.'));
            }

            const updatedData: Partial<IUser> & { updatedAt?: number } = {
                username,
                email,
                fullname,
                name,
                postal_code,
                contact_no,
                profile,
                fcm_token: String(fcm_token),
                terms_conditions,
            };

            if (password) {
                const salt = await bcrypt.genSalt(10);
                updatedData.password = await bcrypt.hash(password, salt);
                updatedData.salt = salt;
            }

            if (previous_user_data.type == "driver") {
                if (availability === "online" || availability === "offline") {
                    updatedData.availability = availability;
                } else {
                    updatedData.availability = previous_user_data.availability;
                }
            }

            const updatedUser = await USER.findByIdAndUpdate(id, updatedData, { new: true });
            if (!updatedUser) {
                return res.status(404).send(errorHandler('User not found'));
            }

            return res.status(200).send(successHandler('User updated successfully', updatedUser));
        } catch (error) {
            console.error('Error updating user:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async fetchVehicleDetailByUserID(req: Request, res: Response): Promise<Response> {
        try {
            const { user_id } = req.params;

            if (!user_id) {
                return res.status(400).send(errorHandler('Missing user ID'));
            }

            const required_document_type = ['puc', 'insurance', 'driving_licence'];
            const resulted_data: any[] = [];

            const vehicle_data = await Vehicle.find({ user: user_id })
                .populate({
                    path: 'documents'
                })
                .populate({
                    path: "vehicle_type"
                })
                .lean();

            for (const vehicle of vehicle_data) {
                const attachedTypes = vehicle.documents.map((doc: any) => {
                    if (doc.document_type && doc.is_approved == true && doc.approved_status == "approved") {
                        return doc.document_type
                    } else {
                        return null
                    }
                }).filter((ele) => ele);

                let left_document__: any = [];
                const left_documents = required_document_type.filter(docType => !attachedTypes.includes(docType));

                left_document__ = left_documents.map((ele, index) => {
                    return {
                        id: index + 1,
                        name: ele
                    }
                });

                const vehicle_modified = {
                    ...vehicle,
                    left_documents: left_document__,
                };
                resulted_data.push(vehicle_modified);
            }

            return res.status(200).send(successHandler('User vehicle fetched sucessfully', resulted_data));
        } catch (error) {
            console.error('Error fetching vehicle details:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchUser(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing user ID'));
            }

            const user = await USER.findById(id).select("-password -salt")
                .populate({
                    path: 'vehicle_detail',
                    select: 'vehicle_no vehicle_type vehicle_image weight length width height',
                    populate: {
                        path: 'vehicle_type',
                        select: 'name wheeler capacity unit base_fare km_fare base_fare_margin km_fare_margin vehicle_image'
                    }
                })
                .lean();
            if (!user) {
                return res.status(404).send(errorHandler('User not found'));
            }

            return res.status(200).send(successHandler('User fetched successfully', user));
        } catch (error) {
            console.error('Error fetching user:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async deleteUser(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing user ID'));
            }

            const previous_user_data = await USER.findById(id);
            if (!previous_user_data) {
                return res.status(404).send(errorHandler('User not found'));
            }

            try {
                if (previous_user_data?.profile) {
                    const upload_directory = previous_user_data.profile.split('/storage')[1];
                    await fs.unlink(__dirname.replace("/controller/admin", "/storage") + upload_directory);
                }
            } catch (error) {
                console.log('File not exist');
            }

            const deletedUser = await USER.findByIdAndDelete(id);
            if (!deletedUser) {
                return res.status(404).send(errorHandler('User not found'));
            }

            return res.status(200).send(successHandler('User deleted successfully'));
        } catch (error) {
            console.error('Error deleting user:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async uploadImage(req: Request, res: Response): Promise<Response> {
        try {
            let UPLOAD_DIR = "";
            await uploadImage(req, res, "user");
            UPLOAD_DIR = `${RUNNING_PROTOCOL}://${req.get('host')}${req.file!.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`
            return res.status(200).send(successHandler('Image uploaded successfully', UPLOAD_DIR));
        } catch (error) {
            console.error('Error deleting user:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchUserCredits(req: Request, res: Response): Promise<Response> {
        try {
            const user = req.user;
            if (!user) {
                return res.status(404).send(errorHandler('User not found'));
            }

            const { page = '1', limit = '10' } = req.query;
            const pageNum = Math.max(parseInt(page as string) || 1, 1);
            const limitNum = Math.max(parseInt(limit as string) || 10, 1);
            const offset = (pageNum - 1) * limitNum;

            const credits = await Credit.find({ user: user._id })
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limitNum)
                .lean();


            const totalCredits = await Credit.countDocuments({ user: user._id });

            return res.status(200).send(successHandler(
                'Credits fetched successfully',
                credits,
                {
                    totalCredits,
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalCredits / limitNum)
                }
            ));

        } catch (error) {
            console.error('Error fetching user credits:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async createUserCredit(req: Request, res: Response): Promise<Response> {
        try {
            const user = req.user;
            if (!user) {
                return res.status(404).send(errorHandler('User not found'));
            }

            const { amount } = req.body;

            if (!amount || isNaN(amount)) {
                return res.status(400).send(errorHandler('Valid amount is required'));
            }

            const newCredit = await Credit.create({
                user: user._id,
                credit: {
                    amount: parseFloat(amount),
                    trip: null,
                    stack_type: "own_credit",
                    createdAt: new Date()
                }
            });

            return res.status(201).send(successHandler(
                'Credit created successfully',
                newCredit
            ));

        } catch (error) {
            console.error('Error creating user credit:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async deleteUserCredit(req: Request, res: Response): Promise<Response> {
        try {
            const user = req.user;
            if (!user) {
                return res.status(404).send(errorHandler('User not found'));
            }

            const { credit_id } = req.params;

            // Validate credit_id is a valid MongoDB ObjectId
            if (!mongoose.Types.ObjectId.isValid(credit_id)) {
                return res.status(400).send(errorHandler('Invalid credit ID'));
            }

            // Find and delete the credit, ensuring it belongs to the user
            const deletedCredit = await Credit.findOneAndDelete({
                _id: credit_id,
                user: user._id
            });

            if (!deletedCredit) {
                return res.status(404).send(errorHandler('Credit not found or not owned by user'));
            }

            return res.status(200).send(successHandler(
                'Credit deleted successfully',
                { deletedCreditId: credit_id }
            ));

        } catch (error) {
            console.error('Error deleting user credit:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    }

};

export default userController;

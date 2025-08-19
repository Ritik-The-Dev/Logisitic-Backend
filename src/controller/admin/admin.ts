import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import USER, { IUser } from '../../models/users.model';
import { uploadImage, deleteImage } from '../../helper/multer';
import { join } from 'path';
import fs from 'fs/promises';
import { isValidMobile } from '../../utils/worker_function';
import { RUNNING_PROTOCOL, NODE_ENVIRONMENT } from '../../config/constant';
import { successHandler, errorHandler } from '../../utils/response-handler';

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
    terms_conditions?: boolean;
}

const adminController = {
    async createAdmin(req: Request, res: Response): Promise<Response> {
        try {
            const {
                username,
                email,
                fullname,
                name,
                postal_code,
                contact_no,
                profile,
                password,
                fcm_token,
                type,
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

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = new USER({
                username,
                email,
                fullname,
                name,
                fcm_token,
                postal_code,
                contact_no,
                profile,
                password: hashedPassword,
                salt,
                type: type || 'customer',
                terms_conditions,
            });

            const user = await newUser.save();
            return res.status(201).send(successHandler('User created successfully', user));
        } catch (error) {
            console.error('Error creating user:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async editAdmin(req: Request, res: Response): Promise<Response> {
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
                fcm_token,
                contact_no,
                profile,
                password,
                terms_conditions,
            } = req.body;

            const previous_user_data = await USER.findById(id);
            if (!previous_user_data) {
                return res.status(404).send(errorHandler('User not found'));
            }
            try {
                if (profile !== "") {
                    if (previous_user_data?.profile) {
                        if (profile !== previous_user_data.profile) {
                            const upload_directory = previous_user_data.profile.split('/storage')[1];
                            await fs.unlink(__dirname.replace("/controller/admin", "/storage") + upload_directory);
                        }
                    }
                }
            } catch (error) {
                console.log('file not exist');
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
                fcm_token: String(fcm_token),
                contact_no,
                profile,
                terms_conditions,
            };

            if (password) {
                const salt = await bcrypt.genSalt(10);
                updatedData.password = await bcrypt.hash(password, salt);
                updatedData.salt = salt;
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

    async fetchAdmin(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).send(errorHandler('Missing user ID'));
            }

            const user = await USER.findById(id).select("-password -salt").lean();
            if (!user) {
                return res.status(404).send(errorHandler('User not found'));
            }

            return res.status(200).send(successHandler('User fetched successfully', user));
        } catch (error) {
            console.error('Error fetching user:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async fetchAllUser(req: Request, res: Response): Promise<Response> {
        try {
            const { search = '', page = '1', limit = '10', role } = req.query;

            const searchText = (search as string).trim();
            const pageNum = Math.max(parseInt(page as string) || 1, 1);
            const limitNum = Math.max(parseInt(limit as string) || 10, 1);
            const offset = (pageNum - 1) * limitNum;

            const searchCriteria: any = {};

            if (role != undefined && role != null) {
                searchCriteria.$and = [
                    { type: { $regex: role, $options: 'i' } },
                    {
                        $or: [
                            { email: { $regex: searchText, $options: 'i' } },
                            { username: { $regex: searchText, $options: 'i' } },
                            { fullname: { $regex: searchText, $options: 'i' } },
                        ]
                    }
                ]
            } else {
                if (searchText && searchText.length >= 3) {
                    searchCriteria.$or = [
                        { email: { $regex: searchText, $options: 'i' } },
                        { username: { $regex: searchText, $options: 'i' } },
                        { fullname: { $regex: searchText, $options: 'i' } },
                    ];
                }
            }

            const users = await USER.find(searchCriteria)
                .skip(offset)
                .limit(limitNum)
                .lean()
                .sort({ createdAt: -1 })
                .select('-password -salt');

            const totalUsers = await USER.countDocuments(searchCriteria);

            return res.status(200).send(successHandler('Users fetched successfully', users, {
                totalUsers,
                currentPage: pageNum,
                totalPages: Math.ceil(totalUsers / limitNum)
            }));

        } catch (error) {
            console.error('Error fetching all users:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async deleteAdmin(req: Request, res: Response): Promise<Response> {
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
            await uploadImage(req, res, "admin");
            UPLOAD_DIR = `${RUNNING_PROTOCOL}://${req.get('host')}${req.file!.path.split(NODE_ENVIRONMENT == "dev" ? 'src' : 'dist')[1]}`
            return res.status(200).send(successHandler('Image uploaded successfully', UPLOAD_DIR));
        } catch (error) {
            console.error('Error deleting user:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    }
};

export default adminController;

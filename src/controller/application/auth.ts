import { Request, Response } from 'express';;
import bcrypt from 'bcrypt';
import { isValidMobile } from '../../utils/worker_function';
import { accessTokenEncode, refreshTokenEncode, refreshTokenDecode } from '../../helper/jwt';
import USER, { IUser } from '../../models/users.model';
import { successHandler, errorHandler } from '../../utils/response-handler';
import crypto from 'crypto';

const generateVerificationCode = (): number => {
    return Math.floor(100000 + Math.random() * 900000);
};

const generateRandomString = (length: number): string => {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
};

const authController = {
    async login(req: Request, res: Response): Promise<Response> {
        try {
            const { name, username, type, contact_no, verification_code, fcm_token } = req.body;

            if (!contact_no) {
                return res.status(400).send(errorHandler('Contact number required'));
            }

            if (!isValidMobile(contact_no)) {
                return res.status(400).send(errorHandler('Contact number is invalid, Enter valid contact number.'));
            }

            let user = await USER.findOne({
                $or: [
                    { contact_no: contact_no }
                ]
            });
            if (!user) {
                const newUser = new USER({
                    username: username || `user_${generateRandomString(8)}`,
                    email: `user_${generateRandomString(8)}@yopmail.com`,
                    fullname: name || 'New Guest User',
                    name: name || 'Guest',
                    postal_code: '',
                    contact_no: contact_no,
                    fcm_token: fcm_token,
                    profile: '',
                    password: 'Test@1234',
                    salt: crypto.randomBytes(16).toString('hex'),
                    type: type || 'customer',
                    terms_conditions: true,
                    vehicle_detail: [],
                    verification_code: 123456,
                    status: "active"
                });

                await newUser.save();

                const newUserObj = newUser.toObject() as IUser & { password?: string; salt?: string };
                delete newUserObj.salt;

                return res.status(201).send(
                    successHandler('User created and logged in successfully',
                        {
                            username: newUserObj.username,
                            contact_no: newUserObj.contact_no,
                            user_type: newUserObj.type
                        },
                        {
                            verification_code: newUserObj.verification_code
                        }
                    )
                );
            } else {
                if (type) {
                    if (user.type != type) {
                        return res.status(400).send(errorHandler('User already registered with different type.'));
                    }
                }
                if (verification_code) {
                    if (user.verification_code !== verification_code) {
                        return res.status(401).send(errorHandler('Invalid verification code'));
                    }

                    const token_ = accessTokenEncode({ id: user._id, email: user.email, type: user.type });
                    const ref_token = refreshTokenEncode({ id: user._id, email: user.email, type: user.type });

                    const modified_user = await USER.findOne({ contact_no }).populate("vehicle_detail").select("-password -salt").lean();
                    await USER.findOneAndUpdate({ contact_no }, { verification_code: null, fcm_token: fcm_token || modified_user?.fcm_token }, { new: true });
                    const userObj = user.toObject() as IUser & { password?: string; salt?: string };
                    delete userObj.salt;

                    return res.status(200).send(
                        successHandler('Login successful', modified_user, { user_type: userObj.type, access_token: token_, refresh_token: ref_token })
                    );
                } else {
                    await USER.findOneAndUpdate({ contact_no }, { verification_code: 123456 }, { new: true });
                    return res.status(200).send(
                        successHandler('OTP send successfully',
                            {
                                username: user.username,
                                contact_no: user.contact_no,
                                user_type: user.type
                            },
                            {
                                verification_code: 123456
                            }
                        )
                    );
                }

            }
        } catch (error: any) {
            console.error('Error logging in user via OTP:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    },

    async googleLogin(req: Request, res: Response): Promise<Response> {
        try {
            const { idToken, user } = req.body;
            if (user && user?.email) {
                const exist = await USER.findOne({ email: user?.email });
                if (exist) {
                    const token_ = accessTokenEncode({ id: exist._id, email: exist.email, type: exist.type });
                    const ref_token = refreshTokenEncode({ id: exist._id, email: exist.email, type: exist.type });

                    const modified_user = await USER.findOne({ email: exist.email }).populate("vehicle_detail").select("-password -salt").lean();
                    await USER.findOneAndUpdate({ email: exist.email }, {
                        gmail_auth: true,
                        auth_token: idToken,
                        social_auth_id: user?.id || "",
                        fullname: user?.givenName || exist.fullname,
                        name: user?.name || exist.name,
                        profile: user?.photo || exist.profile
                    }, { new: true });
                    const userObj = exist.toObject() as IUser & { password?: string; salt?: string };
                    delete userObj.salt;

                    return res.status(200).send(
                        successHandler('Login successful', modified_user, { user_type: userObj.type, access_token: token_, refresh_token: ref_token })
                    );
                } else {
                    const newUser = new USER({
                        username: `user_${generateRandomString(8)}`,
                        email: user?.email,
                        fullname: user?.givenName || 'New Guest User',
                        name: user?.name || 'Guest',
                        postal_code: '',
                        gmail_auth: true,
                        auth_token: idToken,
                        contact_no: user?.phone || 'XXXXXXXXX',
                        profile: user?.photo || "",
                        password: 'Test@1234',
                        social_auth_id: user?.id || "",
                        salt: crypto.randomBytes(16).toString('hex'),
                        type: user?.type || 'customer',
                        terms_conditions: true,
                        vehicle_detail: [],
                        status: "active"
                    });

                    const NewCreatedUser = await newUser.save();

                    const token_ = accessTokenEncode({ id: NewCreatedUser._id, email: NewCreatedUser.email, type: NewCreatedUser.type });
                    const ref_token = refreshTokenEncode({ id: NewCreatedUser._id, email: NewCreatedUser.email, type: NewCreatedUser.type });

                    const modified_user = await USER.findOne({ email: NewCreatedUser?.email }).populate("vehicle_detail").select("-password -salt").lean();

                    const userObj = NewCreatedUser.toObject() as IUser & { password?: string; salt?: string };
                    delete userObj.salt;

                    return res.status(200).send(
                        successHandler('Login successful', modified_user, { user_type: userObj.type, access_token: token_, refresh_token: ref_token })
                    );
                }
            } else {
                return res.status(404).send(errorHandler('User not found'));
            }
        } catch (error: any) {
            console.error('Error logging in user via OTP:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    }

}

export default authController;

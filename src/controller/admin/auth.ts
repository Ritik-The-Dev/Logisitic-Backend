import { Request, Response } from 'express';;
import bcrypt from 'bcrypt';
import { accessTokenEncode, refreshTokenEncode, refreshTokenDecode } from '../../helper/jwt';
import USER, { IUser } from '../../models/users.model';
import { isValidMobile } from '../../utils/worker_function';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { JWT_SECRET_ACCESS } from '../../config/constant';
import { successHandler, errorHandler } from '../../utils/response-handler';
import crypto from 'crypto';


interface DecodedToken extends JwtPayload {
    name: string;
}

const generateRandomString = (length: number): string => {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
};

export const generateSixDigitCode = (): number => {
    return Math.floor(100000 + Math.random() * 900000);
};

const setVerificationCode = async (userId: any) => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    await USER.findByIdAndUpdate(userId, {
        verification_code_expires_at: expiresAt,
    });
};
const authController = {
    async login(req: Request, res: Response): Promise<Response> {
        try {
            const { email, password } = req.body as { email?: string; password?: string };

            if (!email || !password) {
                return res.status(400).send(errorHandler('Email and password are required'));
            }
            const user = await USER.findOne({ email });
            if (!user) {
                return res.status(401).send(errorHandler('Invalid email or password'));
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).send(errorHandler('Invalid email or password'));
            }
            const token_ = accessTokenEncode({ id: user._id, email: user.email, type: user.type });
            const ref_token = refreshTokenEncode({ id: user._id, email: user.email, type: user.type });

            const modified_user = await USER.findOne({ email }).select("-password -salt").lean();
            const userObj = user.toObject() as IUser & { password?: string; salt?: string };
            delete userObj.salt;

            return res.status(200).send(
                successHandler('Login successful', modified_user, { user_type: userObj.type, access_token: token_, refresh_token: ref_token })
            );
        } catch (error: any) {
            console.error('Error logging in user:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    },

    async getAccessTokenByRefreshToken(req: Request, res: Response): Promise<Response> {
        try {
            if (!req.body.refresh_token) {
                return res.status(400).send(errorHandler('Refresh token not found.'));
            }
            const result = await new Promise<any>((resolve) => {
                refreshTokenDecode((result) => resolve(result), req.body.refresh_token);
            });

            if (result.status && result.data) {
                const userData = { ...result.data };
                if (userData.exp) {
                    delete userData.exp;
                }
                if (userData.iat) {
                    delete userData.iat;
                }

                const access_token = accessTokenEncode(userData);
                const refresh_token = refreshTokenEncode({ id: userData._id, email: userData.email, type: userData.type });
                const user = await USER.findOne({ email: userData.email }).select("-password -salt");
                return res.status(200).send(successHandler('Access token created successfully', user, { user_type: userData.type, access_token: access_token, refresh_token: refresh_token }));
            } else {
                return res.status(401).send(errorHandler(result.message || 'Invalid refresh token'));
            }
        } catch (error: any) {
            console.error('Error refreshing token:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    },

    async loginWithOtp(req: Request, res: Response): Promise<Response> {
        try {
            const { contact_no, verification_code } = req.body;

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
                const random_code = generateSixDigitCode();
                const newUser = new USER({
                    username: `user_${generateRandomString(8)}`,
                    email: `user_${generateRandomString(8)}@yopmail.com`,
                    fullname: 'New Guest User',
                    name: 'Guest',
                    postal_code: '',
                    contact_no: contact_no,
                    fcm_token: '',
                    profile: '',
                    password: 'Test@1234',
                    salt: crypto.randomBytes(16).toString('hex'),
                    type: 'admin',
                    terms_conditions: true,
                    vehicle_detail: [],
                    verification_code: random_code,
                    status: "active"
                });

                await newUser.save();

                const newUserObj = newUser.toObject() as IUser & { password?: string; salt?: string };
                delete newUserObj.salt;
                await setVerificationCode(newUser._id || "")

                res.cookie("verification_code", random_code, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "none",
                    maxAge: 60 * 60 * 1000
                });
                return res.status(201).send(
                    successHandler('User created successfully',
                        {
                            username: newUserObj.username,
                            contact_no: newUserObj.contact_no,
                            user_type: newUserObj.type
                        },
                        {
                            verification_code: random_code
                        }
                    )
                );
            } else {
                if (verification_code) {
                    if (user.verification_code !== verification_code) {
                        return res.status(401).send(errorHandler('Invalid verification code'));
                    }

                    const token_ = accessTokenEncode({ id: user._id, email: user.email, type: user.type });
                    const ref_token = refreshTokenEncode({ id: user._id, email: user.email, type: user.type });

                    res.cookie("auth_token", token_, {
                        httpOnly: true,
                        secure: true,
                        sameSite: "none",
                        maxAge: 60 * 60 * 1000
                    });

                    const modified_user = await USER.findOne({ contact_no }).populate("vehicle_detail").select("-password -salt").lean();
                    const updated_user = await USER.findOneAndUpdate({ contact_no }, { verification_code: null }, { new: true }).select("-password -salt").lean();
                    const userObj = user.toObject() as IUser & { password?: string; salt?: string };
                    delete userObj.salt;

                    return res.status(200).send(
                        successHandler('Login successful', updated_user, { user_type: userObj.type, access_token: token_, refresh_token: ref_token })
                    );
                } else {
                    const random_code = generateSixDigitCode();
                    await USER.findOneAndUpdate({ contact_no }, { verification_code: random_code }, { new: true });
                    await setVerificationCode(user._id || "");
                    res.cookie("verification_code", random_code, {
                        httpOnly: true,
                        secure: true,
                        sameSite: "none",
                        maxAge: 60 * 60 * 1000
                    });

                    return res.status(200).send(
                        successHandler('OTP send successfully',
                            {
                                username: user.username,
                                contact_no: user.contact_no,
                                user_type: user.type
                            },
                            {
                                verification_code: random_code
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

    async getUserByCookieToken(req: Request, res: Response): Promise<Response> {
        try {
            const token = req.cookies.auth_token;
            if (!token) return res.status(401).json({ error: "Not logged in" });

            const decoded = jwt.verify(token, JWT_SECRET_ACCESS) as DecodedToken;
            if (decoded) {
                const user = await USER.findById(decoded.id).select('-password').exec();
                if (!user) {
                    return res.status(404).json(errorHandler('User not found'));
                }
                return res.status(200).send(successHandler("User fetched successfully", user))
            } else {
                return res.status(404).json(errorHandler('Invalid token'));
            }
        } catch (error: any) {
            console.error('Error logging in user via OTP:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error.message));

        }
    },

    async userLogoutFromCookie(req: Request, res: Response): Promise<Response> {
        try {
            res.clearCookie("auth_token", { httpOnly: true, sameSite: "strict" });
            return res.status(200).send(successHandler("User logout successfully"))
        } catch (error: any) {
            console.error('Error logging in user via OTP:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error.message));

        }
    }
}

export default authController;

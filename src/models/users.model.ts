import mongoose, { Document, Schema, Model } from 'mongoose';

// Define a TypeScript interface for the user document
export interface IUser extends Document {
    username: string;
    email: string;
    fullname?: string;
    name?: string;
    postal_code?: string;
    contact_no: string;
    profile?: string;
    salt?: string;
    password: string;
    gmail_auth?: boolean;
    apple_auth?: boolean;
    facebook_auth?: boolean;
    auth_token?: string;
    verification_code?: number;
    verification_code_expires_at?: Date;
    type: 'customer' | 'driver' | 'admin';
    status: string;
    social_auth_id: string;
    availability: 'online' | 'offline';
    terms_conditions: boolean;
    vehicle_detail: string;
    total_credits: number;
    fcm_token: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// Define the user schema
const userSchema = new Schema<IUser>(
    {
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        fullname: { type: String },
        name: { type: String },
        postal_code: { type: String, default: '' },
        contact_no: { type: String, required: true },
        profile: { type: String },
        salt: { type: String },
        password: { type: String, required: true },
        gmail_auth: { type: Boolean, default: false },
        apple_auth: { type: Boolean, default: false },
        facebook_auth: { type: Boolean, default: false },
        auth_token: { type: String },
        social_auth_id: { type: String },
        verification_code: { type: Number },
        verification_code_expires_at: { type: Date },
        type: {
            type: String,
            default: 'customer',
            enum: ['customer', 'driver', 'admin'],
        },
        status: { type: String, default: 'active', enum: ["active", "inactive"] },
        vehicle_detail: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true }],
        availability: { type: String, default: null, enum: ["online", "offline"] },
        fcm_token: { type: String, default: "" },
        total_credits: { type: Number, default: 0 },
        terms_conditions: { type: Boolean, default: false },
    },
    { timestamps: true }
);

userSchema.index(
    { verification_code_expires_at: 1 },
    { expireAfterSeconds: 0 }
);

// Add toJSON method
userSchema.method('toJSON', function (this: IUser) {
    const { __v, _id, ...object } = this.toObject();
    return { ...object, _id: _id };
});

// Export as default
const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;
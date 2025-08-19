import mongoose, { Document, Schema, Model } from 'mongoose';

// TypeScript interface for the user session
export interface IUserSession extends Document {
    user: mongoose.Types.ObjectId;
    session?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

// Define the user session schema
const userSessionSchema = new Schema<IUserSession>(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        session: { type: Boolean },
    },
    { timestamps: true }
);

// Add toJSON method
userSessionSchema.method('toJSON', function (this: IUserSession) {
    const { __v, _id, ...object } = this.toObject();
    return { ...object, _id: _id };
});

// Export as default
const User_session: Model<IUserSession> = mongoose.model<IUserSession>('User_session', userSessionSchema);
export default User_session;

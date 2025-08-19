import mongoose, { Document, Schema, Model } from 'mongoose';

// Define a TypeScript interface for the user document
export interface ICredit extends Document {
    user: mongoose.Types.ObjectId;
    credit: object;
    createdAt?: Date;
    updatedAt?: Date;
}

// Define the user schema
const creditSchema = new Schema<ICredit>(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        credit: {
            amount: { type: Number },
            trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', index: true },
            createdAt: { type: Date, default: new Date() },
            stack_type: { type: String, enum: ["own_credit", "trip_credit"] }
        },
    },
    { timestamps: true }
);

creditSchema.index(
    { verification_code_expires_at: 1 },
    { expireAfterSeconds: 0 }
);

// Add toJSON method
creditSchema.method('toJSON', function (this: ICredit) {
    const { __v, _id, ...object } = this.toObject();
    return { ...object, _id: _id };
});

// Export as default
const Credit: Model<ICredit> = mongoose.model<ICredit>('Credit', creditSchema);
export default Credit;
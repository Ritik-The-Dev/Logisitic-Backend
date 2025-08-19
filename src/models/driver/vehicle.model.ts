import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for the Document model
export interface IVehicle extends Document {
    user: mongoose.Types.ObjectId;
    vehicle_type: String,
    vehicle_no: String,
    weight: number,
    length: String,
    width: String,
    height: String,
    documents: [mongoose.Types.ObjectId],
    status: String,
    vehicle_image: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// Define the documents schema
const vehicleSchema = new Schema<IVehicle>(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        vehicle_type: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle_type', required: true, index: true },
        vehicle_no: { type: String, index: true },
        vehicle_image: { type: String, default: "" },
        weight: { type: Number },
        length: { type: String },
        width: { type: String },
        height: { type: String },
        documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle_document', index: true }],
        status: { type: String, index: true, enum: ["active", "inactive"] }

    },
    { timestamps: true }
);

// Add toJSON method
vehicleSchema.method('toJSON', function (this: IVehicle) {
    const { __v, _id, ...object } = this.toObject();
    return { ...object, _id: _id };
});

// Export as default
const Vehicle: Model<IVehicle> = mongoose.model<IVehicle>('Vehicle', vehicleSchema);
export default Vehicle;

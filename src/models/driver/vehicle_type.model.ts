import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for the Document model
export interface IVehicleType extends Document {
    name: String,
    wheeler: Number,
    capacity: Number,
    unit: String,
    customer_base_fare: number,
    customer_km_fare: number,
    customer_base_fare_margin: number,
    customer_km_fare_margin: number,
    driver_base_fare: number,
    driver_km_fare: number,
    driver_base_fare_margin: number,
    driver_km_fare_margin: number,
    vehicle_image: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// Define the documents schema
const vehicleTypeSchema = new Schema<IVehicleType>(
    {
        name: { type: String, index: true },
        wheeler: { type: Number, index: true },
        capacity: { type: Number },
        unit: { type: String },
        customer_base_fare: { type: Number, default: 0 },
        customer_km_fare: { type: Number, default: 0 },
        customer_base_fare_margin: { type: Number, default: 0 },
        customer_km_fare_margin: { type: Number, default: 0 },
        driver_base_fare: { type: Number, default: 0 },
        driver_km_fare: { type: Number, default: 0 },
        driver_base_fare_margin: { type: Number, default: 0 },
        driver_km_fare_margin: { type: Number, default: 0 },
        vehicle_image: { type: String, default: "" }
    },
    { timestamps: true }
);

// Add toJSON method
vehicleTypeSchema.method('toJSON', function (this: IVehicleType) {
    const { __v, _id, ...object } = this.toObject();
    return { ...object, _id: _id };
});

// Export as default
const VehicleType: Model<IVehicleType> = mongoose.model<IVehicleType>('Vehicle_type', vehicleTypeSchema);
export default VehicleType;

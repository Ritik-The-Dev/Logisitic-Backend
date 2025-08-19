import mongoose, { Document, Schema, Model } from 'mongoose';

// Define the main Driver location document interface
export interface IDriverLocation extends Document {
    user: mongoose.Types.ObjectId;
    location: {
        type: string;
        coordinates: [number, number];
    };
    latitude: number;
    longitude: number;
    createdAt?: Date;
    updatedAt?: Date;
}

// Define the driver location schema
const driverLocationSchema = new Schema<IDriverLocation>(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: true
            },
            coordinates: {
                type: [Number],
                required: true
            }
        },
        latitude: { type: Number },
        longitude: { type: Number }
    },
    { timestamps: true }
);

// Create a 2dsphere index for the location field
driverLocationSchema.index({ location: '2dsphere' });

// Add pre-save hook to keep latitude/longitude in sync
driverLocationSchema.pre('save', function (next) {
    if (this.isModified('location')) {
        this.latitude = this.location.coordinates[1];
        this.longitude = this.location.coordinates[0];
    }
    next();
});

// Add toJSON method
driverLocationSchema.method('toJSON', function (this: IDriverLocation) {
    const { __v, _id, ...object } = this.toObject();
    return { ...object, _id: _id };
});

// Export as default
const DriverLocation: Model<IDriverLocation> = mongoose.model<IDriverLocation>('Driver_location', driverLocationSchema);
export default DriverLocation;
import mongoose, { Document, Schema, Model } from 'mongoose';

// Define the Notification document interface
export interface INotification extends Document {
    user: mongoose.Types.ObjectId;
    title: string;
    message: string;
    type: 'trip_request' | 'trip_update' | 'payment' | 'system';
    is_read: boolean;
    related_trip?: mongoose.Types.ObjectId;
    notify_to: string;
    user_response: string;
    metadata?: {
        trip_id?: mongoose.Types.ObjectId;
        fare?: object;
        distance?: number;
        from?: string;
        to?: string;
        from_location?: {
            path: string;
            coordinates: [number, number]; // [longitude, latitude]
        };
        to_location?: {
            path: string;
            coordinates: [number, number];
        } | null;
        vehicle_type?: string;
        weight?: number;
        material_unit?: string;
    };
    createdAt?: Date;
    updatedAt?: Date;
}

// Define the notification schema
const notificationSchema = new Schema<INotification>(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        type: {
            type: String,
            enum: ['trip_request', 'trip_update', 'payment', 'system'],
            required: true
        },
        is_read: { type: Boolean, default: false },
        related_trip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Trip',
            index: true
        },
        notify_to: { type: String, enum: ["driver", "customer"], required: true },
        user_response: { type: String, enum: ['accepted', 'rejected'] },
        metadata: {
            trip_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
            fare: {
                customer: { type: Number, default: 0 },
                driver: { type: Number, default: 0 }
            },
            distance: { type: Number },
            from: { type: String },
            to: { type: String },
            from_location: {
                path: { type: String },
                coordinates: {
                    type: [Number],
                    required: false,
                    validate: {
                        validator: function (v: number[] | undefined) {
                            if (!v) return true;
                            return (
                                Array.isArray(v) &&
                                v.length === 2 &&
                                !isNaN(v[0]) &&
                                !isNaN(v[1]) &&
                                Math.abs(v[1]) <= 90 &&
                                Math.abs(v[0]) <= 180
                            );
                        },
                        message: 'Invalid pickup coordinates'
                    }
                }
            },
            to_location: {
                path: { type: String },
                coordinates: {
                    type: [Number],
                    required: false,
                    validate: {
                        validator: function (v: number[] | undefined) {
                            if (!v) return true;
                            return (
                                Array.isArray(v) &&
                                v.length === 2 &&
                                !isNaN(v[0]) &&
                                !isNaN(v[1]) &&
                                Math.abs(v[1]) <= 90 &&
                                Math.abs(v[0]) <= 180
                            );
                        },
                        message: 'Invalid destination coordinates'
                    }
                }
            },
            vehicle_type: { type: String },
            weight: { type: Number },
            material_unit: { type: String, enum: ['Kg', 'Litre', 'Ton'] }
        }
    },
    { timestamps: true }
);

// Add toJSON method (consistent with Trip schema)
notificationSchema.method('toJSON', function (this: INotification) {
    const { __v, _id, ...object } = this.toObject();
    return { ...object, _id: _id };
});

// Export as default
const Notification: Model<INotification> = mongoose.model<INotification>('Notification', notificationSchema);
export default Notification;
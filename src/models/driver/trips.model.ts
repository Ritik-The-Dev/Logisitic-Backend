import mongoose, { Document, Schema, Model } from 'mongoose';

interface IDriverResponse {
    driver: mongoose.Types.ObjectId;
    response: 'pending' | 'accepted' | 'rejected';
    responded_at: Date | null;
}

// Define the main Trip document interface
export interface ITrip extends Document {
    user: mongoose.Types.ObjectId;
    distance?: number;
    trip_cost_customer?: number;
    trip_cost_driver?: number;
    from?: string;
    to?: string;
    material?: mongoose.Types.ObjectId;
    material_unit: string;
    weight: number;
    material_width: number;
    material_height: number;
    eta_pickup?: Date;
    alternate_contact_no: string;
    assisstant: number;
    status?: string;
    status_stack: Array<{
        stack_id: number;
        status: string;
        createdAt: Date;
    }>;
    is_payment_done: Boolean;
    total_toll_tax_amount: number;
    total_tolls: [object];
    customer_freight: number;
    driver_freight: number;
    app_charges: number;
    fare_used: {
        customer_base_fare: number,
        customer_km_fare: number,
        driver_base_fare: number,
        driver_km_fare: number
    };
    driver: mongoose.Types.ObjectId;
    assigned_at: Date;
    vehicle_type: mongoose.Types.ObjectId;
    vehicle_details: mongoose.Types.ObjectId;
    from_latitude: number;
    from_longitude: number;
    payment: [object];
    potential_drivers: string;
    driver_responses: IDriverResponse[];
    to_latitude: number;
    to_longitude: number;
    createdAt?: Date;
    updatedAt?: Date;
}

// Define the trip schema
const tripSchema = new Schema<ITrip>(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        distance: { type: Number, default: 0 },
        trip_cost_customer: { type: Number, default: 0 },
        trip_cost_driver: { type: Number, default: 0 },
        from: { type: String },
        to: { type: String },
        material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material_Box', required: true, index: true },
        material_unit: { type: String, default: "Kg", enum: ['Kg', 'Litre', 'Ton'] },
        weight: { type: Number },
        material_width: { type: Number, default: 0 },
        material_height: { type: Number, default: 0 },
        eta_pickup: { type: Date },
        alternate_contact_no: { type: String },
        assisstant: { type: Number, default: 0 },
        status: { type: String, enum: ["scheduled", "loading", "in_transit", "unloading", "delivered", "cancelled", "failed_delivery", "delayed", "returned", "searching"], default: "searching" },
        status_stack: [{
            stack_id: { type: Number, default: 1 },
            status: { type: String, default: 'searching' },
            createdAt: { type: Date, default: new Date() }
        }],
        is_payment_done: { type: Boolean, default: false },
        vehicle_type: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle_type', index: true },
        vehicle_details: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
        driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        assigned_at: { type: Date },
        total_toll_tax_amount: { type: Number, default: 0 },
        total_tolls: [{ type: Object }],
        customer_freight: { type: Number, default: 0 },
        driver_freight: { type: Number, default: 0 },
        fare_used: {
            customer_base_fare: { type: Number, default: 0 },
            customer_km_fare: { type: Number, default: 0 },
            driver_base_fare: { type: Number, default: 0 },
            driver_km_fare: { type: Number, default: 0 },
        },
        app_charges: { type: Number, default: 0 },
        from_latitude: { type: Number, required: true },
        from_longitude: { type: Number, required: true },
        to_latitude: { type: Number, default: null },
        to_longitude: { type: Number, default: null },
        payment: [{ type: Object }],
        potential_drivers: [{ type: String }],
        driver_responses: [{ type: Object }]
    },
    { timestamps: true }
);

// Add toJSON method
tripSchema.method('toJSON', function (this: ITrip) {
    const { __v, _id, ...object } = this.toObject();
    return { ...object, _id: _id };
});

// Export as default
const Trip: Model<ITrip> = mongoose.model<ITrip>('Trips', tripSchema);
export default Trip;

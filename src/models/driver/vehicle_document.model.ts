import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for the Document model
export interface IVehicleDocument extends Document {
    // user: mongoose.Types.ObjectId;
    vehicle_id: mongoose.Types.ObjectId,
    doc_no: string;
    doc_front_image: string;
    doc_back_image: string;
    expiry_date: Date;
    document_type: string;
    is_approved: boolean;
    approved_status: string;
    approved_notification: number;
    note: string;
    // insurance: string;
    // insurance_no: string;
    // puc_certificate: string;
    // puc_certificate_no: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// Define the documents schema
const vehicleDocumentSchema = new Schema<IVehicleDocument>(
    {
        // user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
        doc_no: { type: String },
        doc_front_image: { type: String, required: true },
        doc_back_image: { type: String },
        expiry_date: { type: Date , default: null},
        document_type: { type: String, enum: ["puc", "insurance", "driving_licence"], required: true },
        is_approved: { type: Boolean, default: false },
        approved_status: {
            type: String,
            default: "not_started",
            enum: ["not_started", "pending", "approved", "rejected"]
        },
        approved_notification: { type: Number, default: 0 },
        note: { type: String, default: "" }
        // insurance: { type: String },
        // insurance_no: { type: String },
        // puc_certificate: { type: String },
        // puc_certificate_no: { type: String }
    },
    { timestamps: true }
);

// Add toJSON method
vehicleDocumentSchema.method('toJSON', function (this: IVehicleDocument) {
    const { __v, _id, ...object } = this.toObject();
    return { ...object, _id: _id };
});

// Export as default
const VehicleDocument: Model<IVehicleDocument> = mongoose.model<IVehicleDocument>('Vehicle_document', vehicleDocumentSchema);
export default VehicleDocument;

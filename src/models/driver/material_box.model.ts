import mongoose, { Document, Schema, Model } from 'mongoose';

// TypeScript interface for the user session
export interface IMaterial extends Document {
    name: string;
    weight: string;
    box_image: string;
    type: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// Define the user session schema
const MaterialSchema = new Schema<IMaterial>(
    {
        name: { type: String, index: true, default: "" },
        box_image: { type: String },
        type: { type: String, required: true, index: true },
        weight: { type: String, index: true }
    },
    { timestamps: true }
);

// Add toJSON method
MaterialSchema.method('toJSON', function (this: IMaterial) {
    const { __v, _id, ...object } = this.toObject();
    return { ...object, _id: _id };
});

// Export as default
const Material: Model<IMaterial> = mongoose.model<IMaterial>('Material_Box', MaterialSchema);
export default Material;

/* Database Configuration */
import mongoose, { ConnectOptions } from 'mongoose';
import { DB_URL, DB_USER, DB_PASSWORD } from './constant';

export default async function connectDB(): Promise<void> {
    try {
        mongoose.set('strictQuery', false);

        const options: ConnectOptions = DB_USER ? {
            user: DB_USER,
            pass: DB_PASSWORD,
            authSource: "admin",
        } : {};

        await mongoose.connect(DB_URL || '', options);
        console.log('\n******************************\n\nConnected to MongoDB\n\n******************************\n');
    } catch (error) {
        console.error("Error connecting database: ", error);
    }
}



/* Packages */
import express, { Application, Request, Response } from 'express';
import { initSwagger, setupSwagger } from './swagger';
import cookieParser from "cookie-parser";
/* Database */
import connectDB from './config/database';
/* Collections */
import AllModels from './models';
import path from 'path';
import indexRouter from './routes';
import cors from 'cors';

const app: Application = express();

/* Database connection */
connectDB();
AllModels;

app.use(cors({
    origin: ["http://localhost:5174","http://localhost:3000", "https://chawlalogistics.xyz", "https://logistics-customer-view-frontend.vercel.app"],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],

    credentials: true
})); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

(async () => {
    await initSwagger();
    setupSwagger(app);
})();

app.use('/storage', express.static(path.join(__dirname, '/storage')));

/* Routes */
app.use('/', indexRouter);

app.get('/server', (req: Request, res: Response): void => {
    res.status(200).send({
        status: true,
        message: "Server is running..."
    });
});

export default app;

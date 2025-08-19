import swaggerAutogen from 'swagger-autogen';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import { readFileSync } from 'node:fs';
import path from 'path';
import { Application } from 'express';
import { NODE_ENVIRONMENT } from './config/constant';
import { setTimeout as wait } from 'node:timers/promises';

interface SwaggerDoc {
    info: {
        title: string;
        description: string;
        version: string;
    };
    host: string;
    schemes: string[];
    paths?: Record<string, any>;
    [key: string]: any;
}

const isProduction = NODE_ENVIRONMENT !== 'dev';
const isCompiled = path.extname(__filename) === '.js';

const currentDir = __dirname;
const baseDir = isCompiled ? path.join(currentDir, '..') : currentDir;

const doc: SwaggerDoc = {
    info: {
        title: 'Chawla Logistic API Documentation',
        description: 'API documentation for Chawla Logistic',
        version: '1.0.0',
    },
    host: "api.chawlalogistics.xyz",
    schemes: ["https", "http"]
};

const outputFile = path.join(isCompiled ? path.join(baseDir, 'src') : baseDir, 'swagger-output.json');
const endpointsFiles = [
    path.join(
        baseDir,
        isCompiled ? 'dist/routes/index.js' : 'routes/index.ts'
    )
];

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function generateSwagger(): Promise<void> {
    const swaggerGen = swaggerAutogen();
    await swaggerGen(outputFile, endpointsFiles, doc);

    let attempts = 0;
    while (!fs.existsSync(outputFile) && attempts < 10) {
        await wait(500);
        attempts++;
    }

    if (!fs.existsSync(outputFile)) {
        throw new Error(`Swagger output file not found after waiting: ${outputFile}`);
    }

    const swaggerData = JSON.parse(fs.readFileSync(outputFile, 'utf-8')) as SwaggerDoc;

    for (const path in swaggerData.paths) {
        for (const method in swaggerData.paths[path]) {
            if (!swaggerData.paths[path][method].tags) {
                const routePrefix = path.split('/')[1];
                swaggerData.paths[path][method].tags = [capitalize(routePrefix)];
            }
        }
    }

    fs.writeFileSync(outputFile, JSON.stringify(swaggerData, null, 2));
}

let swaggerDocument: SwaggerDoc | null = null;

export async function initSwagger(): Promise<void> {
    try {
        await generateSwagger();
        const swaggerPath = isCompiled
            ? path.join(baseDir, (isProduction ? 'dist' : ""), 'swagger-output.json')
            : outputFile;
        if (fs.existsSync(swaggerPath)) {
            const data = readFileSync(swaggerPath, 'utf8');
            swaggerDocument = JSON.parse(data) as SwaggerDoc;
        }
    } catch (error) {
        console.error('Failed to initialize Swagger:', error);
    }
}

export function setupSwagger(app: Application): void {
    if (swaggerDocument) {
        app.use('/swagger-api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    }
}

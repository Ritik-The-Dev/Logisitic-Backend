import multer, { FileFilterCallback } from 'multer';
import { dirname, extname, join } from 'path';
import fs from 'fs/promises';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

/* Admin Path */
let UPLOAD_DIR_ADMIN = join(__dirname, '../../storage/admin');
let UPLOAD_DIR_CUSTOMER = join(__dirname, '../../storage/customer');
const MAX_SIZE = 2 * 1024 * 1024;

const ensureUploadDir = async (TYPE: String): Promise<void> => {
  try {
    if (TYPE == "ADMIN") {
      await fs.mkdir(UPLOAD_DIR_ADMIN, { recursive: true });
    } else {
      await fs.mkdir(UPLOAD_DIR_CUSTOMER, { recursive: true });
    }

  } catch (err) {
    console.error('Error creating upload directory:', err);
    throw err;
  }
};

const storage = multer.diskStorage({
  destination: async (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    try {
      await ensureUploadDir("ADMIN");
      cb(null, UPLOAD_DIR_ADMIN);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const ext = file.originalname;
    const filename = `${Date.now()}_${ext}`;
    req.uploadedFile = filename;
    cb(null, filename);
  }
});

const appUploadAdminImage = multer({
  storage,
  limits: { fileSize: MAX_SIZE }
});




const storageCustomer = multer.diskStorage({
  destination: async (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    try {
      await ensureUploadDir("CUSTOMER");
      cb(null, UPLOAD_DIR_CUSTOMER);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const ext = file.originalname;
    const filename = `${Date.now()}_${ext}`;
    req.uploadedFile = filename;
    cb(null, filename);
  }
});

const appUploadCustomerImage = multer({
  storage: storageCustomer,
  limits: { fileSize: MAX_SIZE }
});

export { appUploadAdminImage, appUploadCustomerImage };
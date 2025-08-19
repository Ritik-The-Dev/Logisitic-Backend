import multer, { FileFilterCallback } from 'multer';
import { dirname, extname, join } from 'path';
import fs from 'fs/promises';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

let UPLOAD_DIR = join(__dirname, '../storage');
const MAX_SIZE = 2 * 1024 * 1024;

const ensureUploadDir = async (): Promise<void> => {
  try {

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating upload directory:', err);
    throw err;
  }
};

declare module 'express-serve-static-core' {
  interface Request {
    uploadedFile?: string;
  }
}

const storage = multer.diskStorage({
  destination: async (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    try {
      await ensureUploadDir();
      cb(null, UPLOAD_DIR);
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

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter
}).single('image');

const uploadImage = (req: Request, res: Response, type: String): Promise<void> => {
  if (type == "admin") {
    UPLOAD_DIR = join(__dirname, '../storage/admin');
  } else {
    UPLOAD_DIR = join(__dirname, '../storage/customer');
  }
  return new Promise((resolve, reject) => {
    upload(req, res, (err: any) => {
      if (err) {
        if ((err as MulterError).code === 'LIMIT_FILE_SIZE') {
          err.message = 'Image size exceeds 2MB limit';
        }
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const deleteImage = async (type: string, filename: string): Promise<boolean> => {
  try {
    if (type == "admin") {
      UPLOAD_DIR = join(__dirname, '../storage/admin');
    } else {
      UPLOAD_DIR = join(__dirname, '../storage/customer');
    }
    const filePath = join(UPLOAD_DIR, filename);
    await fs.unlink(filePath);
    return true;
  } catch (err) {
    console.error('Error deleting image:', err);
    throw err;
  }
};

export { uploadImage, deleteImage };

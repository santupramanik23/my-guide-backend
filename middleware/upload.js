import multer from "multer";
import createError from "http-errors";
import path from "path";
import crypto from "crypto";

/* ----------------------------- Configuration ----------------------------- */
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB default
const MAX_FILES = parseInt(process.env.MAX_FILES_PER_REQUEST) || 10;

// Allowed file types with their MIME types
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg", 
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml"
]);

const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);

const ALL_ALLOWED_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES
]);

/* ----------------------------- Storage Configuration ----------------------------- */
// Use memory storage for cloud uploads (Cloudinary)
const storage = multer.memoryStorage();

/* ----------------------------- File Filter ----------------------------- */
const createFileFilter = (allowedTypes = ALLOWED_IMAGE_TYPES) => {
  return (req, file, cb) => {
    // Check MIME type
    if (!allowedTypes.has(file.mimetype)) {
      const error = createError(400, `Unsupported file type: ${file.mimetype}. Allowed types: ${Array.from(allowedTypes).join(', ')}`);
      error.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(error);
    }

    // Check file extension as additional security
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'image/svg+xml': ['.svg'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    };

    const validExtensions = allowedExtensions[file.mimetype] || [];
    if (validExtensions.length > 0 && !validExtensions.includes(ext)) {
      const error = createError(400, `File extension ${ext} doesn't match MIME type ${file.mimetype}`);
      error.code = 'EXTENSION_MISMATCH';
      return cb(error);
    }

    // Generate unique filename
    const uniqueSuffix = crypto.randomBytes(6).toString('hex');
    const timestamp = Date.now();
    file.uniqueName = `${timestamp}-${uniqueSuffix}${ext}`;

    cb(null, true);
  };
};

/* ----------------------------- Multer Configurations ----------------------------- */
// Image upload configuration
const imageUpload = multer({
  storage,
  fileFilter: createFileFilter(ALLOWED_IMAGE_TYPES),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
    fields: 20,
    fieldNameSize: 50,
    fieldSize: 1024 * 1024 // 1MB per field
  }
});

// Document upload configuration
const documentUpload = multer({
  storage,
  fileFilter: createFileFilter(ALLOWED_DOCUMENT_TYPES),
  limits: {
    fileSize: MAX_FILE_SIZE * 2, // Larger limit for documents
    files: 5,
    fields: 20,
    fieldNameSize: 50,
    fieldSize: 1024 * 1024
  }
});

// General upload configuration (all file types)
const generalUpload = multer({
  storage,
  fileFilter: createFileFilter(ALL_ALLOWED_TYPES),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
    fields: 20,
    fieldNameSize: 50,
    fieldSize: 1024 * 1024
  }
});

/* ----------------------------- Upload Middleware Functions ----------------------------- */
// Single file upload (images)
export const uploadSingle = (fieldName = "file") => {
  return imageUpload.single(fieldName);
};

// Multiple files upload (images)
export const uploadArray = (fieldName = "files", maxCount = 5) => {
  return imageUpload.array(fieldName, maxCount);
};

// Multiple fields upload
export const uploadFields = (fields) => {
  return imageUpload.fields(fields);
};

// Document upload
export const uploadDocument = (fieldName = "document") => {
  return documentUpload.single(fieldName);
};

// General upload (any allowed file type)
export const uploadGeneral = (fieldName = "file") => {
  return generalUpload.single(fieldName);
};

// Multiple general files
export const uploadGeneralArray = (fieldName = "files", maxCount = 5) => {
  return generalUpload.array(fieldName, maxCount);
};

/* ----------------------------- Error Handler ----------------------------- */
export const handleUploadError = (err, req, res, next) => {
  // Handle Multer-specific errors
  if (err instanceof multer.MulterError) {
    let message = 'File upload error';
    let statusCode = 400;

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File too large. Maximum size allowed is ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB`;
        statusCode = 413;
        break;
        
      case 'LIMIT_FILE_COUNT':
        message = `Too many files. Maximum ${MAX_FILES} files allowed`;
        break;
        
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields in the request';
        break;
        
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        break;
        
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        break;
        
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts in the multipart request';
        break;
        
      case 'LIMIT_UNEXPECTED_FILE':
        message = `Unexpected file field. Expected field name: ${err.field}`;
        break;
        
      default:
        message = `Upload error: ${err.message}`;
    }

    return res.status(statusCode).json({
      status: statusCode,
      message,
      error: 'UPLOAD_ERROR',
      details: {
        code: err.code,
        field: err.field,
        maxFileSize: `${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB`,
        maxFiles: MAX_FILES
      }
    });
  }

  // Handle custom file filter errors
  if (err.code === 'UNSUPPORTED_FILE_TYPE' || err.code === 'EXTENSION_MISMATCH') {
    return res.status(400).json({
      status: 400,
      message: err.message,
      error: err.code,
      details: {
        allowedImageTypes: Array.from(ALLOWED_IMAGE_TYPES),
        allowedDocumentTypes: Array.from(ALLOWED_DOCUMENT_TYPES)
      }
    });
  }

  // Handle other upload-related errors
  if (err.message && err.message.includes('upload')) {
    return res.status(400).json({
      status: 400,
      message: 'File upload failed',
      error: 'UPLOAD_FAILED',
      details: err.message
    });
  }

  // Pass other errors to the general error handler
  next(err);
};

/* ----------------------------- Validation Middleware ----------------------------- */
// Validate uploaded files
export const validateFiles = (options = {}) => {
  const {
    required = false,
    minFiles = 0,
    maxFiles = MAX_FILES,
    allowedTypes = ALLOWED_IMAGE_TYPES
  } = options;

  return (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    
    // Check if files are required
    if (required && files.length === 0) {
      return res.status(400).json({
        status: 400,
        message: 'At least one file is required',
        error: 'NO_FILES_UPLOADED'
      });
    }

    // Check minimum files
    if (files.length < minFiles) {
      return res.status(400).json({
        status: 400,
        message: `At least ${minFiles} file(s) required`,
        error: 'INSUFFICIENT_FILES'
      });
    }

    // Check maximum files
    if (files.length > maxFiles) {
      return res.status(400).json({
        status: 400,
        message: `Maximum ${maxFiles} file(s) allowed`,
        error: 'TOO_MANY_FILES'
      });
    }

    // Validate each file
    for (const file of files) {
      // Check file type
      if (!allowedTypes.has(file.mimetype)) {
        return res.status(400).json({
          status: 400,
          message: `Invalid file type: ${file.mimetype}`,
          error: 'INVALID_FILE_TYPE',
          details: {
            allowedTypes: Array.from(allowedTypes)
          }
        });
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        return res.status(413).json({
          status: 413,
          message: `File "${file.originalname}" is too large`,
          error: 'FILE_TOO_LARGE',
          details: {
            maxSize: `${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB`
          }
        });
      }

      // Add file metadata
      file.metadata = {
        uploadedAt: new Date(),
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        type: file.mimetype,
        extension: path.extname(file.originalname).toLowerCase()
      };
    }

    next();
  };
};

/* ----------------------------- Utility Functions ----------------------------- */
// Format file size for human reading
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get file info
export const getFileInfo = (file) => {
  if (!file) return null;
  
  return {
    originalName: file.originalname,
    uniqueName: file.uniqueName,
    size: file.size,
    sizeFormatted: formatFileSize(file.size),
    mimeType: file.mimetype,
    extension: path.extname(file.originalname).toLowerCase(),
    uploadedAt: new Date(),
    buffer: file.buffer // Available for processing
  };
};

// File type checker
export const isImageFile = (mimetype) => ALLOWED_IMAGE_TYPES.has(mimetype);
export const isDocumentFile = (mimetype) => ALLOWED_DOCUMENT_TYPES.has(mimetype);

/* ----------------------------- Configuration Export ----------------------------- */
export const uploadConfig = {
  maxFileSize: MAX_FILE_SIZE,
  maxFiles: MAX_FILES,
  allowedImageTypes: Array.from(ALLOWED_IMAGE_TYPES),
  allowedDocumentTypes: Array.from(ALLOWED_DOCUMENT_TYPES),
  maxFileSizeFormatted: formatFileSize(MAX_FILE_SIZE)
};

// Backward compatibility exports
export const upload = imageUpload;
export default {
  uploadSingle,
  uploadArray,
  uploadFields,
  uploadDocument,
  uploadGeneral,
  uploadGeneralArray,
  handleUploadError,
  validateFiles,
  getFileInfo,
  isImageFile,
  isDocumentFile,
  uploadConfig
};
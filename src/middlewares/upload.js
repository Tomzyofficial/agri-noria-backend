/* import multer from "multer";

export const upload = multer({
   storage: multer.memoryStorage(),
   // limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
});
 */

import multer from "multer";

const storage = multer.memoryStorage();

const allowedMimeTypes = [
   "image/jpeg",
   "image/png",
   "image/webp",

   "video/mp4",
   "video/mov",
   "video/webm",

   "application/pdf",
];

const fileFilter = (req, file, cb) => {
   if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
   } else {
      cb(new Error("Unsupported file type"), false);
   }
};

export const upload = multer({
   storage,
   limits: {
      fileSize: 1024 * 1024 * 100, // 100MB
   },
   fileFilter,
});

const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/profiles");
  },
  filename: (req, file, cb) => {
  const ext = path.extname(file.originalname);
  const name = path.basename(file.originalname, ext);
  cb(null, name + ext);
  }
});

function fileFilter(req, file, cb) {
  const allowedTypes = ["image/png", "image/jpg", "image/jpeg"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PNG, JPG, and JPEG images are allowed"), false);
  }
}


module.exports = multer({ storage, fileFilter,
   limits: { fileSize: 5 * 1024 * 1024 } 
});

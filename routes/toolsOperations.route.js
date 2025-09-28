import express from "express";
import { uploadFileUsingMulter } from "../middlewares/multer.js";

import {
  mergingBgEdits,
  removeBg,
  resizeImg,
  upscaleImg,
} from "../controllers/toolsOperation.controllers.js";

const router = express.Router();

// image backround remove route
router.post("/removebg", uploadFileUsingMulter.single("image"), removeBg);

// image resize route
router.post("/resizeImg", uploadFileUsingMulter.single("image"), resizeImg);

// image upscale route
router.post("/upscaleImg", uploadFileUsingMulter.single("image"), upscaleImg);

router.post(
  "/mergingBgEdits",
  uploadFileUsingMulter.fields([
    { name: "image", maxCount: 1 },
    { name: "bgImage", maxCount: 1 },
  ]),
  mergingBgEdits
);

export default router;

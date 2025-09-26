import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import sharp from "sharp";
import FormData from "form-data";

import fetch from "node-fetch";
// add python3 instead of python before pushing to github

// Finding absolute path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function removeBg(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = path.resolve(__dirname, "../public/", req.file.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Uploaded file not found" });
    }

    const formData = new FormData();
    formData.append("input_file", fs.createReadStream(filePath));

    const response = await fetch(
      "https://zaryab009-remove-bg-api.hf.space/remove-bg",
      {
        method: "POST",
        body: formData,
        headers: formData.getHeaders(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `FastAPI request failed: ${response.statusText} - ${errorText}`
      );
      throw new Error(`FastAPI request failed: ${response.status}`);
    }

    const outputImage = await response.buffer();
    const outputPath = path.resolve(
      __dirname,
      "../public/",
      `quickbgremove_${req.file.filename}`
    );

    fs.writeFileSync(outputPath, outputImage);

    res.sendFile(outputPath, (err) => {
      if (err) {
        res.status(500).json({ message: "Error sending image back" });
      } else {
        fs.unlinkSync(filePath);
        fs.unlinkSync(outputPath);
      }
    });
  } catch (error) {
    next(error);
  }
}
async function resizeImg(req, res, next) {
  try {
    let { width, height } = req.body;
    if (!req.file || !width || !height) {
      return res.status(400).json({
        message: "Parameters missing",
      });
    }
    // converting strings to integers
    width = parseInt(width);
    height = parseInt(height);

    const filePath = path.resolve(__dirname, "../public/", req.file.filename);
    const outputFilePath = path.resolve(
      __dirname,
      "../public/",
      `quickResize_${Date.now()}.png`
    );

    // resize the image
    await sharp(filePath)
      .resize(width, height, { fit: "cover", position: "center" })
      .png({ compressionLevel: 9 }) // PNG keeps alpha channel
      .toFile(outputFilePath);

    res.download(outputFilePath, (err) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error downloading resized image" });
      }
      // Optionally delete the original and resized images after download
      fs.unlinkSync(filePath);
      fs.unlinkSync(outputFilePath);
    });
  } catch (error) {
    return next(error);
  }
}

async function upscaleImg(req, res, next) {
  try {
    console.log("hello");
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        message: "Image not found",
      });
    }

    const filePath = path.resolve(__dirname, "../public/", file.filename);
    const outputFilePath = path.resolve(
      __dirname,
      "../public/",
      `quickbgremove${Date.now()}.png`
    );

    await sharp(filePath)
      .sharpen({ sigma: 1 })
      .gamma(2.5)
      .normalise()
      .modulate({ brightness: 1.1, saturation: 1.1 })

      .png({ compressionLevel: 9 })
      .toFile(outputFilePath);

    res.download(outputFilePath, (err) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error downloading resized image" });
      }
      // Optionally delete the original and resized images after download
      fs.unlinkSync(filePath);
      fs.unlinkSync(outputFilePath);
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
}

export { removeBg, resizeImg, upscaleImg };

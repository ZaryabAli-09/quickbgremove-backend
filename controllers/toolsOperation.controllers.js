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

    const outputImage = await response.arrayBuffer();
    const outputImageBuffer = Buffer.from(outputImage);
    const outputPath = path.resolve(
      __dirname,
      "../public/",
      `quickbgremove_${req.file.filename}`
    );

    fs.writeFileSync(outputPath, outputImageBuffer);

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

async function mergingBgEdits(req, res, next) {
  try {
    console.log(req.files);
    const mainImage = req.files?.image?.[0];
    const bgImage = req.files?.bgImage?.[0];
    const { bgColor, bgImageUrl } = req.body;

    console.log(bgImage);
    if (!mainImage) {
      return res.status(400).json({ message: "image not found" });
    }

    let finalImage;

    const { width, height } = await sharp(mainImage.path).metadata();

    let bgImagePath;
    if (bgImage) {
      bgImagePath = path.resolve(__dirname, "../public/", bgImage.filename);
    }
    const mainImagePath = path.resolve(
      __dirname,
      "../public/",
      mainImage.filename
    );

    const outputFilePath = path.resolve(
      __dirname,
      "../public/",
      `quickResize_${Date.now()}.png`
    );

    // --- Case: bgColor applied ---
    if (bgColor) {
      finalImage = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: bgColor,
        },
      })
        .composite([{ input: mainImage.path, gravity: "center" }])
        .png()
        .toFile(outputFilePath);
    }
    // --- Case 2: Background image (uploaded file) ---
    else if (bgImage) {
      await sharp(bgImage.path)
        .resize(width, height)
        .composite([{ input: mainImage.path, gravity: "center" }])
        .png()
        .toFile(outputFilePath);
    } else if (bgImageUrl) {
      const response = await fetch(bgImageUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch background image: ${response.statusText}`
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      const backgroundBuffer = Buffer.from(arrayBuffer);

      await sharp(backgroundBuffer)
        .resize(width, height)
        .composite([{ input: mainImage.path, gravity: "center" }])
        .png()
        .toFile(outputFilePath);
    }
    res.download(outputFilePath, (err) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error downloading resized image" });
      }
      fs.unlinkSync(outputFilePath);
      fs.unlinkSync(mainImagePath);
      if (bgImagePath) fs.unlinkSync(bgImagePath);
    });
  } catch (error) {
    fs.unlinkSync(outputFilePath);
    fs.unlinkSync(mainImagePath);
    if (bgImagePath) fs.unlinkSync(bgImagePath);
    next(error);
  }
}

async function generateImage(req, res, next) {
  try {
    const { prompt } = req.body;
    console.log(prompt);

    // Check if prompt is provided
    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    // Call Hugging Face Inference API
    const response = await fetch(
      "https://router.huggingface.co/nscale/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `bearer ${process.env.HF_STABILITY_IMG_GEN_ACCESS_TOKEN}`,
          Authorization: `Bearer ${process.env.HF_STABILITY_IMG_GEN_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response_format: "b64_json",
          prompt,
          model: "stabilityai/stable-diffusion-xl-base-1.0",
        }),
      }
    );

    // Check if the response is OK
    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ message: err });
    }

    // Parse the response and return the base64 string
    const result = await response.json();
    const base64 = result.data[0].b64_json;
    // Convert base64 -> Buffer
    const buffer = Buffer.from(base64, "base64");

    // Save temp file
    const outputPath = path.resolve(
      __dirname,
      "../public/",
      `generated_${Date.now()}.png`
    );
    fs.writeFileSync(outputPath, buffer);

    // Send back the file
    res.sendFile(outputPath, (err) => {
      if (err) {
        console.error("Error sending image:", err);
        res.status(500).json({ message: "Error sending image back" });
      } else {
        // cleanup
        fs.unlinkSync(outputPath);
      }
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export { removeBg, resizeImg, upscaleImg, mergingBgEdits, generateImage };

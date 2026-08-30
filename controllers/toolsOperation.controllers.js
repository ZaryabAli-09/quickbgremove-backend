import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import sharp from "sharp";
import FormData from "form-data";
import fetch from "node-fetch";
import { Client } from "@gradio/client";

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
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `FastAPI request failed: ${response.statusText} - ${errorText}`,
      );
      throw new Error(`FastAPI request failed: ${response.status}`);
    }

    const outputImage = await response.arrayBuffer();
    const outputImageBuffer = Buffer.from(outputImage);
    const outputPath = path.resolve(
      __dirname,
      "../public/",
      `quickbgremove_${req.file.filename}`,
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
      `quickResize_${Date.now()}.png`,
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
      `quickbgremove${Date.now()}.png`,
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
    next(error);
  }
}

async function mergingBgEdits(req, res, next) {
  try {
    const mainImage = req.files?.image?.[0];
    const bgImage = req.files?.bgImage?.[0];
    const { bgColor, bgImageUrl } = req.body;

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
      mainImage.filename,
    );

    const outputFilePath = path.resolve(
      __dirname,
      "../public/",
      `quickResize_${Date.now()}.png`,
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
          `Failed to fetch background image: ${response.statusText}`,
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

    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    const client = await Client.connect("black-forest-labs/FLUX.1-schnell");
    const result = await client.predict("/infer", {
      prompt: prompt,
      seed: 0,
      randomize_seed: true,
      width: 512,
      height: 512,
      num_inference_steps: 1,
    });

    console.log(result.data);

    if (!result) {
      return res.status(500).json({ message: "Error generating image" });
    }

    res.json({ imageUrl: result?.data[0]?.url });
  } catch (error) {
    if (error.success === false && error.stage === "error") {
      return res.status(500).json({
        message:
          "Service is temporarily unavailable. This happens because it's running on a shared public model. Please try again shortly.",
      });
    }
    console.error();
    next(error);
  }
}

export { removeBg, resizeImg, upscaleImg, mergingBgEdits, generateImage };

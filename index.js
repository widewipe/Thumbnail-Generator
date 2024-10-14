// const { removeBackgroundFromImageBase64 } = require("remove.bg");
const axios = require("axios");
const sharp = require("sharp");

async function removeBg(base64image) {
  // const endpoint =
  //   " https://jd3pa3th08.execute-api.us-east-1.amazonaws.com/default/remove_bg";
  const endpoint =
    "https://y3rbjxe1x6.execute-api.us-east-1.amazonaws.com/default/remove_bg";

  try {
    const response = await axios.post(endpoint, {
      prompt: base64image,
    });
    console.log(response);

    if (response.data && response.data.image_link) {
      return response.data.image_link; // Return URL of the image with background removed
    } else {
      throw new Error("No image_link found.");
    }
  } catch (error) {
    console.error("Error details:", error.toJSON ? error.toJSON() : error);
    if (error.response) {
      console.error("Error response data:", error.response.data); // API response details
      console.error("Error status code:", error.response.status); // Status code
      console.error("Error headers:", error.response.headers); // Response headers
    }
    throw error;
  }
}

const textSvgStr = async (
  text,
  imgW,
  imgH,
  text_color,
  text_font,
  font_size,
  text_position,
  text_orientation
) => {
  let autoFS = 0;

  const coordinates = text_position.split(" ");
  const xCoord = Number(coordinates[0]);
  const yCoord = Number(coordinates[1]);

  const xPixel = (xCoord / 100) * imgW;
  const yPixel = (yCoord / 100) * imgH;

  let rotateAngle;
  switch (text_orientation) {
    case "bottom_left_to_top_right":
      rotateAngle = -45;
      break;
    case "top_left_to_bottom_right":
      rotateAngle = 45;
      break;
    case "top_right_to_bottom_left":
      rotateAngle = 135;
      break;
    case "bottom_right_to_top_left":
      rotateAngle = -135;
      break;
    case "right_to_left":
      rotateAngle = 180;
      break;
    default:
      rotateAngle = 0; // No rotation
      break;
  }

  const maxW = imgW * 0.8;
  const fontSize = Math.min(
    Math.floor(imgW / (text.length * 0.5)),
    imgH * 0.15
  );
  if (font_size === "auto" || !font_size) {
    autoFS = 1;
    font_size = fontSize;
  }
  const maxLineLength = Math.floor(imgW / (font_size * 0.8)); // Dynamically calculate max line length

  const words = text.split(" ");
  const lines = [];
  let curLine = "";

  for (const word of words) {
    if ((curLine + word).length <= maxLineLength) {
      curLine += (curLine ? " " : "") + word;
    } else {
      lines.push(curLine);
      curLine = word;
    }
  }
  if (curLine) {
    lines.push(curLine);
  }

  console.log(lines);

  const lineHeight = font_size * 1.2; // Adjust line height
  // const startY = imgH * 0.01; // Starting Y position

  const offsetX = imgW * (xCoord / 100);
  const offsetY = imgH * (yCoord / 100);

  let textSvgString = `<svg width="${imgW}" height="${imgH}">
    <style>
      .heavy { font-weight: bold; font-size: ${font_size}px; font-family: '${text_font}', sans-serif; fill: ${text_color}; }
    </style>
    <text x="${offsetX}" y="${offsetY}" text-anchor="start" dominant-baseline="hanging" transform="rotate(${rotateAngle}, ${offsetX}, ${offsetY})">
  `;

  lines.forEach((line, index) => {
    if (autoFS === 1) {
      let adjustedFontSize = font_size;
      let estimatedWidth = line.length * (font_size * 0.6);

      while (estimatedWidth < maxW && adjustedFontSize < fontSize * 2) {
        adjustedFontSize += 1; // Increment font size until it fits
        estimatedWidth = line.length * (adjustedFontSize * 0.6);
      }

      // let adjustedY = (imgH * (yCoord/100)) + (index * adjustedFontSize * 1.5);

      textSvgString += `<tspan x="${offsetX}" dy="${
        adjustedFontSize * 1
      }" style="font-size:${adjustedFontSize}px" class="heavy">${line}</tspan>`;
    } else {
      textSvgString += `<tspan x="${offsetX}" dy="${
        font_size * 1
      }" style="font-size:${font_size}px" class="heavy">${line}</tspan>`;
    }
  });

  textSvgString += `</text></svg>`;

  return textSvgString;
};

async function compressAndConvertToBase64(imageBuffer) {
  const compressedImageBuffer = await sharp(imageBuffer)
    .resize({ width: 800 }) // Resize the image as needed
    .jpeg({ quality: 60 }) // Compress image
    .toBuffer();
  const mimeType = "image/jpeg";
  return `data:${mimeType};base64,${compressedImageBuffer.toString("base64")}`;
}

const processImage = async (
  imageBuffer,
  text,
  image_type,
  text_font,
  text_color,
  font_size,
  text_position,
  text_orientation
) => {
  const originalImgMetadata = await sharp(imageBuffer).metadata();

  let width, height;

  // Adjust dimensions based on image_type
  if (image_type === "landscape") {
    width = originalImgMetadata.width;
    height = Math.floor((width / 16) * 9); // 16:9 aspect ratio
  } else if (image_type === "square") {
    width = originalImgMetadata.width;
    height = width; // 1:1 aspect ratio
  } else {
    // Portrait or default case
    width = originalImgMetadata.width;
    height = originalImgMetadata.height; // Preserve original dimensions
  }

  // **Further reduce image dimensions** (smaller than before to avoid 413 error)
  const maxWidth = 800; // Set a max width (you can adjust this)
  if (width > maxWidth) {
    const scaleFactor = maxWidth / width;
    width = maxWidth;
    height = Math.floor(height * scaleFactor);
  }

  // **Compress the original image further** (JPEG quality to 50%)
  const compressedImageBuffer = await sharp(imageBuffer)
    .resize({ width, height }) // Resize based on new width/height
    .jpeg({ quality: 50 }) // Compress image to 50% quality to reduce size
    .toBuffer();

  const base64Image = `data:image/jpeg;base64,${compressedImageBuffer.toString(
    "base64"
  )}`;

  // console.log(`Compressed image size: ${Buffer.byteLength(compressedImageBuffer)} bytes`);

  // Call the function to remove the background using the compressed image
  const bgRemovedImageUrl = await removeBg(base64Image); // Assuming removeBg returns a URL
  const { data: bgRemovedImageBuffer } = await axios({
    url: bgRemovedImageUrl,
    responseType: "arraybuffer",
  });

  // Resize the background-removed image
  const resizedBgRemovedImage = await sharp(bgRemovedImageBuffer)
    .resize(width, height)
    .toBuffer();

  // Resize the original image to the new aspect ratio (based on image_type)
  const resizedOriginalImage = await sharp(imageBuffer)
    .resize(width, height)
    .toBuffer();

  // Define the font size based on the new height
  // const fontSize = Math.floor(height * 0.1);

  // **Here, we define text position for color determination**
  // const textWidth = width * 0.8; // Assuming text occupies 80% of the image width
  // const textHeight = height * 0.15; // Assuming text height is 15% of the image height
  // const x = (width - textWidth) / 2; // Centered horizontally
  // const y = height * 0.1; // Place 10% from the top

  // const textPosition = { x, y };

  // **Call determineColor() function**
  // const text_color = await determineTextColor(
  //   resizedOriginalImage,
  //   textPosition,
  //   textWidth,
  //   textHeight
  // );

  // Create the SVG text string with the determined color
  const textSvg = await textSvgStr(
    text,
    width,
    height,
    text_color,
    text_font,
    font_size,
    text_position,
    text_orientation
  );

  // Convert the SVG text to an image layer
  const textLayer = await sharp(Buffer.from(textSvg)).png().toBuffer();

  // Composite the text on the resized original image
  const imageWithText = await sharp(resizedOriginalImage)
    .composite([{ input: textLayer, blend: "over" }])
    .toBuffer();

  // Composite the subject (background removed) back onto the image with text
  const finalImage = await sharp(imageWithText)
    .composite([{ input: resizedBgRemovedImage, blend: "over" }])
    .toBuffer();

  return finalImage;
  // return imageWithText;
};

// EXPRESS APP

const express = require("express");
const multer = require("multer");

const upload = multer();
const app = express();

app.post("/process-image", upload.single("image"), async (req, res) => {
  try {
    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const imageBuffer = req.file.buffer;
    const {
      text,
      image_type,
      text_font,
      text_color,
      font_size,
      text_position,
      text_orientation,
    } = req.body;

    // Call the refactored processImage function
    const finalImage = await processImage(
      imageBuffer,
      text,
      image_type,
      text_font,
      text_color,
      font_size,
      text_position,
      text_orientation
    );

    // Set response type and send the final image
    res.set("Content-Type", "image/png");
    res.send(finalImage);
  } catch (error) {
    console.error("Error details:", error.message);

    // Send a more detailed error message
    res.status(500).json({
      success: false,
      message: error.message || "Unknown error",
      errorDetails: error.toString(),
    });
  }
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});

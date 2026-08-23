import express, {
  type Request,
  type Response,
} from "express";

import cors from "cors";
import multer from "multer";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { convertToMp3 } from "./services/ffmpeg.js";

const app = express();

const PORT = 5000;

app.use(cors());
app.use(express.json());

const storageRoot = path.join(process.cwd(), "storage");
const uploadDirectory = path.join(storageRoot, "uploads");
const outputDirectory = path.join(storageRoot, "output");

fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

fs.mkdirSync(outputDirectory, {
  recursive: true,
});

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname);

    callback(
      null,
      `${randomUUID()}${extension}`
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "ClipForge API",
    status: "running",
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "ClipForge API is healthy",
  });
});

app.post(
  "/api/convert/mp3",
  upload.single("file"),

  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No media file was uploaded.",
      });
    }

    const inputPath = req.file.path;

    const outputFilename = `${randomUUID()}.mp3`;

    const outputPath = path.join(
      outputDirectory,
      outputFilename
    );

    try {
      console.log(`Converting: ${req.file.originalname}`);

      await convertToMp3(
        inputPath,
        outputPath
      );

      console.log(`Conversion finished: ${outputFilename}`);

      const originalName = path.parse(
        req.file.originalname
      ).name;

      res.download(
        outputPath,
        `${originalName}.mp3`,

        (error) => {
          fs.rm(inputPath, {
            force: true,
          }, () => {});

          fs.rm(outputPath, {
            force: true,
          }, () => {});

          if (error) {
            console.error(
              "Download error:",
              error
            );
          }
        }
      );
    } catch (error) {
      fs.rm(inputPath, {
        force: true,
      }, () => {});

      fs.rm(outputPath, {
        force: true,
      }, () => {});

      console.error(
        "Conversion error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Media conversion failed.",
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(
    `ClipForge API running at http://localhost:${PORT}`
  );
});
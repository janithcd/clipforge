import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import cors from "cors";
import multer from "multer";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  convertMedia,
  type AudioBitrate,
  type OutputFormat,
  type VideoQuality,
} from "./services/ffmpeg.js";

const app = express();

const PORT = 5000;

app.use(cors());
app.use(express.json());

const storageRoot = path.join(
  process.cwd(),
  "storage"
);

const uploadDirectory = path.join(
  storageRoot,
  "uploads"
);

const outputDirectory = path.join(
  storageRoot,
  "output"
);

fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

fs.mkdirSync(outputDirectory, {
  recursive: true,
});

const storage = multer.diskStorage({
  destination: (
    _req,
    _file,
    callback
  ) => {
    callback(
      null,
      uploadDirectory
    );
  },

  filename: (
    _req,
    file,
    callback
  ) => {
    const extension = path.extname(
      file.originalname
    );

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

  fileFilter: (
    _req,
    file,
    callback
  ) => {
    const allowedMimeTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",

      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/aac",
      "audio/ogg",
      "audio/webm",

      // curl.exe can send files using this MIME type
      "application/octet-stream",
    ];

    const allowedExtensions = [
      ".mp4",
      ".mov",
      ".webm",
      ".avi",
      ".mkv",
      ".mp3",
      ".wav",
      ".m4a",
      ".aac",
      ".ogg",
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const mimeType = file.mimetype.toLowerCase();

    const validMimeType =
      allowedMimeTypes.includes(
        mimeType
      );

    const validExtension =
      allowedExtensions.includes(
        extension
      );

    if (
      !validMimeType ||
      !validExtension
    ) {
      callback(
        new Error(
          "Unsupported media file. Please upload a valid video or audio file."
        )
      );

      return;
    }

    callback(null, true);
  },
});

app.get(
  "/",
  (
    _req: Request,
    res: Response
  ) => {
    res.json({
      name: "ClipForge API",
      version: "0.2.0",
      status: "running",
    });
  }
);

app.get(
  "/api/health",
  (
    _req: Request,
    res: Response
  ) => {
    res.json({
      success: true,
      message:
        "ClipForge API is healthy",
    });
  }
);

app.post(
  "/api/convert",

  upload.single("file"),

  async (
    req: Request,
    res: Response
  ) => {
    if (!req.file) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "No media file was uploaded.",
        });
    }

    const format =
      req.body
        .format as OutputFormat;

    if (
      format !== "mp3" &&
      format !== "mp4"
    ) {
      fs.rm(
        req.file.path,
        {
          force: true,
        },
        () => {}
      );

      return res
        .status(400)
        .json({
          success: false,
          message:
            "Invalid output format.",
        });
    }

    const allowedBitrates: AudioBitrate[] =
      [
        "128k",
        "192k",
        "256k",
        "320k",
      ];

    const allowedQualities: VideoQuality[] =
  [
    "original",
    "480",
    "720",
    "1080",
  ];

    let audioBitrate:
      | AudioBitrate
      | undefined;

    let videoQuality:
      | VideoQuality
      | undefined;

    if (format === "mp3") {
      const requestedBitrate =
        req.body
          .audioBitrate as AudioBitrate;

      audioBitrate =
        allowedBitrates.includes(
          requestedBitrate
        )
          ? requestedBitrate
          : "192k";
    }

    if (format === "mp4") {
      const requestedQuality =
        req.body
          .videoQuality as VideoQuality;

      videoQuality =
  allowedQualities.includes(
    requestedQuality
  )
    ? requestedQuality
    : "original";
    }

    const inputPath =
      req.file.path;

    const outputFilename =
      `${randomUUID()}.${format}`;

    const outputPath =
      path.join(
        outputDirectory,
        outputFilename
      );

    try {
      console.log(
        `Converting: ${req.file.originalname}`
      );

      console.log(
        `Format: ${format}`
      );

      if (format === "mp3") {
        console.log(
          `Audio bitrate: ${audioBitrate}`
        );
      }

      if (format === "mp4") {
  console.log(
    videoQuality ===
      "original"
      ? "Video quality: original resolution"
      : `Video quality: ${videoQuality}p`
  );
}

      await convertMedia(
        inputPath,
        outputPath,
        {
          format,
          audioBitrate,
          videoQuality,
        }
      );

      console.log(
        `Conversion finished: ${outputFilename}`
      );

      const originalName =
        path.parse(
          req.file.originalname
        ).name;

      res.download(
        outputPath,
        `${originalName}.${format}`,

        (error) => {
          fs.rm(
            inputPath,
            {
              force: true,
            },
            () => {}
          );

          fs.rm(
            outputPath,
            {
              force: true,
            },
            () => {}
          );

          if (error) {
            console.error(
              "Download error:",
              error
            );
          }
        }
      );
    } catch (error) {
      fs.rm(
        inputPath,
        {
          force: true,
        },
        () => {}
      );

      fs.rm(
        outputPath,
        {
          force: true,
        },
        () => {}
      );

      console.error(
        "Conversion error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Media conversion failed.",
        });
    }
  }
);

/*
 * Global upload / request error handler
 */
app.use(
  (
    error: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error(
      "Request error:",
      error.message
    );

    if (
      error instanceof multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res
          .status(413)
          .json({
            success: false,
            message:
              "File is too large. Maximum upload size is 500 MB.",
          });
      }

      return res
        .status(400)
        .json({
          success: false,
          message:
            error.message,
        });
    }

    return res
      .status(400)
      .json({
        success: false,
        message:
          error.message ||
          "Invalid request.",
      });
  }
);

app.listen(
  PORT,
  () => {
    console.log(
      `ClipForge API running at http://localhost:${PORT}`
    );
  }
);
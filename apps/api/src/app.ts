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

/*
 * ----------------------------------------------------
 * Storage configuration
 * ----------------------------------------------------
 */

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

/*
 * ----------------------------------------------------
 * Multer configuration
 * ----------------------------------------------------
 */

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
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    callback(
      null,
      `${randomUUID()}${extension}`
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize:
      500 * 1024 * 1024,
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

      // curl.exe may use this
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

    const mimeType =
      file.mimetype.toLowerCase();

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

    callback(
      null,
      true
    );
  },
});

/*
 * ----------------------------------------------------
 * Conversion jobs
 * ----------------------------------------------------
 */

type JobStatus =
  | "processing"
  | "completed"
  | "failed";

interface ConversionJob {
  id: string;

  status: JobStatus;

  progress: number;

  inputPath: string;

  outputPath: string;

  downloadName: string;

  format: OutputFormat;

  error?: string;
}

const jobs = new Map<
  string,
  ConversionJob
>();

function removeFile(
  filePath: string
) {
  fs.rm(
    filePath,
    {
      force: true,
    },
    (error) => {
      if (error) {
        console.error(
          `Unable to remove file: ${filePath}`,
          error
        );
      }
    }
  );
}

/*
 * Remove abandoned jobs after a period
 * so memory/storage does not grow forever.
 */
function scheduleJobCleanup(
  jobId: string,
  delay =
    30 * 60 * 1000
) {
  const timer = setTimeout(
    () => {
      const job =
        jobs.get(jobId);

      if (!job) {
        return;
      }

      removeFile(
        job.inputPath
      );

      removeFile(
        job.outputPath
      );

      jobs.delete(
        jobId
      );

      console.log(
        `Cleaned expired job: ${jobId}`
      );
    },
    delay
  );

  timer.unref();
}

/*
 * ----------------------------------------------------
 * Basic API routes
 * ----------------------------------------------------
 */

app.get(
  "/",
  (
    _req: Request,
    res: Response
  ) => {
    return res.json({
      name:
        "ClipForge API",

      version:
        "0.3.0",

      status:
        "running",
    });
  }
);

app.get(
  "/api/health",
  (
    _req: Request,
    res: Response
  ) => {
    return res.json({
      success:
        true,

      message:
        "ClipForge API is healthy",
    });
  }
);

/*
 * ----------------------------------------------------
 * Create conversion job
 *
 * POST /api/jobs
 * ----------------------------------------------------
 */

app.post(
  "/api/jobs",

  upload.single(
    "file"
  ),

  (
    req: Request,
    res: Response
  ) => {
    if (!req.file) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "No media file was uploaded.",
        });
    }

    /*
     * Validate format
     */

    const format =
      req.body
        .format as OutputFormat;

    if (
      format !== "mp3" &&
      format !== "mp4"
    ) {
      removeFile(
        req.file.path
      );

      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Invalid output format.",
        });
    }

    /*
     * MP3 quality validation
     */

    const allowedBitrates:
      AudioBitrate[] = [
        "128k",
        "192k",
        "256k",
        "320k",
      ];

    /*
     * MP4 quality validation
     */

    const allowedQualities:
      VideoQuality[] = [
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

    if (
      format === "mp3"
    ) {
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

    if (
      format === "mp4"
    ) {
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

    /*
     * Create job
     */

    const jobId =
      randomUUID();

    const outputFilename =
      `${jobId}.${format}`;

    const outputPath =
      path.join(
        outputDirectory,
        outputFilename
      );

    const originalName =
      path.parse(
        req.file.originalname
      ).name;

    const job:
      ConversionJob = {
        id:
          jobId,

        status:
          "processing",

        progress:
          0,

        inputPath:
          req.file.path,

        outputPath,

        downloadName:
          `${originalName}.${format}`,

        format,
      };

    jobs.set(
      jobId,
      job
    );

    console.log(
      `Created conversion job: ${jobId}`
    );

    console.log(
      `Input: ${req.file.originalname}`
    );

    console.log(
      `Format: ${format}`
    );

    if (
      format === "mp3"
    ) {
      console.log(
        `Audio bitrate: ${audioBitrate}`
      );
    }

    if (
      format === "mp4"
    ) {
      console.log(
        videoQuality ===
          "original"
          ? "Video quality: original"
          : `Video quality: ${videoQuality}p`
      );
    }

    /*
     * Immediately return the
     * job ID to the frontend.
     */

    res
      .status(202)
      .json({
        success:
          true,

        jobId,
      });

    /*
     * Begin conversion after
     * response has been sent.
     */

    void convertMedia(
      job.inputPath,
      job.outputPath,
      {
        format,
        audioBitrate,
        videoQuality,

        onProgress: (
          progress
        ) => {
          const currentJob =
            jobs.get(
              jobId
            );

          if (
            !currentJob
          ) {
            return;
          }

          currentJob.progress =
            progress;

          console.log(
            `Job ${jobId}: ${progress}%`
          );
        },
      }
    )
      .then(
        () => {
          const currentJob =
            jobs.get(
              jobId
            );

          if (
            !currentJob
          ) {
            return;
          }

          currentJob.status =
            "completed";

          currentJob.progress =
            100;

          /*
           * Original upload is
           * no longer required.
           */

          removeFile(
            currentJob.inputPath
          );

          console.log(
            `Job completed: ${jobId}`
          );

          /*
           * If user never downloads
           * the result, clean it later.
           */

          scheduleJobCleanup(
            jobId
          );
        }
      )

      .catch(
        (
          error:
            unknown
        ) => {
          const currentJob =
            jobs.get(
              jobId
            );

          if (
            !currentJob
          ) {
            return;
          }

          currentJob.status =
            "failed";

          currentJob.progress =
            0;

          currentJob.error =
            error instanceof
            Error
              ? error.message
              : "Conversion failed.";

          removeFile(
            currentJob.inputPath
          );

          removeFile(
            currentJob.outputPath
          );

          console.error(
            `Job failed: ${jobId}`,
            error
          );

          /*
           * Keep failed job around
           * briefly so frontend can
           * read the error message.
           */

          scheduleJobCleanup(
            jobId,
            15 *
              60 *
              1000
          );
        }
      );
  }
);

/*
 * ----------------------------------------------------
 * Get conversion status
 *
 * GET /api/jobs/:id
 * ----------------------------------------------------
 */

app.get(
  "/api/jobs/:id",

  (
    req: Request,
    res: Response
  ) => {
    const job =
      jobs.get(
        req.params.id
      );

    if (!job) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Conversion job not found.",
        });
    }

    return res.json({
      success:
        true,

      job: {
        id:
          job.id,

        status:
          job.status,

        progress:
          job.progress,

        format:
          job.format,

        error:
          job.error,
      },
    });
  }
);

/*
 * ----------------------------------------------------
 * Download converted media
 *
 * GET /api/jobs/:id/download
 * ----------------------------------------------------
 */

app.get(
  "/api/jobs/:id/download",

  (
    req: Request,
    res: Response
  ) => {
    const job =
      jobs.get(
        req.params.id
      );

    if (!job) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Conversion job not found.",
        });
    }

    if (
      job.status ===
      "failed"
    ) {
      return res
        .status(409)
        .json({
          success:
            false,

          message:
            job.error ??
            "Conversion failed.",
        });
    }

    if (
      job.status !==
      "completed"
    ) {
      return res
        .status(409)
        .json({
          success:
            false,

          message:
            "Conversion is not complete yet.",
        });
    }

    if (
      !fs.existsSync(
        job.outputPath
      )
    ) {
      jobs.delete(
        job.id
      );

      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Converted file is no longer available.",
        });
    }

    console.log(
      `Starting download for job: ${job.id}`
    );

    return res.download(
      job.outputPath,
      job.downloadName,

      (error) => {
        if (error) {
          console.error(
            `Download error for job ${job.id}:`,
            error
          );

          return;
        }

        console.log(
          `Download finished: ${job.id}`
        );

        /*
         * Conversion output is
         * temporary, so remove it
         * once download succeeds.
         */

        removeFile(
          job.outputPath
        );

        jobs.delete(
          job.id
        );
      }
    );
  }
);

/*
 * ----------------------------------------------------
 * Global upload / request error handler
 *
 * Keep this AFTER all API routes.
 * ----------------------------------------------------
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
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res
          .status(413)
          .json({
            success:
              false,

            message:
              "File is too large. Maximum upload size is 500 MB.",
          });
      }

      return res
        .status(400)
        .json({
          success:
            false,

          message:
            error.message,
        });
    }

    return res
      .status(400)
      .json({
        success:
          false,

        message:
          error.message ||
          "Invalid request.",
      });
  }
);

/*
 * ----------------------------------------------------
 * Start server
 * ----------------------------------------------------
 */

app.listen(
  PORT,
  () => {
    console.log(
      `ClipForge API running at http://localhost:${PORT}`
    );
  }
);
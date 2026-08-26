import express, {
  type NextFunction,
  type Request,
  type Response,
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
|--------------------------------------------------------------------------
| Storage
|--------------------------------------------------------------------------
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

fs.mkdirSync(
  uploadDirectory,
  {
    recursive: true,
  }
);

fs.mkdirSync(
  outputDirectory,
  {
    recursive: true,
  }
);

/*
|--------------------------------------------------------------------------
| Multer
|--------------------------------------------------------------------------
*/

const storage =
  multer.diskStorage({
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
      const extension =
        path
          .extname(
            file.originalname
          )
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

      /*
       * curl.exe sometimes
       * uses this MIME type.
       */
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

    const extension =
      path
        .extname(
          file.originalname
        )
        .toLowerCase();

    const mimeType =
      file.mimetype
        .toLowerCase();

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
|--------------------------------------------------------------------------
| Conversion Jobs
|--------------------------------------------------------------------------
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

/*
 * Explicit route params type.
 *
 * This fixes the TypeScript error
 * around req.params.id.
 */
interface JobRouteParams {
  id: string;
}

const jobs =
  new Map<
    string,
    ConversionJob
  >();

/*
|--------------------------------------------------------------------------
| Utility functions
|--------------------------------------------------------------------------
*/

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

function scheduleJobCleanup(
  jobId: string,
  delay =
    30 * 60 * 1000
) {
  const timer =
    setTimeout(
      () => {
        const job =
          jobs.get(
            jobId
          );

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

  /*
   * Do not keep Node alive
   * just because cleanup is scheduled.
   */
  timer.unref();
}

/*
|--------------------------------------------------------------------------
| Basic Routes
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  (
    _req: Request,
    res: Response
  ) => {
    res.json({
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
    res.json({
      success:
        true,

      message:
        "ClipForge API is healthy",
    });
  }
);

/*
|--------------------------------------------------------------------------
| Create Conversion Job
|--------------------------------------------------------------------------
|
| POST /api/jobs
|
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
      res
        .status(400)
        .json({
          success:
            false,

          message:
            "No media file was uploaded.",
        });

      return;
    }

    /*
     * Validate output format.
     */

    const format =
      req.body
        .format as OutputFormat;

    if (
      format !==
        "mp3" &&
      format !==
        "mp4"
    ) {
      removeFile(
        req.file.path
      );

      res
        .status(400)
        .json({
          success:
            false,

          message:
            "Invalid output format.",
        });

      return;
    }

    /*
     * Supported MP3 bitrates.
     */

    const allowedBitrates:
      AudioBitrate[] = [
        "128k",
        "192k",
        "256k",
        "320k",
      ];

    /*
     * Supported MP4 qualities.
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

    /*
     * Validate MP3 bitrate.
     */

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

    /*
     * Validate video quality.
     */

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
     * Generate job ID.
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

    /*
     * Create job record.
     */

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
      "----------------------------------------"
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
     * IMPORTANT:
     *
     * Respond immediately.
     *
     * Browser now receives
     * the job ID while FFmpeg
     * continues processing.
     */

    res
      .status(202)
      .json({
        success:
          true,

        jobId,
      });

    /*
     * Start FFmpeg conversion.
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

          if (!currentJob) {
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

          if (!currentJob) {
            return;
          }

          currentJob.status =
            "completed";

          currentJob.progress =
            100;

          /*
           * Uploaded source is
           * no longer required.
           */

          removeFile(
            currentJob.inputPath
          );

          console.log(
            `Job completed: ${jobId}`
          );

          /*
           * If the user never
           * downloads the output,
           * automatically clean it.
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

          if (!currentJob) {
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
           * Keep failed status
           * temporarily so the
           * frontend can read it.
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
|--------------------------------------------------------------------------
| Get Job Status
|--------------------------------------------------------------------------
|
| GET /api/jobs/:id
|
*/

app.get(
  "/api/jobs/:id",

  (
    req:
      Request<JobRouteParams>,

    res:
      Response
  ) => {
    /*
     * Because JobRouteParams explicitly
     * defines id as string, this no longer
     * produces the req.params.id error.
     */

    const jobId =
      req.params.id;

    const job =
      jobs.get(
        jobId
      );

    if (!job) {
      res
        .status(404)
        .json({
          success:
            false,

          message:
            "Conversion job not found.",
        });

      return;
    }

    res.json({
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
|--------------------------------------------------------------------------
| Download Completed Job
|--------------------------------------------------------------------------
|
| GET /api/jobs/:id/download
|
*/

app.get(
  "/api/jobs/:id/download",

  (
    req:
      Request<JobRouteParams>,

    res:
      Response
  ) => {
    const jobId =
      req.params.id;

    const job =
      jobs.get(
        jobId
      );

    if (!job) {
      res
        .status(404)
        .json({
          success:
            false,

          message:
            "Conversion job not found.",
        });

      return;
    }

    /*
     * Job failed.
     */

    if (
      job.status ===
      "failed"
    ) {
      res
        .status(409)
        .json({
          success:
            false,

          message:
            job.error ??
            "Conversion failed.",
        });

      return;
    }

    /*
     * Job still processing.
     */

    if (
      job.status !==
      "completed"
    ) {
      res
        .status(409)
        .json({
          success:
            false,

          message:
            "Conversion is not complete yet.",
        });

      return;
    }

    /*
     * Make sure output still exists.
     */

    if (
      !fs.existsSync(
        job.outputPath
      )
    ) {
      jobs.delete(
        job.id
      );

      res
        .status(404)
        .json({
          success:
            false,

          message:
            "Converted file is no longer available.",
        });

      return;
    }

    console.log(
      `Starting download: ${job.id}`
    );

    res.download(
      job.outputPath,
      job.downloadName,

      (error) => {
        if (error) {
          console.error(
            `Download error for ${job.id}:`,
            error
          );

          return;
        }

        console.log(
          `Download completed: ${job.id}`
        );

        /*
         * Output file is temporary.
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
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
|
| Must remain AFTER the routes.
|
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
        res
          .status(413)
          .json({
            success:
              false,

            message:
              "File is too large. Maximum upload size is 500 MB.",
          });

        return;
      }

      res
        .status(400)
        .json({
          success:
            false,

          message:
            error.message,
        });

      return;
    }

    res
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
|--------------------------------------------------------------------------
| Start API
|--------------------------------------------------------------------------
*/

app.listen(
  PORT,
  () => {
    console.log(
      `ClipForge API running at http://localhost:${PORT}`
    );
  }
);
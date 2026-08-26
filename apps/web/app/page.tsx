"use client";

import {
  useRef,
  useState,
} from "react";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

type OutputFormat =
  | "mp3"
  | "mp4";

type VideoQuality =
  | "original"
  | "480"
  | "720"
  | "1080";

type ConversionStage =
  | "idle"
  | "uploading"
  | "processing"
  | "completed"
  | "error";

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
}

interface JobResponse {
  success: boolean;
  jobId: string;
  message?: string;
}

interface JobStatusResponse {
  success: boolean;

  job: {
    id: string;

    status:
      | "processing"
      | "completed"
      | "failed";

    progress: number;

    format:
      | "mp3"
      | "mp4";

    error?: string;
  };
}

/*
|--------------------------------------------------------------------------
| Supported video extensions
|--------------------------------------------------------------------------
*/

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".webm",
  ".avi",
  ".mkv",
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function isVideoFile(
  file: File
) {
  if (
    file.type.startsWith(
      "video/"
    )
  ) {
    return true;
  }

  const lowerName =
    file.name
      .toLowerCase();

  return VIDEO_EXTENSIONS.some(
    (extension) =>
      lowerName.endsWith(
        extension
      )
  );
}

function formatDuration(
  seconds: number
) {
  if (
    !Number.isFinite(
      seconds
    )
  ) {
    return "--:--";
  }

  const hours =
    Math.floor(
      seconds /
        3600
    );

  const minutes =
    Math.floor(
      (
        seconds %
        3600
      ) /
        60
    );

  const remainingSeconds =
    Math.floor(
      seconds %
        60
    );

  if (
    hours > 0
  ) {
    return `${hours}:${minutes
      .toString()
      .padStart(
        2,
        "0"
      )}:${remainingSeconds
      .toString()
      .padStart(
        2,
        "0"
      )}`;
  }

  return `${minutes}:${remainingSeconds
    .toString()
    .padStart(
      2,
      "0"
    )}`;
}

function readVideoMetadata(
  file: File
): Promise<VideoMetadata> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const video =
        document.createElement(
          "video"
        );

      const url =
        URL.createObjectURL(
          file
        );

      video.preload =
        "metadata";

      video.onloadedmetadata =
        () => {
          const metadata = {
            width:
              video.videoWidth,

            height:
              video.videoHeight,

            duration:
              video.duration,
          };

          URL.revokeObjectURL(
            url
          );

          resolve(
            metadata
          );
        };

      video.onerror =
        () => {
          URL.revokeObjectURL(
            url
          );

          reject(
            new Error(
              "Unable to read video metadata."
            )
          );
        };

      video.src = url;
    }
  );
}

function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Upload media with real upload progress
|--------------------------------------------------------------------------
*/

function uploadJob(
  formData: FormData,

  onProgress: (
    percentage: number
  ) => void
): Promise<JobResponse> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const xhr =
        new XMLHttpRequest();

      xhr.open(
        "POST",
        "http://localhost:5000/api/jobs"
      );

      xhr.responseType =
        "json";

      /*
       * Browser upload progress.
       */

      xhr.upload.onprogress =
        (
          event
        ) => {
          if (
            !event.lengthComputable
          ) {
            return;
          }

          const percentage =
            Math.round(
              (
                event.loaded /
                event.total
              ) *
                100
            );

          onProgress(
            percentage
          );
        };

      /*
       * Upload completed and
       * API returned the job ID.
       */

      xhr.onload =
        () => {
          const response =
            xhr.response as
              | JobResponse
              | null;

          if (
            xhr.status >=
              200 &&
            xhr.status <
              300 &&
            response
          ) {
            resolve(
              response
            );

            return;
          }

          reject(
            new Error(
              response
                ?.message ??
                "Upload failed."
            )
          );
        };

      xhr.onerror =
        () => {
          reject(
            new Error(
              "Unable to connect to the ClipForge API."
            )
          );
        };

      xhr.onabort =
        () => {
          reject(
            new Error(
              "Upload was cancelled."
            )
          );
        };

      xhr.send(
        formData
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function Home() {
  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const [
    file,
    setFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    metadata,
    setMetadata,
  ] =
    useState<VideoMetadata | null>(
      null
    );

  const [
    format,
    setFormat,
  ] =
    useState<OutputFormat>(
      "mp3"
    );

  const [
    audioBitrate,
    setAudioBitrate,
  ] =
    useState(
      "192k"
    );

  const [
    videoQuality,
    setVideoQuality,
  ] =
    useState<VideoQuality>(
      "original"
    );

  const [
    converting,
    setConverting,
  ] =
    useState(
      false
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      ""
    );

  const [
    stage,
    setStage,
  ] =
    useState<ConversionStage>(
      "idle"
    );

  const [
    uploadProgress,
    setUploadProgress,
  ] =
    useState(
      0
    );

  const [
    processingProgress,
    setProcessingProgress,
  ] =
    useState(
      0
    );

  /*
  |--------------------------------------------------------------------------
  | Reset conversion state
  |--------------------------------------------------------------------------
  */

  function resetProgress() {
    setStage(
      "idle"
    );

    setUploadProgress(
      0
    );

    setProcessingProgress(
      0
    );
  }

  /*
  |--------------------------------------------------------------------------
  | File selection
  |--------------------------------------------------------------------------
  */

  async function handleFile(
    selected:
      | File
      | null
  ) {
    resetProgress();

    setMetadata(
      null
    );

    setMessage(
      ""
    );

    setVideoQuality(
      "original"
    );

    if (!selected) {
      setFile(
        null
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }

      return;
    }

    /*
     * Frontend size check.
     */

    const maximumSize =
      500 *
      1024 *
      1024;

    if (
      selected.size >
      maximumSize
    ) {
      setFile(
        null
      );

      setStage(
        "error"
      );

      setMessage(
        "File is too large. Maximum upload size is 500 MB."
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }

      return;
    }

    setFile(
      selected
    );

    /*
     * Browser metadata preview
     * for video files.
     */

    if (
      isVideoFile(
        selected
      )
    ) {
      try {
        const result =
          await readVideoMetadata(
            selected
          );

        setMetadata(
          result
        );
      } catch (
        error
      ) {
        /*
         * This isn't fatal.
         *
         * FFprobe on the backend
         * can still inspect the file.
         */

        console.error(
          error
        );
      }

      return;
    }

    /*
     * Audio-only files cannot
     * be converted to MP4 yet.
     */

    setFormat(
      "mp3"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Available quality choices
  |--------------------------------------------------------------------------
  */

  const availableVideoQualities =
    [
      {
        value:
          "original" as VideoQuality,

        label:
          "Original resolution",
      },

      {
        value:
          "480" as VideoQuality,

        height:
          480,

        label:
          "480p",
      },

      {
        value:
          "720" as VideoQuality,

        height:
          720,

        label:
          "720p HD",
      },

      {
        value:
          "1080" as VideoQuality,

        height:
          1080,

        label:
          "1080p Full HD",
      },
    ].filter(
      (
        quality
      ) => {
        if (
          quality.value ===
          "original"
        ) {
          return true;
        }

        if (
          !metadata ||
          !quality.height
        ) {
          return true;
        }

        /*
         * Only offer a resolution
         * lower than the source.
         */

        return (
          quality.height <
          metadata.height
        );
      }
    );

  /*
  |--------------------------------------------------------------------------
  | Convert
  |--------------------------------------------------------------------------
  */

  async function handleConvert() {
    if (!file) {
      setMessage(
        "Please select a media file."
      );

      return;
    }

    try {
      setConverting(
        true
      );

      setStage(
        "uploading"
      );

      setUploadProgress(
        0
      );

      setProcessingProgress(
        0
      );

      setMessage(
        "Uploading media..."
      );

      /*
       * Build multipart request.
       */

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "format",
        format
      );

      if (
        format ===
        "mp3"
      ) {
        formData.append(
          "audioBitrate",
          audioBitrate
        );
      }

      if (
        format ===
        "mp4"
      ) {
        formData.append(
          "videoQuality",
          videoQuality
        );
      }

      /*
       * Stage 1:
       * Upload.
       */

      const uploadResult =
        await uploadJob(
          formData,

          (
            progress
          ) => {
            setUploadProgress(
              progress
            );
          }
        );

      setUploadProgress(
        100
      );

      /*
       * Stage 2:
       * FFmpeg processing.
       */

      setStage(
        "processing"
      );

      setMessage(
        "Processing media..."
      );

      let completed =
        false;

      while (
        !completed
      ) {
        const response =
          await fetch(
            `http://localhost:5000/api/jobs/${uploadResult.jobId}`,
            {
              cache:
                "no-store",
            }
          );

        if (
          !response.ok
        ) {
          const errorResponse =
            await response
              .json()
              .catch(
                () =>
                  null
              );

          throw new Error(
            errorResponse
              ?.message ??
              "Unable to retrieve conversion status."
          );
        }

        const result =
          await response.json() as
            JobStatusResponse;

        setProcessingProgress(
          result.job
            .progress
        );

        if (
          result.job
            .status ===
          "completed"
        ) {
          completed =
            true;

          break;
        }

        if (
          result.job
            .status ===
          "failed"
        ) {
          throw new Error(
            result.job
              .error ??
              "Conversion failed."
          );
        }

        await sleep(
          500
        );
      }

      /*
       * Stage 3:
       * Complete.
       */

      setProcessingProgress(
        100
      );

      setStage(
        "completed"
      );

      setMessage(
        "Conversion complete. Your download is starting..."
      );

      /*
       * Download finished media.
       *
       * Content-Disposition from
       * Express provides the
       * original output filename.
       */

      const downloadLink =
        document.createElement(
          "a"
        );

      downloadLink.href =
        `http://localhost:5000/api/jobs/${uploadResult.jobId}/download`;

      downloadLink.style.display =
        "none";

      document.body.appendChild(
        downloadLink
      );

      downloadLink.click();

      downloadLink.remove();
    } catch (
      error
    ) {
      console.error(
        error
      );

      setStage(
        "error"
      );

      setMessage(
        error instanceof
          Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setConverting(
        false
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <main className="min-h-screen bg-zinc-950 text-white">

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">

        {/* Header */}

        <div className="mb-10 text-center">

          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Media Converter
          </p>

          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            ClipForge
          </h1>

          <p className="mt-4 text-lg text-zinc-400">
            Convert your media.
            Fast, clean and simple.
          </p>

        </div>

        {/* Converter */}

        <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">

          {/* File upload */}

          <div className="rounded-2xl border-2 border-dashed border-zinc-700 p-10 text-center transition hover:border-zinc-500">

            <input
              ref={
                fileInputRef
              }

              id="file"

              type="file"

              accept="video/*,audio/*"

              className="hidden"

              disabled={
                converting
              }

              onChange={(
                event
              ) => {
                void handleFile(
                  event.target
                    .files?.[0] ??
                    null
                );
              }}
            />

            <label
              htmlFor="file"

              className={
                converting
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }
            >

              <div className="text-5xl">
                🎬
              </div>

              <p className="mt-4 text-lg font-medium">
                Choose a media file
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Video or audio,
                up to 500 MB
              </p>

            </label>

          </div>

          {/* Selected file */}

          {file && (
            <div className="mt-6 rounded-xl bg-zinc-800 p-5">

              <div className="flex items-center justify-between gap-4">

                <div className="min-w-0">

                  <p className="truncate font-medium">
                    {file.name}
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    {(
                      file.size /
                      1024 /
                      1024
                    ).toFixed(
                      2
                    )}{" "}
                    MB
                  </p>

                </div>

                <button
                  type="button"

                  disabled={
                    converting
                  }

                  onClick={() => {
                    void handleFile(
                      null
                    );
                  }}

                  className="shrink-0 text-sm text-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>

              </div>

              {/* Video metadata */}

              {metadata && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-700 pt-4">

                  <div>

                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Resolution
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {
                        metadata.width
                      }
                      ×
                      {
                        metadata.height
                      }
                    </p>

                  </div>

                  <div>

                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Duration
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {formatDuration(
                        metadata.duration
                      )}
                    </p>

                  </div>

                </div>
              )}

            </div>
          )}

          {/* Format */}

          <div className="mt-6">

            <label className="mb-2 block text-sm font-medium text-zinc-400">
              Output format
            </label>

            <select
              value={
                format
              }

              disabled={
                converting
              }

              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value as OutputFormat;

                setFormat(
                  value
                );

                setVideoQuality(
                  "original"
                );

                resetProgress();

                setMessage(
                  ""
                );
              }}

              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-zinc-500 disabled:opacity-50"
            >

              <option value="mp3">
                MP3 — Audio
              </option>

              <option
                value="mp4"

                disabled={
                  !!file &&
                  !isVideoFile(
                    file
                  )
                }
              >
                MP4 — Video
              </option>

            </select>

          </div>

          {/* MP3 quality */}

          {format ===
            "mp3" && (
            <div className="mt-5">

              <label className="mb-2 block text-sm font-medium text-zinc-400">
                Audio quality
              </label>

              <select
                value={
                  audioBitrate
                }

                disabled={
                  converting
                }

                onChange={(
                  event
                ) => {
                  setAudioBitrate(
                    event.target
                      .value
                  );

                  resetProgress();
                }}

                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-zinc-500 disabled:opacity-50"
              >

                <option value="128k">
                  128 kbps — Standard
                </option>

                <option value="192k">
                  192 kbps — Good
                </option>

                <option value="256k">
                  256 kbps — High
                </option>

                <option value="320k">
                  320 kbps — Best
                </option>

              </select>

            </div>
          )}

          {/* MP4 quality */}

          {format ===
            "mp4" && (
            <div className="mt-5">

              <label className="mb-2 block text-sm font-medium text-zinc-400">
                Video quality
              </label>

              <select
                value={
                  videoQuality
                }

                disabled={
                  converting
                }

                onChange={(
                  event
                ) => {
                  setVideoQuality(
                    event.target
                      .value as VideoQuality
                  );

                  resetProgress();
                }}

                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-zinc-500 disabled:opacity-50"
              >

                {availableVideoQualities.map(
                  (
                    quality
                  ) => (
                    <option
                      key={
                        quality.value
                      }

                      value={
                        quality.value
                      }
                    >
                      {
                        quality.label
                      }
                    </option>
                  )
                )}

              </select>

              {metadata && (
                <p className="mt-2 text-xs text-zinc-500">
                  Only resolutions
                  below the source
                  are offered to
                  prevent unnecessary
                  upscaling.
                </p>
              )}

            </div>
          )}

          {/* Progress */}

          {stage !==
            "idle" && (
            <div className="mt-7 space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">

              {/* Upload progress */}

              <div>

                <div className="mb-2 flex items-center justify-between text-sm">

                  <span className="text-zinc-400">
                    Uploading
                  </span>

                  <span className="font-medium">
                    {
                      uploadProgress
                    }
                    %
                  </span>

                </div>

                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">

                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"

                    style={{
                      width:
                        `${uploadProgress}%`,
                    }}
                  />

                </div>

              </div>

              {/* Processing progress */}

              <div>

                <div className="mb-2 flex items-center justify-between text-sm">

                  <span className="text-zinc-400">
                    Processing
                  </span>

                  <span className="font-medium">
                    {
                      processingProgress
                    }
                    %
                  </span>

                </div>

                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">

                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"

                    style={{
                      width:
                        `${processingProgress}%`,
                    }}
                  />

                </div>

              </div>

              {/* Status */}

              {stage ===
                "completed" && (
                <p className="text-center text-sm font-medium">
                  ✓ Conversion complete
                </p>
              )}

              {stage ===
                "error" && (
                <p className="text-center text-sm font-medium text-red-400">
                  Conversion failed
                </p>
              )}

            </div>
          )}

          {/* Convert button */}

          <button
            type="button"

            onClick={
              handleConvert
            }

            disabled={
              !file ||
              converting
            }

            className="mt-7 w-full rounded-xl bg-white px-5 py-4 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >

            {stage ===
              "uploading"
              ? `Uploading ${uploadProgress}%`

              : stage ===
                  "processing"
                ? `Processing ${processingProgress}%`

                : `Convert to ${format.toUpperCase()}`}

          </button>

          {/* Message */}

          {message && (
            <p
              className={
                stage ===
                "error"
                  ? "mt-5 text-center text-sm text-red-400"
                  : "mt-5 text-center text-sm text-zinc-400"
              }
            >
              {message}
            </p>
          )}

        </div>

        {/* Footer */}

        <p className="mt-8 text-center text-sm text-zinc-600">
          Files are processed
          temporarily and removed
          after conversion.
        </p>

      </div>

    </main>
  );
}
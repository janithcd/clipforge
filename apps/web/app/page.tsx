"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";

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

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".webm",
  ".avi",
  ".mkv",
];

const AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
];

const MAX_FILE_SIZE =
  500 * 1024 * 1024;

function hasExtension(
  file: File,
  extensions: string[]
) {
  const name =
    file.name.toLowerCase();

  return extensions.some(
    (extension) =>
      name.endsWith(
        extension
      )
  );
}

function isVideoFile(
  file: File
) {
  return (
    file.type.startsWith(
      "video/"
    ) ||
    hasExtension(
      file,
      VIDEO_EXTENSIONS
    )
  );
}

function isAudioFile(
  file: File
) {
  return (
    file.type.startsWith(
      "audio/"
    ) ||
    hasExtension(
      file,
      AUDIO_EXTENSIONS
    )
  );
}

function isSupportedMedia(
  file: File
) {
  return (
    isVideoFile(file) ||
    isAudioFile(file)
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
      seconds / 3600
    );

  const minutes =
    Math.floor(
      (
        seconds % 3600
      ) / 60
    );

  const remainingSeconds =
    Math.floor(
      seconds % 60
    );

  if (hours > 0) {
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

function formatFileSize(
  bytes: number
) {
  const megabytes =
    bytes /
    1024 /
    1024;

  return `${megabytes.toFixed(
    2
  )} MB`;
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

      xhr.onload =
        () => {
          const response =
            xhr.response as
              | JobResponse
              | null;

          if (
            xhr.status >= 200 &&
            xhr.status < 300 &&
            response
          ) {
            resolve(
              response
            );

            return;
          }

          reject(
            new Error(
              response?.message ??
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

export default function Home() {
  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const previewUrlRef =
    useRef<string | null>(
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
    previewUrl,
    setPreviewUrl,
  ] =
    useState<string | null>(
      null
    );

  const [
    previewError,
    setPreviewError,
  ] =
    useState(false);

  const [
    dragging,
    setDragging,
  ] =
    useState(false);

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
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

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
    useState(0);

  const [
    processingProgress,
    setProcessingProgress,
  ] =
    useState(0);

  useEffect(
    () => {
      return () => {
        if (
          previewUrlRef.current
        ) {
          URL.revokeObjectURL(
            previewUrlRef.current
          );
        }
      };
    },
    []
  );

  function clearPreview() {
    if (
      previewUrlRef.current
    ) {
      URL.revokeObjectURL(
        previewUrlRef.current
      );

      previewUrlRef.current =
        null;
    }

    setPreviewUrl(
      null
    );

    setPreviewError(
      false
    );
  }

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

  async function handleFile(
    selected:
      | File
      | null
  ) {
    resetProgress();

    clearPreview();

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

    if (
      !isSupportedMedia(
        selected
      )
    ) {
      setFile(
        null
      );

      setStage(
        "error"
      );

      setMessage(
        "Unsupported file. Please choose a video or audio file."
      );

      return;
    }

    if (
      selected.size >
      MAX_FILE_SIZE
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

      return;
    }

    setFile(
      selected
    );

    const url =
      URL.createObjectURL(
        selected
      );

    previewUrlRef.current =
      url;

    setPreviewUrl(
      url
    );

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
        console.error(
          error
        );
      }

      return;
    }

    /*
     * Audio-only media currently
     * supports MP3 output.
     */

    setFormat(
      "mp3"
    );
  }

  function handleDragOver(
    event:
      DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (
      converting
    ) {
      return;
    }

    setDragging(
      true
    );
  }

  function handleDragLeave(
    event:
      DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    setDragging(
      false
    );
  }

  function handleDrop(
    event:
      DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    setDragging(
      false
    );

    if (
      converting
    ) {
      return;
    }

    const droppedFile =
      event.dataTransfer
        .files?.[0];

    if (
      droppedFile
    ) {
      void handleFile(
        droppedFile
      );
    }
  }

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

        return (
          quality.height <
          metadata.height
        );
      }
    );

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

      setProcessingProgress(
        100
      );

      setStage(
        "completed"
      );

      setMessage(
        "Conversion complete. Your download is starting..."
      );

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

        <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">

          {/* Drag and drop */}

          <div
            onDragEnter={
              handleDragOver
            }

            onDragOver={
              handleDragOver
            }

            onDragLeave={
              handleDragLeave
            }

            onDrop={
              handleDrop
            }

            className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
              dragging
                ? "border-white bg-zinc-800"
                : "border-zinc-700 hover:border-zinc-500"
            } ${
              converting
                ? "cursor-not-allowed opacity-50"
                : ""
            }`}
          >

            <input
              ref={
                fileInputRef
              }

              id="file"

              type="file"

              accept="video/*,audio/*,.mkv,.m4a"

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

            <div className="text-5xl">
              {dragging
                ? "📥"
                : "🎬"}
            </div>

            <p className="mt-4 text-lg font-medium">
              {dragging
                ? "Drop your file here"
                : "Drag & drop your media"}
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              or
            </p>

            <label
              htmlFor="file"

              className={`mt-4 inline-block rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium transition ${
                converting
                  ? "cursor-not-allowed"
                  : "cursor-pointer hover:border-zinc-500 hover:bg-zinc-800"
              }`}
            >
              Browse Files
            </label>

            <p className="mt-4 text-xs text-zinc-600">
              MP4, MOV, WebM,
              AVI, MKV, MP3,
              WAV, M4A, AAC and OGG
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              Maximum file size:
              500 MB
            </p>

          </div>

          {/* Selected media */}

          {file && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">

              {/* Preview */}

              {previewUrl && (
                <div className="bg-black">

                  {isVideoFile(
                    file
                  ) ? (
                    <video
                      key={
                        previewUrl
                      }

                      src={
                        previewUrl
                      }

                      controls

                      preload="metadata"

                      onError={() => {
                        setPreviewError(
                          true
                        );
                      }}

                      className="max-h-80 w-full object-contain"
                    />
                  ) : (
                    <div className="p-8">

                      <div className="mb-5 text-center text-5xl">
                        🎵
                      </div>

                      <audio
                        key={
                          previewUrl
                        }

                        src={
                          previewUrl
                        }

                        controls

                        preload="metadata"

                        onError={() => {
                          setPreviewError(
                            true
                          );
                        }}

                        className="w-full"
                      />

                    </div>
                  )}

                </div>
              )}

              {previewError && (
                <div className="border-b border-zinc-800 p-4 text-center text-sm text-zinc-500">
                  Your browser cannot preview this codec,
                  but ClipForge may still be able to convert it.
                </div>
              )}

              {/* File information */}

              <div className="p-5">

                <div className="flex items-start justify-between gap-4">

                  <div className="min-w-0">

                    <p className="truncate font-medium">
                      {file.name}
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      {formatFileSize(
                        file.size
                      )}
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

                {metadata && (
                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-800 pt-5 sm:grid-cols-3">

                    <div>

                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Resolution
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        {metadata.width}
                        ×
                        {metadata.height}
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

                    <div>

                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Type
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        Video
                      </p>

                    </div>

                  </div>
                )}

              </div>

            </div>
          )}

          {/* Output format */}

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

          {/* Audio quality */}

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

          {/* Video quality */}

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
                  Only resolutions below
                  the source are offered
                  to prevent unnecessary
                  upscaling.
                </p>
              )}

            </div>
          )}

          {/* Progress */}

          {stage !==
            "idle" && (
            <div className="mt-7 space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">

              <div>

                <div className="mb-2 flex items-center justify-between text-sm">

                  <span className="text-zinc-400">
                    Uploading
                  </span>

                  <span className="font-medium">
                    {uploadProgress}%
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

              {stage ===
                "completed" && (
                <div className="text-center">

                  <p className="text-sm font-medium">
                    ✓ Conversion complete
                  </p>

                  <button
                    type="button"

                    onClick={() => {
                      void handleFile(
                        null
                      );
                    }}

                    className="mt-3 text-sm text-zinc-400 underline underline-offset-4 hover:text-white"
                  >
                    Convert another file
                  </button>

                </div>
              )}

              {stage ===
                "error" && (
                <p className="text-center text-sm font-medium text-red-400">
                  Conversion failed
                </p>
              )}

            </div>
          )}

          {/* Convert */}

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

        <p className="mt-8 text-center text-sm text-zinc-600">
          Files are processed temporarily
          and removed after conversion.
        </p>

      </div>

    </main>
  );
}
"use client";

import {
  useState,
} from "react";

type OutputFormat =
  | "mp3"
  | "mp4";

type VideoQuality =
  | "original"
  | "480"
  | "720"
  | "1080";

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
}

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".webm",
  ".avi",
  ".mkv",
];

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
    file.name.toLowerCase();

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

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remainingSeconds =
    Math.floor(
      seconds % 60
    );

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
    (resolve, reject) => {
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

export default function Home() {
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
    useState("192k");

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

  async function handleFile(
    selected:
      | File
      | null
  ) {
    setFile(
      selected
    );

    setMetadata(
      null
    );

    setMessage("");

    setVideoQuality(
      "original"
    );

    if (!selected) {
      return;
    }

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
    } else {
      setFormat(
        "mp3"
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

        height: 480,

        label:
          "480p",
      },

      {
        value:
          "720" as VideoQuality,

        height: 720,

        label:
          "720p HD",
      },

      {
        value:
          "1080" as VideoQuality,

        height: 1080,

        label:
          "1080p Full HD",
      },
    ].filter(
      (quality) => {
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

      setMessage(
        "Uploading and converting..."
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
        format === "mp3"
      ) {
        formData.append(
          "audioBitrate",
          audioBitrate
        );
      }

      if (
        format === "mp4"
      ) {
        formData.append(
          "videoQuality",
          videoQuality
        );
      }

      const response =
        await fetch(
          "http://localhost:5000/api/convert",
          {
            method:
              "POST",

            body:
              formData,
          }
        );

      if (
        !response.ok
      ) {
        const error =
          await response
            .json()
            .catch(
              () =>
                null
            );

        throw new Error(
          error?.message ??
            "Conversion failed."
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      const originalName =
        file.name.replace(
          /\.[^/.]+$/,
          ""
        );

      link.href = url;

      link.download =
        `${originalName}.${format}`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url
      );

      setMessage(
        "Conversion completed successfully!"
      );
    } catch (
      error
    ) {
      console.error(
        error
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

        <div className="mb-10 text-center">

          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Media Converter
          </p>

          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            ClipForge
          </h1>

          <p className="mt-4 text-lg text-zinc-400">
            Convert your
            media. Fast,
            clean and simple.
          </p>

        </div>

        <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">

          <div className="rounded-2xl border-2 border-dashed border-zinc-700 p-10 text-center transition hover:border-zinc-500">

            <input
              id="file"
              type="file"
              accept="video/*,audio/*"
              className="hidden"

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
              className="cursor-pointer"
            >

              <div className="text-5xl">
                🎬
              </div>

              <p className="mt-4 text-lg font-medium">
                Choose a media
                file
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Video or audio,
                up to 500 MB
              </p>

            </label>

          </div>

          {file && (
            <div className="mt-6 rounded-xl bg-zinc-800 p-5">

              <div className="flex items-center justify-between">

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
                  onClick={() =>
                    void handleFile(
                      null
                    )
                  }
                  className="ml-4 text-sm text-zinc-400 hover:text-white"
                >
                  Remove
                </button>

              </div>

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

          <div className="mt-6">

            <label className="mb-2 block text-sm font-medium text-zinc-400">
              Output format
            </label>

            <select
              value={format}

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
              }}

              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-zinc-500"
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

                onChange={(
                  event
                ) =>
                  setAudioBitrate(
                    event.target
                      .value
                  )
                }

                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-zinc-500"
              >

                <option value="128k">
                  128 kbps —
                  Standard
                </option>

                <option value="192k">
                  192 kbps —
                  Good
                </option>

                <option value="256k">
                  256 kbps —
                  High
                </option>

                <option value="320k">
                  320 kbps —
                  Best
                </option>

              </select>

            </div>
          )}

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

                onChange={(
                  event
                ) =>
                  setVideoQuality(
                    event.target
                      .value as VideoQuality
                  )
                }

                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-zinc-500"
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
                  ClipForge only
                  offers resolutions
                  below the source
                  resolution to avoid
                  unnecessary
                  upscaling.
                </p>
              )}

            </div>
          )}

          <button
            onClick={
              handleConvert
            }

            disabled={
              !file ||
              converting
            }

            className="mt-7 w-full rounded-xl bg-white px-5 py-4 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >

            {converting
              ? "Converting..."
              : `Convert to ${format.toUpperCase()}`}

          </button>

          {message && (
            <p className="mt-5 text-center text-sm text-zinc-400">
              {message}
            </p>
          )}

        </div>

        <p className="mt-8 text-center text-sm text-zinc-600">
          Files are processed
          temporarily and
          removed after
          conversion.
        </p>

      </div>

    </main>
  );
}
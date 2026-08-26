import { spawn } from "node:child_process";

export type OutputFormat =
  | "mp3"
  | "mp4";

export type AudioBitrate =
  | "128k"
  | "192k"
  | "256k"
  | "320k";

export type VideoQuality =
  | "original"
  | "480"
  | "720"
  | "1080";

interface ConversionOptions {
  format: OutputFormat;
  audioBitrate?: AudioBitrate;
  videoQuality?: VideoQuality;

  onProgress?: (
    progress: number
  ) => void;
}

export interface MediaProbe {
  width?: number;
  height?: number;
  duration?: number;
  videoCodec?: string;
  audioCodec?: string;
  fps?: number;
}

interface FFprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  avg_frame_rate?: string;
}

interface FFprobeOutput {
  streams?: FFprobeStream[];

  format?: {
    duration?: string;
  };
}

function parseFrameRate(
  value?: string
): number | undefined {
  if (!value) {
    return undefined;
  }

  if (value.includes("/")) {
    const [numerator, denominator] =
      value.split("/").map(Number);

    if (
      denominator &&
      !Number.isNaN(numerator)
    ) {
      return (
        numerator /
        denominator
      );
    }
  }

  const parsed =
    Number(value);

  return Number.isNaN(parsed)
    ? undefined
    : parsed;
}

export function probeMedia(
  inputPath: string
): Promise<MediaProbe> {
  return new Promise(
    (resolve, reject) => {
      const ffprobe =
        spawn("ffprobe", [
          "-v",
          "error",

          "-print_format",
          "json",

          "-show_format",
          "-show_streams",

          inputPath,
        ]);

      let output = "";
      let errorOutput = "";

      ffprobe.stdout.on(
        "data",
        (data) => {
          output +=
            data.toString();
        }
      );

      ffprobe.stderr.on(
        "data",
        (data) => {
          errorOutput +=
            data.toString();
        }
      );

      ffprobe.on(
        "error",
        (error) => {
          reject(error);
        }
      );

      ffprobe.on(
        "close",
        (code) => {
          if (code !== 0) {
            reject(
              new Error(
                `FFprobe exited with code ${code}\n${errorOutput}`
              )
            );

            return;
          }

          try {
            const data =
              JSON.parse(
                output
              ) as FFprobeOutput;

            const video =
              data.streams?.find(
                (stream) =>
                  stream.codec_type ===
                  "video"
              );

            const audio =
              data.streams?.find(
                (stream) =>
                  stream.codec_type ===
                  "audio"
              );

            const durationValue =
              data.format?.duration ??
              video?.duration ??
              audio?.duration;

            const duration =
              durationValue
                ? Number(
                    durationValue
                  )
                : undefined;

            resolve({
              width:
                video?.width,

              height:
                video?.height,

              duration:
                duration &&
                !Number.isNaN(
                  duration
                )
                  ? duration
                  : undefined,

              videoCodec:
                video?.codec_name,

              audioCodec:
                audio?.codec_name,

              fps:
                parseFrameRate(
                  video?.avg_frame_rate
                ),
            });
          } catch {
            reject(
              new Error(
                "Unable to parse FFprobe output."
              )
            );
          }
        }
      );
    }
  );
}

export async function convertMedia(
  inputPath: string,
  outputPath: string,
  options: ConversionOptions
): Promise<void> {
  const metadata =
    await probeMedia(
      inputPath
    );

  console.log(
    "Source metadata:",
    metadata
  );

  return new Promise(
    (resolve, reject) => {
      const args: string[] =
        [
          "-y",
          "-hide_banner",
          "-i",
          inputPath,
        ];

      if (
        options.format ===
        "mp3"
      ) {
        if (
          !metadata.audioCodec
        ) {
          reject(
            new Error(
              "The uploaded media does not contain an audio stream."
            )
          );

          return;
        }

        args.push(
          "-vn",
          "-codec:a",
          "libmp3lame",
          "-b:a",
          options.audioBitrate ??
            "192k"
        );
      }

      if (
        options.format ===
        "mp4"
      ) {
        if (
          !metadata.width ||
          !metadata.height
        ) {
          reject(
            new Error(
              "The uploaded file does not contain a video stream."
            )
          );

          return;
        }

        const requestedQuality =
          options.videoQuality ??
          "original";

        if (
          requestedQuality !==
          "original"
        ) {
          const targetHeight =
            Number(
              requestedQuality
            );

          if (
            targetHeight <
            metadata.height
          ) {
            console.log(
              `Scaling from ${metadata.width}x${metadata.height} to approximately ${targetHeight}p`
            );

            args.push(
              "-vf",
              `scale=-2:${targetHeight}`
            );
          } else {
            console.log(
              `Skipping ${targetHeight}p scaling. Source is ${metadata.height}px high and upscaling is disabled.`
            );
          }
        } else {
          console.log(
            "Keeping original video resolution."
          );
        }

        args.push(
          "-c:v",
          "libx264",

          "-preset",
          "medium",

          "-crf",
          "23",

          "-c:a",
          "aac",

          "-b:a",
          "192k",

          "-movflags",
          "+faststart"
        );
      }

      /*
       * Ask FFmpeg to emit
       * machine-readable progress.
       */
      args.push(
        "-progress",
        "pipe:1",
        "-nostats"
      );

      args.push(
        outputPath
      );

      console.log(
        "FFmpeg command:"
      );

      console.log(
        `ffmpeg ${args.join(
          " "
        )}`
      );

      const ffmpeg =
        spawn(
          "ffmpeg",
          args
        );

      let errorOutput =
        "";

      let progressBuffer =
        "";

      /*
       * FFmpeg progress output
       * comes through stdout.
       */
      ffmpeg.stdout.on(
        "data",
        (data) => {
          progressBuffer +=
            data.toString();

          const lines =
            progressBuffer.split(
              /\r?\n/
            );

          progressBuffer =
            lines.pop() ?? "";

          for (
            const line
            of lines
          ) {
            const separator =
              line.indexOf(
                "="
              );

            if (
              separator === -1
            ) {
              continue;
            }

            const key =
              line.slice(
                0,
                separator
              );

            const value =
              line.slice(
                separator + 1
              );

            if (
              key ===
                "out_time_us" &&
              metadata.duration
            ) {
              const microseconds =
                Number(
                  value
                );

              if (
                !Number.isNaN(
                  microseconds
                )
              ) {
                const seconds =
                  microseconds /
                  1_000_000;

                const percentage =
                  Math.min(
                    99,
                    Math.max(
                      0,
                      Math.round(
                        (
                          seconds /
                          metadata.duration
                        ) *
                          100
                      )
                    )
                  );

                options
                  .onProgress?.(
                    percentage
                  );
              }
            }

            if (
              key ===
                "progress" &&
              value === "end"
            ) {
              options
                .onProgress?.(
                  100
                );
            }
          }
        }
      );

      /*
       * Normal FFmpeg logs
       * still arrive here.
       */
      ffmpeg.stderr.on(
        "data",
        (data) => {
          const output =
            data.toString();

          errorOutput +=
            output;

          console.log(
            output
          );
        }
      );

      ffmpeg.on(
        "error",
        (error) => {
          reject(error);
        }
      );

      ffmpeg.on(
        "close",
        (code) => {
          if (
            code === 0
          ) {
            options
              .onProgress?.(
                100
              );

            resolve();

            return;
          }

          reject(
            new Error(
              `FFmpeg exited with code ${code}\n${errorOutput}`
            )
          );
        }
      );
    }
  );
}
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
              `Scaling video from ${metadata.width}x${metadata.height} to approximately ${targetHeight}p`
            );

            args.push(
              "-vf",
              `scale=-2:${targetHeight}`
            );
          } else {
            console.log(
              `Skipping ${targetHeight}p scaling because source height is only ${metadata.height}px. Upscaling is disabled.`
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
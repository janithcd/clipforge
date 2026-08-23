import { spawn } from "node:child_process";

export type OutputFormat = "mp3" | "mp4";

export type AudioBitrate =
  | "128k"
  | "192k"
  | "256k"
  | "320k";

export type VideoQuality =
  | "480"
  | "720"
  | "1080";

interface ConversionOptions {
  format: OutputFormat;
  audioBitrate?: AudioBitrate;
  videoQuality?: VideoQuality;
}

export function convertMedia(
  inputPath: string,
  outputPath: string,
  options: ConversionOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args: string[] = [
      "-y",
      "-hide_banner",
      "-i",
      inputPath,
    ];

    if (options.format === "mp3") {
      args.push(
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        options.audioBitrate ?? "192k"
      );
    }

    if (options.format === "mp4") {
      const height =
        options.videoQuality ?? "720";

      args.push(
        "-vf",
        `scale=-2:${height}`,
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

    args.push(outputPath);

    console.log("FFmpeg command:");
    console.log(`ffmpeg ${args.join(" ")}`);

    const ffmpeg = spawn(
      "ffmpeg",
      args
    );

    let errorOutput = "";

    ffmpeg.stderr.on(
      "data",
      (data) => {
        const output = data.toString();

        errorOutput += output;

        console.log(output);
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
        if (code === 0) {
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
  });
}
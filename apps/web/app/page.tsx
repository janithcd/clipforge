"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleConvert() {
    if (!file) {
      setMessage("Please select a media file.");
      return;
    }

    try {
      setConverting(true);
      setMessage("Converting your file...");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "http://localhost:5000/api/convert/mp3",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Conversion failed");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;

      const originalName = file.name.replace(/\.[^/.]+$/, "");

      link.download = `${originalName}.mp3`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setMessage("Conversion completed successfully!");
    } catch (error) {
      console.error(error);

      setMessage(
        "Something went wrong while converting the file."
      );
    } finally {
      setConverting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6">

        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            ClipForge
          </h1>

          <p className="mt-4 text-lg text-zinc-400">
            Convert your media. Fast, clean and simple.
          </p>
        </div>

        <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">

          <div className="rounded-2xl border-2 border-dashed border-zinc-700 p-10 text-center">

            <input
              id="file"
              type="file"
              accept="video/*,audio/*"
              className="hidden"
              onChange={(event) => {
                const selected =
                  event.target.files?.[0] ?? null;

                setFile(selected);
                setMessage("");
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
                Choose a media file
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                MP4, MOV, WebM, M4A and more
              </p>
            </label>
          </div>

          {file && (
            <div className="mt-6 rounded-xl bg-zinc-800 p-4">
              <p className="font-medium">
                {file.name}
              </p>

              <p className="mt-1 text-sm text-zinc-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          <div className="mt-6">
            <label className="mb-2 block text-sm text-zinc-400">
              Convert to
            </label>

            <select
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none"
              defaultValue="mp3"
            >
              <option value="mp3">
                MP3 — Audio
              </option>
            </select>
          </div>

          <button
            onClick={handleConvert}
            disabled={!file || converting}
            className="mt-6 w-full rounded-xl bg-white px-5 py-4 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {converting
              ? "Converting..."
              : "Convert to MP3"}
          </button>

          {message && (
            <p className="mt-5 text-center text-sm text-zinc-400">
              {message}
            </p>
          )}

        </div>

        <p className="mt-8 text-sm text-zinc-600">
          Your files are processed temporarily and removed
          after conversion.
        </p>

      </div>
    </main>
  );
}
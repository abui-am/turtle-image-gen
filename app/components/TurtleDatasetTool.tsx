"use client";

import Cropper, { type Area, type Point } from "react-easy-crop";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildFilename,
  formatId,
  loadIdCounter,
  loadIdPrefix,
  saveIdCounter,
  saveIdPrefix,
  type FlipVariant,
  type TurtleSide,
} from "@/lib/naming";
import {
  downloadBlob,
  getCroppedImageBlob,
  OUTPUT_SIZE,
  readFileAsDataUrl,
} from "@/lib/image-processing";

type AspectMode = "square" | "free";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export default function TurtleDatasetTool() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectMode, setAspectMode] = useState<AspectMode>("square");
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [side, setSide] = useState<TurtleSide>("left");
  const [includeFlipped, setIncludeFlipped] = useState(true);
  const [idPrefix, setIdPrefix] = useState("turtle");
  const [idCounter, setIdCounter] = useState(1);
  const [customId, setCustomId] = useState("");
  const [useCustomId, setUseCustomId] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [previews, setPreviews] = useState<
    { variant: FlipVariant; url: string; filename: string }[]
  >([]);

  useEffect(() => {
    setIdPrefix(loadIdPrefix());
    const storedCounter = loadIdCounter();
    setIdCounter(storedCounter > 0 ? storedCounter : 1);
  }, []);

  const turtleId = useMemo(() => {
    if (useCustomId && customId.trim()) {
      return customId.trim();
    }
    return formatId(idPrefix, idCounter);
  }, [customId, idCounter, idPrefix, useCustomId]);

  const outputFilenames = useMemo(() => {
    const variants: FlipVariant[] = includeFlipped
      ? ["normal", "flipped"]
      : ["normal"];
    return variants.map((variant) => ({
      variant,
      filename: buildFilename(turtleId, side, variant),
    }));
  }, [includeFlipped, side, turtleId]);

  const loadImageFromFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file.");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setImageSrc(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setPreviews([]);
    setStatus(null);
  }, []);

  const loadImageFromClipboard = useCallback(
    async (clipboardData: DataTransfer | null) => {
      if (!clipboardData) return false;

      const items = Array.from(clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return false;

      const file = imageItem.getAsFile();
      if (!file) return false;

      await loadImageFromFile(file);
      setStatus("Image pasted from clipboard.");
      return true;
    },
    [loadImageFromFile],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      void loadImageFromClipboard(event.clipboardData);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadImageFromClipboard]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const generatePreviews = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) {
      setStatus("Load an image and adjust the crop first.");
      return;
    }

    setIsExporting(true);
    setStatus(null);

    try {
      const nextPreviews: { variant: FlipVariant; url: string; filename: string }[] =
        [];

      for (const { variant, filename } of outputFilenames) {
        const blob = await getCroppedImageBlob(
          imageSrc,
          croppedAreaPixels,
          variant === "flipped",
        );
        nextPreviews.push({
          variant,
          url: URL.createObjectURL(blob),
          filename,
        });
      }

      setPreviews((current) => {
        current.forEach((preview) => URL.revokeObjectURL(preview.url));
        return nextPreviews;
      });
      setStatus("Preview ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preview failed.");
    } finally {
      setIsExporting(false);
    }
  }, [croppedAreaPixels, imageSrc, outputFilenames]);

  const exportImages = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) {
      setStatus("Load an image and adjust the crop first.");
      return;
    }

    setIsExporting(true);
    setStatus(null);

    try {
      for (const { variant, filename } of outputFilenames) {
        const blob = await getCroppedImageBlob(
          imageSrc,
          croppedAreaPixels,
          variant === "flipped",
        );
        downloadBlob(blob, filename);
      }

      if (!useCustomId) {
        const nextCounter = idCounter + 1;
        setIdCounter(nextCounter);
        saveIdCounter(nextCounter);
      }

      setStatus(
        includeFlipped
          ? `Exported ${outputFilenames.length} images (${OUTPUT_SIZE}×${OUTPUT_SIZE}).`
          : `Exported ${outputFilenames[0].filename} (${OUTPUT_SIZE}×${OUTPUT_SIZE}).`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }, [
    croppedAreaPixels,
    idCounter,
    imageSrc,
    includeFlipped,
    outputFilenames,
    useCustomId,
  ]);

  const bumpId = () => {
    const nextCounter = idCounter + 1;
    setIdCounter(nextCounter);
    saveIdCounter(nextCounter);
  };

  const resetId = () => {
    setIdCounter(1);
    saveIdCounter(1);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Turtle identification dataset
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Image crop & export
        </h1>
        <p className="max-w-2xl text-zinc-600">
          Upload or paste a photo, crop to {OUTPUT_SIZE}×{OUTPUT_SIZE}, choose
          left/right side, and export with{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
            id_side_normal|flipped
          </code>{" "}
          filenames.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <section className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Upload image
            </button>
            <button
              type="button"
              onClick={() => setStatus("Press Cmd/Ctrl+V to paste from clipboard.")}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
            >
              Paste from clipboard
            </button>
            {imageSrc && (
              <button
                type="button"
                onClick={() => {
                  setImageSrc(null);
                  setPreviews([]);
                  setStatus(null);
                }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
              >
                Clear
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadImageFromFile(file);
                event.target.value = "";
              }}
            />
          </div>

          <div className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectMode === "square" ? 1 : undefined}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="contain"
              />
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 text-center text-zinc-500">
                <p className="text-lg font-medium">No image loaded</p>
                <p className="text-sm">Upload a file or paste from clipboard</p>
              </div>
            )}
          </div>

          {imageSrc && (
            <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="radio"
                    name="aspect"
                    checked={aspectMode === "square"}
                    onChange={() => setAspectMode("square")}
                  />
                  1:1 ({OUTPUT_SIZE}×{OUTPUT_SIZE})
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="radio"
                    name="aspect"
                    checked={aspectMode === "free"}
                    onChange={() => setAspectMode("free")}
                  />
                  Free ratio
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-zinc-600">
                  <span>Zoom</span>
                  <span>{zoom.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="w-full accent-emerald-600"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 0.1))}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50"
                  >
                    Zoom out
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 0.1))}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50"
                  >
                    Zoom in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setCrop({ x: 0, y: 0 });
                    }}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50"
                  >
                    Reset view
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Naming</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Format: <span className="font-mono">id_left|right_normal|flipped</span>
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={useCustomId}
                onChange={(event) => setUseCustomId(event.target.checked)}
              />
              Use custom ID
            </label>

            {useCustomId ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700" htmlFor="custom-id">
                  Custom ID
                </label>
                <input
                  id="custom-id"
                  value={customId}
                  onChange={(event) => setCustomId(event.target.value)}
                  placeholder="e.g. turtle_042"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700" htmlFor="id-prefix">
                    ID prefix
                  </label>
                  <input
                    id="id-prefix"
                    value={idPrefix}
                    onChange={(event) => {
                      setIdPrefix(event.target.value);
                      saveIdPrefix(event.target.value);
                    }}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium text-zinc-700" htmlFor="id-counter">
                      Counter
                    </label>
                    <input
                      id="id-counter"
                      type="number"
                      min={1}
                      value={idCounter}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        if (Number.isFinite(value) && value > 0) {
                          setIdCounter(value);
                          saveIdCounter(value);
                        }
                      }}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={bumpId}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    onClick={resetId}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Current ID</p>
              <p className="mt-1 font-mono text-sm text-zinc-900">{turtleId}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">Turtle side</p>
              <div className="grid grid-cols-2 gap-2">
                {(["left", "right"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSide(option)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                      side === option
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={includeFlipped}
                onChange={(event) => setIncludeFlipped(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                Also export flipped image
                <span className="mt-1 block text-xs text-zinc-500">
                  Downloads both normal and flipped variants when enabled.
                </span>
              </span>
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">Output filenames</p>
              <ul className="space-y-1">
                {outputFilenames.map(({ filename }) => (
                  <li
                    key={filename}
                    className="rounded-md bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800"
                  >
                    {filename}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={!imageSrc || isExporting}
                onClick={() => void generatePreviews()}
                className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Preview export
              </button>
              <button
                type="button"
                disabled={!imageSrc || isExporting}
                onClick={() => void exportImages()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExporting ? "Working..." : "Download images"}
              </button>
            </div>

            {status && (
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{status}</p>
            )}
          </div>

          {previews.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
              <h2 className="text-lg font-semibold text-zinc-900">Preview</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {previews.map((preview) => (
                  <figure key={preview.variant} className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.url}
                      alt={preview.filename}
                      className="aspect-square w-full rounded-lg border border-zinc-200 object-cover"
                    />
                    <figcaption className="font-mono text-xs text-zinc-600">
                      {preview.filename}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

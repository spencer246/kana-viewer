import decoderUrl from "wawoff2/build/decompress_binding.js?url";

interface Decoder {
  onRuntimeInitialized: () => void;
  onAbort: (reason: unknown) => void;
  decompress: (bytes: Uint8Array) => Uint8Array;
}

declare global {
  interface Window {
    Module?: Decoder;
  }
}

let decoder: Promise<Decoder> | undefined;

export async function decompressWoff2(
  bytes: ArrayBuffer,
): Promise<ArrayBuffer> {
  decoder ??= new Promise<Decoder>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = decoderUrl;
    window.Module = {
      onRuntimeInitialized: () => {
        if (window.Module) resolve(window.Module);
      },
      onAbort: () => reject(new Error("Could not start the WOFF2 decoder.")),
      decompress: () => {
        throw new Error("The WOFF2 decoder is still loading.");
      },
    };
    script.onerror = () =>
      reject(new Error("Could not load the WOFF2 decoder."));
    document.head.append(script);
  }).catch((error: unknown) => {
    decoder = undefined;
    throw error;
  });

  const decoded = (await decoder).decompress(new Uint8Array(bytes));
  if (!decoded?.byteLength) throw new Error("Could not decode the WOFF2 font.");
  return Uint8Array.from(decoded).buffer;
}

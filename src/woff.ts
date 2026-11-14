const woffHeaderSize = 44;
const woffRecordSize = 20;
const sfntHeaderSize = 12;
const sfntRecordSize = 16;
const headTag = 0x68656164;

function paddedSize(size: number) {
  return Math.ceil(size / 4) * 4;
}

function invalidWoff(): never {
  throw new Error("Could not decode the WOFF font.");
}

async function inflateTable(compressed: Uint8Array<ArrayBuffer>, size: number) {
  const reader = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > size) {
        await reader.cancel();
        invalidWoff();
      }
      chunks.push(value);
    }
  } catch {
    invalidWoff();
  } finally {
    reader.releaseLock();
  }
  if (length !== size) invalidWoff();
  return chunks;
}

export async function decompressWoff(data: ArrayBuffer): Promise<ArrayBuffer> {
  if (data.byteLength < woffHeaderSize) invalidWoff();
  const input = new DataView(data);
  const flavor = input.getUint32(4);
  const count = input.getUint16(12);
  const directoryEnd = woffHeaderSize + count * woffRecordSize;
  if (
    input.getUint32(0) !== 0x774f4646 ||
    input.getUint32(8) !== data.byteLength ||
    input.getUint16(14) !== 0 ||
    count === 0 ||
    count > 4095 ||
    directoryEnd > data.byteLength
  ) {
    invalidWoff();
  }

  const tables = [];
  let sfntSize = sfntHeaderSize + count * sfntRecordSize;
  let previousTag = -1;
  for (let index = 0; index < count; index++) {
    const record = woffHeaderSize + index * woffRecordSize;
    const tag = input.getUint32(record);
    const offset = input.getUint32(record + 4);
    const compressedSize = input.getUint32(record + 8);
    const size = input.getUint32(record + 12);
    const checksum = input.getUint32(record + 16);
    if (
      tag <= previousTag ||
      offset % 4 !== 0 ||
      offset < directoryEnd ||
      compressedSize > size ||
      offset + paddedSize(compressedSize) > data.byteLength ||
      (tag === headTag && size < 12)
    ) {
      invalidWoff();
    }
    tables.push({
      tag,
      offset,
      compressedSize,
      size,
      checksum,
      sfntOffset: sfntSize,
    });
    previousTag = tag;
    sfntSize += paddedSize(size);
  }
  if (sfntSize !== input.getUint32(16)) invalidWoff();

  let blockEnd = directoryEnd;
  for (const table of [...tables].sort(
    (a, b) => a.offset - b.offset || a.compressedSize - b.compressedSize,
  )) {
    if (table.offset < blockEnd) invalidWoff();
    blockEnd = table.offset + paddedSize(table.compressedSize);
  }

  const tableData = [];
  for (const { offset, compressedSize, size } of tables) {
    const bytes = new Uint8Array(data, offset, compressedSize);
    tableData.push(
      compressedSize === size ? [bytes] : await inflateTable(bytes, size),
    );
  }

  const output = new ArrayBuffer(sfntSize);
  const header = new DataView(output);
  const outputBytes = new Uint8Array(output);
  const entrySelector = Math.floor(Math.log2(count));
  const searchRange = 2 ** entrySelector * sfntRecordSize;
  header.setUint32(0, flavor);
  header.setUint16(4, count);
  header.setUint16(6, searchRange);
  header.setUint16(8, entrySelector);
  header.setUint16(10, count * sfntRecordSize - searchRange);

  let adjustmentOffset: number | undefined;
  for (const [index, table] of tables.entries()) {
    const record = sfntHeaderSize + index * sfntRecordSize;
    header.setUint32(record, table.tag);
    header.setUint32(record + 4, table.checksum);
    header.setUint32(record + 8, table.sfntOffset);
    header.setUint32(record + 12, table.size);

    let offset = table.sfntOffset;
    for (const chunk of tableData[index]) {
      outputBytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (table.tag === headTag) adjustmentOffset = table.sfntOffset + 8;
  }

  // Repacking the tables changes the offsets used in the whole-font checksum.
  if (adjustmentOffset !== undefined) {
    header.setUint32(adjustmentOffset, 0);
    let checksum = 0;
    for (let offset = 0; offset < sfntSize; offset += 4) {
      checksum = (checksum + header.getUint32(offset)) >>> 0;
    }
    header.setUint32(adjustmentOffset, (0xb1b0afba - checksum) >>> 0);
  }
  return output;
}

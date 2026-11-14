declare module "opentype.js" {
  export function parse(
    data: ArrayBuffer,
    options: { lowMemory: boolean },
  ): {
    isCIDFont?: boolean;
    glyphs: { get(gid: number): { name?: string | number } };
  };
}

declare module "heic-decode" {
  export default function decodeHeic(input: { buffer: ArrayBuffer }): Promise<{
    width: number;
    height: number;
    data: ArrayBuffer;
  }>;
}

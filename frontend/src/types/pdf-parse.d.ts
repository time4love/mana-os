declare module "pdf-parse" {
  function pdfParse(
    dataBuffer: Buffer,
    options?: { pagerender?: (pageData: unknown) => string }
  ): Promise<{ numpages: number; numrender: number; text: string; info: unknown; metadata: unknown }>;
  export = pdfParse;
}

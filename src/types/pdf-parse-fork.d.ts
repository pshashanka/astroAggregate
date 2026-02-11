declare module 'pdf-parse-fork' {
  namespace PdfParse {
    interface Result {
      numpages: number;
      numrender: number;
      info: any;
      metadata: any;
      version: string;
      text: string;
    }
    
    interface Options {
      pagerender?: ((pageData: any) => string | Promise<string>) | undefined;
      max?: number | undefined;
      version?: string | undefined;
    }
  }
  
  function PdfParse(dataBuffer: Buffer, options?: PdfParse.Options): Promise<PdfParse.Result>;
  
  export = PdfParse;
}

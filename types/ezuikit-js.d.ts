declare module 'ezuikit-js' {
  export class EZUIKitPlayer {
    constructor(options: {
      id: string;
      accessToken: string;
      url: string;
      width?: number;
      height?: number;
      staticPath?: string;
      env?: { domain?: string };
      handleError?: (err: any) => void;
      [key: string]: any;
    });
    stop(): void;
    play(): void;
    destroy(): void;
  }
}

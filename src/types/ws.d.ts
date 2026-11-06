declare module 'ws' {
  import { Server as HttpServer } from 'http';
  import { EventEmitter } from 'events';

  export type RawData = Buffer | ArrayBuffer | Buffer[];

  export interface WebSocketServerOptions {
    server?: HttpServer;
    port?: number;
    maxPayload?: number;
    [key: string]: any;
  }

  export class WebSocket extends EventEmitter {
    static readonly CONNECTING: 0;
    static readonly OPEN: 1;
    static readonly CLOSING: 2;
    static readonly CLOSED: 3;

    readyState: number;
    send(data: any, cb?: (err?: Error) => void): void;
    close(code?: number, data?: string | Buffer): void;
    terminate(): void;
    ping(data?: any, mask?: boolean, cb?: (err?: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err?: Error) => void): void;
    on(event: 'message', listener: (data: RawData, isBinary: boolean) => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: 'ping' | 'pong', listener: (data: Buffer) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options?: WebSocketServerOptions, callback?: () => void);
    close(cb?: (err?: Error) => void): void;
    on(event: 'connection', listener: (socket: WebSocket, request: any) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
  }
}

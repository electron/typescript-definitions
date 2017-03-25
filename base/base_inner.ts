  class EventEmitter {
    public addListener(event: string, listener: Function): this;
    public on(event: string, listener: Function): this;
    public once(event: string, listener: Function): this;
    public removeListener(event: string, listener: Function): this;
    public removeAllListeners(event?: string): this;
    public setMaxListeners(n: number): this;
    public getMaxListeners(): number;
    public listeners(event: string): Function[];
    public emit(event: string, ...args: any[]): boolean;
    public listenerCount(type: string): number;
    public prependListener(event: string, listener: Function): this;
    public prependOnceListener(event: string, listener: Function): this;
    public eventNames(): string[];
  }

  class Accelerator extends String {

  }

  interface Event {
    preventDefault: Function;
    sender: WebContents;
    returnValue?: any;
    ctrlkey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  }
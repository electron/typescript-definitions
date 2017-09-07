  class EventEmitter {
    addListener(event: string, listener: Function): this;
    on(event: string, listener: Function): this;
    once(event: string, listener: Function): this;
    removeListener(event: string, listener: Function): this;
    removeAllListeners(event?: string): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    listeners(event: string): Function[];
    emit(event: string, ...args: any[]): boolean;
    listenerCount(type: string): number;
    prependListener(event: string, listener: Function): this;
    prependOnceListener(event: string, listener: Function): this;
    eventNames(): string[];
  }

  class Accelerator extends String {

  }

  interface Event extends GlobalEvent {
    preventDefault: () => void;
    sender: WebContents;
    returnValue: any;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }
  const NodeEventEmitter: typeof import('events').EventEmitter;

  type Accelerator = string;
  type Event<Params extends object = {}> = {
    preventDefault: () => void;
    readonly defaultPrevented: boolean;
  } & Params;

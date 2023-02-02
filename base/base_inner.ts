  const NodeEventEmitter: typeof import('events').EventEmitter;

  type EmptyParams = {};
  type Event<Params extends object, Sender extends NodeJS.EventEmitter> = {
    preventDefault: () => void;
    readonly defaultPrevented: boolean;
    sender: Sender;
  } & Params;

  class Accelerator extends String {}

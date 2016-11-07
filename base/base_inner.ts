  class EventEmitter extends NodeJS.EventEmitter {
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
  }

  class Accelerator extends String {

  }

  /**
   * DownloadItem represents a download item in Electron.
   */
  interface DownloadItem extends NodeJS.EventEmitter {
    /**
    * Emitted when the download has been updated and is not done.
    */
    on(event: 'updated', listener: (event: Event, state: 'progressing' | 'interrupted') => void): this;
    /**
    * Emits when the download is in a terminal state. This includes a completed download,
    * a cancelled download (via downloadItem.cancel()), and interrupted download that can’t be resumed.
    */
    on(event: 'done', listener: (event: Event, state: 'completed' | 'cancelled' | 'interrupted') => void): this;
    on(event: string, listener: Function): this;
    /**
    * Set the save file path of the download item.
    * Note: The API is only available in session’s will-download callback function.
    * If user doesn’t set the save path via the API, Electron will use the original
    * routine to determine the save path (Usually prompts a save dialog).
    */
    setSavePath(path: string): void;
    /**
    * @returns The save path of the download item.
    * This will be either the path set via downloadItem.setSavePath(path) or the path selected from the shown save dialog.
    */
    getSavePath(): string;
    /**
    * Pauses the download.
    */
    pause(): void;
    /**
    * @returns Whether the download is paused.
    */
    isPaused(): boolean;
    /**
    * Resumes the download that has been paused.
    */
    resume(): void;
    /**
    * @returns Whether the download can resume.
    */
    canResume(): boolean;
    /**
    * Cancels the download operation.
    */
    cancel(): void;
    /**
    * @returns The origin url where the item is downloaded from.
    */
    getURL(): string;
    /**
    * @returns The mime type.
    */
    getMimeType(): string;
    /**
    * @returns Whether the download has user gesture.
    */
    hasUserGesture(): boolean;
    /**
    * @returns The file name of the download item.
    * Note: The file name is not always the same as the actual one saved in local disk.
    * If user changes the file name in a prompted download saving dialog,
    * the actual name of saved file will be different.
    */
    getFilename(): string;
    /**
    * @returns The total size in bytes of the download item. If the size is unknown, it returns 0.
    */
    getTotalBytes(): number;
    /**
    * @returns The received bytes of the download item.
    */
    getReceivedBytes(): number;
    /**
    * @returns The Content-Disposition field from the response header.
    */
    getContentDisposition(): string;
    /**
    * @returns The current state.
    */
    getState(): 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  }

  interface Event {
    preventDefault: Function;
    sender: WebContents;
    returnValue?: any;
  }
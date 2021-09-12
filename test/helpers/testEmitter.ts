import { ICommand, IDataEmitter, IDataEvent, IDataEventListener, IDataEventListenerFunc, IDisposable, IExecutionResult, IFormatSettings, ISettings, IStatusChangeListener, IStatusChangeListenerFunc, IStatusEvent } from "@curium.rocks/data-emitter-base";

/**
 * 
 */
export class TestEmitter implements IDataEmitter, IDisposable {

    id = 'id';
    name = 'name';
    description = 'description';
    disposeCallCount = 0;

    /**
     * 
     * @param {IDataEventListener | IDataEventListenerFunc} listener 
     */
    onData(listener: IDataEventListener | IDataEventListenerFunc): IDisposable {
        throw new Error("Method not implemented.");
    }
    /**
     * 
     * @param {IStatusChangeListener | IStatusChangeListenerFunc } listener 
     */
    onStatus(listener: IStatusChangeListener | IStatusChangeListenerFunc): IDisposable {
        throw new Error("Method not implemented.");
    }

    /**
     * 
     * @param {ISettings} settings 
     */
    applySettings(settings: ISettings): Promise<IExecutionResult> {
        throw new Error("Method not implemented.");
    }

    /**
     * 
     * @param {ICommand} command 
     */
    sendCommand(command: ICommand): Promise<IExecutionResult> {
        throw new Error("Method not implemented.");
    }

    /**
     * 
     */
    probeStatus(): Promise<IStatusEvent> {
        throw new Error("Method not implemented.");
    }

    /**
     * 
     */
    probeCurrentData(): Promise<IDataEvent> {
        throw new Error("Method not implemented.");
    }

    /**
     * 
     */
    toJSON(): Record<string, unknown> {
        throw new Error("Method not implemented.");
    }

    /**
     * 
     * @param {IFormatSettings} settings 
     */
    serializeState(settings: IFormatSettings): Promise<string> {
        throw new Error("Method not implemented.");
    }

    /**
     * 
     */
    dispose(): void {
        this.disposeCallCount++;
    }
    
}
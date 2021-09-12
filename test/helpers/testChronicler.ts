import { IChronicler, IDataEvent, IFormatSettings, IJsonSerializable, IStatusEvent } from "@curium.rocks/data-emitter-base";

/**
 * 
 */
export class TestChronicler implements IChronicler {
    
    id = 'id';
    name = 'name';
    description = 'description';
    disposeCallCount = 0;
    serializeCount = 0;

    /**
     * 
     * @param {IJsonSerializable| IStatusEvent | IDataEvent} record 
     */
    saveRecord(record: IJsonSerializable | IDataEvent | IStatusEvent): Promise<void> {
        throw new Error("Method not implemented.");
    }

    /**
     * @return {Promise<void>}
     */
    disposeAsync(): Promise<void> {
        this.disposeCallCount++;
        return Promise.resolve();
    }

    /**
     * 
     * @param {IFormatSettings} settings 
     * @return {Promise<void>} 
     */
    serializeState(settings: IFormatSettings): Promise<string> {
        this.serializeCount++;
        return Promise.resolve(JSON.stringify(this));
    }
    
}
import {IChronicler, IDataEmitter, IMaestro, IService} from '@curium.rocks/data-emitter-base';
import { IDisposable } from '@curium.rocks/data-emitter-base/build/src/dataEmitter';


/**
 * IMaestro implementation
 */
export class Maestro implements IMaestro, IService, IDisposable {
    /**
     * 
     */
    start(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    /**
     * 
     */
    stop(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    /**
     * 
     */
    dispose(): void {
        throw new Error('Method not implemented.');
    }
    /**
     * 
     * @param {IDataEmitter|Iterable<IDataEmitter>} emitters 
     * @param {IChronicler|Iterable<IChronicler>} chroniclers 
     */
    connect(emitters: IDataEmitter | Iterable<IDataEmitter>, chroniclers: IChronicler | Iterable<IChronicler>): IDisposable {
        throw new Error('Method not implemented.');
    }
    /**
     * 
     */
    load(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    /**
     * 
     */
    save(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    /**
     * 
     * @param {IDataEmitter}  emitter 
     */
    addEmitter(emitter: IDataEmitter): void {
        throw new Error('Method not implemented.');
    }
    /**
     * 
     * @param {IDataEmitter} emitter 
     */
    removeEmitter(emitter: IDataEmitter): void {
        throw new Error('Method not implemented.');
    }
    /**
     * 
     * @param {IChronicler} chronicler 
     */
    addChronicler(chronicler: IChronicler): void {
        throw new Error('Method not implemented.');
    }
    /**
     * 
     * @param {IChronicler} chronicler 
     */
    removeChronicler(chronicler: IChronicler): void {
        throw new Error('Method not implemented.');
    }
    

    private readonly _emitters: Map<string, IDataEmitter> = new Map<string, IDataEmitter>();
    private readonly _chroniclers: Map<string, IChronicler> = new Map<string, IChronicler>();

    /**
     * @return {Iterable<IDataEmitter>}
     */
    get emitters() : Iterable<IDataEmitter> {
        return this._emitters.values();
    }

    /**
     * @return {Iterable<IChronicler>}
     */
    get chroniclers() : Iterable<IChronicler> {
        return this._chroniclers.values();
    }
}
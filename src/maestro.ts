import {IChronicler, IDataEmitter, IMaestro, IService} from '@curium.rocks/data-emitter-base';
import { IDisposable } from '@curium.rocks/data-emitter-base/build/src/dataEmitter';


/**
 * IMaestro implementation
 */
export class Maestro implements IMaestro, IService {

    /**
     * 
     */
    emitters: Iterable<IDataEmitter>;
    chroniclers: Iterable<IChronicler>;

    connect(emitters: Iterable<IDataEmitter>, chroniclers: Iterable<IChronicler>): IDisposable {

    }

    connect(emitter: IDataEmitter, chronicler: IChronicler): IDisposable {

    }
    
    connect(emitter: any, chronicler: any): IDisposable {
        throw new Error('Method not implemented.');
    }
    
    addEmitter(emitter: IDataEmitter): void {
        throw new Error('Method not implemented.');
    }
    
    removeEmitter(emitter: IDataEmitter): void {
        throw new Error('Method not implemented.');
    }    
    
    addChronicler(chronicler: IChronicler): void {
        throw new Error('Method not implemented.');
    }
    
    removeChronicler(chronicler: IChronicler): void {
        throw new Error('Method not implemented.');
    }

    load(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    save(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    start(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    stop(): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
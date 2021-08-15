import {IChronicler, IDataEmitter, IMaestro, IService, LoggerFacade, LogLevel, IDisposableAsync, isDisposableAsync, isDisposable, isService} from '@curium.rocks/data-emitter-base';
import { IDisposable} from '@curium.rocks/data-emitter-base/build/src/dataEmitter';

/**
 * 
 * @param {unknown} obj Check if a object is iterable
 * @return {boolean} if obj is iterable
 */
function isIterable(obj: unknown) {
    // checks for null and undefined
    if (obj == null) {
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof (obj as any)[Symbol.iterator] === 'function';
}

/**
 * IMaestro implementation
 */
export class Maestro implements IMaestro, IService, IDisposableAsync {
    private readonly _emitters: Map<string, IDataEmitter> = new Map<string, IDataEmitter>();
    private readonly _chroniclers: Map<string, IChronicler> = new Map<string, IChronicler>();
    private readonly _logger: LoggerFacade;
    private readonly _disposables: Set<IDisposable|IDisposableAsync> = new Set<IDisposable|IDisposableAsync>();

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

    /**
     * 
     * @param {LoggerFacade} logger 
     */
    constructor(logger:LoggerFacade) {
        this._logger = logger;
        this.log(LogLevel.DEBUG, "creating maestro");
    }

    /**
     * 
     * @param {LogLevel} level 
     * @param {string} msg 
     */
    log(level:LogLevel, msg: string) : void {
        switch(level) {
            case LogLevel.CRITICAL:
                this._logger.critical(msg);
                break;
            case LogLevel.DEBUG:
                this._logger.debug(msg);
                break;
            case LogLevel.ERROR:
                this._logger.error(msg);
                break;
            case LogLevel.INFO:
                this._logger.info(msg);
                break;
            case LogLevel.TRACE:
                this._logger.trace(msg);
                break;
            case LogLevel.WARN:
                this._logger.warn(msg);
                break;
            default:
                this._logger.info(msg);
        }
    }

    /**
     * 
     * @param {boolean} start
     * @return {Promise<void>} 
     */
    private async serviceCallEntities(start: boolean) : Promise<void> {
        const promises = Array.from(this.emitters as Iterable<unknown>).concat(Array.from(this.chroniclers as Iterable<unknown>))
            .map((obj:unknown) => {
            if(isService(obj)) {
                const service = obj as IService;
                return start ? service.start() : service.stop();
            } else {
                return Promise.resolve();
            }
        });
        await Promise.all(promises);
    }

    /**
     * @return {Promise<void>}
     */
    start(): Promise<void> {
        return this.serviceCallEntities(true);
    }
    
    /**
     * @return {Promise<void>}
     */
    stop(): Promise<void> {
        return this.serviceCallEntities(false);
    }

    /**
     * @return {Promise<void>}
     */
    async disposeAsync(): Promise<void> {
        await Promise.all(Array.from(this.emitters as Iterable<unknown>).concat(Array.from(this.chroniclers as Iterable<unknown>))
            .map((obj:unknown) => {
            if(isDisposable(obj)) {
                const disposable = obj as IDisposable;
                disposable.dispose();
                return Promise.resolve();
            } else if (isDisposableAsync(obj)){
                const disposable = obj as IDisposableAsync;
                return disposable.disposeAsync();
            } else {
                return Promise.resolve();
            }
        }));
    }


    // TODO: split into smaller functions
    /**
     * 
     * @param {IDataEmitter|Iterable<IDataEmitter>} emitters 
     * @param {IChronicler|Iterable<IChronicler>} chroniclers 
     * @return {IDisposable}
     */
    connect(emitters: IDataEmitter | Iterable<IDataEmitter>, chroniclers: IChronicler | Iterable<IChronicler>): IDisposable {
        const multipleEmitters = isIterable(emitters);
        const multipleChroniclers = isIterable(chroniclers);
        if(multipleChroniclers && multipleEmitters) {
            const chroniclerSet = chroniclers as Iterable<IChronicler>;
            const emitterSet = emitters as Iterable<IDataEmitter>;

            const disposables = Array.from(emitterSet).map( (emitter) => {
                return Array.from(chroniclerSet).map( (chroncicler) => {
                    return emitter.onData(chroncicler.saveRecord);
                })
            }).reduce((prev, cur) => prev.concat(cur));

            const returnDisposable = {
                dispose: () => {
                    disposables.forEach((d) => d.dispose);
                    this._disposables.delete(returnDisposable);
                }
            }
            this._disposables.add(returnDisposable);
            return returnDisposable;

        } else if(multipleEmitters && !multipleChroniclers) {
            const chronicler = chroniclers as IChronicler;
            const emitterSet = emitters as Iterable<IDataEmitter>;
            const disposables = Array.from(emitterSet).map( (emitter) => emitter.onData(chronicler.saveRecord));
            const returnDisposables = {
                dispose: () => {
                    disposables.forEach( (d) => {
                        d.dispose();
                    });
                    this._disposables.delete(returnDisposables);
                }
            }
            this._disposables.add(returnDisposables);
            return returnDisposables;
        } else if(!multipleEmitters && multipleChroniclers) {
            const emitter = emitters as IDataEmitter;
            const chroncilerSet = chroniclers as Iterable<IChronicler>;
            const disposables = Array.from(chroncilerSet).map( (chron) => emitter.onData(chron.saveRecord));
            const disposable = {
                dispose: () => {
                    disposables.forEach(d => {
                        d.dispose();
                    });
                    this._disposables.delete(disposable);
                }
            }
            this._disposables.add(disposable);
            return disposable;
        } else {
            const disposable = (emitters as IDataEmitter).onData((chroniclers as IChronicler).saveRecord);
            const returnDisposable = {
                dispose: () => {
                    disposable.dispose();
                    this._disposables.delete(disposable);
                }
            }
            this._disposables.add(returnDisposable);
            return returnDisposable;
        }
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
        const key = emitter.id.toLowerCase();
        if(this._emitters.has(key)){
            // TODO: think about if we should be responsible for cleaning up of an emitter in this case
            this.log(LogLevel.WARN, `Replacing ${key} in emitter map `);
        }
        this._emitters.set(key, emitter);
    }
    
    /**
     * 
     * @param {IDataEmitter} emitter 
     */
    removeEmitter(emitter: IDataEmitter): void {
        const key = emitter.id.toLowerCase();
        if(this._emitters.has(key))
            this._emitters.delete(key);
    }

    /**
     * 
     * @param {IChronicler} chronicler 
     */
    addChronicler(chronicler: IChronicler): void {
        const key = chronicler.id.toLowerCase();
        if(this._chroniclers.has(key)){
            // TODO: think about if we should be responsible for cleaning up of an chronicler in this case
            this.log(LogLevel.WARN, `Replacing ${key} in chronicler map `);
        }
        this._chroniclers.set(key, chronicler);    
    }


    /**
     * 
     * @param {IChronicler} chronicler 
     */
    removeChronicler(chronicler: IChronicler): void {
        const key = chronicler.id.toLowerCase();
        if(this._chroniclers.has(key))
            this._chroniclers.delete(key);
    }
    


}
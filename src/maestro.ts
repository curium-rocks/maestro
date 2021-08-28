import {IChronicler, IDataEmitter, IMaestro, IService, LoggerFacade, LogLevel, IDisposableAsync, isDisposableAsync, isDisposable, isService, ProviderSingleton, IDisposable, IClassifier, IChroniclerFactory, IEmitterFactory} from '@curium.rocks/data-emitter-base';
import { IChroniclerConfig, IEmitterConfig, IFactoryMap, IMaestroConfig } from './meastroConfig';
import fs from 'fs';
import fsProm from 'fs/promises';

/**
 * 
 * @param {unknown} obj Check if a object is iterable
 * @return {boolean} if obj is iterable
 */
export function isIterable(obj: unknown): boolean {
    // checks for null and undefined
    if (obj == null) {
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof (obj as any)[Symbol.iterator] === 'function';
}

export interface IMaestroSaveHandler {
    (config:IMaestroConfig): Promise<void>;
}
export interface IMaestroLoadHandler {
    (): Promise<IMaestroConfig>;
}

export interface IMeastroOptions {
    logger?: LoggerFacade,
    config: IMaestroConfig | string,
    loadHandler?: IMaestroLoadHandler,
    saveHandler?: IMaestroSaveHandler
}

/**
 * IMaestro implementation
 */
export class Maestro implements IMaestro, IService, IDisposableAsync, IClassifier {
    private readonly _emitters: Map<string, IDataEmitter> = new Map<string, IDataEmitter>();
    private readonly _chroniclers: Map<string, IChronicler> = new Map<string, IChronicler>();
    private readonly _logger?: LoggerFacade;
    private readonly _disposables: Set<IDisposable|IDisposableAsync> = new Set<IDisposable|IDisposableAsync>();
    private readonly _configFilePath?: string;
    private readonly _config: IMaestroConfig;
    private readonly _saveHandler? : IMaestroSaveHandler;
    private readonly _loadHandler? : IMaestroLoadHandler; 

    /**
     * get the id of the meastro
     * @return {string}
     */
    get id(): string {
        return this._config.id;
    }

    /**
     * get the name of the mastro
     */
    get name(): string {
        return this._config.name;
    }

    /**
     * get the description of the maestro
     */
    get description(): string {
        return this._config.description;
    }


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
     * @param {IMaestroOptions} options 
     */
    constructor(options: IMeastroOptions) {
        this._logger = options.logger;
        this.log(LogLevel.DEBUG, "creating maestro");
        
        if(typeof options.config === 'string' && options.saveHandler == null) {
            this.log(LogLevel.WARN, 'A maestro configuration object was provided instead of a file path but a save handler was not provided. ' + 
            'Save operations will throw an error and you will not be update to persist any state changes back to the original configuration');
        }
        if(typeof options.config === 'string' && options.loadHandler == null) {
            this.log(LogLevel.WARN,'A maestro configuration object was provided instead of a file path but a load handler was not provided. ' + 
            'Load operations will not update the state and will log an warning.');
        }

        if(typeof options.config === 'string') {
            this._configFilePath = options.config;
            const jsonString = fs.readFileSync(options.config, {
                encoding: 'utf-8'
            });
    
            this._config = JSON.parse(jsonString);
        } else {
            this._configFilePath = undefined;
            if(options.loadHandler) this._loadHandler = options.loadHandler;
            if(options.saveHandler) this._saveHandler = options.saveHandler;
            this._config = options.config;
        }
        
        this.load().then(()=>{
            // save back on startup to enforce encryption and other formatting properties on seed case
            return this.save();
        }).catch((err)=>{
            this.log(LogLevel.WARN, "An error occurred while loading configuration, another load will be required: " + err);
        });
    }

    /**
     * 
     * @param {LogLevel} level 
     * @param {string} msg 
     */
    log(level:LogLevel, msg: string) : void {
        switch(level) {
            case LogLevel.CRITICAL:
                this._logger?.critical(msg);
                break;
            case LogLevel.DEBUG:
                this._logger?.debug(msg);
                break;
            case LogLevel.ERROR:
                this._logger?.error(msg);
                break;
            case LogLevel.INFO:
                this._logger?.info(msg);
                break;
            case LogLevel.TRACE:
                this._logger?.trace(msg);
                break;
            case LogLevel.WARN:
                this._logger?.warn(msg);
                break;
            default:
                this._logger?.info(msg);
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
            .map(this.cleanUpIfDisposable));
        this._chroniclers.clear();
        this._emitters.clear();
        this._disposables.clear();
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
     * @param {unknown} obj 
     * @return {Promise<void>}
     */
    private cleanUpIfDisposable(obj: unknown) : Promise<void> {
        if(isDisposableAsync(obj)) {
            return (obj as IDisposableAsync).disposeAsync();
        } else if(isDisposable(obj)) {
            return Promise.resolve((obj as IDisposable).dispose());
        } else {
            return Promise.resolve();
        }
    }


    /**
     * Make the maestro match the configuration
     * @param {IMaestroConfig} maestroConfig 
     */
    private async applyConfiguration(maestroConfig: IMaestroConfig) : Promise<void> {
        // clear out the emitters
        // clear out the chroniclers
        // clean up
        await Promise.all(Array.
            from(this._disposables, this._emitters.entries, this._chroniclers.entries).map(this.cleanUpIfDisposable));
        this._disposables.clear();
        this._emitters.clear();
        this._chroniclers.clear();

        // load factories
        this.registerFactories(maestroConfig.factories);

        // create emitters
        await this.createEmitters(maestroConfig.emitters)

        // create chroniclers
        await this.createChroniclers(maestroConfig.chroniclers);
    }

    /**
     * 
     */
    async load(): Promise<void> {
        // set the classifier information
        let maestroConfig: IMaestroConfig; 
        if(this._configFilePath) {
            const jsonStr = await fsProm.readFile(this._configFilePath, {
                encoding: 'utf-8'
            });
            maestroConfig = JSON.parse(jsonStr);
        } else if (this._loadHandler) {
            maestroConfig = await this._loadHandler();
        } else {
            return Promise.reject(new Error("Config file path or load handler not provided!"));
        }
        await this.applyConfiguration(maestroConfig)
    }

    /**
     * 
     * @param {Array<string>} factories 
     */
    private registerFactories(factories: IFactoryMap) : void {
        let factoryLoadCount = 0;
        this.log(LogLevel.INFO, "Loading factories");
        factories.emitter.forEach((iFactoryConfig) => {
            this.log(LogLevel.INFO, `Attempting to register emitter factory from module ${iFactoryConfig.packageName} of path ${iFactoryConfig.factoryPath} as type ${iFactoryConfig.factoryType}`);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const factory = (new (require(iFactoryConfig.packageName)[iFactoryConfig.factoryPath])) as IEmitterFactory;
            ProviderSingleton.getInstance().registerEmitterFactory(iFactoryConfig.factoryType, factory);
            this.log(LogLevel.INFO, `Registered emitter factory from module ${iFactoryConfig.packageName} of path ${iFactoryConfig.factoryPath} as type ${iFactoryConfig.factoryType}`);
            factoryLoadCount++;
        });

        factories.chronicler.forEach((iFactoryConfig) => {
            this.log(LogLevel.INFO, `Attempting to register chronicler factory from module ${iFactoryConfig.packageName} of path ${iFactoryConfig.factoryPath} as type ${iFactoryConfig.factoryType}`);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const factory = (new (require(iFactoryConfig.packageName)[iFactoryConfig.factoryPath])) as IChroniclerFactory;
            ProviderSingleton.getInstance().registerChroniclerFactory(iFactoryConfig.factoryType, factory);
            this.log(LogLevel.INFO, `Registered chronicler factory from module ${iFactoryConfig.packageName} of path ${iFactoryConfig.factoryPath} as type ${iFactoryConfig.factoryType}`);
            factoryLoadCount++;
        });
        this.log(LogLevel.INFO, `Loaded ${factoryLoadCount} factories`);
    }

    /**
     * 
     * @param {Array<IMeastroConfig>} emitters 
     */
    private async createEmitters(emitters: Array<IEmitterConfig>) : Promise<void> {
        this.log(LogLevel.INFO, "Loading emitters");
        let emitterCount = 0;
        await Promise.all(emitters.map(ec => {
            emitterCount++;
            if(typeof ec.config === "string") {
                return ProviderSingleton.getInstance().recreateEmitter(ec.config, ec.formatSettings)
            } else {
                return ProviderSingleton.getInstance().buildEmitter(ec.config);
            }
        }));
        this.log(LogLevel.INFO, `Loaded ${emitterCount} emitters`);
    }

    /**
     * 
     * @param {Array<IMaestroConfig>} chroniclers 
     */
    private async createChroniclers(chroniclers: Array<IChroniclerConfig>) : Promise<void> {
        this.log(LogLevel.INFO, "Loading chroniclers");
        let chroniclerCount = 0;
        await Promise.all(chroniclers.map(cc => {
            chroniclerCount++;
            if(typeof cc.config === "string") {
                return Promise.reject(new Error("Encryption not supported yet!"));
            }
            return ProviderSingleton.getInstance().buildChronicler(cc.config);
        }));
        this.log(LogLevel.INFO, `Loaded ${chroniclerCount} chroniclers`);    
    }

    /**
     * @return {Promise<IMaestroConfig>}
     */
    private async buildConfigObj(): Promise<IMaestroConfig> {
        const emitterConfigurations: IEmitterConfig[] = await Promise.all(Array.from(this._emitters).map(async (kvp)=>{
            return {
                formatSettings: this._config.formatSettings,
                config: await kvp[1].serializeState(this._config.formatSettings)
            }
        }));

        const chroniclerConfigurations: IChroniclerConfig[] = await Promise.all(Array.from(this._chroniclers).map(async (kvp)=>{
            return {
                formatSettings: this._config.formatSettings,
                config: await kvp[1].serializeState(this._config.formatSettings)
            }
        }))

        const savedConfig: IMaestroConfig = {
            factories: this._config.factories,
            emitters: emitterConfigurations,
            connections: [],
            chroniclers: chroniclerConfigurations,
            formatSettings: this._config.formatSettings,
            id: this.id,
            name: this.name,
            description: this.description
        }
        return savedConfig;
    }

    /**
     * 
     */
    async save(): Promise<void> {        
        if(this._configFilePath) {
            const jsonString: string = JSON.stringify(await this.buildConfigObj());
            await fsProm.writeFile(this._configFilePath, jsonString);
        } else if(this._saveHandler) {
            await this._saveHandler(await this.buildConfigObj());
        } else {
            return Promise.reject(new Error("No config file path or save handler provided"));
        }
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
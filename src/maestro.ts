import {IChronicler, IDataEmitter, IMaestro, IService, LoggerFacade, LogLevel, IDisposableAsync, isDisposableAsync, isDisposable, isService, ProviderSingleton, IDisposable, IClassifier, IChroniclerFactory, IEmitterFactory, hasMethod, IChroniclerDescription, IEmitterDescription} from '@curium.rocks/data-emitter-base';
import { IChroniclerConfig, IEmitterConfig, IFactoryMap, IMaestroConfig } from './meastroConfig';
import path from 'path';
import fs from 'fs';
import fsProm from 'fs/promises';
import crypto from 'crypto';
import { IConnection } from '.';

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

export interface IMaestroOptions {
    logger?: LoggerFacade,
    disposeOnRemove?: boolean;
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
    private _config: IMaestroConfig;
    private readonly _saveHandler? : IMaestroSaveHandler;
    private readonly _loadHandler? : IMaestroLoadHandler;
    private _configApplied = false;
    private readonly _disposeOnRemove: boolean;

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
    constructor(options: IMaestroOptions) {
        this._logger = options.logger;
        this.log(LogLevel.DEBUG, "creating maestro");
        this._disposeOnRemove = options.disposeOnRemove || true;
        
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
            try {
                const jsonString = fs.readFileSync(options.config, {
                    encoding: 'utf-8'
                });
                this._config = JSON.parse(jsonString);
            } catch (erro) {
                this.log(LogLevel.ERROR, "An error occurred while loading configuration: " + erro);
                const id = crypto.randomUUID();
                this._config = {
                    id: id,
                    name: id + '-default-name',
                    description: id + '-default-desc',
                    formatSettings: {
                        encrypted: false,
                        type: 'N/A'
                    },
                    connections: [],
                    chroniclers: [],
                    emitters: [],
                    factories:  {
                        emitter: [],
                        chronicler: []
                    }
                }
            }
        } else {
            this._configFilePath = undefined;
            if(options.loadHandler) this._loadHandler = options.loadHandler;
            if(options.saveHandler) this._saveHandler = options.saveHandler;
            this._config = options.config;
        }
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
        if(!this._configApplied) {
            await this.load();
        }
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
        await this.cleanUpResources();
    }

    /**
     * 
     * @param {IDisposable[]} toDispose 
     * @return {IDisposable}
     */
    private wrapDisposables(toDispose: IDisposable[]) : IDisposable {
        const returnDisposable = {
            dispose: () => {
                toDispose.forEach((d) => d.dispose);
                this._disposables.delete(returnDisposable);
            }
        }
        return returnDisposable;
    }
    
    /**
     * 
     * @param {IDataEmitter} emitter 
     * @param {IChronicler} chronicler 
     * @return {IDisposable}
     */
    private attachEmitterToChronicler(emitter: IDataEmitter, chronicler: IChronicler): IDisposable {
        const dataConnection = emitter.onData(chronicler.saveRecord.bind(chronicler));
        const statusConnection = emitter.onStatus(chronicler.saveRecord.bind(chronicler));

        return {
            dispose: () => {
                dataConnection.dispose();
                statusConnection.dispose();
            }
        }
    }

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
                    return this.attachEmitterToChronicler(emitter, chroncicler);
                })
            }).reduce((prev, cur) => prev.concat(cur), []);

            const returnDisposable = this.wrapDisposables(disposables);
            this._disposables.add(returnDisposable);
            return returnDisposable;

        } else if(multipleEmitters && !multipleChroniclers) {
            const chronicler = chroniclers as IChronicler;
            const emitterSet = emitters as Iterable<IDataEmitter>;
            const disposables = Array.from(emitterSet).map( (emitter) => this.attachEmitterToChronicler(emitter, chronicler));
            const returnDisposable = this.wrapDisposables(disposables);
            this._disposables.add(returnDisposable);
            return returnDisposable;
        } else if(!multipleEmitters && multipleChroniclers) {
            const emitter = emitters as IDataEmitter;
            const chroncilerSet = chroniclers as Iterable<IChronicler>;
            const disposables = Array.from(chroncilerSet).map( (chron) => this.attachEmitterToChronicler(emitter, chron));
            const returnDisposable = this.wrapDisposables(disposables);
            this._disposables.add(returnDisposable);
            return returnDisposable;
        } else {
            const disposable = this.attachEmitterToChronicler(emitters as IDataEmitter, chroniclers as IChronicler);
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
            this.log(LogLevel.DEBUG, "disposing object");
            return Promise.resolve((obj as IDisposable).dispose());
        } else {
            return Promise.resolve();
        }
    }

    /**
     * Call stop on an object if available
     * @param {unknown} obj 
     * @return {Promise<void>} 
     */
    private stopIfStoppable(obj: unknown) : Promise<void> {
        if(hasMethod(obj, 'stop')) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (obj as any).stop();    
        } else if( hasMethod(obj, 'stopPolling')) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (obj as any).stopPolling();
        }
        return Promise.resolve();
    }

    /**
     * @return {Promise<void>}
     */
    private async cleanUpResources() : Promise<void>  {
        this.log(LogLevel.DEBUG, `Cleaning up resources, current counts, emitters = ${this._emitters.size}, chroniclers = ${this._chroniclers.size}, connections = ${this._disposables.size}`);
        const resources: unknown[] = [];
        this._emitters.forEach((d) => resources.push(d));
        this._chroniclers.forEach((c) => resources.push(c));
        this._disposables.forEach((d) => resources.push(d));

        const promises = resources.map((d) => {
            return this.cleanUpIfDisposable(d);
        }).concat(resources.map((r) => {
            return this.stopIfStoppable(r);
        }));

        const unifiedPromise = Promise.all(promises);
        await unifiedPromise;

        this._emitters.clear();
        this._chroniclers.clear();
        this._disposables.clear();
        this.log(LogLevel.DEBUG, `Cleaned up ${resources.length} resources`);
    }


    /**
     * Make the maestro match the configuration
     * @param {IMaestroConfig} maestroConfig 
     */
    private async applyConfiguration(maestroConfig: IMaestroConfig) : Promise<void> {

        // load factories
        this.registerFactories(maestroConfig.factories);

        // create emitters
        await this.createEmitters(maestroConfig.emitters)

        // create chroniclers
        await this.createChroniclers(maestroConfig.chroniclers);

        // establish connections
        await this.createConnections(maestroConfig.connections);
        
        this._config = maestroConfig;
    }

    /**
     * 
     * @param {IConnections[]} connections
     * @return {Promise<void>} 
     */
    private async createConnections(connections: IConnection[]) {
        if(!connections || connections.length == 0) {
            return Promise.resolve();
        }
        connections.forEach((iConn) => {
            const emitters: Array<IDataEmitter> = iConn.emitters.map((emitterId) => this._emitters.get(emitterId.toLowerCase()))
                .filter((item) => item != null)
                .map((item) => item as IDataEmitter);
            const chroniclers: Array<IChronicler> = iConn.chroniclers.map((chronId) => this._chroniclers.get(chronId.toLowerCase()))
                .filter((item) => item != null)
                .map((item) => item as IChronicler);
            this.connect(emitters, chroniclers);
        })
    }

    /**
     * 
     */
    async load(): Promise<void> {
        await this.cleanUpResources();

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
        await this.applyConfiguration(maestroConfig);
        this._configApplied = true;
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
        const emitterArray: IDataEmitter[] = await Promise.all(emitters.map(ec => {
            emitterCount++;
            if(typeof ec.config === "string") {
                return ProviderSingleton.getInstance().recreateEmitter(ec.config, ec.formatSettings || this._config.formatSettings)
            } else {
                return ProviderSingleton.getInstance().buildEmitter(ec.config);
            }
        }));
        emitterArray.forEach((e) => this.addEmitter(e));
        this.log(LogLevel.INFO, `Loaded ${emitterCount} emitters`);
    }

    /**
     * 
     * @param {Array<IMaestroConfig>} chroniclers 
     */
    private async createChroniclers(chroniclers: Array<IChroniclerConfig>) : Promise<void> {
        this.log(LogLevel.INFO, "Loading chroniclers");
        let chroniclerCount = 0;
        const chroniclerArray: IChronicler[] = await Promise.all(chroniclers.map(cc => {
            chroniclerCount++;
            if(typeof cc.config === "string") {
                return Promise.reject(new Error("Encryption not supported yet!"));
            }
            return ProviderSingleton.getInstance().buildChronicler(cc.config);
        }));
        chroniclerArray.forEach((c) => this.addChronicler(c));
        this.log(LogLevel.INFO, `Loaded ${chroniclerCount} chroniclers`);    
    }

    /**
     * 
     * @param {IDataEmitter|IChronicler} obj 
     * @return {Promise<IEmitterConfig|IChroniclerConfig>}
     */
    private async createConfig(obj: IDataEmitter|IChronicler) : Promise<IEmitterConfig|IChroniclerConfig> {
        return {
            formatSettings: this._config.formatSettings,
            config: await obj.serializeState(this._config.formatSettings)
        }
    }

    /**
     * @return {Promise<IMaestroConfig>}
     */
    private async buildConfigObj(): Promise<IMaestroConfig> {
        const emitterConfigurations: IEmitterConfig[] = 
            (await Promise.all(Array.from(this._emitters.values()).map(this.createConfig.bind(this)))) as IEmitterConfig[];
        const chroniclerConfigurations: IChroniclerConfig[] = 
            (await Promise.all(Array.from(this._chroniclers.values()).map(this.createConfig.bind(this)))) as IChroniclerConfig[];

        return {
            factories: this._config.factories,
            emitters: emitterConfigurations,
            connections: [],
            chroniclers: chroniclerConfigurations,
            formatSettings: this._config.formatSettings,
            id: this.id,
            name: this.name,
            description: this.description
        }
    }

    /**
     * 
     */
    async save(): Promise<void> {     
        if(this._configFilePath) {
            const jsonString: string = JSON.stringify(await this.buildConfigObj());
            await fsProm.mkdir(path.parse(this._configFilePath).dir, {
                recursive: true
            });
            await fsProm.writeFile(this._configFilePath, jsonString, {
                encoding: 'utf-8',
                flag: 'w+'
            });
        } else if(this._saveHandler) {
            await this._saveHandler(await this.buildConfigObj());
        } else {
            return Promise.reject(new Error("No config file path or save handler provided"));
        }
    }

    /**
     * 
     * @param {IDataEmitter|IEmitterDescription}  emitter
     * @return {Promise<void>} 
     */
    async addEmitter(emitter: IDataEmitter|IEmitterDescription): Promise<void> {
        const key = emitter.id.toLowerCase();
        const isEmitter = hasMethod(emitter, 'dispose');

        this.log(LogLevel.INFO, `Adding emitter ${key}`);
        if(this._emitters.has(key)){
            this.log(LogLevel.WARN, `Replacing ${key} in emitter map `);
            if(this._disposeOnRemove) {
                const e = this._emitters.get(key);
                if(isDisposable(e)) {
                    (e as unknown as IDisposable).dispose();
                } 
                if(isDisposableAsync(e)) {
                    await (e as unknown as IDisposableAsync).disposeAsync();
                }
            }
        }
        this._emitters.set(key, isEmitter ? emitter as IDataEmitter : await ProviderSingleton.getInstance().buildEmitter(emitter as IEmitterDescription));
    }

    /**
     * 
     * @param {IClassifier|string} obj 
     * @return {string}
     */
    private getKey(obj: IClassifier|string) : string {
        return typeof obj == 'string' ? obj.toLowerCase() : obj.id.toLowerCase();
    }

    /**
     * 
     * @param {IDataEmitter|string} emitter
     * @return {Promise<void>} 
     */
    removeEmitter(emitter: IDataEmitter|string): Promise<void> {
        const key = this.getKey(emitter);
        if(this._emitters.has(key)) { 
            if(this._disposeOnRemove) {
                (this._emitters.get(key) as unknown as IDisposable).dispose();
            }
            this._emitters.delete(key);
        }
        return Promise.resolve();
    }

    /**
     * 
     * @param {IChronicler|IChroniclerDescription} chronicler 
     */
    async addChronicler(chronicler: IChronicler|IChroniclerDescription): Promise<void> {
        const key = chronicler.id.toLowerCase();
        this.log(LogLevel.INFO, `Adding chronicler ${key}`);
        if(this._chroniclers.has(key)){
            this.log(LogLevel.WARN, `Replacing ${key} in chronicler map `);
            if(this._disposeOnRemove) {
                this._chroniclers.get(key)?.dispose();
            }
        }
        const isChronicler = hasMethod(chronicler, 'dispose');
        this._chroniclers.set(key, isChronicler ? chronicler as IChronicler : await ProviderSingleton.getInstance().buildChronicler(chronicler as IChroniclerDescription));    
    }


    /**
     * 
     * @param {IChronicler|string} chronicler
     * @return {Promise<void>}
     */
    async removeChronicler(chronicler: IChronicler|string): Promise<void> {
        const key = this.getKey(chronicler);
        if(this._chroniclers.has(key)) {
            if(this._disposeOnRemove) {
                await this.cleanUpIfDisposable(this._chroniclers.get(key));
            }
            this._chroniclers.delete(key);
        }
        return Promise.resolve();
    }
    


}
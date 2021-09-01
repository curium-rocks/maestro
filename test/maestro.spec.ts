import { describe, it} from 'mocha';
import { expect } from 'chai';
import {IChroniclerConfig, IMaestroConfig, IMeastroOptions, Maestro} from '../src/index';
import fs from 'fs/promises';
import path from 'path';
import { PingPongEmitter } from '@curium.rocks/ping-pong-emitter';
import { JsonChronicler } from '@curium.rocks/json-chronicler';
import {IChroniclerDescription, IDisposableAsync, IEmitterDescription, IMaestro, isDisposable, LoggerFacade, ProviderSingleton} from '@curium.rocks/data-emitter-base';
import winston from 'winston';


/**
 * 
 * @param {string} serviceName 
 * @return {LoggerFacade}
 */
function getLoggerFacade(serviceName: string): LoggerFacade {
    const logger = winston.createLogger({
        level: 'error',
        format: winston.format.json(),
        defaultMeta: { service: serviceName },
        transports: [
          new winston.transports.Console()
        ],
      });
    return {
        info: logger.info.bind(logger),
        debug: logger.debug.bind(logger),
        trace: logger.silly.bind(logger),
        warn: logger.warn.bind(logger),
        error: logger.error.bind(logger),
        critical: logger.error.bind(logger)
    }
}

const DEFAULT_CONFIG : IMaestroConfig = {
    id: 'test-id',
    name: 'test-name',
    description: 'test-description',
    formatSettings: {
        encrypted: false,
        type: 'N/A'
    },
    connections: [],
    factories: {
        emitter: [{
            factoryType: PingPongEmitter.TYPE,
            factoryPath: 'PingPongEmitterFactory',
            packageName: '@curium.rocks/ping-pong-emitter',
        }],
        chronicler: [{
            factoryType: JsonChronicler.TYPE,
            factoryPath: 'JsonChroniclerFactory',
            packageName: '@curium.rocks/json-chronicler'
        }]
    },
    emitters: [{
        config: {
            type: PingPongEmitter.TYPE,
            id: 'test-ping-pong-1',
            name: 'My Ping Pong Emitter 1',
            description: "A ping pong emitter for testing",
            emitterProperties: {
                interval: 250
            }
        }
    }],
    chroniclers: [{
        config: {
            type: JsonChronicler.TYPE,
            id: 'test-json-chronicler-1',
            name: 'My Chronicler 1',
            description: "A json chronicler for testing",
            chroniclerProperties: {
                logDirectory: './test-log-dir',
                logName: 'default-test',
                rotationSettings: {
                    seconds: 300
                }
            }
        }
    }]
}

const DEFAULT_OPTIONS: IMeastroOptions = {
    config: DEFAULT_CONFIG,
    logger: getLoggerFacade('default-opts'),
    loadHandler: () => {
        return Promise.resolve(DEFAULT_CONFIG);
    }
}

describe( 'Maestro', function() {
    // TODO: add checks on registration of factories, connections, inspect types of values of emitters and chroniclers
    describe( 'load()', function() {
        const configFile = './test-config/maestro-load-test.json';
        it( 'Should restore state from a json file', async function() {
            await fs.mkdir(path.parse(configFile).dir, {
                recursive: true
            })
            await fs.writeFile(configFile, JSON.stringify(DEFAULT_CONFIG),{
                flag: 'w+'
            });
            let maestro:IMaestro|undefined;
            try { 
                maestro = new Maestro({
                    config: configFile,
                    logger: getLoggerFacade('restore-json')
                });
                await maestro.load();
                expect(Array.from(maestro.emitters).length).to.be.eq(DEFAULT_CONFIG.emitters.length);
                expect(Array.from(maestro.chroniclers).length).to.be.eq(DEFAULT_CONFIG.chroniclers.length);
                expect(maestro.id).to.be.eq(DEFAULT_CONFIG.id);
                expect(maestro.name).to.be.eq(DEFAULT_CONFIG.name);
                expect(maestro.description).to.be.eq(DEFAULT_CONFIG.description);
            } finally {
                if (maestro != null) await (maestro as unknown as IDisposableAsync).disposeAsync();
            }
        });
        it( 'Should restore from a handler', async function() {
            let maestro: IMaestro|undefined;
            try {
                maestro = new Maestro({
                    config: DEFAULT_CONFIG,
                    logger: getLoggerFacade('restore-handler'),
                    loadHandler: () : Promise<IMaestroConfig> => {
                        return Promise.resolve({
                            formatSettings: DEFAULT_CONFIG.formatSettings,
                            id: 'new-id',
                            description: 'new-description',
                            name: 'new-name',
                            connections: [],
                            chroniclers: [],
                            emitters: [],
                            factories: {
                                emitter: [],
                                chronicler: []
                            }
                        });
                    }
                });
                await maestro.load();
                expect(maestro.description).to.be.eq('new-description');
                expect(maestro.id).to.be.eq('new-id');
                expect(maestro.name).to.be.eq('new-name');
            } finally {
                if (maestro != null) await (maestro as unknown as IDisposableAsync).disposeAsync();
            }
        });
    });
    describe( 'save()', function() {
        it( 'Should save state to a json file', async function() {
            const configFile = './test-config/maestro-save-test.json';
            let maestro: IMaestro|undefined;
            try {
                maestro = new Maestro({
                    config: configFile,
                    logger: getLoggerFacade('save-json')
                });

                // mutate configuration to verify save

                await maestro.save();

                // load the config file
                const jsonStr = await fs.readFile(configFile, {
                    encoding: 'utf-8'
                });
                const savedConfig: IMaestroConfig = JSON.parse(jsonStr);
                expect(savedConfig.id).to.be.eq(maestro.id);
                expect(savedConfig.name).to.be.eq(maestro.name);
                expect(savedConfig.description).to.be.eq(maestro.description);
                expect(savedConfig.chroniclers.length).to.be.eq(Array.from(maestro.chroniclers).length);
                expect(savedConfig.emitters.length).to.be.eq(Array.from(maestro.emitters).length);
            } finally {
                if (maestro != null) await (maestro as unknown as IDisposableAsync).disposeAsync();
            }
        });
        it ('Should save state to a handler', async function() {
            let savedMaestroConfig:IMaestroConfig|undefined;
            let maestro: IMaestro|undefined;
            try {
                maestro  = new Maestro({
                    config: DEFAULT_CONFIG,
                    saveHandler: (config:IMaestroConfig) : Promise<void> => {
                        savedMaestroConfig = config;
                        return Promise.resolve();
                    },
                    logger: getLoggerFacade('save-handler')
                });

                // mutate configuration to verify save

                await maestro.save();
                expect(savedMaestroConfig).to.not.be.null.and.not.to.be.undefined;
                expect(savedMaestroConfig?.id).to.be.eq(maestro.id);
                expect(savedMaestroConfig?.name).to.be.eq(maestro.name);
                expect(savedMaestroConfig?.description).to.be.eq(maestro.description);
                expect(savedMaestroConfig?.chroniclers.length).to.be.eq(Array.from(maestro.chroniclers).length);
                expect(savedMaestroConfig?.emitters.length).to.be.eq(Array.from(maestro.emitters).length);
            } finally {
                if(maestro != null) await (maestro as unknown as IDisposableAsync).disposeAsync();
            }
        });
    });
    describe( 'start()', function() {
        it( 'Should start all emitters and timers', async function() {
            const maestro: IMaestro = new Maestro(DEFAULT_OPTIONS);
            await maestro.start();
            await maestro.disposeAsync();
        });
    });
    describe( 'stop()', function() {
        it( 'Should stop all emitters and timers', async function() {
            const maestro: IMaestro = new Maestro(DEFAULT_OPTIONS);
            await maestro.stop();
            await maestro.disposeAsync();
        });
    });
    describe( 'addEmitter()', function() {
        it( 'Should add a emitter to the set of managed emitters', async function() {
            const maestro: IMaestro = new Maestro(DEFAULT_OPTIONS);
            await maestro.addEmitter(DEFAULT_CONFIG.emitters[0].config as IEmitterDescription);
            await maestro.disposeAsync();
        });
    });
    describe( 'removeEmitter()', function() {
        it( 'Should remove a emitter from the set of managed emitters', async function() {
            const maestro: IMaestro = new Maestro(DEFAULT_OPTIONS);
            await maestro.addEmitter(DEFAULT_CONFIG.emitters[0].config as IEmitterDescription);
            await maestro.removeEmitter((DEFAULT_CONFIG.emitters[0].config as IEmitterDescription).id);
            await maestro.disposeAsync();        
        });
    });
    describe( 'addChronciler()', function() {
        it( 'Should add a chronicler to the set of managed chroniclers', async function() {
            const maestro: IMaestro = new Maestro(DEFAULT_OPTIONS);
            await maestro.addChronicler(DEFAULT_CONFIG.chroniclers[0].config as IChroniclerDescription);
            await maestro.disposeAsync();        
        });
    });
    describe( 'removeChronicler()', function() {
        it( 'Should remove a chronciler from the set of managed chroncilers', async function() {
            const maestro: IMaestro = new Maestro(DEFAULT_OPTIONS);
            await maestro.addChronicler(DEFAULT_CONFIG.chroniclers[0].config as IChroniclerDescription);
            await maestro.removeChronicler((DEFAULT_CONFIG.chroniclers[0].config as IChroniclerDescription).id);
            await maestro.disposeAsync();        
        });
    });
    describe('connect()', function() {
        it( 'Should connect a single emitter to a single chronicler', async function() {
            const maestro: IMaestro = new Maestro(DEFAULT_OPTIONS);
            await maestro.addChronicler(DEFAULT_CONFIG.chroniclers[0].config as IChroniclerDescription);
            await maestro.addEmitter(DEFAULT_CONFIG.emitters[0].config as IEmitterDescription);
            for(const emit of maestro.emitters) {
                for(const chron of maestro.chroniclers) {
                    maestro.connect(emit, chron);
                }
            }
            await maestro.disposeAsync();     
        });
        it( 'Should connect multiple emitters to a single chronicler', async function() {
            const maestro: IMaestro = new Maestro(DEFAULT_OPTIONS);
            await maestro.load();
            const dupEmitters = Array.from(maestro.emitters).concat(Array.from(maestro.emitters));
            const dupChroniclers = Array.from(maestro.chroniclers).concat(Array.from(maestro.chroniclers));
            maestro.connect(dupEmitters, dupChroniclers);
            await maestro.disposeAsync();  
        });
        it( 'Should connect multiple emitters to multiple chroniclers', async function() {
            const maestro: IMaestro = new Maestro(DEFAULT_OPTIONS);
            await maestro.load();
            const dupEmitters = Array.from(maestro.emitters).concat(Array.from(maestro.emitters));
            maestro.connect(dupEmitters, Array.from(maestro.chroniclers)[0]);
            await maestro.disposeAsync();  
        });
    })
});
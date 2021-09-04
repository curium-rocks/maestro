import { describe, it} from 'mocha';
import { expect } from 'chai';
import { IMaestroConfig, IMaestroOptions, Maestro} from '../src/index';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PingPongEmitter } from '@curium.rocks/ping-pong-emitter';
import { JsonChronicler } from '@curium.rocks/json-chronicler';
import {IChroniclerDescription, IDisposableAsync, IEmitterDescription, IMaestro, LoggerFacade} from '@curium.rocks/data-emitter-base';
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

/**
 * @param {string|undefined} logDir
 * @param {string|undefined} logName
 * @return {IMaestroConfig}
 */
function getDefaultConfig(logDir?: string, logName?: string): IMaestroConfig {
    return {
        id: 'test-id',
        name: 'test-name',
        description: 'test-description',
        formatSettings: {
            encrypted: false,
            type: 'N/A'
        },
        connections: [{
            emitters: [
                'test-ping-pong-1'
            ],
            chroniclers: [
                'test-json-chronicler-1'
            ]
        }],
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
                    logDirectory: logDir || './test-log-dir',
                    logName: logName || 'default-test',
                    rotationSettings: {
                        seconds: 300
                    }
                }
            }
        }]
    }
}

/**
 * @param {string|undefined} logDir
 * @param {string|undefined} logName
 * @return {IMaestroOptions}
 */
function getDefaultOptions(logDir?:string, logName?:string) : IMaestroOptions {
    return {
        config: getDefaultConfig(logDir, logName),
        logger: getLoggerFacade('default-opts'),
        loadHandler: () => {
            return Promise.resolve(getDefaultConfig());
        }
    }
}


/**
 * 
 * @param {number} ms
 * @return {Promise<void>}
 */
function sleep(ms: number) : Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

describe( 'Maestro', function() {
    describe( 'load()', function() {
        const configFile = './test-config/maestro-load-test.json';
        it( 'Should restore state from a json file', async function() {
            const config = getDefaultConfig();
            await fs.mkdir(path.parse(configFile).dir, {
                recursive: true
            })
            await fs.writeFile(configFile, JSON.stringify(getDefaultConfig()),{
                flag: 'w+'
            });
            let maestro:IMaestro|undefined;
            try { 
                maestro = new Maestro({
                    config: configFile,
                    logger: getLoggerFacade('restore-json')
                });
                await maestro.load();
                expect(Array.from(maestro.emitters).length).to.be.eq(config.emitters.length);
                expect(Array.from(maestro.chroniclers).length).to.be.eq(config.chroniclers.length);
                expect(maestro.id).to.be.eq(config.id);
                expect(maestro.name).to.be.eq(config.name);
                expect(maestro.description).to.be.eq(config.description);
            } finally {
                if (maestro != null) await (maestro as unknown as IDisposableAsync).disposeAsync();
            }
        });
        it( 'Should restore from a handler', async function() {
            let maestro: IMaestro|undefined;
            const config = getDefaultConfig();

            try {
                maestro = new Maestro({
                    config: config,
                    logger: getLoggerFacade('restore-handler'),
                    loadHandler: () : Promise<IMaestroConfig> => {
                        return Promise.resolve({
                            formatSettings: config.formatSettings,
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
                await maestro.addEmitter(getDefaultConfig().emitters[0].config as IEmitterDescription);
                await maestro.addChronicler(getDefaultConfig().chroniclers[0].config as IChroniclerDescription);
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
            const mConfig = getDefaultConfig();
            try {
                maestro  = new Maestro({
                    config: mConfig,
                    saveHandler: (config:IMaestroConfig) : Promise<void> => {
                        savedMaestroConfig = config;
                        return Promise.resolve();
                    },
                    logger: getLoggerFacade('save-handler')
                });

                // mutate configuration to verify save
                await maestro.addEmitter(getDefaultConfig().emitters[0].config as IEmitterDescription);
                await maestro.addChronicler(getDefaultConfig().chroniclers[0].config as IChroniclerDescription);

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
            const mOptions = getDefaultOptions();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.start();

            const sourceIdsRecvFrom : Set<string> = new Set<string>();

            // expect data from emitters within 1 second
            for(const emit of maestro.emitters) {
                emit.onData(evt => {
                    sourceIdsRecvFrom.add(evt.emitter.id);
                })
            }

            await sleep(1500);
            const emitterIds = Array.from(maestro.emitters).map( e => e.id);
            expect(Array.from(sourceIdsRecvFrom)).to.include.members(emitterIds);

            await maestro.disposeAsync();
        });
    });
    describe( 'stop()', function() {
        it( 'Should stop all emitters and timers', async function() {
            const mOptions = getDefaultOptions();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.start();
            await maestro.stop();
            await sleep(100);
            const sourceIdsRecvFrom : Set<string> = new Set<string>();

            // expect data from emitters within 1 second
            for(const emit of maestro.emitters) {
                emit.onData(evt => {
                    sourceIdsRecvFrom.add(evt.emitter.id);
                })
            }
            await sleep(1250);
            expect(sourceIdsRecvFrom.size).to.eq(0);
            await maestro.disposeAsync();
        });
    });
    describe( 'addEmitter()', function() {
        it( 'Should add a emitter to the set of managed emitters', async function() {
            const mOptions = getDefaultOptions();
            const mConfig = getDefaultConfig();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.load();
            (mConfig.emitters[0].config as IEmitterDescription).id = 'new-emitter-1234';
            await maestro.addEmitter(mConfig.emitters[0].config as IEmitterDescription);
            expect(Array.from(maestro.emitters).filter(e => e.id == 'new-emitter-1234').length).to.be.greaterThan(0);
            expect(Array.from(maestro.emitters).length).to.be.eq(2)
            await maestro.disposeAsync();
        });
        it( 'Should clean up on overwrite', async function() {
            const mOptions = getDefaultOptions();
            const mConfig = getDefaultConfig();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.addEmitter(mConfig.emitters[0].config as IEmitterDescription);
            await maestro.addEmitter(mConfig.emitters[0].config as IEmitterDescription);
            expect(Array.from(maestro.emitters).length).to.be.eq(1);
            // this will hang if timer isn't cleaned up
            await maestro.disposeAsync(); 
        });
    });
    describe( 'removeEmitter()', function() {
        it( 'Should remove a emitter from the set of managed emitters', async function() {
            const mOptions = getDefaultOptions();
            const mConfig = getDefaultConfig();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.start();
            // create a new emitter id 
            const emitterDescription = mConfig.emitters[0].config as IEmitterDescription;
            emitterDescription.id = 'test-test-test';

            await maestro.addEmitter(emitterDescription);
            expect(Array.from(maestro.emitters).length).to.be.eq(2);
            await maestro.removeEmitter(emitterDescription.id);
            expect(Array.from(maestro.emitters).length).to.be.eq(1);
            await maestro.disposeAsync();        
        });
    });
    describe( 'addChronciler()', function() {
        it( 'Should add a chronicler to the set of managed chroniclers', async function() {
            const mOptions = getDefaultOptions();
            const mConfig = getDefaultConfig();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.start();            

            // create a new emitter id 
            const newChronDesc = mConfig.chroniclers[0].config as IChroniclerDescription;
            newChronDesc.id = 'test-test-test';

            await maestro.addChronicler(newChronDesc);
            expect(Array.from(maestro.chroniclers).length).to.eq(2);
            await maestro.removeChronicler(newChronDesc.id);
            expect(Array.from(maestro.chroniclers).length).to.eq(1);
            await maestro.disposeAsync();        
        });
        it( 'Should cleanup resources on overwites ', async function() {
            const mOptions = getDefaultOptions();
            const mConfig = getDefaultConfig();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.start();
            await maestro.addChronicler(mConfig.chroniclers[0].config as IChroniclerDescription);
            await maestro.addChronicler(mConfig.chroniclers[0].config as IChroniclerDescription);
            expect(Array.from(maestro.chroniclers).length).to.eq(1);
            await maestro.disposeAsync(); 
        });
    });
    describe( 'removeChronicler()', function() {
        it( 'Should remove a chronciler from the set of managed chroncilers', async function() {
            const mOptions = getDefaultOptions();
            const mConfig = getDefaultConfig();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.start();
            await maestro.removeChronicler((mConfig.chroniclers[0].config as IChroniclerDescription).id);
            expect(Array.from(maestro.chroniclers).length).to.eq(0);
            await maestro.disposeAsync();        
        });
    });
    describe('connect()', function() {
        it( 'Should connect a single emitter to a single chronicler', async function() {
            const mOptions = getDefaultOptions();
            const mConfig = getDefaultConfig();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.start();
            await maestro.addChronicler(mConfig.chroniclers[0].config as IChroniclerDescription);
            await maestro.addEmitter(mConfig.emitters[0].config as IEmitterDescription);
            for(const emit of maestro.emitters) {
                for(const chron of maestro.chroniclers) {
                    maestro.connect(emit, chron);
                }
            }
            await maestro.disposeAsync();     
        });
        it( 'Should connect multiple emitters to a single chronicler', async function() {
            const mOptions = getDefaultOptions();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.start();
            const dupEmitters = Array.from(maestro.emitters).concat(Array.from(maestro.emitters));
            const dupChroniclers = Array.from(maestro.chroniclers).concat(Array.from(maestro.chroniclers));
            maestro.connect(dupEmitters, dupChroniclers);
            await maestro.disposeAsync();  
        });
        it( 'Should connect multiple emitters to multiple chroniclers', async function() {
            const mOptions = getDefaultOptions();
            const maestro = new Maestro(mOptions);
            await maestro.start();
            const dupEmitters = Array.from(maestro.emitters).concat(Array.from(maestro.emitters));
            maestro.connect(dupEmitters, Array.from(maestro.chroniclers)[0]);
            await maestro.disposeAsync();  
        });
        it( 'Shoud connect a single emitter to multiple chroniclers', async function() {
            const mOptions = getDefaultOptions();
            const maestro: IMaestro = new Maestro(mOptions);
            await maestro.start();
            const dupChroniclers = Array.from(maestro.chroniclers).concat(Array.from(maestro.chroniclers));
            maestro.connect(Array.from(maestro.emitters)[0], dupChroniclers);
            await maestro.disposeAsync();  
        })
    });
    describe('behavior', function() {
        // eslint-disable-next-line no-invalid-this
        this.timeout(10000);
        it('Should record emitter data to a json file', async function() {
            // setup a meastro with a polling emitter and json chronciler (default)
            const logName = `record-test-${crypto.randomUUID()}`;
            const options = getDefaultOptions('./test-log-dir/behavior-test', logName);
            options.loadHandler = () => {
                return Promise.resolve(getDefaultConfig('./test-log-dir/behavior-test', logName))
            }
            const maestro:IMaestro = new Maestro(options);
            
            // start
            await maestro.start();
            await sleep(7500);
            await maestro.disposeAsync();
            await sleep(250);

            // check the log files and assert
            const files = (await fs.readdir('./test-log-dir/behavior-test')).filter(fn => fn.startsWith(logName));
            expect(files.length).to.eq(1);

            const data : unknown[] = JSON.parse(await fs.readFile(`./test-log-dir/behavior-test/${files[0]}`, {
                encoding: 'utf-8'
            }));
            expect((data.length)).to.be.greaterThan(0);

        })
    });
});
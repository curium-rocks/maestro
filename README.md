# Meastro
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=curium-rocks_maestro&metric=alert_status)](https://sonarcloud.io/dashboard?id=curium-rocks_maestro) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=curium-rocks_maestro&metric=coverage)](https://sonarcloud.io/dashboard?id=curium-rocks_maestro) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=curium-rocks_maestro&metric=security_rating)](https://sonarcloud.io/dashboard?id=curium-rocks_maestro) ![npm](https://img.shields.io/npm/v/@curium.rocks/maestro)

Manager of emitters and chroniclers. Intended to run as a service and house multiple emitters. 

## How to install
`npm install --save @curium.rocks/maestro`
## How to use
### Create your configuration
The below example shows a full configuration, load, and save handlers can be provided to dynamically 
fetch the latest config on save/load calls.
``` typescript
/***
 * Create a logger facade wrapper winston
 * @param {string} serviceName 
 * @return {LoggerFacade}
 */
function getLoggerFacade(serviceName: string): LoggerFacade {
    const logger = winston.createLogger({
        level: 'info',
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
 * Get the configuraiton obj, in this case it's mostly static for demo purposes,
 * but this could fetch from a file, fill properties in from a DB etc.
 * @param {string} logDir log directory for json chronicler
 * @param {string} logName log name for json chronicler
 * @return {IMaestroConfig} 
 */
function getConfig(logDir?: string, logName?: string) : IMaestroConfig {
    return {
        id: 'meastro-id',
        name: 'meastro-name',
        description: 'meastro description',
        formatSettings: {
            encrypted: false,
            type: 'N/A'
        },
        connections: [{
            emitters: [
                'ping-pong-1'
            ],
            chroniclers: [
                'json-chronicler-1'
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
                id: 'ping-pong-1',
                name: 'My Ping Pong Emitter 1',
                description: "A ping pong emitter",
                emitterProperties: {
                    interval: 250
                }
            }
        }],
        chroniclers: [{
            config: {
                type: JsonChronicler.TYPE,
                id: 'json-chronicler-1',
                name: 'Chronicler 1',
                description: "A json chronicler",
                chroniclerProperties: {
                    logDirectory: logDir || './logs',
                    logName: logName || 'maestro',
                    rotationSettings: {
                        seconds: 300
                    }
                }
            }
        }]
    }
}

const maestroOptions = {
    config: getConfig(),
    logger: getLoggerFacade('maestro'),
    loadHandler: () => {
        return Promise.resolve(getConfig());
    }
}
```

### Create the maestro
Once you have your configuration, you can create the maestro: 
``` typescript
const maestro = new Maestro(maestroOptions);
```

### Start the maestro
The meastro doesn't start automatically and you must call start, this refreshes it's configuration and 
starts any emitters as well.

``` typescript
await maestro.start();
```

### Stop and cleanup on SIG INT
You can add a hook to clean up gracefully on `SIG INT` like so:

``` typescript
process.on('SIGINT', async () =>  {
    await maestro.disposeAsync();
})
```

### Complete Example

``` typescript
import { IMaestro, LoggerFacade, ProviderSingleton } from "@curium.rocks/data-emitter-base";
import { JsonChronicler } from "@curium.rocks/json-chronicler";
import { PingPongEmitter } from "@curium.rocks/ping-pong-emitter";
import { IMaestroConfig, Maestro } from "@curium.rocks/maestro";
import winston from "winston";

/**
 * Create a logger facade wrapper winston
 * @param {string} serviceName 
 * @return {LoggerFacade}
 */
function getLoggerFacade(serviceName: string): LoggerFacade {
    const logger = winston.createLogger({
        level: 'info',
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
 * Get the configuraiton obj, in this case it's mostly static for demo purposes,
 * but this could fetch from a file, fill properties in from a DB etc.
 * @param {string} logDir log directory for json chronicler
 * @param {string} logName log name for json chronicler
 * @return {IMaestroConfig} 
 */
function getConfig(logDir?: string, logName?: string) : IMaestroConfig {
    return {
        id: 'meastro-id',
        name: 'meastro-name',
        description: 'meastro description',
        formatSettings: {
            encrypted: false,
            type: 'N/A'
        },
        connections: [{
            emitters: [
                'ping-pong-1'
            ],
            chroniclers: [
                'json-chronicler-1'
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
                id: 'ping-pong-1',
                name: 'My Ping Pong Emitter 1',
                description: "A ping pong emitter",
                emitterProperties: {
                    interval: 250
                }
            }
        }],
        chroniclers: [{
            config: {
                type: JsonChronicler.TYPE,
                id: 'json-chronicler-1',
                name: 'Chronicler 1',
                description: "A json chronicler",
                chroniclerProperties: {
                    logDirectory: logDir || './logs',
                    logName: logName || 'maestro',
                    rotationSettings: {
                        seconds: 300
                    }
                }
            }
        }]
    }
}

const maestroOptions = {
    config: getConfig(),
    logger: getLoggerFacade('maestro'),
    loadHandler: () => {
        return Promise.resolve(getConfig());
    }
}
ProviderSingleton.getInstance().setLoggerFacade(maestroOptions.logger);
const maestro:IMaestro = new Maestro(maestroOptions);
maestro.start();

process.on('SIGINT', async () => {
    await maestro.disposeAsync();
});
```

## Docs
For more information generate the docs using `npm run doc`, documentation for each version is also attached as an artifact of the build in CI.
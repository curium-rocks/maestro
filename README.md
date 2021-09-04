# Meastro
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=curium-rocks_maestro&metric=alert_status)](https://sonarcloud.io/dashboard?id=curium-rocks_maestro) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=curium-rocks_maestro&metric=coverage)](https://sonarcloud.io/dashboard?id=curium-rocks_maestro) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=curium-rocks_maestro&metric=security_rating)](https://sonarcloud.io/dashboard?id=curium-rocks_maestro) ![npm](https://img.shields.io/npm/v/@curium.rocks/maestro)

Manager of emitters and chroniclers. Intended to run as a service and house multiple emitters. 

## How to install
`npm install --save @curium.rocks/maestro`
## How to use
### Create your configuration
The bare minimum configuration required for the maestro looks like this:
``` typescript
```

However, you can also setup emitter and chroniclers to start with like so:
``` typescript
```

### Create the maestro
Once you have your configuration, you can create the maestro: 
``` typescript
```

### Start the maestro
The meastro doesn't start automatically and you must call start, this refreshes it's configuration and 
starts any emitters as well.

``` typescript
```

### Stop on SIG INT
You can add a hook to clean up gracefully on `SIG INT` like so:

``` typescript
```

### Complete Example

``` typescript
```
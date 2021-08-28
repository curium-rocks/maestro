import { describe, it} from 'mocha';
import { expect } from 'chai';
import {IMaestroConfig, IMeastroOptions, Maestro} from '../src/index';

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
        emitter: [],
        chronicler: []
    },
    emitters: [],
    chroniclers: []
}

const DEFAULT_OPTIONS: IMeastroOptions = {
    config: DEFAULT_CONFIG,
    loadHandler: () => {
        return Promise.resolve(DEFAULT_CONFIG);
    }
}

describe( 'Maestro', function() {
    describe( 'load()', function() {
        it( 'Should restore state from a json file', async function() {
            expect(false).to.be.true;
        });
        it( 'Should restore from a handler', async function() {
            expect(false).to.be.true;
        });
    });
    describe( 'save()', function() {
        it( 'Should save state to a json file', function() {
            expect(false).to.be.true;
        });
        it ('Should save state to a handler', function() {
            expect(false).to.be.true;
        });
    });
    describe( 'start()', function() {
        it( 'Should start all emitters and timers', function() {
            expect(false).to.be.true;
        });
    });
    describe( 'stop()', function() {
        it( 'Should stop all emitters and timers', function() {
            expect(false).to.be.true;
        });
    });
    describe( 'addEmitter()', function() {
        it( 'Should add a emitter to the set of managed emitters', function() {
            expect(false).to.be.true;
        });
    });
    describe( 'removeEmitter()', function() {
        it( 'Should remove a emitter from the set of managed emitters', function() {
            expect(false).to.be.true;
        });
    });
    describe( 'addChronciler()', function() {
        it( 'Should add a chronicler to the set of managed chroniclers', function() {
            expect(false).to.be.true;
        });
    });
    describe( 'removeChronicler()', function() {
        it( 'Should remove a chronciler from the set of managed chroncilers', function() {
            expect(false).to.be.true;
        });
    });
    describe('connect()', function() {
        it( 'Should connect a set of emitters to a set of chroncilers', function () {
            expect(false).to.be.true;

        });
        it( 'Should connect a single emitter to a single chronicler', function() {
            expect(false).to.be.true;

        });
        it( 'Should return a disposable object to disconnect the link', function() {
            expect(false).to.be.true;
        });
    })
});
import { IChroniclerDescription, IClassifier, IFormatSettings } from "@curium.rocks/data-emitter-base/build/src/dataEmitter";
import { IEmitterDescription } from "@curium.rocks/data-emitter-base";

export interface IConnection {
    emitters: string[];
    chroniclers: string[];
}

export interface IEmitterConfig {
    config: string | IEmitterDescription;
    formatSettings?: IFormatSettings;
}

export interface IChroniclerConfig {
    config: string | IChroniclerDescription;
    formatSettings?: IFormatSettings;
}
export interface IFactoryConfig {
    packageName: string;
    factoryPath: string;
    factoryType: string;
}
export interface IFactoryMap {
    emitter: IFactoryConfig[];
    chronicler: IFactoryConfig[];
}
export interface IMaestroConfig extends IClassifier {
    factories: IFactoryMap;
    emitters: IEmitterConfig[];
    chroniclers: IChroniclerConfig[];
    connections: IConnection[];
    formatSettings: IFormatSettings;
}
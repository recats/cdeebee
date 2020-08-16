import { cdeebeActiveRequest, cdeebeeEntityState, cdeebeeValueList, IDefaultNormalize, IEntity } from './definition';
export declare const dropRequestFromArray: (activeRequest: cdeebeActiveRequest[]) => cdeebeActiveRequest[];
export declare const requestCancel: (request: cdeebeActiveRequest) => void;
export declare const checkNetworkActivity: (activeRequest: cdeebeActiveRequest[], apiUrl: string | string[]) => boolean;
export declare const getSubEntity: <T>(entity: T & IEntity) => (T & IEntity) | {
    __state: cdeebeeEntityState;
};
export declare const getEntityState: <T>(entity: T & IEntity) => cdeebeeEntityState;
export declare const insertEntity: (entity: {
    __state: string;
}) => {
    __state: string;
};
export declare const commitEntity: <T>(entity: T & IEntity) => T;
export declare const resetEntity: <T>(entity: T & IEntity) => T;
export declare const editEntity: (store: IEntity & {
    [key: string]: any;
}, list: string, id: number | string) => IEntity & {
    [key: string]: any;
};
export declare const batchingUpdate: (state: object, valueList: cdeebeeValueList[], prePath?: (string | number)[] | undefined) => object;
export declare const defaultNormalize: (d: IDefaultNormalize) => object;

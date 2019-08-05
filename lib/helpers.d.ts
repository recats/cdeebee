import { cdeebeeEntityState, cdeebeeValueList, IEntity, IDefaultNormolize, IActiveRequest } from './definition';
export declare const cancelationRequest: (activeRequest: IActiveRequest[]) => IActiveRequest[];
export declare const checkNetworkActivity: (activeRequest: IActiveRequest[], apiUrl: string | string[]) => boolean;
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
export declare const editEntity: (store: IEntity, list: string, id: string | number) => IEntity;
export declare const batchingUpdate: (state: object, valueList: cdeebeeValueList[], prePath?: (string | number)[] | undefined) => object;
export declare const defaultNormalize: (d: IDefaultNormolize) => object;

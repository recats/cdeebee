import { Dispatch } from 'redux';
import { cdeebeeTypes, cdeebeeValueList, EntityID } from './definition';
export declare function setKeyValue(entityList: string, entityID: EntityID, valueList: cdeebeeValueList[]): (dispatch: Dispatch<import("redux").AnyAction>) => void;
export declare function commitEntity(entityList: string, entityID: EntityID, entity: object): (dispatch: Dispatch<import("redux").AnyAction>) => void;
export declare function resetEntity(entityList: string, entityID: string | number): (dispatch: Dispatch<import("redux").AnyAction>) => void;
export declare function dropRequestByApiUrl(api: string): (dispatch: Dispatch<import("redux").AnyAction>) => {
    type: cdeebeeTypes;
    payload: {
        api: string;
    };
};
export declare function dropErrorsByApiUrl(api: string): (dispatch: Dispatch<import("redux").AnyAction>) => {
    type: cdeebeeTypes;
    payload: {
        api: string;
    };
};

import { Dispatch } from 'redux';
import { cdeebeeTypes, cdeebeeValueList, EntityID } from './definition';
export declare function unsafe_updateStore(entityList: string, entityID: EntityID, value: object): (dispatch: Dispatch) => void;
export declare function setKeyValue(entityList: string, entityID: EntityID, valueList: cdeebeeValueList[]): (dispatch: Dispatch) => void;
export declare function commitEntity(entityList: string, entityID: EntityID, entity: object): (dispatch: Dispatch) => void;
export declare function resetEntity(entityList: string, entityID: string | number): (dispatch: Dispatch) => void;
export declare function dropCdeebeePath(path: (string | number)[]): (dispatch: Dispatch) => {
    type: cdeebeeTypes;
    payload: {
        path: EntityID[];
    };
};
export declare function dropRequestByApiUrl(api: string): (dispatch: Dispatch) => {
    type: cdeebeeTypes;
    payload: {
        api: string;
    };
};
export declare function dropErrorsByApiUrl(api: string): (dispatch: Dispatch) => {
    type: cdeebeeTypes;
    payload: {
        api: string;
    };
};

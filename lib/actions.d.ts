import { Dispatch } from 'redux';
import { cdeebeeTypes, IValueList, EntityID } from './definition';
export declare function setKeyValue(entityList: string, entityID: EntityID, valueList: IValueList): (dispatch: Dispatch<import("redux").AnyAction>) => void;
export declare function commitEntity(entityList: string, entityID: EntityID, entity: object): (dispatch: Dispatch<import("redux").AnyAction>) => void;
export declare function resetEntity(entityList: string, entityID: string | number): (dispatch: Dispatch<import("redux").AnyAction>) => void;
export declare function dropRequestByApiUrl(api: string): (dispatch: Dispatch<import("redux").AnyAction>) => {
    type: cdeebeeTypes;
    payload: {
        api: string;
    };
};

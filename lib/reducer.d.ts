import { ICdeebee, IRequestAction, IRequestState } from './definition';
export declare const INITIAL_STORAGE: any;
export declare const cdeebee: (state: any, action: ICdeebee) => any;
export declare const requestManager: (state: IRequestState | undefined, action: IRequestAction) => {
    activeRequest: any[];
    requestByApiUrl: object;
    errorHandler: object;
} | {
    requestByApiUrl: unknown;
    activeRequest: object[];
    errorHandler: object;
};

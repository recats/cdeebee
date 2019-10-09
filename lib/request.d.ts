import { Dispatch } from 'redux';
import { IDefaultOption, IRequestOptions } from './definition';
export default class requestManager {
    requestObject: object;
    private options;
    constructor(requestObject: object, options: IDefaultOption);
    send: (rq: IRequestOptions) => (dispatch: Dispatch<import("redux").AnyAction>, getState: () => any) => Promise<void>;
}

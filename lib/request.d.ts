import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import { Dispatch } from 'redux';
import { IDefaultOption, IRequestOptions } from './definition';
export default class requestManager {
    requestObject: object;
    private options;
    constructor(requestObject: object, options: IDefaultOption);
    send: (rq: IRequestOptions) => (dispatch: Dispatch, getState: () => any) => Promise<void>;
}

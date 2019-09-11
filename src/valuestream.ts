import WebSocket from 'ws';
import * as dJSON from 'dirty-json';
import { QueueingSubject } from 'queueing-subject';
import { Subscription, Observable, merge, throwError } from 'rxjs';
import { StreamValue, ValueStreamConfig } from './interfaces';
import {
    share,
    switchMap,
    map,
    filter,
    catchError,
    retryWhen,
    delay,
    take,
    tap
} from 'rxjs/operators';
import makeWebSocketObservable, {
    normalClosureMessage,
    GetWebSocketResponses,
    WebSocketOptions
} from 'rxjs-websockets';

type WebSocketPayload = string | ArrayBuffer | Blob;

const RETRY_LIMIT = 5;
const RETRY_DELAY_MS = 500;
const VPCA_APP_NAME = 'VPCA';
const CHAT_APP_NAME = 'CHAT';

export default class ValueStream
{
    private debug:boolean = false;
    private config:ValueStreamConfig;

    private vpcaInput:QueueingSubject<string>;
    private chatInput:QueueingSubject<string>;

    public messages:Observable<string | StreamValue>;

    private options:WebSocketOptions = {
        makeWebSocket: (url: string, protocols?: string | string[]) => new WebSocket(url),
        protocols: [],
    };

    public constructor(config:ValueStreamConfig)
    {
        this.config = config;

        this.buildStream();
    }

    public setDebug(debug:boolean)
    {
        this.debug = debug;
    }

    private buildUrl(app_name:string)
    {
        return `ws://${this.config.ws_host}/${app_name}`;
    }

    private buildStream()
    {
        this.buildInputs();
        this.buildAndCombineStreams();
    }

    private buildAndCombineStreams()
    {
        const { vpca, chat } = this.buildObservables();

        // Define the retry strategy
        const retryPipeline = retryWhen(errors =>
            errors.pipe(
                delay(RETRY_DELAY_MS),
                take(RETRY_LIMIT),
                tap(error => console.log(error))
            )
        );

        // Create each of the message streams
        let vpca_messages:Observable<WebSocketPayload>;
        if (vpca && this.vpcaInput) {
            vpca_messages = vpca.pipe(
              switchMap((getResponses:GetWebSocketResponses) => getResponses(this.vpcaInput)),
              retryPipeline,
              share()
            );
        }

        let chat_messages:Observable<WebSocketPayload>;
        if (chat && this.chatInput) {
            chat_messages = chat.pipe(
              switchMap((getResponses:GetWebSocketResponses) => getResponses(this.chatInput)),
              retryPipeline,
              share()
            );
        }

        // Determine if we need to combine
        let all_messages;
        if (chat_messages && vpca_messages) {
            all_messages = merge(vpca_messages, chat_messages);
        } else if (!vpca_messages && chat_messages) {
            all_messages = chat_messages;
        } else if (vpca_messages && !chat_messages) {
            all_messages = vpca_messages;
        } else {
            throw new Error('Provide either vpca_group or chat_group');
        }

        // Map and parse
        this.messages = all_messages.pipe(
            map(val => this.parse(val)),
            filter(val => val != undefined),
            catchError(error => console.log('Error', error)),
            share()
        );
    }

    public setParameter(name:string|number, value:string|number)
    {
        const r = {
            WSP : {
                WSPID : name,
                WSPUnits : '1',
                WSPVal : String(value)
            }
        };

        // Parameters can only be set on VPCA
        this.vpcaInput.next(JSON.stringify(r));
    }

    private buildObservables()
    {
        let vpca = null;
        if (this.config.vpca_group) {
            vpca = makeWebSocketObservable(this.buildUrl(VPCA_APP_NAME), this.options);
        }
        let chat = null;
        if (this.config.chat_group) {
            chat = makeWebSocketObservable(this.buildUrl(CHAT_APP_NAME), this.options);
        }

        return {
            vpca,
            chat
        };
    }

    private buildInputs()
    {
        if (this.config.vpca_group) {
            this.vpcaInput = new QueueingSubject<string>();
            const vpcaRequest = this.buildGroupRequest(this.config.vpca_group);
            this.vpcaInput.next(JSON.stringify(vpcaRequest));
        }

        if (this.config.chat_group) {
            this.chatInput = new QueueingSubject<string>();
            const chatRequest = this.buildGroupRequest(this.config.chat_group);
            this.chatInput.next(JSON.stringify(chatRequest));
        }
    }

    private buildGroupRequest(group:string)
    {
        return {
            WPUSHG: {
                WPUSHGID: group,
                Maxrate: this.config.max_rate,
                Minrate: this.config.min_rate
            }
        };
    }

    private parse(data:any)
    {
        let parsed = this.parseRaw(data)
        // TODO handle GPS param support (subval)
        if (parsed && parsed['MGP']) {
            return {
                id: parsed['MGP']['MGPID'],
                label: parsed['MGP']['MGPLabel'],
                value: parsed['MGP']['ParamVal'],
                timestamp: parsed['MGP']['Timestamp']
            };
        }
    }

    private parseRaw(msg:any)
    {
        let parsed = null;
        try {
            if (typeof msg == 'string' && msg.trim() != '') {
                parsed = dJSON.parse(msg.trim());
            }
        } catch (e) {
            if (this.debug) {
                console.log('ValueStream.parseRaw -> error', e);
            }
        }

        return parsed;
    }
}

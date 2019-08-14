import WebSocket from "ws";
import { QueueingSubject } from "queueing-subject";
import { Subscription, merge, of, Observable } from "rxjs";
import { StreamValue, ValueStreamConfig } from './interfaces';
import { share, switchMap, map, filter, catchError } from "rxjs/operators";
import makeWebSocketObservable, {
    normalClosureMessage,
    GetWebSocketResponses,
    WebSocketOptions
} from "rxjs-websockets";

type WebSocketPayload = string | ArrayBuffer | Blob;

export default class ValueStream
{
    private config:ValueStreamConfig;

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

    private buildUrl(appName:string)
    {
        return `ws://${this.config.wsHost}/${appName}`;
    }

    private buildStream()
    {
        const inputs = this.buildInputs();
        const observables = this.buildObservables();

        this.buildAndCombineStreams(observables, inputs);
    }

    private buildAndCombineStreams(observables, inputs)
    {
        const { vpca, chat } = observables;
        const { vpcaInput, chatInput } = inputs;

        // Create each of the message streams
        const vpcaMessages:Observable<WebSocketPayload> = vpca.pipe(
          switchMap((getResponses:GetWebSocketResponses) => getResponses(vpcaInput)),
          share()
        );
        const chatMessages:Observable<WebSocketPayload> = chat.pipe(
          switchMap((getResponses:GetWebSocketResponses) => getResponses(chatInput)),
          share()
        );

        // Combine observables
        const allMessages = merge(vpcaMessages, chatMessages);

        // Map and parse
        this.messages = allMessages.pipe(
            map(val => this.parse(val)),
            filter(val => val != undefined),
            share()
        );
    }

    private buildObservables()
    {
        const vpca = makeWebSocketObservable(this.buildUrl('VPCA'), this.options);
        const chat = makeWebSocketObservable(this.buildUrl('CHAT'), this.options);

        return {
            vpca,
            chat
        }
    }

    private buildInputs()
    {
        const vpcaInput = new QueueingSubject<string>();
        const vpcaRequest = this.buildRequest(this.config.vpcaGroup);
        vpcaInput.next(JSON.stringify(vpcaRequest));

        const chatInput = new QueueingSubject<string>();
        const chatRequest = this.buildRequest(this.config.chatGroup);
        chatInput.next(JSON.stringify(chatRequest));

        return {
            vpcaInput,
            chatInput
        };
    }

    private buildRequest(group:string)
    {
        return {
            WPUSHG: {
                WPUSHGID: group,
                Maxrate: this.config.maxRate,
                Minrate: this.config.minRate
            }
        };
    }

    private parse(data:any)
    {
        let parsed = this.parseRaw(data)
        if (parsed && parsed["MGP"]) {
            return {
                id: parsed["MGP"]["MGPID"],
                label: parsed["MGP"]["MGPLabel"],
                value: parsed["MGP"]["ParamVal"],
                timestamp: parsed["MGP"]["Timestamp"]
            }
        }
    }

    private parseRaw(msg:any)
    {
        let parsed = null
        try {
            if (typeof msg == "string" && msg.trim() != "") {
                parsed = JSON.parse(msg.trim())
            }
        } catch (e) {}
        return parsed
    }
}

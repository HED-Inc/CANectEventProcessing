"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const queueing_subject_1 = require("queueing-subject");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const rxjs_websockets_1 = __importDefault(require("rxjs-websockets"));
class ValueStream {
    constructor(config) {
        this.options = {
            makeWebSocket: (url, protocols) => new ws_1.default(url),
            protocols: [],
        };
        this.config = config;
        this.buildStream();
    }
    buildUrl(appName) {
        return `ws://${this.config.wsHost}/${appName}`;
    }
    buildStream() {
        const inputs = this.buildInputs();
        const observables = this.buildObservables();
        this.buildAndCombineStreams(observables, inputs);
    }
    buildAndCombineStreams(observables, inputs) {
        const { vpca, chat } = observables;
        const { vpcaInput, chatInput } = inputs;
        // Create each of the message streams
        const vpcaMessages = vpca.pipe(operators_1.switchMap((getResponses) => getResponses(vpcaInput)), operators_1.share());
        const chatMessages = chat.pipe(operators_1.switchMap((getResponses) => getResponses(chatInput)), operators_1.share());
        // Combine observables
        const allMessages = rxjs_1.merge(vpcaMessages, chatMessages);
        // Map and parse
        this.messages = allMessages.pipe(operators_1.map(val => this.parse(val)), operators_1.filter(val => val != undefined), operators_1.share());
    }
    buildObservables() {
        const vpca = rxjs_websockets_1.default(this.buildUrl('VPCA'), this.options);
        const chat = rxjs_websockets_1.default(this.buildUrl('CHAT'), this.options);
        return {
            vpca,
            chat
        };
    }
    buildInputs() {
        const vpcaInput = new queueing_subject_1.QueueingSubject();
        const vpcaRequest = this.buildRequest(this.config.vpcaGroup);
        vpcaInput.next(JSON.stringify(vpcaRequest));
        const chatInput = new queueing_subject_1.QueueingSubject();
        const chatRequest = this.buildRequest(this.config.chatGroup);
        chatInput.next(JSON.stringify(chatRequest));
        return {
            vpcaInput,
            chatInput
        };
    }
    buildRequest(group) {
        return {
            WPUSHG: {
                WPUSHGID: group,
                Maxrate: this.config.maxRate,
                Minrate: this.config.minRate
            }
        };
    }
    parse(data) {
        let parsed = this.parseRaw(data);
        if (parsed && parsed["MGP"]) {
            return {
                id: parsed["MGP"]["MGPID"],
                label: parsed["MGP"]["MGPLabel"],
                value: parsed["MGP"]["ParamVal"],
                timestamp: parsed["MGP"]["Timestamp"]
            };
        }
    }
    parseRaw(msg) {
        let parsed = null;
        try {
            if (typeof msg == "string" && msg.trim() != "") {
                parsed = JSON.parse(msg.trim());
            }
        }
        catch (e) { }
        return parsed;
    }
}
exports.default = ValueStream;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const WebSocket = require("ws");
const rxjs_1 = require("rxjs");
const queueing_subject_1 = require("queueing-subject");
const operators_1 = require("rxjs/operators");
const rxjs_websockets_1 = __importDefault(require("rxjs-websockets"));
const CHAT_WS_URL = "ws://127.0.0.1/CHAT";
const VPCA_WS_URL = "ws://127.0.0.1/VPCA";
// Define how we create a Web Socket
const options = {
    makeWebSocket: (url, protocols) => new WebSocket(url, protocols),
    protocols: [],
};
// Create the requests that will be sent on open
const vpcaRequest = {
    WPUSHG: {
        WPUSHGID: "VPCA",
        Maxrate: 1000,
        Minrate: 2000
    }
};
const chatRequest = {
    WPUSHG: {
        WPUSHGID: "CHAT",
        Maxrate: 1000,
        Minrate: 2000
    }
};
const vpcaInput = new queueing_subject_1.QueueingSubject();
const chatInput = new queueing_subject_1.QueueingSubject();
vpcaInput.next(JSON.stringify(vpcaRequest));
chatInput.next(JSON.stringify(chatRequest));
// Create each of the Web Socket observables
const vpca = rxjs_websockets_1.default(VPCA_WS_URL, options);
const chat = rxjs_websockets_1.default(CHAT_WS_URL, options);
// Create each of the message streams
const vpcaMessages = vpca.pipe(operators_1.switchMap((getResponses) => getResponses(vpcaInput)), operators_1.share());
const chatMessages = chat.pipe(operators_1.switchMap((getResponses) => getResponses(chatInput)), operators_1.share());
// Combine observables
const allMessages = rxjs_1.merge(vpcaMessages, chatMessages);
// Raw parse function
const parseRaw = msg => {
    let parsed = null;
    try {
        if (typeof msg == "string" && msg.trim() != "") {
            parsed = JSON.parse(msg.trim());
        }
    }
    catch (e) { }
    return parsed;
};
// Parse function
const parse = data => {
    let parsed = parseRaw(data);
    if (parsed && parsed["MGP"]) {
        return {
            id: parsed["MGP"]["MGPID"],
            label: parsed["MGP"]["MGPLabel"],
            value: parsed["MGP"]["ParamVal"],
            timestamp: parsed["MGP"]["Timestamp"]
        };
    }
};
// Map and parse
const messages = allMessages.pipe(operators_1.map(val => parse(val)), operators_1.filter(val => val != undefined), operators_1.catchError(error => rxjs_1.of(`${error.message}`)));
console.log(messages);
exports.default = messages;

import WebSocket from "ws";
import { Subscription, merge, of, Observable } from "rxjs";
import { QueueingSubject } from "queueing-subject";
import { share, switchMap, map, filter, catchError } from "rxjs/operators";
import makeWebSocketObservable, { normalClosureMessage, GetWebSocketResponses, WebSocketOptions } from "rxjs-websockets";

const CHAT_WS_URL = "ws://10.1.1.1/CHAT";
const VPCA_WS_URL = "ws://10.1.1.1/VPCA";

type WebSocketPayload = string | ArrayBuffer | Blob;

// Define how we create a Web Socket
const options:WebSocketOptions = {
  makeWebSocket: (url: string, protocols?: string | string[]) => new WebSocket(url, protocols),
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
const vpcaInput = new QueueingSubject<string>();
const chatInput = new QueueingSubject<string>();

vpcaInput.next(JSON.stringify(vpcaRequest));
chatInput.next(JSON.stringify(chatRequest));

// Create each of the Web Socket observables
const vpca = makeWebSocketObservable(VPCA_WS_URL, options);
const chat = makeWebSocketObservable(CHAT_WS_URL, options);

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

// Raw parse function
const parseRaw = msg => {
  let parsed = null
  try {
    if (typeof msg == "string" && msg.trim() != "") {
      parsed = JSON.parse(msg.trim())
    }
  } catch (e) {}
  return parsed
}

// Parse function
const parse = data => {
  let parsed = parseRaw(data)
  if (parsed && parsed["MGP"]) {
    return {
      id: parsed["MGP"]["MGPID"],
      label: parsed["MGP"]["MGPLabel"],
      value: parsed["MGP"]["ParamVal"],
      timestamp: parsed["MGP"]["Timestamp"]
    }
  }
}

// Map and parse
const messages = allMessages.pipe(
  map(val => parse(val)),
  filter(val => val != undefined),
  catchError(error => of(`${error.message}`))
);

console.log(messages);

export default messages

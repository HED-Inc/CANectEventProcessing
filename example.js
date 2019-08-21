import { EventProcessor } from "./dist"

const events = [
	{
		name: "SHOCK_EVENT",
		params: ["Acc_mag"],
		async calculate(prev, [Acc_mag]) {
			return Acc_mag * 100
		},
		async shouldEmit(prev, curr, timeDiff) {
			return true
		}
	}
]

let streamConfig = {
	ws_host: "10.1.1.1",
	vpca_group: "Dashboard",
	chat_group: "All",
	max_rate: 500,
	min_rate: 1000
}

let ep = new EventProcessor(streamConfig, events)

ep.addEvent(newEvent)
let sub = ep.subscribe(e => {
	console.log("EVENT", e)
})

setTimeout(() => {
	ep.addEvent(newEvent)
}, 5000)

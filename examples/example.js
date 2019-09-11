let EventProcessor = require("../dist/index.js").default

const events = [
	{
		name: "CPU_USAGE",
		outputs: ["GPS_HEAD", "GPS_GS"],
		params: ["Cpu_usage"],
		async calculate(prev, [Acc_mag], [GPS_HEAD, GPS_GS]) {
			return Acc_mag
		},
		async shouldEmit(prev, curr, timeDiff) {
			return false
		}
	},
	{
		name: "GPS_HEAD",
		params: ["GPS_head"],
		async calculate(prev, [GPS_head]) {
			return GPS_head
		},
		async shouldEmit(prev, curr, timeDiff) {
			return false
		}
	}
]

let config = {
	ws_host: "10.1.1.1",
	vpca_group: "Event_Processing",
	chat_group: "Event_Processing",
	max_rate: 50,
	min_rate: 100
}

let ep = new EventProcessor(config, events)
ep.setDebug(true)

let sub = ep.subscribe(e => {
	console.log("EVENT", e)
})

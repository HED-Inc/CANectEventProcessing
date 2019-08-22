let EventProcessor = require("../dist/index.js")

const events = [
	{
		name: "CPU_USAGE",
		outputs: ["GPS_HEAD", "GPS_GS"],
		params: ["Cpu_usage"],
		async calculate(prev, [Acc_mag], [GPS_HEAD, GPS_GS]) {
			console.log("GPS_HEAD", GPS_HEAD)
			console.log("GPS_GS", GPS_GS)
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

let streamConfig = {
	ws_host: "10.1.1.1",
	vpca_group: "Dashboard",
	chat_group: "All",
	max_rate: 500,
	min_rate: 1000
}

let ep = new EventProcessor(streamConfig, events)
// ep.setDebug(true)

let NEW_EVENT = {
	name: "GPS_GS",
	params: ["GPS_gs"],
	async calculate(prev, [GPS_gs]) {
		return GPS_gs
	},
	async shouldEmit(prev, curr, timeDiff) {
		return false
	}
}
ep.addEvent(NEW_EVENT)

let sub = ep.subscribe(e => {
	console.log("EVENT", e)
})

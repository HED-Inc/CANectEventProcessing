import EventProcessor from "event-processing"

const events = [
	{
		name: "SHOCK_EVENT",
		params: ["Acc_mag"],
		calculate: (prev: any, [Acc_mag]: Array<any>) => {
			return Acc_mag
		},
		shouldEmit: (prev: any, curr: any, timeDiff: any) => {
			return curr > 1024
		}
	}
]

let newEvent = {
	name: "X_TILT_OVER",
	params: ["X_tilt"],
	calculate: (prev: any, [X_tilt]: Array<any>) => {
		return X_tilt
	},
	shouldEmit: (prev: any, curr: any, timeDiff: any) => {
		return Number(curr) < -90
	}
}

let streamConfig = {
	wsHost: "10.1.1.1",
	vpcaGroup: "VPCA",
	chatGroup: "CHAT",
	maxRate: 500,
	minRate: 1000
}

let ep = new EventProcessor(streamConfig, events)
let sub = ep.subscribe(e => {
	console.log("EVENT", e)
})

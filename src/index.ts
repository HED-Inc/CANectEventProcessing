import { Subject } from "rxjs";
import config from "./config";
import messages from "./valuestream";
import { EmittedEvent, StateElement } from './interfaces';

// Create the event bus
const EventsBus = new Subject<EmittedEvent>();

// Helper function to filter invalid values
const NULL_STR = "NULL";
const isValid = (val:any) => {
	return val != NULL_STR && val != "";
}

// Create the state array from the defined events
let states:Array<StateElement> = config.map(c => {
	return {
		name: c.name,
		values: new Array(c.params.length),
		previous: null,
		timestamp: 0
	};
});

// Define variables
let param_idx,
	state_idx,
	current,
	previous,
	timestamp,
	timeDiff,
	now = null;

// Subscribe and iterate over defined events
const messagesSubscription = messages.subscribe((msg:any) => {
	// Validate the value
	if (!isValid(msg.value)) return;

	console.log(msg);

	config.forEach(c => {
		// Check if it is used in this function
		param_idx = c.params.indexOf(msg.label);
		if (param_idx == -1) return;

		// Find the current state
		state_idx = states.findIndex(s => s.name == c.name);
		if (state_idx == -1) return;

		// Set the current value in the same param_idx
		states[state_idx].values[param_idx] = msg.value;

		// Check if all values are set
		if (states[state_idx].values.includes(undefined)) return;

		// Previous result
		previous = states[state_idx].previous;

		// Invoke the callback
		current = c.calculate(previous, [...states[state_idx].values]);

		// Test the current to cache
		if (current != previous) {
			// Get the current date timestamp
			now = new Date().getTime();

			// Get the previous time
			timestamp = states[state_idx].timestamp;
			if (timestamp) {
				timeDiff = now - timestamp;
			}

			// Determine if the event should fire
			if (c.hasOwnProperty("shouldEmit") &&
				c.shouldEmit(previous, current, timeDiff)
			) {
				EventsBus.next({
					name: c.name,
					value: current,
					timestamp: now
				});
			}

			// Update the previous value
			states[state_idx].previous = current;
			states[state_idx].timestamp = now;
		}
	});
});

process.on("SIGHUP", () => {
	console.log("SIGHUP");
	messagesSubscription.unsubscribe();
});
process.on("SIGTERM", () => {
	console.log("SIGTERM");
	messagesSubscription.unsubscribe();
});

export default EventsBus
import { share } from 'rxjs/operators';
import ValueStream from './valuestream';
import { Observable, Subject, Subscription } from 'rxjs';
import {
	StreamValue,
	EmittedEvent,
	StateElement,
	EventItemConfig,
	ValueStreamConfig
} from './interfaces';

// Helper function to filter invalid values
const NULL_STR = "NULL";
const isValid = (val:any) => val != NULL_STR && val != "";

export default class EventProcessor
{
	private debug:boolean = false;

	private valueStream:ValueStream;
	private valuesStreamSub:Subscription;

	private states:Array<StateElement> = [];
	private eventConfigs:Array<EventItemConfig> = [];

	private bus:Subject<EmittedEvent> = new Subject<EmittedEvent>();

	public constructor(streamConfig:ValueStreamConfig, eventConfigs?:Array<EventItemConfig>)
	{
		this.valueStream = new ValueStream(streamConfig);

		if (Array.isArray(eventConfigs) && eventConfigs.length) {
			this.addEvents(eventConfigs);
		}

		this.initExitHandler();
	}

	public run()
	{
		if (this.valuesStreamSub) {
			this.valuesStreamSub.unsubscribe();
		}

		this.valuesStreamSub = this.valueStream.messages.subscribe((msg:StreamValue) => {
			// Log incoming message if debug
			if (this.debug) {
				console.log(`Message: ${JSON.stringify(msg)}\n`);
			}

			// Validate the value, verify event configs exist
			if (!isValid(msg.value) || !this.eventConfigs.length) return;

			// Iterate over each of the event configurations
			this.eventConfigs.forEach(async (ec: EventItemConfig) => {
				// Check if it is used in this function
				let param_idx = ec.params.indexOf(msg.label);
				if (!ec.params.includes(msg.label) || param_idx == -1) return;

				// Find the current state
				let state_idx = this.states.findIndex(s => s.name == ec.name);
				if (state_idx == -1) return;

				// Set the current value in the same param_idx
				this.states[state_idx].values[param_idx] = msg.value;

				// Check if all values are set
				if (this.states[state_idx].values.includes(undefined)) return;

				// Previous result
				let previous = this.states[state_idx].previous;

				// Determine if outputs are defined from previous callbacks
				let outputs = null;
				if (ec.outputs && ec.outputs !== null) {
					outputs = this.buildOutputs(ec.outputs);
				}

				// Invoke the callback
				let current;
				if (outputs) {
					current = await ec.calculate(previous, [...this.states[state_idx].values], [...outputs]);
				} else {
					current = await ec.calculate(previous, [...this.states[state_idx].values]);
				}
				// Returning false will skip
				if (current === false) return;

				// Get the current date timestamp
				let now = new Date().getTime();

				// Get the previous time
				let time_diff = null;
				let timestamp = this.states[state_idx].timestamp;
				if (timestamp) {
					time_diff = now - timestamp;
				}

				// Determine if the event should fire
				let should_emit = await ec.shouldEmit(previous, current, time_diff);
				if (should_emit) {
					this.bus.next({
						name: ec.name,
						value: current,
						timestamp: now
					});
				}

				// Set the current value
				if (ec.set_param) {
					let set_param_val = current;

					// Check if optional callback is defined
					if (ec.hasOwnProperty("getSetParamValue")) {
						set_param_val = await ec.getSetParamValue(previous, current, time_diff);
					}

					// Validate
					if (set_param_val !== false) {
						this.valueStream.setParameter(ec.set_param, set_param_val);
					}
				}

				// Update the previous value
				this.states[state_idx].previous = current;
				this.states[state_idx].timestamp = now;
			});
		}, (error) => {
			console.log('ERROR', error);
		});
	}

	private buildOutputs(list:Array<string>):Array<any>
	{
		// Filter -> sort -> map to get array of values in order
		return this.states.filter(s => list.includes(s.name))
			.sort((a, b) => list.indexOf(a.name) - list.indexOf(b.name))
			.map(s => s.previous);
	}

	private buildStates()
	{
		// Filter out any removed
		const event_names = this.eventConfigs.map(ec => ec.name);
		this.states = this.states.filter(s => event_names.includes(s.name));

		// Add any not in
		const state_names = this.states.map(s => s.name);
		this.eventConfigs.forEach(ec => {
			if (!state_names.includes(ec.name)) {
				this.states.push({
					name: ec.name,
					values: new Array(ec.params.length),
					previous: null,
					timestamp: 0
				});
			}
		});
	}

	public getStates()
	{
		return this.states.map(obj => ({...obj}));
	}

	public getStateValue(name:string)
	{
		return this.states.find((s) => s.name == name);
	}

	public setDebug(debug:boolean)
	{
		this.debug = debug;
		this.valueStream.setDebug(debug);
	}

	private findEvent(name:string)
	{
		return this.eventConfigs.find(e => e.name == name);
	}

	public addEvents(events:Array<EventItemConfig>)
	{
		events.forEach(e => this.addEvent(e, false));
		this.buildStates();
		return this;
	}

	public addEvent(event:EventItemConfig, renew:boolean = true)
	{
		let e = this.findEvent(event.name);
		if (!e) {
			this.eventConfigs.push(event);
			if (renew) {
				this.buildStates();
			}
		}
		return this;
	}

	public removeEvent(name:string)
	{
		let e = this.findEvent(name);
		if (e) {
			this.eventConfigs.splice(this.eventConfigs.indexOf(e), 1);
			this.buildStates();
		}
		return this;
	}

	public subscribe(callback):Subscription
	{
		if (!this.valuesStreamSub) {
			this.run();
		}

		return this.bus.subscribe(callback);
	}

	public unsubscribe()
	{
		if (this.valuesStreamSub) {
			this.valuesStreamSub.unsubscribe();
		}
	}

	private initExitHandler()
	{
		// Unsubscribing
		process.on('exit', () => this.unsubscribe());
	}
}
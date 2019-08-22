import { share } from 'rxjs/operators';
import ValueStream from './valuestream';
import { Observable, Subject, Subscription } from 'rxjs';
import { EventItemConfig, EmittedEvent, StateElement, ValueStreamConfig } from './interfaces';

// Helper function to filter invalid values
const NULL_STR = "NULL";
const isValid = (val:any) => val != NULL_STR && val != "";

export default class EventProcessor
{
	private valueStream:ValueStream;
	private valuesStreamSub:Subscription;

	private states:Array<StateElement> = [];
	private eventConfigs:Array<EventItemConfig> = [];

	private bus:Subject<EmittedEvent> = new Subject<EmittedEvent>();

	public constructor(streamConfig:ValueStreamConfig, eventConfigs?:Array<EventItemConfig>)
	{
		this.valueStream = new ValueStream(streamConfig);

		if (eventConfigs && eventConfigs.length) {
			this.addEvents(eventConfigs);
		}

		this.initExitHandler();
	}

	private async run()
	{
		if (!this.eventConfigs.length) {
			throw new Error('No event configuration given');
		}

		// Define variables
		let param_idx,
			state_idx,
			current,
			previous,
			timestamp,
			time_diff,
			outputs,
			now = null;

		this.valuesStreamSub = this.valueStream.messages.subscribe((msg:any) => {
			// Validate the value
			if (!isValid(msg.value)) return;

			console.log(msg);

			// Iterate over each of the event configurations
			this.eventConfigs.forEach(async ec => {
				// Check if it is used in this function
				param_idx = ec.params.indexOf(msg.label);
				if (param_idx == -1) return;

				// Find the current state
				state_idx = this.states.findIndex(s => s.name == ec.name);
				if (state_idx == -1) return;

				// Set the current value in the same param_idx
				this.states[state_idx].values[param_idx] = msg.value;

				// Check if all values are set
				if (this.states[state_idx].values.includes(undefined)) return;

				// Previous result
				previous = this.states[state_idx].previous;

				// Determine if outputs are defined from previous callbacks
				outputs = null;
				if (this.states[state_idx].outputs != null) {
					outputs = this.buildOutputs(this.states[state_idx].outputs);
				}

				// Invoke the callback
				if (outputs) {
					current = await ec.calculate(previous, [...this.states[state_idx].values], [...outputs]);
				} else {
					current = await ec.calculate(previous, [...this.states[state_idx].values]);
				}

				// Test the current to cache
				if (current != previous) {
					// Get the current date timestamp
					now = new Date().getTime();

					// Get the previous time
					timestamp = this.states[state_idx].timestamp;
					if (timestamp) {
						time_diff = now - timestamp;
					}

					// Determine if the event should fire
					if (ec.hasOwnProperty("shouldEmit")) {
						// Invoke
						let should_emit = await ec.shouldEmit(previous, current, time_diff);
						if (should_emit) {
							this.bus.next({
								name: ec.name,
								value: current,
								timestamp: now
							});
						}
					}

					// Set the current value
					if (ec.set_param) {
						this.valueStream.setParameter(ec.set_param, current);
					}

					// Update the previous value
					this.states[state_idx].previous = current;
					this.states[state_idx].timestamp = now;
				}
			});
		}, (error) => {
			console.log('ERROR', error);
		});
	}

	private buildOutputs(list:Array<string>)
	{
		// Filter -> sort -> map to get array of values in order
		return this.states.filter(s => list.includes(s.name))
			.sort((a, b) => list.indexOf(a.name) - list.indexOf(b.name))
			.map(s => s.previous);
	}

	private buildState()
	{
		// Filter out any removed
		const event_names = this.eventConfigs.map(ec => ec.name);
		this.states = this.states.filter(s => event_names.includes(s.name));

		// Add any not in
		const state_names = this.states.map(s => s.name);
		this.eventConfigs.forEach(ec => {
			if (!state_names.includes(ec.name)) {
				let outputs = null;
				if (ec.outputs) {
					outputs = new Array(ec.outputs.length);
				}

				this.states.push({
					name: ec.name,
					outputs,
					values: new Array(ec.params.length),
					previous: null,
					timestamp: 0
				});
			}
		});
	}

	private findEvent(name:string)
	{
		return this.eventConfigs.find(e => e.name == name);
	}

	public addEvents(events:Array<EventItemConfig>)
	{
		events.map(e => this.addEvent(e, false));
		this.buildState();
		return this;
	}

	public addEvent(event:EventItemConfig, renew:boolean = true)
	{
		let e = this.findEvent(event.name);
		if (!e) {
			this.eventConfigs.push(event);
			if (renew) {
				this.buildState();
			}
		}
		return this;
	}

	public removeEvent(name:string)
	{
		let e = this.findEvent(name);
		if (e) {
			this.eventConfigs.splice(this.eventConfigs.indexOf(e), 1);
			this.buildState();
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
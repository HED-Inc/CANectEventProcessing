import { share } from 'rxjs/operators';
import ValueStream from './valuestream';
import { Observable, Subject, Subscription } from 'rxjs';
import { EventItemConfig, EmittedEvent, StateElement, ValueStreamConfig } from './interfaces';

// Helper function to filter invalid values
const NULL_STR = "NULL";
const isValid = (val:any) => {
	return val != NULL_STR && val != "";
}

export default class EventProcessor
{
	private valueStream:ValueStream;
	private valuesStreamSub:Subscription;

	private states:Array<StateElement> = [];
	private eventConfigs:Array<EventItemConfig> = [];

	private bus:Subject<EmittedEvent> = new Subject<EmittedEvent>();

	public constructor(streamConfig:ValueStreamConfig, eventConfigs=[])
	{
		this.valueStream = new ValueStream(streamConfig);

		if (eventConfigs.length) {
			this.addEvents(eventConfigs);
		}

		this.initExitHandler();
	}

	public run()
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
			timeDiff,
			now = null;

		this.valuesStreamSub = this.valueStream.messages.subscribe((msg:any) => {
			// Validate the value
			if (!isValid(msg.value)) return;

			this.eventConfigs.forEach(c => {
				// Check if it is used in this function
				param_idx = c.params.indexOf(msg.label);
				if (param_idx == -1) return;

				// Find the current state
				state_idx = this.states.findIndex(s => s.name == c.name);
				if (state_idx == -1) return;

				// Set the current value in the same param_idx
				this.states[state_idx].values[param_idx] = msg.value;

				// Check if all values are set
				if (this.states[state_idx].values.includes(undefined)) return;

				// Previous result
				previous = this.states[state_idx].previous;

				// Invoke the callback
				current = c.calculate(previous, [...this.states[state_idx].values]);

				// Test the current to cache
				if (current != previous) {
					// Get the current date timestamp
					now = new Date().getTime();

					// Get the previous time
					timestamp = this.states[state_idx].timestamp;
					if (timestamp) {
						timeDiff = now - timestamp;
					}

					// Determine if the event should fire
					if (c.hasOwnProperty("shouldEmit") &&
						c.shouldEmit(previous, current, timeDiff)
					) {
						this.bus.next({
							name: c.name,
							value: current,
							timestamp: now
						});
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

	private buildStates()
	{
		// Filter out any removed
		const eventNames = this.eventConfigs.map(ec => ec.name);
		this.states = this.states.filter(s => {
			return eventNames.includes(s.name);
		});

		// Add any not in
		const stateNames = this.states.map(s => s.name);
		this.eventConfigs.forEach(ec => {
			if (!stateNames.includes(ec.name)) {
				this.states.push({
					name: ec.name,
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
		events.map(e => this.addEvent(e, false))
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
		process.on('exit', () => {
			this.unsubscribe();
		});
	}
}
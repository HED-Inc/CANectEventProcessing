import { Observable } from 'rxjs';
import { EventItemConfig } from './interfaces';

export default class EventBus
{
	private valueStream:Observable<any>;
	private eventConfigs:Array<EventItemConfig> = [];

	public constructor(valueStream:Observable<any>)
	{
		this.valueStream = valueStream;
	}

	private findEvent(name:string)
	{
		return this.eventConfigs.find(e => e.name == name);
	}

	public setEvents(events:Array<EventItemConfig>)
	{
		this.eventConfigs = events;
		return this;
	}

	public addEvent(event:EventItemConfig)
	{
		let e = this.findEvent(name);
		if (!e) {
			this.eventConfigs.push(event);
		}
		return this;
	}

	public removeEvent(name:string)
	{
		let e = this.findEvent(name);
		if (e) {
			this.eventConfigs.splice(this.eventConfigs.indexOf(e), 1);
		}
		return this;
	}

	public run()
	{

	}
}
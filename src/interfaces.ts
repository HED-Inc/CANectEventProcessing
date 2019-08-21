export interface EmittedEvent {
	name: string
	value: any
	timestamp: number
}

export interface StateElement {
	name: string
	values: Array<any>
	outputs: Array<any> | null
	previous: any
	timestamp: number
}

export interface CalculateFunction {
	(prev:any, params:Array<any>, outputs?:Array<any>): any
}

export interface ShouldEmitFunction {
	(prev:any, curr:any, time_diff:any): boolean
}

export interface EventItemConfig {
	name: string
	set_param?: string
	params: Array<string>
	outputs?: Array<string>
	calculate: CalculateFunction
	shouldEmit: ShouldEmitFunction
}

export interface StreamValue {
	id: number
	label: string
	value: any
	timestamp: string
}

export interface ValueStreamConfig {
	ws_host: string
	vpca_group?: string
	chat_group?: string
	max_rate: number
	min_rate: number
}
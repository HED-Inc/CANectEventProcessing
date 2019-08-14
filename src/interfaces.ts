export interface EmittedEvent {
	name: string
	value: any
	timestamp: number
}

export interface StateElement {
	name: string
	values: Array<any>
	previous: any
	timestamp: number
}

export interface CalculateFunction {
	(prev:any, params:Array<any>): any
}

export interface ShouldEmitFunction {
	(prev:any, curr:any, timeDiff:any): boolean
}

export interface EventItemConfig {
	name: string
	params: Array<string>
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
  wsHost: string
  vpcaGroup: string
  chatGroup: string
  maxRate: number
  minRate: number
}
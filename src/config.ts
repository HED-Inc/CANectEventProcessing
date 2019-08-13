const EXAMPLE_EVENT = {
	// Unique arbitrary name
	name: "SHOCK_EVENT",

	// Parameter labels to pass to 'calculate'
	params: ["Acc_mag"],

	// Logic callback with params in same order as above after 'prev'
	calculate: (prev:any, [Acc_mag]:Array<any>) => {
		return Acc_mag;
	},

	/**
	 * Determine if the event should emit
	 *
	 * @param {prev} previous calculated value
	 * @param {curr} current calculated valu
	 * @param {timeDiff} time difference since last call in ms
	 * @returns {boolean}
	 */
	shouldEmit: (prev:any, curr:any, timeDiff:any) => {
		return curr > 1024;
	}
};

export default [
	EXAMPLE_EVENT
];

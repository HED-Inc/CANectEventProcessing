const EXAMPLE_EVENT = {
	// Unique arbitrary name
	name: "SHOCK_EVENT",

	// VPCA parameter to set when changed
	set_param: "My_Param",

	// Parameter labels to pass to 'calculate'
	params: ["Acc_mag", "X_tilt"],

	// Other event values to inject
	outputs: ['OTHER_EVENT'],

	// Logic callback with params in same order as above after 'prev'
	async calculate (prev:any, [Acc_mag, X_Tilt]:Array<any>, [OTHER_EVENT]:Array<any>) {
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
	async shouldEmit (prev:any, curr:any, timeDiff:any) {
		return curr > 1024;
	}
};

export default [
	EXAMPLE_EVENT
];
